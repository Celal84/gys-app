import { describe, expect, it } from 'vitest';
import { TOPICS } from '../src/core/curriculum';
import { buildForecast, calibrateForecasts, type ForecastObservation } from '../src/core/analytics';

const now = new Date('2026-11-06T10:00:00Z');
// Synthetic measurements exercise algorithms; they are never published content.
function broadStudyEvidence(): ForecastObservation[] {
  return TOPICS.flatMap(topic => Array.from({ length: 16 }, (_, index) => ({
    questionId: `fixture-${topic.id}-${index}`, objectiveId: `fixture-objective-${topic.id}-${index % 4}`,
    topicId: topic.id, attemptId: `fixture-study-${index % 2}`, sourcePool: 'B' as const,
    correct: index % 4 !== 0, firstSeen: true, completedAttempt: true, independentMock: false,
    answeredAt: '2026-11-06T09:00:00Z', difficulty: (['basic', 'medium', 'hard', 'application'] as const)[index % 4],
    cognitiveType: index % 2 ? 'application' : 'knowledge',
  })));
}

describe('honest weighted forecast', () => {
  it('does not turn unknown topics into zero or invent a score from the tiny current bank', () => {
    const empty = buildForecast({ observations: [], now });
    expect(empty.score).toBeNull();
    expect(empty.interval).toBeNull();
    expect(empty.topics).toHaveLength(24);
    expect(empty.topics.every(t => t.probability === null && t.expectedLoss === null)).toBe(true);
    const only657 = buildForecast({ observations: broadStudyEvidence().filter(o => o.topicId === 'O02'), now });
    expect(only657.status).toBe('insufficient-data');
    expect(only657.score).toBeNull();
    expect(only657.evidence.measuredTopics).toBe(1);
    expect(only657.topics.find(t => t.topicId === 'T08')!.probability).toBeNull();
  });
  it('uses all official weights, an uncertainty range, first-seen counts, and no 85 guarantee', () => {
    const forecast = buildForecast({ observations: broadStudyEvidence(), now });
    expect(forecast.status).toBe('experimental');
    expect(forecast.score).toBeCloseTo(forecast.topics.reduce((sum, t) => sum + t.weight * t.probability!, 0));
    expect(forecast.topics.reduce((sum, t) => sum + t.weight, 0)).toBe(100);
    expect(forecast.interval![0]).toBeLessThan(forecast.score!);
    expect(forecast.interval![1]).toBeGreaterThan(forecast.score!);
    expect(forecast.evidence.eligibleFirstSeen).toBe(384);
    expect(forecast.topics.every(t => t.expectedLoss === t.weight * (1 - t.probability!))).toBe(true);
    expect(forecast.targetGuaranteed).toBe(false);
    expect(forecast.limitation).toContain('85+ garantisi değildir');
  });
  it('excludes hundreds of repeated answers even when later marked firstSeen', () => {
    const evidence = broadStudyEvidence();
    const baseline = buildForecast({ observations: evidence, now });
    const repeated = Array.from({ length: 500 }, (_, index) => ({ ...evidence[0], correct: true,
      attemptId: `repeat-${index}`, answeredAt: '2026-11-06T09:30:00Z' }));
    const result = buildForecast({ observations: [...repeated, ...evidence], now });
    expect(result.evidence.repeatedExcluded).toBe(500);
    expect(result.score).toBe(baseline.score);
    expect(buildForecast({ observations: evidence.map(o => ({ ...o, firstSeen: false })), now }).score).toBeNull();
  });
  it('requires diverse targets, cognition and difficulty, rather than only a high raw answer count', () => {
    const rows = broadStudyEvidence().map(o => ({ ...o, objectiveId: `${o.topicId}-one-target`, difficulty: 'basic' as const, cognitiveType: 'knowledge' }));
    const result = buildForecast({ observations: rows, now });
    expect(result.score).toBeNull();
    expect(result.topics.every(t => !t.sufficient && t.reasons.length >= 3)).toBe(true);
  });
  it('rejects invalid or unfinished mocks and historical questions as current-score evidence', () => {
    const base = broadStudyEvidence()[0];
    const malformed = Array.from({ length: 100 }, (_, i) => ({ ...base, questionId: `invalid-mock-${i}`,
      sourcePool: 'A' as const, attemptId: 'bad-distribution', independentMock: true }));
    const result = buildForecast({ observations: [...malformed, { ...base, questionId: 'historical', sourcePool: 'C' },
      { ...base, questionId: 'unfinished', completedAttempt: false }, { ...base, questionId: 'future', answeredAt: '2027-01-01T00:00:00Z' }], now });
    expect(result.evidence.eligibleFirstSeen).toBe(0);
    expect(result.evidence.independentMockIds).toEqual([]);
    expect(result.evidence.historicalExcluded).toBe(1);
    expect(result.evidence.invalidExcluded).toBe(102);
  });
  it('recognizes only complete independent 70/30 mocks and gives their measurement more effective weight', () => {
    const mocks = Array.from({ length: 6 }, (_, examIndex) => TOPICS.flatMap(topic => Array.from({ length: topic.examWeight }, (_, index): ForecastObservation => ({
      questionId: `mock-${examIndex}-${topic.id}-${index}`, objectiveId: `target-${topic.id}-${(index + examIndex) % 4}`,
      topicId: topic.id, attemptId: `mock-${examIndex}`, sourcePool: 'A', correct: true, firstSeen: true,
      completedAttempt: true, independentMock: true, answeredAt: '2026-11-06T09:00:00Z',
      difficulty: (['basic', 'medium', 'hard', 'application'] as const)[(index + examIndex) % 4], cognitiveType: (index + examIndex) % 2 ? 'knowledge' : 'application',
    })))).flat();
    const result = buildForecast({ observations: mocks, now });
    expect(result.evidence.independentMockIds).toHaveLength(6);
    expect(result.evidence.eligibleFirstSeen).toBe(600);
    expect(result.status).toBe('experimental');
    expect(result.score).toBeGreaterThan(85);
    expect(result.score).toBeLessThan(100);
    expect(result.targetGuaranteed).toBe(false);
  });
  it('reduces effective evidence when all measurements become stale', () => {
    const stale = broadStudyEvidence().map(o => ({ ...o, answeredAt: '2026-01-01T00:00:00Z' }));
    const result = buildForecast({ observations: stale, now });
    expect(result.score).toBeNull();
    expect(result.topics.every(t => t.evidence.effectiveSampleSize < 2)).toBe(true);
  });
});

describe('prospective calibration', () => {
  it('uses later first independent mocks only and does not count repeated predictions as new validation exams', () => {
    const predictions = [{ id: 'before', score: 85, createdAt: '2026-11-01T10:00:00Z', independentMockIds: ['seen'] },
      { id: 'same-target', score: 87, createdAt: '2026-11-02T10:00:00Z', independentMockIds: [] },
      { id: 'after-start', score: 100, createdAt: '2026-11-03T10:01:00Z', independentMockIds: [] }];
    const outcome = { attemptId: 'new', startedAt: '2026-11-03T10:00:00Z', finishedAt: '2026-11-03T12:30:00Z',
      score: 80, firstAttempt: true, independent: true, totalQuestions: 100, validDistribution: true };
    const result = calibrateForecasts(predictions, [{ ...outcome, attemptId: 'repeat', firstAttempt: false }, outcome]);
    expect(result.comparisons.map(c => c.absoluteError)).toEqual([5, 7]);
    expect(result.meanAbsoluteError).toBe(6);
    expect(result.independentValidationCount).toBe(1);
    expect(result.status).toBe('insufficient-validation');
    expect(calibrateForecasts([], []).meanAbsoluteError).toBeNull();
  });
});
