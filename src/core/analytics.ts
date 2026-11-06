import { EXAM_CONFIG, TOPICS, type TopicId } from './curriculum';

export type QuestionDifficulty = 'basic' | 'medium' | 'hard' | 'application';
/** Immutable answer-time metadata; firstSeen means never encountered, including in previews. */
export interface ForecastObservation {
  questionId: string;
  objectiveId: string;
  topicId: TopicId;
  attemptId: string;
  sourcePool: 'A' | 'B' | 'C';
  correct: boolean;
  firstSeen: boolean;
  completedAttempt: boolean;
  independentMock: boolean;
  answeredAt: string;
  difficulty: QuestionDifficulty;
  cognitiveType: string;
}
export interface TopicForecast {
  topicId: TopicId;
  weight: number;
  probability: number | null;
  interval: [number, number] | null;
  expectedLoss: number | null;
  sufficient: boolean;
  evidence: {
    uniqueQuestions: number; correct: number; objectives: number; difficultyTypes: number;
    cognitiveTypes: number; attempts: number; effectiveSampleSize: number; independentMockQuestions: number;
  };
  reasons: string[];
}
export interface ScoreForecast {
  method: 'gys-weighted-first-seen-v1';
  status: 'insufficient-data' | 'experimental';
  createdAt: string;
  score: number | null;
  interval: [number, number] | null;
  personalTarget: 85;
  targetGuaranteed: false;
  topics: TopicForecast[];
  evidence: {
    received: number; eligibleFirstSeen: number; repeatedExcluded: number; historicalExcluded: number;
    invalidExcluded: number; independentMockIds: string[]; measuredTopics: number; sufficientTopics: number;
  };
  reasons: string[];
  limitation: string;
}

const DAY_MS = 86_400_000;
const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const difficulties: readonly QuestionDifficulty[] = ['basic', 'medium', 'hard', 'application'];
/** Minimums are provisional quality gates, not psychometric validation. */
export const FORECAST_POLICY = Object.freeze({
  minimumQuestionsPerTopic: 12, minimumQuestionsPerWeight: 2,
  minimumObjectives: 3, minimumDifficultyTypes: 2, minimumCognitiveTypes: 2,
  minimumAttempts: 2, recencyHalfLifeDays: 60,
});

/** Wilson interval with Kish effective N; summed topic bounds retain shared-model uncertainty. */
function probabilityInterval(p: number, n: number): [number, number] {
  const z2 = 1.96 ** 2;
  const denominator = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denominator;
  const half = 1.96 * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / denominator;
  return [clamp(centre - half), clamp(centre + half)];
}

