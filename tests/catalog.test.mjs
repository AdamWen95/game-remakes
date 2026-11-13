import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm, realpath, open, unlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateCatalog, loadCatalog, checkedFile } from '../scripts/catalog.mjs';
import { escapeHtml, renderCollection } from '../site/render.mjs';

const original = JSON.parse(await readFile('demos.json', 'utf8'));
test('current catalog resolves an independently declared game and preview', async () => {
  const value = await loadCatalog(process.cwd());
  assert.equal(value.games.length, 1); assert.equal(value.games[0].id, 'bubble-journey');
});
test('duplicate game ids are rejected before invoking any build', () => {
  const value = structuredClone(original); value.games.push(value.games[0]);
  assert.throws(() => validateCatalog(value), /duplicate/);
});
test('path traversal and absolute asset paths are rejected', () => {
  for (const name of ['../private.html','/private.html','C:/private.html','release/../../private.html','release//index.html']) {
    const value = structuredClone(original); value.games[0].singleFile = name;
    assert.throws(() => validateCatalog(value), /Unsafe/);
  }
});
test('unsafe identifiers and missing build metadata are rejected', () => {
  const value = structuredClone(original); value.games[0].id = 'bad;command';
  assert.throws(() => validateCatalog(value), /Invalid/);
  const missing = structuredClone(original); delete missing.games[0].title;
  assert.throws(() => validateCatalog(missing), /title/);
});
test('realpath checks prevent a file outside the game from being bundled', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'astra-catalog-test-'));
  try {
    await mkdir(path.join(directory, 'game')); await writeFile(path.join(directory, 'private.txt'), 'fixture');
    await assert.rejects(() => checkedFile(path.join(directory, 'game'), '../private.txt'), /escapes/);
  } finally {
    const resolved = await realpath(directory);
    if (!path.basename(resolved).startsWith('astra-catalog-test-') || path.dirname(resolved) !== await realpath(tmpdir())) throw new Error('Unsafe test cleanup path');
    await rm(resolved, { recursive: true });
  }
});
test('catalog text is escaped and play/download paths stay relative', () => {
  const game = { ...original.games[0], title: '<img src=x onerror=alert(1)>', bytes: 1024, previewData: 'data:image/png;base64,AA==' };
  const html = renderCollection({ ...original, games: [game] }, { template: '{{TITLE}}{{COUNT}}{{CARDS}}<style>{{STYLE}}</style><script>{{SCRIPT}}</script>', css: '', script: '' });
  assert.ok(html.includes(escapeHtml(game.title))); assert.ok(!html.includes('<img src=x onerror'));
  assert.ok(html.includes('href="./bubble-journey/index.html"'));
  assert.ok(html.includes('download="bubble-journey.html"'));
});
test('a concurrent build is refused without changing existing output', async () => {
  await mkdir('.qa', { recursive: true });
  const lockPath = path.resolve('.qa/collection-build.lock');
  const before = await readFile('dist/index.html').catch(() => null);
  const lock = await open(lockPath, 'wx');
  try {
    const result = spawnSync(process.execPath, ['scripts/build.mjs'], { encoding: 'utf8', timeout: 10000, env: { ...process.env, npm_execpath: process.env.npm_execpath || 'unused-in-lock-test' } });
    assert.notEqual(result.status, 0); assert.match(result.stderr, /already in progress/);
    const after = await readFile('dist/index.html').catch(() => null);
    assert.deepEqual(after, before);
  } finally { await lock.close(); await unlink(lockPath); }
});
