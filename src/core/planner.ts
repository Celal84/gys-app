import { EXAM_CONFIG, TOPICS, daysUntilExam, type TopicId } from './curriculum';
import type { LearningObjective } from './curriculum-map';

export interface WeeklyCapacity {
  monday: number; tuesday: number; wednesday: number; thursday: number; friday: number; saturday: number; sunday: number;
}
export const DEFAULT_WEEKLY_CAPACITY: Readonly<WeeklyCapacity> = Object.freeze({
  monday: 60, tuesday: 60, wednesday: 60, thursday: 60, friday: 60, saturday: 90, sunday: 90,
});
const weekdayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
export interface PlannerQuestion {
  id: string; topicId: TopicId; learningObjectiveId: string; legalProvisionId: string;
  sourcePool: 'A' | 'B' | 'C'; verificationStatus: string;
}
export interface PlannerTopicSignal {
  topicId: TopicId;
  /** Unknown is null; an unmeasured topic is never assigned zero accuracy. */
  probability: number | null;
  reliability: number;
  scopeCoverage: number | null;
  lastReviewedAt: string | null;
  estimatedLearningMinutes?: number;
}
export interface CompletedPlanSession { date: string; minutes: number; taskId?: string }
export interface PlanTask {
  id: string; kind: 'learn' | 'review' | 'practice' | 'mock'; title: string; reason: string;
  minutes: number; questionCount: number; questionIds: string[]; topicId: TopicId | null;
  objectiveId: string | null; objectiveIds: string[]; legalProvisionId: string | null; legalProvisionIds: string[]; sourceDocumentId: string | null;
  sourceLocator: string; sourceStatus: 'verified' | 'pending' | 'not-applicable';
  status: 'pending' | 'completed';
}
export interface PlanDay {
  date: string; weekday: keyof WeeklyCapacity; capacityMinutes: number; plannedMinutes: number;
  completedMinutes: number; status: 'scheduled' | 'partial' | 'completed' | 'missed' | 'unplanned'; tasks: PlanTask[];
}
export interface StudyPlan {
  createdAt: string; today: string; daysToExam: number; weeklyCapacityMinutes: number;
  days: PlanDay[]; notes: string[];
  priorities: { topicId: TopicId; score: number; probability: number | null; expectedLoss: number | null; reason: string }[];
}

