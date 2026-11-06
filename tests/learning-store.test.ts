import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import content from '../data/approved-content.json';
import { createLearningStore, LearningConflictError, validateLearningBackup, type LearningStore } from '../src/learning-store';
import type { Question, SourceSnapshot } from '../src/core/content';

const stores: LearningStore[] = [];
const now = '2026-11-06T20:30:00.000Z';
const questions = content.questions as unknown as Question[];
const snapshots = content.snapshots as SourceSnapshot[];
const store = (name = `learning-test-${crypto.randomUUID()}`) => { const db = createLearningStore(name); stores.push(db); return db; };
const register = (db: LearningStore) => db.registerCards({ questions: questions.slice(0, 2), snapshots }, now);
afterEach(async () => { await Promise.all(stores.splice(0).map(db => db.close())); });

describe('source-linked learning cards and persistent schedules', () => {
  it('creates question-as-card records only from actual Approved source-linked content', async () => {
    const db = store(); expect(await register(db)).toMatchObject({ registered: 2, skipped: [] });
    const cards = await db.dueCards(now);
    expect(cards).toHaveLength(2); expect(cards[0]).toMatchObject({ front: questions[0].text, type: 'concept', format: 'verified-question', revision: 0 });
    expect(cards[0].back).toBe(questions[0].options.find(option => option.id === questions[0].correctOptionId)!.text);
    expect(cards[0].source).toMatchObject({ snapshotId: questions[0].sourceSnapshotId, contentHash: snapshots[0].contentHash, locator: questions[0].sourceLocator });
    cards[0].back = 'Caller mutation'; expect((await db.getCard(cards[0].id))?.back).not.toBe('Caller mutation');
  });
  it('never leaks pool A or unverified content, even when completed exam IDs are supplied', async () => {
    const db = store(); const protectedQuestion = { ...structuredClone(questions[0]), id: 'Synthetic:A', sourcePool: 'A' as const, examId: 'EX:1' };
    const draft = { ...structuredClone(questions[1]), verificationStatus: 'Draft' as const };
    const result = await db.registerCards({ questions: [protectedQuestion, draft], snapshots, completedExamIds: new Set(['EX:1']) }, now);
    expect(result.registered).toBe(0); expect(result.skipped).toHaveLength(2); expect(await db.dueCards(now)).toEqual([]);
    expect((await db.exportData()).cards).toEqual([]);
  });
  it('requires separate accepted historical usage rights as well as the publication gate', async () => {
    const db = store(); const historical = { ...structuredClone(questions[0]), sourcePool: 'C' as const, historicalDecision: 'Accepted' as const };
    expect((await db.registerCards({ questions: [historical], snapshots }, now)).registered).toBe(0);
    expect((await db.registerCards({ questions: [historical], snapshots, historicalRightsAcceptedIds: new Set([historical.id]) }, now)).registered).toBe(1);
    expect((await db.dueCards(now))[0].sourcePool).toBe('C');
  });
  it('persists rated recall and releases a card exactly when due, independent of midnight', async () => {
    const name = `learning-resume-${crypto.randomUUID()}`; const first = store(name); await register(first);
    const card = (await first.dueCards(now))[0];
    const reviewed = await first.reviewCard(card.id, 4, { expectedRevision: 0, reviewedAt: now });
    expect(reviewed.schedule.dueAt).toBe('2026-11-07T20:30:00.000Z');
    await first.close(); const reopened = store(name);
    expect((await reopened.getCard(card.id))?.revision).toBe(1);
    expect((await reopened.dueCards('2026-11-07T20:29:59.999Z')).some(item => item.id === card.id)).toBe(false);
    expect((await reopened.dueCards('2026-11-07T20:30:00.000Z')).some(item => item.id === card.id)).toBe(true);
    expect((await reopened.stats(now)).mastery).toBeNull();
  });
  it('rejects stale ratings atomically across tabs and blocks Strict Mode learning actions', async () => {
    const name = `learning-tabs-${crypto.randomUUID()}`; const a = store(name); const b = store(name); await register(a);
    const card = (await a.dueCards(now))[0];
    await a.reviewCard(card.id, 4, { expectedRevision: 0, reviewedAt: now });
    await expect(b.reviewCard(card.id, 0, { expectedRevision: 0, reviewedAt: now })).rejects.toBeInstanceOf(LearningConflictError);
    await expect(b.reviewCard(card.id, 4, { expectedRevision: 1, strictMode: true })).rejects.toThrow('Strict');
    await expect(b.recordError({ questionId: card.questionId, questionVersion: 1, topicId: 'O02', strictMode: true })).rejects.toThrow('Strict');
    expect((await a.exportData()).reviews).toHaveLength(1);
  });
  it('preserves completed card histories while a new source version or revocation hides old cards', async () => {
    const db = store(); await register(db); const card = (await db.dueCards(now))[0];
    await db.reviewCard(card.id, 3, { expectedRevision: 0, reviewedAt: now });
    await db.registerCards({ questions: [{ ...questions[0], verificationStatus: 'Outdated' }], snapshots }, now);
    expect(await db.getCard(card.id)).toBeNull(); expect((await db.exportData()).reviews).toHaveLength(1);
    await db.registerCards({ questions: [questions[0]], snapshots }, now);
    expect((await db.getCard(card.id))?.revision).toBe(1);
  });
});

