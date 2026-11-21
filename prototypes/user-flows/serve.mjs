import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.FLOW_LAB_PORT || 4318);
const files = new Map([
  ['/', ['index.html', 'text/html']],
  ['/index.html', ['index.html', 'text/html']],
  ['/styles.css', ['styles.css', 'text/css']],
  ['/app.js', ['app.js', 'text/javascript']],
  ['/scenarios.js', ['scenarios.js', 'text/javascript']],
  ['/design-system/tokens.css', ['../../design-system/tokens.css', 'text/css']],
  ['/docs/ux/2026-09-simplification.md', ['../../docs/ux/2026-09-simplification.md', 'text/plain']],
]);
// Only these artifact files are served. No app routes, directory listing, or credentials.
const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = files.get(pathname);
  if (request.method !== 'GET' || !file) { response.writeHead(404); response.end('Not found'); return; }
  try {
    const body = await readFile(resolve(directory, file[0]));
    response.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });
    response.end(body);
  } catch { response.writeHead(500); response.end('Artifact file unavailable'); }
});
server.listen(port, '127.0.0.1', () => process.stdout.write(`Flow lab: http://127.0.0.1:${port}\n`));
