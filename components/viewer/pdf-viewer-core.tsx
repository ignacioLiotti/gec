'use client';

import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure worker to match installed pdfjs-dist version to avoid mismatch errors
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// Keep this in sync with the `file` type accepted by `react-pdf`'s `Document`.
type PDFFile = string | { data: Uint8Array<ArrayBufferLike> };

type PDFDocumentProps = {
  file: PDFFile;
  onLoadSuccess: (pdf: { numPages: number }) => void;
  children: React.ReactNode;
};

export function PDFDocument({ file, onLoadSuccess, children }: PDFDocumentProps) {
  return (
    <Document
      file={file}
      options={{
        disableStream: true,
        disableAutoFetch: true,
      }}
      onLoadSuccess={onLoadSuccess}
      loading={
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      }
      error={
        <div className="flex items-center justify-center p-8 text-destructive">
          <div className="text-center">
            <p className="font-semibold mb-2">Error loading PDF</p>
            <p className="text-sm">Please try downloading the file</p>
          </div>
        </div>
      }
    >
      {children}
    </Document>
  );
}

type PDFPageProps = {
  pageNumber: number;
  scale?: number;
  rotate?: number;
  width?: number;
  renderTextLayer?: boolean;
  renderAnnotationLayer?: boolean;
  className?: string;
};

export function PDFPage({
  pageNumber,
  scale,
  rotate,
  width,
  renderTextLayer = true,
  renderAnnotationLayer = true,
  className,
}: PDFPageProps) {
  return (
    <Page
      pageNumber={pageNumber}
      scale={scale}
      rotate={rotate}
      width={width}
      renderTextLayer={renderTextLayer}
      renderAnnotationLayer={renderAnnotationLayer}
      className={className}
    />
  );
}