export function buildForecast(input: { observations: readonly ForecastObservation[]; now?: Date }): ScoreForecast {
  const now = input.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error('Geçerli tahmin tarihi gerekli.');
  const topicIds = new Set(TOPICS.map(topic => topic.id));
  const observations = input.observations.filter(o => o && topicIds.has(o.topicId)
    && typeof o.questionId === 'string' && o.questionId.trim() && typeof o.objectiveId === 'string' && o.objectiveId.trim()
    && typeof o.attemptId === 'string' && o.attemptId.trim() && typeof o.cognitiveType === 'string' && o.cognitiveType.trim()
    && typeof o.correct === 'boolean' && typeof o.firstSeen === 'boolean' && typeof o.completedAttempt === 'boolean'
    && typeof o.independentMock === 'boolean' && ['A', 'B', 'C'].includes(o.sourcePool) && difficulties.includes(o.difficulty)
    && Number.isFinite(Date.parse(o.answeredAt)) && Date.parse(o.answeredAt) <= now.getTime())
    .sort((a, b) => Date.parse(a.answeredAt) - Date.parse(b.answeredAt) || a.questionId.localeCompare(b.questionId));
  let invalidExcluded = input.observations.length - observations.length;
  let repeatedExcluded = 0;
  let historicalExcluded = 0;
  const seen = new Set<string>();
  const first: ForecastObservation[] = [];
  for (const observation of observations) {
    const repeated = seen.has(observation.questionId) || !observation.firstSeen;
    seen.add(observation.questionId);
    if (repeated) { repeatedExcluded++; continue; }
    if (observation.sourcePool === 'C') { historicalExcluded++; continue; }
    if (!observation.completedAttempt) { invalidExcluded++; continue; }
    first.push(observation);
  }
  const mockIds = [...new Set(first.filter(o => o.sourcePool === 'A').map(o => o.attemptId))].filter(id => {
    const rows = first.filter(o => o.attemptId === id);
    return rows.length === 100 && rows.every(o => o.sourcePool === 'A' && o.independentMock)
      && TOPICS.every(topic => rows.filter(o => o.topicId === topic.id).length === topic.examWeight);
  });
  const validMocks = new Set(mockIds);
  const eligible = first.filter(o => o.sourcePool === 'B' || validMocks.has(o.attemptId));
  invalidExcluded += first.length - eligible.length;
  const topics = TOPICS.map((topic): TopicForecast => {
    const rows = eligible.filter(o => o.topicId === topic.id);
    const objectiveCounts = new Map<string, number>();
    const difficultyCounts = new Map<QuestionDifficulty, number>();
    rows.forEach(o => {
      objectiveCounts.set(o.objectiveId, (objectiveCounts.get(o.objectiveId) ?? 0) + 1);
      difficultyCounts.set(o.difficulty, (difficultyCounts.get(o.difficulty) ?? 0) + 1);
    });
    const attempts = new Set(rows.map(o => o.attemptId)).size;
    const cognition = new Set(rows.map(o => o.cognitiveType)).size;
    const reasons: string[] = [];
    const minimum = Math.max(FORECAST_POLICY.minimumQuestionsPerTopic, topic.examWeight * FORECAST_POLICY.minimumQuestionsPerWeight);
    if (rows.length < minimum) reasons.push(`${minimum} bağımsız ilk karşılaşma gerekli; ${rows.length} var.`);
    if (objectiveCounts.size < FORECAST_POLICY.minimumObjectives) reasons.push('En az üç farklı öğrenme hedefi ölçülmeli.');
    if (difficultyCounts.size < FORECAST_POLICY.minimumDifficultyTypes) reasons.push('En az iki zorluk düzeyi ölçülmeli.');
    if (cognition < FORECAST_POLICY.minimumCognitiveTypes) reasons.push('En az iki bilişsel işlem türü ölçülmeli.');
    if (attempts < FORECAST_POLICY.minimumAttempts) reasons.push('En az iki tamamlanmış bağımsız çalışma veya deneme gerekli.');
    if (!rows.length) return {
      topicId: topic.id, weight: topic.examWeight, probability: null, interval: null, expectedLoss: null, sufficient: false,
      evidence: { uniqueQuestions: 0, correct: 0, objectives: 0, difficultyTypes: 0, cognitiveTypes: 0, attempts: 0, effectiveSampleSize: 0, independentMockQuestions: 0 }, reasons,
    };
    // Easy/repeated-objective oversampling has less influence. All difficulty categories remain observable;
    // this is not an assumption about an official exam difficulty distribution.
    const weights = rows.map(o => {
      const recency = Math.max(0.1, 2 ** (-(now.getTime() - Date.parse(o.answeredAt)) / DAY_MS / FORECAST_POLICY.recencyHalfLifeDays));
      const objectiveBalance = 1 / Math.sqrt(objectiveCounts.get(o.objectiveId)!);
      const difficultyBalance = 1 / Math.sqrt(difficultyCounts.get(o.difficulty)!);
      return recency * objectiveBalance * difficultyBalance * (o.sourcePool === 'A' ? 1 : 0.65);
    });
    const total = weights.reduce((sum, value) => sum + value, 0);
    // Scale preserves source/recency reliability instead of cancelling it in Kish N.
    const reliability = weights.reduce((sum, value, index) => sum + value * (rows[index].sourcePool === 'A' ? 1 : 0.65)
      * Math.max(0.1, 2 ** (-(now.getTime() - Date.parse(rows[index].answeredAt)) / DAY_MS / FORECAST_POLICY.recencyHalfLifeDays)), 0) / total;
    const effectiveSampleSize = Math.min(rows.length, total ** 2 / weights.reduce((sum, value) => sum + value ** 2, 0)) * reliability;
    const weightedCorrect = weights.reduce((sum, value, index) => sum + (rows[index].correct ? value : 0), 0) / total;
    const probability = (weightedCorrect * effectiveSampleSize + 1) / (effectiveSampleSize + 2);
    const interval = probabilityInterval(probability, effectiveSampleSize);
    const sufficient = reasons.length === 0 && effectiveSampleSize >= minimum / 2;
    if (!sufficient && !reasons.length) reasons.push('Ölçümler eski veya dengesiz; etkin örneklem yetersiz.');
    return {
      topicId: topic.id, weight: topic.examWeight, probability, interval,
      expectedLoss: sufficient ? topic.examWeight * (1 - probability) : null, sufficient,
      evidence: { uniqueQuestions: rows.length, correct: rows.filter(o => o.correct).length, objectives: objectiveCounts.size,
        difficultyTypes: difficultyCounts.size, cognitiveTypes: cognition, attempts,
        effectiveSampleSize, independentMockQuestions: rows.filter(o => o.sourcePool === 'A').length }, reasons,
    };
  });
  const sufficient = topics.every(topic => topic.sufficient);
  return {
    method: 'gys-weighted-first-seen-v1', status: sufficient ? 'experimental' : 'insufficient-data', createdAt: now.toISOString(),
    score: sufficient ? topics.reduce((sum, topic) => sum + topic.weight * topic.probability!, 0) : null,
    interval: sufficient ? [topics.reduce((sum, topic) => sum + topic.weight * topic.interval![0], 0),
      topics.reduce((sum, topic) => sum + topic.weight * topic.interval![1], 0)] : null,
    personalTarget: EXAM_CONFIG.personalTarget, targetGuaranteed: false, topics,
    evidence: { received: input.observations.length, eligibleFirstSeen: eligible.length, repeatedExcluded, historicalExcluded,
      invalidExcluded, independentMockIds: mockIds.sort(), measuredTopics: topics.filter(t => t.evidence.uniqueQuestions).length,
      sufficientTopics: topics.filter(t => t.sufficient).length },
    reasons: sufficient ? [] : [`24 konunun ${topics.filter(t => !t.sufficient).length} tanesinde yeterli bağımsız ölçüm yok; sınav puanı hesaplanmadı.`],
    limitation: 'Deneysel tahmin; sonuç veya 85+ garantisi değildir. Aralık, ağırlıklı etkin örnekleme dayalı yaklaşık belirsizlik aralığıdır; resmî sınava göre kalibre edilmiş güven düzeyi değildir. Kapsam ve öğrenme hâkimiyeti ayrı göstergelerdir.',
  };
}

