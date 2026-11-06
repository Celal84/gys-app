/** Protected 100-question exam journal. No legacy progress or study journal is mutated. */
import { validateExamQuestions, type Question, type SourceSnapshot } from './core/content';
import { TOPICS } from './core/curriculum';

export const STRICT_DB_NAME = 'gys_strict_v1';
export const STRICT_DATABASE_VERSION = 2;
export const STRICT_DURATION_MS = 150 * 60 * 1000;
export interface StrictExamDefinition {
  id: string;
  version: number;
  title: string;
  questionIds: string[];
  verificationStatus: 'Verified' | 'Pending';
  verifiedAt: string;
  /** Review artifact identifying the complete exam's source, distribution and uniqueness review. */
  verificationEvidence: string;
}
export interface StartStrictInput { definition: StrictExamDefinition; questions: Question[]; snapshots: SourceSnapshot[] }
export interface StrictClock { now(): number; monotonicNow?(): number }
export interface StrictStoreOptions { dbName?: string; clock?: StrictClock; idFactory?: () => string }
export interface StrictAnswer { questionId: string; selectedOptionId: string; answeredAt: string }
export interface StrictTiming {
  questionId: string;
  firstViewedAt: string | null;
  foregroundMs: number;
  returnCount: number;
  answerChangeCount: number;
}
export interface StrictTopicResult { topicId: string; correct: number; wrong: number; blank: number; total: number }
export interface StrictResult {
  correct: number; wrong: number; blank: number; total: 100; score: number;
  perTopic: StrictTopicResult[];
  common: { correct: number; wrong: number; blank: number; total: 70 };
  technical: { correct: number; wrong: number; blank: number; total: 30 };
}
export interface StrictSummary {
  id: string; definitionId: string; definitionVersion: number; title: string;
  status: 'active' | 'completed'; startedAt: string; deadlineAt: string; finishedAt: string | null;
  finishReason: 'submitted' | 'timeout' | null; revision: number;
  attemptNumber: number; isFirstAttempt: boolean; result: StrictResult | null;
}
/** Deliberately projected: no key, explanation, source quotation or verification evidence during an exam. */
export interface StrictQuestionView { id: string; version: number; topicId: string; text: string; options: { id: string; text: string }[] }
export interface StrictView extends StrictSummary {
  schemaVersion: 1; cursor: number; remainingMs: number;
  questions: StrictQuestionView[]; answers: StrictAnswer[]; timings: StrictTiming[];
  clockWarning: boolean;
  foreground: boolean;
  /** Present only after completion. Snapshots preserve the answer/source edition used for that attempt. */
  review?: { questions: Question[]; snapshots: SourceSnapshot[] };
}
export interface SaveStrictAnswerInput { questionId: string; selectedOptionId: string | null; expectedRevision: number }
export interface StrictRecord extends StrictSummary {
  schemaVersion: 1; definitionKey: string; definition: StrictExamDefinition;
  questions: Question[]; snapshots: SourceSnapshot[]; answers: StrictAnswer[];
  cursor: number; timings: StrictTiming[]; clockWarning: boolean;
  lastObservedMs: number; foreground: boolean; foregroundOwner: string; lastForegroundMs: number;
}
interface DefinitionRecord { key: string; definitionId: string; content: string }
interface Reservation { key: string; ownerExamId: string }
export interface StrictJournal {
  kind: 'gys-strict-journal'; schemaVersion: 1; exportedAt: string; attempts: StrictRecord[];
}
const clone = <T>(value: T): T => structuredClone(value);
const normalize = (text: string) => text.normalize('NFKC').toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();
const iso = (ms: number) => new Date(ms).toISOString();
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
function text(value: unknown): value is string { return typeof value === 'string' && !!value.trim(); }
function validateInput(input: StartStrictInput): void {
  const d = input.definition;
  if (!d || !text(d.id) || !text(d.title) || !Number.isInteger(d.version) || d.version < 1
    || d.verificationStatus !== 'Verified' || !Number.isFinite(Date.parse(d.verifiedAt)) || !text(d.verificationEvidence)) {
    throw new Error('Doğrulanmış deneme tanımı ve inceleme kanıtı gerekli.');
  }
  if (!Array.isArray(input.questions) || !Array.isArray(input.snapshots) || !Array.isArray(d.questionIds)) throw new Error('Geçersiz deneme paketi.');
  const issues = validateExamQuestions(input.questions, input.snapshots);
  if (input.questions.some(q => q.examId !== d.id) || canonical(d.questionIds) !== canonical(input.questions.map(q => q.id))) issues.push('Definition/question membership mismatch');
  if (new Set(input.snapshots.map(s => s.id)).size !== input.snapshots.length) issues.push('Duplicate source snapshot identity');
  if (issues.length) throw new Error(`Deneme başlatılamaz: ${issues.join('; ')}`);
}
function score(record: StrictRecord): StrictResult {
  const answers = new Map(record.answers.map(a => [a.questionId, a.selectedOptionId]));
  const perTopic = TOPICS.map(topic => {
    let correct = 0, wrong = 0, blank = 0;
    for (const q of record.questions.filter(q => q.topicId === topic.id)) {
      const selected = answers.get(q.id);
      if (!selected) blank++;
      else if (selected === q.correctOptionId) correct++;
      else wrong++;
    }
    return { topicId: topic.id, correct, wrong, blank, total: topic.examWeight };
  });
  const sum = (rows: StrictTopicResult[]) => rows.reduce((a, row) => ({ correct: a.correct + row.correct, wrong: a.wrong + row.wrong, blank: a.blank + row.blank }), { correct: 0, wrong: 0, blank: 0 });
  const totals = sum(perTopic);
  return { ...totals, total: 100, score: totals.correct, perTopic,
    common: { ...sum(perTopic.filter(t => t.topicId.startsWith('O'))), total: 70 },
    technical: { ...sum(perTopic.filter(t => t.topicId.startsWith('T'))), total: 30 } };
}
function definitionContent(record: Pick<StrictRecord, 'definition' | 'questions' | 'snapshots'>): string {
  return canonical({ definition: record.definition, questions: record.questions, snapshots: [...record.snapshots].sort((a, b) => a.id.localeCompare(b.id)) });
}
function reservationKeys(record: Pick<StrictRecord, 'questions'>): string[] {
  return record.questions.flatMap(q => [`id:${q.id}`, `text:${normalize(q.text)}`]);
}
/** Structural/source evidence validation is NOT publication authority for a user's JSON file. */
export function validateStrictJournal(value: unknown): StrictJournal {
  const fail = () => { throw new Error('Geçersiz Strict Mode yedeği; mevcut denemeler korunur.'); };
  if (!value || typeof value !== 'object') return fail();
  const data = value as StrictJournal;
  if (data.kind !== 'gys-strict-journal' || data.schemaVersion !== 1 || !Number.isFinite(Date.parse(data.exportedAt)) || !Array.isArray(data.attempts)) return fail();
  const ids = new Set<string>(), definitions = new Map<string, string>(), reservations = new Map<string, string>();
  let active = 0;
  for (const record of data.attempts) {
    if (!record || typeof record !== 'object') return fail();
    try { validateInput({ definition: record.definition, questions: record.questions, snapshots: record.snapshots }); } catch { return fail(); }
    const start = Date.parse(record.startedAt), deadline = Date.parse(record.deadlineAt);
    if (record.schemaVersion !== 1 || !text(record.id) || ids.has(record.id)
      || record.definitionId !== record.definition.id || record.definitionVersion !== record.definition.version || record.title !== record.definition.title
      || record.definitionKey !== JSON.stringify([record.definition.id, record.definition.version])
      || !Number.isFinite(start) || deadline !== start + STRICT_DURATION_MS
      || !Number.isInteger(record.revision) || record.revision < 0 || !Number.isInteger(record.cursor) || record.cursor < 0 || record.cursor >= 100
      || !Number.isInteger(record.attemptNumber) || record.attemptNumber < 1 || record.isFirstAttempt !== (record.attemptNumber === 1)
      || typeof record.foreground !== 'boolean' || typeof record.clockWarning !== 'boolean' || !text(record.foregroundOwner)
      || !Number.isFinite(record.lastObservedMs) || record.lastObservedMs < start
      || !Number.isFinite(record.lastForegroundMs) || record.lastForegroundMs < start || record.lastForegroundMs > record.lastObservedMs
      || !Array.isArray(record.answers) || !Array.isArray(record.timings) || record.timings.length !== 100) return fail();
    ids.add(record.id);
    const answered = new Set<string>();
    for (const answer of record.answers) {
      const q = record.questions.find(q => q.id === answer?.questionId), at = Date.parse(answer?.answeredAt);
      if (!q || answered.has(answer.questionId) || !q.options.some(o => o.id === answer.selectedOptionId) || !Number.isFinite(at) || at < start || at >= deadline || at > record.lastObservedMs) return fail();
      answered.add(answer.questionId);
    }
    let foregroundTotal = 0;
    for (let i = 0; i < 100; i++) {
      const timing = record.timings[i];
      if (!timing || timing.questionId !== record.questions[i].id || !Number.isFinite(timing.foregroundMs) || timing.foregroundMs < 0
        || !Number.isInteger(timing.returnCount) || timing.returnCount < 0 || !Number.isInteger(timing.answerChangeCount) || timing.answerChangeCount < 0
        || (timing.firstViewedAt !== null && (!Number.isFinite(Date.parse(timing.firstViewedAt)) || Date.parse(timing.firstViewedAt) < start || Date.parse(timing.firstViewedAt) >= deadline || Date.parse(timing.firstViewedAt) > record.lastObservedMs))) return fail();
      foregroundTotal += timing.foregroundMs;
    }
    if (foregroundTotal > Math.min(STRICT_DURATION_MS, record.lastObservedMs - start) + 1) return fail();
    if (record.status === 'active') {
      active++;
      if (record.result !== null || record.finishedAt !== null || record.finishReason !== null || record.lastObservedMs >= deadline) return fail();
    } else if (record.status === 'completed') {
      const finished = Date.parse(record.finishedAt ?? '');
      if (!['submitted', 'timeout'].includes(record.finishReason ?? '') || !Number.isFinite(finished) || finished < start || finished > deadline
        || finished > record.lastObservedMs || (record.finishReason === 'timeout' && finished !== deadline)
        || (record.finishReason === 'submitted' && finished !== record.lastObservedMs) || record.foreground
        || record.answers.some(answer => Date.parse(answer.answeredAt) > finished)
        || record.timings.some(timing => timing.firstViewedAt !== null && Date.parse(timing.firstViewedAt) > finished)
        || foregroundTotal > finished - start + 1
        || canonical(record.result) !== canonical(score(record))) return fail();
    } else return fail();
    const content = definitionContent(record), prior = definitions.get(record.definitionKey);
    if (prior && prior !== content) return fail();
    definitions.set(record.definitionKey, content);
    for (const key of reservationKeys(record)) {
      const priorOwner = reservations.get(key);
      if (priorOwner && priorOwner !== record.definitionId) return fail();
      reservations.set(key, record.definitionId);
    }
  }
  if (active > 1) return fail();
  // Attempt sequence is evidence of prior exposure, and cannot be reset by editing a backup.
  for (const key of definitions.keys()) {
    const group = data.attempts.filter(r => r.definitionKey === key).sort((a, b) => a.attemptNumber - b.attemptNumber);
    if (group.some((r, index) => r.attemptNumber !== index + 1)) return fail();
  }
  return clone(data);
}
function summary(record: StrictRecord): StrictSummary {
  const { id, definitionId, definitionVersion, title, status, startedAt, deadlineAt, finishedAt, finishReason, revision, attemptNumber, isFirstAttempt, result } = record;
  return { id, definitionId, definitionVersion, title, status, startedAt, deadlineAt, finishedAt, finishReason, revision, attemptNumber, isFirstAttempt, result };
}
export class StrictConflictError extends Error {
  constructor() { super('Deneme başka bir sekmede değişti. Güncel oturumu yükleyin.'); this.name = 'StrictConflictError'; }
}
export class StrictInProgressError extends Error {
  constructor(public readonly attemptId: string) { super('Devam eden denemeyi sürdürün veya bitirin.'); this.name = 'StrictInProgressError'; }
}
const request = <T>(req: IDBRequest<T>) => new Promise<T>((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
const complete = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error ?? new Error('Deneme kaydı geri alındı.')); tx.onerror = () => { /* abort reports the transaction error */ }; });

