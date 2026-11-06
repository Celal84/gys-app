/** Learning heuristics assist study; neither a rating nor a keyword match proves mastery. */
export const FLASHCARD_TYPES = ['duration', 'authority', 'exception', 'sanction', 'concept', 'definition', 'date', 'comparison'] as const;
export type FlashcardType = typeof FLASHCARD_TYPES[number];
export const ERROR_REASONS = {
  knowledge: 'Bilgi eksikliği', attention: 'Dikkatsizlik', time: 'Süre baskısı', distractor: 'Çeldiriciye düşme',
  misread: 'Soru kökünü yanlış okuma', authority: 'Yetki karışıklığı', number: 'Süre/sayı hatası',
  exception: 'İstisna hatası', outdated: 'Eski mevzuat bilgisi',
} as const;
export type ErrorReason = keyof typeof ERROR_REASONS;
export const SM2_BOOTSTRAP_DAYS = [1, 3, 7, 14, 30] as const;
export interface ReviewSchedule {
  repetitions: number;
  easeFactor: number;
  intervalDays: number;
  totalReviews: number;
  lapses: number;
  lastReviewedAt: string | null;
  dueAt: string;
}
export function isoDate(value: string | Date): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Geçersiz öğrenme tarihi.');
  return date.toISOString();
}
export function initialSchedule(now: string | Date = new Date()): ReviewSchedule {
  return { repetitions: 0, easeFactor: 2.5, intervalDays: 0, totalReviews: 0, lapses: 0, lastReviewedAt: null, dueAt: isoDate(now) };
}
export function validateSchedule(schedule: ReviewSchedule): void {
  if (!schedule || ![schedule.repetitions, schedule.intervalDays, schedule.totalReviews, schedule.lapses].every(n => Number.isSafeInteger(n) && n >= 0)
    || schedule.repetitions > schedule.totalReviews || schedule.lapses > schedule.totalReviews
    || !Number.isFinite(schedule.easeFactor) || schedule.easeFactor < 1.3 || schedule.easeFactor > 10
    || schedule.intervalDays > 36500 || isoDate(schedule.dueAt) !== schedule.dueAt
    || (schedule.lastReviewedAt !== null && isoDate(schedule.lastReviewedAt) !== schedule.lastReviewedAt)
    || (schedule.totalReviews === 0 && (schedule.lastReviewedAt !== null || schedule.repetitions !== 0 || schedule.intervalDays !== 0 || schedule.lapses !== 0))
    || (schedule.totalReviews > 0 && (schedule.lastReviewedAt === null || schedule.intervalDays < 1))) throw new Error('Geçersiz tekrar planı.');
}
/** Adapted SM-2: successful intervals 1/3/7/14/30, then previous interval × updated EF. */
export function reviewSm2(previous: ReviewSchedule, quality: number, reviewedAt: string | Date = new Date()): ReviewSchedule {
  validateSchedule(previous);
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) throw new Error('Kalite puanı 0–5 arasında tam sayı olmalıdır.');
  const at = isoDate(reviewedAt);
  if (previous.lastReviewedAt && at < previous.lastReviewedAt) throw new Error('Tekrar tarihi önceki değerlendirmeden eski olamaz.');
  const delta = 5 - quality;
  const easeFactor = Math.min(10, Math.max(1.3, Math.round((previous.easeFactor + 0.1 - delta * (0.08 + delta * 0.02)) * 10000) / 10000));
  const repetitions = quality < 3 ? 0 : previous.repetitions + 1;
  const intervalDays = quality < 3 ? 1 : (SM2_BOOTSTRAP_DAYS[repetitions - 1] ?? Math.min(36500, Math.max(1, Math.round(previous.intervalDays * easeFactor))));
  // Istanbul has UTC+03 year-round. Absolute 24h intervals also remain stable across device time zones.
  return { repetitions, easeFactor, intervalDays, totalReviews: previous.totalReviews + 1,
    lapses: previous.lapses + Number(quality < 3), lastReviewedAt: at,
    dueAt: new Date(Date.parse(at) + intervalDays * 86_400_000).toISOString() };
}

