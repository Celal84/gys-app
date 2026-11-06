import 'fake-indexeddb/auto';
import { IDBObjectStore } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAttemptStore, type AttemptQuestion } from '../src/attempt-store';
import { createFullBackup, createFullBackupStore, FullBackupConflictError, prepareFullRestore, validateFullBackup,
  type FullBackupInput, type FullBackupStore } from '../src/full-backup';

const stores: FullBackupStore[] = [];
const exportedAt = '2026-11-06T12:00:00.000Z';
function input(): FullBackupInput {
  return { legacyWorkspace: { schemaVersion: 1, state: { xp: 0, dailyXP: 0, streak: 0, hearts: 5,
    totalAnswered: 0, totalCorrect: 0, lastActiveDate: null, settings: { quizSize: 10, dailyGoal: 100,
      mixMistakes: false, examMode: false, sound: false }, topicStats: {}, mistakes: {}, customWeights: {} }, questions: [] },
  journal: { kind: 'gys-study-journal', schemaVersion: 1, exportedAt, attempts: [] } };
}
function store(name = `full-backup-test-${crypto.randomUUID()}`): FullBackupStore { const db = createFullBackupStore(name); stores.push(db); return db; }
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(stores.splice(0).map(db => db.close())); });

describe('versioned full workspace backup', () => {
  it('round trips a full file, with staged review performing no database writes', async () => {
    const db = store(); const backup = await createFullBackup(input(), { exportedAt });
    const proposal = await prepareFullRestore(JSON.stringify(backup));
    expect(proposal.review).toEqual({ studyAttempts: 0, answeredQuestions: 0, legacyQuestions: 0, sections: [], retainsOriginalProfiles: true });
    expect(await db.readActive()).toBeNull();
    expect(await validateFullBackup(backup)).toEqual(backup);
    expect(proposal.profileId).toMatch(/^restore_/);
  });
  it('rejects checksum corruption, unsupported schemas, wrong kinds and PDF without mutation', async () => {
    const db = store(); const backup = await createFullBackup(input());
    await db.commitPrepared(await prepareFullRestore(backup), { approved: true, expectedRevision: 0 });
    const prior = await db.readActive();
    const corrupt = structuredClone(backup); corrupt.payload.legacyWorkspace.state.xp = 10;
    for (const bad of [corrupt, { ...backup, schemaVersion: 99 }, { ...backup, kind: 'PDF' }, '%PDF-1.7']) {
      await expect(prepareFullRestore(bad)).rejects.toThrow();
      expect(await db.readActive()).toEqual(prior);
    }
  });
  it('requires module schemas before allowing non-null optional data into a full file', async () => {
    const value = { ...input(), learning: { schemaVersion: 1, cards: [] } };
    await expect(createFullBackup(value)).rejects.toThrow(/doğrulayıcısı/);
    const validators = { learning: (data: unknown) => {
      if (!(data as { cards: unknown[] }).cards.every(item => typeof item === 'string')) throw new Error('Bad card');
    } };
    const backup = await createFullBackup(value, { validators });
    expect((await prepareFullRestore(backup, { validators })).review.sections).toEqual(['learning']);
    await expect(prepareFullRestore(backup)).rejects.toThrow(/doğrulayıcısı/);
    await expect(createFullBackup({ ...value, learning: { cards: [false] } }, { validators })).rejects.toThrow('Bad card');
  });
  it('does not trust imported bank approval claims', async () => {
    const value = input(); const legacy = value.legacyWorkspace as { questions: unknown[] };
    legacy.questions = [{ id: 'fixture', q: 'Synthetic, not published content', topic: 'Test', cat: 'Test', weight: 8,
      opts: ['a', 'b', 'c', 'd', 'e'], ans: 0, exp: '', verificationStatus: 'Approved' }];
    const backup = await createFullBackup(value);
    expect(backup.payload.legacyWorkspace.questions[0].verificationStatus).toBe('ValidationPending');
  });
  it('requires explicit approval, rejects manufactured proposals and isolates input mutations', async () => {
    const db = store(); const backup = await createFullBackup(input()); const proposal = await prepareFullRestore(backup);
    await expect(db.commitPrepared(proposal, { approved: false, expectedRevision: 0 })).rejects.toThrow(/onayı/);
    await expect(db.commitPrepared({ ...proposal }, { approved: true, expectedRevision: 0 })).rejects.toThrow(/doğrulayın/);
    backup.payload.legacyWorkspace.state.xp = 999;
    expect(Object.isFrozen(proposal.backup.payload.legacyWorkspace.state)).toBe(true);
    const saved = await db.commitPrepared(proposal, { approved: true, expectedRevision: 0 });
    expect(saved.backup.payload.legacyWorkspace.state.xp).toBe(0);
    saved.backup.payload.legacyWorkspace.state.xp = 1000;
    expect((await db.readActive())?.backup.payload.legacyWorkspace.state.xp).toBe(0);
  });
  it('serializes competing tabs and keeps the committed profile on a stale revision', async () => {
    const name = `full-two-tabs-${crypto.randomUUID()}`; const a = store(name); const b = store(name);
    const first = await prepareFullRestore(await createFullBackup(input()));
    const second = await prepareFullRestore(await createFullBackup(input()));
    const results = await Promise.allSettled([a.commitPrepared(first, { approved: true, expectedRevision: 0 }), b.commitPrepared(second, { approved: true, expectedRevision: 0 })]);
    expect(results.filter(item => item.status === 'fulfilled')).toHaveLength(1);
    expect((results.find(item => item.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(FullBackupConflictError);
    expect((await a.readActive())?.revision).toBe(1); expect(await b.readActive()).toEqual(await a.readActive());
  });
  it('aborts a failed canonical write and keeps the previous profile byte-for-byte', async () => {
    const db = store(); await db.commitPrepared(await prepareFullRestore(await createFullBackup(input())), { approved: true, expectedRevision: 0 });
    const prior = await db.readActive(); const proposal = await prepareFullRestore(await createFullBackup(input()));
    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      if ((value as { id: string }).id === 'active') throw new DOMException('Full', 'QuotaExceededError');
      return originalPut.call(this, value, key);
    });
    await expect(db.commitPrepared(proposal, { approved: true, expectedRevision: 1 })).rejects.toThrow('Full');
    expect(await db.readActive()).toEqual(prior);
  });
  it('rejects same question and attempt identities carrying conflicting content', async () => {
    const source = createAttemptStore(`backup-source-${crypto.randomUUID()}`);
    try {
      const question: AttemptQuestion = { id: 'fixture-q', version: 1, topicId: 'O02', topic: 'Test', weight: 8,
        text: 'Synthetic source', options: ['a','b','c','d','e'].map(id => ({id,text:id})), correctOptionId: 'a',
        explanation: 'Fixture', sourceUrl: 'https://example.org/test-only', sourceLocator: 'Fixture' };
      await source.start({ title: 'Fixture study', mode: 'study', questions: [question] });
      const value = { ...input(), journal: await source.exportJournal() }; const original = await createFullBackup(value);
      const changed = structuredClone(value); changed.journal.attempts[0].title = 'Different title with same ID';
      await expect(prepareFullRestore(await createFullBackup(changed), { current: original })).rejects.toThrow(/kimliği çakışması/);
    } finally { await source.close(); }
  });
  it('rejects prototype pollution, non-JSON values and oversized inputs before writes', async () => {
    await expect(prepareFullRestore('{"__proto__":{"polluted":true}}')).rejects.toThrow(/Güvensiz/);
    await expect(createFullBackup({ ...input(), learning: { value: Number.NaN } })).rejects.toThrow(/JSON/);
    await expect(prepareFullRestore(' '.repeat(32 * 1024 * 1024 + 1))).rejects.toThrow(/32 MiB/);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });
});
