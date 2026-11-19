import { mkdir, mkdtemp, readFile, writeFile, rename, rm, realpath, stat, open, unlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { loadCatalog, checkedFile } from './catalog.mjs';
import { renderCollection } from '../site/render.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = await loadCatalog(root);
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
if (!process.env.npm_execpath) throw new Error('Use npm run build.');
const reviewRoot = path.join(root, '.qa');
await mkdir(reviewRoot, { recursive: true });
const transaction = await mkdtemp(path.join(reviewRoot, 'collection-build-'));
const stage = path.join(transaction, 'site');
const previous = path.join(transaction, 'previous');
const destination = path.join(root, 'dist');
await mkdir(stage);
const lockPath = path.join(reviewRoot, 'collection-build.lock');
let lock;
try { lock = await open(lockPath, 'wx'); }
catch (error) {
  const actual = await realpath(transaction);
  const boundary = await realpath(reviewRoot);
  if (actual.startsWith(boundary + path.sep) && path.basename(actual).startsWith('collection-build-')) await rm(actual, { recursive: true, force: true });
  if (error.code === 'EEXIST') throw new Error('A collection build is already in progress. If a process was interrupted, inspect the local build lock before removing it.');
  throw error;
}
const digest = content => createHash('sha256').update(content).digest('hex');
let hadPrevious = false;
let published = false;
try {
  const games = [];
  const files = [];
  for (const game of catalog.games) {
    console.log(`Building ${game.id}…`);
    const build = spawnSync(process.execPath, [process.env.npm_execpath, 'run', 'build:single', '--workspace', game.id], { cwd: root, stdio: 'inherit' });
    if (build.error || build.status !== 0) throw new Error(`Game build failed: ${game.id}`);
    const directory = path.join(root, 'games', game.id);
    const html = await readFile(await checkedFile(directory, game.singleFile));
    if (!html.toString('utf8').toLowerCase().startsWith('<!doctype html>')) throw new Error(`Game ${game.id} did not produce an HTML document.`);
    const preview = await readFile(await checkedFile(directory, game.preview));
    const relative = `${game.id}/index.html`;
    await mkdir(path.join(stage, game.id));
    await writeFile(path.join(stage, relative), html);
    files.push({ path: relative, bytes: html.length, sha256: digest(html) });
    games.push({ ...game, bytes: html.length, previewData: `data:image/png;base64,${preview.toString('base64')}` });
  }
  const [template, css, script] = await Promise.all(['index.html', 'style.css', 'main.js'].map(name => readFile(path.join(root, 'site', name), 'utf8')));
  const html = renderCollection({ ...catalog, games }, { template, css, script });
  await writeFile(path.join(stage, 'index.html'), html);
  files.unshift({ path: 'index.html', bytes: Buffer.byteLength(html), sha256: digest(html) });
  await writeFile(path.join(stage, 'manifest.json'), JSON.stringify({ project: pkg.name, version: pkg.version, builtAt: new Date().toISOString(), files }, null, 2) + '\n');
  try {
    await stat(destination);
    const existing = JSON.parse(await readFile(path.join(destination, 'manifest.json'), 'utf8'));
    if (existing.project !== 'gpt6-astra-demos') throw new Error('Refusing to replace an unrelated dist directory.');
    await rename(destination, previous); hadPrevious = true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    // A directory without our manifest is not a previous collection build.
    try { await stat(destination); throw new Error('Existing dist has no collection manifest; preserve it before building.'); }
    catch (check) { if (check.code !== 'ENOENT') throw check; }
  }
  try { await rename(stage, destination); published = true; }
  catch (error) { if (hadPrevious) await rename(previous, destination); throw error; }
  console.log(`Collection built: dist/index.html · ${games.length} playable game(s)`);
} finally {
  // Delete only this build's verified temporary directory, never an arbitrary output path.
  try {
    const actual = await realpath(transaction);
    const boundary = await realpath(reviewRoot);
    if (!actual.startsWith(boundary + path.sep) || !path.basename(actual).startsWith('collection-build-')) throw new Error('Unsafe build cleanup path.');
    if (published || !hadPrevious) await rm(actual, { recursive: true, force: true });
  } finally { await lock.close(); await unlink(lockPath); }
}
