import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, writeFile, mkdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { createAppServer, LEGAL_TOPICS, parseWatchRequest } from '../server.mjs';

const report = (topics, complete = true) => ({ schemaVersion: 1, kind: 'GYSOfficialSourceCheck', id: 'test-observation', startedAt: '2026-11-06T14:00:00Z', completedAt: '2026-11-06T14:00:01Z', requestedTopicIds: topics, complete, legalEdition: 'preparation', examCutoffDate: '2027-01-01', examVersionFinalized: false, observations: topics.map(topicId => ({ topicId, result: complete ? 'Verified' : 'Failed', parseVerified: complete })) });
let server, directory, base;
const call = (path, options = {}) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', ...options });
async function start(runCheck, options = {}) {
  server = createAppServer({ distDir: directory, runCheck, ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
}
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'gys-server-test-'));
  await writeFile(join(directory, 'index.html'), '<!doctype html><title>GYS</title>');
  await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'assets', 'app.js'), 'console.log("GYS")');
});
afterEach(async () => {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); server = null; }
  await rm(directory, { recursive: true, force: true });
});

describe('same-origin read-only legal watch service', () => {
  it('accepts only canonical unique topic IDs and no user-supplied URL or data', () => {
    expect(parseWatchRequest({})).toEqual(LEGAL_TOPICS);
    expect(parseWatchRequest({ topics: ['T01', 'O02'] })).toEqual(['O02', 'T01']);
    for (const value of [null, [], { url: 'https://example.com' }, { progress: {} }, { topics: ['O04'] }, { topics: [] }, { topics: ['O02', 'O02'] }]) expect(() => parseWatchRequest(value)).toThrow();
  });
  it('serves only built files, handles HEAD and protects private data/traversal/symlinks', async () => {
    await symlink('/etc/passwd', join(directory, 'outside.txt'));
    await start(vi.fn());
    expect((await fetch(base)).status).toBe(200);
    const head = await fetch(base + '/assets/app.js', { method: 'HEAD' });
    expect(head.status).toBe(200); expect(await head.text()).toBe('');
    expect(head.headers.get('cache-control')).toContain('immutable');
    expect((await fetch(base + '/.local-sources/data.json')).status).toBe(404);
    expect((await fetch(base + '/outside.txt')).status).toBe(403);
    // Raw HTTP preserves dot segments that fetch/URL would normalize away.
    const status = await new Promise(resolve => { const req = request(base + '/%2e%2e%2fetc/passwd', response => { response.resume(); resolve(response.statusCode); }); req.end(); });
    expect(status).toBe(400);
    expect((await call('/index.html')).status).toBe(405);
  });
  it('rejects cross-origin, wrong methods, oversized and malformed JSON requests', async () => {
    const runner = vi.fn(); await start(runner);
    expect((await fetch(base + '/api/legal-watch')).status).toBe(405);
    expect((await call('/api/legal-watch', { headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.example' } })).status).toBe(403);
    expect((await call('/api/legal-watch', { headers: { 'Content-Type': 'text/plain' } })).status).toBe(415);
    expect((await call('/api/legal-watch', { body: '{' })).status).toBe(400);
    expect((await call('/api/legal-watch', { body: JSON.stringify({ extra: 'x'.repeat(1100) }) })).status).toBe(413);
    expect((await call('/api/legal-watch', { body: '{"topics":["O04"]}' })).status).toBe(400);
    expect((await call('/api/other')).status).toBe(404);
    expect(runner).not.toHaveBeenCalled();
  });
  it('coalesces concurrent scans and caches the actual timestamp without fabricating new success', async () => {
    let finish; let time = 0;
    const runner = vi.fn(topics => new Promise(resolve => { finish = () => resolve(report(topics)); }));
    await start(runner, { now: () => time, cacheMs: 1000 });
    const first = call('/api/legal-watch');
    while (!finish) await new Promise(resolve => setTimeout(resolve, 1));
    const second = call('/api/legal-watch');
    const other = await call('/api/legal-watch', { body: '{"topics":["O02"]}' });
    expect(other.status).toBe(429); finish();
    const [one, two] = await Promise.all([first, second]);
    expect(await one.json()).toEqual(await two.json());
    const cached = await call('/api/legal-watch');
    expect((await cached.json()).completedAt).toBe('2026-11-06T14:00:01Z');
    expect(runner).toHaveBeenCalledTimes(1);
    time = 1001; const next = call('/api/legal-watch');
    while (runner.mock.calls.length < 2) await new Promise(resolve => setTimeout(resolve, 1));
    finish(); expect((await next).status).toBe(200);
  });
  it('returns partial failed observations honestly and rejects invalid/failing subprocess output', async () => {
    const runner = vi.fn(topics => Promise.resolve(report(topics, false))); await start(runner);
    const response = await call('/api/legal-watch', { body: '{"topics":["O02"]}' });
    expect(response.status).toBe(200); expect((await response.json()).complete).toBe(false);
    runner.mockImplementationOnce(() => Promise.reject(new Error('internal secret/path')));
    const failure = await call('/api/legal-watch', { body: '{"topics":["T01"]}' });
    expect(failure.status).toBe(500); expect(await failure.text()).not.toContain('internal secret');
    runner.mockImplementationOnce(() => Promise.resolve({ ...report(['T01']), observations: [{ topicId: 'T01', result: 'Failed', parseVerified: false }] }));
    expect((await call('/api/legal-watch', { body: '{"topics":["T01"]}' })).status).toBe(502);
  });
});
