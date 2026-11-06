import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import type { Question } from '../../src/core/content';
import watch from '../../public/content/legal-watch.json' with { type: 'json' };

async function openTool(page:Page, id:string) {
  await page.getByRole('button',{name:'Yönetim',exact:true}).last().click();
  await page.getByTestId('tool-'+id).click();
  await expect(page.getByTestId('tools-panel')).toBeVisible();
  await expect(page.getByTestId('tools-panel').getByRole('status')).toBeHidden();
}

test('topic bank applies difficulty and provision filters before persisting a bounded package',async({page})=>{
  await page.goto('/');await openTool(page,'bank');
  const bank=page.getByTestId('bank-tool');
  await bank.getByRole('combobox',{name:'Banka konusu',exact:true}).selectOption('O02');
  const response=await page.request.get('/content/O02.json');expect(response.ok()).toBe(true);
  const published=await response.json() as {questions:Question[]};
  const basic=published.questions.find(question=>question.difficulty==='basic')!;expect(basic).toBeDefined();
  const matching=published.questions.filter(question=>question.difficulty==='basic'&&question.sourceLocator===basic.sourceLocator);
  await bank.getByRole('combobox',{name:'Banka zorluk',exact:true}).selectOption('basic');
  await bank.getByRole('combobox',{name:'Banka alt konu',exact:true}).selectOption(basic.sourceLocator);
  await bank.getByRole('combobox',{name:'Banka paket büyüklüğü',exact:true}).selectOption('50');
  await expect(bank).toContainText(matching.length+' onaylı soru eşleşiyor');
  await bank.getByRole('button',{name:'Çalışmayı başlat',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Konu alıştırması',exact:true})).toBeVisible();
  const questions=await page.evaluate(async()=>{
    const request=indexedDB.open('gys_attempts_v1');
    const database=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    try{
      const query=database.transaction('attempts').objectStore('attempts').getAll();
      const attempts=await new Promise<{status:string;questions:{id:string;difficulty:string;sourceLocator:string}[]}[]>((resolve,reject)=>{query.onsuccess=()=>resolve(query.result);query.onerror=()=>reject(query.error);});
      return attempts.find(attempt=>attempt.status==='active')!.questions;
    }finally{database.close();}
  });
  expect(questions).toHaveLength(Math.min(50,matching.length));
  expect(questions.every(question=>question.difficulty==='basic'&&question.sourceLocator===basic.sourceLocator)).toBe(true);
  const permittedIds=new Set(matching.map(question=>question.id));expect(questions.every(question=>permittedIds.has(question.id))).toBe(true);
});

test('source-backed review cards hide answers, schedule one review and persist it',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await openTool(page,'cards');
  const card=page.getByTestId('review-card');await expect(card).toBeVisible();
  const firstQuestion=await card.getByRole('heading').innerText();
  await expect(card.getByRole('link')).toBeHidden();
  await page.getByTestId('reveal-card').click();
  await expect(card.getByRole('link')).toHaveAttribute('href',/^https:\/\//);
  await card.getByRole('button',{name:'Kalite 5',exact:true}).click();
  await expect(card.getByRole('heading')).not.toHaveText(firstQuestion);
  await expect(page.getByTestId('tools-panel')).toContainText('1 değerlendirme');
  await page.reload();await openTool(page,'review');
  await expect(page.getByTestId('tools-panel')).toContainText('1 değerlendirme');
  await expect(page.getByTestId('review-card').getByRole('heading')).not.toHaveText(firstQuestion);
  expect(errors).toEqual([]);
});

test('weekly capacity and light theme persist without marking unworked tasks complete',async({page})=>{
  await page.goto('/');await openTool(page,'plan');
  const panel=page.getByTestId('tools-panel');
  await expect(panel).toContainText('480 dakika haftalık kapasite');
  await expect(panel.getByRole('button',{name:'Çalışma kaydedildi',exact:true})).toHaveCount(0);
  await panel.getByText('Çalışma kapasitesini değiştir',{exact:true}).click();
  await panel.getByRole('spinbutton',{name:'Pazartesi dakika',exact:true}).fill('45');
  await panel.getByRole('button',{name:'Kapasiteyi kaydet',exact:true}).click();
  await expect(panel).toContainText('465 dakika haftalık kapasite');
  await page.getByRole('button',{name:'Yönetim',exact:true}).last().click();
  await page.getByRole('combobox',{name:'Renk teması',exact:true}).selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await openTool(page,'plan');await expect(panel).toContainText('465 dakika haftalık kapasite');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('legal watcher keeps its actual successful timestamp after a failed check',async({page})=>{
  await page.route('**/api/legal-watch',route=>route.abort('internetdisconnected'));
  await page.goto('/');await openTool(page,'watch');
  const panel=page.getByTestId('tools-panel');
  await expect(panel).toContainText(watch.completedAt);
  await panel.getByRole('button',{name:'Şimdi resmî kaynakları kontrol et',exact:true}).click();
  await expect(page.getByTestId('notice')).toContainText(/Failed to fetch|Load failed|kontrol servisine ulaşılamadı/);
  await expect(panel).toContainText(watch.completedAt);
  await expect(panel).toContainText('0 değişen kaynak');
});

test('focus timer pauses, retains its session on reload and does not count paused time',async({page})=>{
  await page.clock.install();
  await page.goto('/');await openTool(page,'focus');
  const panel=page.getByTestId('tools-panel');
  await expect(page.getByTestId('focus-clock')).toHaveText('25:00');
  await panel.getByRole('button',{name:'Başlat',exact:true}).click();
  await expect(panel.getByRole('button',{name:'Duraklat',exact:true})).toBeVisible();
  await page.clock.runFor(2100);
  await panel.getByRole('button',{name:'Duraklat',exact:true}).click();
  await expect(panel.getByRole('button',{name:'Sürdür',exact:true})).toBeVisible();
  const paused=await page.getByTestId('focus-clock').innerText();expect(paused).not.toBe('25:00');
  await page.clock.runFor(5000);await expect(page.getByTestId('focus-clock')).toHaveText(paused);
  await page.reload();await openTool(page,'focus');
  await expect(panel.getByRole('button',{name:'Sürdür',exact:true})).toBeVisible();
  await expect(page.getByTestId('focus-clock')).toHaveText(paused);
});

test('full backup rejects corruption, restores into a retained new profile and exports a real PDF',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button',{name:'Yönetim',exact:true}).last().click();
  await page.getByRole('combobox').first().selectOption('5');
  await page.getByTestId('tool-data').click();
  const downloaded=page.waitForEvent('download');await page.getByTestId('export-full-backup').click();
  const backupDownload=await downloaded;const backupText=await readFile((await backupDownload.path())!,'utf8');
  const backup=JSON.parse(backupText);expect(backup.kind).toBe('gys-full-backup');
  expect(backup.payload.legacyWorkspace.state.settings.quizSize).toBe(5);
  expect(backup.integrity.payloadHash).toMatch(/^[a-f0-9]{64}$/);
  await page.getByRole('button',{name:'Yönetim',exact:true}).last().click();
  await page.getByRole('combobox').first().selectOption('20');
  const original=await page.evaluate(()=>localStorage.getItem('gys_v4_workspace_v1'));
  await page.getByTestId('tool-data').click();
  backup.payload.legacyWorkspace.state.settings.quizSize=50;
  let dialogs=0;page.on('dialog',async dialog=>{dialogs++;await dialog.accept();});
  await page.getByTestId('import-full-backup').setInputFiles({name:'corrupt.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await expect(page.getByTestId('notice')).toContainText('Yedek özeti eşleşmiyor');
  await expect(page.getByTestId('commit-full-restore')).toBeHidden();expect(dialogs).toBe(0);
  expect(await page.evaluate(()=>localStorage.getItem('gys_v4_workspace_v1'))).toBe(original);
  await page.getByTestId('import-full-backup').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(backupText)});
  await expect(page.getByTestId('commit-full-restore')).toBeVisible();
  await Promise.all([page.waitForEvent('load'),page.getByTestId('commit-full-restore').click()]);
  await page.getByRole('button',{name:'Yönetim',exact:true}).last().click();
  await expect(page.getByRole('combobox').first()).toHaveValue('5');expect(dialogs).toBe(1);
  expect(await page.evaluate(()=>localStorage.getItem('gys_v4_workspace_v1'))).toBe(original);
  await page.getByTestId('tool-data').click();
  const pdfDownload=page.waitForEvent('download');await page.getByTestId('export-pdf').click();
  const pdfBytes=await readFile((await (await pdfDownload).path())!);
  expect(pdfBytes.subarray(0,5).toString()).toBe('%PDF-');
  const pdf=await PDFDocument.load(pdfBytes);expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
  expect(errors).toEqual([]);
});
