/**
 * Native IndexedDB study-attempt journal. It never reads or changes legacy progress.
 * A checked answer is immutable; answers and the attempt revision commit together.
 * Client timestamps are bookkeeping, not proof of active thought or a trusted clock.
 */
export const ATTEMPT_DB_NAME = 'gys_attempts_v1';
export const ATTEMPT_SCHEMA_VERSION = 1;
export const ATTEMPT_DATABASE_VERSION = 2;

export interface AttemptOption { id: string; text: string }
export interface AttemptQuestion {
  id: string;
  version: number;
  topicId: string;
  /** Legacy display/progress key; canonical topic identity is kept separately. */
  topic: string;
  weight: number;
  text: string;
  options: AttemptOption[];
  correctOptionId: string;
  explanation: string;
  sourceUrl: string;
  sourceLocator: string;
  sourceSnapshotId?: string;
  sourceContentHash?: string;
  legalEdition?: 'preparation' | 'exam';
}
export interface AttemptAnswer {
  questionId: string;
  selectedOptionId: string;
  correct: boolean;
  answeredAt: string;
  /** Only caller-measured foreground duration, never inferred from wall time. */
  activeTimeMs: number | null;
}
export interface TopicAttemptResult { topicId: string; topic: string; correct: number; wrong: number; blank: number; total: number }
export interface AttemptResult {
  correct: number;
  wrong: number;
  blank: number;
  total: number;
  /** Number of correct answers; no negative marking. A study score is not an exam prediction. */
  score: number;
  accuracyPercent: number | null;
  perTopic: TopicAttemptResult[];
}
export interface StudyAttempt {
  schemaVersion: 1;
  id: string;
  title: string;
  mode: 'study';
  status: 'active' | 'completed';
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
  revision: number;
  cursor: number;
  questions: AttemptQuestion[];
  answers: AttemptAnswer[];
  contentKey: string;
  /** Counts earlier attempts with exactly the same stable question IDs and versions. */
  attemptNumber: number;
  isFirstAttempt: boolean;
  result: AttemptResult | null;
}
export interface AttemptSummary {
  id: string;
  title: string;
  status: 'active' | 'completed';
  startedAt: string;
  finishedAt: string | null;
  contentKey: string;
  questionCount: number;
  attemptNumber: number;
  isFirstAttempt: boolean;
  result: AttemptResult | null;
  revision: number;
}
export interface StartAttemptInput { title: string; mode: 'study'; questions: AttemptQuestion[] }
export interface SaveAnswerInput {
  questionId: string;
  selectedOptionId: string;
  activeTimeMs?: number;
  expectedRevision: number;
}
export interface AttemptProgress {
  id: 'main';
  schemaVersion: 1;
  totalAnswered: number;
  totalCorrect: number;
  uniqueSolved: number;
  solvedQuestionIds: string[];
  firstEncounterAnswered: number;
  firstEncounterCorrect: number;
  xp: number;
  dailyXP: number;
  lastActiveDate: string | null;
  streak: number;
  topicStats: Record<string, { answered: number; correct: number }>;
  mistakes: Record<string, { question: AttemptQuestion; wrongCount: number; streak: number; lastWrong: number }>;
}
export interface JournalBackup { kind: 'gys-study-journal'; schemaVersion: 1; exportedAt: string; attempts: StudyAttempt[] }

export class AttemptConflictError extends Error {
  constructor() { super('Oturum başka bir sekmede değişti. Yeniden yükleyerek devam edin.'); this.name = 'AttemptConflictError'; }
}
export class AttemptInProgressError extends Error {
  constructor(public readonly attemptId: string) { super('Devam eden çalışma önce tamamlanmalı veya sürdürülmeli.'); this.name = 'AttemptInProgressError'; }
}
export class CheckedAnswerConflictError extends Error {
  constructor() { super('Kontrol edilmiş cevap değiştirilemez.'); this.name = 'CheckedAnswerConflictError'; }
}

