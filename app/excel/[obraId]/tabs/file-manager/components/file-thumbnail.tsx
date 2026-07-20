'use client';

import { memo, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import {
  getCachedBlobUrl,
  getCachedSignedUrl,
  preloadAndCacheFile,
} from '../cache';
import { IMAGE_FILE_EXTENSIONS } from '../file-manager-utils';
import {
  enqueuePdfThumbnailTask,
  pdfThumbnailCache,
  renderPdfFirstPageThumbnail,
  scheduleIdleThumbnailTask,
  scheduleThumbnailRetry,
} from '../pdf-thumbnails';
import { useNearViewport } from '../hooks/use-near-viewport';
import type { OcrStatusBadgeContext } from '../ocr-status';
import type { FileSystemItem } from '../types';

export type FileThumbnailProps = {
  item: FileSystemItem;
  getDocumentSignedUrl: (storagePath: string, expiresIn?: number) => Promise<string | null>;
  downloadStoredDocumentBytes: (storagePath: string) => Promise<Uint8Array>;
  getFileIcon: (mimetype?: string) => ReactNode;
  renderOcrStatusBadge: (item: FileSystemItem, context?: OcrStatusBadgeContext) => ReactNode;
  /** When true, omit the filename strip on image/PDF previews (e.g. when the parent already shows the name). */
  hideCaption?: boolean;
};

/**
 * Lazy image/PDF thumbnail tile. Loading is deferred until the tile nears
 * the viewport, resolves through the blob → signed-URL caches before hitting
 * the network, and PDF first pages render through the shared one-at-a-time
 * thumbnail queue. Retries a few times for fresh uploads whose signed URL
 * isn't available yet.
 */
export const FileThumbnail = memo(function FileThumbnail({
  item,
  getDocumentSignedUrl,
  downloadStoredDocumentBytes,
  getFileIcon,
  renderOcrStatusBadge,
  hideCaption = false,
}: FileThumbnailProps) {
  const storagePath = item.storagePath;
  const fileExt = item.name.toLowerCase().split('.').pop() ?? '';
  const isImageFile =
    Boolean(item.mimetype?.startsWith('image/')) ||
    IMAGE_FILE_EXTENSIONS.has(fileExt);
  const isPdfFile = item.mimetype === 'application/pdf' || fileExt === 'pdf';
  const isPreviewableFile = isImageFile || isPdfFile;
  // Check blob cache first, then signed URL cache
  const initialUrl = storagePath
    ? (isPdfFile
      ? (pdfThumbnailCache.get(storagePath) ?? null)
      : (getCachedBlobUrl(storagePath) ?? getCachedSignedUrl(storagePath)))
    : null;
  const [thumbState, setThumbState] = useState<{
    storagePath: string | null;
    url: string | null;
    retryCount: number;
  }>({
    storagePath: storagePath ?? null,
    url: initialUrl,
    retryCount: 0,
  });
  const activeThumbState = thumbState.storagePath === (storagePath ?? null) ? thumbState : null;
  const thumbUrl = activeThumbState?.url ?? initialUrl;
  const retryCount = activeThumbState?.retryCount ?? 0;
  const [thumbnailRef, shouldLoadThumbnail] = useNearViewport<HTMLDivElement>();

  useEffect(() => {
    if (!storagePath || !isPreviewableFile || !shouldLoadThumbnail) {
      return;
    }

    if (isPdfFile) {
      const cachedPdfThumb = pdfThumbnailCache.get(storagePath);
      if (cachedPdfThumb) {
        queueMicrotask(() => {
          setThumbState({ storagePath, url: cachedPdfThumb, retryCount: 0 });
        });
        return;
      }
    }

    // Check blob cache first (instant, no network)
    const cachedBlob = getCachedBlobUrl(storagePath);
    if (cachedBlob && isImageFile) {
      return;
    }

    // Check signed URL cache
    const cachedSignedUrl = getCachedSignedUrl(storagePath);
    if (cachedSignedUrl && isImageFile) {
      // Preload to blob cache in background
      preloadAndCacheFile(cachedSignedUrl, storagePath).then((blobUrl) => {
        setThumbState({ storagePath, url: blobUrl, retryCount: 0 });
      });
      return;
    }

    let isMounted = true;
    const retryTimeouts: ReturnType<typeof setTimeout>[] = [];

    const cancelIdleTask = scheduleIdleThumbnailTask(() => {
      void (async () => {
        const getSignedUrl = async () => {
          let signedUrl: string | null = null;
          try {
            signedUrl = await getDocumentSignedUrl(storagePath, 3600);
          } catch (error) {
            console.warn('Document thumbnail access failed:', error);
            return null;
          }
          if (!isMounted || !signedUrl) {
            // Fresh uploads can take a short moment before signed URL is available.
            if (isMounted && retryCount < 5) {
              const retryTimeout = scheduleThumbnailRetry(() => {
                if (isMounted) {
                  setThumbState((prev) => ({
                    storagePath,
                    url: prev.storagePath === storagePath ? prev.url : null,
                    retryCount: (prev.storagePath === storagePath ? prev.retryCount : 0) + 1,
                  }));
                }
              });
              retryTimeouts.push(retryTimeout);
            }
            return null;
          }
          return signedUrl;
        };

        const signedUrl = await getSignedUrl();
        if (!isMounted || !signedUrl) return;

        if (isPdfFile) {
          try {
            const dataUrl = await enqueuePdfThumbnailTask(async () => {
              const cachedPdfThumb = pdfThumbnailCache.get(storagePath);
              if (cachedPdfThumb) return cachedPdfThumb;

              let pdfBytes: Uint8Array | null = null;
              try {
                const response = await fetch(signedUrl, { cache: 'force-cache' });
                if (response.ok) {
                  pdfBytes = new Uint8Array(await response.arrayBuffer());
                }
              } catch {
                // Fall back to direct storage download below.
              }

              if (!pdfBytes) {
                pdfBytes = await downloadStoredDocumentBytes(storagePath).catch(() => null);
              }
              if (!pdfBytes) return null;

              const thumbnail = await renderPdfFirstPageThumbnail(pdfBytes);
              if (thumbnail) {
                pdfThumbnailCache.set(storagePath, thumbnail);
              }
              return thumbnail;
            });
            if (isMounted && dataUrl) {
              setThumbState({ storagePath, url: dataUrl, retryCount: 0 });
            }
          } catch (error) {
            console.warn('PDF thumbnail generation failed:', error);
          }
          return;
        }

        // Set signed URL first for immediate display
        setThumbState({ storagePath, url: signedUrl, retryCount: 0 });
        // Then preload to blob cache
        const blobUrl = await preloadAndCacheFile(signedUrl, storagePath);
        if (isMounted) {
          setThumbState({ storagePath, url: blobUrl, retryCount: 0 });
        }
      })();
    });

    return () => {
      isMounted = false;
      cancelIdleTask();
      retryTimeouts.forEach(clearTimeout);
    };
  }, [
    downloadStoredDocumentBytes,
    getDocumentSignedUrl,
    isImageFile,
    isPdfFile,
    isPreviewableFile,
    retryCount,
    shouldLoadThumbnail,
    storagePath,
  ]);

  if (thumbUrl) {
    return (
      <div ref={thumbnailRef} className="relative w-full h-full">
        <img
          src={thumbUrl}
          alt={item.name}
          className="w-full h-full object-cover rounded-none"
          loading="eager"
          decoding="async"
        />
        <div className="absolute right-2 top-2 z-20">
          {renderOcrStatusBadge(item, "thumbnail")}
        </div>
        {hideCaption ? null : (
          <span
            className="text-sm text-center truncate w-full text-stone-700 absolute bottom-0 left-0 right-0 px-2 py-1 bg-stone-200/50 backdrop-blur-sm"
            title={item.name}
          >
            {item.name}
          </span>
        )}
      </div>
    );
  }

  return (
    <div ref={thumbnailRef} className="relative w-full h-full text-primary p-2">
      {getFileIcon(item.mimetype)}
      <div className="absolute left-2 top-2 z-20">
        {renderOcrStatusBadge(item, "thumbnail")}
      </div>
    </div>
  );
});
