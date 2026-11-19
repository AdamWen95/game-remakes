import assert from 'node:assert/strict';
import { chromium, firefox, webkit, devices } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';

const qa = process.env.BUBBLE_QA_DIR;
if (qa) await mkdir(qa, { recursive: true });
const target = process.env.BUBBLE_TEST_URL ??
  pathToFileURL(fileURLToPath(new URL('../../../downloads/bubble-journey.html', import.meta.url))).href;
const modes = [
  { engine: 'Chromium', type: chromium, options: { viewport: { width: 1440, height: 900 } } },
  { engine: 'Firefox', type: firefox, options: { viewport: { width: 1366, height: 768 } } },
  { engine: 'WebKit', type: webkit, options: { viewport: { width: 1280, height: 800 } } },
  { engine: 'Chromium Android viewport', type: chromium, options: devices['Pixel 7'], touch: true, capture: 'mobile' },
  { engine: 'WebKit iPhone viewport', type: webkit, options: devices['iPhone 13'], touch: true },
  { engine: 'Chromium Android landscape', type: chromium, options: devices['Pixel 7 landscape'], touch: true, capture: 'landscape' },
];

const shot = (page, name) => qa && page.screenshot({ path: path.join(qa, `${name}.png`) });
const untilText = (page, selector, text) => page.waitForFunction(([selector, text]) => document.querySelector(selector)?.textContent === text, [selector, text]);
const measurePink = page => page.locator('canvas').evaluate(canvas => {
  const { data } = canvas.getContext('2d').getImageData(58, 35, 110, 98);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    if (r < 173 || g > 155 || b < g + 18 || r < b + 22) continue;
    sum += (i / 4) % 110;
    count++;
  }
  return count ? sum / count : null;
});

const requested = process.env.BUBBLE_BROWSER?.split(',');
for (const { engine, type, options, touch, capture } of modes.filter(mode => !requested || requested.includes(mode.engine))) {
  const browser = await type.launch();
  try {
    const context = await browser.newContext({ ...options, offline: target.startsWith('file:') });
    const page = await context.newPage();
    const errors = [];
    const networks = [];
    const violations = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) networks.push(request.url()); });
    page.on('console', message => {
      if (/content security policy|blocked by csp/i.test(message.text())) violations.push(message.text());
    });
    await page.addInitScript(() => {
      const Context = window.AudioContext ?? window.webkitAudioContext;
      if (!Context) return;
      const oscillator = Context.prototype.createOscillator;
      window.bubbleAudioProbe = { tones: 0, running: false };
      Context.prototype.createOscillator = function () {
        window.bubbleAudioProbe.tones++;
        window.bubbleAudioProbe.running ||= this.state === 'running';
        return oscillator.call(this);
      };
    });
    await page.goto(target, { waitUntil: 'load' });
    assert.equal(await page.title(), '泡泡奇旅 · Bubble Journey');
    await untilText(page, '#hero-title', '泡泡奇旅');
    await page.locator('#start').waitFor();
    await page.locator('#help').click();
    await untilText(page, '#dialog-title', '怎么玩');
    await page.locator('[data-action=resume]').click();
    await page.locator('#audio').click();
    assert.equal(await page.locator('#audio').getAttribute('aria-pressed'), 'true');
    await page.locator('#audio').click();
    await page.locator('[data-pilot="1"]').click();
    assert.equal(await page.locator('[data-pilot="1"]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-pilot="0"]').click();
    await page.locator('#map').selectOption('garden');
    if (engine === 'Chromium') await shot(page, 'lobby');
    if (capture === 'mobile') await shot(page, 'mobile-lobby');
    await page.locator('#start').click();
    await untilText(page, '#arena-name', '青柠花园');
    await page.locator('canvas').waitFor();
    for (let i = 0; i < 20 && (await measurePink(page)) === null; i++) await page.waitForTimeout(50);
    assert.notEqual(await measurePink(page), null, 'Phaser should render the player sprite');
    assert.equal(await page.locator('#players li').count(), 4);
    if (capture === 'landscape') {
      const fits = await page.locator('.battle-stage').evaluate(element => element.getBoundingClientRect().bottom <= innerHeight);
      assert.equal(fits, true, 'Landscape should show the entire arena without scrolling');
    }
    if (engine === 'Chromium') await shot(page, 'battle');
    if (capture) await shot(page, `${capture}-battle`);
    const before = await measurePink(page);
    if (touch) await page.locator('.d-right').tap();
    else {
      await page.keyboard.down('d');
      await page.waitForTimeout(115);
      await page.keyboard.up('d');
    }
    await page.waitForTimeout(320);
    const after = await measurePink(page);
    assert.ok(before !== null && after !== null && after - before > 20, `Pilot should move right (${before} to ${after})`);
    if (touch) await page.locator('#touch-bomb').tap();
    else await page.keyboard.press('Space');
    await untilText(page, '#capacity', '0/1');
    if (engine === 'Chromium') {
      await page.waitForFunction(() => window.bubbleAudioProbe?.running && window.bubbleAudioProbe.tones >= 4);
    }
    if (touch) await page.locator('#pause').tap();
    else await page.keyboard.press('Escape');
    await untilText(page, '#dialog-title', '游戏暂停');
    const pausedTime = await page.locator('#time').textContent();
    await page.waitForTimeout(1050);
    assert.equal(await page.locator('#time').textContent(), pausedTime);
    await page.locator('[data-action=resume]').click();
    await untilText(page, '#dialog-title', '本局结束');
    await page.locator('[data-action=again]').click();
    await untilText(page, '#capacity', '1/1');
    await page.locator('#pause').click();
    await page.locator('[data-action=restart]').click();
    await untilText(page, '#arena-name', '青柠花园');
    await page.locator('#battle-home').click();
    await page.locator('#start').waitFor();
    await page.locator('#audio').click();
    await page.reload();
    assert.equal(await page.locator('#map').inputValue(), 'garden');
    assert.equal(await page.locator('#audio').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    assert.deepEqual(violations, []);
    if (target.startsWith('file:')) assert.deepEqual(networks, []);
    const audio = await page.evaluate(() => Boolean(window.bubbleAudioProbe));
    console.log(`PASS ${engine} (${target.startsWith('file:') ? 'offline HTML' : 'Vite'}; AudioContext ${audio ? 'available' : 'unavailable'})`);
  } finally {
    await browser.close();
  }
}
