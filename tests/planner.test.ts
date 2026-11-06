import { describe, expect, it } from 'vitest';
import { LEARNING_OBJECTIVES } from '../src/core/curriculum-map';
import { buildStudyPlan, DEFAULT_WEEKLY_CAPACITY, istanbulDate, type PlannerQuestion } from '../src/core/planner';

const now = new Date('2026-11-09T08:00:00Z');
const objectives = LEARNING_OBJECTIVES;
const target = objectives.find(o => o.topicId === 'O02')!;
// Algorithm-only fixture; no fabricated question enters published content.
const questions: PlannerQuestion[] = Array.from({ length: 18 }, (_, index) => ({
  id: `fixture-${index}`, topicId: 'O02', learningObjectiveId: target.id,
  legalProvisionId: 'fixture-provision-657-3', sourcePool: 'B', verificationStatus: 'Approved',
}));
const base = { now, objectives, availableQuestions: questions };

describe('time-budgeted, source-aware study planning', () => {
  it('allocates exactly 480 minutes and a default 30/10/20 weekday without promising nonexistent questions', () => {
    const plan = buildStudyPlan(base);
    expect(plan.weeklyCapacityMinutes).toBe(480);
    expect(plan.days.reduce((sum, day) => sum + day.plannedMinutes, 0)).toBe(480);
    expect(plan.days[0].tasks.map(t => [t.kind, t.minutes])).toEqual([['learn', 30], ['review', 10], ['practice', 20]]);
    expect(plan.days.filter(day => ['saturday', 'sunday'].includes(day.weekday)).map(day => day.capacityMinutes)).toEqual([90, 90]);
    expect(plan.days.flatMap(d => d.tasks).filter(t => t.kind === 'practice').every(t => t.questionCount === 10 && t.questionIds.length === 10)).toBe(true);
    expect(plan.days.flatMap(d => d.tasks).every(t => t.sourceLocator && t.reason && t.minutes > 0)).toBe(true);
  });
  it('redistributes the weekend to one uninterrupted 150-minute mock and 30 minutes while preserving the total', () => {
    const plan = buildStudyPlan({ ...base, scheduleMock: true, mockAvailable: {
      examId: 'fixture-valid-exam', validated: true, questionIds: Array.from({ length: 100 }, (_, i) => `fixture-mock-${i}`),
    } });
    const saturday = plan.days.find(day => day.weekday === 'saturday')!;
    const sunday = plan.days.find(day => day.weekday === 'sunday')!;
    expect(plan.weeklyCapacityMinutes).toBe(480);
    expect(saturday.tasks).toHaveLength(1);
    expect(saturday.tasks[0]).toMatchObject({ kind: 'mock', minutes: 150, questionCount: 100 });
    expect(sunday.capacityMinutes).toBe(30);
    expect(plan.days.reduce((sum, d) => sum + d.plannedMinutes, 0)).toBe(480);
  });
  it('does not build a partial mock or ignore an edited insufficient consecutive budget', () => {
    const capacities = { ...DEFAULT_WEEKLY_CAPACITY, saturday: 60, sunday: 60 };
    const plan = buildStudyPlan({ ...base, capacities, scheduleMock: true,
      mockAvailable: { examId: 'fixture', validated: true, questionIds: Array.from({ length: 100 }, (_, i) => `fixture-${i}`) } });
    expect(plan.days.flatMap(d => d.tasks).some(t => t.kind === 'mock')).toBe(false);
    expect(plan.notes.join(' ')).toContain('parçalara bölünmedi');
    const unavailable = buildStudyPlan({ ...base, scheduleMock: true });
    expect(unavailable.notes.join(' ')).toContain('hazır değil');
  });
  it('labels source approval pending and excludes protected, historical, draft or unlinked questions', () => {
    const plan = buildStudyPlan({ ...base, availableQuestions: [
      { ...questions[0], sourcePool: 'A' }, { ...questions[1], sourcePool: 'C' },
      { ...questions[2], verificationStatus: 'Draft' }, { ...questions[3], learningObjectiveId: 'nonexistent' },
    ] });
    expect(plan.days.flatMap(d => d.tasks).every(t => t.questionCount === 0 && t.kind !== 'practice')).toBe(true);
    expect(plan.days.flatMap(d => d.tasks).some(t => t.sourceStatus === 'pending')).toBe(true);
    expect(plan.priorities.every(t => t.probability === null && t.expectedLoss === null)).toBe(true);
    const empty = buildStudyPlan({ ...base, objectives: [] });
    expect(empty.days.every(d => d.tasks.length === 0 && d.status === 'unplanned')).toBe(true);
  });
  it('uses Istanbul calendar days around midnight and never completes missed or merely opened days', () => {
    const plan = buildStudyPlan({ ...base, now: new Date('2026-11-10T21:30:00Z'), startDate: '2026-11-09',
      completedSessions: [{ date: '2026-11-09', minutes: 20 }, { date: '2026-11-10', minutes: 0 }, { date: '2026-11-12', minutes: 600 }] });
    expect(istanbulDate(new Date('2026-11-10T21:30:00Z'))).toBe('2026-11-11');
    expect(plan.days[0].status).toBe('partial');
    expect(plan.days[1].status).toBe('missed');
    expect(plan.days[2].status).toBe('scheduled');
    expect(plan.days.every(d => d.status !== 'completed')).toBe(true);
    expect(buildStudyPlan({ ...base, now: new Date('2027-02-26T21:01:00Z') }).daysToExam).toBe(0);
    expect(buildStudyPlan({ ...base, now: new Date('2027-02-26T21:01:00Z') }).days.every(d => d.tasks.length === 0)).toBe(true);
  });
  it('records completion only from worked minutes and checks individual task evidence separately', () => {
    const initial = buildStudyPlan(base);
    const plan = buildStudyPlan({ ...base, completedSessions: [{ date: initial.today, minutes: 60, taskId: initial.days[0].tasks[0].id }] });
    expect(plan.days[0].status).toBe('completed');
    expect(plan.days[0].tasks.map(t => t.status)).toEqual(['completed', 'pending', 'pending']);
  });
  it('raises priority for weight, knowledge gaps, forgetting, coverage and unreliable evidence; rejects invalid capacities', () => {
    const plan = buildStudyPlan({ ...base, topicSignals: [
      { topicId: 'O01', probability: 0.95, reliability: 1, scopeCoverage: 1, lastReviewedAt: now.toISOString() },
      { topicId: 'O02', probability: 0.3, reliability: 0.2, scopeCoverage: 0.2, lastReviewedAt: '2026-09-01T10:00:00Z' },
    ] });
    expect(plan.priorities[0].topicId).toBe('O02');
    expect(plan.priorities.find(p => p.topicId === 'O02')!.expectedLoss).toBeCloseTo(5.6);
    expect(() => buildStudyPlan({ ...base, capacities: { ...DEFAULT_WEEKLY_CAPACITY, monday: -1 } })).toThrow();
    expect(() => buildStudyPlan({ ...base, startDate: '2026-99-99' })).toThrow('geçersiz');
  });
});
