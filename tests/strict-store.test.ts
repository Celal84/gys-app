import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TOPICS } from '../src/core/curriculum';
import type { Question, SourceSnapshot } from '../src/core/content';
import { createStrictStore, STRICT_DURATION_MS, StrictConflictError, StrictInProgressError, validateStrictJournal, type StartStrictInput, type StrictStore } from '../src/strict-store';

/** Synthetic fixtures exercise mechanics only. They are never application content or legal evidence. */
function fixture(examId = 'synthetic-only-exam'): StartStrictInput {
  const snapshot: SourceSnapshot = { id: 'synthetic-source', sourceId: 'test-only', sourceUrl: 'https://example.org/synthetic',
    contentHash: 'a'.repeat(64), hashAlgorithm: 'sha256', version: 'synthetic-1', readAt: '2026-11-06T00:00:00Z', verificationStatus: 'Verified', legalEdition: 'preparation' };
  const questions: Question[] = TOPICS.flatMap(topic => Array.from({ length: topic.examWeight }, (_, n) => ({
    id: `synthetic-${topic.id}-${n}`, version: 1, sourcePool: 'A', topicId: topic.id, learningObjectiveId: `synthetic-${topic.id}-objective-${n}`,
    text: `SYNTHETIC TEST ONLY ${topic.id} ${n}`, options: ['one', 'two', 'three', 'four', 'five'].map(id => ({ id, text: `Synthetic ${id}` })),
    correctOptionId: 'three', explanation: 'Synthetic explanation, not a statement of law.', legalProvisionId: 'synthetic-provision',
    sourceSnapshotId: snapshot.id, sourceLocator: `synthetic:${topic.id}:${n}`, articleNumber: topic.id === 'O01' ? 97 : 1,
    scopeMapping: { status: 'Approved', evidenceLocator: 'synthetic scope fixture' }, difficulty: 'basic', cognitiveType: 'synthetic',
    scenarioFlag: false, verificationStatus: 'Approved', generatedBy: 'synthetic-fixture-writer', examId,
    verificationEvidence: [{ id: `synthetic-check-${topic.id}-${n}`, method: 'rule-check', checkedBy: 'synthetic-fixture-checker',
      checkedAt: '2026-11-06T00:00:00Z', sourceSnapshotId: snapshot.id, sourceContentHash: snapshot.contentHash,
      sourceLocator: `synthetic:${topic.id}:${n}`, correctOptionId: 'three', conclusion: 'pass', evidence: 'Synthetic mechanics fixture; not legal approval.' }],
  })));
  return { definition: { id: examId, version: 1, title: 'SYNTHETIC TEST ONLY', questionIds: questions.map(q => q.id), verificationStatus: 'Verified',
    verifiedAt: '2026-11-06T00:00:00Z', verificationEvidence: 'Synthetic exam mechanics review only; never published.' }, questions, snapshots: [snapshot] };
}
const stores: StrictStore[] = [];
function setup(name = `strict-test-${crypto.randomUUID()}`, initial = Date.parse('2026-11-06T10:00:00Z')) {
  let wall = initial, monotonic = 0;
  const clock = { now: () => wall, monotonicNow: () => monotonic };
  const db = createStrictStore({ dbName: name, clock }); stores.push(db);
  return { db, name, clock, advance(ms: number) { wall += ms; monotonic += ms; }, wall(ms: number) { wall = ms; },
    monotonic(ms: number) { monotonic += ms; } };
}
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(stores.splice(0).map(db => db.close())); });

