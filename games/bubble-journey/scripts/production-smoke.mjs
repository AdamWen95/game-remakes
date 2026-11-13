import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.QA_URL || 'http://127.0.0.1:4180/';
// Actual site URLs and browser evidence are local artifacts, never public documentation.
const artifactDir = process.env.QA_ARTIFACT_DIR || '.qa/production-smoke';
const output = process.env.QA_OUTPUT || path.join(artifactDir, 'report.json');
const screenshotPrefix = process.env.QA_SCREENSHOT_PREFIX || 'production';
await mkdir(artifactDir, { recursive: true });
await mkdir(path.dirname(output), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const errors = [], externalRequests = [], violations = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(base).origin) externalRequests.push(request.url()); });
await page.addInitScript(() => {
  window.__qaCsp = []; document.addEventListener('securitypolicyviolation', e => window.__qaCsp.push(e.violatedDirective));
  window.__qaAudio = { contexts: [], oscillators: 0 };
  const NativeAudioContext = window.AudioContext;
  window.AudioContext = class extends NativeAudioContext {
    constructor(...args) { super(...args); window.__qaAudio.contexts.push(this); }
    createOscillator() { window.__qaAudio.oscillators++; return super.createOscillator(); }
  };
});
const response = await page.goto(base);
assert.equal(response.status(), 200);
assert.ok(response.headers()['content-security-policy']);
await page.waitForFunction(() => !document.querySelector('#start').disabled);
assert.equal(await page.evaluate(() => typeof window.__bubbleSnapshot), 'undefined');
await page.screenshot({ path: path.join(artifactDir, `${screenshotPrefix}-lobby.png`), fullPage: true });
await page.locator('#duration').selectOption('120');
await page.locator('#start').click();
await page.waitForFunction(() => document.body.dataset.phase === 'playing');
await page.keyboard.press('Escape');
assert.equal(await page.locator('body').getAttribute('data-phase'), 'paused');
await page.keyboard.press('Escape');
assert.equal(await page.locator('body').getAttribute('data-phase'), 'playing');
await page.keyboard.press('Space');
await page.waitForFunction(() => !document.querySelector('#spectating').classList.contains('hidden'));
await page.waitForFunction(() => document.body.dataset.phase === 'ended', undefined, { timeout: 140000 });
assert.equal(await page.locator('.leaderboard>div').count(), 4);
await page.screenshot({ path: path.join(artifactDir, `${screenshotPrefix}-result.png`), fullPage: true });
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('bubble-journey-v1')));
assert.equal(saved.played, 1);
const gradients = await page.locator('linearGradient').evaluateAll(nodes => nodes.map(n => n.id));
assert.equal(new Set(gradients).size, gradients.length);
violations.push(...await page.evaluate(() => window.__qaCsp));
assert.deepEqual(errors, []); assert.deepEqual(externalRequests, []); assert.deepEqual(violations, []);
const audio = await page.evaluate(() => ({ states: window.__qaAudio.contexts.map(c => c.state), oscillators: window.__qaAudio.oscillators }));
assert.ok(audio.states.includes('running')); assert.ok(audio.oscillators > 20);
const asset = await page.locator('script[src]').getAttribute('src');
const assetResponse = await page.request.get(new URL(asset, base).href);
assert.equal(assetResponse.status(), 200); assert.match(assetResponse.headers()['cache-control'], /max-age=31536000/);
assert.equal((await page.request.get(new URL('assets/missing.js', base).href)).status(), 404);
const result = { checkedAt: new Date().toISOString(), url: base, server: response.headers().server, status: response.status(), assetCache: assetResponse.headers()['cache-control'], errors, cspViolations: violations, externalRequests, uniquePortraitGradients: gradients.length, audio, record: saved.records[0] };
await writeFile(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
await browser.close();
