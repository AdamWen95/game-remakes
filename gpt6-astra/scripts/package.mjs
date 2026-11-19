import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'dist/manifest.json'), 'utf8'));
if (manifest.project !== 'gpt6-astra-demos') throw new Error('Expected a built collection.');
for (const file of manifest.files) {
  if (!/^(?:index\.html|[a-z][a-z0-9-]*\/index\.html)$/.test(file.path)) throw new Error('Unexpected release path.');
  const content = await readFile(path.join(root, 'dist', file.path));
  if (createHash('sha256').update(content).digest('hex') !== file.sha256) throw new Error('Build file changed: ' + file.path);
}
const output = path.join(root, 'release');
await mkdir(output, { recursive: true });
const filename = `gpt6-astra-demos-${manifest.version}.tar.gz`;
const result = spawnSync('tar', ['-czf', path.join(output, filename), '-C', path.join(root, 'dist'), 'index.html', ...manifest.files.filter(file => file.path !== 'index.html').map(file => file.path), 'manifest.json'], { cwd: root, stdio: 'inherit' });
if (result.error || result.status !== 0) throw new Error('Collection packaging failed.');
const hash = createHash('sha256').update(await readFile(path.join(output, filename))).digest('hex');
await writeFile(path.join(output, filename + '.sha256'), `${hash}  ${filename}\n`);
console.log(`Static collection: release/${filename}\nSHA256: ${hash}`);
