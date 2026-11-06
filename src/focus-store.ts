/** Local-only focus journal. It never reads or rewrites legacy progress or study answers. */
export const FOCUS_DB_NAME = 'gys_focus_v1';
export const MAX_FOREGROUND_GAP_MS = 15_000;
export interface FocusSettings { workMinutes: number; breakMinutes: number }
export const DEFAULT_FOCUS_SETTINGS: Readonly<FocusSettings> = Object.freeze({ workMinutes: 25, breakMinutes: 5 });
export interface FocusSession {
  id: string; revision: number; phase: 'work' | 'break';
  status: 'running' | 'paused' | 'awaiting-confirmation' | 'completed';
  workMinutes: number; breakMinutes: number; phaseActiveMs: number;
  workActiveMs: number; breakActiveMs: number; wallElapsedMs: number;
  startedAt: string; updatedAt: string; lastTickAt: string; completedAt: string | null;
  visible: boolean; gapCount: number; breakSkipped: boolean;
}
export interface FocusJournal { schemaVersion: 1; settings: FocusSettings; sessions: FocusSession[] }
interface FocusState extends FocusJournal { id: 'main' }
export interface FocusTick { now?: Date; visible: boolean }

export function validateFocusSettings(value: unknown): asserts value is FocusSettings {
  if (!value || typeof value !== 'object') throw new Error('Odak ayarları geçersiz.');
  const s = value as FocusSettings;
  if (!Number.isInteger(s.workMinutes) || s.workMinutes < 1 || s.workMinutes > 180
    || !Number.isInteger(s.breakMinutes) || s.breakMinutes < 1 || s.breakMinutes > 60) {
    throw new Error('Çalışma 1–180, mola 1–60 tam dakika olmalı.');
  }
}
const isTime = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const finiteNonNegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export function validateFocusJournal(value: unknown): asserts value is FocusJournal {
  if (!value || typeof value !== 'object') throw new Error('Odak yedeği geçersiz.');
  const journal = value as FocusJournal;
  if (journal.schemaVersion !== 1 || !Array.isArray(journal.sessions) || journal.sessions.length > 100_000) throw new Error('Odak yedek şeması geçersiz.');
  validateFocusSettings(journal.settings);
  const ids = new Set<string>();
  let active = 0;
  for (const session of journal.sessions) {
    if (!session || typeof session.id !== 'string' || !session.id.trim() || session.id.length > 160 || ids.has(session.id)) throw new Error('Odak oturum kimliği geçersiz veya yinelenmiş.');
    ids.add(session.id);
    validateFocusSettings(session);
    if (!Number.isInteger(session.revision) || session.revision < 0 || !['work', 'break'].includes(session.phase)
      || !['running', 'paused', 'awaiting-confirmation', 'completed'].includes(session.status)
      || ![session.phaseActiveMs, session.workActiveMs, session.breakActiveMs, session.wallElapsedMs].every(finiteNonNegative)
      || typeof session.visible !== 'boolean' || typeof session.breakSkipped !== 'boolean'
      || !Number.isInteger(session.gapCount) || session.gapCount < 0
      || !isTime(session.startedAt) || !isTime(session.updatedAt) || !isTime(session.lastTickAt)
      || Date.parse(session.updatedAt) < Date.parse(session.startedAt) || Date.parse(session.lastTickAt) < Date.parse(session.startedAt)
      || (session.completedAt !== null && (!isTime(session.completedAt) || Date.parse(session.completedAt) < Date.parse(session.startedAt)))
      || session.workActiveMs > session.workMinutes * 60_000 || session.breakActiveMs > session.breakMinutes * 60_000
      || session.phaseActiveMs !== (session.phase === 'work' ? session.workActiveMs : session.breakActiveMs)
      || session.wallElapsedMs < session.workActiveMs + session.breakActiveMs
      || (session.status === 'completed') !== (session.completedAt !== null)
      || session.phase === 'break' && session.workActiveMs !== session.workMinutes * 60_000
      || session.status === 'completed' && (session.workActiveMs !== session.workMinutes * 60_000
        || (!session.breakSkipped && session.breakActiveMs !== session.breakMinutes * 60_000))
      || session.breakSkipped && session.status !== 'completed'
      || session.status === 'awaiting-confirmation' && session.phaseActiveMs !== (session.phase === 'work' ? session.workMinutes : session.breakMinutes) * 60_000) {
      throw new Error(`Odak oturumu tutarsız: ${session.id}`);
    }
    if (session.status !== 'completed') active++;
  }
  if (active > 1) throw new Error('Birden fazla etkin odak oturumu var.');
}
function timestamp(now: Date | undefined): string {
  const date = now ?? new Date();
  if (!Number.isFinite(date.getTime())) throw new Error('Geçerli saat gerekli.');
  return date.toISOString();
}
/** A long callback gap never proves foreground activity, even when a browser resumes as visible. */
export function advanceFocus(session: FocusSession, tick: FocusTick): FocusSession {
  const now = timestamp(tick.now);
  if (Date.parse(now) < Date.parse(session.lastTickAt)) throw new Error('Cihaz saati geriye gitti; odak sayacı güncellenmedi.');
  if (session.status === 'completed') return { ...session };
  const elapsed = Date.parse(now) - Date.parse(session.lastTickAt);
  const next = { ...session, revision: session.revision + 1, updatedAt: now, lastTickAt: now,
    visible: tick.visible, wallElapsedMs: session.wallElapsedMs + elapsed };
  if (session.status === 'running') {
    if (session.visible && elapsed <= MAX_FOREGROUND_GAP_MS) {
      const limit = (session.phase === 'work' ? session.workMinutes : session.breakMinutes) * 60_000;
      next.phaseActiveMs = Math.min(limit, session.phaseActiveMs + elapsed);
      if (session.phase === 'work') next.workActiveMs = next.phaseActiveMs;
      else next.breakActiveMs = next.phaseActiveMs;
      if (next.phaseActiveMs >= limit) next.status = 'awaiting-confirmation';
    } else if (elapsed > MAX_FOREGROUND_GAP_MS) next.gapCount++;
  }
  return next;
}

