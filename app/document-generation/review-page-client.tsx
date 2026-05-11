"use client";

import Link from "next/link";
import { memo, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  XCircle,
} from "lucide-react";

import { DocumentApprovedSeal } from "@/components/document-approved-seal";
import { Button } from "@/components/ui/button";
import type { DocumentGenerationPermissionMap } from "@/lib/document-generation-server";
import { cn } from "@/lib/utils";
import { DocumentGenerationNav } from "./document-nav";

type GeneratedListItem = {
  id: string;
  workId: string;
  workLabel: string;
  folderPath: string;
  documentType: string;
  templateId: string;
  templateName: string | null;
  sourceDraftId: string | null;
  fileName: string;
  status: string;
  inputData: Record<string, unknown>;
  generatedAt: string;
  updatedAt: string;
  createdBy: { id: string; fullName: string | null; email: string | null; label: string } | null;
  canEdit: boolean;
};

type GeneratedEvent = {
  id: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  createdBy: { id: string; fullName: string | null; email: string | null; label: string } | null;
};

type GeneratedDetailResponse = {
  document: GeneratedListItem & {
    storagePath: string;
    previewHtml: string;
  };
  events: GeneratedEvent[];
};

type GeneratedListResponse = {
  documents: GeneratedListItem[];
  counts: { pending: number; approved: number; rejected: number };
};

