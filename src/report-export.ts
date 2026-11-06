/** Offline, Unicode PDF report. PDFs contain summaries, never restorable application data. */
export interface ReportSummary {
  totalAnswered: number;
  uniqueSolved: number;
  correct: number;
  wrong: number;
  blank: number;
  publishedStudyQuestions: number;
  coveragePercent: number | null;
  masteryPercent: number | null;
  estimatedScore: number | null;
}
export interface ReportTopic { id: string; name: string; correct: number; wrong: number; blank: number }
export interface ReportAttempt {
  title: string; finishedAt: string | null; correct: number; wrong: number; blank: number; total: number; isFirstAttempt: boolean;
}
export interface ReportPlanItem { title: string; reason: string; minutes: number; questionCount: number; sourceLocator: string }
export interface ReportSource { title: string; url: string; locator: string }
export interface ProgressReportInput {
  generatedAt: string;
  examDate: string;
  targetScore: number;
  legalEdition: 'preparation' | 'exam';
  summary: ReportSummary;
  topics: ReportTopic[];
  attempts: ReportAttempt[];
  plan: ReportPlanItem[];
  sources: ReportSource[];
  notes?: string[];
}
const number = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
function text(value: unknown, max = 20000): asserts value is string {
  if (typeof value !== 'string' || value.length > max) throw new Error('Rapor metni geçersiz veya çok uzun.');
}
function validateReport(input: ProgressReportInput): void {
  if (!input || !input.summary || !['preparation', 'exam'].includes(input.legalEdition)) throw new Error('Geçersiz rapor verisi.');
  if (!Number.isFinite(Date.parse(input.generatedAt)) || !/^\d{4}-\d{2}-\d{2}$/.test(input.examDate)
    || !Number.isFinite(Date.parse(input.examDate)) || new Date(input.examDate).toISOString().slice(0, 10) !== input.examDate) throw new Error('Geçersiz rapor tarihi.');
  if (!number(input.targetScore) || input.targetScore > 100) throw new Error('Geçersiz hedef puan.');
  for (const key of ['totalAnswered', 'uniqueSolved', 'correct', 'wrong', 'blank', 'publishedStudyQuestions'] as const) {
    if (!number(input.summary[key])) throw new Error('Geçersiz rapor sayacı.');
  }
  if (input.summary.correct + input.summary.wrong !== input.summary.totalAnswered || input.summary.uniqueSolved > input.summary.totalAnswered) throw new Error('Rapor cevap sayıları tutarsız.');
  for (const key of ['coveragePercent', 'masteryPercent', 'estimatedScore'] as const) {
    const value = input.summary[key];
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) throw new Error('Geçersiz rapor oranı.');
  }
  for (const list of [input.topics, input.attempts, input.plan, input.sources, input.notes ?? []]) {
    if (!Array.isArray(list) || list.length > 10000) throw new Error('Rapor listesi çok büyük veya geçersiz.');
  }
  for (const topic of input.topics) {
    text(topic.id, 160); text(topic.name, 2000);
    if (![topic.correct, topic.wrong, topic.blank].every(number)) throw new Error('Geçersiz konu sonuçları.');
  }
  for (const attempt of input.attempts) {
    text(attempt.title, 2000);
    if (![attempt.correct, attempt.wrong, attempt.blank, attempt.total].every(number)
      || attempt.correct + attempt.wrong + attempt.blank !== attempt.total || typeof attempt.isFirstAttempt !== 'boolean'
      || (attempt.finishedAt !== null && !Number.isFinite(Date.parse(attempt.finishedAt)))) throw new Error('Geçersiz çalışma sonuçları.');
  }
  for (const item of input.plan) {
    text(item.title, 2000); text(item.reason); text(item.sourceLocator, 3000);
    if (!number(item.minutes) || !number(item.questionCount)) throw new Error('Geçersiz çalışma planı.');
  }
  for (const source of input.sources) {
    text(source.title, 2000); text(source.locator, 3000); text(source.url, 5000);
    if (new URL(source.url).protocol !== 'https:') throw new Error('Rapor kaynak bağlantısı HTTPS olmalıdır.');
  }
  for (const note of input.notes ?? []) text(note);
}
export function validateProgressReport(input: ProgressReportInput): void { validateReport(input); }
const percent = (value: number | null): string => value === null ? 'Ölçülmedi / veri yetersiz' : `%${value.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`;
const date = (value: string | null): string => value === null ? 'Tamamlanmadı' : new Date(value).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });

