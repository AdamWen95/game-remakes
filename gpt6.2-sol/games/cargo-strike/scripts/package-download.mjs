import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { zipSync, unzipSync } from 'fflate';

const verifiedDate = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(verifiedDate ?? '')
  || new Date(verifiedDate).toISOString().slice(0, 10) !== verifiedDate) {
  throw new Error('Pass the actual verification date as YYYY-MM-DD.');
}
const root = fileURLToPath(new URL('../', import.meta.url));
const downloads = path.resolve(root, '../../downloads');
const html = 'cargo-strike.html';
const zip = 'cargo-strike.zip';
const manifestPath = path.join(downloads, 'manifest.json');
const shaPath = path.join(downloads, 'SHA256SUMS.txt');
const hash = buffer => createHash('sha256').update(buffer).digest('hex');
const [body, manifestJson, sums] = await Promise.all([
  readFile(path.join(root, 'release', html)), readFile(manifestPath, 'utf8'), readFile(shaPath, 'utf8'),
]);
const archive = zipSync({ [html]: body }, { level: 9, mtime: new Date(2026, 0, 1) });
const unpacked = unzipSync(archive);
if (Object.keys(unpacked).length !== 1 || !Buffer.from(unpacked[html]).equals(body)) {
  throw new Error('The ZIP entry differs from the built HTML.');
}
const item = {
  id: 'cargo-strike', title: '运输船', sourceCommit: null, sourceState: 'uncommitted-working-tree',
  verifiedDate, html, htmlBytes: body.byteLength, htmlSha256: hash(body),
  zip, zipBytes: archive.byteLength, zipSha256: hash(archive),
};
const manifest = JSON.parse(manifestJson);
const games = manifest.games.filter(game => game.id !== item.id);
games.push(item);
const otherSums = sums.split(/\r?\n/).filter(line => line && !line.endsWith('  ' + html) && !line.endsWith('  ' + zip));
const newSums = [...otherSums, `${item.htmlSha256}  ${html}`, `${item.zipSha256}  ${zip}`].join('\n') + '\n';
await Promise.all([
  writeFile(path.join(downloads, html), body), writeFile(path.join(downloads, zip), archive),
]);
await writeFile(manifestPath, JSON.stringify({ ...manifest, games }, null, 2) + '\n', 'utf8');
await writeFile(shaPath, newSums, 'utf8');
console.log(JSON.stringify(item, null, 2));
