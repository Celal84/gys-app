import rawMap from '../../data/curriculum-map.json';
import { TOPICS, type TopicId } from './curriculum';

export type ObjectiveStatus = 'Draft' | 'Approved' | 'Quarantined' | 'Outdated';
export type ScopeStatus = 'WithinOfficialArticleBoundary' | 'Pending' | 'Approved';
export interface LearningObjective {
  id: string;
  topicId: TopicId;
  subtopicId: string;
  subtopic: string;
  legalInstrument: string | null;
  legalReference: { article: number; paragraph: number | null; clause: string | null; section: string | null } | null;
  historicalReference: {
    period: string; event: string; institution: string | null; date: string | null;
    dateStatus: 'NotVerified' | 'Verified'; relationship: string;
  } | null;
  objective: string;
  importance: 'high' | 'medium' | 'low';
  prerequisiteObjectiveIds: string[];
  relatedQuestionIds: string[];
  learningState: 'Unmeasured' | 'Measuring' | 'Mastered';
  status: ObjectiveStatus;
  scopeStatus: ScopeStatus;
  coverageCategory: string;
  evidence: {
    sourceDocumentId: string;
    sourceContentHash: string;
    extractedTextHash: string;
    locator: {
      kind: 'pdf-page' | 'extracted-text-lines';
      pageIndex?: number; printedPage?: number | null;
      lineStart?: number; lineEnd?: number; excerptLine?: number; article?: number;
    };
    observedHeading: string | null;
    sourceExcerpt: string;
    verificationStatus: 'TextExtractedOnly' | 'QualityLimited' | 'Verified';
    limitations: string[];
  };
}
export interface CurriculumMap {
  schemaVersion: number;
  catalogVersion: string;
  legalEdition: 'preparation' | 'exam';
  catalogCompleteness: 'Partial' | 'Complete';
  finalExamObjectiveCount: number | null;
  scopePolicy: string;
  sourceDocuments: {
    id: string; topicId: TopicId; name: string; originalContentHash: string; textContentHash: string;
    sourceKind: string; legalVerificationStatus: string; sourceRegistryJoin: string; textExtractionStatus: string;
  }[];
  topics: {
    topicId: TopicId;
    sourceDocumentId: string;
    scope: {
      status: ScopeStatus;
      selectionMethod: string;
      allArticlesAssumedInScope: boolean;
      finalObjectiveCount: number | null;
      scopeEvidence: { sourceId: string; contentHash: string; sourceLocator: string };
      articleRange?: [number, number];
      namedSections?: string[];
      sectionArticleRanges?: Record<string, [number, number]>;
      historicalScopeReview?: string;
    };
    legalInstrument: string;
    learningState: string;
  }[];
  subtopics: { id: string; topicId: TopicId; title: string; status: ObjectiveStatus }[];
  learningObjectives: LearningObjective[];
}

export const CURRICULUM_MAP = rawMap as unknown as CurriculumMap;
export const LEARNING_OBJECTIVES: readonly LearningObjective[] = CURRICULUM_MAP.learningObjectives;
export function getLearningObjectives(topicId: TopicId): readonly LearningObjective[] {
  return LEARNING_OBJECTIVES.filter(objective => objective.topicId === topicId);
}

