import { mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}`);
};
if (!process.env.npm_execpath) throw new Error('Run this script with npm run package.');
run(process.execPath, [process.env.npm_execpath, 'run', 'build']);
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const output = path.join(root, 'release');
await mkdir(output, { recursive: true });
const archive = `bubble-journey-${pkg.version}.tar.gz`;
run('tar', ['-czf', path.join(output, archive), '-C', path.join(root, 'dist'), '.']);
const sha = createHash('sha256').update(await readFile(path.join(output, archive))).digest('hex');
await writeFile(path.join(output, `${archive}.sha256`), `${sha}  ${archive}\n`);
async function inventory(dir, prefix = '') {
  const files = [];
  for (const name of await readdir(dir)) {
    const filename = path.join(dir, name); const metadata = await stat(filename);
    if (metadata.isDirectory()) files.push(...await inventory(filename, `${prefix}${name}/`));
    else files.push({ path: prefix + name, bytes: metadata.size, sha256: createHash('sha256').update(await readFile(filename)).digest('hex') });
  }
  return files;
}
const files = await inventory(path.join(root, 'dist'));
await writeFile(path.join(output, 'manifest.json'), JSON.stringify({ name: pkg.name, version: pkg.version, builtAt: new Date().toISOString(), archive, sha256: sha, files }, null, 2) + '\n');
console.log(`Static archive: release/${archive}\nSHA256: ${sha}\nFiles: ${files.length}`);
