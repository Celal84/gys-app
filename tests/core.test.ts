import verification from '../data/official-verification.json';
import { describe, expect, it } from 'vitest';
import { EXAM_CONFIG, TOPICS, daysUntilExam } from '../src/core/curriculum';
import { canPublishQuestion, isAvailableFor, publicationIssues, validateExamQuestions, type Question, type SourceSnapshot } from '../src/core/content';
import { crawlSources, DRIVE_ROOTS, EXCLUDED_DRIVE_FOLDER_ID, type DriveEntry } from '../src/core/drive-policy';

const hash = 'a'.repeat(64);
const snapshot: SourceSnapshot = {
  id: 's1', sourceId: 'official-657', sourceUrl: 'https://www.mevzuat.gov.tr/example',
  contentHash: hash, hashAlgorithm: 'sha256', version: 'preparation-1', readAt: '2026-11-06T10:00:00Z',
  verificationStatus: 'Verified', legalEdition: 'preparation',
};
function question(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1', version: 1, sourcePool: 'B', topicId: 'O02', learningObjectiveId: 'o02-54',
    text: 'Kaynakla eşleştirilen soru kökü?', options: ['one', 'two', 'three', 'four', 'five'].map(id => ({ id, text: id })),
    correctOptionId: 'two', explanation: 'Kaynak hüküm açıklaması', legalProvisionId: '657-54',
    sourceSnapshotId: 's1', sourceLocator: 'Madde 54', articleNumber: 54,
    difficulty: 'basic', cognitiveType: 'recall', scenarioFlag: false,
    verificationStatus: 'Approved', generatedBy: 'generator-1', verificationEvidence: [{
      id: 'check-1', method: 'official-provision-comparison', checkedBy: 'independent-reviewer',
      checkedAt: '2026-11-06T10:10:00Z', sourceSnapshotId: 's1', sourceContentHash: hash,
      sourceLocator: 'Madde 54', correctOptionId: 'two', conclusion: 'pass',
      evidence: 'Saklanan resmî hüküm ve aday seçeneklerinin bağımsız eşleştirme kaydı.',
    }], ...overrides,
  };
}

describe('fixed curriculum and dates', () => {
  it('keeps runtime parameters in sync with the recorded official announcement', () => {
    const rules = verification.rules;
    expect(EXAM_CONFIG.examDate).toBe(rules.examDate);
    expect(EXAM_CONFIG.durationMinutes).toBe(rules.durationMinutes);
    expect(EXAM_CONFIG.questionCount).toBe(rules.questions);
    expect(EXAM_CONFIG.commonQuestions).toBe(rules.commonQuestions);
    expect(EXAM_CONFIG.technicalQuestions).toBe(rules.technicalQuestions);
    expect(EXAM_CONFIG.optionCount).toBe(rules.optionsPerQuestion);
    expect(EXAM_CONFIG.passingScore).toBe(rules.writtenPassScore);
    expect(EXAM_CONFIG.legalCutoffDate).toBe(rules.legalCutoffDate);
    expect(EXAM_CONFIG.wrongAnswerPenalty).toBe(rules.negativeMarking ? -1 : 0);
    expect(TOPICS.filter(t => t.group === 'common').map(t => t.examWeight)).toEqual(verification.curriculum.commonWeights);
    expect(TOPICS.filter(t => t.group === 'technical').map(t => t.examWeight)).toEqual(verification.curriculum.technicalWeights);
  });
  it('matches all 24 official weights and 5400 original quota', () => {
    expect(TOPICS.map(t => t.id)).toEqual([
      ...Array.from({ length: 16 }, (_, i) => `O${String(i + 1).padStart(2, '0')}`),
      ...Array.from({ length: 8 }, (_, i) => `T${String(i + 1).padStart(2, '0')}`),
    ]);
    expect(TOPICS.filter(t => t.group === 'common')).toHaveLength(16);
    expect(TOPICS.filter(t => t.group === 'technical')).toHaveLength(8);
    expect(TOPICS.filter(t => t.group === 'common').reduce((n, t) => n + t.examWeight, 0)).toBe(70);
    expect(TOPICS.filter(t => t.group === 'technical').reduce((n, t) => n + t.examWeight, 0)).toBe(30);
    expect(TOPICS.reduce((n, t) => n + t.mockQuestionQuota + t.bankQuestionQuota, 0)).toBe(5400);
    expect(TOPICS.slice(2).every(t => t.scope.status === 'mapping-pending')).toBe(true);
    expect(EXAM_CONFIG.legalEditionStatus).toBe('preparation');
  });
  it('uses the Istanbul calendar day at midnight, not the UTC date', () => {
    expect(daysUntilExam(new Date('2027-02-26T20:59:59Z'))).toBe(1);
    expect(daysUntilExam(new Date('2027-02-26T21:00:00Z'))).toBe(0);
    expect(daysUntilExam(new Date('2027-02-27T21:00:00Z'))).toBe(-1);
  });
});

