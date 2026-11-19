import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const target = process.env.CARGO_TEST_URL ?? new URL('../release/cargo-strike.html', import.meta.url).href;
const output = process.env.CARGO_QA_DIR;
const offline = target.startsWith('file:');
if (output) await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.CARGO_CHROMIUM_CHANNEL || undefined,
  args: process.env.CARGO_SOFTWARE_GL === '1' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
});
const content = (p, id) => p.locator(id).textContent();
const pic = (p, name) => output && p.screenshot({ path: path.join(output, name + '.jpg'), quality: 88, scale: 'css', timeout: 25000 });
const hudText = (page, selector, value, timeout = 12000) =>
  page.waitForFunction(([s, v]) => document.querySelector(s)?.textContent === v, [selector, value], { timeout });

async function open(features = {}) {
  const context = await browser.newContext({ offline, ...features });
  const page = await context.newPage();
  const errors = [], network = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' || /THREE\.|blocked by content security policy/i.test(message.text())) errors.push(message.text());
  });
  page.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()); });
  return {
    context, page,
    async close() {
      await context.close();
      assert.deepEqual(errors, []);
      if (offline) assert.deepEqual(network, []);
    },
  };
}

async function desktop() {
  const { page, close } = await open({ viewport: { width: 1280, height: 800 } });
  try {
    await page.addInitScript(() => {
      // Exercise drag mode even when the test browser can capture the mouse.
      Object.defineProperty(HTMLElement.prototype, 'requestPointerLock', { value: undefined });
      if (!window.AudioContext) return;
      const make = AudioContext.prototype.createBufferSource;
      window.soundCount = 0;
      AudioContext.prototype.createBufferSource = function () {
        if (this.state === 'running') window.soundCount++;
        return make.call(this);
      };
    });
    await page.goto(target, { waitUntil: 'load' });
    assert.equal(await page.title(), '运输船 · Cargo Strike');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 1280);
    await pic(page, 'game-lobby');
    await page.locator('#controls-help').click();
    await page.locator('#controls[open]').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('#controls').waitFor({ state: 'hidden' });
    await page.locator('label').filter({ hasText: '自由练枪' }).click();
    assert.equal(await page.locator('[name=level]').isDisabled(), true);
    await page.locator('select[name=primary]').selectOption('awp');
    await page.locator('#start').click();
    await page.locator('#viewport').waitFor();
    await hudText(page, '#time', '练枪');
    await hudText(page, '#loaded', '05');
    const aim = { x: 640, y: 400 };
    await page.mouse.move(aim.x, aim.y);
    await page.mouse.down({ button: 'right' });
    await page.locator('#scope').waitFor({ timeout: 12000 });
    await pic(page, 'game-scope');
    await page.mouse.down({ button: 'left' });
    await page.mouse.up({ button: 'left' });
    await hudText(page, '#loaded', '04');
    await hudText(page, '#blue', '01');
    await page.mouse.up({ button: 'right' });
    await page.waitForFunction(() => window.soundCount > 0);
    await page.keyboard.press('r');
    await page.locator('#reload-progress').waitFor();
    await hudText(page, '#loaded', '05');
    assert.equal(await content(page, '#reserve'), ' / 19');
    await page.keyboard.press('2');
    await hudText(page, '#gun', 'M9');
    assert.equal(await content(page, '#loaded'), '15');
    await page.keyboard.press('g');
    await hudText(page, '#inventory', '手雷 0 · 副武器');
    await page.keyboard.down('Tab');
    await page.locator('#scoreboard').waitFor();
    assert.equal(await page.locator('#scoreboard tbody tr').count(), 5);
    await page.keyboard.up('Tab');
    await page.locator('#scoreboard').waitFor({ state: 'hidden' });
    const map = () => page.locator('#minimap').evaluate(c => c.toDataURL());
    const before = await map();
    await page.mouse.move(aim.x, aim.y);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(aim.x + 105, aim.y + 20, { steps: 5 });
    await page.mouse.up({ button: 'right' });
    await page.waitForFunction(image => document.querySelector('#minimap').toDataURL() !== image, before);
    await page.keyboard.press('Escape');
    await page.locator('#pause-dialog[open]').waitFor();
    await page.locator('#pause-settings').click();
    await page.locator('#quality').selectOption('low');
    await page.locator('#settings-done').click();
    await page.locator('#pause-dialog[open]').waitFor();
    await page.locator('#resume').click();
    await page.locator('#pause-dialog').waitFor({ state: 'hidden' });
    await page.evaluate(() => dispatchEvent(new Event('blur')));
    await page.locator('#pause-dialog[open]').waitFor();
    await page.locator('#restart').click();
    await hudText(page, '#loaded', '05');
    await hudText(page, '#blue', '00');
    await page.keyboard.press('Escape');
    await page.locator('#return').click();
    await page.locator('#lobby').waitFor();
    await page.reload();
    await page.locator('#lobby-settings').click();
    assert.equal(await page.locator('#quality').inputValue(), 'low');
    console.log('PASS desktop offline, scope, aim, headshot, sound, reload, sidearm, grenade, scoreboard, drag, pause, reset, persistence');
  } finally { await close(); }
}

