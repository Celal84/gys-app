import { describe, it, expect, vi, afterEach } from 'vitest';
import { gysApp, DEFAULT_CURRICULUM, SEED_QUESTIONS } from '../src/app.js';
const fixture = { id: 'fixture', topic: DEFAULT_CURRICULUM[0].topic, cat: 'Genel %70', weight: 8, q: 'Yalnız test verisidir', opts: ['Bir','İki','Üç','Dört','Beş'], ans: 2, exp: 'Test açıklaması' };
function memory(initial = {}) {
  const records = new Map(Object.entries(initial));
  return { getItem: key => records.get(key) ?? null, setItem: (key,value) => records.set(key,value), entries: () => [...records.entries()] };
}
afterEach(() => vi.unstubAllGlobals());
describe('Preserved engine and safe phase-0 behavior', () => {
  it('keeps legacy topic names as progress keys while exposing canonical syllabus order', () => {
    expect(DEFAULT_CURRICULUM[1]).toMatchObject({ code: 'O02', topic: '657 Sayılı Devlet Memurları Kanunu' });
    expect(DEFAULT_CURRICULUM[20]).toMatchObject({ code: 'T05', topic: 'ÇED Yönetmeliği', weight: 3 });
  });
  it('never labels legacy records or imported approval assertions as published', () => {
    const app = gysApp();
    app.mergeQuestions([{ ...fixture, verificationStatus: 'Approved' }], false);
    expect(app.questions[0].verificationStatus).toBe('ValidationPending');
    expect(app.approvedQuestionCount()).toBe(0);
    expect(app.studyQuestions()).toEqual([]);
  });
  it('does not start an incomplete full exam or fall back to unrelated topic content', () => {
    const app = gysApp(); app.questions = [...SEED_QUESTIONS];
    app.startWeightedExam(); expect(app.quiz.active).toBe(false);
    app.startTopicQuiz(DEFAULT_CURRICULUM[0]); expect(app.quiz.active).toBe(false);
    expect(app.notice).toContain('onaylı soru henüz yok');
  });
  it('leaves unmeasured topics unknown and suppresses unsupported score predictions', () => {
    const app = gysApp();
    expect(app.getTopicMastery('unknown')).toBeNull();
    expect(app.topicAccuracyLabel('unknown')).toBe('Ölçülmedi');
    expect(app.weakestTopics()).toEqual([]);
    expect(app.estimatedGysScore()).toBe('Veri yetersiz');
  });
  it('preserves correct scoring, XP and double-submit protection in the legacy engine', () => {
    vi.stubGlobal('localStorage', memory());
    const app = gysApp(); app.state.settings.sound = false;
    app.launchQuiz('Sentetik motor testi', [fixture]); app.selectOption(2);
    app.checkAnswer(); app.checkAnswer();
    expect(app.state.totalAnswered).toBe(1); expect(app.state.totalCorrect).toBe(1);
    expect(app.state.xp).toBe(10); expect(app.quiz.correctCount).toBe(1);
    app.nextQuestion(); expect(app.quiz.summary).toBe(true);
  });
  it('preserves optional wrong-book tracking without exposing pending questions', () => {
    vi.stubGlobal('localStorage', memory());
    const app = gysApp(); app.state.settings.sound = false;
    app.launchQuiz('Sentetik motor testi', [fixture]); app.selectOption(0); app.checkAnswer();
    expect(app.state.mistakes.fixture.wrongCount).toBe(1);
    expect(app.state.totalCorrect).toBe(0); expect(app.mistakeList()).toEqual([]);
  });
  it('does not partially merge an invalid or conflicting batch', () => {
    const app = gysApp(); app.mergeQuestions([fixture], false);
    const before = JSON.stringify(app.questions);
    expect(() => app.mergeQuestions([{...fixture, id:'other'}, {...fixture, q:'Changed'}], false)).toThrow();
    expect(JSON.stringify(app.questions)).toBe(before);
  });
  it('does not change the visible bank if persistent import fails', () => {
    const store = memory(); store.setItem = () => { throw new Error('QuotaExceededError'); };
    vi.stubGlobal('localStorage', store);
    const app = gysApp();
    expect(() => app.mergeQuestions([fixture])).toThrow('QuotaExceededError');
    expect(app.questions).toEqual([]);
  });
  it('reads existing progress without writing or deleting any legacy storage bytes', async () => {
    const state = gysApp().state; state.totalAnswered=10; state.totalCorrect=8; state.xp=80;
    state.settings = { ...state.settings, sound: false };
    const store = memory({gys_duo_state_v1:JSON.stringify(state),gys_duo_questions_v1:JSON.stringify([fixture])});
    const before = store.entries(); vi.stubGlobal('localStorage',store);
    vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));
    const app = gysApp(); await app.initApp();
    expect(app.state.totalAnswered).toBe(10); expect(app.state.xp).toBe(80);
    expect(app.state.lastActiveDate).toBeNull();
    expect(store.entries()).toEqual(before);
  });
});
