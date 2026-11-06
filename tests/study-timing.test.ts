import { describe, expect, it } from 'vitest';
import { createStudyTimingTracker } from '../src/core/study-timing';

function fixture(maxGapMs?: number) {
  let time = 0;
  return { tracker: createStudyTimingTracker({ now: () => time, maxGapMs }), at(value: number) { time = value; } };
}

describe('conservative page-local question timing', () => {
  it('records foreground intervals until finishing, then excludes solution reading', () => {
    const { tracker, at } = fixture();
    expect(tracker.view('Q1')).toMatchObject({ firstViewedAt: 0, viewCount: 1, activeTimeMs: 0 });
    at(1000); tracker.tick();
    at(4000); expect(tracker.finish('Q1')).toMatchObject({ activeTimeMs: 4000, finishedAt: 4000 });
    at(14000); tracker.tick();
    expect(tracker.summary()).toMatchObject({ currentQuestionId: null, totalActiveTimeMs: 4000 });
  });
  it('ends the prior foreground segment at hide and excludes background plus resume gap', () => {
    const { tracker, at } = fixture(); tracker.view('Q1');
    at(1000); tracker.tick();
    at(3000); tracker.setVisible(false);
    at(7000); tracker.tick(false);
    at(300000); tracker.setVisible(true);
    at(302000); expect(tracker.finish('Q1')?.activeTimeMs).toBe(5000);
    expect(tracker.summary().unmeasuredGapCount).toBe(0);
  });
  it('excludes a large visible callback gap and resumes from the next observed boundary', () => {
    const { tracker, at } = fixture(); tracker.view('Q1');
    at(15000); tracker.tick();
    at(30001); tracker.tick();
    at(31001); expect(tracker.finish('Q1')).toMatchObject({ activeTimeMs: 16000, unmeasuredGapCount: 1 });
  });
  it('preserves a high-water time boundary after rollback and never counts the recovered range twice', () => {
    const { tracker, at } = fixture(); tracker.view('Q1');
    at(5000); tracker.tick();
    at(2000); tracker.tick();
    at(4000); tracker.tick();
    at(6000); expect(tracker.finish('Q1')).toMatchObject({ activeTimeMs: 6000, clockRollbackCount: 2, finishedAt: 6000 });
    expect(tracker.summary().clockRollbackCount).toBe(2);
  });
  it('measures separate questions, counts returns and does not count repeated render as another view', () => {
    const { tracker, at } = fixture(); tracker.view('Q1');
    at(1000); tracker.view('Q1');
    at(2000); tracker.view('Q2');
    at(4000); tracker.view('Q1');
    at(7000); tracker.finish('Q1');
    expect(tracker.summary().questions).toEqual([
      expect.objectContaining({ questionId: 'Q1', activeTimeMs: 5000, viewCount: 2, returnCount: 1, firstViewedAt: 0, lastViewedAt: 4000 }),
      expect.objectContaining({ questionId: 'Q2', activeTimeMs: 2000, viewCount: 1, returnCount: 0 }),
    ]);
    expect(tracker.summary().totalActiveTimeMs).toBe(7000);
  });
  it('records first selection separately from changed and cleared answers using persistent option IDs', () => {
    const { tracker } = fixture(); tracker.view('Q1');
    tracker.recordAnswer('Q1', null);
    tracker.recordAnswer('Q1', 'opt-first');
    tracker.recordAnswer('Q1', 'opt-first');
    tracker.recordAnswer('Q1', 'opt-second');
    tracker.recordAnswer('Q1', null);
    expect(tracker.summary().questions[0]).toMatchObject({ answerChanges: 2, lastSelectedOptionId: null });
  });
  it('does not reconstruct previous-page active time after reload', () => {
    const { tracker, at } = fixture(); tracker.view('Q1'); at(5000); tracker.finish('Q1');
    const reloaded = createStudyTimingTracker({ now: () => 3600000 });
    expect(reloaded.view('Q1')).toMatchObject({ firstViewedAt: 3600000, activeTimeMs: 0, returnCount: 0 });
    expect(tracker.summary().totalActiveTimeMs).toBe(5000);
  });
  it('returns detached snapshots and validates input before changing records', () => {
    const { tracker, at } = fixture(); const row = tracker.view('Q1'); row.activeTimeMs = 9000;
    const summary = tracker.summary(); summary.questions[0].viewCount = 99;
    expect(tracker.summary().questions[0]).toMatchObject({ activeTimeMs: 0, viewCount: 1 });
    expect(() => tracker.view('')).toThrow('kimliği');
    expect(() => tracker.recordAnswer('missing', 'opt')).toThrow('Önce');
    expect(() => tracker.recordAnswer('Q1', '')).toThrow('kimliği');
    at(Number.NaN); expect(() => tracker.tick()).toThrow('saati');
    expect(tracker.summary().totalActiveTimeMs).toBe(0);
    expect(() => createStudyTimingTracker({ maxGapMs: 15001 })).toThrow('aralığı');
    expect(() => createStudyTimingTracker({ maxGapMs: 0 })).toThrow('aralığı');
  });
  it('supports a tighter measurement gap and keeps unknown finishes harmless', () => {
    const { tracker, at } = fixture(2000); tracker.view('Q1');
    at(2500); tracker.tick(); at(3500); tracker.tick();
    expect(tracker.finish('missing')).toBeNull();
    expect(tracker.summary()).toMatchObject({ currentQuestionId: 'Q1', totalActiveTimeMs: 1000, unmeasuredGapCount: 1 });
  });
});
