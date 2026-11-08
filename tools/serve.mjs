import http from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain' };

export async function startServer({ port = 0, root = projectRoot } = {}) {
  const canonicalRoot = await realpath(root);
  const server = http.createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405).end();
        return;
      }
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const relative = pathname.replace(/^\/modules\/\d+(?=\/)/, '').replace(/^\/+/, '') || 'index.html';
      if (relative.split('/').some(part => part.startsWith('.') || part === 'node_modules')) {
        response.writeHead(404).end();
        return;
      }
      let filename = path.resolve(canonicalRoot, relative);
      if ((await stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
      filename = await realpath(filename);
      const resolved = path.relative(canonicalRoot, filename);
      if (resolved.startsWith('..') || path.isAbsolute(resolved)) {
        response.writeHead(404).end();
        return;
      }
      const body = await readFile(filename);
      response.writeHead(200, { 'Content-Type': `${types[path.extname(filename)] || 'application/octet-stream'}${['.html', '.css', '.js', '.json', '.txt', '.mjs'].includes(path.extname(filename)) ? '; charset=utf-8' : ''}`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch {
      response.writeHead(404).end('Nicht gefunden');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return { server, url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const running = await startServer({ port: Number(process.env.PORT || 0) });
  console.log(`Rotwelsch lernen: ${running.url}`);
}