describe('Protected Strict Mode journal (synthetic fixtures, no real exam content)', () => {
  it('requires a fully verified 100-question canonical pool A exam, never fills missing content', async () => {
    const { db } = setup();
    for (const edit of [
      (p: StartStrictInput) => { p.questions.pop(); },
      (p: StartStrictInput) => { p.questions[0].sourcePool = 'B'; },
      (p: StartStrictInput) => { p.questions[0].verificationStatus = 'ValidationPending'; },
      (p: StartStrictInput) => { p.questions[0].topicId = 'O02'; p.questions[0].articleNumber = 1; },
      (p: StartStrictInput) => { p.questions[0].articleNumber = 96; },
      (p: StartStrictInput) => { p.questions[0].verificationEvidence[0].method = 'ai-self-review'; },
      (p: StartStrictInput) => { p.snapshots[0].verificationStatus = 'Pending'; },
      (p: StartStrictInput) => { p.definition.verificationStatus = 'Pending'; },
      (p: StartStrictInput) => { p.definition.questionIds.reverse(); },
      (p: StartStrictInput) => { p.questions[0].examId = 'other'; },
    ]) { const input = fixture(); edit(input); await expect(db.start(input)).rejects.toThrow(); }
    expect(await db.getActiveView()).toBeNull(); expect(await db.listSummaries()).toEqual([]);
    const start = await db.start(fixture());
    expect(start.questions).toHaveLength(100); expect(start.remainingMs).toBe(STRICT_DURATION_MS);
    expect(start).toMatchObject({ status: 'active', revision: 0, attemptNumber: 1, isFirstAttempt: true, result: null });
  });
  it('never exposes answers, explanations, source quotations or review while active', async () => {
    const { db } = setup(); let view = await db.start(fixture());
    expect(view).not.toHaveProperty('review');
    for (const question of view.questions) {
      expect(Object.keys(question).sort()).toEqual(['id', 'options', 'text', 'topicId', 'version']);
      expect(question).not.toHaveProperty('correctOptionId'); expect(question).not.toHaveProperty('explanation');
    }
    view = await db.saveAnswer(view.id, { questionId: view.questions[0].id, selectedOptionId: 'three', expectedRevision: 0 });
    expect(view.answers[0]).not.toHaveProperty('correct'); expect(view.result).toBeNull();
    expect(await db.getResult(view.id)).toBeNull();
    expect((await db.listSummaries())[0]).not.toHaveProperty('questions');
    view = await db.finish(view.id, view.revision);
    expect(view.review?.questions[0].correctOptionId).toBe('three');
    expect(view.review?.snapshots[0].contentHash).toBe('a'.repeat(64));
  });
  it('allows navigation, changed/cleared stable-option answers and scores no penalty', async () => {
    const { db } = setup(); const input = fixture(); input.questions[0].options.reverse();
    let view = await db.start(input);
    view = await db.saveAnswer(view.id, { questionId: input.questions[0].id, selectedOptionId: 'one', expectedRevision: view.revision });
    view = await db.saveAnswer(view.id, { questionId: input.questions[0].id, selectedOptionId: 'three', expectedRevision: view.revision });
    view = await db.setCursor(view.id, 99, view.revision);
    view = await db.saveAnswer(view.id, { questionId: input.questions[99].id, selectedOptionId: 'one', expectedRevision: view.revision });
    view = await db.saveAnswer(view.id, { questionId: input.questions[1].id, selectedOptionId: 'two', expectedRevision: view.revision });
    view = await db.saveAnswer(view.id, { questionId: input.questions[1].id, selectedOptionId: null, expectedRevision: view.revision });
    view = await db.setCursor(view.id, 0, view.revision);
    expect(view.timings[0]).toMatchObject({ returnCount: 1, answerChangeCount: 1 });
    expect(view.timings[1].answerChangeCount).toBe(1);
    const done = await db.finish(view.id, view.revision);
    expect(done.result).toMatchObject({ correct: 1, wrong: 1, blank: 98, score: 1, total: 100,
      common: { correct: 1, wrong: 0, blank: 69, total: 70 }, technical: { correct: 0, wrong: 1, blank: 29, total: 30 } });
    expect(done.result?.perTopic).toHaveLength(24); expect(await db.getActiveView()).toBeNull();
  });
  it('persists immutable question, option, source and answer key versions across connections', async () => {
    const env = setup(); const input = fixture(); const start = await env.db.start(input);
    input.questions[0].text = 'Later caller edit'; input.questions[0].correctOptionId = 'one'; input.snapshots[0].contentHash = 'b'.repeat(64);
    start.questions[0].options[0].text = 'Mutation of returned view';
    await env.db.close(); const next = setup(env.name);
    const resumed = await next.db.getActiveView(); expect(resumed?.id).toBe(start.id);
    expect(resumed?.questions[0].text).toBe(fixture().questions[0].text); expect(resumed?.foreground).toBe(false);
    const done = await next.db.finish(start.id, resumed!.revision);
    expect(done.review?.questions[0].correctOptionId).toBe('three'); expect(done.review?.snapshots[0].contentHash).toBe('a'.repeat(64));
    done.review!.questions[0].correctOptionId = 'one';
    expect((await next.db.loadView(start.id))?.review?.questions[0].correctOptionId).toBe('three');
  });
  it('auto-finishes on the exact wall-clock deadline and ignores late answers', async () => {
    const env = setup(); const start = await env.db.start(fixture());
    env.advance(STRICT_DURATION_MS - 1);
    let view = await env.db.loadView(start.id); expect(view?.remainingMs).toBe(1); expect(view?.status).toBe('active');
    env.advance(1);
    view = await env.db.saveAnswer(start.id, { questionId: start.questions[0].id, selectedOptionId: 'three', expectedRevision: start.revision });
    expect(view).toMatchObject({ status: 'completed', finishReason: 'timeout', finishedAt: start.deadlineAt, result: { correct: 0, blank: 100 } });
    expect(view?.answers).toEqual([]); expect(view?.timings[0].foregroundMs).toBe(STRICT_DURATION_MS);
    expect((await env.db.finish(start.id, -100)).revision).toBe(view?.revision);
    await expect(env.db.saveAnswer(start.id, { questionId: start.questions[0].id, selectedOptionId: 'three', expectedRevision: view!.revision })).rejects.toThrow('Tamamlanmış');
  });
  it.each(['load', 'active', 'result', 'summaries'] as const)('auto-finishes expired attempts on %s after reload', async method => {
    const first = setup(); const start = await first.db.start(fixture()); await first.db.close();
    const next = setup(first.name, Date.parse(start.deadlineAt) + 5000);
    if (method === 'load') expect((await next.db.loadView(start.id))?.status).toBe('completed');
    if (method === 'active') expect(await next.db.getActiveView()).toBeNull();
    if (method === 'result') expect((await next.db.getResult(start.id))?.blank).toBe(100);
    if (method === 'summaries') expect((await next.db.listSummaries())[0].status).toBe('completed');
    expect((await next.db.loadView(start.id))?.finishedAt).toBe(start.deadlineAt);
    expect((await next.db.loadView(start.id))?.timings[0].foregroundMs).toBe(0);
  });
  it('a backward system clock cannot increase remaining time during a lifetime or beyond the persisted high-water mark', async () => {
    const env = setup(); const start = await env.db.start(fixture()); env.advance(60000);
    const before = await env.db.loadView(start.id); env.wall(Date.parse(start.startedAt) - 3600000); env.monotonic(30000);
    const after = await env.db.loadView(start.id);
    expect(after?.remainingMs).toBe(before!.remainingMs - 30000); expect(after?.clockWarning).toBe(true);
    await env.db.close(); const reloaded = setup(env.name, Date.parse(start.startedAt) - 3600000);
    const resumed = await reloaded.db.loadView(start.id); expect(resumed?.remainingMs).toBe(after?.remainingMs); expect(resumed?.clockWarning).toBe(true);
  });
  it('foreground timing excludes known hidden periods while the total deadline keeps running', async () => {
    const env = setup(); let view = await env.db.start(fixture()); env.advance(10000);
    view = await env.db.setForeground(view.id, false, view.revision); env.advance(600000);
    view = (await env.db.loadView(view.id))!; expect(view.timings[0].foregroundMs).toBe(10000);
    expect(view.remainingMs).toBe(STRICT_DURATION_MS - 610000);
    view = await env.db.setForeground(view.id, true, view.revision); env.advance(5000);
    view = await env.db.setCursor(view.id, 1, view.revision); env.advance(3000);
    view = (await env.db.loadView(view.id))!;
    expect(view.timings[0].foregroundMs).toBe(15000); expect(view.timings[1].foregroundMs).toBe(3000);
  });
  it('rejects stale writes and simultaneous starts atomically across tabs', async () => {
    const first = setup(); const second = setup(first.name);
    const results = await Promise.allSettled([first.db.start(fixture()), second.db.start(fixture())]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(r => r.status === 'rejected'); expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(StrictInProgressError);
    const active = (await first.db.getActiveView())!;
    const committed = await first.db.saveAnswer(active.id, { questionId: active.questions[0].id, selectedOptionId: 'three', expectedRevision: 0 });
    await expect(second.db.saveAnswer(active.id, { questionId: active.questions[1].id, selectedOptionId: 'one', expectedRevision: 0 })).rejects.toBeInstanceOf(StrictConflictError);
    await expect(second.db.finish(active.id, 0)).rejects.toBeInstanceOf(StrictConflictError);
    expect((await second.db.loadView(active.id))?.answers).toEqual(committed.answers);
  });
  it('rolls back answer and revision if summary persistence fails', async () => {
    const { db } = setup(); const start = await db.start(fixture()); const original = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function(this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      if (this.name === 'summaries') throw new Error('Synthetic storage failure');
      return original.call(this, value, key);
    });
    await expect(db.saveAnswer(start.id, { questionId: start.questions[0].id, selectedOptionId: 'three', expectedRevision: 0 })).rejects.toThrow('Synthetic storage failure');
    vi.restoreAllMocks(); expect((await db.loadView(start.id))?.answers).toEqual([]); expect((await db.loadView(start.id))?.revision).toBe(0);
  });
  it('uses stable definition/version identity for repeats and preserves completed results', async () => {
    const { db } = setup(); const first = await db.start(fixture()); const done = await db.finish(first.id, 0);
    const second = await db.start(fixture()); expect(second).toMatchObject({ attemptNumber: 2, isFirstAttempt: false }); await db.finish(second.id, 0);
    const next = fixture(); next.definition.version = 2; next.questions[0].version = 2; next.questions[0].correctOptionId = 'one';
    next.questions[0].verificationEvidence[0].correctOptionId = 'one';
    const updated = await db.start(next); expect(updated).toMatchObject({ attemptNumber: 1, isFirstAttempt: true }); await db.finish(updated.id, 0);
    expect((await db.loadView(first.id))?.result).toEqual(done.result); expect((await db.loadView(first.id))?.review?.questions[0].correctOptionId).toBe('three');
    const changed = fixture(); changed.questions[0].text += ' changed'; await expect(db.start(changed)).rejects.toThrow('değişmez');
  });
  it('reserves question identity and normalized text across different exam definitions', async () => {
    const { db } = setup(); const first = await db.start(fixture()); await db.finish(first.id, 0);
    await expect(db.start(fixture('synthetic-other-exam'))).rejects.toThrow('başka bir denemede');
    const textDuplicate = fixture('synthetic-other-exam'); textDuplicate.questions.forEach(q => { q.id += '-other'; });
    textDuplicate.definition.questionIds = textDuplicate.questions.map(q => q.id);
    await expect(db.start(textDuplicate)).rejects.toThrow('başka bir denemede');
    const unique = fixture('synthetic-other-exam'); unique.questions.forEach(q => { q.id += '-new'; q.text += ' independent'; });
    unique.definition.questionIds = unique.questions.map(q => q.id);
    expect((await db.start(unique)).isFirstAttempt).toBe(true);
  });
  it('rejects invalid positions, options and revisions without partial mutation', async () => {
    const { db } = setup(); const start = await db.start(fixture());
    await expect(db.setCursor(start.id, 100, 0)).rejects.toThrow('konumu');
    await expect(db.saveAnswer(start.id, { questionId: start.questions[0].id, selectedOptionId: 'bad', expectedRevision: 0 })).rejects.toThrow('seçenek');
    await expect(db.setForeground(start.id, false, -1)).rejects.toBeInstanceOf(StrictConflictError);
    expect((await db.loadView(start.id))?.revision).toBe(0); expect(await db.loadView('unknown')).toBeNull();
  });
  it('exports full snapshots, validates and merge-restores a journal idempotently', async () => {
    const donor = setup(); let view = await donor.db.start(fixture());
    view = await donor.db.saveAnswer(view.id, { questionId: view.questions[0].id, selectedOptionId: 'three', expectedRevision: 0 });
    await donor.db.finish(view.id, view.revision);
    const journal = await donor.db.exportData(); expect(validateStrictJournal(journal)).toEqual(journal);
    const recipient = setup(); expect(await recipient.db.importData(journal)).toEqual({ imported: 1, totalAttempts: 1 });
    expect(await recipient.db.importData(journal)).toEqual({ imported: 0, totalAttempts: 1 });
    expect((await recipient.db.getResult(view.id))?.score).toBe(1);
    expect((await recipient.db.loadView(view.id))?.review?.questions[0].correctOptionId).toBe('three');
    const repeat = await recipient.db.start(fixture()); expect(repeat.attemptNumber).toBe(2);
  });
  it('rejects corrupt backups and changed immutable histories without altering existing data', async () => {
    const donor = setup(); const view = await donor.db.start(fixture()); await donor.db.finish(view.id, 0);
    const backup = await donor.db.exportData(); const recipient = setup(); await recipient.db.importData(backup);
    const variants = [
      (v: typeof backup) => { v.attempts[0].result!.score = 99; },
      (v: typeof backup) => { v.attempts[0].deadlineAt = v.attempts[0].startedAt; },
      (v: typeof backup) => { v.attempts[0].answers = [{ questionId: 'missing', selectedOptionId: 'one', answeredAt: view.startedAt }]; },
      (v: typeof backup) => { v.attempts[0].timings[0].foregroundMs = -1; },
      (v: typeof backup) => { v.attempts[0].attemptNumber = 2; v.attempts[0].isFirstAttempt = false; },
      (v: typeof backup) => { v.attempts[0].snapshots[0].contentHash = 'b'.repeat(64); },
    ];
    for (const edit of variants) { const corrupt = structuredClone(backup); edit(corrupt); await expect(recipient.db.importData(corrupt)).rejects.toThrow(); }
    const conflict = structuredClone(backup); conflict.attempts[0].questions[0].text += ' edited historical question';
    await expect(recipient.db.importData(conflict)).rejects.toThrow('çakışıyor');
    expect((await recipient.db.getResult(view.id))?.score).toBe(0); expect((await recipient.db.listSummaries())).toHaveLength(1);
  });
  it('rejects merged backups with two active exams and restores expired imports as completed', async () => {
    const donor = setup(); const one = await donor.db.start(fixture()); const backup = await donor.db.exportData();
    const recipient = setup(); await recipient.db.start(fixture());
    await expect(recipient.db.importData(backup)).rejects.toThrow(); expect(await recipient.db.loadView(one.id)).toBeNull();
    const late = setup(undefined, Date.parse(one.deadlineAt) + 1000); await late.db.importData(backup);
    expect(await late.db.getActiveView()).toBeNull(); expect((await late.db.loadView(one.id))?.finishReason).toBe('timeout');
  });
  it('additively migrates v1 stores and reconstructs immutable definition/question reservations', async () => {
    const donor = setup(); const one = await donor.db.start(fixture()); await donor.db.finish(one.id, 0);
    const backup = await donor.db.exportData(); const name = `strict-old-${crypto.randomUUID()}`;
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('attempts', { keyPath: 'id' }).createIndex('status', 'status');
        db.createObjectStore('old-user-data', { keyPath: 'id' }).put({ id: 'retained', value: 42 });
        req.transaction!.objectStore('attempts').put(backup.attempts[0]);
      };
      req.onerror = () => reject(req.error); req.onsuccess = () => { req.result.close(); resolve(); };
    });
    const migrated = setup(name); expect((await migrated.db.loadView(one.id))?.result).toEqual(backup.attempts[0].result);
    await expect(migrated.db.start(fixture('other-exam'))).rejects.toThrow('başka bir denemede');
    const changed = fixture(); changed.questions[0].text += ' modified'; await expect(migrated.db.start(changed)).rejects.toThrow('değişmez');
    expect((await migrated.db.listSummaries())).toHaveLength(1);
    await migrated.db.close();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(name);
      req.onerror = () => reject(req.error); req.onsuccess = () => {
        const read = req.result.transaction('old-user-data').objectStore('old-user-data').get('retained');
        read.onsuccess = () => { expect(read.result).toEqual({ id: 'retained', value: 42 }); req.result.close(); resolve(); };
      };
    });
  });
});