const clone = <T>(value: T): T => structuredClone(value);
function requireText(value: unknown, label: string, max = 20000): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`Geçersiz ${label}.`);
}
function requireIdentity(value: unknown): asserts value is string {
  requireText(value, 'kimlik', 160);
  if (!/^[a-zA-Z0-9_.:-]+$/.test(value) || ['__proto__', 'constructor', 'prototype'].includes(value)) throw new Error('Geçersiz kalıcı kimlik.');
}
function requireRevision(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Geçersiz oturum sürümü.');
}
function validateInput(input: StartAttemptInput): void {
  requireText(input.title, 'çalışma başlığı', 300);
  if (input.mode !== 'study') throw new Error('Bu kayıt katmanı yalnız konu çalışmasını destekler.');
  if (!Array.isArray(input.questions) || input.questions.length < 1 || input.questions.length > 100) throw new Error('Çalışma 1–100 soru içermelidir.');
  const seen = new Set<string>();
  for (const q of input.questions) {
    requireIdentity(q.id);
    if (seen.has(q.id)) throw new Error('Aynı soru bir çalışmada tekrarlanamaz.');
    seen.add(q.id);
    if (!Number.isSafeInteger(q.version) || q.version < 1) throw new Error('Geçersiz soru sürümü.');
    if (!/^(O(0[1-9]|1[0-6])|T0[1-8])$/.test(q.topicId)) throw new Error('Geçersiz konu kimliği.');
    requireText(q.topic, 'konu', 1000);
    if (!Number.isFinite(q.weight) || q.weight <= 0 || q.weight > 100) throw new Error('Geçersiz konu ağırlığı.');
    requireText(q.text, 'soru metni'); requireText(q.explanation, 'açıklama', 30000);
    requireText(q.sourceLocator, 'kaynak konumu', 2000);
    if (q.sourceSnapshotId !== undefined) requireIdentity(q.sourceSnapshotId);
    if (q.sourceContentHash !== undefined && !/^[a-f0-9]{64}$/i.test(q.sourceContentHash)) throw new Error('Geçersiz kaynak snapshot özeti.');
    if (q.legalEdition !== undefined && !['preparation', 'exam'].includes(q.legalEdition)) throw new Error('Geçersiz mevzuat sürümü türü.');
    requireText(q.sourceUrl, 'kaynak bağlantısı', 3000);
    if (new URL(q.sourceUrl).protocol !== 'https:') throw new Error('Resmî kaynak için HTTPS bağlantısı gereklidir.');
    if (!Array.isArray(q.options) || q.options.length !== 5) throw new Error('Beş seçenek gereklidir.');
    const optionIds = new Set<string>();
    const optionTexts = new Set<string>();
    for (const option of q.options) {
      requireIdentity(option.id); requireText(option.text, 'seçenek', 10000);
      optionIds.add(option.id); optionTexts.add(option.text.trim().toLocaleLowerCase('tr'));
    }
    if (optionIds.size !== 5 || optionTexts.size !== 5 || !optionIds.has(q.correctOptionId)) throw new Error('Seçenek veya cevap kimliği geçersiz.');
  }
}
function contentIdentity(questions: AttemptQuestion[]): string {
  return JSON.stringify(questions.map(q => [q.id, q.version]).sort((a, b) => String(a[0]) < String(b[0]) ? -1 : String(a[0]) > String(b[0]) ? 1 : 0));
}
function resultFor(attempt: StudyAttempt): AttemptResult {
  const answers = new Map(attempt.answers.map(a => [a.questionId, a]));
  const topics = new Map<string, TopicAttemptResult>();
  let correct = 0; let wrong = 0; let blank = 0;
  for (const q of attempt.questions) {
    const topic = topics.get(q.topicId) || { topicId: q.topicId, topic: q.topic, correct: 0, wrong: 0, blank: 0, total: 0 };
    topic.total++;
    const answer = answers.get(q.id);
    if (!answer) { blank++; topic.blank++; }
    else if (answer.correct) { correct++; topic.correct++; }
    else { wrong++; topic.wrong++; }
    topics.set(q.topicId, topic);
  }
  return { correct, wrong, blank, total: attempt.questions.length, score: correct,
    accuracyPercent: correct + wrong ? Math.round(correct / (correct + wrong) * 100) : null,
    perTopic: [...topics.values()] };
}
function summaryFor(attempt: StudyAttempt): AttemptSummary {
  return { id: attempt.id, title: attempt.title, status: attempt.status, startedAt: attempt.startedAt,
    finishedAt: attempt.finishedAt, contentKey: attempt.contentKey, questionCount: attempt.questions.length,
    attemptNumber: attempt.attemptNumber, isFirstAttempt: attempt.isFirstAttempt, result: attempt.result, revision: attempt.revision };
}