export interface ExplanationConcept {
  id: string;
  label: string;
  /** Every phrase is required. Use a reviewed short phrase, not a generated legal inference. */
  requiredTerms: string[];
  /** Explicit reviewed contradictory phrases; absence never establishes legal correctness. */
  contradictionTerms?: string[];
}
export interface SelfExplanationResult {
  status: 'assisted' | 'skipped' | 'disabled';
  matchedConceptIds: string[];
  missingConceptIds: string[];
  contradictionConceptIds: string[];
  conceptCoverage: number | null;
  notice: string;
}
const normalize = (text: string) => text.normalize('NFKC').toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const phrasePresent = (text: string, phrase: string) => !!normalize(phrase) && ` ${text} `.includes(` ${normalize(phrase)} `);
export function compareSelfExplanation(input: { text?: string; concepts: readonly ExplanationConcept[]; strictMode?: boolean; skipped?: boolean }): SelfExplanationResult {
  const result: SelfExplanationResult = { status: 'assisted', matchedConceptIds: [], missingConceptIds: [], contradictionConceptIds: [], conceptCoverage: null,
    notice: 'Anahtar kavram yardımıdır; hukuki doğrulama veya öğrenme kanıtı değildir. Kaynak hükümle karşılaştırın.' };
  if (input.strictMode) return { ...result, status: 'disabled', notice: 'Strict Mode sırasında öz-açıklama kapalıdır.' };
  if (input.skipped || !input.text?.trim()) return { ...result, status: 'skipped' };
  const text = normalize(input.text);
  const ids = new Set<string>();
  for (const concept of input.concepts) {
    if (!concept.id || ids.has(concept.id) || !concept.label?.trim() || !Array.isArray(concept.requiredTerms) || concept.requiredTerms.length === 0
      || concept.requiredTerms.some(term => typeof term !== 'string' || !normalize(term))) throw new Error('Geçersiz doğrulanmış kavram listesi.');
    ids.add(concept.id);
    const contradiction = concept.contradictionTerms?.some(term => phrasePresent(text, term)) ?? false;
    if (contradiction) result.contradictionConceptIds.push(concept.id);
    if (!contradiction && concept.requiredTerms.every(term => phrasePresent(text, term))) result.matchedConceptIds.push(concept.id);
    else result.missingConceptIds.push(concept.id);
  }
  result.conceptCoverage = input.concepts.length ? result.matchedConceptIds.length / input.concepts.length : null;
  return result;
}

export interface LearningError {
  id: string;
  questionId: string;
  questionVersion: number;
  topicId: string;
  occurredAt: string;
  userReason: ErrorReason | null;
  inferredReason: { reason: ErrorReason; confidence: number; method: string } | null;
  conceptId: string | null;
  relatedConceptId: string | null;
  confidence: number | null;
  /** Caller measured foreground response time only. Background and wall time are excluded. */
  activeTimeMs: number | null;
}
export interface ConceptRecommendation { conceptId: string; questionIds: string[]; relatedConceptIds: string[]; recommendation: string }
export function conceptRecommendations(errors: readonly LearningError[]): ConceptRecommendation[] {
  const groups = new Map<string, { questionIds: Set<string>; related: Set<string> }>();
  for (const error of errors) {
    if (!error.conceptId) continue;
    const group = groups.get(error.conceptId) ?? { questionIds: new Set<string>(), related: new Set<string>() };
    group.questionIds.add(error.questionId);
    if (error.relatedConceptId) group.related.add(error.relatedConceptId);
    groups.set(error.conceptId, group);
  }
  return [...groups].filter(([, group]) => group.questionIds.size >= 2).map(([conceptId, group]) => ({ conceptId,
    questionIds: [...group.questionIds].sort(), relatedConceptIds: [...group.related].sort(),
    recommendation: 'Bu kavram en az iki bağımsız soruda karıştı. İlgili hükümler için karşılaştırmalı çalışma önerilir; kesin kavram yanılgısı teşhisi değildir.' }));
}
