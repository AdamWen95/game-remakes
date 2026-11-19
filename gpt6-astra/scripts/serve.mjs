import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const index = process.argv.indexOf('--port');
const port = index < 0 ? 4173 : Number(process.argv[index + 1]);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid preview port.');
const baseIndex = process.argv.indexOf('--base');
const base = baseIndex < 0 ? '/' : process.argv[baseIndex + 1];
if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base)) throw new Error('Preview base must start and end with a slash.');
await stat(path.join(root, 'index.html')).catch(() => { throw new Error('Run npm run build before previewing the collection.'); });
const resolvedRoot = await realpath(root);
const mime = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const server = http.createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
  try {
    let pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    if (!pathname.startsWith(base)) { response.writeHead(404).end(); return; }
    pathname = '/' + pathname.slice(base.length);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const filename = await realpath(path.resolve(root, '.' + pathname));
    if (!filename.startsWith(resolvedRoot + path.sep) || !(await stat(filename)).isFile()) { response.writeHead(404).end(); return; }
    const data = await readFile(filename);
    response.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'Content-Length': data.length, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch (error) { response.writeHead(error instanceof URIError ? 400 : 404).end(); }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Collection preview: http://127.0.0.1:${port}${base}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
