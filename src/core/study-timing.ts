/** Conservative page-local measurement. Wall elapsed time is never treated as active thinking time. */
export interface QuestionTiming {
  questionId: string;
  firstViewedAt: number;
  lastViewedAt: number;
  activeTimeMs: number;
  viewCount: number;
  returnCount: number;
  answerChanges: number;
  lastSelectedOptionId: string | null;
  unmeasuredGapCount: number;
  clockRollbackCount: number;
  finishedAt: number | null;
}
export interface StudyTimingSummary {
  questions: QuestionTiming[];
  currentQuestionId: string | null;
  visible: boolean;
  totalActiveTimeMs: number;
  unmeasuredGapCount: number;
  clockRollbackCount: number;
}
export interface StudyTimingOptions { now?: () => number; maxGapMs?: number }

function defaultClock(): number {
  // Epoch-shaped timestamps with monotonic deltas while this document remains alive.
  return typeof performance !== 'undefined' && Number.isFinite(performance.timeOrigin)
    ? performance.timeOrigin + performance.now()
    : Date.now();
}
function validId(questionId: string): void {
  if (typeof questionId !== 'string' || !questionId.trim() || questionId.length > 500) throw new Error('Soru kimliği geçersiz.');
}

/**
 * Call view only while an answerable question is displayed, tick about every second,
 * setVisible on visibilitychange/pagehide, and finish before showing the solution.
 * No previous-page duration is reconstructed after reload.
 */
export function createStudyTimingTracker({ now = defaultClock, maxGapMs = 15_000 }: StudyTimingOptions = {}) {
  if (!Number.isFinite(maxGapMs) || maxGapMs <= 0 || maxGapMs > 15_000) throw new Error('Ölçüm aralığı 0–15000 ms arasında olmalıdır.');
  const rows = new Map<string, QuestionTiming>();
  const selectedOnce = new Set<string>();
  let currentId: string | null = null;
  let visible = true;
  let lastTick: number | null = null;
  let gaps = 0;
  let rollbacks = 0;
  function readClock(): number {
    const value = now();
    if (!Number.isFinite(value) || value < 0) throw new Error('Ölçüm saati geçersiz.');
    return value;
  }
  function advance(nextVisible = visible): number {
    if (typeof nextVisible !== 'boolean') throw new Error('Görünürlük değeri geçersiz.');
    const time = readClock();
    const row = currentId === null ? null : rows.get(currentId);
    if (lastTick !== null) {
      const delta = time - lastTick;
      if (delta < 0) {
        rollbacks += 1;
        if (row) row.clockRollbackCount += 1;
        // Preserve the high-water mark: a reversed wall clock must not double-count recovery.
      } else {
        if (row && visible) {
          if (delta <= maxGapMs) row.activeTimeMs += delta;
          else { gaps += 1; row.unmeasuredGapCount += 1; }
        }
        lastTick = time;
      }
    } else lastTick = time;
    visible = nextVisible;
    return lastTick;
  }
  const snapshot = (row: QuestionTiming): QuestionTiming => ({ ...row });
  return {
    view(questionId: string): QuestionTiming {
      validId(questionId);
      const time = advance();
      let row = rows.get(questionId);
      if (!row) {
        row = { questionId, firstViewedAt: time, lastViewedAt: time, activeTimeMs: 0, viewCount: 1, returnCount: 0, answerChanges: 0, lastSelectedOptionId: null, unmeasuredGapCount: 0, clockRollbackCount: 0, finishedAt: null };
        rows.set(questionId, row);
      } else if (currentId !== questionId) {
        row.viewCount += 1;
        row.returnCount += 1;
        row.lastViewedAt = time;
        row.finishedAt = null;
      }
      currentId = questionId;
      return snapshot(row);
    },
    tick(nextVisible = visible): StudyTimingSummary {
      advance(nextVisible);
      return this.summary();
    },
    setVisible(nextVisible: boolean): StudyTimingSummary {
      advance(nextVisible);
      return this.summary();
    },
    finish(questionId: string): QuestionTiming | null {
      validId(questionId);
      const time = advance();
      const row = rows.get(questionId);
      if (!row) return null;
      if (row.finishedAt === null) row.finishedAt = time;
      if (currentId === questionId) currentId = null;
      return snapshot(row);
    },
    recordAnswer(questionId: string, selectedOptionId: string | null): QuestionTiming {
      validId(questionId);
      if (selectedOptionId !== null && (typeof selectedOptionId !== 'string' || !selectedOptionId.trim() || selectedOptionId.length > 500)) throw new Error('Seçenek kimliği geçersiz.');
      const row = rows.get(questionId);
      if (!row) throw new Error('Önce soru görüntülenmelidir.');
      advance();
      if (selectedOnce.has(questionId) && row.lastSelectedOptionId !== selectedOptionId) row.answerChanges += 1;
      if (selectedOptionId !== null || selectedOnce.has(questionId)) selectedOnce.add(questionId);
      row.lastSelectedOptionId = selectedOptionId;
      return snapshot(row);
    },
    summary(): StudyTimingSummary {
      return { questions: [...rows.values()].map(snapshot), currentQuestionId: currentId, visible, totalActiveTimeMs: [...rows.values()].reduce((sum, row) => sum + row.activeTimeMs, 0), unmeasuredGapCount: gaps, clockRollbackCount: rollbacks };
    },
  };
}
