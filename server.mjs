import { createServer } from 'node:http';
import { readFile, realpath, stat, mkdtemp } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, extname, resolve, sep, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
export const LEGAL_TOPICS = Object.freeze([
  'O01', 'O02', 'O03', 'O05', 'O06', 'O07', 'O08', 'O09', 'O10', 'O11', 'O12', 'O13', 'O14', 'O15', 'O16',
  'T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08',
]);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };
const fail = (status, message) => Object.assign(new Error(message), { status });

export function parseWatchRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => key !== 'topics')) throw fail(400, 'Yalnızca isteğe bağlı topics alanı desteklenir.');
  if (value.topics === undefined) return [...LEGAL_TOPICS];
  if (!Array.isArray(value.topics) || !value.topics.length || value.topics.length > LEGAL_TOPICS.length || value.topics.some(topic => !LEGAL_TOPICS.includes(topic)) || new Set(value.topics).size !== value.topics.length) throw fail(400, 'Konular benzersiz ve kayıtlı 23 mevzuat konusu içinden olmalıdır.');
  return LEGAL_TOPICS.filter(topic => value.topics.includes(topic));
}

async function bodyJson(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] || '')) throw fail(415, 'JSON içerik türü gereklidir.');
  if (Number(request.headers['content-length'] || 0) > 1024) throw fail(413, 'İstek en fazla 1024 bayt olabilir.');
  let size = 0; const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024) throw fail(413, 'İstek en fazla 1024 bayt olabilir.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw fail(400, 'Geçerli JSON gereklidir.'); }
}

function validateReport(report, topics) {
  if (!report || report.kind !== 'GYSOfficialSourceCheck' || report.schemaVersion !== 1 || report.examVersionFinalized !== false || report.examCutoffDate !== '2027-01-01' || report.legalEdition !== 'preparation' || !Number.isFinite(Date.parse(report.completedAt)) || !Array.isArray(report.requestedTopicIds) || JSON.stringify([...report.requestedTopicIds].sort()) !== JSON.stringify([...topics].sort()) || !Array.isArray(report.observations) || report.observations.length !== topics.length || report.observations.some(item => !topics.includes(item.topicId)) || new Set(report.observations.map(item => item.topicId)).size !== topics.length || typeof report.complete !== 'boolean') throw fail(502, 'Mevzuat kontrolü geçerli bir rapor üretmedi.');
  if (report.complete && report.observations.some(item => item.result !== 'Verified' || item.parseVerified !== true)) throw fail(502, 'Başarılı kontrol kanıtı tutarsız.');
  return report;
}

