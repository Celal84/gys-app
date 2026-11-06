import { TOPICS, type TopicId } from './curriculum';

export type VerificationStatus = 'Draft' | 'SourceMissing' | 'ValidationPending' | 'Approved' | 'Quarantined' | 'Rejected' | 'Outdated';
export type SourcePool = 'A' | 'B' | 'C';
export interface SourceSnapshot {
  id: string;
  sourceId: string;
  sourceUrl: string;
  contentHash: string;
  hashAlgorithm: 'sha256';
  version: string;
  readAt: string;
  verificationStatus: 'Verified' | 'Pending' | 'Failed';
  publishedAt?: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
  transitionNotes?: string;
  legalEdition: 'preparation' | 'exam';
}
export interface QuestionOption { id: string; text: string }
export interface VerificationEvidence {
  id: string;
  method: 'official-provision-comparison' | 'rule-check' | 'human-review' | 'ai-self-review';
  checkedBy: string;
  checkedAt: string;
  sourceSnapshotId: string;
  sourceContentHash: string;
  sourceLocator: string;
  correctOptionId: string;
  conclusion: 'pass' | 'fail' | 'pending';
  /** The source quotation or reproducible rule/review artifact, not a bare assertion. */
  evidence: string;
}
export interface Question {
  id: string;
  version: number;
  sourcePool: SourcePool;
  topicId: TopicId;
  learningObjectiveId: string;
  text: string;
  options: QuestionOption[];
  correctOptionId: string;
  explanation: string;
  legalProvisionId: string;
  sourceSnapshotId: string;
  sourceLocator: string;
  articleNumber?: number;
  /** Required until the topic's broader scope map is explicitly approved. */
  scopeMapping?: { status: 'Approved' | 'Pending'; evidenceLocator: string };
  difficulty: 'basic' | 'medium' | 'hard' | 'application';
  cognitiveType: string;
  scenarioFlag: boolean;
  verificationStatus: VerificationStatus;
  generatedBy: string;
  verificationEvidence: VerificationEvidence[];
  /** Pool A must belong to a specific protected exam before it can be published. */
  examId?: string;
  historicalDecision?: 'Accepted' | 'Excluded' | 'NeedsReview';
}

const sha256 = /^[a-f0-9]{64}$/i;
const nonblank = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const validDate = (value: unknown) => nonblank(value) && Number.isFinite(Date.parse(value));

