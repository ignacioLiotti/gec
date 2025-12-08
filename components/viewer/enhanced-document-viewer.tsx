'use client';

/**
 * Enhanced Document Viewer - Option A Implementation
 *
 * Current Features:
 * - PDF pagination with keyboard navigation (← → PageUp PageDown)
 * - Zoom controls (+/- keys, buttons, fit-to-width)
 * - Image zoom and pan with mouse/touch gestures
 * - Rotation for PDFs and images
 * - Download button
 * - Responsive layout
 *
 * Future Expansion (Option B):
 * TODO: Add thumbnail sidebar for PDFs
 * TODO: Add PDF search functionality
 * TODO: Add PDF text selection and copy
 * TODO: Add annotation tools (highlight, comments)
 * TODO: Add bookmarks/outline sidebar
 * TODO: Add dark mode toggle for PDFs
 * TODO: Add print functionality
 * TODO: Remember zoom/page preferences per document
 * TODO: Add fullscreen mode
 * TODO: Add comparison view (side-by-side)
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  List,
  Maximize,
} from 'lucide-react';

// Dynamically import PDF components (client-side only)
const PDFDocument = dynamic(
  () => import('./pdf-viewer-core').then((mod) => mod.PDFDocument),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    ),
  }
);

const PDFPage = dynamic(
  () => import('./pdf-viewer-core').then((mod) => mod.PDFPage),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
      </div>
    ),
  }
);

type DocumentViewerProps = {
  url: string;
  fileName: string;
  fileType: 'pdf' | 'image';
  onDownload?: () => void;
};

export function EnhancedDocumentViewer({
  url,
  fileName,
  fileType,
  onDownload,
}: DocumentViewerProps) {
  // Client-side only check
  const [isClient, setIsClient] = useState(false);

  // PDF state
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [rotation, setRotation] = useState<number>(0);
  const [pageWidth, setPageWidth] = useState<number>(0);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const memoizedPdfFile = useMemo(() => (pdfData ? { data: pdfData } : undefined), [pdfData]);

  // UI state
  const [showThumbnails, setShowThumbnails] = useState<boolean>(false);

  // Refs
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Ensure component only renders on client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    setNumPages(0);
    setPageNumber(1);
    setScale(1.2);
    setRotation(0);
  }, [url, fileType]);

  // Prefetch PDFs into memory to avoid stream errors when switching between viewers
  useEffect(() => {
    if (fileType !== 'pdf' || !url) {
      setPdfData(null);
      setPdfLoadError(null);
      setPdfLoading(false);
      return;
    }

    const controller = new AbortController();
    setPdfLoading(true);
    setPdfLoadError(null);
    setPdfData(null);

    const fetchPdf = async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF (status ${response.status})`);
        }
        const buffer = await response.arrayBuffer();
        if (!controller.signal.aborted) {
          setPdfData(new Uint8Array(buffer));
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        console.error('Error fetching PDF data:', error);
        if (!controller.signal.aborted) {
          setPdfLoadError('No se pudo cargar el PDF');
        }
      } finally {
        if (!controller.signal.aborted) {
          setPdfLoading(false);
        }
      }
    };

    void fetchPdf();
    return () => controller.abort();
  }, [fileType, url]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (fileType !== 'pdf') return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          goToPrevPage();
          break;
        case 'ArrowRight':
        case 'PageDown':
          e.preventDefault();
          goToNextPage();
          break;
        case '+':
        case '=':
          e.preventDefault();
          zoomIn();
          break;
        case '-':
        case '_':
          e.preventDefault();
          zoomOut();
          break;
        case '0':
          e.preventDefault();
          resetZoom();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pageNumber, numPages, scale, fileType]);

  // Calculate fit-to-width on container resize
  useEffect(() => {
    const updatePageWidth = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        setPageWidth(containerWidth - 100); // Subtract padding
      }
    };

    updatePageWidth();
    window.addEventListener('resize', updatePageWidth);
    return () => window.removeEventListener('resize', updatePageWidth);
  }, []);

  // PDF handlers
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages));
  };

  const goToPage = (page: number) => {
    setPageNumber(Math.max(1, Math.min(page, numPages)));
  };

  const zoomIn = () => {
    if (fileType === 'pdf') {
      setScale((prev) => Math.min(prev + 0.2, 3));
    } else if (transformRef.current) {
      transformRef.current.zoomIn(0.2);
    }
  };

  const zoomOut = () => {
    if (fileType === 'pdf') {
      setScale((prev) => Math.max(prev - 0.2, 0.5));
    } else if (transformRef.current) {
      transformRef.current.zoomOut(0.2);
    }
  };

  const resetZoom = () => {
    if (fileType === 'pdf') {
      setScale(1);
    } else if (transformRef.current) {
      transformRef.current.resetTransform();
    }
  };

  const fitToWidth = () => {
    if (fileType === 'pdf') {
      setScale(1.5);
    } else if (transformRef.current) {
      transformRef.current.resetTransform();
      setTimeout(() => transformRef.current?.zoomToElement('image-element', 1.5), 100);
    }
  };

  const rotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Get current zoom percentage
  const getCurrentZoom = () => {
    if (fileType === 'pdf') {
      return Math.round(scale * 100);
    }

    const currentScale = transformRef.current?.state?.scale ?? 1;
    return Math.round(currentScale * 100);
  };

  // Render toolbar
  const renderToolbar = () => (
    <div className="flex flex-col gap-2 p-3 border-b bg-muted/30">
      {/* Top toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* File name */}
          <span className="text-sm font-medium truncate max-w-[200px]">{fileName}</span>
          {numPages > 0 && <Badge variant="outline">{numPages} pages</Badge>}
        </div>

        <div className="flex items-center gap-2">
          {/* PDF-specific controls */}
          {fileType === 'pdf' && (
            <>
              <Button
                variant={showThumbnails ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowThumbnails(!showThumbnails)}
                title="Toggle thumbnails"
              >
                <List className="w-4 h-4" />
              </Button>
              <Separator orientation="vertical" className="h-6" />
            </>
          )}

          {/* Download button */}
          {onDownload && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDownload}
              title="Download"
            >
              <Download className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Bottom toolbar - Controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <Button
            variant="outline"
            size="sm"
            onClick={zoomOut}
            title="Zoom out (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium min-w-[60px] text-center">
            {getCurrentZoom()}%
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={zoomIn}
            title="Zoom in (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fitToWidth}
            title="Fit to width"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={rotate}
            title="Rotate (90°)"
          >
            <RotateCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Page navigation for PDFs */}
        {fileType === 'pdf' && numPages > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevPage}
              disabled={pageNumber <= 1}
              title="Previous page (←)"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={1}
                max={numPages}
                value={pageNumber}
                onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
                className="w-16 h-8 text-center text-sm"
              />
              <span className="text-sm text-muted-foreground">/ {numPages}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextPage}
              disabled={pageNumber >= numPages}
              title="Next page (→)"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  // Render PDF thumbnails sidebar
  const renderThumbnails = () => {
    return (
      <div className="w-48 border-r bg-muted/20 overflow-y-auto p-2 space-y-2">
        <div className="text-xs font-semibold text-muted-foreground px-2 py-1">
          Pages
        </div>
        {Array.from({ length: numPages }, (_, i) => i + 1).map((page) => (
          <button
            key={page}
            onClick={() => goToPage(page)}
            className={`w-full p-2 rounded border-2 transition-colors ${
              page === pageNumber
                ? 'border-primary bg-primary/10'
                : 'border-transparent hover:border-muted-foreground/20 hover:bg-muted/40'
            }`}
          >
            <div className="h-24 w-full rounded border bg-background flex items-center justify-center text-xs text-muted-foreground">
              Page {page}
            </div>
            <div className="text-xs text-center mt-1 font-medium">
              {page}
            </div>
          </button>
        ))}
      </div>
    );
  };

  // Show loading state on server or until client is ready
  if (!isClient) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Render PDF viewer
  if (fileType === 'pdf') {
    return (
      <div className="h-full flex flex-col bg-muted/10">
        {renderToolbar()}
        <div className="flex-1 flex overflow-hidden" ref={containerRef}>
          {/* Thumbnails sidebar */}
          {showThumbnails && renderThumbnails()}

          {/* Main PDF viewer */}
          <div className="flex-1 overflow-auto bg-muted/20 p-4">
            <div className="flex justify-center">
              {pdfLoading && (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              )}

              {pdfLoadError && (
                <div className="text-center text-destructive">
                  <p className="font-semibold mb-2">{pdfLoadError}</p>
                  <p className="text-sm">Descargá el archivo para verlo.</p>
                </div>
              )}

              {!pdfLoading && !pdfLoadError && memoizedPdfFile && (
                <PDFDocument
                  file={memoizedPdfFile}
                  onLoadSuccess={onDocumentLoadSuccess}
                >
                  <PDFPage
                    pageNumber={pageNumber}
                    scale={scale}
                    rotate={rotation}
                    width={pageWidth || undefined}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    className="shadow-lg"
                  />
                </PDFDocument>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render image viewer with zoom/pan
  return (
    <div className="h-full flex flex-col bg-muted/10">
      {renderToolbar()}
      <div className="flex-1 overflow-hidden bg-muted/20" ref={containerRef}>
        <TransformWrapper
          ref={transformRef}
          initialScale={1}
          minScale={0.5}
          maxScale={5}
          centerOnInit={true}
          wheel={{ step: 0.1 }}
          doubleClick={{ mode: 'zoomIn' }}
        >
          {() => (
            <TransformComponent
              wrapperClass="!w-full !h-full"
              contentClass="!w-full !h-full flex items-center justify-center"
            >
              <img
                id="image-element"
                src={url}
                alt={fileName}
                className="max-w-full max-h-full object-contain"
                style={{
                  transform: `rotate(${rotation}deg)`,
                }}
              />
            </TransformComponent>
          )}
        </TransformWrapper>
      </div>
    </div>
  );
}
