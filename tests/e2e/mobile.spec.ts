import { test, expect } from '@playwright/test';
test('mobile source status, filters and unavailable exam are honest', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByTestId('approved-count')).toHaveText('0');
  await expect(page.getByTestId('topic-row')).toHaveCount(24);
  await page.getByTestId('filter-technical').click(); await expect(page.getByTestId('topic-row')).toHaveCount(8);
  await page.getByTestId('filter-common').click(); await expect(page.getByTestId('topic-row')).toHaveCount(16);
  await page.getByTestId('topic-row').first().click(); await expect(page.getByTestId('notice')).toContainText('onaylı soru henüz yok');
  await page.getByTestId('full-exam-button').click(); await expect(page.getByTestId('notice')).toContainText('Strict Mode');
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
  await page.locator('input[type=file]').nth(1).setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{"schemaVersion":1,"state":{"totalAnswered":-1},"questions":[]}')});
  await expect(page.getByTestId('notice')).toContainText('Yedek geçersiz');
  expect(dialogs).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('gys_v4_workspace_v1'))).toBe(before);
});