export function istanbulDate(now: Date): string {
  if (!Number.isFinite(now.getTime())) throw new Error('Geçerli tarih gerekli.');
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: EXAM_CONFIG.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type)!.value).join('-');
}
function isDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validateWeeklyCapacity(value: WeeklyCapacity): void {
  if (!value || weekdayKeys.some(key => !Number.isInteger(value[key]) || value[key] < 0 || value[key] > 720)) {
    throw new Error('Günlük kapasite 0–720 arasında tam dakika olmalı.');
  }
}
function sourceLocator(objective: LearningObjective) {
  const ref = objective.legalReference;
  if (ref) return `${objective.legalInstrument ?? ''} m.${ref.article}${ref.paragraph ? `/${ref.paragraph}` : ''}${ref.clause ? ` (${ref.clause})` : ''}`.trim();
  const history = objective.historicalReference;
  return history ? `${history.period}; ${history.event}${history.date ? `; ${history.date}` : ''}` : objective.evidence.observedHeading ?? objective.subtopic;
}
const ratio = (value: number | null | undefined, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;

export function buildStudyPlan(input: {
  now?: Date; startDate?: string; capacities?: WeeklyCapacity;
  objectives: readonly LearningObjective[]; availableQuestions: readonly PlannerQuestion[];
  topicSignals?: readonly PlannerTopicSignal[]; completedSessions?: readonly CompletedPlanSession[];
  solvedQuestionIds?: ReadonlySet<string>; scheduleMock?: boolean;
  /** Availability must come from an already validated 100-question protected exam, never a raw count. */
  mockAvailable?: { examId: string; questionIds: readonly string[]; validated: boolean };
}): StudyPlan {
  const now = input.now ?? new Date();
  const today = istanbulDate(now);
  const start = input.startDate ?? today;
  if (!isDate(start)) throw new Error('Plan başlangıç tarihi geçersiz.');
  const capacity = { ...(input.capacities ?? DEFAULT_WEEKLY_CAPACITY) };
  validateWeeklyCapacity(capacity);
  const notes: string[] = [];
  const mock = input.mockAvailable;
  const usableMock = !!mock?.validated && !!mock.examId && mock.questionIds.length === 100 && new Set(mock.questionIds).size === 100;
  let mockWeekday: keyof WeeklyCapacity | null = null;
  if (input.scheduleMock && usableMock) {
    mockWeekday = weekdayKeys.find(key => capacity[key] >= 150) ?? null;
    if (!mockWeekday && capacity.saturday + capacity.sunday >= 150) {
      const weekend = capacity.saturday + capacity.sunday;
      capacity.saturday = 150;
      capacity.sunday = weekend - 150;
      mockWeekday = 'saturday';
      notes.push(`150 dakikalık kesintisiz deneme için hafta sonu ${capacity.saturday}+${capacity.sunday} dakika ayrıldı; haftalık toplam korunur.`);
    }
    if (!mockWeekday) notes.push('150 dakikalık kesintisiz kapasite yok; tam deneme parçalara bölünmedi.');
  } else if (input.scheduleMock) notes.push('Doğrulanmış 100 soruluk korunan deneme hazır değil; deneme görevi oluşturulmadı.');
  const signals = new Map((input.topicSignals ?? []).map(signal => [signal.topicId, signal]));
  const daysLeft = daysUntilExam(now);
  const urgency = daysLeft <= 0 ? 0 : 1 + Math.min(1, 30 / daysLeft);
  const priorities = TOPICS.map(topic => {
    const signal = signals.get(topic.id);
    const probability = signal?.probability == null ? null : ratio(signal.probability, 0.5);
    const reliability = ratio(signal?.reliability, 0);
    const coverage = signal?.scopeCoverage == null ? null : ratio(signal.scopeCoverage, 0);
    const elapsed = signal?.lastReviewedAt && Number.isFinite(Date.parse(signal.lastReviewedAt))
      ? Math.max(0, (now.getTime() - Date.parse(signal.lastReviewedAt)) / 86_400_000) : null;
    const forgetting = elapsed === null ? 0.5 : Math.min(1, elapsed / 30);
    const gap = probability === null ? 0.5 : 1 - probability;
    const scopeGap = coverage === null ? 0.5 : 1 - coverage;
    const minutes = Math.max(10, signal?.estimatedLearningMinutes && Number.isFinite(signal.estimatedLearningMinutes) ? signal.estimatedLearningMinutes : 30);
    const score = topic.examWeight * (0.45 * gap + 0.2 * forgetting + 0.2 * scopeGap + 0.15 * (1 - reliability)) * urgency / minutes;
    const reason = `${topic.examWeight}/100 sınav ağırlığı; ${probability === null ? 'başarı ölçülmedi' : `%${Math.round(probability * 100)} tahmini doğruluk`}; ${coverage === null ? 'kapsam paydası bekliyor' : `%${Math.round(coverage * 100)} onaylı kapsam`}; ${elapsed === null ? 'tekrar kaydı yok' : `${Math.floor(elapsed)} gündür tekrar yok`}; ölçüm güveni %${Math.round(reliability * 100)}.`;
    return { topicId: topic.id, score, probability, expectedLoss: probability === null ? null : topic.examWeight * (1 - probability), reason };
  }).sort((a, b) => b.score - a.score || a.topicId.localeCompare(b.topicId));
  const knownTopics = new Set(TOPICS.map(topic => topic.id));
  const objectives = input.objectives.filter(o => knownTopics.has(o.topicId) && o.id && o.evidence?.sourceDocumentId
    && o.evidence.sourceExcerpt?.trim() && o.status !== 'Outdated' && o.status !== 'Quarantined');
  const objectiveById = new Map(objectives.map(objective => [objective.id, objective]));
  const questions = input.availableQuestions.filter(q => q.sourcePool === 'B' && q.verificationStatus === 'Approved'
    && objectiveById.get(q.learningObjectiveId)?.topicId === q.topicId && q.id && q.legalProvisionId);
  const uniqueQuestions = [...new Map(questions.map(q => [q.id, q])).values()];
  const orderedObjectives = priorities.flatMap(priority => objectives.filter(o => o.topicId === priority.topicId)
    .sort((a, b) => Number(b.status === 'Approved') - Number(a.status === 'Approved') || a.id.localeCompare(b.id)));
  let learningCursor = 0;
  let practiceCursor = 0;
  const practiceObjectives = orderedObjectives.filter(o => uniqueQuestions.some(q => q.topicId === o.topicId));
  const taskFor = (kind: 'learn' | 'review' | 'practice', minutes: number, date: string, index: number): PlanTask | null => {
    const candidates = kind === 'practice' ? practiceObjectives : orderedObjectives;
    if (!candidates.length) return null;
    const cursor = kind === 'practice' ? practiceCursor++ : learningCursor++;
    const objective = candidates[cursor % candidates.length];
    const topic = TOPICS.find(t => t.id === objective.topicId)!;
    const matching = uniqueQuestions.filter(q => kind === 'practice' ? q.topicId === objective.topicId : q.learningObjectiveId === objective.id)
      .sort((a, b) => Number(input.solvedQuestionIds?.has(a.id) ?? false) - Number(input.solvedQuestionIds?.has(b.id) ?? false) || a.id.localeCompare(b.id));
    // Each task is an actual available package; never promise 20 questions when only 18 exist.
    const limit = Math.min(matching.length, Math.floor(minutes / 1.5));
    const questionCount = kind === 'practice' ? [100, 50, 25, 20, 10, 5].find(size => size <= limit) ?? 0 : 0;
    if (kind === 'practice' && !questionCount) return taskFor('learn', minutes, date, index);
    const selectedQuestions = kind === 'practice' ? matching.slice(0, questionCount) : [];
    const selectedObjectives = kind === 'practice' ? [...new Set(selectedQuestions.map(q => q.learningObjectiveId))].map(id => objectiveById.get(id)!) : [objective];
    const primary = selectedObjectives[0];
    const verified = selectedObjectives.every(o => o.status === 'Approved' && o.evidence.verificationStatus === 'Verified' && o.scopeStatus !== 'Pending');
    const priority = priorities.find(p => p.topicId === objective.topicId)!;
    const unseen = selectedQuestions.filter(q => !input.solvedQuestionIds?.has(q.id)).length;
    const reason = `${priority.reason} ${verified ? 'Kaynaklı hedef.' : 'Kaynak ve kapsam onayı bekleyen hedef; hukuki doğrulama yerine geçmez.'}${kind === 'practice' ? ` ${unseen} ilk karşılaşma, ${questionCount - unseen} daha önce görülmüş soru; tekrarlar bağımsız ölçüm sayılmaz.` : ''}`;
    return {
      id: `plan-${date}-${index}-${kind}-${objective.id}`, kind, title: `${kind === 'learn' ? 'Kaynak öğrenme' : kind === 'review' ? 'Kaynaklı tekrar' : 'Soru çözümü'}: ${topic.title} — ${kind === 'practice' && selectedObjectives.length > 1 ? 'farklı öğrenme hedefleri' : primary.subtopic}`,
      reason, minutes, questionCount, questionIds: kind === 'practice' ? matching.slice(0, questionCount).map(q => q.id) : [],
      topicId: objective.topicId, objectiveId: primary.id,
      objectiveIds: kind === 'practice' ? [...new Set(matching.slice(0, questionCount).map(q => q.learningObjectiveId))] : [objective.id],
      legalProvisionId: matching[0]?.legalProvisionId ?? null,
      legalProvisionIds: [...new Set((kind === 'practice' ? matching.slice(0, questionCount) : matching.slice(0, 1)).map(q => q.legalProvisionId))],
      sourceDocumentId: primary.evidence.sourceDocumentId, sourceLocator: [...new Set(selectedObjectives.map(sourceLocator))].join('; '),
      sourceStatus: verified ? 'verified' : 'pending', status: 'pending',
    };
  };
  const loggedSessions = (input.completedSessions ?? []).filter(s => isDate(s.date) && Number.isFinite(s.minutes) && s.minutes > 0 && s.date <= today);
  const days: PlanDay[] = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(Date.parse(`${start}T12:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
    const weekday = weekdayKeys[new Date(`${date}T12:00:00Z`).getUTCDay()];
    const budget = capacity[weekday];
    const tasks: PlanTask[] = [];
    let remaining = budget;
    if (date < EXAM_CONFIG.examDate && weekday === mockWeekday && usableMock && date >= today) {
      tasks.push({ id: `plan-${date}-mock-${mock!.examId}`, kind: 'mock', title: 'Kesintisiz tam deneme — Strict Mode',
        reason: '100 soru, 150 dakika; ilk deneme ile tekrar denemesi istatistikte ayrılır. Analiz sonraki oturuma kalabilir.',
        minutes: 150, questionCount: 100, questionIds: [...mock!.questionIds], topicId: null, objectiveId: null,
        objectiveIds: [], legalProvisionId: null, legalProvisionIds: [], sourceDocumentId: null, sourceLocator: '24 konu; resmî 70 ortak / 30 teknik dağılım',
        sourceStatus: 'not-applicable', status: 'pending' });
      remaining -= 150;
    }
    if (date < EXAM_CONFIG.examDate) {
      while (remaining > 0 && orderedObjectives.length) {
        const pattern = [{ kind: 'learn' as const, minutes: 30 }, { kind: 'review' as const, minutes: 10 }, { kind: 'practice' as const, minutes: 20 }];
        for (const entry of pattern) {
          if (!remaining) break;
          const minutes = Math.min(entry.minutes, remaining);
          const task = taskFor(entry.kind, minutes, date, tasks.length);
          if (task) { tasks.push(task); remaining -= minutes; }
        }
      }
    }
    const completedMinutes = loggedSessions.filter(s => s.date === date).reduce((sum, s) => sum + s.minutes, 0);
    for (const task of tasks) {
      if (loggedSessions.filter(s => s.date === date && s.taskId === task.id).reduce((sum, s) => sum + s.minutes, 0) >= task.minutes) task.status = 'completed';
    }
    const plannedMinutes = tasks.reduce((sum, task) => sum + task.minutes, 0);
    const status = !plannedMinutes ? 'unplanned' : completedMinutes >= plannedMinutes && completedMinutes > 0 ? 'completed'
      : completedMinutes > 0 ? 'partial' : date < today ? 'missed' : 'scheduled';
    return { date, weekday, capacityMinutes: budget, plannedMinutes, completedMinutes, status, tasks };
  });
  if (!orderedObjectives.length) notes.push('Kaynakla ilişkilendirilmiş öğrenme hedefi yok; çalışma görevi uydurulmadı.');
  if (!uniqueQuestions.length) notes.push('Onaylı ve hedefle eşleşen konu bankası sorusu yok; soru çözümü yerine kaynak öğrenme planlandı.');
  if (daysLeft <= 0) notes.push('Sınav tarihi geldi veya geçti; yeni sınav hazırlık görevi atanmadı.');
  notes.push('Plan bir öneridir. Yalnız kaydedilen çalışma dakikaları tamamlandı sayılır; kaçırılan günler otomatik tamamlanmaz.');
  return { createdAt: now.toISOString(), today, daysToExam: daysLeft,
    weeklyCapacityMinutes: weekdayKeys.reduce((sum, key) => sum + capacity[key], 0), days, notes, priorities };
}
