import { build } from 'vite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Independent, in-memory build: the regular dist/ release and server configuration stay intact.
const result = await build({
  configFile: false,
  root,
  mode: 'production',
  publicDir: false,
  logLevel: 'warn',
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    write: false,
    target: 'es2022',
    minify: true,
    sourcemap: false,
    cssCodeSplit: false,
    lib: { entry: path.join(root, 'src/main.ts'), name: 'BubbleJourney', formats: ['iife'] },
  },
});
const outputs = (Array.isArray(result) ? result : [result]).flatMap(item => item.output);
const chunks = outputs.filter(item => item.type === 'chunk');
const styles = outputs.filter(item => item.type === 'asset' && item.fileName.endsWith('.css'));
if (chunks.length !== 1 || styles.length !== 1 || outputs.length !== 2) {
  throw new Error('Standalone export requires exactly one script and one stylesheet. Review any new assets before sharing.');
}
if (chunks[0].imports.length || chunks[0].dynamicImports.length) throw new Error('External JavaScript dependency in standalone output.');
const code = chunks[0].code.replace(/<\/script/gi, '<\\/script');
const css = typeof styles[0].source === 'string' ? styles[0].source : Buffer.from(styles[0].source).toString('utf8');
if (/@import\s|url\(\s*['"]?(?!data:|#)/i.test(css) || /<\/style/i.test(css)) {
  throw new Error('Standalone stylesheet contains a non-embedded resource or raw closing tag.');
}
const [template, favicon, notices] = await Promise.all([
  readFile(path.join(root, 'index.html'), 'utf8'),
  readFile(path.join(root, 'public/favicon.svg')),
  readFile(path.join(root, 'public/THIRD-PARTY-NOTICES.txt'), 'utf8'),
]);
const scriptEntry = '<script type="module" src="/src/main.ts"></script>';
const iconEntry = 'href="./favicon.svg"';
for (const marker of [scriptEntry, iconEntry, '</head>']) {
  if (template.split(marker).length !== 2) throw new Error('HTML entry template changed; missing or duplicate export marker.');
}
const policy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'";
const html = template
  .replace(iconEntry, () => `href="data:image/svg+xml;base64,${favicon.toString('base64')}"`)
  .replace('</head>', () => `<meta http-equiv="Content-Security-Policy" content="${policy}" />\n    <style>${css}</style>\n  </head>`)
  .replace(scriptEntry, () => `<script id="third-party-notices" type="text/plain">${notices.replace(/<\/script/gi, '<\\/script')}</script>\n    <script>${code}</script>`);
if (/\b(?:src|href)\s*=\s*['"](?:\.\/?assets\/|\/src\/|https?:\/\/)/i.test(html)) throw new Error('Unexpected external entry asset.');
if (html.includes('__bubbleSnapshot')) throw new Error('Development diagnostics leaked into share build.');
const output = path.join(root, 'release');
await mkdir(output, { recursive: true });
const filename = 'bubble-journey.html';
await writeFile(path.join(output, filename), html, 'utf8');
const sha256 = createHash('sha256').update(html).digest('hex');
await writeFile(path.join(output, `${filename}.sha256`), `${sha256}  ${filename}\n`);
console.log(`Standalone game: release/${filename}\nSize: ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MiB\nSHA256: ${sha256}`);
