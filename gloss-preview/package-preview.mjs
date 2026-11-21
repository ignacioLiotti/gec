import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const root = import.meta.dirname;
const dist = path.join(root, "dist");
let html = await readFile(path.join(dist, "index.html"), "utf8");
const script = html.match(/<script[^>]*src="([^"]+)"[^>]*><\/script>/);
const stylesheet = html.match(
  /<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/,
);
if (!script || !stylesheet)
  throw new Error("Expected one compiled script and stylesheet.");
const javascript = await readFile(path.join(dist, script[1]), "utf8");
const css = await readFile(path.join(dist, stylesheet[1]), "utf8");
if (/\bimport\s*(?:\(|["'])/.test(javascript))
  throw new Error(
    "The offline preview must have no external JavaScript chunks.",
  );
html = html.replace(
  script[0],
  () =>
    `<script type="module">${javascript.replace(/<\/script/gi, "\\x3c/script")}</script>`,
);
html = html.replace(stylesheet[0], () => `<style>${css}</style>`);
await writeFile(path.join(root, "sintesis-gloss-preview.html"), html);
console.log(`Offline preview: ${html.length.toLocaleString()} characters.`);
