import { describe, expect, it } from 'vitest';
import { CURRICULUM_MAP, LEARNING_OBJECTIVES, curriculumIndicators, curriculumMapIssues, getLearningObjectives, sufficientMasteryEvidence, type CurriculumMap } from '../src/core/curriculum-map';

const copy = (): CurriculumMap => JSON.parse(JSON.stringify(CURRICULUM_MAP));

describe('source-grounded partial curriculum map', () => {
  it('covers all 24 topic headings without declaring complete exam objectives', () => {
    expect(curriculumMapIssues()).toEqual([]);
    expect(CURRICULUM_MAP.topics).toHaveLength(24);
    expect(CURRICULUM_MAP.sourceDocuments).toHaveLength(24);
    expect(CURRICULUM_MAP.catalogCompleteness).toBe('Partial');
    expect(CURRICULUM_MAP.finalExamObjectiveCount).toBeNull();
    expect(CURRICULUM_MAP.topics.every(t => !t.scope.allArticlesAssumedInScope)).toBe(true);
    expect(LEARNING_OBJECTIVES.every(o => o.status === 'Draft' && o.learningState === 'Unmeasured')).toBe(true);
  });
  it('rejects out-of-bound CBK and DMK articles even if a source document contains them', () => {
    for (const [topicId, article] of [['O01', 96], ['O01', 127], ['O02', 213]] as const) {
      const map = copy(); map.learningObjectives.find(o => o.topicId === topicId)!.legalReference!.article = article;
      expect(curriculumMapIssues(map).some(issue => issue.includes('outside article limit'))).toBe(true);
    }
    expect(getLearningObjectives('O01').every(o => o.legalReference!.article >= 97 && o.legalReference!.article <= 126)).toBe(true);
  });
  it('does not mislabel an out-of-section constitutional article with an allowed section name', () => {
    const map = copy();
    const objective = map.learningObjectives.find(o => o.topicId === 'O03')!;
    objective.legalReference!.article = 161;
    objective.legalReference!.section = 'Devletin Temel Organları';
    expect(curriculumMapIssues(map)).toContainEqual(expect.stringContaining('O03 outside named sections'));
  });
  it('keeps Atatürk objectives in historical context without invented legal article references', () => {
    const historical = getLearningObjectives('O04');
    expect(historical.length).toBeGreaterThan(2);
    expect(historical.every(o => o.legalReference === null && o.historicalReference !== null && o.evidence.verificationStatus === 'QualityLimited')).toBe(true);
    const map = copy(); map.learningObjectives.find(o => o.topicId === 'O04')!.legalReference = { article: 1, paragraph: null, clause: null, section: null };
    expect(curriculumMapIssues(map)).toContainEqual(expect.stringContaining('Historical objective cannot invent'));
  });
  it('rejects a broken source hash relationship and unapproved source evidence promotion', () => {
    const map = copy(); map.learningObjectives[0].evidence.sourceContentHash = 'f'.repeat(64);
    map.learningObjectives[0].status = 'Approved';
    const issues = curriculumMapIssues(map);
    expect(issues).toContainEqual(expect.stringContaining('Source hash relationship'));
    expect(issues).toContainEqual(expect.stringContaining('Draft evidence cannot approve'));
  });
  it('cannot infer that a partial draft target count is the official denominator', () => {
    const map = copy(); map.finalExamObjectiveCount = map.learningObjectives.length;
    expect(curriculumMapIssues(map)).toContain('Partial catalog cannot assert the final exam objective denominator');
  });
});

describe('distinct learning indicators', () => {
  it('counts only unique solved published questions and keeps unknown coverage/mastery null', () => {
    const result = curriculumIndicators({ publishedStudyQuestionIds: ['q1', 'q2', 'q2'], solvedQuestionIds: ['q1', 'q1', 'not-published'], representedObjectiveIds: new Set(LEARNING_OBJECTIVES.map(o => o.id)) });
    expect(result.questionCompletion).toBe(0.5);
    expect(result.solvedPublishedUniqueQuestions).toBe(1);
    expect(result.representedApprovedObjectives).toBe(0);
    expect(result.curriculumCoverage).toBeNull();
    expect(result.learningMastery).toBeNull();
  });
  it('does not turn a learnt checkbox, a single question or repeated one-type responses into mastery', () => {
    expect(sufficientMasteryEvidence()).toBe(false);
    expect(sufficientMasteryEvidence({ independentQuestionCount: 1, cognitiveTypes: ['recall'], answered: 100, correct: 100, delayedRetentionCorrect: true })).toBe(false);
    expect(sufficientMasteryEvidence({ independentQuestionCount: 4, cognitiveTypes: ['recall', 'recall'], answered: 5, correct: 5, delayedRetentionCorrect: true })).toBe(false);
    expect(sufficientMasteryEvidence({ independentQuestionCount: 4, cognitiveTypes: ['recall', 'application'], answered: 5, correct: 4, delayedRetentionCorrect: false })).toBe(false);
    expect(sufficientMasteryEvidence({ independentQuestionCount: 4, cognitiveTypes: ['recall', 'application'], answered: 5, correct: 4, delayedRetentionCorrect: true })).toBe(true);
  });
  it('distinguishes completion from represented objectives and unmeasured mastery even for a complete future map', () => {
    const map = copy(); map.catalogCompleteness = 'Complete'; map.finalExamObjectiveCount = map.learningObjectives.length;
    const first = map.learningObjectives[0]; first.status = 'Approved'; first.evidence.verificationStatus = 'Verified';
    const result = curriculumIndicators({ map, publishedStudyQuestionIds: ['q1'], solvedQuestionIds: ['q1'], representedObjectiveIds: new Set([first.id]) });
    expect(result.questionCompletion).toBe(1);
    expect(result.curriculumCoverage).toBe(1 / map.learningObjectives.length);
    expect(result.learningMastery).toBeNull();
    expect(result.masteredObjectives).toBe(0);
  });
});
