"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Archive,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileCheck2,
  FileText,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  UserRound,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { DocumentApprovedSeal } from "@/components/document-approved-seal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import FolderFront from "@/components/ui/FolderFront";
import { Input } from "@/components/ui/input";
import { sidebarMenuButtonVariants } from "@/components/ui/sidebar-menu-button-variants";
import { formatDocumentTypeLabel } from "@/lib/document-generation";
import { cn } from "@/lib/utils";

type ApprovedDocumentItem = {
  id: string;
  workId: string;
  workLabel: string;
  folderPath: string;
  documentType: string;
  templateName: string | null;
  fileName: string;
  status: string;
  storagePath?: string;
  previewHtml?: string;
  generatedAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    fullName: string | null;
    email: string | null;
    label: string;
  } | null;
  canEdit: boolean;
};

type ApprovedDocumentsResponse = {
  documents?: ApprovedDocumentItem[];
  error?: string;
};

type GeneratedDocumentDetailResponse = {
  document?: ApprovedDocumentItem;
  error?: string;
};

type WorkGroup = {
  workId: string;
  workLabel: string;
  documents: ApprovedDocumentItem[];
};

type TypeGroup = {
  documentType: string;
  label: string;
  total: number;
  works: WorkGroup[];
};

type ApprovedDocumentsView = "pending" | "resolved";

const EMPTY_APPROVED_DOCUMENTS: ApprovedDocumentItem[] = [];
const RESOLVED_DOCUMENTS_STORAGE_KEY = "document-generation:approved-documents:resolved:v1";
const DOCUMENT_PREVIEW_ZOOM_MIN = 0.6;
const DOCUMENT_PREVIEW_ZOOM_MAX = 2;
const DOCUMENT_PREVIEW_ZOOM_STEP = 0.1;
const VIEWER_CONTROL_BUTTON_CLASS =
  "transition-[background-color,box-shadow,transform,color] duration-150 active:translate-y-px disabled:opacity-60";

