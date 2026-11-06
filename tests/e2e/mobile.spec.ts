import { test, expect } from '@playwright/test';
import content from '../../data/approved-content.json' with { type: 'json' };
test('mobile source status, filters and unavailable exam are honest', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByTestId('approved-count')).toHaveText(String(content.questions.length));
  await expect(page.getByTestId('topic-row')).toHaveCount(24);
  await expect(page.getByTestId('tool-bank')).toBeEnabled();
  await page.evaluate(()=>{window.scrollTo(0,0);document.body.scrollTop=0;document.documentElement.scrollTop=0;});
  await page.waitForFunction(()=>scrollY===0&&document.body.scrollTop===0&&document.documentElement.scrollTop===0&&visualViewport?.pageTop===0);
  const header=await page.locator('.app-header').boundingBox();
  expect(header!.y).toBeGreaterThanOrEqual(0);expect(header!.y).toBeLessThanOrEqual(1);
  const firstTopic=await page.getByTestId('topic-row').first().boundingBox();
  const navigation=await page.getByRole('navigation',{name:'Ana gezinme',exact:true}).boundingBox();
  expect(firstTopic!.y+firstTopic!.height).toBeLessThanOrEqual(navigation!.y);
  await page.getByTestId('filter-technical').click(); await expect(page.getByTestId('topic-row')).toHaveCount(8);
  await page.getByTestId('filter-common').click(); await expect(page.getByTestId('topic-row')).toHaveCount(16);
  const unavailable=page.getByTestId('topic-row').filter({has:page.locator('.topic-meta',{hasText:/^0 onaylı soru/})});
  if(await unavailable.count()){
    await unavailable.first().click();await expect(page.getByTestId('notice')).toContainText('onaylı soru henüz yok');
  }
  await page.getByTestId('exam-sources-panel').locator('summary').click();
  await page.getByTestId('full-exam-button').click();
  await expect(page.getByTestId('tools-panel')).toContainText('Hazır deneme:0/30');
  await expect(page.getByTestId('tools-panel')).toContainText('deneme başlatılamaz');
  await page.getByRole('button', {name:'İstatistik', exact:true}).click();
  await expect(page.getByTestId('score-estimate')).toHaveText('Veri yetersiz');
  expect(errors).toEqual([]);
});
test('no horizontal overflow at narrow mobile width', async ({page}) => {
  await page.setViewportSize({width:320,height:700}); await page.goto('/');
  await expect(page.getByTestId('topic-row')).toHaveCount(24);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('offline reload uses locally bundled app after service worker activation', async ({page, context}) => {
  await page.goto('/'); await expect(page.getByTestId('topic-row')).toHaveCount(24);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true); await page.reload();
  await expect(page.getByTestId('topic-row')).toHaveCount(24);
  await page.getByTestId('filter-technical').click(); await expect(page.getByTestId('topic-row')).toHaveCount(8);
  await context.setOffline(false);
});
test('legacy progress remains byte identical across launch and settings write', async ({page}) => {
  await page.addInitScript(() => {
    const state={xp:90,dailyXP:0,streak:2,lastActiveDate:null,hearts:5,totalAnswered:9,totalCorrect:9,topicStats:{},mistakes:{},customWeights:{G01:30},settings:{quizSize:10,dailyGoal:100,mixMistakes:true,examMode:false,sound:false}};
    localStorage.setItem('gys_duo_state_v1',JSON.stringify(state));
    localStorage.setItem('baseline', JSON.stringify(state));
  });
  await page.goto('/'); await expect(page.getByTestId('topic-row')).toHaveCount(24);
  await expect(page.locator('.session-strip')).toContainText('90 XP');
  await page.getByRole('button',{name:'Yönetim',exact:true}).click();
  await page.getByRole('combobox').first().selectOption('20');
  expect(await page.evaluate(() => localStorage.getItem('gys_duo_state_v1') === localStorage.getItem('baseline'))).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gys_v4_workspace_v1') || '{}').state.settings.quizSize)).toBe(20);
  await page.getByRole('button',{name:'Konular',exact:true}).click();
  await expect(page.getByTestId('topic-row').first().locator('.topic-weight')).toContainText('8');
});
test('invalid backup never prompts replacement or changes saved progress', async ({page}) => {
  await page.goto('/'); await expect(page.getByTestId('topic-row')).toHaveCount(24);
  await page.getByRole('button',{name:'Yönetim',exact:true}).click();
  await page.getByRole('combobox').first().selectOption('20');
  const before = await page.evaluate(() => localStorage.getItem('gys_v4_workspace_v1'));
  let dialogs = 0; page.on('dialog', async d => { dialogs++; await d.dismiss(); });
  await page.getByTestId('legacy-import').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{"schemaVersion":1,"state":{"totalAnswered":-1},"questions":[]}')});
  await expect(page.getByTestId('notice')).toContainText('Yedek geçersiz');
  expect(dialogs).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('gys_v4_workspace_v1'))).toBe(before);
});