function emptyProgress(): AttemptProgress {
  return { id: 'main', schemaVersion: 1, totalAnswered: 0, totalCorrect: 0, uniqueSolved: 0,
    solvedQuestionIds: [], firstEncounterAnswered: 0, firstEncounterCorrect: 0, xp: 0, dailyXP: 0,
    lastActiveDate: null, streak: 0, topicStats: {}, mistakes: {} };
}
function applyAnswerToProgress(progress: AttemptProgress, question: AttemptQuestion, answer: AttemptAnswer): void {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' });
  const answered = new Date(answer.answeredAt);
  const day = formatter.format(answered);
  if (progress.lastActiveDate !== day) {
    const yesterday = formatter.format(new Date(answered.getTime() - 86_400_000));
    progress.streak = progress.lastActiveDate === yesterday ? progress.streak + 1 : 1;
    progress.lastActiveDate = day; progress.dailyXP = 0;
  }
  progress.totalAnswered++;
  const first = !progress.solvedQuestionIds.includes(question.id);
  if (first) { progress.solvedQuestionIds.push(question.id); progress.uniqueSolved++; progress.firstEncounterAnswered++; }
  const topic = Object.hasOwn(progress.topicStats, question.topic) ? progress.topicStats[question.topic] : { answered: 0, correct: 0 };
  topic.answered++;
  // Define a data property even for a legacy topic named "__proto__"; never mutate the prototype.
  Object.defineProperty(progress.topicStats, question.topic, { value: topic, enumerable: true, writable: true, configurable: true });
  if (answer.correct) {
    progress.totalCorrect++; topic.correct++; progress.xp += 10; progress.dailyXP += 10;
    if (first) progress.firstEncounterCorrect++;
    const mistake = Object.hasOwn(progress.mistakes, question.id) ? progress.mistakes[question.id] : undefined;
    if (mistake) { mistake.streak++; if (mistake.streak >= 2) delete progress.mistakes[question.id]; }
  } else {
    const old = Object.hasOwn(progress.mistakes, question.id) ? progress.mistakes[question.id] : undefined;
    progress.mistakes[question.id] = { question: clone(question), wrongCount: (old?.wrongCount || 0) + 1,
      streak: 0, lastWrong: answered.getTime() };
  }
}
function progressFor(attempts: StudyAttempt[]): AttemptProgress {
  const progress = emptyProgress();
  const events = attempts.flatMap(attempt => attempt.answers.map(answer => ({ attemptId: attempt.id, answer,
    question: attempt.questions.find(question => question.id === answer.questionId)! })));
  events.sort((a, b) => a.answer.answeredAt.localeCompare(b.answer.answeredAt)
    || a.attemptId.localeCompare(b.attemptId) || a.question.id.localeCompare(b.question.id));
  for (const event of events) applyAnswerToProgress(progress, event.question, event.answer);
  return progress;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical((value as Record<string, unknown>)[key])).join(',') + '}';
  return JSON.stringify(value);
}
function requireDate(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw new Error('Geçersiz kayıt tarihi.');
}
function validateJournal(input: unknown): StudyAttempt[] {
  if (!input || typeof input !== 'object') throw new Error('Geçersiz çalışma yedeği.');
  const backup = input as JournalBackup;
  if (backup.kind !== 'gys-study-journal' || backup.schemaVersion !== 1 || !Array.isArray(backup.attempts) || backup.attempts.length > 5000) throw new Error('Desteklenmeyen çalışma yedeği veya sürümü.');
  requireDate(backup.exportedAt);
  const ids = new Set<string>();
  return backup.attempts.map(item => {
    validateInput(item); requireIdentity(item.id);
    if (ids.has(item.id)) throw new Error('Yedekte yinelenen oturum kimliği.');
    ids.add(item.id); requireRevision(item.revision);
    if (item.schemaVersion !== 1 || !['active', 'completed'].includes(item.status)) throw new Error('Geçersiz oturum durumu.');
    if (!Number.isSafeInteger(item.cursor) || item.cursor < 0 || item.cursor >= item.questions.length) throw new Error('Geçersiz yedek soru konumu.');
    if (!Number.isSafeInteger(item.attemptNumber) || item.attemptNumber < 1 || item.isFirstAttempt !== (item.attemptNumber === 1)) throw new Error('Geçersiz ilk/tekrar oturum bilgisi.');
    if (item.contentKey !== contentIdentity(item.questions)) throw new Error('Yedek soru sürümleri eşleşmiyor.');
    requireDate(item.startedAt); requireDate(item.updatedAt);
    if (item.status === 'completed') requireDate(item.finishedAt);
    else if (item.finishedAt !== null) throw new Error('Aktif çalışma için bitiş tarihi bulunamaz.');
    if (!Array.isArray(item.answers) || item.answers.length > item.questions.length) throw new Error('Geçersiz cevap listesi.');
    const answered = new Set<string>();
    for (const answer of item.answers) {
      const question = item.questions.find(q => q.id === answer.questionId);
      if (!question || answered.has(answer.questionId) || !question.options.some(o => o.id === answer.selectedOptionId)) throw new Error('Yedek cevap kimliği geçersiz.');
      if (answer.correct !== (answer.selectedOptionId === question.correctOptionId)) throw new Error('Yedek cevap sonucu tutarsız.');
      requireDate(answer.answeredAt);
      if (answer.activeTimeMs !== null && (!Number.isFinite(answer.activeTimeMs) || answer.activeTimeMs < 0 || answer.activeTimeMs > 86_400_000)) throw new Error('Yedek aktif süre geçersiz.');
      answered.add(answer.questionId);
    }
    if (item.revision < item.answers.length + (item.status === 'completed' ? 1 : 0)) throw new Error('Yedek cevap/oturum sürümü tutarsız.');
    const record = clone(item);
    if (record.status === 'completed') {
      const expected = resultFor(record);
      if (canonical(record.result) !== canonical(expected)) throw new Error('Yedek sonuç özeti tutarsız.');
      record.result = expected;
    } else if (record.result !== null) throw new Error('Aktif çalışma sonuçlandırılmış gösterilemez.');
    return record;
  });
}