async function fetchApprovedDocuments() {
  const response = await fetch("/api/document-generation/generated?status=APPROVED&summary=1", {
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as ApprovedDocumentsResponse;
  if (!response.ok) {
    throw new Error(payload.error || "No se pudieron cargar documentos aprobados");
  }
  return payload.documents ?? [];
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDocumentType(value: string) {
  return formatDocumentTypeLabel(value) || value.replace(/_/g, " ").toLowerCase();
}

function getDocumentTitle(document: ApprovedDocumentItem) {
  return document.fileName || document.templateName || formatDocumentType(document.documentType);
}

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function groupApprovedDocuments(documents: ApprovedDocumentItem[]) {
  const typeMap = new Map<string, Map<string, WorkGroup>>();

  for (const document of documents) {
    const documentType = document.documentType || "CUSTOM";
    const workId = document.workId || "sin-obra";
    let worksById = typeMap.get(documentType);
    if (!worksById) {
      worksById = new Map();
      typeMap.set(documentType, worksById);
    }

    let workGroup = worksById.get(workId);
    if (!workGroup) {
      workGroup = {
        workId,
        workLabel: document.workLabel || "Obra sin nombre",
        documents: [],
      };
      worksById.set(workId, workGroup);
    }

    workGroup.documents.push(document);
  }

  return Array.from(typeMap.entries())
    .map(([documentType, worksById]) => {
      const works = Array.from(worksById.values())
        .map((work) => ({
          ...work,
          documents: work.documents.toSorted(
            (left, right) =>
              new Date(right.updatedAt || right.generatedAt).getTime() -
              new Date(left.updatedAt || left.generatedAt).getTime(),
          ),
        }))
        .toSorted((left, right) =>
          left.workLabel.localeCompare(right.workLabel, "es", {
            sensitivity: "base",
          }),
        );

      return {
        documentType,
        label: formatDocumentType(documentType),
        total: works.reduce((sum, work) => sum + work.documents.length, 0),
        works,
      } satisfies TypeGroup;
    })
    .toSorted((left, right) => {
      if (right.total !== left.total) return right.total - left.total;
      return left.label.localeCompare(right.label, "es", { sensitivity: "base" });
    });
}

function DeskStackPreview() {
  return (
    <div className="relative mx-auto h-36 w-full max-w-[320px] flex items-end justify-center scale-120" aria-hidden="true">
      <button
        type="button"
        className={` flex flex-col items-start gap-2 p-3 pb-1 ml-1 mb-1 w-[150px] h-[105px] border rounded-lg transition-colors relative bg-linear-to-b from-amber-500 to-amber-700 group shadow-xl`}
      >
        <div className="absolute bottom-[2.55rem] left-[0.15rem] transition-all duration-300 group-hover:bottom-[3.55rem] group-hover:-left-[0.25rem] z-[3] h-[76px] w-[66px] -rotate-3 rounded-[4px] border border-[#d7dce2] bg-[linear-gradient(180deg,#ffffff_0%,#f3f5f7_100%)] shadow-[0_16px_22px_-16px_rgba(15,23,42,0.76),inset_0_1px_0_rgba(255,255,255,0.95)]" />
        <div className="absolute bottom-[2.8rem] left-[4.15rem] transition-all duration-300 group-hover:bottom-[3.8rem] group-hover:left-[4.5rem] z-[4] h-[86px] w-[74px] rotate-[2deg] rounded-[4px] border border-[#d7dce2] bg-[linear-gradient(180deg,#ffffff_0%,#f3f5f7_100%)] shadow-[0_18px_24px_-16px_rgba(15,23,42,0.75),inset_0_1px_0_rgba(255,255,255,0.95)]" />
        <div className="absolute bottom-[6.35rem] left-[5.05rem] transition-all duration-300 group-hover:bottom-[7.35rem] group-hover:left-[5.55rem] z-[5] h-px w-11 bg-[#cfd6df]" />
        <div className="absolute bottom-[6.8rem] left-[5.05rem] transition-all duration-300 group-hover:bottom-[7.8rem] group-hover:left-[5.55rem] z-[5] h-px w-8 bg-[#cfd6df]" />
        <FolderFront
          firstStopColor="#fe9a00"
          secondStopColor="#fb8634"
          className={cn("w-[105%] z-6 h-full absolute -bottom-2 -left-1 transform origin-[50%_100%] group-hover:transform-[perspective(800px)_rotateX(-30deg)] transition-transform duration-300 group-hover:transform-[perspective(800px)_rotateX(-40deg)]")} />
        <DocumentApprovedSeal status="APPROVED" size="sm" className="absolute bottom-8 left-[1rem] z-[6] scale-[1] shadow-[0_8px_18px_-14px_rgba(5,150,105,0.9)] transform origin-[100%_100%] group-hover:transform-[perspective(800px)_rotateX(-30deg)] transition-transform duration-300 group-hover:transform-[perspective(800px)_rotateX(-40deg)]" />
      </button>
    </div>
  );
}

function DocumentPreviewThumbnail({
  document,
  loadPreview,
}: {
  document: ApprovedDocumentItem;
  loadPreview?: (documentId: string) => Promise<string>;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [previewHtml, setPreviewHtml] = useState(document.previewHtml ?? "");
  const effectivePreviewHtml = previewHtml || document.previewHtml || "";

  useEffect(() => {
    if (effectivePreviewHtml || !loadPreview) return;
    const node = containerRef.current;
    if (!node) return;
    let cancelled = false;
    const requestPreview = () => {
      void loadPreview(document.id).then((html) => {
        if (!cancelled && html) setPreviewHtml(html);
      });
    };
    if (!("IntersectionObserver" in window)) {
      requestPreview();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        requestPreview();
        observer.disconnect();
      },
      { rootMargin: "80px" },
    );
    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [document.id, effectivePreviewHtml, loadPreview]);

  if (!effectivePreviewHtml) {
    return (
      <div ref={containerRef} className="relative h-40 overflow-hidden rounded-md border border-[#d7dce2] bg-[#e4e7eb] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
        <div className="absolute left-1/2 top-4 grid h-[118px] w-[88px] -translate-x-1/2 place-items-center rounded-[3px] border border-[#d7dce2] bg-white shadow-[0_14px_24px_-18px_rgba(15,23,42,0.65)]">
          <FileText className="size-7 text-[#94a3b8]" />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#e4e7eb] to-transparent" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-40 rounded-md border border-[#d7dce2] bg-[#e4e7eb] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
      <div className="flex items-start justify-center h-[235px] w-full overflow-hidden absolute left-1/2 -top-20 -translate-x-1/2 origin-top ">

        <div className=" absolute left-1/2 top-0 h-[720px] w-[520px] -translate-x-1/2 origin-top scale-[0.5] overflow-hidden rounded-sm bg-white shadow-[0_14px_30px_rgba(15,23,42,0.2)]">
          <div className="pointer-events-none" dangerouslySetInnerHTML={{ __html: effectivePreviewHtml }} />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#e4e7eb] to-transparent" />
    </div>
  );
}

function DocumentPaper({
  document,
  isResolved,
  onOpen,
  loadPreview,
}: {
  document: ApprovedDocumentItem;
  isResolved: boolean;
  onOpen: (documentId: string) => void;
  loadPreview: (documentId: string) => Promise<string>;
}) {
  const title = getDocumentTitle(document);

  return (
    <button
      type="button"
      onClick={() => onOpen(document.id)}
      className="group relative block w-full max-w-[320px] rounded-lg bg-[linear-gradient(145deg,#ffffff_0%,#fbfcfd_58%,#eef0f2_100%)] p-3 text-left shadow-card transition duration-150 hover:-translate-y-0.5 hover:border-[#c8d0da] hover:shadow-[0_16px_26px_-18px_rgba(15,23,42,0.5),inset_0_1px_0_rgba(255,255,255,0.98)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5800]/25"
    >
      <span className="absolute left-0 top-0 h-full w-[3px] bg-[#ff5800]" />
      <div className="relative flex min-h-full flex-col gap-3 pl-1">
        <DocumentPreviewThumbnail document={document} loadPreview={loadPreview} />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#334155]">
              <FileCheck2 className="size-3.5 shrink-0" />
              Aprobado
            </div>
            <h4 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-[#1f2937]">
              {title}
            </h4>
          </div>
          <DocumentApprovedSeal status="APPROVED" size="sm" className="shrink-0 scale-90" />
        </div>

        <div className="mt-auto space-y-2 text-xs text-[#64748b]">
          <div className="flex items-center justify-between gap-3 border-t border-[#d9dee5] pt-2">
            <span className="font-mono text-[11px]">{formatDate(document.updatedAt || document.generatedAt)}</span>
            <span className="inline-flex items-center gap-1 text-[#334155]">
              <UserRound className="size-3" />
              <span className="max-w-[92px] truncate">{document.createdBy?.label ?? "Usuario"}</span>
            </span>
          </div>
          {isResolved ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
              <CheckCircle2 className="size-3" />
              Resuelto
            </span>
          ) : null}
        </div>
      </div>
      <span className="absolute bottom-3 right-3 inline-flex size-7 items-center justify-center rounded-md border border-[#d7dce2] bg-white/90 text-[#334155] opacity-0 shadow-sm transition group-hover:opacity-100">
        <ArrowUpRight className="size-3.5" />
      </span>
    </button>
  );
}

function DocumentPreviewer({
  document,
  documents,
  isPreviewLoading,
  resolvedIds,
  onClose,
  onSelectDocument,
  onToggleResolved,
}: {
  document: ApprovedDocumentItem | null;
  documents: ApprovedDocumentItem[];
  isPreviewLoading: boolean;
  resolvedIds: Set<string>;
  onClose: () => void;
  onSelectDocument: (documentId: string) => void;
  onToggleResolved: (documentId: string, nextResolved: boolean) => void;
}) {
  const [previewZoom, setPreviewZoom] = useState(1);

  if (!document) return null;

  const navigationDocuments = documents.some((entry) => entry.id === document.id)
    ? documents
    : [document, ...documents];
  const selectedIndex = navigationDocuments.findIndex((entry) => entry.id === document.id);
  const canGoPrevious = selectedIndex > 0;
  const canGoNext = selectedIndex >= 0 && selectedIndex < navigationDocuments.length - 1;
  const isResolved = resolvedIds.has(document.id);
  const title = getDocumentTitle(document);
  const generatedAtLabel = (() => {
    if (!document.generatedAt) return null;
    const parsed = new Date(document.generatedAt);
    if (Number.isNaN(parsed.getTime())) return document.generatedAt;
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(parsed);
  })();
  const generatedByLabel = document.createdBy?.label ?? null;
  const zoomPercent = Math.round(previewZoom * 100);
  const canZoomOut = previewZoom > DOCUMENT_PREVIEW_ZOOM_MIN;
  const canZoomIn = previewZoom < DOCUMENT_PREVIEW_ZOOM_MAX;
  const fileKindLabel = document.fileName.toLowerCase().endsWith(".pdf") ? "PDF" : "Documento";

  const updatePreviewZoom = (nextZoom: number) => {
    setPreviewZoom(Math.min(DOCUMENT_PREVIEW_ZOOM_MAX, Math.max(DOCUMENT_PREVIEW_ZOOM_MIN, Number(nextZoom.toFixed(2)))));
  };

  const goPrevious = () => {
    if (!canGoPrevious) return;
    onSelectDocument(navigationDocuments[selectedIndex - 1].id);
  };

  const goNext = () => {
    if (!canGoNext) return;
    onSelectDocument(navigationDocuments[selectedIndex + 1].id);
  };

  const downloadDocument = () => {
    if (!document.storagePath || !document.workId) return;
    const query = new URLSearchParams({
      path: document.storagePath,
      download: "1",
    });
    const anchor = window.document.createElement("a");
    anchor.href = `/api/obras/${encodeURIComponent(document.workId)}/documents/access?${query.toString()}`;
    anchor.download = document.fileName || title;
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const viewerZoomControls = (
    <div className="flex items-center gap-2 text-sm text-slate-700">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => updatePreviewZoom(previewZoom - DOCUMENT_PREVIEW_ZOOM_STEP)}
        disabled={!canZoomOut}
        aria-label="Alejar documento"
        className={cn(VIEWER_CONTROL_BUTTON_CLASS, "h-10 w-10 rounded-full bg-white")}
      >
        <ZoomOut />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => updatePreviewZoom(1)}
        aria-label="Restablecer zoom"
        title="Restablecer zoom"
        className={cn(VIEWER_CONTROL_BUTTON_CLASS, "h-10 min-w-20 px-3 font-mono rounded-full bg-white")}
      >
        <RotateCcw />
        {zoomPercent}%
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => updatePreviewZoom(previewZoom + DOCUMENT_PREVIEW_ZOOM_STEP)}
        disabled={!canZoomIn}
        aria-label="Acercar documento"
        className={cn(VIEWER_CONTROL_BUTTON_CLASS, "h-10 w-10 rounded-full bg-white")}
      >
        <ZoomIn />
      </Button>
    </div>
  );
  const resolvedControl = (
    <label className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 px-1 text-md font-medium text-slate-700">
      <Checkbox
        checked={isResolved}
        onCheckedChange={(checked) => onToggleResolved(document.id, checked === true)}
        className="-translate-y-px size-5 border-slate-300 bg-white shadow-[0_1px_0_0_#fff_inset,0_-1px_0_0_#0000001f_inset,0_0_0_1px_#00000012,0_2px_2px_0_#0b090c0d,0_1px_1px_0_#0b090c0f,0_5px_8px_-7px_#0b090c08] transition-[box-shadow,transform] duration-[250ms] ease-[cubic-bezier(0.3,0.7,0.4,1)] active:translate-y-0 active:duration-[34ms] active:ease-linear active:shadow-[0_1px_0_0_#fff_inset,0_-1px_0_0_#0000001f_inset,0_0_0_1px_#00000012,0_1px_1px_0_#0b090c0f,0_3px_6px_-6px_#0b090c14] data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:shadow-[0_1px_0_0_#fff_inset,0_-1px_0_0_#0000001f_inset,0_0_0_1px_#00000012,0_2px_2px_0_#0b090c0d,0_1px_1px_0_#0b090c0f,0_5px_8px_-7px_#0b090c08] data-[state=checked]:active:translate-y-0 data-[state=checked]:active:shadow-[0_1px_0_0_#fff_inset,0_-1px_0_0_#0000001f_inset,0_0_0_1px_#00000012,0_1px_1px_0_#0b090c0f,0_3px_6px_-6px_#0b090c14]"
      />
      <span>Resuelto</span>
    </label>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[94dvh] !w-[min(1180px,96vw)] !max-w-[min(1180px,96vw)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#f6f7f9] p-0 shadow-[0_30px_90px_rgba(15,23,42,0.28)]"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-[#fbfcfd] px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500">
              <FileText className="size-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="truncate text-sm font-semibold text-slate-900 sm:text-base">
                {title}
              </DialogTitle>
              <p className="truncate text-xs text-slate-500">
                {fileKindLabel}
                {generatedByLabel ? ` - ${generatedByLabel}` : ""}
                {generatedAtLabel ? ` - ${generatedAtLabel}` : ""}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {document.storagePath ? (
              <Button variant="secondary" size="sm" onClick={downloadDocument} className="rounded-md ">
                Descargar
              </Button>
            ) : null}
            <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} className="rounded-full text-slate-500">
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden min-h-0 border-r border-slate-200 bg-[#f1f3f6] p-3 md:flex md:flex-col">
            <div className="min-h-0 flex-1 space-y-1 overflow-auto px-1">
              {navigationDocuments.map((entry, index) => {
                const entryIsSelected = entry.id === document.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    data-active={entryIsSelected}
                    onClick={() => onSelectDocument(entry.id)}
                    className={cn(
                      sidebarMenuButtonVariants({ size: "default" }),
                      "h-auto min-h-[58px] flex-col items-start justify-center gap-1 py-2 sm:h-auto sm:min-h-[58px]",
                    )}
                  >
                    <span className="block w-full max-w-full truncate text-sm font-medium leading-5 text-slate-800">
                      {getDocumentTitle(entry)}
                    </span>
                    <span className="block w-full max-w-full text-xs leading-4 text-slate-500">Documento {index + 1}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="min-h-0 overflow-auto bg-[#eef0f3] p-4 sm:p-5">
            {document.previewHtml ? (
              <div className="mx-auto w-fit min-w-[520px] rounded-xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.10)]">
                <div className="bg-white" style={{ zoom: previewZoom }}>
                  <div className="pointer-events-none" dangerouslySetInnerHTML={{ __html: document.previewHtml }} />
                </div>
              </div>
            ) : isPreviewLoading ? (
              <div className="grid min-h-full place-items-center rounded-xl border border-slate-200 bg-white text-center text-sm text-slate-500">
                <div>
                  <Loader2 className="mx-auto mb-4 size-8 animate-spin text-slate-400" />
                  <p>Cargando previsualizacion...</p>
                </div>
              </div>
            ) : (
              <div className="grid min-h-full place-items-center rounded-xl border border-dashed border-slate-300 bg-white text-center text-sm text-slate-400">
                <div>
                  <FileText className="mx-auto mb-4 size-16 opacity-20" />
                  <p>Vista previa no disponible para este documento</p>
                </div>
              </div>
            )}
          </main>
        </div>

        <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-[#fcfcfd] px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={goPrevious}
              disabled={!canGoPrevious}
              aria-label="Documento anterior"
              className="rounded-full text-slate-600 disabled:text-slate-300 "
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-24 text-sm font-semibold text-slate-800">
              Documento {selectedIndex + 1} de {navigationDocuments.length}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={goNext}
              disabled={!canGoNext}
              aria-label="Documento siguiente"
              className="rounded-full text-slate-600 disabled:text-slate-300"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="hidden sm:block">{viewerZoomControls}</div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden sm:block">{resolvedControl}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WorkFolder({
  group,
  resolvedIds,
  onOpenDocument,
  loadPreview,
}: {
  group: WorkGroup;
  resolvedIds: Set<string>;
  onOpenDocument: (documentId: string, groupDocuments: ApprovedDocumentItem[]) => void;
  loadPreview: (documentId: string) => Promise<string>;
}) {
  return (
    <section className="rounded-lg bg-[linear-gradient(180deg,#f8fafc_0%,#f3f4f5_100%)] p-3 shadow-card [contain-intrinsic-size:1px_560px] [content-visibility:auto]">
      <div className="mb-20 flex items-start justify-between gap-3 rounded-md   px-3 py-2 ">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Archive className="size-8 p-1 shrink-0 text-[#334155]  rounded-md " />
            <h3 className="truncate text-lg font-semibold text-[#1f2937]">{group.workLabel}</h3>
          </div>
          <p className="mt-1 font-mono text-[11px] text-[#64748b]">
            {group.documents.length} documento{group.documents.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 pl-4 pb-4">
        {group.documents.map((document, index) => (
          <div
            key={document.id}
            className={cn(index % 3 === 1 && "rotate-[0.35deg]", index % 3 === 2 && "-rotate-[0.25deg]")}
          >
            <DocumentPaper
              document={document}
              isResolved={resolvedIds.has(document.id)}
              onOpen={(documentId) => onOpenDocument(documentId, group.documents)}
              loadPreview={loadPreview}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function TypeFolder({
  group,
  resolvedIds,
  onOpenDocument,
  loadPreview,
}: {
  group: TypeGroup;
  resolvedIds: Set<string>;
  onOpenDocument: (documentId: string, groupDocuments: ApprovedDocumentItem[]) => void;
  loadPreview: (documentId: string) => Promise<string>;
}) {
  return (
    <section className="rounded-lg border border-[#d7dce2] bg-[#f8fafc]/80 p-3 shadow-[0_20px_38px_-34px_rgba(15,23,42,0.75),inset_0_1px_0_rgba(255,255,255,0.85)] [contain-intrinsic-size:1px_760px] [content-visibility:auto]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#d9dee5] bg-[#f8fafc] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
        <div className="">
          <p className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#64748b]">
            <ClipboardList className="size-3.5 text-[#ff5800]" />
            Tipo documental
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-[#1f2937]">{group.label}</h2>
          <p className="mt-1 font-mono text-[11px] text-[#64748b]">
            {group.total} aprobado{group.total === 1 ? "" : "s"} en {group.works.length} obra{group.works.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-md border border-[#d7dce2] bg-[#1f2937] px-3 py-1 font-mono text-xs font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
          {group.total}
        </div>
      </div>
      <div className="space-y-4">
        {group.works.map((work) => (
          <WorkFolder
            key={work.workId}
            group={work}
            resolvedIds={resolvedIds}
            onOpenDocument={onOpenDocument}
            loadPreview={loadPreview}
          />
        ))}
      </div>
    </section>
  );
}

export function ApprovedDocumentsPageClient() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [activeView, setActiveView] = useState<ApprovedDocumentsView>("pending");
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(() => new Set());
  const [resolvedStorageReady, setResolvedStorageReady] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [previewDocumentIds, setPreviewDocumentIds] = useState<string[]>([]);
  const [previewById, setPreviewById] = useState<Record<string, string>>({});
  const [previewLoadingIds, setPreviewLoadingIds] = useState<Set<string>>(() => new Set());
  const previewByIdRef = useRef<Record<string, string>>({});
  const previewRequestByIdRef = useRef<Map<string, Promise<string>>>(new Map());
  const approvedDocumentsQuery = useQuery({
    queryKey: ["document-generation", "generated", "approved"],
    queryFn: fetchApprovedDocuments,
    staleTime: 60 * 1000,
  });

  const documents = approvedDocumentsQuery.data ?? EMPTY_APPROVED_DOCUMENTS;
  useEffect(() => {
    previewByIdRef.current = previewById;
  }, [previewById]);

  const requestDocumentPreview = useCallback(async (
    documentId: string,
    options: { commitToState?: boolean } = {},
  ) => {
    if (!documentId) return "";
    const cachedPreview = previewByIdRef.current[documentId];
    if (cachedPreview) {
      if (options.commitToState) {
        setPreviewById((current) => (current[documentId] ? current : { ...current, [documentId]: cachedPreview }));
      }
      return cachedPreview;
    }
    const existingRequest = previewRequestByIdRef.current.get(documentId);

    if (options.commitToState) {
      setPreviewLoadingIds((current) => {
        const next = new Set(current);
        next.add(documentId);
        return next;
      });
    }

    const request =
      existingRequest ??
      (async () => {
        const response = await fetch(`/api/document-generation/generated/${encodeURIComponent(documentId)}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as GeneratedDocumentDetailResponse;
        if (!response.ok) {
          throw new Error(payload.error || "No se pudo cargar la previsualizacion");
        }
        const previewHtml = payload.document?.previewHtml ?? "";
        if (previewHtml) {
          previewByIdRef.current = {
            ...previewByIdRef.current,
            [documentId]: previewHtml,
          };
        }
        return previewHtml;
      })();

    if (!existingRequest) {
      previewRequestByIdRef.current.set(documentId, request);
    }

    try {
      const previewHtml = await request;
      if (previewHtml) {
        if (options.commitToState) {
          setPreviewById((current) => (current[documentId] ? current : { ...current, [documentId]: previewHtml }));
        }
      }
      return previewHtml;
    } catch (error) {
      console.error("[approved-documents:preview]", error);
      return "";
    } finally {
      if (!existingRequest) {
        previewRequestByIdRef.current.delete(documentId);
      }
      if (options.commitToState) {
        setPreviewLoadingIds((current) => {
          const next = new Set(current);
          next.delete(documentId);
          return next;
        });
      }
    }
  }, []);

  useEffect(() => {
    try {
      const rawValue = window.localStorage.getItem(RESOLVED_DOCUMENTS_STORAGE_KEY);
      const parsedValue = rawValue ? (JSON.parse(rawValue) as unknown) : [];
      if (Array.isArray(parsedValue)) {
        setResolvedIds(new Set(parsedValue.filter((entry): entry is string => typeof entry === "string")));
      }
    } catch {
      setResolvedIds(new Set());
    } finally {
      setResolvedStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!resolvedStorageReady) return;
    window.localStorage.setItem(RESOLVED_DOCUMENTS_STORAGE_KEY, JSON.stringify(Array.from(resolvedIds)));
  }, [resolvedIds, resolvedStorageReady]);

  const resolvedCount = useMemo(
    () => documents.filter((document) => resolvedIds.has(document.id)).length,
    [documents, resolvedIds],
  );
  const pendingCount = Math.max(documents.length - resolvedCount, 0);
  const documentsWithPreviews = useMemo(
    () =>
      documents.map((document) =>
        previewById[document.id] && document.previewHtml !== previewById[document.id]
          ? { ...document, previewHtml: previewById[document.id] }
          : document,
      ),
    [documents, previewById],
  );

  const filteredDocuments = useMemo(() => {
    const viewDocuments = documentsWithPreviews.filter((document) =>
      activeView === "resolved" ? resolvedIds.has(document.id) : !resolvedIds.has(document.id),
    );
    const query = normalizeSearchValue(deferredSearch.trim());
    if (!query) return viewDocuments;
    return viewDocuments.filter((document) =>
      normalizeSearchValue(
        [
          document.fileName,
          document.templateName,
          document.documentType,
          formatDocumentType(document.documentType),
          document.workLabel,
          document.folderPath,
          document.createdBy?.label,
        ]
          .filter(Boolean)
          .join(" "),
      ).includes(query),
    );
  }, [activeView, deferredSearch, documentsWithPreviews, resolvedIds]);
  const groupedDocuments = useMemo(() => groupApprovedDocuments(filteredDocuments), [filteredDocuments]);
  const selectedDocument = useMemo(
    () => documentsWithPreviews.find((document) => document.id === selectedDocumentId) ?? null,
    [documentsWithPreviews, selectedDocumentId],
  );
  const previewDocuments = useMemo(() => {
    if (previewDocumentIds.length === 0) return selectedDocument ? [selectedDocument] : [];
    const documentsById = new Map(documentsWithPreviews.map((document) => [document.id, document]));
    return previewDocumentIds
      .map((documentId) => documentsById.get(documentId))
      .filter((document): document is ApprovedDocumentItem => Boolean(document));
  }, [documentsWithPreviews, previewDocumentIds, selectedDocument]);
  const totalWorks = useMemo(
    () => new Set(documents.map((document) => document.workId).filter(Boolean)).size,
    [documents],
  );
  const totalTypes = useMemo(
    () => new Set(documents.map((document) => document.documentType || "CUSTOM")).size,
    [documents],
  );
  const emptyStateMessage =
    activeView === "resolved"
      ? "No hay documentos resueltos para mostrar."
      : "No hay documentos pendientes de resolver.";

  const handleToggleResolved = (documentId: string, nextResolved: boolean) => {
    setResolvedIds((current) => {
      const next = new Set(current);
      if (nextResolved) {
        next.add(documentId);
      } else {
        next.delete(documentId);
      }
      return next;
    });
    setActiveView(nextResolved ? "resolved" : "pending");
  };

  const openDocumentPreview = (documentId: string, groupDocuments: ApprovedDocumentItem[]) => {
    setSelectedDocumentId(documentId);
    setPreviewDocumentIds(groupDocuments.map((document) => document.id));
    void requestDocumentPreview(documentId, { commitToState: true });
  };

  const closeDocumentPreview = () => {
    setSelectedDocumentId(null);
    setPreviewDocumentIds([]);
  };

  useEffect(() => {
    if (!selectedDocumentId) return;
    void requestDocumentPreview(selectedDocumentId, { commitToState: true });
  }, [requestDocumentPreview, selectedDocumentId]);

  return (
    <div className="min-h-[calc(100dvh-1px)] space-y-5 bg-[#eef0f2] px-4 py-5 text-[#1f2937] sm:px-6">
      <DocumentPreviewer
        document={selectedDocument}
        documents={previewDocuments}
        isPreviewLoading={selectedDocumentId ? previewLoadingIds.has(selectedDocumentId) : false}
        resolvedIds={resolvedIds}
        onClose={closeDocumentPreview}
        onSelectDocument={setSelectedDocumentId}
        onToggleResolved={handleToggleResolved}
      />

      <section className="overflow-hidden rounded-lg border border-[#d7dce2] bg-[linear-gradient(135deg,#f8fafc_0%,#f3f4f5_52%,#eef0f2_100%)] shadow-[0_18px_36px_-30px_rgba(15,23,42,0.65),inset_0_1px_0_rgba(255,255,255,0.9)]">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#334155]">
                <FileCheck2 className="size-4" />
                Documentos aprobados
              </div>
            </div>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-[#1f2937]">
              Aprobados por tipo documental y obra
            </h1>
            <div className="mt-4 grid gap-2 sm:grid-cols-3 max-w-[500px]">
              <div className="rounded-lg border border-[#d9dee5] bg-[#f8fafc] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">Aprobados</p>
                <p className="font-mono text-xl font-semibold text-[#1f2937]">{documents.length}</p>
              </div>
              <div className="rounded-lg border border-[#d9dee5] bg-[#f8fafc] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">Tipos</p>
                <p className="font-mono text-xl font-semibold text-[#1f2937]">{totalTypes}</p>
              </div>
              <div className="rounded-lg border border-[#d9dee5] bg-[#f8fafc] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">Obras</p>
                <p className="font-mono text-xl font-semibold text-[#1f2937]">{totalWorks}</p>
              </div>
            </div>
          </div>

          <DeskStackPreview />
        </div>

        <div className="border-t border-[#d7dce2] bg-[#f8fafc]/80 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-0 sm:w-[360px]">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#64748b]" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por documento, obra o carpeta"
                  className="h-10 rounded-lg border-[#d7dce2] bg-white pl-9 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] focus-visible:ring-[#ff5800]/20"
                />
              </div>
              <div className="inline-flex w-fit rounded-lg border border-[#d7dce2] bg-[#eef0f2] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                <button
                  type="button"
                  data-active={activeView === "pending"}
                  onClick={() => setActiveView("pending")}
                  className={cn(
                    sidebarMenuButtonVariants({ size: "sm" }),
                    "w-auto px-3 font-semibold",
                  )}
                >
                  Por resolver
                  <span className="font-mono text-[11px] opacity-75">{pendingCount}</span>
                </button>
                <button
                  type="button"
                  data-active={activeView === "resolved"}
                  onClick={() => setActiveView("resolved")}
                  className={cn(
                    sidebarMenuButtonVariants({ size: "sm" }),
                    "w-auto px-3 font-semibold",
                  )}
                >
                  Resueltos
                  <span className="font-mono text-[11px] opacity-75">{resolvedCount}</span>
                </button>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="h-10 gap-2 self-start rounded-lg border border-[#d7dce2] bg-white text-[#1f2937] shadow-[0_8px_18px_-16px_rgba(15,23,42,0.55),inset_0_1px_0_rgba(255,255,255,0.95)] hover:-translate-y-0.5 hover:bg-[#f8fafc] sm:self-auto"
              onClick={() => void approvedDocumentsQuery.refetch()}
              disabled={approvedDocumentsQuery.isFetching}
            >
              <RefreshCw className={cn("size-4", approvedDocumentsQuery.isFetching && "animate-spin")} />
              Actualizar
            </Button>
          </div>
        </div>
      </section>

      {approvedDocumentsQuery.isLoading ? (
        <div className="grid min-h-[420px] place-items-center rounded-lg border border-[#d7dce2] bg-[#f8fafc] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          <Loader2 className="size-6 animate-spin text-[#64748b]" />
        </div>
      ) : approvedDocumentsQuery.isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm font-medium text-rose-700">
          {approvedDocumentsQuery.error instanceof Error
            ? approvedDocumentsQuery.error.message
            : "No se pudieron cargar documentos aprobados"}
        </div>
      ) : groupedDocuments.length === 0 ? (
        <div className="grid min-h-[420px] place-items-center rounded-lg border border-dashed border-[#c8d0da] bg-[#f8fafc] px-6 text-center text-sm text-[#64748b] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          <div>
            <FileText className="mx-auto mb-3 size-10 text-[#94a3b8]" />
            {emptyStateMessage}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedDocuments.map((group) => (
            <TypeFolder
              key={group.documentType}
              group={group}
              resolvedIds={resolvedIds}
              onOpenDocument={openDocumentPreview}
              loadPreview={requestDocumentPreview}
            />
          ))}
        </div>
      )}
    </div>
  );
}
