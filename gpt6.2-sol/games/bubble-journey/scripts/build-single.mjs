import { build } from 'vite';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const phaser = path.dirname(require.resolve('phaser/package.json'));
const emitter = path.dirname(createRequire(path.join(phaser, 'package.json')).resolve('eventemitter3/package.json'));
const downloads = path.resolve(root, '../../downloads');
const output = await build({
  root, configFile: false, publicDir: false, logLevel: 'warn',
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    write: false, minify: true, cssCodeSplit: false, target: 'es2020',
    lib: { entry: path.join(root, 'src/main.ts'), formats: ['iife'], name: 'BubbleJourney' },
  },
});
const assets = (Array.isArray(output) ? output : [output]).flatMap(item => item.output);
const script = assets.find(item => item.type === 'chunk');
const style = assets.find(item => item.type === 'asset' && item.fileName.endsWith('.css'));
if (assets.length !== 2 || !style || !script || script.imports.length || script.dynamicImports.length) {
  throw new Error('Single-file build contains an external entry or asset.');
}
const css = String(style.source);
for (const url of css.matchAll(/url\(\s*["']?([^"')]+)/gi)) {
  if (!url[1].startsWith('data:') && !url[1].startsWith('#')) throw new Error('Single-file stylesheet needs an external URL.');
}
if (/@import\s|<\/style/i.test(css)) throw new Error('Unexpected single-file stylesheet syntax.');

const [template, phaserLicense, emitterLicense] = await Promise.all([
  readFile(path.join(root, 'index.html'), 'utf8'),
  readFile(path.join(phaser, 'LICENSE.md'), 'utf8'),
  readFile(path.join(emitter, 'LICENSE'), 'utf8'),
]);
const entry = '<script type="module" src="/src/main.ts"></script>';
if (template.split(entry).length !== 2 || template.split('</head>').length !== 2) throw new Error('Missing build template markers.');
const policy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'";
const escapeScript = text => text.replace(/<\/script/gi, '<\\/script');
const html = template
  .replace('</head>', () => `<meta http-equiv="Content-Security-Policy" content="${policy}"><style>${css}</style></head>`)
  .replace(entry, () => `<script type="text/plain" id="third-party-notices">Phaser\n${escapeScript(phaserLicense)}\nEventEmitter3\n${escapeScript(emitterLicense)}</script><script>${escapeScript(script.code)}</script>`);
const filename = 'bubble-journey.html';
await mkdir(downloads, { recursive: true });
await writeFile(path.join(downloads, filename), html, 'utf8');
const digest = createHash('sha256').update(html).digest('hex');
console.log(`${filename} · ${Buffer.byteLength(html)} bytes · SHA-256 ${digest}`);