export function createStrictStore(options: StrictStoreOptions | string = {}) {
  const config = typeof options === 'string' ? { dbName: options } : options;
  const clock: StrictClock = config.clock ?? { now: () => Date.now(), monotonicNow: () => performance.now() };
  const anchorWall = clock.now(), anchorMonotonic = clock.monotonicNow?.();
  if (!Number.isFinite(anchorWall)) throw new Error('Geçersiz saat.');
  let lastNow = anchorWall;
  const owner = crypto.randomUUID();
  const idFactory = config.idFactory ?? (() => crypto.randomUUID());
  let database: Promise<IDBDatabase> | undefined;
  function now(stored = 0) {
    const wall = clock.now(), monotonic = clock.monotonicNow?.();
    if (!Number.isFinite(wall) || (monotonic !== undefined && !Number.isFinite(monotonic))) throw new Error('Geçersiz saat.');
    const elapsed = anchorMonotonic === undefined || monotonic === undefined ? 0 : Math.max(0, monotonic - anchorMonotonic);
    lastNow = Math.max(lastNow, wall, stored, anchorWall + elapsed);
    return { ms: lastNow, warning: wall < lastNow - 1000 };
  }
  function open() {
    database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(config.dbName ?? STRICT_DB_NAME, STRICT_DATABASE_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        // Additive migration: existing stores and historical attempt snapshots survive.
        if (!db.objectStoreNames.contains('attempts')) db.createObjectStore('attempts', { keyPath: 'id' }).createIndex('status', 'status');
        if (!db.objectStoreNames.contains('summaries')) db.createObjectStore('summaries', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('definitions')) db.createObjectStore('definitions', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('reservations')) db.createObjectStore('reservations', { keyPath: 'key' });
        const upgrade = req.transaction!;
        const historical = upgrade.objectStore('attempts').getAll();
        historical.onsuccess = () => {
          try {
            const records = historical.result as StrictRecord[];
            const owners = new Map<string, string>(), versions = new Map<string, string>();
            for (const record of records) {
              const content = definitionContent(record), prior = versions.get(record.definitionKey);
              if (prior && prior !== content) throw new Error('Çakışan eski deneme sürümü.');
              versions.set(record.definitionKey, content);
              for (const key of reservationKeys(record)) {
                const owner = owners.get(key);
                if (owner && owner !== record.definitionId) throw new Error('Çakışan eski deneme rezervasyonu.');
                owners.set(key, record.definitionId);
                upgrade.objectStore('reservations').put({ key, ownerExamId: record.definitionId } satisfies Reservation);
              }
              upgrade.objectStore('definitions').put({ key: record.definitionKey, definitionId: record.definitionId, content } satisfies DefinitionRecord);
              upgrade.objectStore('summaries').put(summary(record));
            }
          } catch { upgrade.abort(); }
        };
      };
      req.onsuccess = () => { req.result.onversionchange = () => req.result.close(); resolve(req.result); };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Deneme veritabanı güncellemesi için eski sekmeyi kapatın.'));
    });
    return database;
  }
  async function transact<T>(work: (tx: IDBTransaction) => Promise<T>): Promise<T> {
    const db = await open();
    const tx = db.transaction(['attempts', 'summaries', 'definitions', 'reservations'], 'readwrite');
    const done = complete(tx);
    try { const result = await work(tx); await done; return clone(result); }
    catch (error) { try { tx.abort(); } catch { /* Already committed/aborted. */ } await done.catch(() => {}); throw error; }
  }
  async function persist(tx: IDBTransaction, record: StrictRecord) {
    await request(tx.objectStore('attempts').put(record));
    await request(tx.objectStore('summaries').put(summary(record)));
  }
  function finishRecord(record: StrictRecord, timestamp: number, reason: 'submitted' | 'timeout') {
    record.status = 'completed'; record.finishedAt = iso(timestamp); record.finishReason = reason;
    record.result = score(record); record.foreground = false; record.revision++;
  }
  /** Observe deadline before every operation; persisted high-water time prevents regained time. */
  function observe(record: StrictRecord) {
    const time = now(record.lastObservedMs);
    if (record.status === 'completed') return time.ms;
    record.clockWarning ||= time.warning;
    const end = Math.min(time.ms, Date.parse(record.deadlineAt));
    if (record.foreground && record.foregroundOwner === owner) {
      record.timings[record.cursor].foregroundMs += Math.max(0, end - record.lastForegroundMs);
    }
    // A reloaded/new tab cannot reconstruct when the old page stopped being visible.
    if (record.foregroundOwner !== owner) record.foreground = false;
    record.foregroundOwner = owner; record.lastForegroundMs = time.ms; record.lastObservedMs = time.ms;
    if (time.ms >= Date.parse(record.deadlineAt)) finishRecord(record, Date.parse(record.deadlineAt), 'timeout');
    return time.ms;
  }
  function view(record: StrictRecord, time: number): StrictView {
    const result: StrictView = { ...summary(record), schemaVersion: 1, cursor: record.cursor,
      remainingMs: record.status === 'completed' ? 0 : Math.max(0, Date.parse(record.deadlineAt) - time),
      questions: record.questions.map(q => ({ id: q.id, version: q.version, topicId: q.topicId, text: q.text, options: q.options.map(o => ({ id: o.id, text: o.text })) })),
      answers: record.answers, timings: record.timings, clockWarning: record.clockWarning, foreground: record.foreground };
    if (record.status === 'completed') result.review = { questions: record.questions, snapshots: record.snapshots };
    return result;
  }
  async function load(tx: IDBTransaction, id: string) {
    const record = await request(tx.objectStore('attempts').get(id)) as StrictRecord | undefined;
    if (!record) throw new Error('Deneme oturumu bulunamadı.');
    return record;
  }
  function revision(record: StrictRecord, expected: number) {
    if (!Number.isInteger(expected) || expected !== record.revision) throw new StrictConflictError();
  }
  async function mutate(id: string, expected: number, operation: (record: StrictRecord, time: number) => void): Promise<StrictView> {
    return transact(async tx => {
      const record = await load(tx, id), wasActive = record.status === 'active';
      const time = observe(record);
      // Timeout is committed even if the caller tried to answer at/after the deadline.
      if (wasActive && record.status === 'completed') { await persist(tx, record); return view(record, time); }
      if (record.status !== 'active') throw new Error('Tamamlanmış deneme değiştirilemez.');
      revision(record, expected); operation(record, time); record.revision++;
      await persist(tx, record); return view(record, time);
    });
  }
  return {
    async start(raw: StartStrictInput): Promise<StrictView> {
      const input = clone(raw); validateInput(input);
      return transact(async tx => {
        const active = await request(tx.objectStore('attempts').index('status').getAll('active')) as StrictRecord[];
        for (const previous of active) { observe(previous); await persist(tx, previous); if (previous.status === 'active') throw new StrictInProgressError(previous.id); }
        const d = input.definition, definitionKey = JSON.stringify([d.id, d.version]);
        const content = definitionContent(input);
        const old = await request(tx.objectStore('definitions').get(definitionKey)) as DefinitionRecord | undefined;
        if (old && old.content !== content) throw new Error('Aynı deneme sürümünün değişmez içeriği değiştirilemez. Yeni sürüm oluşturun.');
        for (const q of input.questions) for (const key of [`id:${q.id}`, `text:${normalize(q.text)}`]) {
          const reserved = await request(tx.objectStore('reservations').get(key)) as Reservation | undefined;
          if (reserved && reserved.ownerExamId !== d.id) throw new Error('Korunan soru başka bir denemede kullanılamaz.');
          await request(tx.objectStore('reservations').put({ key, ownerExamId: d.id } satisfies Reservation));
        }
        const summaries = await request(tx.objectStore('summaries').getAll()) as StrictSummary[];
        const attemptNumber = summaries.filter(s => s.definitionId === d.id && s.definitionVersion === d.version).length + 1;
        const time = now(), id = idFactory();
        if (!text(id) || await request(tx.objectStore('attempts').get(id))) throw new Error('Deneme oturum kimliği çakışıyor.');
        const record: StrictRecord = { schemaVersion: 1, id, definitionId: d.id, definitionVersion: d.version, definitionKey, definition: d,
          title: d.title, status: 'active', startedAt: iso(time.ms), deadlineAt: iso(time.ms + STRICT_DURATION_MS), finishedAt: null,
          finishReason: null, revision: 0, attemptNumber, isFirstAttempt: attemptNumber === 1, result: null,
          questions: input.questions, snapshots: input.snapshots, answers: [], cursor: 0,
          timings: input.questions.map((q, i) => ({ questionId: q.id, firstViewedAt: i === 0 ? iso(time.ms) : null, foregroundMs: 0, returnCount: 0, answerChangeCount: 0 })),
          lastObservedMs: time.ms, clockWarning: time.warning, foreground: true, foregroundOwner: owner, lastForegroundMs: time.ms };
        await request(tx.objectStore('definitions').put({ key: definitionKey, definitionId: d.id, content } satisfies DefinitionRecord));
        await persist(tx, record); return view(record, time.ms);
      });
    },
    async loadView(id: string): Promise<StrictView | null> {
      return transact(async tx => {
        const record = await request(tx.objectStore('attempts').get(id)) as StrictRecord | undefined;
        if (!record) return null;
        const time = observe(record); await persist(tx, record); return view(record, time);
      });
    },
    async getActiveView(): Promise<StrictView | null> {
      return transact(async tx => {
        const records = await request(tx.objectStore('attempts').index('status').getAll('active')) as StrictRecord[];
        for (const record of records) { const time = observe(record); await persist(tx, record); if (record.status === 'active') return view(record, time); }
        return null;
      });
    },
    saveAnswer(id: string, input: SaveStrictAnswerInput): Promise<StrictView> {
      return mutate(id, input.expectedRevision, (record, time) => {
        const q = record.questions.find(q => q.id === input.questionId);
        if (!q || (input.selectedOptionId !== null && !q.options.some(o => o.id === input.selectedOptionId))) throw new Error('Geçersiz soru veya kalıcı seçenek kimliği.');
        const previous = record.answers.find(a => a.questionId === q.id);
        if (previous && previous.selectedOptionId !== input.selectedOptionId) record.timings.find(t => t.questionId === q.id)!.answerChangeCount++;
        record.answers = record.answers.filter(a => a.questionId !== q.id);
        if (input.selectedOptionId !== null) record.answers.push({ questionId: q.id, selectedOptionId: input.selectedOptionId, answeredAt: iso(time) });
      });
    },
    setCursor(id: string, index: number, expectedRevision: number): Promise<StrictView> {
      return mutate(id, expectedRevision, (record, time) => {
        if (!Number.isInteger(index) || index < 0 || index >= 100) throw new Error('Geçersiz soru konumu.');
        if (index !== record.cursor) {
          const timing = record.timings[index];
          if (timing.firstViewedAt) timing.returnCount++;
          else timing.firstViewedAt = iso(time);
          record.cursor = index;
        }
      });
    },
    /** Call on visibilitychange/pagehide; false affects foreground measurement, never the deadline. */
    setForeground(id: string, foreground: boolean, expectedRevision: number): Promise<StrictView> {
      return mutate(id, expectedRevision, record => { if (typeof foreground !== 'boolean') throw new Error('Geçersiz görünürlük.'); record.foreground = foreground; });
    },
    async finish(id: string, expectedRevision: number): Promise<StrictView> {
      return transact(async tx => {
        const record = await load(tx, id), time = observe(record);
        if (record.status === 'active') { revision(record, expectedRevision); finishRecord(record, time, 'submitted'); }
        await persist(tx, record); return view(record, time);
      });
    },
    async getResult(id: string): Promise<StrictResult | null> {
      return transact(async tx => { const record = await load(tx, id); observe(record); await persist(tx, record); return record.status === 'completed' ? record.result : null; });
    },
    async listSummaries(): Promise<StrictSummary[]> {
      return transact(async tx => {
        // Only active records need full snapshots; the completed list uses lightweight summaries.
        const active = await request(tx.objectStore('attempts').index('status').getAll('active')) as StrictRecord[];
        for (const record of active) { observe(record); await persist(tx, record); }
        const rows = await request(tx.objectStore('summaries').getAll()) as StrictSummary[];
        return rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.id.localeCompare(a.id));
      });
    },
    /** Full user-requested backup includes local answer keys. Never expose it as exam feedback. */
    async exportData(): Promise<StrictJournal> {
      return transact(async tx => {
        const records = await request(tx.objectStore('attempts').getAll()) as StrictRecord[];
        for (const record of records) { observe(record); await persist(tx, record); }
        return { kind: 'gys-strict-journal', schemaVersion: 1, exportedAt: iso(now().ms), attempts: records };
      });
    },
    /** Merge only. Conflicting IDs/versions/revisions never overwrite existing results or answers. */
    async importData(raw: unknown): Promise<{ imported: number; totalAttempts: number }> {
      const data = validateStrictJournal(raw);
      return transact(async tx => {
        const existing = await request(tx.objectStore('attempts').getAll()) as StrictRecord[];
        const byId = new Map(existing.map(r => [r.id, r]));
        for (const record of data.attempts) {
          const prior = byId.get(record.id);
          if (prior && canonical(prior) !== canonical(record)) throw new Error('Deneme kimliği veya revizyonu çakışıyor; mevcut veri korunur.');
          byId.set(record.id, record);
        }
        // Validate the combined sequence, immutable definitions and cross-exam reservations before writing.
        const merged = validateStrictJournal({ ...data, attempts: [...byId.values()] });
        for (const record of merged.attempts) {
          const content = definitionContent(record);
          const old = await request(tx.objectStore('definitions').get(record.definitionKey)) as DefinitionRecord | undefined;
          if (old && old.content !== content) throw new Error('Değişmez deneme tanımı çakışıyor.');
          for (const key of reservationKeys(record)) {
            const reservation = await request(tx.objectStore('reservations').get(key)) as Reservation | undefined;
            if (reservation && reservation.ownerExamId !== record.definitionId) throw new Error('Korunan soru başka bir denemeye ayrılmış.');
            await request(tx.objectStore('reservations').put({ key, ownerExamId: record.definitionId } satisfies Reservation));
          }
          await request(tx.objectStore('definitions').put({ key: record.definitionKey, definitionId: record.definitionId, content } satisfies DefinitionRecord));
          observe(record);
          await persist(tx, record);
        }
        return { imported: merged.attempts.length - existing.length, totalAttempts: merged.attempts.length };
      });
    },
    async close(): Promise<void> { if (database) { (await database).close(); database = undefined; } },
  };
}
export type StrictStore = ReturnType<typeof createStrictStore>;
