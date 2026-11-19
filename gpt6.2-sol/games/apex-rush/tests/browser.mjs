import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const target = process.env.APEX_TEST_URL ?? new URL('../release/apex-rush.html', import.meta.url).href;
const qa = process.env.APEX_QA_DIR;
const offline = target.startsWith('file:');
if (qa) await mkdir(qa, { recursive: true });

const browser = await chromium.launch({
  channel: process.env.APEX_CHROMIUM_CHANNEL || undefined,
  args: process.env.APEX_SOFTWARE_GL === '1' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
});
const shot = (page, name) => qa && page.screenshot({ path: path.join(qa, name + '.jpg'), quality: 88, scale: 'css' });
const text = (page, selector) => page.locator(selector).textContent();
const action = (page, name) => page.locator(`[data-action="${name}"]:visible`).first();
const title = (page, expected) => page.waitForFunction(expected => {
  return document.querySelector('dialog[open] h2')?.textContent === expected;
}, expected);
const speedOver = (page, minimum) => page.waitForFunction(minimum => Number(document.querySelector('#speed')?.textContent) >= minimum, minimum);
const lobby = page => page.locator('#lobby').waitFor();
const noOverflow = async page => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
const close = async context => context.close();

async function open(viewport, features = {}) {
  const context = await browser.newContext({ viewport, offline, ...features });
  const page = await context.newPage();
  const errors = [];
  const network = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' || /content security policy|blocked by csp/i.test(message.text())) errors.push(message.text());
  });
  page.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()); });
  return {
    page, context,
    goto: () => page.goto(target, { waitUntil: 'load' }),
    check() {
      assert.deepEqual(errors, []);
      if (offline) assert.deepEqual(network, []);
    },
  };
}

async function desktop() {
  const { page, context, goto, check } = await open({ width: 1440, height: 900 });
  try {
    await page.addInitScript(() => {
      if (!window.AudioContext) return;
      const make = AudioContext.prototype.createOscillator;
      window.tones = { count: 0, running: false };
      AudioContext.prototype.createOscillator = function () {
        window.tones.count++;
        window.tones.running ||= this.state === 'running';
        return make.call(this);
      };
    });
    await goto();
    await lobby(page);
    assert.equal(await page.title(), '疾风竞速 · Apex Rush');
    assert.equal(await page.locator('[data-track]').count(), 3);
    assert.equal(await page.locator('[data-car]').count(), 3);
    await noOverflow(page);
    await shot(page, 'game-lobby');
    await page.getByRole('button', { name: '玩法说明' }).click();
    await title(page, '操作与漂移');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog').evaluate(dialog => dialog.open), false);
    await page.locator('[data-difficulty=expert]').click();
    assert.equal(await page.locator('[data-difficulty=expert]').getAttribute('aria-pressed'), 'true');
    await action(page, 'start').click();
    await page.locator('#course-canvas').waitFor();
    assert.equal(await text(page, '#course-name'), '潮汐港');
    assert.equal(await page.locator('#standings li').count(), 6);
    await shot(page, 'game-start');
    await page.keyboard.down('w');
    await speedOver(page, 93);
    await page.waitForFunction(() => window.tones?.running && window.tones.count >= 4);
    await shot(page, 'game-race');
    await page.keyboard.press('c');
    await page.keyboard.up('w');
    const beforeBrake = Number(await text(page, '#speed'));
    await page.keyboard.down('s');
    await page.waitForFunction(before => Number(document.querySelector('#speed')?.textContent) < before - 15, beforeBrake);
    await page.keyboard.up('s');
    await page.keyboard.press('Escape');
    await title(page, '比赛暂停');
    const stopped = await text(page, '#timer');
    await page.waitForTimeout(270);
    assert.equal(await text(page, '#timer'), stopped);
    await page.locator('[data-option=quality]').selectOption('low');
    await action(page, 'resume').click();
    await page.waitForFunction(stopped => document.querySelector('#timer')?.textContent !== stopped, stopped);
    await page.evaluate(() => dispatchEvent(new Event('blur')));
    await title(page, '比赛暂停');
    await action(page, 'restart').click();
    assert.equal(await text(page, '#timer'), '00:00.000');
    await action(page, 'pause').click();
    await action(page, 'garage').click();
    await page.locator('[data-track="1"]').click();
    await page.locator('[data-car="1"]').click();
    await page.locator('[data-mode=trial]').click();
    assert.equal(await page.locator('#difficulty').isVisible(), false);
    await action(page, 'start').click();
    assert.equal(await text(page, '#course-name'), '晶脊谷');
    assert.equal(await page.locator('#standings').isVisible(), false);
    await page.keyboard.down('w');
    await speedOver(page, 98);
    await page.keyboard.down('Shift');
    await page.keyboard.down('d');
    await page.waitForFunction(() => Number(document.querySelector('[role=meter]')?.getAttribute('aria-valuenow')) > 14);
    await page.keyboard.up('d');
    await page.keyboard.up('Shift');
    await page.keyboard.up('w');
    await shot(page, 'game-canyon');
    await action(page, 'pause').click();
    await action(page, 'garage').click();
    await action(page, 'audio').click();
    await page.reload();
    assert.equal(await action(page, 'audio').getAttribute('aria-pressed'), 'true');
    check();
    console.log('PASS desktop lobby, WebGL race, AI HUD, keyboard, drift, camera, audio, pause/restart, clean console');
  } finally { await close(context); }
}