async function touch() {
  const { page, context, close } = await open({ ...devices['Pixel 7'], viewport: { width: 812, height: 375 } });
  try {
    await page.goto(target, { waitUntil: 'load' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('label').filter({ hasText: '自由练枪' }).tap();
    await page.locator('#lobby-settings').tap();
    await page.locator('#quality').selectOption('low');
    await page.locator('#settings-done').tap();
    await page.locator('#start').tap();
    await page.locator('#touch').waitFor();
    await pic(page, 'game-mobile');
    const bounds = await page.locator('#stick').boundingBox();
    const fire = await page.locator('[data-action=fire]').boundingBox();
    const session = await context.newCDPSession(page);
    const before = await page.locator('#minimap').evaluate(c => c.toDataURL());
    const points = [
      { id: 1, x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height * .22 },
      { id: 2, x: fire.x + fire.width / 2, y: fire.y + fire.height / 2 },
    ];
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
    await page.waitForFunction(() => Number(document.querySelector('#loaded').textContent) < 27);
    await page.waitForFunction(before => document.querySelector('#minimap').toDataURL() !== before, before);
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const beforeTurn = await page.locator('#minimap').evaluate(c => c.toDataURL());
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 3, x: 425, y: 146 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 3, x: 562, y: 161 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(before => document.querySelector('#minimap').toDataURL() !== before, beforeTurn);
    await page.locator('#pause').tap();
    await page.locator('#pause-dialog[open]').waitFor();
    console.log('PASS mobile landscape, on-screen controls, simultaneous walk/fire, swipe and pause');
  } finally { await close(); }
}

async function team() {
  const { page, close } = await open({ viewport: { width: 940, height: 600 } });
  try {
    await page.goto(target, { waitUntil: 'load' });
    await page.locator('[name=target]').selectOption('10');
    await page.locator('#start').click();
    await hudText(page, '#goal', '目标 10');
    await pic(page, 'gameplay');
    console.log('Pointer Lock captured:', await page.evaluate(() => document.pointerLockElement?.id === 'control-plane'));
    await page.keyboard.down('Tab');
    await page.locator('#scoreboard').waitFor();
    assert.equal(await page.locator('#scoreboard tbody tr').count(), 8);
    await page.keyboard.up('Tab');
    if (output) {
      await page.keyboard.down('w');
      await hudText(page, '#zone', '中央装卸区');
      await page.keyboard.up('w');
      await pic(page, 'game-deck');
    }
    await page.keyboard.press('Escape');
    await page.locator('#pause-dialog[open]').waitFor();
    const stopped = await content(page, '#time');
    await page.waitForTimeout(1100);
    assert.equal(await content(page, '#time'), stopped);
    await page.locator('#pause-settings').click();
    await page.locator('#quality').selectOption('low');
    await page.locator('#settings-done').click();
    await page.locator('#resume').click();
    await page.locator('#result[open]').waitFor({ timeout: 180000 });
    const final = await content(page, '#result-score');
    const [blue, red] = final.split('–').map(Number);
    assert.equal(Math.max(blue, red), 10);
    assert.equal(await page.locator('#result tbody tr').count(), 8);
    await pic(page, 'game-result');
    await page.locator('#replay').click();
    await hudText(page, '#blue', '00');
    await hudText(page, '#red', '00');
    await page.keyboard.press('Escape');
    await page.locator('#return').click();
    await page.locator('#lobby').waitFor();
    console.log(`PASS natural offline 4v4, pause freezes timer, settlement ${final.trim()}, replay and lobby`);
  } finally { await close(); }
}

try {
  await desktop();
  await touch();
  if (process.env.CARGO_FULL_MATCH === '1') await team();
} finally { await browser.close(); }