/** No shell, user URL, credentials or user progress are passed to this subprocess. */
export async function runOfficialCheck(topics) {
  const reportRoot = join(ROOT, '.local-reports');
  const { mkdir } = await import('node:fs/promises');
  await mkdir(reportRoot, { recursive: true });
  // Retain reports and raw snapshots privately; never place them under dist.
  const runDir = await mkdtemp(join(reportRoot, 'server-watch-'));
  const output = join(runDir, 'report.json');
  await new Promise((accept, reject) => {
    const child = spawn('python3', [join(ROOT, 'scripts/check-official-sources.py'), '--topics', ...topics, '--output', output, '--observations-dir', join(reportRoot, 'legal-watch-observations'), '--snapshot-dir', join(ROOT, '.local-sources/legal-watch'), '--timeout', '20', '--workers', '3'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = ''; let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 210_000);
    child.stderr.on('data', chunk => { if (stderr.length < 4096) stderr += chunk.toString().slice(0, 4096 - stderr.length); });
    child.once('error', () => { clearTimeout(timer); reject(fail(502, 'Python kontrol süreci başlatılamadı.')); });
    child.once('close', code => {
      clearTimeout(timer);
      // Exit 1 deliberately records one or more failed sources in a valid report.
      if (!timedOut && (code === 0 || code === 1)) accept();
      else reject(fail(502, timedOut ? 'Resmî kaynak kontrolü zaman aşımına uğradı.' : 'Resmî kaynak kontrol süreci başarısız oldu.'));
    });
  });
  let bytes;
  try { bytes = await readFile(output); } catch { throw fail(502, 'Mevzuat kontrol raporu okunamadı.'); }
  if (bytes.length > 256 * 1024) throw fail(502, 'Kontrol raporu boyut sınırını aştı.');
  let report;
  try { report = JSON.parse(bytes.toString('utf8')); } catch { throw fail(502, 'Kontrol raporu geçerli JSON içermiyor.'); }
  return validateReport(report, topics);
}

export function createAppServer({ distDir = join(ROOT, 'dist'), runCheck = runOfficialCheck, now = Date.now, cacheMs = 6 * 60 * 60 * 1000, failureCooldownMs = 30_000 } = {}) {
  const cache = new Map(); let pending = null;
  async function check(topics) {
    const key = topics.join(','); const previous = cache.get(key);
    if (previous && now() - previous.observedAt < (previous.report.complete ? cacheMs : failureCooldownMs)) return previous.report;
    if (pending) {
      if (pending.key !== key) throw fail(429, 'Bir mevzuat kontrolü sürüyor. Lütfen tamamlanmasını bekleyin.');
      return pending.promise;
    }
    const promise = Promise.resolve().then(() => runCheck(topics)).then(report => {
      validateReport(report, topics);
      cache.set(key, { report, observedAt: now() });
      return report;
    });
    pending = { key, promise };
    try { return await promise; } finally { pending = null; }
  }
  return createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    try {
      const rawPath = (request.url || '/').split('?')[0];
      let path;
      try { path = decodeURIComponent(rawPath); } catch { throw fail(400, 'Geçersiz adres.'); }
      if (path.includes('\0') || path.includes('\\') || path.split('/').some(part => part === '.' || part === '..')) throw fail(400, 'Geçersiz dosya yolu.');
      if (path.startsWith('/api/')) {
        response.setHeader('Cache-Control', 'no-store');
        if (path !== '/api/legal-watch') throw fail(404, 'Servis bulunamadı.');
        if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); throw fail(405, 'Bu servis POST gerektirir.'); }
        if (request.headers['sec-fetch-site'] === 'cross-site') throw fail(403, 'Yalnızca aynı kaynaktan istek desteklenir.');
        if (request.headers.origin) {
          let origin;
          try { origin = new URL(request.headers.origin); } catch { throw fail(403, 'Geçersiz kaynak.'); }
          if (!['http:', 'https:'].includes(origin.protocol) || origin.host !== request.headers.host) throw fail(403, 'Yalnızca aynı kaynaktan istek desteklenir.');
        }
        const topics = parseWatchRequest(await bodyJson(request));
        const report = await check(topics);
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify(report)); return;
      }
      if (!['GET', 'HEAD'].includes(request.method)) { response.setHeader('Allow', 'GET, HEAD'); throw fail(405, 'Yalnızca GET ve HEAD desteklenir.'); }
      const root = await realpath(distDir).catch(() => { throw fail(503, 'Uygulama derlenmedi; npm run build çalıştırın.'); });
      let target = resolve(root, '.' + (path === '/' ? '/index.html' : path));
      if (!target.startsWith(root + sep)) throw fail(403, 'Bu konuma erişilemez.');
      try { target = await realpath(target); } catch { throw fail(404, 'Dosya bulunamadı.'); }
      if (!target.startsWith(root + sep)) throw fail(403, 'Bu konuma erişilemez.');
      const info = await stat(target);
      if (!info.isFile()) throw fail(404, 'Dosya bulunamadı.');
      response.writeHead(200, { 'Content-Type': MIME[extname(target)] || 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': /\/(?:assets)\//.test(target) ? 'public, max-age=31536000, immutable' : 'no-cache' });
      if (request.method === 'HEAD') response.end(); else createReadStream(target).on('error', () => response.destroy()).pipe(response);
    } catch (error) {
      if (response.headersSent) { response.destroy(); return; }
      const status = Number.isInteger(error.status) ? error.status : 500;
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ error: status === 500 ? 'Servis isteği tamamlayamadı.' : error.message }));
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1–65535');
  const host = process.env.HOST || '127.0.0.1';
  createAppServer().listen(port, host, () => process.stdout.write(`GYS uygulaması: http://${host}:${port}\n`));
}
