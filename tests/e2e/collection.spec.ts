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
  await expect(page.locator('[data-game-card]')).toHaveCount(1);
  await expect(page.locator('.game-detail h3')).toHaveText('泡泡奇旅');
  await page.locator('.game-preview img').scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('.game-preview img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  const search = page.getByRole('searchbox', { name: '搜索游戏或玩法' });
  await search.fill('不存在的游戏'); await expect(page.locator('#empty-state')).toBeVisible();
  await expect(page.locator('[data-game-card]')).toBeHidden();
  await page.getByRole('button', { name: '查看全部作品' }).click();
  await expect(page.locator('[data-game-card]')).toBeVisible();
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
  await page.locator('[data-download]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('bubble-journey.html');
  const file = info.outputPath('bubble-journey.html'); await download.saveAs(file);
  const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
  expect(hash(await readFile(file))).toBe(hash(await readFile('dist/bubble-journey/index.html')));
  await page.locator('[data-play]').click();
  await expect(page).toHaveURL(/\/bubble-journey\/index\.html$/);
  await expect(page.locator('#start')).toBeEnabled();
  await page.locator('#start').click(); await expect(page.locator('body')).toHaveAttribute('data-phase', 'playing');
  await page.locator('#pause').click(); await expect(page.locator('body')).toHaveAttribute('data-phase', 'paused');
  await page.goBack(); await expect(page.locator('[data-game-card]')).toBeVisible();
  await context.setOffline(true);
  await page.goto(pathToFileURL(path.resolve(file)).href);
  await expect(page.locator('#start')).toBeEnabled();
  await expect(page.locator('canvas')).toBeVisible();
  expect(await page.locator('script[src],link[rel=stylesheet]').count()).toBe(0);
});

test('relative navigation works when hosted below a repository subpath', async ({ page }) => {
  await page.goto('http://127.0.0.1:4185/gpt6-astra-demos/');
  await page.locator('[data-play]').click();
  await expect(page).toHaveURL('http://127.0.0.1:4185/gpt6-astra-demos/bubble-journey/index.html');
  await expect(page.locator('#start')).toBeEnabled();
  expect((await page.request.get('http://127.0.0.1:4185/gpt6-astra-demos/missing.js')).status()).toBe(404);
  expect((await page.request.get('http://127.0.0.1:4185/package.json')).status()).toBe(404);
});
