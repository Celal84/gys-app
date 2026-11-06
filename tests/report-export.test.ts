import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { generateProgressPdf, validateProgressReport, type ProgressReportInput } from '../src/report-export';

function report(): ProgressReportInput {
  return { generatedAt: '2026-11-06T12:00:00.000Z', examDate: '2027-02-27', targetScore: 85, legalEdition: 'preparation',
    summary: { totalAnswered: 4, uniqueSolved: 3, correct: 3, wrong: 1, blank: 2, publishedStudyQuestions: 18,
      coveragePercent: null, masteryPercent: null, estimatedScore: null },
    topics: [{ id: 'O02', name: 'Devlet Memurları Kanunu — çekilme ve çekilmiş sayılma', correct: 3, wrong: 1, blank: 2 }],
    attempts: [{ title: 'Çalışma: İstisnalar ve görevler', finishedAt: '2026-11-06T11:30:00.000Z', correct: 3, wrong: 1, blank: 2, total: 6, isFirstAttempt: true }],
    plan: [{ title: 'Öğrenme ve akıllı tekrar', reason: 'Ölçüm sayısı sınırlı; süreleri ve yetkili makamları karşılaştır.', minutes: 30, questionCount: 5, sourceLocator: '657 sayılı Kanun, madde 94–97' }],
    sources: [{ title: '657 sayılı Devlet Memurları Kanunu', url: 'https://www.mevzuat.gov.tr/', locator: 'Madde 94–97' }],
    notes: ['Bu dosya yedek değildir. Ölçülmeyen konu sıfır başarı olarak değerlendirilmez.'] };
}
const font = () => readFile(new URL('../public/fonts/DejaVuSans.ttf', import.meta.url));

describe('offline downloadable Unicode PDF report', () => {
  it('creates a real PDF with embedded Turkish character mappings and report metadata', async () => {
    const bytes = await generateProgressPdf(report(), { fontBytes: await font() });
    expect(new TextDecoder().decode(bytes.slice(0, 8))).toMatch(/^%PDF-1\./);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(0);
    expect(pdf.getTitle()).toContain('ÇŞİDB'); expect(pdf.getSubject()).toContain('JSON yedeği değildir');
    const streams = pdf.context.enumerateIndirectObjects().flatMap(([, object]) => object instanceof PDFRawStream
      ? [new TextDecoder().decode(decodePDFRawStream(object).decode())] : []);
    const cmap = streams.filter(value => value.includes('begincmap')).join('').toLowerCase();
    for (const codepoint of ['0131', '0130', '015f', '011f']) expect(cmap).toContain(codepoint);
    expect(bytes.byteLength).toBeGreaterThan(10000);
  });
  it('paginates long reports, paragraphs and URLs into finite A4 pages', async () => {
    const input = report();
    input.topics = Array.from({ length: 80 }, (_, index) => ({ id: `TEST-${index}`, name: 'Uzun konu adı ve kaynak açıklaması '.repeat(6), correct: 3, wrong: 1, blank: 1 }));
    input.sources[0].url = 'https://example.org/' + 'long-source-reference'.repeat(25);
    const pdf = await PDFDocument.load(await generateProgressPdf(input, { fontBytes: await font() }));
    expect(pdf.getPageCount()).toBeGreaterThan(3);
    for (const page of pdf.getPages()) {
      expect(page.getWidth()).toBeCloseTo(595.28); expect(page.getHeight()).toBeCloseTo(841.89);
    }
  });
  it('supports an unmeasured empty report without inventing a score or zero mastery', async () => {
    const input = report(); input.summary = { totalAnswered: 0, uniqueSolved: 0, correct: 0, wrong: 0, blank: 0,
      publishedStudyQuestions: 18, coveragePercent: null, masteryPercent: null, estimatedScore: null };
    input.topics = []; input.attempts = []; input.plan = []; input.sources = [];
    expect(() => validateProgressReport(input)).not.toThrow();
    expect((await PDFDocument.load(await generateProgressPdf(input, { fontBytes: await font() }))).getPageCount()).toBeGreaterThan(0);
  });
  it('rejects inconsistent results, invalid dates, unsafe links and malformed metrics', () => {
    const badCount = report(); badCount.attempts[0].correct = 10;
    const badDate = report(); badDate.examDate = '2027-02-30';
    const badLink = report(); badLink.sources[0].url = 'javascript:alert(1)';
    const badRatio = report(); badRatio.summary.masteryPercent = Number.NaN;
    const badTotal = report(); badTotal.summary.totalAnswered = 99;
    for (const value of [badCount, badDate, badLink, badRatio, badTotal]) expect(() => validateProgressReport(value)).toThrow();
  });
});