function formatDate(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function statusLabel(status: string) {
  switch (status) {
    case "APPROVED":
      return "Aprobado";
    case "REJECTED":
      return "Rechazado";
    case "UNDER_REVIEW":
      return "En revision";
    default:
      return "Pendiente";
  }
}

function eventComment(event: GeneratedEvent) {
  const comment = event.payload.comment;
  return typeof comment === "string" && comment.trim() ? comment.trim() : "";
}

const ReviewCommentActions = memo(function ReviewCommentActions({
  updating,
  disabled,
  onDecision,
}: {
  updating: boolean;
  disabled: boolean;
  onDecision: (status: "APPROVED" | "REJECTED", comment: string) => void;
}) {
  const [comment, setComment] = useState("");

  return (
    <>
      <div className="mt-4">
        <label htmlFor="review-comment" className="text-sm font-medium text-stone-800">
          Comentario
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Escribe por que se aprueba o rechaza..."
          className="mt-2 min-h-28 w-full resize-none rounded-lg border border-stone-200 bg-white px-3 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-400 focus:ring-4 focus:ring-stone-200/60"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-lg border-red-200 text-red-700 hover:bg-red-50 active:scale-[0.98]"
          disabled={disabled || updating}
          onClick={() => onDecision("REJECTED", comment)}
        >
          {updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
          Rechazar
        </Button>
        <Button
          type="button"
          className="h-12 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98]"
          disabled={disabled || updating}
          onClick={() => onDecision("APPROVED", comment)}
        >
          {updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          Aprobar
        </Button>
      </div>
    </>
  );
});

export function DocumentReviewPageClient({
  permissions,
}: {
  permissions: DocumentGenerationPermissionMap;
}) {
  const [documents, setDocuments] = useState<GeneratedListItem[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<GeneratedDetailResponse | null>(null);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [zoom, setZoom] = useState(82);

  const loadQueue = async (preferredId?: string) => {
    setLoadingQueue(true);
    try {
      const response = await fetch("/api/document-generation/generated?status=PENDING", {
        cache: "no-store",
      });
      const payload = (await response.json()) as GeneratedListResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo cargar la cola documental");

      const nextDocuments = payload.documents ?? [];
      setDocuments(nextDocuments);
      setCounts(payload.counts ?? { pending: 0, approved: 0, rejected: 0 });
      setSelectedId((current) => {
        if (preferredId && nextDocuments.some((document) => document.id === preferredId)) return preferredId;
        if (current && nextDocuments.some((document) => document.id === current)) return current;
        return nextDocuments[0]?.id ?? "";
      });
    } catch (error) {
      console.error("[document-review] queue failed", error);
      setDocuments([]);
      setSelectedId("");
    } finally {
      setLoadingQueue(false);
    }
  };

  useEffect(() => {
    void loadQueue();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    const loadDetail = async () => {
      setLoadingDetail(true);
      try {
        const response = await fetch(`/api/document-generation/generated/${selectedId}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as GeneratedDetailResponse & { error?: string };
        if (!response.ok) throw new Error(payload.error || "No se pudo cargar el documento");
        if (!cancelled) {
          setDetail(payload);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[document-review] detail failed", error);
          setDetail(null);
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    };

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selectedIndex = documents.findIndex((document) => document.id === selectedId);
  const currentDocument = detail?.document ?? documents[selectedIndex] ?? null;
  const remainingDocuments = useMemo(
    () => documents.filter((document) => document.id !== selectedId),
    [documents, selectedId],
  );
  const nextDocument = remainingDocuments[0] ?? null;
  const reviewComments = useMemo(
    () => (detail?.events ?? []).filter((event) => eventComment(event)),
    [detail?.events],
  );

  const handleSelectRelative = (direction: -1 | 1) => {
    if (documents.length === 0) return;
    const baseIndex = selectedIndex >= 0 ? selectedIndex : 0;
    const nextIndex = (baseIndex + direction + documents.length) % documents.length;
    setSelectedId(documents[nextIndex]?.id ?? "");
  };

  const handleDecision = async (status: "APPROVED" | "REJECTED", comment: string) => {
    if (!selectedId) return;
    setUpdating(true);
    try {
      const response = await fetch(`/api/document-generation/generated/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, comment }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo actualizar el estado");

      const nextAfterDecision = documents.find((document) => document.id !== selectedId)?.id;
      await loadQueue(nextAfterDecision);
    } catch (error) {
      console.error("[document-review] decision failed", error);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-24px)] flex-col bg-[#fafafa] px-3 py-3 sm:px-4 sm:py-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">Revision documental</p>
            <DocumentGenerationNav permissions={permissions} />
          </div>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-stone-950 sm:text-2xl">
            {currentDocument?.fileName ?? "No hay documentos pendientes"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600">
            {counts.pending} pendientes
          </span>
          <Button type="button" variant="outline" className="h-9 rounded-md" onClick={() => void loadQueue()}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </header>

      <main className="grid flex-1 gap-3 lg:min-h-0 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="hidden min-h-0 overflow-hidden rounded-xl border border-stone-200 bg-white lg:flex lg:flex-col">
          <div className="border-b border-stone-200 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Siguientes</p>
          </div>
          <div className="flex-1 space-y-2 overflow-auto p-3">
            {loadingQueue ? (
              <div className="grid min-h-[220px] place-items-center">
                <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
              </div>
            ) : documents.length === 0 ? (
              <div className="grid min-h-[220px] place-items-center px-4 text-center text-sm text-stone-500">
                La cola esta limpia.
              </div>
            ) : (
              documents.map((document, index) => (
                <button
                  key={document.id}
                  type="button"
                  onClick={() => setSelectedId(document.id)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-3 text-left transition-[border-color,background-color,box-shadow,transform] duration-150 active:scale-[0.99]",
                    selectedId === document.id
                      ? "border-stone-900 bg-stone-950 text-white shadow-sm"
                      : "border-stone-200 bg-white text-stone-900 hover:bg-stone-50",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                        selectedId === document.id ? "bg-white text-stone-950" : "bg-stone-100 text-stone-500",
                      )}
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0 truncate text-sm font-semibold">{document.fileName}</span>
                  </div>
                  <p className={cn("mt-2 line-clamp-2 text-xs", selectedId === document.id ? "text-white/70" : "text-stone-500")}>
                    {document.workLabel}
                  </p>
                  <p className={cn("mt-2 text-[11px]", selectedId === document.id ? "text-white/60" : "text-stone-400")}>
                    {formatDate(document.generatedAt)}
                  </p>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="min-h-[60dvh] overflow-hidden rounded-xl border border-stone-200 bg-[#e9e7e1] lg:min-h-0">
          <div className="flex items-center justify-between gap-2 border-b border-stone-200 bg-white px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-stone-950">
                {currentDocument?.workLabel ?? "Documento"}
              </p>
              <p className="text-xs text-stone-500">{currentDocument ? statusLabel(currentDocument.status) : "Sin seleccion"}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="outline"
                className="h-9 w-9 rounded-md p-0"
                onClick={() => setZoom((current) => Math.max(48, current - 8))}
                disabled={!currentDocument}
                aria-label="Alejar"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="min-w-12 text-center font-mono text-xs text-stone-600">{zoom}%</span>
              <Button
                type="button"
                variant="outline"
                className="h-9 w-9 rounded-md p-0"
                onClick={() => setZoom((current) => Math.min(140, current + 8))}
                disabled={!currentDocument}
                aria-label="Acercar"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="h-[calc(100%-54px)] overflow-auto p-3 sm:p-5">
            {loadingDetail ? (
              <div className="grid min-h-[560px] place-items-center">
                <Loader2 className="h-5 w-5 animate-spin text-stone-500" />
              </div>
            ) : detail?.document?.previewHtml ? (
              <div className="mx-auto w-fit pb-10">
                <div
                  className="relative origin-top rounded-sm bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_18px_50px_-18px_rgba(0,0,0,0.28)]"
                  style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
                >
                  <DocumentApprovedSeal status={detail.document.status} size="md" className="absolute left-5 top-5 z-20" />
                  <div className="report-paper bg-white">
                    <div dangerouslySetInnerHTML={{ __html: detail.document.previewHtml }} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid min-h-[560px] place-items-center rounded-xl border border-dashed border-stone-300 bg-white/70 px-6 text-center">
                <div>
                  <FileText className="mx-auto h-8 w-8 text-stone-400" />
                  <p className="mt-3 text-sm font-medium text-stone-800">
                    {documents.length === 0 ? "No quedan documentos para revisar." : "Selecciona un documento."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="min-h-0 rounded-xl border border-stone-200 bg-white p-4 lg:flex lg:flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Decision</p>
              <h2 className="mt-2 truncate text-lg font-semibold text-stone-950">
                {currentDocument?.templateName ?? currentDocument?.documentType ?? "Revision"}
              </h2>
              <p className="mt-1 text-sm text-stone-500">{currentDocument?.createdBy?.label ?? "Usuario"}</p>
            </div>
            {currentDocument?.canEdit ? (
              <Button asChild type="button" variant="outline" className="h-9 rounded-md">
                <Link href={`/document-generation?generatedId=${encodeURIComponent(currentDocument.id)}`}>
                  Editar
                </Link>
              </Button>
            ) : null}
          </div>

          <ReviewCommentActions
            key={selectedId}
            updating={updating}
            disabled={!selectedId}
            onDecision={(status, comment) => void handleDecision(status, comment)}
          />

          <div className="mt-3 flex gap-2 lg:hidden">
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1 rounded-lg"
              disabled={documents.length < 2}
              onClick={() => handleSelectRelative(-1)}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1 rounded-lg"
              disabled={documents.length < 2}
              onClick={() => handleSelectRelative(1)}
            >
              Siguiente
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 px-3 py-3 lg:hidden">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">Proximo</p>
            <p className="mt-2 truncate text-sm font-medium text-stone-900">{nextDocument?.fileName ?? "No hay mas documentos"}</p>
          </div>

          <div className="mt-5 min-h-0 flex-1 overflow-hidden border-t border-stone-200 pt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Comentarios</p>
            <div className="mt-3 max-h-56 space-y-2 overflow-auto lg:max-h-none">
              {reviewComments.length > 0 ? (
                reviewComments.map((event) => (
                  <div key={event.id} className="rounded-lg border border-stone-200 bg-white px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-stone-900">{event.toStatus ? statusLabel(event.toStatus) : event.eventType}</p>
                      <p className="text-[11px] text-stone-400">{formatDate(event.createdAt)}</p>
                    </div>
                    {eventComment(event) ? (
                      <p className="mt-2 text-sm leading-5 text-stone-600">{eventComment(event)}</p>
                    ) : (
                      <p className="mt-2 text-sm text-stone-400">Sin comentario.</p>
                    )}
                    <p className="mt-2 text-xs text-stone-400">{event.createdBy?.label ?? "Usuario"}</p>
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-stone-200 px-3 py-6 text-center text-sm text-stone-500">
                  Todavia no hay comentarios.
                </p>
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