/** Ingestion is untrusted. Passing structure is necessary, never proof of legal truth by itself. */
export function publicationIssues(question: Question, snapshot?: SourceSnapshot): string[] {
  const q = question;
  const issues: string[] = [];
  if (q.verificationStatus !== 'Approved') issues.push('Question is not Approved');
  const topic = TOPICS.find(t => t.id === q.topicId);
  if (!topic) issues.push('Unknown topic');
  if (!nonblank(q.id) || !Number.isInteger(q.version) || q.version < 1) issues.push('Invalid identity/version');
  if (![q.learningObjectiveId, q.text, q.explanation, q.legalProvisionId, q.sourceLocator, q.generatedBy].every(nonblank)) issues.push('Required content or traceability missing');
  if (!['A', 'B', 'C'].includes(q.sourcePool)) issues.push('Unknown source pool');
  if (!Array.isArray(q.options) || (q.sourcePool !== 'C' && q.options.length !== 5) || q.options.length < 2
    || q.options.some(o => !o || !nonblank(o.id) || !nonblank(o.text))
    || new Set(q.options.map(o => o.id)).size !== q.options.length
    || new Set(q.options.map(o => o.text.trim().toLocaleLowerCase('tr'))).size !== q.options.length
    || !q.options.some(o => o.id === q.correctOptionId)) issues.push('Invalid options or stable correct option ID');
  if (q.sourcePool === 'A' && !nonblank(q.examId)) issues.push('Protected exam identity missing');
  if (q.sourcePool === 'C' && q.historicalDecision !== 'Accepted') issues.push('Historical question not Accepted');
  if (topic?.scope.status === 'bounded') {
    const range = topic.scope.articles!;
    if (!Number.isInteger(q.articleNumber) || q.articleNumber! < range[0] || q.articleNumber! > range[1]) issues.push('Outside explicit article boundary');
  } else if (topic && (q.scopeMapping?.status !== 'Approved' || !nonblank(q.scopeMapping.evidenceLocator))) {
    issues.push('Scope mapping is not approved');
  }
  if (!snapshot || snapshot.id !== q.sourceSnapshotId || snapshot.verificationStatus !== 'Verified'
    || snapshot.hashAlgorithm !== 'sha256' || !sha256.test(snapshot.contentHash)
    || ![snapshot.sourceId, snapshot.sourceUrl, snapshot.version].every(nonblank) || !validDate(snapshot.readAt)) {
    issues.push('Verified immutable source snapshot missing');
  }
  const independentPass = Array.isArray(q.verificationEvidence) && q.verificationEvidence.some(e => e
    && ['official-provision-comparison', 'rule-check', 'human-review'].includes(e.method)
    && e.conclusion === 'pass' && nonblank(e.id) && nonblank(e.checkedBy) && e.checkedBy !== q.generatedBy
    && validDate(e.checkedAt) && nonblank(e.evidence) && e.sourceSnapshotId === q.sourceSnapshotId
    && e.sourceContentHash === snapshot?.contentHash && e.sourceLocator === q.sourceLocator
    && e.correctOptionId === q.correctOptionId);
  if (!independentPass) issues.push('Independent source-linked verification missing');
  return issues;
}

export function canPublishQuestion(question: Question, snapshot?: SourceSnapshot): boolean {
  return publicationIssues(question, snapshot).length === 0;
}

export type ContentMode = 'study' | 'flashcards' | 'review' | 'preview' | 'exam' | 'historical';
/** Pool A is never recycled into study banks; completed exams allow targeted review only. */
export function isAvailableFor(question: Question, mode: ContentMode, context: {
  snapshot?: SourceSnapshot; completedExamIds?: ReadonlySet<string>; examId?: string;
} = {}): boolean {
  if (!canPublishQuestion(question, context.snapshot)) return false;
  if (question.sourcePool === 'A') {
    if (mode === 'exam') return question.examId === context.examId;
    return mode === 'review' && !!question.examId && !!context.completedExamIds?.has(question.examId);
  }
  if (question.sourcePool === 'C') return mode === 'historical';
  return mode !== 'exam' && mode !== 'historical';
}

/** Validate a complete exam before starting; never silently truncate or fill with duplicates. */
export function validateExamQuestions(questions: readonly Question[], snapshots: readonly SourceSnapshot[]): string[] {
  const issues: string[] = [];
  if (questions.length !== 100) issues.push('Exam must have exactly 100 questions');
  if (new Set(questions.map(q => q.id)).size !== questions.length) issues.push('Duplicate question IDs');
  const normalized = questions.map(q => q.text.normalize('NFKC').toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim());
  if (new Set(normalized).size !== normalized.length) issues.push('Duplicate normalized question text');
  const examIds = new Set(questions.map(q => q.examId));
  if (examIds.size !== 1 || !questions[0]?.examId) issues.push('Questions must belong to one protected exam');
  const snapshotMap = new Map(snapshots.map(s => [s.id, s]));
  for (const question of questions) {
    if (question.sourcePool !== 'A' || !canPublishQuestion(question, snapshotMap.get(question.sourceSnapshotId))) issues.push(`Unpublishable exam question: ${question.id}`);
  }
  for (const topic of TOPICS) {
    if (questions.filter(q => q.topicId === topic.id).length !== topic.examWeight) issues.push(`Wrong distribution: ${topic.id}`);
  }
  return issues;
}