describe('publication boundary', () => {
  it('requires approved content and matching independent source evidence', () => {
    expect(canPublishQuestion(question(), snapshot)).toBe(true);
    for (const verificationStatus of ['Draft', 'SourceMissing', 'ValidationPending', 'Quarantined', 'Rejected', 'Outdated'] as const) {
      expect(canPublishQuestion(question({ verificationStatus }), snapshot)).toBe(false);
    }
    expect(canPublishQuestion(question(), undefined)).toBe(false);
    expect(canPublishQuestion(question(), { ...snapshot, contentHash: 'b'.repeat(64) })).toBe(false);
    expect(canPublishQuestion(question(), { ...snapshot, verificationStatus: 'Pending' })).toBe(false);
    expect(canPublishQuestion(question({ verificationEvidence: [] }), snapshot)).toBe(false);
    const original = question();
    expect(canPublishQuestion(question({ verificationEvidence: original.verificationEvidence.map(e => ({ ...e, method: 'ai-self-review' })) }), snapshot)).toBe(false);
    expect(canPublishQuestion(question({ verificationEvidence: original.verificationEvidence.map(e => ({ ...e, checkedBy: original.generatedBy })) }), snapshot)).toBe(false);
    expect(canPublishQuestion(question({ correctOptionId: 'one' }), snapshot)).toBe(false);
  });
  it('binds answers to permanent option IDs across option reordering', () => {
    const q = question();
    q.options.reverse();
    expect(canPublishQuestion(q, snapshot)).toBe(true);
    expect(q.options.find(o => o.id === q.correctOptionId)?.text).toBe('two');
    q.options[0].id = q.options[1].id;
    expect(canPublishQuestion(q, snapshot)).toBe(false);
  });
  it('enforces explicit article limits and refuses unmapped broader scopes', () => {
    expect(publicationIssues(question({ articleNumber: 213 }), snapshot)).toContain('Outside explicit article boundary');
    expect(canPublishQuestion(question({ topicId: 'O01', articleNumber: 96 }), snapshot)).toBe(false);
    expect(canPublishQuestion(question({ topicId: 'O01', articleNumber: 126 }), snapshot)).toBe(true);
    expect(canPublishQuestion(question({ topicId: 'O03' }), snapshot)).toBe(false);
    expect(canPublishQuestion(question({ topicId: 'O03', scopeMapping: { status: 'Approved', evidenceLocator: 'scope-audit-1' } }), snapshot)).toBe(true);
  });
  it('prevents unresolved protected exams leaking into learning paths', () => {
    const q = question({ sourcePool: 'A', examId: 'exam-1' });
    for (const mode of ['study', 'flashcards', 'preview', 'review'] as const) {
      expect(isAvailableFor(q, mode, { snapshot })).toBe(false);
    }
    expect(isAvailableFor(q, 'exam', { snapshot, examId: 'exam-1' })).toBe(true);
    expect(isAvailableFor(q, 'exam', { snapshot, examId: 'exam-2' })).toBe(false);
    expect(isAvailableFor(q, 'review', { snapshot, completedExamIds: new Set(['exam-1']) })).toBe(true);
    expect(isAvailableFor(q, 'study', { snapshot, completedExamIds: new Set(['exam-1']) })).toBe(false);
    expect(isAvailableFor(question({ sourcePool: 'A' }), 'exam', { snapshot })).toBe(false);
  });
  it('preserves original historical option counts and separates historical use', () => {
    const q = question({ sourcePool: 'C', historicalDecision: 'Accepted', options: question().options.slice(0, 4) });
    expect(canPublishQuestion(q, snapshot)).toBe(true);
    expect(isAvailableFor(q, 'study', { snapshot })).toBe(false);
    expect(isAvailableFor(q, 'historical', { snapshot })).toBe(true);
    expect(canPublishQuestion({ ...q, historicalDecision: 'NeedsReview' }, snapshot)).toBe(false);
  });
});