export interface SavedForecast {
  id: string; createdAt: string; score: number; independentMockIds: readonly string[];
}
export interface IndependentMockOutcome {
  attemptId: string; startedAt: string; finishedAt: string; score: number;
  firstAttempt: boolean; independent: boolean; totalQuestions: number; validDistribution: boolean;
}
/** Compare only to the next unseen, subsequently started, complete independent 100-question mock. */
export function calibrateForecasts(forecasts: readonly SavedForecast[], outcomes: readonly IndependentMockOutcome[]) {
  const valid = outcomes.filter(o => o.firstAttempt && o.independent && o.totalQuestions === 100 && o.validDistribution
    && Number.isFinite(o.score) && o.score >= 0 && o.score <= 100 && Number.isFinite(Date.parse(o.startedAt))
    && Number.isFinite(Date.parse(o.finishedAt)) && Date.parse(o.finishedAt) >= Date.parse(o.startedAt))
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  const comparisons = forecasts.flatMap(forecast => {
    if (!forecast.id || !Number.isFinite(forecast.score) || forecast.score < 0 || forecast.score > 100 || !Number.isFinite(Date.parse(forecast.createdAt))) return [];
    const outcome = valid.find(o => Date.parse(o.startedAt) > Date.parse(forecast.createdAt) && !forecast.independentMockIds.includes(o.attemptId));
    return outcome ? [{ forecastId: forecast.id, attemptId: outcome.attemptId, predicted: forecast.score, observed: outcome.score,
      absoluteError: Math.abs(forecast.score - outcome.score), signedError: forecast.score - outcome.score }] : [];
  });
  // Many forecasts before the same exam do not create independent validation samples.
  const grouped = [...new Set(comparisons.map(c => c.attemptId))].map(id => comparisons.filter(c => c.attemptId === id));
  return { comparisons, independentValidationCount: grouped.length,
    meanAbsoluteError: grouped.length ? grouped.reduce((sum, group) => sum + group.reduce((s, c) => s + c.absoluteError, 0) / group.length, 0) / grouped.length : null,
    status: grouped.length >= 5 ? 'measured' as const : 'insufficient-validation' as const };
}