async function mobile() {
  const { page, context, goto, check } = await open(undefined, devices['Pixel 7']);
  try {
    await goto();
    await lobby(page);
    await noOverflow(page);
    await shot(page, 'game-mobile-lobby');
    await page.locator('[data-track="2"]').tap();
    await page.locator('[data-car="2"]').tap();
    await action(page, 'start').tap();
    assert.equal(await text(page, '#course-name'), '零点环城');
    const steering = page.getByRole('button', { name: '右转' });
    const drifting = page.getByRole('button', { name: '漂移' });
    await steering.waitFor();
    await speedOver(page, 85);
    const session = await context.newCDPSession(page);
    const points = await Promise.all([steering, drifting].map(async (button, id) => {
      const bounds = await button.boundingBox();
      return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, id };
    }));
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
    await page.waitForFunction(() => document.querySelectorAll('#touch-controls .pressed').length === 2);
    await page.waitForFunction(() => Number(document.querySelector('[role=meter]')?.getAttribute('aria-valuenow')) >= 10);
    await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await page.waitForFunction(() => document.querySelectorAll('#touch-controls .pressed').length === 0);
    await shot(page, 'game-mobile');
    await page.setViewportSize({ width: 812, height: 375 });
    await noOverflow(page);
    const scene = await page.locator('#course-canvas').boundingBox();
    assert.ok(scene.width >= 811 && scene.height >= 374);
    await shot(page, 'game-landscape');
    await action(page, 'pause').tap();
    await title(page, '比赛暂停');
    check();
    console.log('PASS mobile Chromium portrait/landscape, automatic throttle, two simultaneous inputs and cancellation');
  } finally { await close(context); }
}

async function finish() {
  const { page, context, goto, check } = await open({ width: 640, height: 380 });
  try {
    // Accelerate rendered frames so a full two-lap test can run under software WebGL.
    await page.addInitScript(() => {
      const raf = requestAnimationFrame.bind(window);
      let time = performance.now();
      requestAnimationFrame = callback => raf(() => callback(time += 82));
    });
    await goto();
    await page.getByRole('button', { name: '设置' }).click();
    await page.locator('[data-option=quality]').selectOption('low');
    await action(page, 'dismiss').click();
    await action(page, 'start').click();
    await page.keyboard.down('w');
    try {
      await page.waitForFunction(() => document.querySelector('dialog[open] h2')?.textContent === '比赛结束', null, { timeout: 110000 });
    } finally { await page.keyboard.up('w'); }
    assert.equal(await page.locator('.split-times > span').count(), 2);
    assert.equal(await page.locator('.result-list li').count(), 6);
    const actionsFit = await action(page, 'garage').evaluate(button => {
      const dialog = button.closest('dialog');
      return button.getBoundingClientRect().bottom <= dialog.getBoundingClientRect().bottom;
    });
    assert.equal(actionsFit, true, 'Finish actions should fit on a short screen');
    const raceTime = await page.locator('.result-top strong').first().textContent();
    assert.match(raceTime, /^\d{2}:\d{2}\.\d{3}$/);
    await shot(page, 'game-result');
    await action(page, 'garage').click();
    assert.ok((await text(page, '#record')).includes(raceTime));
    await page.reload();
    await lobby(page);
    assert.ok((await text(page, '#record')).includes(raceTime));
    check();
    console.log(`PASS real browser two-lap settlement and saved record (${raceTime}, accelerated test clock)`);
  } finally { await close(context); }
}

async function unsupported() {
  const { page, context, goto } = await open({ width: 1000, height: 700 });
  try {
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        return /^webgl/.test(kind) ? null : getContext.call(this, kind, ...args);
      };
    });
    await goto();
    await action(page, 'start').click();
    await title(page, '无法启动 3D 赛道');
    await action(page, 'dismiss').click();
    await lobby(page);
    console.log('PASS WebGL-unavailable recovery message and return to lobby');
  } finally { await close(context); }
}

try {
  const suites = { desktop, mobile, finish, unsupported };
  const names = process.env.APEX_SUITE?.split(',') ?? Object.keys(suites);
  for (const name of names) await suites[name]();
} finally { await browser.close(); }