describe('optional error reasons and safe learning backups', () => {
  it('keeps user reasons separate from inference and never diagnoses from one independent question', async () => {
    const db = store();
    const base = { questionId: questions[0].id, questionVersion: 1, topicId: 'O02', conceptId: 'withdrawal', occurredAt: now };
    await db.recordError({ ...base, id: 'ERR:1', userReason: 'attention', inferredReason: { reason: 'knowledge', confidence: 0.3, method: 'Repeated-concept heuristic' }, activeTimeMs: 12000 });
    await db.recordError({ ...base, id: 'ERR:2' });
    expect(await db.stats(now)).toMatchObject({ userReasons: { attention: 1 }, inferredReasons: { knowledge: 1 }, conceptRecommendations: [] });
    await db.recordError({ ...base, id: 'ERR:3', questionId: questions[1].id });
    expect((await db.stats(now)).conceptRecommendations).toHaveLength(1);
    const last = (await db.exportData()).errors[2]; expect(last.userReason).toBeNull(); expect(last.activeTimeMs).toBeNull();
  });
  it('validates schedules by replaying the entire SM2 chain and rejects invented results', async () => {
    const db = store(); await register(db); const card = (await db.dueCards(now))[0];
    const unrated = await db.exportData(); unrated.cards[0].schedule.easeFactor = 9;
    expect(() => validateLearningBackup(unrated)).toThrow();
    await db.reviewCard(card.id, 4, { expectedRevision: 0, reviewedAt: now });
    const backup = await db.exportData(); expect(validateLearningBackup(backup)).toEqual(backup);
    const damaged = structuredClone(backup); damaged.cards[0].schedule.easeFactor = 9;
    expect(() => validateLearningBackup(damaged)).toThrow();
    const injected = structuredClone(backup); (injected.cards[0] as { sourcePool: string }).sourcePool = 'A';
    expect(() => validateLearningBackup(injected)).toThrow();
    expect((await db.exportData()).cards[0].schedule.easeFactor).toBe(2.5);
  });
  it('imports unknown historical cards as unavailable until exact current Approved registration', async () => {
    const source = store(); await register(source); const card = (await source.dueCards(now))[0];
    await source.reviewCard(card.id, 4, { expectedRevision: 0, reviewedAt: now });
    const backup = await source.exportData(); const destination = store(); await destination.importData(backup);
    expect(await destination.dueCards('2027-01-01T00:00:00Z')).toEqual([]); expect(await destination.getCard(card.id)).toBeNull();
    expect((await destination.exportData()).cards).toHaveLength(2);
    await register(destination); expect((await destination.getCard(card.id))?.revision).toBe(1);
    expect((await destination.stats(now)).reviewCount).toBe(1);
    await destination.importData(backup); expect((await destination.stats(now)).reviewCount).toBe(1);
  });
  it('rejects a conflict before writing any other new events and preserves local progress', async () => {
    const db = store(); await register(db); const card = (await db.dueCards(now))[0];
    await db.recordError({ id: 'ERR:1', questionId: card.questionId, questionVersion: 1, topicId: 'O02', occurredAt: now });
    const old = await db.exportData(); await db.reviewCard(card.id, 4, { expectedRevision: 0, reviewedAt: now });
    const damaged = structuredClone(old); damaged.errors.push({ ...damaged.errors[0], id: 'ERR:2' });
    await expect(db.importData(damaged)).rejects.toBeInstanceOf(LearningConflictError);
    expect((await db.exportData()).errors).toHaveLength(1); expect((await db.getCard(card.id))?.revision).toBe(1);
    const forged = await db.exportData(); forged.cards[0].front = 'Forged source text';
    await expect(db.importData(forged)).rejects.toBeInstanceOf(LearningConflictError);
    expect((await db.getCard(card.id))?.front).toBe(card.front);
  });
  it('does not overwrite local notes sharing an error ID or accept invalid confidence and active time', async () => {
    const db = store(); const base = { id: 'ERR:same', questionId: questions[0].id, questionVersion: 1, topicId: 'O02', occurredAt: now };
    await db.recordError(base); await db.recordError(base);
    await expect(db.recordError({ ...base, userReason: 'outdated' })).rejects.toBeInstanceOf(LearningConflictError);
    await expect(db.recordError({ ...base, confidence: 2 })).rejects.toThrow();
    await expect(db.recordError({ ...base, activeTimeMs: -1 })).rejects.toThrow();
    expect((await db.stats(now)).errorCount).toBe(1);
  });
});
