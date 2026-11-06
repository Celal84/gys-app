import { describe, expect, it } from 'vitest';
import { compareSelfExplanation, conceptRecommendations, ERROR_REASONS, initialSchedule, reviewSm2, type LearningError } from '../src/core/learning';

describe('adapted SM-2 learning heuristics', () => {
  it('uses the documented 1,3,7,14,30 bootstrap and then the updated ease factor', () => {
    let schedule = initialSchedule('2026-11-06T09:00:00Z'); const intervals: number[] = [];
    for (let i = 0; i < 6; i++) { schedule = reviewSm2(schedule, 4, schedule.dueAt); intervals.push(schedule.intervalDays); }
    expect(intervals).toEqual([1, 3, 7, 14, 30, 75]); expect(schedule.repetitions).toBe(6);
    expect(schedule.totalReviews).toBe(6); expect(schedule.easeFactor).toBe(2.5);
  });
  it('resets failed recall, lowers EF with a floor, and restarts on the next success', () => {
    let schedule = reviewSm2(initialSchedule('2026-11-06T00:00:00Z'), 5, '2026-11-06T00:00:00Z');
    schedule = reviewSm2(schedule, 2, schedule.dueAt);
    expect(schedule).toMatchObject({ repetitions: 0, intervalDays: 1, lapses: 1, totalReviews: 2 });
    for (let i = 0; i < 10; i++) schedule = reviewSm2(schedule, 0, schedule.dueAt);
    expect(schedule.easeFactor).toBe(1.3);
    expect(reviewSm2(schedule, 3, schedule.dueAt)).toMatchObject({ repetitions: 1, intervalDays: 1 });
  });
  it('keeps Istanbul clock time and exact due timestamps across UTC midnight', () => {
    const schedule = reviewSm2(initialSchedule('2026-11-06T23:30:00+03:00'), 4, '2026-11-06T23:30:00+03:00');
    expect(schedule.dueAt).toBe('2026-11-07T20:30:00.000Z');
    expect(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }).format(new Date(schedule.dueAt))).toBe('23:30');
  });
  it('rejects invalid ratings, corrupt schedules and backwards review timestamps', () => {
    const first = reviewSm2(initialSchedule('2026-11-06T00:00:00Z'), 4, '2026-11-06T00:00:00Z');
    for (const quality of [-1, 6, 2.5, NaN]) expect(() => reviewSm2(first, quality)).toThrow();
    expect(() => reviewSm2(first, 4, '2026-11-05T00:00:00Z')).toThrow('eski');
    expect(() => reviewSm2({ ...first, easeFactor: Infinity }, 4)).toThrow();
  });
});

describe('optional source-reviewed concept assistance', () => {
  const concepts = [{ id: 'C:1', label: 'Süre', requiredTerms: ['beş gün'], contradictionTerms: ['on gün'] },
    { id: 'C:2', label: 'Yetki', requiredTerms: ['kurum', 'izin'] }];
  it('reports exact phrase coverage and reviewed contradiction hints without certifying correctness', () => {
    const result = compareSelfExplanation({ text: 'Beş gün içinde kurum tarafından izin verilir.', concepts });
    expect(result).toMatchObject({ status: 'assisted', matchedConceptIds: ['C:1', 'C:2'], missingConceptIds: [], conceptCoverage: 1 });
    expect(result.notice).toContain('hukuki doğrulama');
    const contradiction = compareSelfExplanation({ text: 'Beş gün değil on gün, kurum izin verir.', concepts });
    expect(contradiction.contradictionConceptIds).toEqual(['C:1']); expect(contradiction.missingConceptIds).toContain('C:1');
    expect(compareSelfExplanation({ text: 'beşeri gün kurum izinsiz', concepts }).matchedConceptIds).toEqual([]);
  });
  it('is skippable, empty references do not invent coverage, and Strict Mode disables analysis', () => {
    expect(compareSelfExplanation({ concepts, skipped: true }).status).toBe('skipped');
    expect(compareSelfExplanation({ concepts, text: 'bilgi', strictMode: true })).toMatchObject({ status: 'disabled', matchedConceptIds: [], conceptCoverage: null });
    expect(compareSelfExplanation({ concepts: [], text: 'bilgi' }).conceptCoverage).toBeNull();
  });
});

describe('error evidence thresholds', () => {
  const error = (id: string, questionId: string): LearningError => ({ id, questionId, questionVersion: 1, topicId: 'O02', occurredAt: '2026-11-06T00:00:00.000Z',
    userReason: null, inferredReason: null, conceptId: 'withdrawal', relatedConceptId: 'deemed-withdrawn', confidence: null, activeTimeMs: null });
  it('has all nine reasons and requires different questions rather than repeated errors on one question', () => {
    expect(Object.keys(ERROR_REASONS)).toHaveLength(9);
    expect(conceptRecommendations([error('E:1', 'Q:1'), error('E:2', 'Q:1')])).toEqual([]);
    const result = conceptRecommendations([error('E:1', 'Q:1'), error('E:2', 'Q:1'), error('E:3', 'Q:2')]);
    expect(result).toHaveLength(1); expect(result[0].questionIds).toEqual(['Q:1', 'Q:2']);
    expect(result[0].relatedConceptIds).toEqual(['deemed-withdrawn']); expect(result[0].recommendation).toContain('kesin');
  });
});
