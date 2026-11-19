import { build } from 'vite';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const output = await build({
  root, configFile: false, publicDir: false, logLevel: 'warn',
  build: {
    write: false, minify: true, cssCodeSplit: false, target: 'es2020',
    lib: { entry: path.join(root, 'src/main.ts'), formats: ['iife'], name: 'ApexRush' },
  },
});
const files = (Array.isArray(output) ? output : [output]).flatMap(item => item.output);
const script = files.find(file => file.type === 'chunk');
const style = files.find(file => file.type === 'asset' && file.fileName.endsWith('.css'));
if (!script || !style || files.length !== 2 || script.imports.length || script.dynamicImports.length) {
  throw new Error('The offline build contains a separate dependency or asset.');
}

const css = String(style.source);
for (const match of css.matchAll(/url\(\s*["']?([^"')]+)/gi)) {
  if (!match[1].startsWith('data:') && !match[1].startsWith('#')) throw new Error('The offline stylesheet refers to an external file.');
}
if (/@import\s|<\/style/i.test(css)) throw new Error('Unexpected offline stylesheet syntax.');
const policy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'";
const licenseFile = path.join(path.dirname(require.resolve('three')), '../LICENSE');
const [template, license] = await Promise.all([
  readFile(path.join(root, 'index.html'), 'utf8'), readFile(licenseFile, 'utf8'),
]);
const entry = '<script type="module" src="/src/main.ts"></script>';
if (!template.includes(entry) || !template.includes('</head>')) throw new Error('Missing offline build markers.');
const escapeScript = text => text.replace(/<\/script/gi, '<\\/script');
const html = template
  .replace('</head>', () => `<meta http-equiv="Content-Security-Policy" content="${policy}"><style>${css}</style></head>`)
  .replace(entry, () => `<script type="text/plain" id="third-party-notices">Three.js\n${escapeScript(license)}</script><script>${escapeScript(script.code)}</script>`);
if (!html.includes('data:image/jpeg;base64,')) throw new Error('The cover art has not been embedded.');
const target = path.join(root, 'release');
await mkdir(target, { recursive: true });
await writeFile(path.join(target, 'apex-rush.html'), html, 'utf8');
console.log(`release/apex-rush.html (${Buffer.byteLength(html)} bytes)`);
