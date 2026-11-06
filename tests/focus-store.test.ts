import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { advanceFocus, createFocusStore, validateFocusJournal, type FocusSession } from '../src/focus-store';

const origin = Date.parse('2026-11-06T10:00:00Z');
const at = (seconds: number) => new Date(origin + seconds * 1000);
const stores: ReturnType<typeof createFocusStore>[] = [];
function store(dbName = `fixture-focus-${crypto.randomUUID()}`) {
  const db = createFocusStore({ dbName }); stores.push(db); return db;
}
afterEach(async () => { await Promise.all(stores.splice(0).map(s => s.close())); });

describe('local foreground focus journal', () => {
  it('persists settings and sessions without touching study or legacy progress', async () => {
    const name = `fixture-resume-${crypto.randomUUID()}`;
    const db = store(name);
    expect(await db.getSettings()).toEqual({ workMinutes: 25, breakMinutes: 5 });
    await db.setSettings({ workMinutes: 30, breakMinutes: 7 });
    await db.start({ id: 'local-only', now: at(0), visible: true });
    await db.tick({ now: at(10), visible: true });
    await db.close();
    const reopened = store(name);
    expect(await reopened.getSettings()).toEqual({ workMinutes: 30, breakMinutes: 7 });
    expect(await reopened.getActive()).toMatchObject({ id: 'local-only', workActiveMs: 10000, phase: 'work', status: 'running' });
    const resumed = await reopened.tick({ now: at(3600), visible: true });
    expect(resumed.workActiveMs).toBe(10000);
    expect(resumed.wallElapsedMs).toBe(3600000);
    expect(resumed.gapCount).toBe(1);
  });
  it('separates background wall time and rejects a long visible callback gap as unmeasured', async () => {
    const db = store();
    await db.start({ now: at(0), visible: true });
    await db.tick({ now: at(10), visible: true });
    await db.tick({ now: at(20), visible: false }); // visibilitychange: prior foreground interval ends here
    await db.tick({ now: at(120), visible: false });
    await db.tick({ now: at(130), visible: true });
    const result = await db.tick({ now: at(140), visible: true });
    expect(result.workActiveMs).toBe(30000);
    expect(result.wallElapsedMs).toBe(140000);
    const frozen = await db.tick({ now: at(10000), visible: true });
    expect(frozen.workActiveMs).toBe(30000);
    expect(frozen.status).toBe('running');
    expect(frozen.completedAt).toBeNull();
  });
  it('requires explicit visible confirmation of measured work and break; neither completes in the background', async () => {
    const db = store();
    await db.setSettings({ workMinutes: 1, breakMinutes: 1 });
    await db.start({ now: at(0) });
    let session: FocusSession | null = null;
    for (const seconds of [15, 30, 45, 60]) session = await db.tick({ now: at(seconds), visible: true });
    expect(session).toMatchObject({ phase: 'work', workActiveMs: 60000, status: 'awaiting-confirmation', completedAt: null });
    await expect(db.confirmPhase({ now: at(61), visible: false })).rejects.toThrow('görünür');
    const breakPhase = await db.confirmPhase({ now: at(61), visible: true });
    expect(breakPhase).toMatchObject({ phase: 'break', status: 'running', phaseActiveMs: 0, workActiveMs: 60000 });
    for (const seconds of [76, 91, 106, 121]) session = await db.tick({ now: at(seconds), visible: true });
    expect(session?.status).toBe('awaiting-confirmation');
    expect(await db.getActive()).not.toBeNull();
    const completed = await db.confirmPhase({ now: at(122), visible: true });
    expect(completed).toMatchObject({ status: 'completed', workActiveMs: 60000, breakActiveMs: 60000, breakSkipped: false });
    expect(await db.getActive()).toBeNull();
    expect((await db.listSessions())[0].completedAt).toBe(at(122).toISOString());
  });
  it('supports an explicit skipped break and never counts paused time as work', async () => {
    const db = store();
    await db.setSettings({ workMinutes: 1, breakMinutes: 5 });
    await db.start({ now: at(0) });
    await db.pause({ now: at(15), visible: true });
    await db.resume({ now: at(315), visible: true });
    for (const seconds of [330, 345, 360]) await db.tick({ now: at(seconds), visible: true });
    const complete = await db.confirmPhase({ now: at(361), visible: true, skipBreak: true });
    expect(complete).toMatchObject({ workActiveMs: 60000, breakActiveMs: 0, wallElapsedMs: 361000, breakSkipped: true, status: 'completed' });
  });
  it('rejects premature confirmation, reversed clocks and corrupt imports without changing saved data', async () => {
    const db = store();
    await db.start({ id: 'protected', now: at(0) });
    await expect(db.confirmPhase({ now: at(5), visible: true })).rejects.toThrow();
    expect((await db.getActive())?.workActiveMs).toBe(0);
    await db.tick({ now: at(10), visible: true });
    const before = await db.exportData();
    await expect(db.tick({ now: at(9), visible: true })).rejects.toThrow('geriye');
    const corrupt = structuredClone(before);
    corrupt.sessions[0].status = 'completed';
    corrupt.sessions[0].completedAt = at(10).toISOString();
    await expect(db.importData(corrupt)).rejects.toThrow('tutarsız');
    expect(await db.exportData()).toEqual(before);
    await expect(db.setSettings({ workMinutes: 0, breakMinutes: 5 })).rejects.toThrow();
    expect(await db.getSettings()).toEqual(before.settings);
  });
  it('merges only, pauses imported running timers, accepts the same backup idempotently and rejects conflicts atomically', async () => {
    const source = store();
    await source.start({ id: 'incoming', now: at(0) });
    await source.tick({ now: at(10), visible: true });
    const backup = await source.exportData();
    const target = store();
    expect(await target.importData(backup)).toEqual({ added: 1 });
    expect(await target.getActive()).toMatchObject({ status: 'paused', visible: false, workActiveMs: 10000 });
    expect(await target.importData(backup)).toEqual({ added: 0 });
    const before = await target.exportData();
    const conflict = structuredClone(backup);
    conflict.sessions[0].workActiveMs = 5000;
    conflict.sessions[0].phaseActiveMs = 5000;
    await expect(target.importData(conflict)).rejects.toThrow('çakışıyor');
    expect(await target.exportData()).toEqual(before);
    expect(() => validateFocusJournal({ ...backup, sessions: [backup.sessions[0], backup.sessions[0]] })).toThrow();
  });
  it('serializes simultaneous starts across tabs so only one active timer exists', async () => {
    const name = `fixture-tabs-${crypto.randomUUID()}`;
    const a = store(name); const b = store(name);
    const results = await Promise.allSettled([a.start({ id: 'a', now: at(0) }), b.start({ id: 'b', now: at(0) })]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(await a.listSessions()).toHaveLength(1);
  });
  it('has a pure tick calculation which cannot mutate the stored input', async () => {
    const db = store();
    const initial = await db.start({ now: at(0) });
    const next = advanceFocus(initial, { now: at(10), visible: true });
    expect(next.workActiveMs).toBe(10000);
    expect(initial.workActiveMs).toBe(0);
    expect((await db.getActive())?.workActiveMs).toBe(0);
  });
});
