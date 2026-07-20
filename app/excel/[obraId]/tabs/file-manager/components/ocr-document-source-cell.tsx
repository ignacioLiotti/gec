'use client';

import { memo, useEffect, useState } from 'react';
import { FileText, Loader2, XIcon } from 'lucide-react';
import { HoverCardPortal } from '@radix-ui/react-hover-card';

import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { GlassyIcon } from '@/components/ui/glassy-icon';
import { cn } from '@/lib/utils';

import {
  getCachedBlobUrl,
  getCachedSignedUrl,
  preloadAndCacheFile,
} from '../cache';
import {
  enqueuePdfThumbnailTask,
  pdfThumbnailCache,
  renderPdfFirstPageThumbnail,
} from '../pdf-thumbnails';
import type { FileSystemItem, OcrDocumentTableRow } from '../types';

type OcrDocumentSourceCellProps = {
  row: OcrDocumentTableRow;
  obraId?: string;
  documentsByStoragePath: Map<string, FileSystemItem>;
  getDocumentSignedUrl: (storagePath: string, expiresIn?: number) => Promise<string | null>;
  downloadStoredDocumentBytes: (storagePath: string) => Promise<Uint8Array>;
};

/**
 * "Source document" cell for extracted-data tables: shows the linked file's
 * name/path and, on hover, a lazy preview (image or PDF first page). The
 * preview is only fetched after the first hover (`hasRequestedPreview`) and
 * reuses the shared blob/signed-URL/PDF-thumbnail caches. Rows without a
 * linked document render an explicit "no file" state — the link back to
 * evidence is a lineage guarantee, so its absence must be visible.
 */
