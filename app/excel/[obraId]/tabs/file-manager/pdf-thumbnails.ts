/**
 * PDF.js loading and first-page thumbnail generation for the file manager.
 *
 * Thumbnails render one at a time (see `enqueuePdfThumbnailTask`) and during
 * idle time (`scheduleIdleThumbnailTask`) so grids with many PDFs don't
 * saturate the main thread. Results are memoized in `pdfThumbnailCache` by
 * storage path for the lifetime of the page.
 */

export function clonePdfBytes(pdfBytes: Uint8Array) {
  return pdfBytes.slice();
}

type PdfViewport = {
  width: number;
  height: number;
};

type PdfPageProxy = {
  getViewport(options: { scale: number }): PdfViewport;
  render(params: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }): { promise: Promise<void> };
};

export type PdfDocumentProxy = {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageProxy>;
  destroy?: () => void | Promise<void>;
};

export type PdfJsModule = {
  GlobalWorkerOptions?: { workerSrc: string };
  getDocument(params: { data: Uint8Array; disableWorker?: boolean }): { promise: Promise<PdfDocumentProxy> };
};

let pdfJsModulePromise: Promise<PdfJsModule> | null = null;

export function loadPdfJs() {
  pdfJsModulePromise ??= import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfjsModule) => {
    const pdfjs = pdfjsModule as unknown as PdfJsModule;
    if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString();
    }
    return pdfjs;
  });
  return pdfJsModulePromise;
}

const PDF_THUMBNAIL_MAX_SIZE = 220;
const PDF_THUMBNAIL_IDLE_TIMEOUT_MS = 1_500;
const PDF_THUMBNAIL_FALLBACK_DELAY_MS = 250;
let activePdfThumbnailTasks = 0;
const pendingPdfThumbnailTasks: Array<() => void> = [];

export function enqueuePdfThumbnailTask<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      activePdfThumbnailTasks += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          activePdfThumbnailTasks = Math.max(0, activePdfThumbnailTasks - 1);
          const nextTask = pendingPdfThumbnailTasks.shift();
          if (nextTask) nextTask();
        });
    };

    if (activePdfThumbnailTasks < 1) {
      run();
    } else {
      pendingPdfThumbnailTasks.push(run);
    }
  });
}

export function scheduleIdleThumbnailTask(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  const idleWindow = window as typeof window & {
    requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

  if (typeof idleWindow.requestIdleCallback === 'function') {
    const handle = idleWindow.requestIdleCallback(callback, { timeout: PDF_THUMBNAIL_IDLE_TIMEOUT_MS });
    return () => idleWindow.cancelIdleCallback?.(handle);
  }

  const timeout = window.setTimeout(callback, PDF_THUMBNAIL_FALLBACK_DELAY_MS);
  return () => window.clearTimeout(timeout);
}

export async function renderPdfFirstPageThumbnail(pdfBytes: Uint8Array) {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({ data: clonePdfBytes(pdfBytes) });
  const pdf = await loadingTask.promise;

  try {
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const scale = Math.min(
      PDF_THUMBNAIL_MAX_SIZE / viewport.width,
      PDF_THUMBNAIL_MAX_SIZE / viewport.height,
      1
    );
    const scaledViewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    canvas.width = Math.max(1, Math.floor(scaledViewport.width));
    canvas.height = Math.max(1, Math.floor(scaledViewport.height));
    await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
    return canvas.toDataURL('image/png');
  } finally {
    if (typeof pdf.destroy === 'function') {
      await pdf.destroy();
    }
  }
}

export const pdfThumbnailCache = new Map<string, string>();

export function scheduleThumbnailRetry(callback: () => void) {
  return setTimeout(callback, 800);
}

export const buildPdfPageNumbers = (pageCount: number) =>
  Array.from({ length: Math.max(0, pageCount) }, (_, index) => index + 1);
