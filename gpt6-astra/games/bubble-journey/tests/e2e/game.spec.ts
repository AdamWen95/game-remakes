import { test, expect, type Page } from '@playwright/test';

async function snapshot(page: Page) { return page.evaluate(() => (window as any).__bubbleSnapshot()); }
async function ready(page: Page) {
  await page.goto('/'); await expect(page.locator('#start')).toBeEnabled();
}
async function begin(page: Page) {
  await page.locator('#start').click(); await expect(page.locator('body')).toHaveAttribute('data-phase', 'playing', { timeout: 20000 });
}
async function hold(page: Page, key: string, ms: number) {
  await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key);
}

test('keyboard pause shortcuts keep one consistent pause state', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'Desktop shortcut check');
  await ready(page); await begin(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'paused');
  await expect(page.locator('#modal[data-kind=pause]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'playing');
  await page.keyboard.press('KeyP');
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'paused');
  await page.keyboard.press('KeyP');
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'playing');
});

test('lobby: art, character, map, random layout, guide, preferences, records', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await ready(page);
  await expect(page.locator('canvas')).toBeVisible();
  const initial = await snapshot(page);
  await page.getByRole('button', { name: '选择蜜桃狐' }).click();
  await expect(page.locator('#character-name')).toHaveText('蜜桃狐');
  await page.locator('[data-theme="2"]').click();
  await expect(page.locator('#arena-title')).toHaveText('星光营地');
  await page.locator('#shuffle').click();
  expect((await snapshot(page)).options.seed).not.toBe(initial.options.seed);
  await page.locator('#nav-guide').click(); await expect(page.locator('#modal')).toBeVisible();
  await page.locator('#music-setting').uncheck();
  await page.getByRole('button', { name: '知道啦，去冒险' }).click();
  await page.locator('#sound-toggle').click();
  await page.reload(); await expect(page.locator('#start')).toBeEnabled();
  await expect(page.locator('#character-name')).toHaveText('蜜桃狐');
  await expect(page.locator('#arena-title')).toHaveText('星光营地');
  await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-label', '开启声音');
  await page.locator('#nav-records').click(); await expect(page.locator('.empty-records')).toBeVisible();
  await page.getByRole('button', { name: '关闭弹窗' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `docs/screenshots/lobby-${testInfo.project.name}.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test('real controls: collision, plant, escape, blast, pause, blur, restart and lobby', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await ready(page); await begin(page);
  const clockStart = (await snapshot(page)).time;
  await page.waitForTimeout(1200);
  const advanced = (await snapshot(page)).time - clockStart;
  expect(advanced).toBeGreaterThan(950); expect(advanced).toBeLessThan(1800);
  await hold(page, 'ArrowLeft', 260); expect((await snapshot(page)).actors[0].x).toBe(1);
  if (testInfo.project.name.startsWith('mobile')) {
    const bomb = page.locator('#touch-bomb'); await expect(bomb).toBeVisible();
    await bomb.tap();
    const right = page.locator('[data-dir="right"]');
    const rightBox = (await right.boundingBox())!;
    await page.mouse.move(rightBox.x + rightBox.width / 2, rightBox.y + rightBox.height / 2); await page.mouse.down();
    await page.waitForFunction(() => (window as any).__bubbleSnapshot().actors[0].x > 2.3);
    await page.mouse.up();
    await expect.poll(async () => (await snapshot(page)).actors[0].x).toBe(3);
    const down = page.locator('[data-dir="down"]');
    const downBox = (await down.boundingBox())!;
    await page.mouse.move(downBox.x + downBox.width / 2, downBox.y + downBox.height / 2); await page.mouse.down();
    await page.waitForFunction(() => (window as any).__bubbleSnapshot().actors[0].y > 1.2); await page.mouse.up();
  } else {
    await page.keyboard.press('Space');
    await page.keyboard.down('KeyD');
    await page.waitForFunction(() => (window as any).__bubbleSnapshot().actors[0].x > 2.3);
    await page.keyboard.up('KeyD');
    await expect.poll(async () => (await snapshot(page)).actors[0].x).toBe(3);
    await page.keyboard.down('KeyS');
    await page.waitForFunction(() => (window as any).__bubbleSnapshot().actors[0].y > 1.2);
    await page.keyboard.up('KeyS');
  }
  await page.waitForTimeout(220);
  const moved = await snapshot(page);
  expect(moved.bombs.some((b: any) => b.owner === 0)).toBe(true);
  expect(moved.actors[0].x).toBeGreaterThan(1);
  await page.locator('#pause').click();
  const frozen = await snapshot(page); await page.waitForTimeout(450);
  expect((await snapshot(page)).time).toBe(frozen.time);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).bombs.some((b: any) => b.owner === 0), { timeout: 10000 }).toBe(false);
  expect((await snapshot(page)).actors[0].alive).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'paused');
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.locator('#match-restart').click();
  await page.getByRole('button', { name: '确认重新开始' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'countdown');
  expect((await snapshot(page)).actors[0].alive).toBe(true);
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'playing');
  await page.screenshot({ path: `docs/screenshots/match-${testInfo.project.name}.png`, fullPage: true });
  await page.locator('#match-leave').click();
  await page.getByRole('button', { name: '确认返回大厅' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'lobby');
  expect(errors).toEqual([]);
});

test('touch landscape keeps the full board and movement controls on screen', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'Touch viewport check');
  await ready(page); await begin(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(700);
  for (const selector of ['canvas', '.dpad', '#touch-bomb']) {
    const box = (await page.locator(selector).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(845); expect(box.y + box.height).toBeLessThanOrEqual(391);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `docs/screenshots/landscape-${testInfo.project.name}.png`, fullPage: true });
});

test('complete real match: countdown → elimination → spectating → result → saved record → rematch', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await ready(page);
  await page.locator('#duration').selectOption('120'); await begin(page);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).actors[0].alive).toBe(false);
  await expect(page.locator('#spectating')).toBeVisible();
  // Let the real Phaser loop and three autonomous opponents finish; no injected win state or clock skip.
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'ended', { timeout: 135000 });
  await expect(page.locator('#modal[data-kind=result]')).toBeVisible();
  await expect(page.locator('.leaderboard>div')).toHaveCount(4);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('bubble-journey-v1')!));
  expect(state.played).toBe(1); expect(state.records).toHaveLength(1);
  await page.getByRole('button', { name: '再来一局', exact: false }).click();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'countdown');
  expect((await snapshot(page)).actors.every((a: any) => a.alive)).toBe(true);
  expect(errors).toEqual([]);
});
