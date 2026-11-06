import { describe, expect, it } from 'vitest';
import { readWorkspace, restoreBackup, ROLLBACK_KEY, saveWorkspace, validateQuestions, validateState, WORKSPACE_KEY } from '../src/storage.js';

const legacyStateKey = 'gys_duo_state_v1';
const legacyQuestionsKey = 'gys_duo_questions_v1';
const makeState = () => ({
  xp: 20, dailyXP: 10, streak: 1, hearts: 5, totalAnswered: 3, totalCorrect: 2,
  lastActiveDate: '2026-11-06', topicStats: { '657': { answered: 3, correct: 2 } },
  mistakes: { '1': { wrongCount: 1, streak: 0, lastWrong: 1793952000000 } }, customWeights: { G02: 8 },
  settings: { quizSize: 10, dailyGoal: 100, mixMistakes: true, examMode: false, sound: true }
});
const makeQuestion = (id = 1) => ({ id, cat: 'Genel %70', topic: '657', weight: 8, q: 'Test için bir soru?', opts: ['Bir', 'İki', 'Üç', 'Dört', 'Beş'], ans: 1, exp: 'Yalnız test verisi.' });
const makeEnvelope = () => ({ schemaVersion: 1, state: makeState(), questions: [makeQuestion()] });

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    snapshot() { return Array.from(values.entries()); }
  };
}

describe('state and question validation', () => {
  it('imports can never assert question approval', () => {
    const question = { ...makeQuestion(), verificationStatus: 'Approved' };
    expect(validateQuestions([question])[0].verificationStatus).toBe('ValidationPending');
    expect(question.verificationStatus).toBe('Approved');
  });
  it.each([
    { ...makeQuestion(), opts: ['a', 'b', 'c', 'd'] },
    { ...makeQuestion(), opts: ['Bir', 'bir', 'Üç', 'Dört', 'Beş'] },
    { ...makeQuestion(), ans: 5 }, { ...makeQuestion(), id: '__proto__' },
    { ...makeQuestion(), id: 0 }, { ...makeQuestion(), weight: Infinity }
  ])('rejects invalid questions before persistence', question => {
    expect(() => validateQuestions([question])).toThrow();
  });
  it('normalizes numeric identity for conflict detection', () => {
    expect(() => validateQuestions([makeQuestion(1), makeQuestion('1')])).toThrow(/Tekrarlanan/);
  });
  it('rejects malicious keys at any nesting level', () => {
    const malicious = JSON.parse(JSON.stringify(makeState()));
    malicious.topicStats = JSON.parse('{"constructor":{"answered":1,"correct":0}}');
    expect(() => validateState(malicious)).toThrow(/Güvensiz/);
    expect({}.polluted).toBeUndefined();
  });
  it.each([
    { totalCorrect: 4 }, { totalAnswered: -1 }, { dailyXP: NaN }, { lastActiveDate: '2026-02-30' },
    { settings: { ...makeState().settings, mixMistakes: 'yes' } },
    { topicStats: { test: { answered: 0, correct: 1 } } }
  ])('rejects impossible progress', change => expect(() => validateState({ ...makeState(), ...change })).toThrow());
});

describe('non-destructive storage and restore', () => {
  it('loads legacy records with nested defaults without changing a byte', () => {
    const state = makeState(); delete state.settings.sound;
    const store = storage({ [legacyStateKey]: JSON.stringify(state), [legacyQuestionsKey]: JSON.stringify([makeQuestion()]) });
    const before = store.snapshot();
    const read = readWorkspace(store, makeState());
    expect(read.state.totalAnswered).toBe(3);
    expect(read.state.settings.sound).toBe(true);
    expect(read.questions[0].verificationStatus).toBe('ValidationPending');
    expect(store.snapshot()).toEqual(before);
  });
  it('damaged new record falls back but is preserved and reported', () => {
    const store = storage({ [WORKSPACE_KEY]: '{broken', [legacyStateKey]: JSON.stringify(makeState()) });
    const before = store.snapshot();
    const result = readWorkspace(store, makeState());
    expect(result.error).toMatch(/Yeni kayıt okunamadı/);
    expect(result.state.totalAnswered).toBe(3);
    expect(store.snapshot()).toEqual(before);
  });
  it('malformed restore changes no storage key', () => {
    const store = storage({ [WORKSPACE_KEY]: JSON.stringify(makeEnvelope()) });
    const before = store.snapshot();
    expect(() => restoreBackup(store, { state: { totalAnswered: -1 }, questions: [] }, makeEnvelope())).toThrow();
    expect(store.snapshot()).toEqual(before);
  });
  it('future schema is rejected without changes', () => {
    const store = storage({ [WORKSPACE_KEY]: JSON.stringify(makeEnvelope()) });
    const before = store.snapshot();
    expect(() => restoreBackup(store, { ...makeEnvelope(), schemaVersion: 99 }, makeEnvelope())).toThrow(/sürümü/);
    expect(store.snapshot()).toEqual(before);
  });
  it('conflicting question text cannot silently overwrite the old question', () => {
    const store = storage({ [WORKSPACE_KEY]: JSON.stringify(makeEnvelope()) });
    const incoming = makeEnvelope(); incoming.questions[0].q = 'Farklı soru';
    const before = store.snapshot();
    expect(() => restoreBackup(store, incoming, makeEnvelope())).toThrow(/çakışması/);
    expect(store.snapshot()).toEqual(before);
  });
  it('valid legacy backup restores atomically with rollback, never touching legacy originals', () => {
    const previous = JSON.stringify(makeEnvelope());
    const store = storage({ [WORKSPACE_KEY]: previous, [legacyStateKey]: 'original-state', [legacyQuestionsKey]: 'original-questions' });
    const incoming = { state: { ...makeState(), xp: 30 }, questions: [makeQuestion()] };
    const restored = restoreBackup(store, incoming, makeEnvelope());
    expect(restored.schemaVersion).toBe(1);
    expect(restored.state.xp).toBe(30);
    expect(store.getItem(ROLLBACK_KEY)).toBe(previous);
    expect(store.getItem(legacyStateKey)).toBe('original-state');
    expect(store.getItem(legacyQuestionsKey)).toBe('original-questions');
  });
  it('quota failure on the main write leaves the original active record intact', () => {
    const previous = JSON.stringify(makeEnvelope());
    const store = storage({ [WORKSPACE_KEY]: previous });
    const set = store.setItem;
    store.setItem = (key, value) => { if (key === WORKSPACE_KEY) throw new Error('QuotaExceededError'); set(key, value); };
    expect(() => restoreBackup(store, makeEnvelope(), makeEnvelope())).toThrow(/Quota/);
    expect(store.getItem(WORKSPACE_KEY)).toBe(previous);
    expect(store.getItem(ROLLBACK_KEY)).toBe(previous);
  });
  it('save validates before the single active write', () => {
    const store = storage({ [legacyStateKey]: 'keep' });
    const result = saveWorkspace(store, makeState(), [makeQuestion()]);
    expect(JSON.parse(store.getItem(WORKSPACE_KEY))).toEqual(result);
    expect(store.getItem(legacyStateKey)).toBe('keep');
    const before = store.snapshot();
    expect(() => saveWorkspace(store, { ...makeState(), totalCorrect: 100 }, [])).toThrow();
    expect(store.snapshot()).toEqual(before);
  });
});
