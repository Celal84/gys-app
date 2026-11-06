import { validateJournalBackup, type JournalBackup } from './attempt-store';
// @ts-expect-error The preserved legacy JavaScript module has no declaration file.
import { prepareBackup } from './storage.js';

export const FULL_BACKUP_SCHEMA_VERSION = 1;
export const FULL_BACKUP_MAX_BYTES = 32 * 1024 * 1024;
export const FULL_BACKUP_DB_NAME = 'gys_full_workspace_v1';
export type BackupSection = 'learning' | 'strict' | 'planner' | 'focus';
export type SectionValidators = Partial<Record<BackupSection, (value: unknown) => unknown>>;
export interface LegacyWorkspace { schemaVersion: 1; state: Record<string, unknown>; questions: Record<string, unknown>[] }
export interface FullBackupPayload {
  legacyWorkspace: LegacyWorkspace;
  journal: JournalBackup;
  learning: unknown | null;
  strict: unknown | null;
  planner: unknown | null;
  focus: unknown | null;
}
export interface FullBackup {
  kind: 'gys-full-backup';
  schemaVersion: 1;
  exportedAt: string;
  integrity: { algorithm: 'SHA-256'; payloadHash: string };
  payload: FullBackupPayload;
}
export interface FullBackupInput {
  legacyWorkspace: unknown;
  journal: unknown;
  learning?: unknown;
  strict?: unknown;
  planner?: unknown;
  focus?: unknown;
}
export interface RestoreReview {
  studyAttempts: number;
  answeredQuestions: number;
  legacyQuestions: number;
  sections: BackupSection[];
  /** Existing snapshots are retained; restoring does not publish imported questions. */
  retainsOriginalProfiles: true;
}
export interface PreparedFullRestore {
  readonly profileId: string;
  readonly backup: FullBackup;
  readonly review: RestoreReview;
}
export interface CanonicalWorkspace {
  id: 'active';
  profileId: string;
  revision: number;
  committedAt: string;
  backup: FullBackup;
}
const sections: BackupSection[] = ['learning', 'strict', 'planner', 'focus'];
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
const prepared = new WeakMap<PreparedFullRestore, { profileId: string; backup: FullBackup }>();
const copy = <T>(value: T): T => structuredClone(value);

/** JSON only: reject prototypes, hidden properties and unsupported values before hashing. */
function safeJson(value: unknown, depth = 0, budget = { nodes: 0 }): void {
  if (++budget.nodes > 500000 || depth > 40) throw new Error('Yedek veri yapısı çok büyük veya çok derin.');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') {
    if (value.length > 500000) throw new Error('Yedekteki metin çok uzun.');
    return;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (!value || typeof value !== 'object') throw new Error('Yedek yalnız JSON değerleri içerebilir.');
  if (Array.isArray(value) && Object.keys(value).length !== value.length) throw new Error('Yedek listesinde boş veya ek alan olamaz.');
  if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error('Geçersiz yedek nesnesi.');
  if (Reflect.ownKeys(value).some(key => typeof key !== 'string')) throw new Error('Geçersiz yedek alanı.');
  for (const key of Object.keys(value)) {
    if (forbidden.has(key)) throw new Error('Güvensiz yedek alanı.');
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!Object.hasOwn(descriptor, 'value')) throw new Error('Yedekte hesaplanan alan kullanılamaz.');
    safeJson(descriptor.value, depth + 1, budget);
  }
}
function plain(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Yedek nesnesi bekleniyor.');
}
function exactKeys(value: Record<string, unknown>, expected: string[]): void {
  if (Object.keys(value).sort().join('|') !== [...expected].sort().join('|')) throw new Error('Eksik veya desteklenmeyen yedek alanı.');
}
function iso(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw new Error('Geçersiz yedek tarihi.');
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical((value as Record<string, unknown>)[key])).join(',') + '}';
  return JSON.stringify(value);
}
async function hash(value: unknown): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Güvenli yedek için HTTPS/localhost ve Web Crypto gereklidir.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function checkSize(value: unknown): void {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > FULL_BACKUP_MAX_BYTES) throw new Error('Yedek en fazla 32 MiB olabilir.');
}
function validatePayload(input: unknown, validators: SectionValidators, current?: FullBackupPayload): FullBackupPayload {
  safeJson(input); plain(input);
  exactKeys(input, ['legacyWorkspace', 'journal', ...sections]);
  const legacyWorkspace = prepareBackup(input.legacyWorkspace, current?.legacyWorkspace) as LegacyWorkspace;
  const journal = validateJournalBackup(input.journal);
  if (journal.attempts.filter(item => item.status === 'active').length > 1) throw new Error('Yedekte birden fazla aktif çalışma var.');
  if (current) {
    const existing = new Map(current.journal.attempts.map(item => [item.id, item]));
    for (const item of journal.attempts) {
      const old = existing.get(item.id);
      if (old && canonical(old) !== canonical(item)) throw new Error(`Çalışma kimliği çakışması: ${item.id}`);
    }
  }
  const payload: FullBackupPayload = { legacyWorkspace, journal, learning: null, strict: null, planner: null, focus: null };
  for (const section of sections) {
    const value = input[section];
    if (value !== null) {
      const validator = validators[section];
      if (!validator) throw new Error(`${section} verisi için uyumlu şema doğrulayıcısı gerekli.`);
      const validated = validator(copy(value));
      payload[section] = copy(validated === undefined ? value : validated);
      safeJson(payload[section]);
    }
  }
  return payload;
}

