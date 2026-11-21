import { createServer } from "node:http";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("storybook-static");
await access(path.join(root, "index.json")).catch(() => {
  throw new Error("Build Storybook first: npm run build-storybook");
});
const mime = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".ico": "image/x-icon" };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const target = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
    if (!target.startsWith(root + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    const body = await readFile(target);
    response.writeHead(200, { "Content-Type": mime[path.extname(target)] ?? "application/octet-stream", "Cache-Control": "no-store" }).end(body);
  } catch { response.writeHead(404).end(); }
});
const port = Number(process.env.PORT ?? 6006);
server.listen(port, "127.0.0.1", () => console.log(`Storybook static preview: http://localhost:${port}`));