/** Structural consistency, not proof of legal correctness or complete exam scope. */
export function curriculumMapIssues(map: CurriculumMap = CURRICULUM_MAP): string[] {
  const issues: string[] = [];
  const topicIds = new Set(TOPICS.map(t => t.id));
  const mappedIds = new Set(map.topics.map(t => t.topicId));
  if (map.topics.length !== 24 || mappedIds.size !== 24 || [...topicIds].some(id => !mappedIds.has(id))) issues.push('The canonical 24 topics must occur exactly once');
  if (new Set(map.learningObjectives.map(o => o.id)).size !== map.learningObjectives.length) issues.push('Duplicate objective identity');
  if (new Set(map.subtopics.map(s => s.id)).size !== map.subtopics.length) issues.push('Duplicate subtopic identity');
  const sources = new Map(map.sourceDocuments.map(s => [s.id, s]));
  const subtopics = new Map(map.subtopics.map(s => [s.id, s]));
  const objectives = new Set(map.learningObjectives.map(o => o.id));
  const sha256 = /^[a-f0-9]{64}$/i;
  for (const topic of map.topics) {
    if (topic.scope.allArticlesAssumedInScope) issues.push(`Blanket legal scope assumption: ${topic.topicId}`);
    if (!map.learningObjectives.some(o => o.topicId === topic.topicId)) issues.push(`Topic has no draft targets: ${topic.topicId}`);
    if (!sha256.test(topic.scope.scopeEvidence.contentHash) || !topic.scope.scopeEvidence.sourceLocator) issues.push(`Missing official scope evidence: ${topic.topicId}`);
    if (topic.topicId === 'O01' && JSON.stringify(topic.scope.articleRange) !== '[97,126]') issues.push('O01 article boundary changed');
    if (topic.topicId === 'O02' && JSON.stringify(topic.scope.articleRange) !== '[1,212]') issues.push('O02 article boundary changed');
  }
  for (const objective of map.learningObjectives) {
    const source = sources.get(objective.evidence.sourceDocumentId);
    const subtopic = subtopics.get(objective.subtopicId);
    if (!topicIds.has(objective.topicId) || !subtopic || subtopic.topicId !== objective.topicId) issues.push(`Unknown/mismatched topic or subtopic: ${objective.id}`);
    if (!source || source.topicId !== objective.topicId || source.originalContentHash !== objective.evidence.sourceContentHash
      || source.textContentHash !== objective.evidence.extractedTextHash
      || !sha256.test(objective.evidence.sourceContentHash) || !sha256.test(objective.evidence.extractedTextHash)) issues.push(`Source hash relationship missing: ${objective.id}`);
    if (!objective.objective.trim() || !objective.evidence.sourceExcerpt.trim()) issues.push(`Missing objective or observed evidence: ${objective.id}`);
    const locator = objective.evidence.locator;
    if (locator.kind === 'pdf-page' ? !Number.isInteger(locator.pageIndex) || locator.pageIndex! < 1
      : !Number.isInteger(locator.lineStart) || locator.lineStart! < 1 || !Number.isInteger(locator.lineEnd) || locator.lineEnd! < locator.lineStart!) issues.push(`Invalid source locator: ${objective.id}`);
    if (objective.topicId === 'O04') {
      if (objective.legalReference !== null || objective.legalInstrument !== null || !objective.historicalReference) issues.push(`Historical objective cannot invent a legal article: ${objective.id}`);
    } else {
      const article = objective.legalReference?.article;
      if (!Number.isInteger(article) || article! < 1 || !objective.legalInstrument) issues.push(`Missing legal article: ${objective.id}`);
      if (objective.topicId === 'O01' && (article! < 97 || article! > 126)) issues.push(`O01 outside article limit: ${objective.id}`);
      if (objective.topicId === 'O02' && (article! < 1 || article! > 212)) issues.push(`O02 outside article limit: ${objective.id}`);
      if (objective.topicId === 'O03') {
        const section = objective.legalReference?.section || '';
        const range = map.topics.find(t => t.topicId === 'O03')?.scope.sectionArticleRanges?.[section];
        if (!range || article! < range[0] || article! > range[1]) issues.push(`O03 outside named sections: ${objective.id}`);
      }
    }
    if (objective.prerequisiteObjectiveIds.some(id => !objectives.has(id) || id === objective.id)) issues.push(`Invalid prerequisite: ${objective.id}`);
    if (objective.status === 'Approved' && (objective.scopeStatus === 'Pending' || objective.evidence.verificationStatus !== 'Verified')) issues.push(`Draft evidence cannot approve an objective: ${objective.id}`);
  }
  if (map.catalogCompleteness === 'Partial' && map.finalExamObjectiveCount !== null) issues.push('Partial catalog cannot assert the final exam objective denominator');
  if (map.catalogCompleteness === 'Complete' && (!Number.isInteger(map.finalExamObjectiveCount) || map.finalExamObjectiveCount! < map.learningObjectives.length)) issues.push('Complete catalog needs a validated final denominator');
  return issues;
}

