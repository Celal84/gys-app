import { isAvailableFor, type Question, type SourceSnapshot } from './core/content';
import { ERROR_REASONS, FLASHCARD_TYPES, conceptRecommendations, initialSchedule, isoDate, reviewSm2, validateSchedule,
  type ErrorReason, type FlashcardType, type LearningError, type ReviewSchedule } from './core/learning';

export const LEARNING_DB_NAME = 'gys_learning_v1';
export interface LearningCard {
  id: string;
  questionId: string;
  questionVersion: number;
  topicId: string;
  learningObjectiveId: string;
  type: FlashcardType;
  front: string;
  back: string;
  explanation: string;
  sourcePool: 'B' | 'C';
  source: { snapshotId: string; contentHash: string; url: string; locator: string; legalProvisionId: string; legalEdition: 'preparation' | 'exam' };
  /** A question-as-card, never an unreviewed extraction of a purported legal rule. */
  format: 'verified-question';
  available: boolean;
  schedule: ReviewSchedule;
  revision: number;
}
export interface CardReview { id: string; cardId: string; revision: number; quality: number; reviewedAt: string; schedule: ReviewSchedule }
export interface RegisterCardsInput {
  questions: readonly Question[];
  snapshots: readonly SourceSnapshot[];
  completedExamIds?: ReadonlySet<string>;
  /** Explicit accepted usage rights, independent of historical source/scope acceptance. */
  historicalRightsAcceptedIds?: ReadonlySet<string>;
}
export interface RecordErrorInput {
  id?: string; questionId: string; questionVersion: number; topicId: string; occurredAt?: string;
  userReason?: ErrorReason | null; inferredReason?: LearningError['inferredReason'];
  conceptId?: string | null; relatedConceptId?: string | null; confidence?: number | null; activeTimeMs?: number | null; strictMode?: boolean;
}
export interface LearningBackup { kind: 'gys-learning'; schemaVersion: 1; exportedAt: string; cards: LearningCard[]; reviews: CardReview[]; errors: LearningError[] }
export class LearningConflictError extends Error {
  constructor() { super('Öğrenme kaydı başka bir sekmede değişti veya yedekle çakışıyor. Mevcut veri korundu.'); this.name = 'LearningConflictError'; }
}
const clone = <T>(value: T): T => structuredClone(value);
const stable = (value: unknown): string => {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stable((value as Record<string, unknown>)[key])).join(',') + '}';
  return JSON.stringify(value);
};
function identity(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length > 200 || !/^[a-zA-Z0-9_.:-]+$/.test(value) || ['__proto__', 'constructor', 'prototype'].includes(value)) throw new Error('Geçersiz öğrenme kimliği.');
}
function text(value: unknown, max = 30000): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('Geçersiz öğrenme metni.');
}
function date(value: unknown): asserts value is string {
  if (typeof value !== 'string' || isoDate(value) !== value) throw new Error('Geçersiz öğrenme tarihi.');
}
function revision(value: number): void { if (!Number.isSafeInteger(value) || value < 0) throw new Error('Geçersiz öğrenme sürümü.'); }
function validReason(value: unknown): boolean { return typeof value === 'string' && Object.hasOwn(ERROR_REASONS, value); }
function validateError(error: LearningError): void {
  if (!error || typeof error !== 'object') throw new Error('Geçersiz hata kaydı.');
  identity(error.id); identity(error.questionId); date(error.occurredAt);
  if (!Number.isSafeInteger(error.questionVersion) || error.questionVersion < 1 || !/^(O(0[1-9]|1[0-6])|T0[1-8])$/.test(error.topicId)) throw new Error('Geçersiz hata soru sürümü/konusu.');
  if (error.userReason !== null && !validReason(error.userReason)) throw new Error('Geçersiz kullanıcı hata nedeni.');
  if (error.inferredReason !== null) {
    if (!error.inferredReason || !validReason(error.inferredReason.reason) || !Number.isFinite(error.inferredReason.confidence) || error.inferredReason.confidence < 0 || error.inferredReason.confidence > 1) throw new Error('Geçersiz tahmini hata nedeni.');
    text(error.inferredReason.method, 300);
  }
  if (error.conceptId !== null) identity(error.conceptId);
  if (error.relatedConceptId !== null) identity(error.relatedConceptId);
  if (error.confidence !== null && (!Number.isFinite(error.confidence) || error.confidence < 0 || error.confidence > 1)) throw new Error('Geçersiz cevap güveni.');
  if (error.activeTimeMs !== null && (!Number.isFinite(error.activeTimeMs) || error.activeTimeMs < 0 || error.activeTimeMs > 86_400_000)) throw new Error('Geçersiz ön plan cevap süresi.');
}
function contentIdentity(card: LearningCard): string {
  return stable({ id: card.id, questionId: card.questionId, questionVersion: card.questionVersion, topicId: card.topicId,
    learningObjectiveId: card.learningObjectiveId, type: card.type, front: card.front, back: card.back, explanation: card.explanation,
    sourcePool: card.sourcePool, source: card.source, format: card.format });
}
function cardFrom(question: Question, snapshot: SourceSnapshot, now: string): LearningCard {
  identity(question.id); identity(question.learningObjectiveId); identity(snapshot.id);
  return { id: `CARD:${question.id}:v${question.version}`, questionId: question.id, questionVersion: question.version,
    topicId: question.topicId, learningObjectiveId: question.learningObjectiveId, type: 'concept', front: question.text,
    back: question.options.find(option => option.id === question.correctOptionId)!.text, explanation: question.explanation,
    sourcePool: question.sourcePool as 'B' | 'C', format: 'verified-question', available: true,
    source: { snapshotId: snapshot.id, contentHash: snapshot.contentHash, url: snapshot.sourceUrl, locator: question.sourceLocator,
      legalProvisionId: question.legalProvisionId, legalEdition: snapshot.legalEdition }, schedule: initialSchedule(now), revision: 0 };
}