export async function createFullBackup(input: FullBackupInput, options: { validators?: SectionValidators; exportedAt?: string } = {}): Promise<FullBackup> {
  const exportedAt = options.exportedAt ?? new Date().toISOString(); iso(exportedAt);
  const payload = validatePayload({ legacyWorkspace: input.legacyWorkspace, journal: input.journal,
    learning: input.learning ?? null, strict: input.strict ?? null, planner: input.planner ?? null, focus: input.focus ?? null }, options.validators ?? {});
  checkSize(payload);
  const backup: FullBackup = { kind: 'gys-full-backup', schemaVersion: 1, exportedAt,
    integrity: { algorithm: 'SHA-256', payloadHash: await hash(payload) }, payload };
  checkSize(backup); return backup;
}

/** Validation and review only. No localStorage, IndexedDB or UI mutations occur. */
export async function validateFullBackup(input: unknown, options: { validators?: SectionValidators; current?: FullBackup } = {}): Promise<FullBackup> {
  if (typeof input === 'string') {
    if (new TextEncoder().encode(input).byteLength > FULL_BACKUP_MAX_BYTES) throw new Error('Yedek en fazla 32 MiB olabilir.');
    try { input = JSON.parse(input) as unknown; } catch { throw new Error('Geçerli bir JSON yedeği seçin. PDF geri yüklenemez.'); }
  }
  safeJson(input); checkSize(input); plain(input);
  exactKeys(input, ['kind', 'schemaVersion', 'exportedAt', 'integrity', 'payload']);
  if (input.kind !== 'gys-full-backup' || input.schemaVersion !== 1) throw new Error('Desteklenmeyen tam yedek türü veya sürümü.');
  iso(input.exportedAt); plain(input.integrity);
  exactKeys(input.integrity, ['algorithm', 'payloadHash']);
  if (input.integrity.algorithm !== 'SHA-256' || typeof input.integrity.payloadHash !== 'string' || !/^[a-f0-9]{64}$/.test(input.integrity.payloadHash)) throw new Error('Geçersiz yedek bütünlük kaydı.');
  if (await hash(input.payload) !== input.integrity.payloadHash) throw new Error('Yedek özeti eşleşmiyor; dosya bozulmuş veya değiştirilmiş.');
  const payload = validatePayload(input.payload, options.validators ?? {}, options.current?.payload);
  // Approval assertions imported through the legacy bank are always downgraded.
  return { kind: 'gys-full-backup', schemaVersion: 1, exportedAt: input.exportedAt,
    integrity: { algorithm: 'SHA-256', payloadHash: await hash(payload) }, payload };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
}
export async function prepareFullRestore(input: unknown, options: { validators?: SectionValidators; current?: FullBackup } = {}): Promise<PreparedFullRestore> {
  const backup = await validateFullBackup(input, options);
  const profileId = `restore_${crypto.randomUUID()}`;
  const result = deepFreeze({ profileId, backup: copy(backup), review: {
    studyAttempts: backup.payload.journal.attempts.length,
    answeredQuestions: backup.payload.journal.attempts.reduce((sum, item) => sum + item.answers.length, 0),
    legacyQuestions: backup.payload.legacyWorkspace.questions.length,
    sections: sections.filter(section => backup.payload[section] !== null), retainsOriginalProfiles: true as const } });
  prepared.set(result, { profileId, backup: copy(backup) });
  return result;
}