export interface ObjectiveMeasurement {
  independentQuestionCount: number;
  cognitiveTypes: readonly string[];
  answered: number;
  correct: number;
  delayedRetentionCorrect: boolean;
}
export interface CurriculumIndicatorInput {
  map?: CurriculumMap;
  publishedStudyQuestionIds: readonly string[];
  solvedQuestionIds: readonly string[];
  /** Caller must derive these from actually published Approved questions, never imported claims. */
  representedObjectiveIds: ReadonlySet<string>;
  measurements?: Readonly<Record<string, ObjectiveMeasurement>>;
}
/**
 * Provisional mastery threshold: 4 independent questions, 2 cognitive types, 80% correctness,
 * and delayed retention. This is a documented minimum, not a validated psychometric model.
 */
function assessable(measurement?: ObjectiveMeasurement): boolean {
  if (!measurement) return false;
  const m = measurement;
  return Number.isSafeInteger(m.independentQuestionCount) && m.independentQuestionCount >= 4
    && Number.isSafeInteger(m.answered) && m.answered >= m.independentQuestionCount
    && Number.isSafeInteger(m.correct) && m.correct >= 0 && m.correct <= m.answered
    && new Set(m.cognitiveTypes.filter(type => type.trim())).size >= 2;
}
export function sufficientMasteryEvidence(measurement?: ObjectiveMeasurement): boolean {
  return assessable(measurement) && measurement!.correct / measurement!.answered >= 0.8
    && measurement!.delayedRetentionCorrect === true;
}

/** Keep completion, curriculum coverage and measured mastery separate; unknown is never zero. */
export function curriculumIndicators(input: CurriculumIndicatorInput): {
  questionCompletion: number | null;
  curriculumCoverage: number | null;
  learningMastery: number | null;
  publishedUniqueQuestions: number;
  solvedPublishedUniqueQuestions: number;
  representedApprovedObjectives: number;
  masteredObjectives: number;
  measuredObjectives: number;
  assessableObjectives: number;
  finalExamObjectiveCount: number | null;
} {
  const map = input.map || CURRICULUM_MAP;
  const published = new Set(input.publishedStudyQuestionIds);
  const solved = new Set(input.solvedQuestionIds.filter(id => published.has(id)));
  const approved = map.learningObjectives.filter(o => o.status === 'Approved' && o.scopeStatus !== 'Pending' && o.evidence.verificationStatus === 'Verified');
  const represented = approved.filter(o => input.representedObjectiveIds.has(o.id));
  const mastered = represented.filter(o => sufficientMasteryEvidence(input.measurements?.[o.id]));
  const assessableObjectives = represented.filter(o => assessable(input.measurements?.[o.id]));
  const measured = represented.filter(o => (input.measurements?.[o.id]?.answered || 0) > 0);
  const denominator = map.catalogCompleteness === 'Complete' ? map.finalExamObjectiveCount : null;
  return {
    questionCompletion: published.size ? solved.size / published.size : null,
    curriculumCoverage: denominator && denominator >= represented.length ? represented.length / denominator : null,
    learningMastery: denominator && denominator >= mastered.length && assessableObjectives.length ? mastered.length / denominator : null,
    publishedUniqueQuestions: published.size,
    solvedPublishedUniqueQuestions: solved.size,
    representedApprovedObjectives: represented.length,
    masteredObjectives: mastered.length,
    measuredObjectives: measured.length,
    assessableObjectives: assessableObjectives.length,
    finalExamObjectiveCount: denominator,
  };
}