test('real approved questions resume offline, score correctly and preserve the wrong book', async ({page,context}) => {
  // Two service-worker reloads and five complete answers also run on the slower WebKit engine.
  test.setTimeout(60000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await expect(page.getByTestId('approved-count')).toHaveText(String(content.questions.length));
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
  await page.getByRole('button',{name:'Yönetim',exact:true}).click();await page.getByRole('combobox').first().selectOption('5');
  await page.getByRole('button',{name:'Konular',exact:true}).click();
  await page.getByTestId('topic-row').filter({hasText:'657'}).click();
  const dialog=page.getByRole('dialog',{name:'Konu alıştırması'});await expect(dialog).toBeVisible();
  const firstText=await page.getByTestId('question-text').innerText();const first=content.questions.find(q=>q.text===firstText)!;
  expect(first).toBeDefined();const wrong=first.options.find(o=>o.id!==first.correctOptionId)!;
  await dialog.getByText(wrong.text,{exact:true}).click();
  await dialog.getByRole('button',{name:'Kontrol et',exact:true}).click();
  await expect(dialog.getByRole('link',{name:/İlgili maddeyi oku/})).toBeVisible();
  await context.setOffline(true);await page.reload();await expect(page.getByTestId('resume-card')).toBeVisible();
  await page.getByTestId('resume-study').click();await expect(page.getByTestId('question-text')).toHaveText(firstText);
  await expect(dialog.getByRole('button',{name:'Kontrol et',exact:true})).toBeHidden();
  await dialog.getByRole('button',{name:'DEVAM ET',exact:true}).click();
  await expect(page.getByTestId('question-text')).not.toHaveText(firstText);
  for(let i=1;i<5;i++){
    await expect(dialog.getByRole('button',{name:'Kontrol et',exact:true})).toBeVisible();
    const text=await page.getByTestId('question-text').innerText();const question=content.questions.find(q=>q.text===text)!;
    const correct=question.options.find(o=>o.id===question.correctOptionId)!;
    await dialog.getByText(correct.text,{exact:true}).click();
    await dialog.getByRole('button',{name:'Kontrol et',exact:true}).click();
    await expect(dialog.getByRole('link',{name:/İlgili maddeyi oku/})).toBeVisible();
    await dialog.getByRole('button',{name:'DEVAM ET',exact:true}).click();
    if(i<4)await expect(page.getByTestId('question-text')).not.toHaveText(text);
  }
  await expect(page.getByTestId('study-result')).toHaveText('4 doğru · 1 yanlış · 0 boş');
  await page.getByRole('button',{name:'KONULARA DÖN',exact:true}).click();
  await page.getByRole('button',{name:'İstatistik',exact:true}).click();
  await expect(page.getByTestId('attempt-history')).toHaveCount(1);
  await expect(page.getByTestId('question-completion')).toHaveText('5/'+content.questions.length+' benzersiz soru');
  await page.getByRole('button',{name:'Yanlış defteri',exact:true}).click();await expect(page.getByText(firstText,{exact:true})).toBeVisible();
  expect(errors).toEqual([]);await context.setOffline(false);
});

test('historical catalog links official booklets without implying580accepted questions',async({page})=>{
 await page.goto('/');await page.getByTestId('exam-sources-panel').locator('summary').click();await page.getByTestId('historical-catalog-button').click();
 await expect(page.getByTestId('historical-booklet')).toHaveCount(9);
 await expect(page.getByTestId('historical-catalog')).toContainText('Kabul edilen çıkmış soru:0');
 const links=await page.getByTestId('historical-catalog').getByRole('link').evaluateAll(elements=>elements.map(element=>(element as HTMLAnchorElement).href));
 expect(links.every(url=>/^https:\/\/(odsgm\.)?meb\.gov\.tr\//.test(url))).toBe(true);
});
