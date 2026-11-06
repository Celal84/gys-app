export const WORKSPACE_KEY = 'gys_v4_workspace_v1';
export const ROLLBACK_KEY = 'gys_v4_workspace_rollback_v1';

const LEGACY_STATE_KEY = 'gys_duo_state_v1';
const LEGACY_QUESTIONS_KEY = 'gys_duo_questions_v1';
const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
const quizSizes = new Set([5, 10, 15, 20, 25, 50, 100]);

function fail(message) { throw new Error(message); }
function plain(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(`${name}: nesne bekleniyor.`);
}
function safeTree(value, depth = 0) {
  if (depth > 20) fail('Veri yapısı çok derin.');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('Sonlu sayı bekleniyor.');
    return;
  }
  if (Array.isArray(value)) { value.forEach(item => safeTree(item, depth + 1)); return; }
  plain(value, 'Veri');
  for (const [key, item] of Object.entries(value)) {
    if (forbidden.has(key)) fail('Güvensiz alan adı.');
    safeTree(item, depth + 1);
  }
}
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function integer(value, name, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) fail(`${name}: geçersiz sayı.`);
}
function text(value, name, maximum, allowEmpty = false) {
  if (typeof value !== 'string' || value.length > maximum || (!allowEmpty && !value.trim())) fail(`${name}: geçersiz metin.`);
}
function safeId(id) {
  if (typeof id === 'number') { integer(id, 'Soru kimliği'); if (id === 0) fail('Soru kimliği sıfır olamaz.'); return; }
  text(id, 'Soru kimliği', 160);
  if (forbidden.has(id) || !/^[\p{L}\p{N}_.:-]+$/u.test(id)) fail('Güvensiz soru kimliği.');
}

/** Imported approval assertions are never trusted. Originals remain in legacy storage. */
export function validateQuestions(input) {
  if (!Array.isArray(input) || input.length > 10000) fail('Soru listesi en fazla 10.000 kayıt içermelidir.');
  safeTree(input);
  const seen = new Set();
  return input.map(question => {
    plain(question, 'Soru');
    safeId(question.id);
    const identity = String(question.id);
    if (seen.has(identity)) fail(`Tekrarlanan soru kimliği: ${identity}`);
    seen.add(identity);
    text(question.q, 'Soru metni', 20000);
    text(question.topic, 'Konu', 1000);
    text(question.cat, 'Kategori', 200);
    if (!Number.isFinite(question.weight) || question.weight <= 0 || question.weight > 100) fail('Geçersiz soru ağırlığı.');
    if (!Array.isArray(question.opts) || question.opts.length !== 5) fail('Soru beş seçenek içermelidir.');
    question.opts.forEach(option => text(option, 'Seçenek', 10000));
    if (new Set(question.opts.map(option => option.trim().toLocaleLowerCase('tr-TR'))).size !== 5) fail('Seçenekler farklı olmalıdır.');
    integer(question.ans, 'Cevap', 4);
    text(question.exp, 'Açıklama', 30000, true);
    return { ...copy(question), verificationStatus: 'ValidationPending' };
  });
}

export function validateState(input) {
  plain(input, 'İlerleme');
  safeTree(input);
  for (const key of ['xp', 'dailyXP', 'streak', 'hearts', 'totalAnswered', 'totalCorrect']) integer(input[key], key);
  if (input.totalCorrect > input.totalAnswered) fail('Doğru sayısı cevaplanan soruyu aşamaz.');
  if (input.lastActiveDate !== null) {
    text(input.lastActiveDate, 'Son çalışma tarihi', 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.lastActiveDate)
      || Number.isNaN(Date.parse(input.lastActiveDate))
      || new Date(input.lastActiveDate).toISOString().slice(0, 10) !== input.lastActiveDate) fail('Geçersiz çalışma tarihi.');
  }
  plain(input.settings, 'Ayarlar');
  if (!quizSizes.has(input.settings.quizSize)) fail('Geçersiz çalışma paketi.');
  integer(input.settings.dailyGoal, 'Günlük hedef', 100000);
  if (input.settings.dailyGoal === 0) fail('Günlük hedef pozitif olmalıdır.');
  for (const key of ['mixMistakes', 'examMode', 'sound']) {
    if (typeof input.settings[key] !== 'boolean') fail(`Geçersiz ayar: ${key}`);
  }
  plain(input.topicStats, 'Konu istatistikleri');
  for (const value of Object.values(input.topicStats)) {
    plain(value, 'Konu istatistiği');
    integer(value.answered, 'Konu cevap sayısı');
    integer(value.correct, 'Konu doğru sayısı');
    if (value.correct > value.answered) fail('Konu doğru sayısı cevap sayısını aşamaz.');
  }
  plain(input.mistakes, 'Yanlış defteri');
  for (const [id, value] of Object.entries(input.mistakes)) {
    safeId(id); plain(value, 'Yanlış kaydı');
    integer(value.wrongCount, 'Yanlış sayısı');
    integer(value.streak, 'Tekrar serisi');
    integer(value.lastWrong, 'Yanlış zamanı', 8640000000000000);
  }
  plain(input.customWeights, 'Eski özel ağırlıklar');
  for (const value of Object.values(input.customWeights)) {
    if (!Number.isFinite(value) || value <= 0 || value > 100) fail('Geçersiz eski ağırlık.');
  }
  return copy(input);
}