export function validateLearningBackup(value: unknown): LearningBackup {
  if (!value || typeof value !== 'object') throw new Error('Geçersiz öğrenme yedeği.');
  const backup = clone(value) as LearningBackup;
  if (backup.kind !== 'gys-learning' || backup.schemaVersion !== 1 || !Array.isArray(backup.cards) || !Array.isArray(backup.reviews) || !Array.isArray(backup.errors)
    || backup.cards.length > 20000 || backup.reviews.length > 200000 || backup.errors.length > 200000) throw new Error('Desteklenmeyen öğrenme yedeği.');
  date(backup.exportedAt);
  const ids = new Set<string>();
  for (const card of backup.cards) {
    if (!card || typeof card !== 'object') throw new Error('Geçersiz kart yedeği.');
    identity(card.id); identity(card.questionId); revision(card.revision); validateSchedule(card.schedule);
    identity(card.learningObjectiveId);
    text(card.front); text(card.back); text(card.explanation);
    if (ids.has(card.id) || card.revision !== card.schedule.totalReviews || !['B', 'C'].includes(card.sourcePool)
      || !Number.isSafeInteger(card.questionVersion) || card.questionVersion < 1 || card.id !== `CARD:${card.questionId}:v${card.questionVersion}`
      || !/^(O(0[1-9]|1[0-6])|T0[1-8])$/.test(card.topicId) || !FLASHCARD_TYPES.includes(card.type)
      || card.format !== 'verified-question' || typeof card.available !== 'boolean' || !card.source
      || !/^[a-f0-9]{64}$/i.test(card.source.contentHash) || !['preparation', 'exam'].includes(card.source.legalEdition)) throw new Error('Geçersiz kart yedeği.');
    identity(card.source.snapshotId); text(card.source.locator, 2000); text(card.source.legalProvisionId, 2000);
    text(card.source.url, 5000);
    if (!/^https?:\/\//i.test(card.source.url)) throw new Error('Geçersiz kart kaynak bağlantısı.');
    ids.add(card.id);
  }
  ids.clear(); const reviewGroups = new Map<string, CardReview[]>();
  for (const review of backup.reviews) {
    if (!review || typeof review !== 'object') throw new Error('Geçersiz tekrar yedeği.');
    identity(review.id); identity(review.cardId); revision(review.revision); date(review.reviewedAt); validateSchedule(review.schedule);
    if (ids.has(review.id) || !Number.isInteger(review.quality) || review.quality < 0 || review.quality > 5 || review.revision < 1 || review.id !== `${review.cardId}:r${review.revision}`) throw new Error('Geçersiz tekrar yedeği.');
    ids.add(review.id); const group = reviewGroups.get(review.cardId) ?? []; group.push(review); reviewGroups.set(review.cardId, group);
  }
  for (const card of backup.cards) {
    const reviews = (reviewGroups.get(card.id) ?? []).sort((a, b) => a.revision - b.revision);
    if (reviews.length !== card.revision) throw new Error('Kart değerlendirme geçmişi eksik.');
    let schedule = initialSchedule(card.schedule.lastReviewedAt ?? card.schedule.dueAt);
    for (const [i, review] of reviews.entries()) {
      schedule = reviewSm2(schedule, review.quality, review.reviewedAt);
      if (review.revision !== i + 1 || stable(review.schedule) !== stable(schedule)) throw new Error('Tekrar planı hesapla eşleşmiyor.');
    }
    if (stable(schedule) !== stable(card.schedule)) throw new Error('Kartın son planı tutarsız.');
    reviewGroups.delete(card.id);
  }
  if (reviewGroups.size) throw new Error('Tekrarın kaynak kartı eksik.');
  ids.clear();
  for (const error of backup.errors) { validateError(error); if (ids.has(error.id)) throw new Error('Yinelenen hata kimliği.'); ids.add(error.id); }
  return backup;
}

export function createLearningStore(dbName = LEARNING_DB_NAME) {
  let connection: Promise<IDBDatabase> | null = null;
  const transactionGuards = new WeakMap<IDBTransaction, (callback: () => void) => void>();
  async function open(): Promise<IDBDatabase> {
    if (!connection) connection = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB kullanılamıyor.')); return; }
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('cards')) {
          const cards = db.createObjectStore('cards', { keyPath: 'id' });
          cards.createIndex('dueAt', 'schedule.dueAt');
        }
        if (!db.objectStoreNames.contains('reviews')) db.createObjectStore('reviews', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('errors')) db.createObjectStore('errors', { keyPath: 'id' });
      };
      request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); connection = null; }; resolve(request.result); };
      request.onerror = () => reject(request.error || new Error('Öğrenme veritabanı açılamadı.'));
      request.onblocked = () => reject(new Error('Öğrenme veritabanı başka sekmede açık.'));
    }).catch(error => { connection = null; throw error; });
    return connection;
  }
  async function transact<T>(stores: string[], mode: IDBTransactionMode, action: (tx: IDBTransaction, set: (value: T) => void) => void): Promise<T> {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(stores, mode); let result: T; let failure: unknown;
      // Request handlers must stay synchronous so every read/write belongs to this one transaction.
      const safe = (callback: () => void) => { try { callback(); } catch (error) { failure = error; tx.abort(); } };
      tx.oncomplete = () => resolve(clone(result));
      tx.onerror = () => reject(failure || tx.error || new Error('Öğrenme kaydı başarısız.'));
      tx.onabort = () => reject(failure || tx.error || new Error('Öğrenme kaydı iptal edildi.'));
      // All our handlers use guard so an exception aborts rather than leaving partial writes.
      transactionGuards.set(tx, safe);
      safe(() => action(tx, value => { result = value; }));
    });
  }
  const guard = (tx: IDBTransaction, callback: () => void) => transactionGuards.get(tx)!(callback);
  async function registerCards(input: RegisterCardsInput, now: string | Date = new Date()) {
    if (!Array.isArray(input.questions) || !Array.isArray(input.snapshots) || input.questions.length > 20000) throw new Error('Geçersiz kart kaynak paketi.');
    const at = isoDate(now); const snapshots = new Map(input.snapshots.map(snapshot => [snapshot.id, snapshot]));
    const seen = new Set<string>(); const submittedVersions = new Map<string, number>();
    const accepted: LearningCard[] = []; const skipped: { questionId: string; reason: string }[] = [];
    for (const question of input.questions) {
      identity(question.id);
      if (seen.has(question.id)) throw new Error('Kart kaynak paketinde yinelenen soru kimliği.');
      seen.add(question.id);
      submittedVersions.set(question.id, question.version);
      const snapshot = snapshots.get(question.sourceSnapshotId);
      const allowed = question.sourcePool === 'B' ? isAvailableFor(question, 'flashcards', { snapshot })
        : question.sourcePool === 'C' && input.historicalRightsAcceptedIds?.has(question.id) && isAvailableFor(question, 'historical', { snapshot });
      if (!allowed || !snapshot) { skipped.push({ questionId: question.id, reason: question.sourcePool === 'A' ? 'Korunan deneme havuzu kartlara aktarılmaz.' : 'Yayın kapısı veya tarihî kullanım hakkı onayı eksik.' }); continue; }
      accepted.push(cardFrom(question, snapshot, at));
    }
    return transact<{ registered: number; skipped: typeof skipped }>(['cards'], 'readwrite', (tx, set) => {
      const store = tx.objectStore('cards'); const request = store.getAll();
      request.onsuccess = () => guard(tx, () => {
        const existing = request.result as LearningCard[]; const incoming = new Map(accepted.map(card => [card.questionId, card]));
        for (const card of accepted) if (existing.some(old => old.questionId === card.questionId && old.available && old.questionVersion > card.questionVersion)) throw new LearningConflictError();
        for (const card of existing) if (seen.has(card.questionId)) {
          if (submittedVersions.get(card.questionId)! < card.questionVersion) continue;
          const replacement = incoming.get(card.questionId);
          if (replacement?.id === card.id && contentIdentity(replacement) !== contentIdentity(card)) throw new LearningConflictError();
          const available = replacement?.id === card.id;
          if (card.available !== available) store.put({ ...card, available });
        }
        for (const card of accepted) if (!existing.some(old => old.id === card.id)) store.add(card);
        set({ registered: accepted.length, skipped });
      });
    });
  }
  async function dueCards(now: string | Date = new Date(), limit = 100): Promise<LearningCard[]> {
    const at = isoDate(now);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) throw new Error('Geçersiz kart sınırı.');
    return transact<LearningCard[]>(['cards'], 'readonly', (tx, set) => {
      const request = tx.objectStore('cards').index('dueAt').openCursor(IDBKeyRange.upperBound(at)); const cards: LearningCard[] = [];
      request.onsuccess = () => guard(tx, () => {
        const cursor = request.result;
        if (!cursor || cards.length >= limit) { set(cards); return; }
        const card = cursor.value as LearningCard;
        if (card.available) cards.push(card);
        cursor.continue();
      });
    });
  }
  async function getCard(cardId: string): Promise<LearningCard | null> {
    identity(cardId);
    return transact<LearningCard | null>(['cards'], 'readonly', (tx, set) => {
      const request = tx.objectStore('cards').get(cardId);
      request.onsuccess = () => { const card = request.result as LearningCard | undefined; set(card?.available ? card : null); };
    });
  }
  async function reviewCard(cardId: string, quality: number, options: { expectedRevision: number; reviewedAt?: string; strictMode?: boolean }): Promise<LearningCard> {
    identity(cardId); revision(options.expectedRevision);
    if (options.strictMode) throw new Error('Strict Mode sırasında tekrar kartları kapalıdır.');
    const at = isoDate(options.reviewedAt ?? new Date());
    return transact<LearningCard>(['cards', 'reviews'], 'readwrite', (tx, set) => {
      const cards = tx.objectStore('cards'); const request = cards.get(cardId);
      request.onsuccess = () => guard(tx, () => {
        const card = request.result as LearningCard | undefined;
        if (!card?.available) throw new Error('Onaylı ve erişilebilir kart bulunamadı.');
        if (card.revision !== options.expectedRevision) throw new LearningConflictError();
        card.schedule = reviewSm2(card.schedule, quality, at); card.revision++;
        const review: CardReview = { id: `${card.id}:r${card.revision}`, cardId: card.id, revision: card.revision, quality, reviewedAt: at, schedule: clone(card.schedule) };
        cards.put(card); tx.objectStore('reviews').add(review); set(card);
      });
    });
  }
  async function recordError(input: RecordErrorInput): Promise<LearningError> {
    if (input.strictMode) throw new Error('Strict Mode sırasında hata analizi kapalıdır.');
    const event: LearningError = { id: input.id ?? `ERR:${crypto.randomUUID()}`, questionId: input.questionId, questionVersion: input.questionVersion,
      topicId: input.topicId, occurredAt: isoDate(input.occurredAt ?? new Date()), userReason: input.userReason ?? null,
      inferredReason: input.inferredReason ? clone(input.inferredReason) : null, conceptId: input.conceptId ?? null, relatedConceptId: input.relatedConceptId ?? null,
      confidence: input.confidence ?? null, activeTimeMs: input.activeTimeMs ?? null };
    validateError(event);
    return transact<LearningError>(['errors'], 'readwrite', (tx, set) => {
      const store = tx.objectStore('errors'); const request = store.get(event.id);
      request.onsuccess = () => guard(tx, () => {
        if (request.result && stable(request.result) !== stable(event)) throw new LearningConflictError();
        if (!request.result) store.add(event);
        set(event);
      });
    });
  }
  async function exportData(): Promise<LearningBackup> {
    return transact<LearningBackup>(['cards', 'reviews', 'errors'], 'readonly', (tx, set) => {
      const cards = tx.objectStore('cards').getAll(); const reviews = tx.objectStore('reviews').getAll(); const errors = tx.objectStore('errors').getAll();
      let remaining = 3;
      const finish = () => { if (--remaining === 0) set({ kind: 'gys-learning', schemaVersion: 1, exportedAt: new Date().toISOString(), cards: cards.result, reviews: reviews.result, errors: errors.result }); };
      cards.onsuccess = finish; reviews.onsuccess = finish; errors.onsuccess = finish;
    });
  }
  async function stats(now: string | Date = new Date()) {
    const at = isoDate(now);
    const data = await transact<{ totalCards: number; dueCards: number; reviewCount: number; errors: LearningError[] }>(['cards', 'reviews', 'errors'], 'readonly', (tx, set) => {
      // Count cards with a cursor rather than collecting the whole question-bearing card bank.
      const cursorRequest = tx.objectStore('cards').openCursor(); const reviews = tx.objectStore('reviews').count(); const errors = tx.objectStore('errors').getAll();
      let totalCards = 0; let dueCards = 0; let remaining = 3;
      const finish = () => { if (--remaining === 0) set({ totalCards, dueCards, reviewCount: reviews.result, errors: errors.result }); };
      cursorRequest.onsuccess = () => guard(tx, () => {
        const cursor = cursorRequest.result;
        if (!cursor) { finish(); return; }
        const card = cursor.value as LearningCard;
        if (card.available) { totalCards++; if (card.schedule.dueAt <= at) dueCards++; }
        cursor.continue();
      });
      reviews.onsuccess = finish; errors.onsuccess = finish;
    });
    const userReasons: Partial<Record<ErrorReason, number>> = {}; const inferredReasons: Partial<Record<ErrorReason, number>> = {};
    for (const error of data.errors) {
      if (error.userReason) userReasons[error.userReason] = (userReasons[error.userReason] ?? 0) + 1;
      if (error.inferredReason) inferredReasons[error.inferredReason.reason] = (inferredReasons[error.inferredReason.reason] ?? 0) + 1;
    }
    return { totalCards: data.totalCards, dueCards: data.dueCards,
      reviewCount: data.reviewCount, errorCount: data.errors.length, userReasons, inferredReasons,
      conceptRecommendations: conceptRecommendations(data.errors), mastery: null,
      notice: 'Kalite puanı ve kart tekrar sayısı tek başına öğrenme hâkimiyeti kanıtı değildir.' };
  }
  async function importData(value: unknown): Promise<{ cards: number; reviews: number; errors: number }> {
    const backup = validateLearningBackup(value);
    return transact<{ cards: number; reviews: number; errors: number }>(['cards', 'reviews', 'errors'], 'readwrite', (tx, set) => {
      const cardsRequest = tx.objectStore('cards').getAll(); const reviewsRequest = tx.objectStore('reviews').getAll(); const errorsRequest = tx.objectStore('errors').getAll();
      let remaining = 3;
      const finish = () => guard(tx, () => {
        if (--remaining !== 0) return;
        const existingCards = new Map((cardsRequest.result as LearningCard[]).map(card => [card.id, card]));
        const existingReviews = new Map((reviewsRequest.result as CardReview[]).map(review => [review.id, review]));
        const existingErrors = new Map((errorsRequest.result as LearningError[]).map(error => [error.id, error]));
        for (const incoming of backup.cards) {
          const existing = existingCards.get(incoming.id);
          // Unknown historical versions are retained but cannot manufacture publication approval.
          if (!existing) continue;
          if (contentIdentity(existing) !== contentIdentity(incoming)) throw new LearningConflictError();
          if (existing.revision !== 0 && (existing.revision !== incoming.revision || stable(existing.schedule) !== stable(incoming.schedule))) throw new LearningConflictError();
        }
        for (const incoming of backup.reviews) if (existingReviews.has(incoming.id) && stable(existingReviews.get(incoming.id)) !== stable(incoming)) throw new LearningConflictError();
        for (const incoming of backup.errors) if (existingErrors.has(incoming.id) && stable(existingErrors.get(incoming.id)) !== stable(incoming)) throw new LearningConflictError();
        for (const incoming of backup.cards) {
          const existing = existingCards.get(incoming.id);
          tx.objectStore('cards').put(existing ? { ...existing, schedule: incoming.schedule, revision: incoming.revision }
            : { ...incoming, available: false });
        }
        for (const incoming of backup.reviews) if (!existingReviews.has(incoming.id)) tx.objectStore('reviews').add(incoming);
        for (const incoming of backup.errors) if (!existingErrors.has(incoming.id)) tx.objectStore('errors').add(incoming);
        set({ cards: backup.cards.length, reviews: backup.reviews.length, errors: backup.errors.length });
      });
      cardsRequest.onsuccess = finish; reviewsRequest.onsuccess = finish; errorsRequest.onsuccess = finish;
    });
  }
  return { registerCards, dueCards, getCard, reviewCard, recordError, stats, exportData, importData,
    async close() { if (connection) (await connection).close(); connection = null; } };
}
export type LearningStore = ReturnType<typeof createLearningStore>;