export function createAttemptStore(dbName = ATTEMPT_DB_NAME) {
  let connection: Promise<IDBDatabase> | null = null;
  async function open(): Promise<IDBDatabase> {
    if (!connection) {
      connection = new Promise<IDBDatabase>((resolve, reject) => {
        if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB bu tarayıcıda kullanılamıyor.')); return; }
        const request = indexedDB.open(dbName, ATTEMPT_DATABASE_VERSION);
        request.onupgradeneeded = () => {
          // Additive upgrade only: preserve earlier journal snapshots and summaries.
          const db = request.result;
          if (!db.objectStoreNames.contains('attempts')) {
            const attempts = db.createObjectStore('attempts', { keyPath: 'id' });
            attempts.createIndex('status', 'status');
          }
          if (!db.objectStoreNames.contains('summaries')) {
            const summaries = db.createObjectStore('summaries', { keyPath: 'id' });
            summaries.createIndex('status', 'status'); summaries.createIndex('contentKey', 'contentKey');
          }
          if (!db.objectStoreNames.contains('progress')) {
            const progress = db.createObjectStore('progress', { keyPath: 'id' });
            const existing = request.transaction!.objectStore('attempts').getAll();
            existing.onsuccess = () => {
              const attempts = existing.result as StudyAttempt[];
              progress.put(progressFor(attempts));
              const summaries = request.transaction!.objectStore('summaries');
              for (const attempt of attempts) summaries.put(summaryFor(attempt));
            };
          }
        };
        request.onerror = () => reject(request.error || new Error('Çalışma veritabanı açılamadı.'));
        request.onblocked = () => reject(new Error('Veritabanı sürümü başka sekmede açık.'));
        request.onsuccess = () => {
          request.result.onversionchange = () => { request.result.close(); connection = null; };
          resolve(request.result);
        };
      }).catch(error => { connection = null; throw error; });
    }
    return connection;
  }
  async function read<T>(storeName: string, query: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const request = query(tx.objectStore(storeName)); let result: T;
      request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => resolve(clone(result));
      tx.onerror = () => reject(tx.error || new Error('Çalışma kaydı okunamadı.'));
      tx.onabort = () => reject(tx.error || new Error('Çalışma okuması iptal edildi.'));
    });
  }
  async function mutate(id: string, update: (attempt: StudyAttempt) => boolean, afterChange?: (attempt: StudyAttempt, tx: IDBTransaction) => void): Promise<StudyAttempt> {
    const db = await open();
    return new Promise<StudyAttempt>((resolve, reject) => {
      const tx = db.transaction(['attempts', 'summaries', 'progress'], 'readwrite');
      const store = tx.objectStore('attempts'); const request = store.get(id);
      let result: StudyAttempt; let failure: unknown;
      request.onsuccess = () => {
        try {
          const attempt = request.result as StudyAttempt | undefined;
          if (!attempt) throw new Error('Çalışma oturumu bulunamadı.');
          const changed = update(attempt);
          if (changed) {
            attempt.revision++; attempt.updatedAt = new Date().toISOString();
            store.put(attempt); tx.objectStore('summaries').put(summaryFor(attempt));
            afterChange?.(attempt, tx);
          }
          result = attempt;
        } catch (error) { failure = error; tx.abort(); }
      };
      tx.oncomplete = () => resolve(clone(result));
      tx.onabort = () => reject(failure || tx.error || new Error('Çalışma kaydı iptal edildi.'));
      tx.onerror = () => reject(failure || tx.error || new Error('Çalışma kaydedilemedi.'));
    });
  }
  return {
    async start(input: StartAttemptInput): Promise<StudyAttempt> {
      validateInput(input);
      const questions = clone(input.questions); const contentKey = contentIdentity(questions);
      const db = await open();
      return new Promise<StudyAttempt>((resolve, reject) => {
        const tx = db.transaction(['attempts', 'summaries', 'progress'], 'readwrite');
        const attempts = tx.objectStore('attempts'); const summaries = tx.objectStore('summaries');
        const active = attempts.index('status').get('active'); let result: StudyAttempt; let failure: unknown;
        active.onsuccess = () => {
          if (active.result) { failure = new AttemptInProgressError(active.result.id); tx.abort(); return; }
          const count = summaries.index('contentKey').count(contentKey);
          count.onsuccess = () => {
            const now = new Date().toISOString();
            result = { schemaVersion: 1, id: crypto.randomUUID(), title: input.title, mode: 'study', status: 'active',
              startedAt: now, updatedAt: now, finishedAt: null, revision: 0, cursor: 0, questions, answers: [],
              contentKey, attemptNumber: count.result + 1, isFirstAttempt: count.result === 0, result: null };
            attempts.add(result); summaries.add(summaryFor(result));
          };
        };
        tx.oncomplete = () => resolve(clone(result));
        tx.onabort = () => reject(failure || tx.error || new Error('Çalışma başlatılamadı.'));
        tx.onerror = () => reject(failure || tx.error || new Error('Çalışma başlatılamadı.'));
      });
    },
    async getActive(): Promise<StudyAttempt | null> {
      return (await read<StudyAttempt | undefined>('attempts', store => store.index('status').get('active'))) || null;
    },
    async load(id: string): Promise<StudyAttempt | null> {
      requireIdentity(id); return (await read<StudyAttempt | undefined>('attempts', store => store.get(id))) || null;
    },
    async saveAnswer(id: string, input: SaveAnswerInput): Promise<StudyAttempt> {
      requireRevision(input.expectedRevision);
      if (input.activeTimeMs !== undefined && (!Number.isFinite(input.activeTimeMs) || input.activeTimeMs < 0 || input.activeTimeMs > 86_400_000)) throw new Error('Geçersiz aktif cevaplama süresi.');
      return mutate(id, attempt => {
        const question = attempt.questions.find(q => q.id === input.questionId);
        if (!question || !question.options.some(o => o.id === input.selectedOptionId)) throw new Error('Soru veya seçenek bu oturuma ait değil.');
        const existing = attempt.answers.find(a => a.questionId === input.questionId);
        // Retrying a committed request after a lost response must not add a second answer.
        if (existing) {
          if (existing.selectedOptionId === input.selectedOptionId) return false;
          throw new CheckedAnswerConflictError();
        }
        if (attempt.status !== 'active') throw new Error('Tamamlanmış çalışma değiştirilemez.');
        if (attempt.revision !== input.expectedRevision) throw new AttemptConflictError();
        attempt.answers.push({ questionId: question.id, selectedOptionId: input.selectedOptionId,
          correct: input.selectedOptionId === question.correctOptionId, answeredAt: new Date().toISOString(),
          activeTimeMs: input.activeTimeMs ?? null });
        return true;
      }, (attempt, tx) => {
        const progressStore = tx.objectStore('progress');
        const request = progressStore.get('main');
        request.onsuccess = () => {
          const progress = (request.result || emptyProgress()) as AttemptProgress;
          const answer = attempt.answers.find(a => a.questionId === input.questionId)!;
          const question = attempt.questions.find(q => q.id === input.questionId)!;
          applyAnswerToProgress(progress, question, answer); progressStore.put(progress);
        };
      });
    },
    async setCursor(id: string, index: number, expectedRevision: number): Promise<StudyAttempt> {
      requireRevision(expectedRevision);
      return mutate(id, attempt => {
        if (!Number.isSafeInteger(index) || index < 0 || index >= attempt.questions.length) throw new Error('Geçersiz soru konumu.');
        if (attempt.status !== 'active') throw new Error('Tamamlanmış çalışma değiştirilemez.');
        if (attempt.revision !== expectedRevision) throw new AttemptConflictError();
        if (attempt.cursor === index) return false;
        attempt.cursor = index; return true;
      });
    },
    async finish(id: string, expectedRevision: number): Promise<StudyAttempt> {
      requireRevision(expectedRevision);
      return mutate(id, attempt => {
        if (attempt.status === 'completed') return false;
        if (attempt.revision !== expectedRevision) throw new AttemptConflictError();
        attempt.status = 'completed'; attempt.finishedAt = new Date().toISOString(); attempt.result = resultFor(attempt);
        return true;
      });
    },
    async listCompleted(): Promise<AttemptSummary[]> {
      const summaries = await read<AttemptSummary[]>('summaries', store => store.index('status').getAll('completed'));
      return summaries.sort((a, b) => (b.finishedAt || '').localeCompare(a.finishedAt || ''));
    },
    async getProgress(): Promise<AttemptProgress> {
      const progress = (await read<AttemptProgress | undefined>('progress', store => store.get('main'))) || emptyProgress();
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
      if (progress.lastActiveDate !== today) progress.dailyXP = 0;
      return progress;
    },
    async exportJournal(): Promise<JournalBackup> {
      const attempts = await read<StudyAttempt[]>('attempts', store => store.getAll());
      return { kind: 'gys-study-journal', schemaVersion: 1, exportedAt: new Date().toISOString(), attempts };
    },
    async importJournal(input: unknown): Promise<{ imported: number; totalAttempts: number }> {
      const incoming = validateJournal(input); const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['attempts', 'summaries', 'progress'], 'readwrite');
        const attemptStore = tx.objectStore('attempts'); const request = attemptStore.getAll();
        let result: { imported: number; totalAttempts: number }; let failure: unknown;
        request.onsuccess = () => {
          try {
            const existing = request.result as StudyAttempt[]; const merged = new Map(existing.map(attempt => [attempt.id, attempt]));
            const additions: StudyAttempt[] = [];
            for (const attempt of incoming) {
              const old = merged.get(attempt.id);
              if (old && canonical(old) !== canonical(attempt)) throw new Error('Oturum kimliği çakışıyor; mevcut kayıt korundu.');
              if (!old) { merged.set(attempt.id, attempt); additions.push(attempt); }
            }
            const all = [...merged.values()];
            if (all.filter(attempt => attempt.status === 'active').length > 1) throw new Error('Birden fazla aktif çalışma birleştirilemez.');
            for (const attempt of additions) { attemptStore.add(attempt); tx.objectStore('summaries').add(summaryFor(attempt)); }
            tx.objectStore('progress').put(progressFor(all));
            result = { imported: additions.length, totalAttempts: all.length };
          } catch (error) { failure = error; tx.abort(); }
        };
        tx.oncomplete = () => resolve(result);
        tx.onabort = () => reject(failure || tx.error || new Error('Çalışma yedeği birleştirilemedi.'));
        tx.onerror = () => reject(failure || tx.error || new Error('Çalışma yedeği birleştirilemedi.'));
      });
    },
    async close(): Promise<void> { if (connection) { (await connection).close(); connection = null; } },
  };
}
export type AttemptStore = ReturnType<typeof createAttemptStore>;
