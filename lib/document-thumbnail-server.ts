import type { SupabaseClient } from "@supabase/supabase-js";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const COVER_SIZE = 220;
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_CACHED_COVERS = 200;
const MAX_RENDERERS = 2;
const APP_CACHE_TTL_MS = 15 * 60 * 1000;

const covers = new Map<string, { image: Blob; expiresAt: number }>();
const pendingCovers = new Map<string, Promise<Blob | null>>();

async function renderCover(source: Blob, isPdf: boolean) {
  if (!isPdf) {
    const sharp = (await import("sharp")).default;
    const image = await sharp(await source.arrayBuffer(), { limitInputPixels: 32_000_000 })
      .rotate()
      .resize(COVER_SIZE, COVER_SIZE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    return new Blob([new Uint8Array(image)], { type: "image/webp" });
  }

  const require = createRequire(join(process.cwd(), "package.json"));
  const pdfEntry = pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href;
  const pdfjs = await import(/* webpackIgnore: true */ pdfEntry) as typeof import("pdfjs-dist/legacy/build/pdf.mjs");
  const loading = pdfjs.getDocument({
    data: new Uint8Array(await source.arrayBuffer()),
    isEvalSupported: false,
    useSystemFonts: true,
    useWorkerFetch: false,
    disableFontFace: true,
    standardFontDataUrl: new URL("../../standard_fonts/", pdfEntry).href,
    maxImageSize: 32_000_000,
  });
  try {
    const pdf = await loading.promise;
    const page = await pdf.getPage(1);
    const original = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({
      scale: Math.min(COVER_SIZE / original.width, COVER_SIZE / original.height, 1),
    });
    const factory = pdf.canvasFactory as {
      create(width: number, height: number): {
        canvas: HTMLCanvasElement & { toBuffer(type: "image/webp"): Uint8Array };
        context: CanvasRenderingContext2D;
      };
    };
    const { canvas, context } = factory.create(
      Math.max(1, Math.ceil(viewport.width)),
      Math.max(1, Math.ceil(viewport.height)),
    );
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    return new Blob([new Uint8Array(canvas.toBuffer("image/webp"))], { type: "image/webp" });
  } finally {
    await loading.destroy();
  }
}

export async function loadDocumentCover(
  storage: SupabaseClient["storage"],
  tenantId: string,
  bucket: string,
  path: string,
) {
  const extension = path.split(".").at(-1)?.toLowerCase();
  const isPdf = extension === "pdf";
  if (!isPdf && !["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(extension ?? "")) return null;

  const files = storage.from(bucket);
  const { data: info } = await files.info(path);
  const size = info?.size ?? Number(info?.metadata?.size);
  const version = info?.version ?? info?.etag ?? info?.updatedAt;
  if (!version || !Number.isFinite(size) || size <= 0 || size > MAX_SOURCE_BYTES) return null;

  const key = JSON.stringify([tenantId, bucket, path, version]);
  const cached = covers.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    covers.delete(key);
    covers.set(key, cached);
    return cached.image;
  }
  const pending = pendingCovers.get(key);
  if (pending) return pending;
  if (pendingCovers.size >= MAX_RENDERERS) return null;

  const job = (async () => {
    try {
      const { data: source } = await files.download(path);
      if (!source || source.size > MAX_SOURCE_BYTES) return null;
      const image = await renderCover(source, isPdf);
      if (!image.size || image.size > 256 * 1024) return null;
      if (covers.size >= MAX_CACHED_COVERS) {
        const oldest = covers.keys().next().value;
        if (oldest !== undefined) covers.delete(oldest);
      }
      covers.set(key, { image, expiresAt: Date.now() + APP_CACHE_TTL_MS });
      return image;
    } catch {
      return null;
    } finally {
      pendingCovers.delete(key);
    }
  })();
  pendingCovers.set(key, job);
  return job;
}