export function createFocusStore(options: { indexedDB?: IDBFactory; dbName?: string } = {}) {
  const factory = options.indexedDB ?? globalThis.indexedDB;
  const databaseName = options.dbName ?? FOCUS_DB_NAME;
  let connection: Promise<IDBDatabase> | null = null;
  const db = () => {
    if (!factory) throw new Error('Bu tarayıcıda IndexedDB yok; odak oturumu kalıcı saklanamıyor.');
    connection ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('journal', { keyPath: 'id' });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    });
    return connection;
  };
  async function transaction<T>(write: boolean, callback: (state: FocusState) => T): Promise<T> {
    const database = await db();
    return new Promise<T>((resolve, reject) => {
      const tx = database.transaction('journal', write ? 'readwrite' : 'readonly');
      const store = tx.objectStore('journal');
      const request = store.get('main');
      let result: T;
      let error: unknown;
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(error ?? tx.error);
      tx.onabort = () => reject(error ?? tx.error ?? new Error('Odak kaydı tamamlanamadı.'));
      request.onsuccess = () => {
        try {
          const state: FocusState = request.result ?? { id: 'main', schemaVersion: 1, settings: { ...DEFAULT_FOCUS_SETTINGS }, sessions: [] };
          validateFocusJournal(state);
          result = callback(state);
          if (write) { validateFocusJournal(state); store.put(state); }
        } catch (caught) { error = caught; tx.abort(); }
      };
    });
  }
  const activeSession = (state: FocusState) => state.sessions.find(session => session.status !== 'completed');
  async function updateActive(tick: FocusTick, transform: (session: FocusSession) => FocusSession): Promise<FocusSession> {
    return transaction(true, state => {
      const active = activeSession(state);
      if (!active) throw new Error('Etkin odak oturumu yok.');
      const next = transform(advanceFocus(active, tick));
      state.sessions[state.sessions.indexOf(active)] = next;
      return structuredClone(next);
    });
  }
  const exportData = () => transaction(false, state => structuredClone({ schemaVersion: 1 as const, settings: state.settings, sessions: state.sessions }));
  const importData = async (data: unknown) => {
    validateFocusJournal(data);
    const incoming = structuredClone(data);
    return transaction(true, state => {
      if (state.sessions.length && JSON.stringify(state.settings) !== JSON.stringify(incoming.settings)) throw new Error('Odak ayarları çakışıyor; mevcut ayarlar korunuyor.');
      for (const session of incoming.sessions) {
        const existing = state.sessions.find(s => s.id === session.id);
        const safelyPaused = session.status === 'running' ? { ...session, status: 'paused', visible: false, revision: session.revision + 1 } : session;
        if (existing && JSON.stringify(existing) !== JSON.stringify(session) && JSON.stringify(existing) !== JSON.stringify(safelyPaused)) throw new Error(`Odak oturumu çakışıyor: ${session.id}`);
      }
      const additions = incoming.sessions.filter(s => !state.sessions.some(existing => existing.id === s.id));
      // Never resume an imported timer invisibly. A user must explicitly resume it.
      const imported = additions.map(s => s.status === 'running' ? { ...s, status: 'paused' as const, visible: false, revision: s.revision + 1 } : s);
      if (activeSession(state) && imported.some(s => s.status !== 'completed')) throw new Error('Etkin odak oturumları çakışıyor.');
      if (!state.sessions.length) state.settings = incoming.settings;
      state.sessions.push(...imported);
      return { added: imported.length };
    });
  };
  return {
    getSettings: () => transaction(false, state => ({ ...state.settings })),
    setSettings: async (settings: FocusSettings) => {
      validateFocusSettings(settings);
      return transaction(true, state => { state.settings = { workMinutes: settings.workMinutes, breakMinutes: settings.breakMinutes }; return { ...state.settings }; });
    },
    getActive: () => transaction(false, state => structuredClone(activeSession(state) ?? null)),
    start: (input: { id?: string; now?: Date; visible?: boolean } = {}) => transaction(true, state => {
      if (activeSession(state)) throw new Error('Önce etkin odak oturumunu tamamlayın.');
      const now = timestamp(input.now);
      const id = input.id ?? globalThis.crypto.randomUUID();
      if (state.sessions.some(s => s.id === id)) throw new Error('Odak oturum kimliği zaten var.');
      const session: FocusSession = { id, revision: 0, phase: 'work', status: 'running', ...state.settings,
        phaseActiveMs: 0, workActiveMs: 0, breakActiveMs: 0, wallElapsedMs: 0, startedAt: now, updatedAt: now,
        lastTickAt: now, completedAt: null, visible: input.visible ?? true, gapCount: 0, breakSkipped: false };
      state.sessions.push(session);
      return structuredClone(session);
    }),
    tick: (tick: FocusTick) => updateActive(tick, session => session),
    pause: (tick: FocusTick) => updateActive(tick, session => {
      if (session.status === 'running') session.status = 'paused';
      return session;
    }),
    resume: (tick: FocusTick) => updateActive(tick, session => {
      if (session.status !== 'paused') throw new Error('Yalnız duraklatılmış oturum sürdürülebilir.');
      session.status = 'running'; return session;
    }),
    confirmPhase: (tick: FocusTick & { skipBreak?: boolean }) => updateActive(tick, session => {
      if (!tick.visible || session.status !== 'awaiting-confirmation') throw new Error('Ölçülen süre dolunca görünür ekranda onaylayın.');
      if (session.phase === 'work' && !tick.skipBreak) {
        session.phase = 'break'; session.phaseActiveMs = session.breakActiveMs; session.status = 'running';
      } else {
        session.status = 'completed'; session.completedAt = session.updatedAt; session.breakSkipped = session.phase === 'work';
      }
      return session;
    }),
    listSessions: () => transaction(false, state => structuredClone(state.sessions)),
    exportData, importData, exportJournal: exportData, importJournal: importData,
    close: async () => { if (connection) (await connection).close(); connection = null; },
  };
}