export const OcrDocumentSourceCell = memo(function OcrDocumentSourceCell({
  row,
  obraId,
  documentsByStoragePath,
  getDocumentSignedUrl,
  downloadStoredDocumentBytes,
}: OcrDocumentSourceCellProps) {
  const docPath: string | null =
    typeof (row as Record<string, unknown>).__docPath === 'string'
      ? (row as Record<string, unknown>).__docPath as string
      : null;
  const docName: string =
    typeof (row as Record<string, unknown>).__docFileName === 'string'
      ? (row as Record<string, unknown>).__docFileName as string
      : docPath?.split('/').pop() ?? 'Documento sin nombre';
  const relativePath: string =
    docPath && obraId && docPath.startsWith(`${obraId}/`)
      ? docPath.slice(obraId.length + 1)
      : docPath ?? 'Sin ruta';
  const docItem = docPath ? documentsByStoragePath.get(docPath) ?? null : null;
  const storagePath: string | null = docItem?.storagePath ?? docPath ?? null;
  const docNameLower = docName.toLowerCase();
  const pathLower = (storagePath ?? '').toLowerCase();
  const mimeLower = (docItem?.mimetype ?? '').toLowerCase();
  const isImage =
    mimeLower.startsWith('image/') ||
    docNameLower.endsWith('.png') ||
    docNameLower.endsWith('.jpg') ||
    docNameLower.endsWith('.jpeg') ||
    docNameLower.endsWith('.webp') ||
    docNameLower.endsWith('.gif');
  const isPdf =
    mimeLower.includes('pdf') ||
    docNameLower.endsWith('.pdf') ||
    pathLower.endsWith('.pdf');
  const isPreviewable = isImage || isPdf;

  const [previewUrl, setPreviewUrl] = useState<string | null>(() => {
    if (!storagePath || !isPreviewable) return null;
    if (isPdf) {
      return pdfThumbnailCache.get(storagePath) ?? null;
    }
    return getCachedBlobUrl(storagePath) ?? getCachedSignedUrl(storagePath) ?? null;
  });
  const [hasRequestedPreview, setHasRequestedPreview] = useState<boolean>(() => Boolean(previewUrl));
  const [hoverOpen, setHoverOpen] = useState(false);

  useEffect(() => {
    if (!hasRequestedPreview || !storagePath || !isPreviewable) return;
    let isMounted = true;
    const applyPreview = (url: string | null) => {
      if (isMounted) {
        setPreviewUrl(url);
      }
    };

    (async () => {
      const getSignedUrl = async () => {
        const signedUrl = await getDocumentSignedUrl(storagePath, 3600).catch(() => null);
        if (!isMounted || !signedUrl) return null;
        return signedUrl;
      };

      if (isPdf) {
        const cachedPdfThumb = pdfThumbnailCache.get(storagePath);
        if (cachedPdfThumb) {
          applyPreview(cachedPdfThumb);
          return;
        }

        const sourceUrl = getCachedSignedUrl(storagePath) ?? (await getSignedUrl());
        if (!isMounted || !sourceUrl) return;

        let pdfBytes: Uint8Array | null = null;
        try {
          const response = await fetch(sourceUrl, { cache: 'no-store' });
          if (response.ok) {
            pdfBytes = new Uint8Array(await response.arrayBuffer());
          }
        } catch {
          // Fall back to direct storage download below.
        }

        if (!pdfBytes) {
          pdfBytes = await downloadStoredDocumentBytes(storagePath).catch(() => null);
        }

        if (!isMounted || !pdfBytes) return;

        try {
          const dataUrl = await enqueuePdfThumbnailTask(() => renderPdfFirstPageThumbnail(pdfBytes));
          if (!dataUrl) return;
          pdfThumbnailCache.set(storagePath, dataUrl);
          applyPreview(dataUrl);
        } catch (error) {
          console.error('OCR source PDF preview generation failed:', error);
          applyPreview(null);
        }
        return;
      }

      const cachedBlob = getCachedBlobUrl(storagePath);
      if (cachedBlob) {
        applyPreview(cachedBlob);
        return;
      }

      const cachedSigned = getCachedSignedUrl(storagePath);
      if (cachedSigned) {
        applyPreview(cachedSigned);
        const blobUrl = await preloadAndCacheFile(cachedSigned, storagePath);
        if (isMounted) {
          setPreviewUrl(blobUrl);
        }
        return;
      }

      const signedUrl = await getSignedUrl();
      if (!isMounted || !signedUrl) return;
      setPreviewUrl(signedUrl);

      if (isImage) {
        const blobUrl = await preloadAndCacheFile(signedUrl, storagePath);
        if (isMounted) {
          setPreviewUrl(blobUrl);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [
    downloadStoredDocumentBytes,
    getDocumentSignedUrl,
    hasRequestedPreview,
    isImage,
    isPdf,
    isPreviewable,
    storagePath,
  ]);

  if (!docPath) {
    return (
      <div className="flex items-center justify-start gap-3 text-xs text-stone-500 h-full w-full pl-2">
        <div className="min-w-7 min-h-7 rounded-md border border-muted-foreground/40 bg-muted-foreground/10 flex items-center justify-center relative">
          <FileText className="size-5 text-muted-foreground" aria-hidden="true" />
          {/* a span that is a dash across the file icon */}
          <XIcon className="size-9 text-muted-foreground opacity-60 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden="true" />
        </div>
        <p className="font-semibold text-stone-700 truncate">No hay archivo vinculado</p>
      </div>
    );
  }

  return (
    <HoverCard
      open={hoverOpen}
      onOpenChange={(open) => {
        setHoverOpen(open);
        if (open && !hasRequestedPreview) {
          setHasRequestedPreview(true);
        }
      }}
      openDelay={150}
      closeDelay={120}
    >
      <HoverCardTrigger asChild>
        <div className="flex items-center justify-start gap-3 min-w-0 cursor-default h-full w-full pl-2">
          <GlassyIcon size={7} primaryVar="var(--color-orange-primary)" className="w-7">
            <FileText className="size-4.5 text-amber-500" aria-hidden="true" />
          </GlassyIcon>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-stone-800 truncate">{docName}</span>
            <span className="text-[11px] text-stone-500 truncate">{relativePath}</span>
          </div>
        </div>
      </HoverCardTrigger>
      <HoverCardPortal>

        <HoverCardContent align="start" side="right" className="w-[260px] p-0 rounded-none">
          <div className="px-3 py-2 border-b border-stone-100">
            <p className="text-xs font-semibold text-stone-800 truncate">{docName}</p>
            <p className="text-[11px] text-stone-500 truncate">{relativePath}</p>
          </div>
          <div className="w-full h-[260px] bg-stone-50 flex items-center justify-center overflow-hidden">
            {previewUrl ? (
              <div className="relative w-full h-full bg-white">
                <img
                  src={previewUrl}
                  alt={docName ?? 'Vista previa'}
                  className={cn(
                    'w-full h-full',
                    isPdf ? 'object-contain p-2 bg-stone-100' : 'object-cover'
                  )}
                />
                {isPdf ? (
                  <span className="absolute top-2 right-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    PDF
                  </span>
                ) : null}
              </div>
            ) : hasRequestedPreview && isPreviewable ? (
              <div className="flex flex-col items-center justify-center gap-2 text-xs text-stone-500 p-4">
                <Loader2 className="size-5 text-stone-400 animate-spin" />
                <span className="text-center leading-tight">Cargando vista previa?</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-xs text-stone-500 p-4">
                <FileText className="size-6 text-stone-400" />
                <span className="text-center leading-tight">Vista previa no disponible para este documento.</span>
              </div>
            )}
          </div>
        </HoverCardContent>
      </HoverCardPortal>
    </HoverCard>
  );
});
