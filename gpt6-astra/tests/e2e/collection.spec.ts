import { test, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

test('collection artwork, search, empty state and keyboard navigation', async ({ page }, info) => {
  const errors: string[] = [], outside: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (/^https?:/.test(r.url()) && new URL(r.url()).hostname !== '127.0.0.1') outside.push(r.url()); });
  await page.goto('/');
  await expect(page).toHaveTitle(/GPT6 Astra Demos/);
  await expect(page.locator('[data-game-card]')).toHaveCount(3);
  await expect(page.locator('.game-detail h3')).toHaveText(['泡泡奇旅', '疾风竞速', '运输船']);
  for (const image of await page.locator('.game-preview img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  }
  const search = page.getByRole('searchbox', { name: '搜索游戏或玩法' });
  await search.fill('不存在的游戏'); await expect(page.locator('#empty-state')).toBeVisible();
  await expect(page.locator('[data-game-card]:visible')).toHaveCount(0);
  await page.getByRole('button', { name: '查看全部作品' }).click();
  await expect(page.locator('[data-game-card]:visible')).toHaveCount(3);
  await search.fill('泡泡'); await expect(page.locator('#visible-count')).toHaveText('01');
  await page.keyboard.press('Escape'); await expect(search).toHaveValue('');
  await page.locator('h1').click(); await page.keyboard.press('/'); await expect(search).toBeFocused();
  await page.locator('h1').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await mkdir('.qa/collection/screenshots', { recursive: true });
  await page.screenshot({ path: `.qa/collection/screenshots/home-${info.project.name}.png`, fullPage: true });
  expect(errors).toEqual([]); expect(outside).toEqual([]);
});

test('play a real game from the collection and download an independent offline copy', async ({ page, context }, info) => {
  await page.goto('/');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-download]').first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('bubble-journey.html');
  const file = info.outputPath('bubble-journey.html'); await download.saveAs(file);
  const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
  expect(hash(await readFile(file))).toBe(hash(await readFile('dist/bubble-journey/index.html')));
  await page.locator('[data-play]').first().click();
  await expect(page).toHaveURL(/\/bubble-journey\/index\.html$/);
  await expect(page.locator('#start')).toBeEnabled();
  await page.locator('#start').click(); await expect(page.locator('body')).toHaveAttribute('data-phase', 'playing');
  await page.locator('#pause').click(); await expect(page.locator('body')).toHaveAttribute('data-phase', 'paused');
  await page.goBack(); await expect(page.locator('[data-game-card]:visible')).toHaveCount(3);
  await context.setOffline(true);
  await page.goto(pathToFileURL(path.resolve(file)).href);
  await expect(page.locator('#start')).toBeEnabled();
  await expect(page.locator('canvas')).toBeVisible();
  expect(await page.locator('script[src],link[rel=stylesheet]').count()).toBe(0);
});

test('relative navigation works when hosted below a repository subpath', async ({ page }) => {
  await page.goto('http://127.0.0.1:4185/gpt6-astra-demos/');
  await page.locator('[data-play]').first().click();
  await expect(page).toHaveURL('http://127.0.0.1:4185/gpt6-astra-demos/bubble-journey/index.html');
  await expect(page.locator('#start')).toBeEnabled();
  expect((await page.request.get('http://127.0.0.1:4185/gpt6-astra-demos/missing.js')).status()).toBe(404);
  expect((await page.request.get('http://127.0.0.1:4185/package.json')).status()).toBe(404);
});

test('racing game is discoverable and its downloaded copy starts offline', async ({ page, context }, info) => {
  await page.goto('/');
  await page.getByRole('searchbox', { name: '搜索游戏或玩法' }).fill('漂移');
  await expect(page.locator('[data-game-card]:visible')).toHaveCount(1);
  const card = page.locator('[data-game-card]').filter({ hasText: '疾风竞速' });
  const downloaded = page.waitForEvent('download');
  await card.locator('[data-download]').click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('apex-rush.html');
  const file = info.outputPath('apex-rush.html'); await download.saveAs(file);
  expect(await readFile(file)).toEqual(await readFile('dist/apex-rush/index.html'));
  await card.locator('[data-play]').click();
  await expect(page).toHaveURL(/\/apex-rush\/index\.html$/);
  await expect(page.locator('#loading')).toBeHidden();
  await context.setOffline(true); await page.goto(pathToFileURL(path.resolve(file)).href);
  await expect(page.locator('#loading')).toBeHidden();
  await page.locator('#start').click();
  await expect(page.locator('body')).toHaveAttribute('data-phase','racing');
  await page.locator('#pause').click();
  await expect(page.getByRole('dialog')).toContainText('比赛已暂停');
});

test('cargo shooter is discoverable and its download runs offline', async ({ page, context }, info) => {
  await page.goto('/');
  await page.getByRole('searchbox', { name: '搜索游戏或玩法' }).fill('运输船');
  await expect(page.locator('[data-game-card]:visible')).toHaveCount(1);
  const card = page.locator('[data-game-card]').filter({ hasText: 'Cargo Strike' });
  const downloaded = page.waitForEvent('download');
  await card.locator('[data-download]').click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('cargo-strike.html');
  const file = info.outputPath('cargo-strike.html'); await download.saveAs(file);
  expect(await readFile(file)).toEqual(await readFile('dist/cargo-strike/index.html'));
  await context.setOffline(true); await page.goto(pathToFileURL(path.resolve(file)).href);
  await expect(page.locator('#loading')).toBeHidden();
  await page.locator('[data-mode="practice"]').click(); await page.locator('#start').click();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'playing');
  if (await page.evaluate(() => !!document.pointerLockElement)) await page.keyboard.press('Escape');
  else await page.locator('#pause').click();
  await expect(page.getByRole('dialog')).toContainText('战斗已暂停');
});