export async function generateProgressPdf(input: ProgressReportInput, options: { fontBytes?: Uint8Array; fontUrl?: string } = {}): Promise<Uint8Array> {
  validateReport(input);
  const [{ PDFDocument, rgb }, { default: fontkit }] = await Promise.all([import('pdf-lib'), import('@pdf-lib/fontkit')]);
  let fontBytes = options.fontBytes;
  if (!fontBytes) {
    const url = options.fontUrl ?? new URL('fonts/DejaVuSans.ttf', document.baseURI).toString();
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) throw new Error('Türkçe PDF yazı tipi yüklenemedi. Uygulamayı bir kez çevrimiçi açın.');
    fontBytes = new Uint8Array(await response.arrayBuffer());
  }
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  pdf.setTitle('ÇŞİDB 2027 — Çalışma ve ilerleme raporu');
  pdf.setAuthor('ÇŞİDB Şube Müdürü (Teknik) hazırlık uygulaması');
  pdf.setSubject('Çalışma sonuçları, ilerleme, plan ve kaynaklar. JSON yedeği değildir.');
  pdf.setCreationDate(new Date(input.generatedAt));
  const pageWidth = 595.28; const pageHeight = 841.89; const margin = 43; const width = pageWidth - margin * 2;
  const ink = rgb(0.1, 0.16, 0.22); const muted = rgb(0.34, 0.39, 0.44); const accent = rgb(0.02, 0.42, 0.36);
  let page = pdf.addPage([pageWidth, pageHeight]); let y = pageHeight - margin;
  function freshPage(): void { page = pdf.addPage([pageWidth, pageHeight]); y = pageHeight - margin; }
  function wrap(value: string, size: number): string[] {
    const lines: string[] = [];
    for (const paragraph of value.replace(/\p{Cc}/gu, character => '\n\r\t'.includes(character) ? character : '').split(/\r?\n/)) {
      let line = '';
      for (const word of paragraph.split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= width) { line = candidate; continue; }
        if (line) { lines.push(line); line = ''; }
        // URLs and long identifiers are split to avoid overflowing the printable page.
        let chunk = '';
        for (const letter of word) {
          if (chunk && font.widthOfTextAtSize(chunk + letter, size) > width) { lines.push(chunk); chunk = ''; }
          chunk += letter;
        }
        line = chunk;
      }
      lines.push(line);
    }
    return lines;
  }
  function write(value: string, size = 10, color = ink, gap = 5): void {
    const lineHeight = size * 1.45;
    for (const line of wrap(value, size)) {
      if (y - lineHeight < margin + 20) freshPage();
      page.drawText(line, { x: margin, y: y - size, size, font, color }); y -= lineHeight;
    }
    y -= gap;
  }
  function heading(value: string): void {
    if (y < margin + 80) freshPage();
    y -= 8; write(value, 13, accent, 8);
  }
  write('ÇŞİDB 2027', 23, accent, 2);
  write('Şube Müdürü (Teknik) — Çalışma raporu', 15, ink, 12);
  write(`Hazırlanma: ${date(input.generatedAt)} | Sınav: ${input.examDate.split('-').reverse().join('.')} | Hedef: ${input.targetScore}+`, 9, muted);
  write(`Mevzuat sürümü: ${input.legalEdition === 'preparation' ? 'Hazırlık; nihai sınav sürümü henüz kesinleşmiş sayılmaz.' : 'Doğrulanmış sınav sürümü.'}`, 9, muted);
  write('Bu PDF okunabilir bir rapordur. Uygulamaya geri yüklemek için sürümlü JSON tam yedeği kullanın.', 9, muted);
  heading('İlerleme özeti');
  const summary = input.summary;
  write(`Cevaplanan: ${summary.totalAnswered} | Benzersiz çözülen: ${summary.uniqueSolved} | Yayımlanmış çalışma sorusu: ${summary.publishedStudyQuestions}`);
  write(`Doğru: ${summary.correct} | Yanlış: ${summary.wrong} | Tamamlanmış oturumlardaki boş: ${summary.blank}`);
  write(`Doğruluk: ${summary.totalAnswered ? percent(summary.correct / summary.totalAnswered * 100) : 'Ölçülmedi'}`);
  write(`Müfredat kapsamı: ${percent(summary.coveragePercent)} | Öğrenme hâkimiyeti: ${percent(summary.masteryPercent)}`);
  write(`Tahmini sınav puanı: ${summary.estimatedScore === null ? 'Veri yetersiz; puan tahmini yapılmadı.' : summary.estimatedScore.toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + '/100 (kesin sonuç değildir)'}`);
  heading('Konu bazında sonuçlar');
  if (!input.topics.length) write('Henüz ölçülmüş konu yok. Ölçülmeyen konuya sıfır başarı verilmez.', 10, muted);
  for (const topic of input.topics) {
    const answered = topic.correct + topic.wrong;
    write(`${topic.id} · ${topic.name}\nDoğru ${topic.correct} / yanlış ${topic.wrong} / boş ${topic.blank} · ${answered ? percent(topic.correct / answered * 100) : 'Ölçülmedi'}`, 10);
  }
  heading('Deneme ve çalışma sonuçları');
  if (!input.attempts.length) write('Tamamlanan oturum bulunmuyor.', 10, muted);
  for (const attempt of input.attempts) write(`${attempt.title} · ${attempt.isFirstAttempt ? 'İlk çözüm' : 'Tekrar çözüm'}\n${date(attempt.finishedAt)} · Doğru ${attempt.correct} / yanlış ${attempt.wrong} / boş ${attempt.blank} · Puan ${attempt.correct}/${attempt.total}`);
  heading('Çalışma programı');
  if (!input.plan.length) write('Kayıtlı program yok.', 10, muted);
  for (const item of input.plan) write(`${item.title} · ${item.minutes} dakika · ${item.questionCount} soru\nNeden: ${item.reason}\nMadde / kaynak: ${item.sourceLocator || 'Belirtilmedi'}`);
  heading('Kaynaklar');
  if (!input.sources.length) write('Bu rapora kaynak kaydı eklenmedi.', 10, muted);
  for (const source of input.sources) write(`${source.title} · ${source.locator}\n${source.url}`, 9);
  if (input.notes?.length) { heading('Notlar ve sınırlamalar'); for (const note of input.notes) write(note, 9, muted); }
  const pages = pdf.getPages();
  pages.forEach((item, index) => item.drawText(`ÇŞİDB 2027 · ${index + 1}/${pages.length} · PDF geri yükleme dosyası değildir`, { x: margin, y: 25, size: 8, font, color: muted }));
  return pdf.save();
}

export function downloadProgressPdf(bytes: Uint8Array, filename = 'csidb-calisma-raporu.pdf'): void {
  const blob = new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = filename.replace(/[^\p{L}\p{N}_.-]/gu, '_');
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