describe('exact exam admission', () => {
  function exam(): Question[] {
    return TOPICS.flatMap(t => Array.from({ length: t.examWeight }, (_, i) => question({
      id: `${t.id}-${i}`, text: `${t.id} benzersiz soru ${i}`, topicId: t.id,
      sourcePool: 'A', examId: 'exam-1', articleNumber: t.id === 'O01' ? 97 : 54,
      scopeMapping: { status: 'Approved', evidenceLocator: 'scope-audit-1' },
    })));
  }
  it('admits 100 questions with all per-topic weights, rejects short/duplicate/wrong distributions', () => {
    expect(validateExamQuestions(exam(), [snapshot])).toEqual([]);
    expect(validateExamQuestions(exam().slice(0, 25), [snapshot])).toContain('Exam must have exactly 100 questions');
    const wrong = exam();
    wrong[0] = { ...wrong[0], topicId: 'T01' };
    expect(validateExamQuestions(wrong, [snapshot])).toContain('Wrong distribution: O01');
    const duplicate = exam();
    duplicate[1] = duplicate[0];
    expect(validateExamQuestions(duplicate, [snapshot])).toContain('Duplicate question IDs');
    const unverified = exam();
    unverified[1].verificationStatus = 'ValidationPending';
    expect(validateExamQuestions(unverified, [snapshot])).toContain(`Unpublishable exam question: ${unverified[1].id}`);
  });
});

describe('Drive exclusion before reads', () => {
  const entry = (id: string, kind: DriveEntry['kind'] = 'file', parent: string = DRIVE_ROOTS.notes): DriveEntry => ({ id, name: id, kind, parentIds: [parent] });
  it('never opens excluded branch or aliases; a similar filename remains included', async () => {
    const calls: string[] = [];
    const result = await crawlSources({ listChildren: async (id) => {
      calls.push(id);
      return { entries: [
        entry(EXCLUDED_DRIVE_FOLDER_ID, 'folder'),
        { ...entry('alias', 'shortcut'), shortcutTargetId: EXCLUDED_DRIVE_FOLDER_ID },
        { ...entry('untrusted', 'shortcut'), shortcutTargetId: 'unknown-target' },
        { ...entry('safe-file'), name: 'İlerleme notları.pdf' },
        { ...entry('blocked-child'), parentIds: [EXCLUDED_DRIVE_FOLDER_ID] },
      ] };
    } }, { roots: [DRIVE_ROOTS.notes] });
    expect(calls).toEqual([DRIVE_ROOTS.notes]);
    expect(result.files.map(f => f.id)).toEqual(['safe-file']);
    expect(result.skipped.some(s => s.id === EXCLUDED_DRIVE_FOLDER_ID)).toBe(true);
  });
  it('rejects forbidden roots before provider invocation', async () => {
    let calls = 0;
    const provider = { listChildren: async () => { calls++; return { entries: [] }; } };
    await expect(crawlSources(provider, { roots: [EXCLUDED_DRIVE_FOLDER_ID] })).rejects.toThrow('not permitted');
    await expect(crawlSources(provider, { roots: ['arbitrary-folder'] })).rejects.toThrow('not permitted');
    expect(calls).toBe(0);
  });
  it('walks only verified parent paths, handles pagination, and deduplicates files', async () => {
    const calls: [string, string | undefined][] = [];
    const result = await crawlSources({ listChildren: async (id, token) => {
      calls.push([id, token]);
      if (id === DRIVE_ROOTS.notes) return token
        ? { entries: [entry('f1') ] }
        : { entries: [entry('child', 'folder'), entry('f1')], nextPageToken: 'p2' };
      return { entries: [entry('f2', 'file', 'child'), entry('unsafe-folder', 'folder', 'different-parent')] };
    } }, { roots: [DRIVE_ROOTS.notes] });
    expect(calls).toEqual([[DRIVE_ROOTS.notes, undefined], ['child', undefined], [DRIVE_ROOTS.notes, 'p2']]);
    expect(result.files.map(f => f.id).sort()).toEqual(['f1', 'f2']);
    expect(result.skipped).toContainEqual({ id: 'unsafe-folder', reason: 'unverified-parent' });
  });
});