export class FullBackupConflictError extends Error {
  constructor() { super('Etkin profil başka bir sekmede değişti. Geri yüklemeyi yeniden inceleyin.'); this.name = 'FullBackupConflictError'; }
}

/**
 * Authoritative restore profile pointer + complete snapshot in one IndexedDB transaction.
 * Hydrate NEW profile-specific stores before commitPrepared; switch application adapters
 * only after it resolves. Existing localStorage/other DBs are never changed here.
 */
export function createFullBackupStore(dbName = FULL_BACKUP_DB_NAME) {
  let connection: Promise<IDBDatabase> | null = null;
  function open(): Promise<IDBDatabase> {
    if (!connection) connection = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB kullanılamıyor.')); return; }
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('workspaces', { keyPath: 'id' });
      request.onerror = () => { connection = null; reject(request.error ?? new Error('Yedek veritabanı açılamadı.')); };
      request.onblocked = () => { connection = null; reject(new Error('Yedek veritabanını kullanan eski sekmeyi kapatın.')); };
      request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); connection = null; }; resolve(request.result); };
    });
    return connection;
  }
  async function readActive(): Promise<CanonicalWorkspace | null> {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('workspaces', 'readonly'); const request = tx.objectStore('workspaces').get('active');
      let value: CanonicalWorkspace | null = null;
      request.onsuccess = () => { value = request.result ? copy(request.result as CanonicalWorkspace) : null; };
      tx.oncomplete = () => resolve(value); tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Etkin profil okunamadı.'));
    });
  }
  async function commitPrepared(proposal: PreparedFullRestore, options: { approved: boolean; expectedRevision: number }): Promise<CanonicalWorkspace> {
    const candidate = prepared.get(proposal);
    if (!candidate) throw new Error('Önce yedeği doğrulayın ve geri yükleme önerisi hazırlayın.');
    if (options.approved !== true) throw new Error('Geri yükleme için kullanıcının açık onayı gerekli.');
    if (!Number.isSafeInteger(options.expectedRevision) || options.expectedRevision < 0) throw new Error('Geçersiz etkin profil sürümü.');
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('workspaces', 'readwrite'); const records = tx.objectStore('workspaces'); const request = records.get('active');
      let failure: Error | null = null; let next: CanonicalWorkspace;
      request.onsuccess = () => {
        try {
          const current = request.result as CanonicalWorkspace | undefined;
          if ((current?.revision ?? 0) !== options.expectedRevision) throw new FullBackupConflictError();
          next = { id: 'active', profileId: candidate.profileId, revision: options.expectedRevision + 1,
            committedAt: new Date().toISOString(), backup: copy(candidate.backup) };
          if (current) records.put({ ...current, id: `revision:${current.revision}` });
          records.put(next);
        } catch (error) { failure = error instanceof Error ? error : new Error('Profil kaydı başarısız.'); tx.abort(); }
      };
      tx.oncomplete = () => { prepared.delete(proposal); resolve(copy(next)); };
      tx.onabort = tx.onerror = () => reject(failure ?? tx.error ?? new Error('Geri yükleme kaydedilemedi; etkin profil korunuyor.'));
    });
  }
  async function close(): Promise<void> { if (connection) { const db = await connection; db.close(); connection = null; } }
  return { readActive, commitPrepared, close };
}
export type FullBackupStore = ReturnType<typeof createFullBackupStore>;
