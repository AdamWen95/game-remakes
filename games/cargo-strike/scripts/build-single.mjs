import { build } from 'vite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Each game owns its export contract; no runtime dependency on another game's bundler.
const result=await build({configFile:false,root,mode:'production',publicDir:false,logLevel:'warn',
  define:{'process.env.NODE_ENV':JSON.stringify('production')},
  build:{write:false,target:'es2022',minify:true,sourcemap:false,cssCodeSplit:false,
    lib:{entry:path.join(root,'src/main.ts'),name:'CargoStrike',formats:['iife']}}});
const outputs=(Array.isArray(result)?result:[result]).flatMap(item=>item.output);
const scripts=outputs.filter(item=>item.type==='chunk'),styles=outputs.filter(item=>item.type==='asset' && item.fileName.endsWith('.css'));
if(scripts.length!==1 || styles.length!==1 || outputs.length!==2 || scripts[0].imports.length || scripts[0].dynamicImports.length)throw new Error('Expected one fully embedded script and stylesheet.');
const js=scripts[0].code.replace(/<\/script/gi,'<\\/script');
const css=String(styles[0].source);
if(/@import\s|url\(\s*['"]?(?!data:|#)/i.test(css) || /<\/style/i.test(css))throw new Error('External resource in standalone CSS.');
const [template,icon,license]=await Promise.all([readFile(path.join(root,'index.html'),'utf8'),readFile(path.join(root,'public/favicon.svg')),readFile(path.join(root,'public/THIRD-PARTY-NOTICES.txt'),'utf8')]);
const scriptMarker='<script type="module" src="/src/main.ts"></script>';
for(const marker of [scriptMarker,'href="./favicon.svg"','</head>'])if(template.split(marker).length!==2)throw new Error('Unexpected HTML export template.');
const csp="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'";
const html=template.replace('href="./favicon.svg"',()=>`href="data:image/svg+xml;base64,${icon.toString('base64')}"`)
  .replace('</head>',()=>`<meta http-equiv="Content-Security-Policy" content="${csp}" /><style>${css}</style></head>`)
  .replace(scriptMarker,()=>`<script type="text/plain" id="third-party-notices">${license.replace(/<\/script/gi,'<\\/script')}</script><script>${js}</script>`);
if(html.includes('__cargoTest') || /\b(?:src|href)\s*=\s*['"](?:\.\/?assets\/|\/src\/|https?:\/\/)/i.test(html))throw new Error('Development endpoint or external resource in export.');
await mkdir(path.join(root,'release'),{recursive:true});
await writeFile(path.join(root,'release/cargo-strike.html'),html);
const digest=createHash('sha256').update(html).digest('hex');
await writeFile(path.join(root,'release/cargo-strike.html.sha256'),`${digest}  cargo-strike.html\n`);
console.log(`Standalone game: release/cargo-strike.html · ${(Buffer.byteLength(html)/1024/1024).toFixed(2)} MiB\nSHA256: ${digest}`);
