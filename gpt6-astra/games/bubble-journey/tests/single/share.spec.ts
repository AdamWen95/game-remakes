import { test, expect, type Page } from '@playwright/test';
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const shareDir = path.resolve('.qa/single-html/一份分享');
const shareFile = path.join(shareDir, 'bubble-journey.html');
const shareUrl = pathToFileURL(shareFile).href;
const screenshots = '.qa/single-html/screenshots';

test.beforeAll(async () => {
  await mkdir(shareDir, { recursive: true });
  await mkdir(screenshots, { recursive: true });
  await copyFile('release/bubble-journey.html', shareFile);
  expect(await readdir(shareDir)).toEqual(['bubble-journey.html']);
});

async function openGame(page: Page) {
  const errors: string[] = [], requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const url = request.url();
    if (url !== shareUrl && !url.startsWith('data:') && !url.startsWith('blob:')) requests.push(url);
  });
  await page.addInitScript(() => {
    (window as any).__qaCsp = [];
    document.addEventListener('securitypolicyviolation', e => (window as any).__qaCsp.push(e.violatedDirective));
    const NativeAudio = window.AudioContext;
    (window as any).__qaAudio = { supported: typeof NativeAudio === 'function', states: [], nodes: 0 };
    // Some automation builds have no Web Audio API. Do not create an unrelated
    // ReferenceError in the test harness; still require a clean, playable page.
    if (typeof NativeAudio !== 'function') return;
    window.AudioContext = class extends NativeAudio {
      constructor(...args: ConstructorParameters<typeof AudioContext>) { super(...args); (window as any).__qaAudio.states.push(this); }
      createOscillator() { (window as any).__qaAudio.nodes++; return super.createOscillator(); }
    };
  });
  await page.goto(shareUrl);
  await expect(page.locator('#start')).toBeEnabled();
  await expect(page.locator('canvas')).toBeVisible();
  expect(await page.locator('script[src],link[rel=stylesheet],link[rel=modulepreload],iframe').count()).toBe(0);
  expect(await page.evaluate(() => typeof (window as any).__bubbleSnapshot)).toBe('undefined');
  await expect(page.locator('link[rel=icon]')).toHaveAttribute('href', /^data:image\/svg\+xml;base64,/);
  return async () => {
    expect(errors).toEqual([]); expect(requests).toEqual([]);
    expect(await page.evaluate(() => (window as any).__qaCsp)).toEqual([]);
  };
}

test('one offline HTML loads menus, art, audio, controls, pause and restart', async ({ page }, info) => {
  const verify = await openGame(page);
  await page.getByRole('button', { name: '选择奶油熊' }).click();
  await page.locator('[data-theme="1"]').click();
  await expect(page.locator('#character-name')).toHaveText('奶油熊');
  await expect(page.locator('#arena-title')).toHaveText('桃桃糖镇');
  await page.locator('#nav-guide').click();
  await expect(page.locator('#modal')).toBeVisible();
  await page.getByRole('button', { name: '知道啦，去冒险' }).click();
  await page.screenshot({ path: `${screenshots}/lobby-${info.project.name}.png`, fullPage: true });
  await page.locator('#start').click();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'playing');
  if (info.project.name.startsWith('mobile')) {
    await expect(page.locator('.dpad')).toBeVisible();
    await page.locator('#touch-bomb').tap();
    await page.locator('[data-dir="right"]').tap();
  } else {
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowRight');
  }
  await expect(page.locator('#stat-bombs')).toHaveText('0/1');
  await page.locator('#pause').click();
  const frozen = await page.locator('#round-timer b').textContent();
  await page.waitForTimeout(1100);
  expect(await page.locator('#round-timer b').textContent()).toBe(frozen);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.locator('#match-restart').click();
  await page.getByRole('button', { name: '确认重新开始' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'countdown');
  await page.locator('#match-leave').click();
  await page.getByRole('button', { name: '确认返回大厅' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'lobby');
  const audio = await page.evaluate(() => ({ supported: (window as any).__qaAudio.supported, states: (window as any).__qaAudio.states.map((c: AudioContext) => c.state), nodes: (window as any).__qaAudio.nodes }));
  if (audio.supported) {
    expect(audio.states).toContain('running'); expect(audio.nodes).toBeGreaterThan(5);
  } else {
    expect(audio.states).toEqual([]); expect(audio.nodes).toBe(0);
    info.annotations.push({ type: 'platform-limit', description: 'This browser build does not expose AudioContext. Gameplay is verified; audio is not.' });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await verify();
});

test('offline file completes a natural match and records the result', async ({ page }, info) => {
  test.skip(info.project.name.startsWith('mobile'), 'Full match is covered in both desktop engines.');
  const verify = await openGame(page);
  await page.locator('#duration').selectOption('120');
  await page.locator('#start').click();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'playing');
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'paused');
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'playing');
  await page.keyboard.press('Space');
  await expect(page.locator('#spectating')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'ended', { timeout: 135000 });
  await expect(page.locator('.leaderboard>div')).toHaveCount(4);
  await page.screenshot({ path: `${screenshots}/result-${info.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: '返回游戏大厅' }).click();
  await page.locator('#nav-records').click();
  await expect(page.locator('.record-stats strong').first()).toHaveText('1');
  const storageAvailable = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('bubble-journey-v1') || 'null')?.played === 1; } catch { return false; } });
  if (storageAvailable) {
    await page.reload(); await expect(page.locator('#start')).toBeEnabled();
    await page.locator('#nav-records').click();
    await expect(page.locator('.record-stats strong').first()).toHaveText('1');
  } else {
    await expect(page.locator('.record-note')).toContainText('暂时无法保存');
  }
  await verify();
});

test('blocked local storage still allows playing and explains session-only records', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'One explicit storage failure regression is sufficient.');
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage disabled for test', 'SecurityError'); } });
  });
  const verify = await openGame(page);
  await page.locator('#nav-records').click();
  await expect(page.locator('.record-note')).toContainText('暂时无法保存');
  await page.getByRole('button', { name: '关闭弹窗' }).click();
  await page.locator('#start').click();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'playing');
  await verify();
});