function envelope(input) {
  plain(input, 'Yedek'); safeTree(input);
  if (input.schemaVersion !== undefined && input.schemaVersion !== 1) fail('Desteklenmeyen yedek sürümü.');
  return { schemaVersion: 1, state: validateState(input.state), questions: validateQuestions(input.questions) };
}

/** No writes, including when stored JSON is damaged. error must be surfaced before saving. */
export function readWorkspace(storage, defaults) {
  const errors = [];
  try {
    const saved = storage.getItem(WORKSPACE_KEY);
    if (saved !== null) {
      try { return envelope(JSON.parse(saved)); }
      catch (error) { errors.push(`Yeni kayıt okunamadı: ${error.message}`); }
    }
    let state = validateState(defaults);
    const legacy = storage.getItem(LEGACY_STATE_KEY);
    if (legacy !== null) {
      try {
        const parsed = JSON.parse(legacy); safeTree(parsed); plain(parsed, 'Eski ilerleme');
        state = validateState({ ...defaults, ...parsed, settings: { ...defaults.settings, ...parsed.settings } });
      } catch (error) { errors.push(`Eski ilerleme okunamadı: ${error.message}`); }
    }
    let questions = null;
    const legacyQuestions = storage.getItem(LEGACY_QUESTIONS_KEY);
    if (legacyQuestions !== null) {
      try { questions = validateQuestions(JSON.parse(legacyQuestions)); }
      catch (error) { errors.push(`Eski sorular okunamadı: ${error.message}`); }
    }
    return { state, questions, ...(errors.length ? { error: errors.join(' ') } : {}) };
  } catch (error) {
    return { state: validateState(defaults), questions: null, error: `Yerel kayıt erişilemedi: ${error.message}` };
  }
}

export function saveWorkspace(storage, state, questions) {
  const normalized = envelope({ schemaVersion: 1, state, questions });
  storage.setItem(WORKSPACE_KEY, JSON.stringify(normalized));
  return normalized;
}

function questionFingerprint(question) {
  return JSON.stringify([question.topic, question.cat, question.q, question.opts, question.ans, question.exp, question.weight]);
}

/** Validate a restore proposal without reading/writing storage or changing UI state. */
export function prepareBackup(input, currentEnvelope) {
  const candidate = envelope(typeof input === 'string' ? JSON.parse(input) : input);
  const current = currentEnvelope ? envelope(currentEnvelope) : null;
  const existing = new Map((current?.questions || []).map(question => [String(question.id), question]));
  for (const question of candidate.questions) {
    const old = existing.get(String(question.id));
    if (old && questionFingerprint(old) !== questionFingerprint(question)) fail(`Soru kimliği çakışması: ${question.id}`);
  }
  return candidate;
}

/** Call only after the user confirms replacing progress. Never writes legacy keys. */
export function restoreBackup(storage, input, currentEnvelope) {
  const candidate = prepareBackup(input, currentEnvelope);
  const previous = storage.getItem(WORKSPACE_KEY);
  if (previous !== null) storage.setItem(ROLLBACK_KEY, previous);
  storage.setItem(WORKSPACE_KEY, JSON.stringify(candidate));
  return candidate;
}
