"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Copy, FilePenLine, Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { GENERATED_DOCUMENT_STATUS_LABELS } from "@/lib/document-generation";
import type { DocumentGenerationPermissionMap } from "@/lib/document-generation-server";
import { cn } from "@/lib/utils";
import { DocumentGenerationNav } from "./document-nav";

type HistoryListItem = {
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

type HistoryResponse = {
  documents: HistoryListItem[];
  works: Array<{ id: string; label: string }>;
  creators: Array<{ id: string; label: string }>;
};

type Props = {
  permissions: DocumentGenerationPermissionMap;
};

function formatDate(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function statusBadgeClasses(status: string) {
  switch (status) {
    case "APPROVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "REJECTED":
      return "border-red-200 bg-red-50 text-red-700";
    case "UNDER_REVIEW":
    case "GENERATED":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-stone-200 bg-stone-50 text-stone-700";
  }
}

function statusLabel(status: string) {
  return GENERATED_DOCUMENT_STATUS_LABELS[status] ?? status;
}

export function DocumentDraftsPageClient({ permissions }: Props) {
  const [documents, setDocuments] = useState<HistoryListItem[]>([]);
  const [works, setWorks] = useState<Array<{ id: string; label: string }>>([]);
  const [creators, setCreators] = useState<Array<{ id: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [filters, setFilters] = useState({
    status: "ALL",
    workId: "",
    createdBy: "",
    from: "",
    to: "",
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        if (filters.status !== "ALL") query.set("status", filters.status);
        if (filters.workId) query.set("workId", filters.workId);
        if (filters.createdBy) query.set("createdBy", filters.createdBy);
        if (filters.from) query.set("from", filters.from);
        if (filters.to) query.set("to", filters.to);

        const response = await fetch(`/api/document-generation/generated?${query.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as HistoryResponse & { error?: string };
        if (!response.ok) throw new Error(payload.error || "No se pudo cargar el historial");
        if (cancelled) return;

        const nextDocuments = payload.documents ?? [];
        setDocuments(nextDocuments);
        setWorks(payload.works ?? []);
        setCreators(payload.creators ?? []);
        setSelectedId((current) =>
          nextDocuments.some((document) => document.id === current) ? current : nextDocuments[0]?.id ?? "",
        );
      } catch (error) {
        if (!cancelled) {
          console.error("[document-history] load failed", error);
          setDocuments([]);
          setSelectedId("");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedId) ?? null,
    [documents, selectedId],
  );

  const copyReviewLink = async () => {
    if (!selectedDocument) return;
    const reviewUrl = `${window.location.origin}/document-generation/review?id=${encodeURIComponent(selectedDocument.id)}`;
    try {
      await navigator.clipboard.writeText(reviewUrl);
      toast.success("Link de revision copiado.");
    } catch {
      toast.error("No se pudo copiar el link.");
    }
  };

  return (
    <div className="grid gap-6 px-4 py-6 sm:px-6 xl:grid-cols-[minmax(0,1.1fr)_420px]">
      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]">
        <div className="border-b border-stone-200 bg-[linear-gradient(180deg,#ffffff_0%,#fafaf9_100%)] px-5 py-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">Historial</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-stone-950">
                  Documentos creados.
                </h1>
                <DocumentGenerationNav permissions={permissions} />
              </div>
              <p className="mt-1 text-sm text-stone-500">
                Filtra por fecha, obra y estado para revisar o editar documentos disponibles.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="rounded-md"
              onClick={() => setFilters((current) => ({ ...current }))}
            >
              <RefreshCcw className="mr-2 size-4" />
              Actualizar
            </Button>
          </div>
        </div>

        <div className="border-b border-stone-200 bg-stone-50/80 px-5 py-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <select
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm"
            >
              <option value="ALL">Todos los estados</option>
              <option value="UNDER_REVIEW">Esperando revision</option>
              <option value="APPROVED">Aprobado</option>
              <option value="REJECTED">Rechazado</option>
            </select>
            <select
              value={filters.workId}
              onChange={(event) => setFilters((current) => ({ ...current, workId: event.target.value }))}
              className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm"
            >
              <option value="">Todas las obras</option>
              {works.map((work) => (
                <option key={work.id} value={work.id}>
                  {work.label}
                </option>
              ))}
            </select>
            <select
              value={filters.createdBy}
              onChange={(event) => setFilters((current) => ({ ...current, createdBy: event.target.value }))}
              className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm"
            >
              <option value="">Todos los usuarios</option>
              {creators.map((creator) => (
                <option key={creator.id} value={creator.id}>
                  {creator.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={filters.from}
              onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
              className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm"
            />
            <input
              type="date"
              value={filters.to}
              onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
              className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm"
            />
          </div>
        </div>

        <div className="overflow-auto">
          {loading ? (
            <div className="grid min-h-[420px] place-items-center">
              <Loader2 className="size-5 animate-spin text-stone-400" />
            </div>
          ) : documents.length === 0 ? (
            <div className="grid min-h-[420px] place-items-center px-6 text-center text-sm text-stone-500">
              No encontramos documentos con esos filtros.
            </div>
          ) : (
            <table className="w-full min-w-[860px]">
              <thead className="bg-white">
                <tr className="border-b border-stone-200 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                  <th className="px-5 py-3">Documento</th>
                  <th className="px-5 py-3">Obra</th>
                  <th className="px-5 py-3">Creado por</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3">Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr
                    key={document.id}
                    className={cn(
                      "cursor-pointer border-b border-stone-100 transition hover:bg-stone-50/70",
                      selectedId === document.id && "bg-stone-50",
                    )}
                    onClick={() => setSelectedId(document.id)}
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-stone-900">
                        {document.fileName || document.templateName || document.documentType}
                      </p>
                      <p className="mt-1 text-sm text-stone-500">{document.folderPath}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-stone-700">{document.workLabel}</td>
                    <td className="px-5 py-4 text-sm text-stone-700">{document.createdBy?.label ?? "Usuario"}</td>
                    <td className="px-5 py-4">
                      <span className={cn("rounded-full border px-3 py-1 text-xs font-medium", statusBadgeClasses(document.status))}>
                        {statusLabel(document.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-stone-700">{formatDate(document.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
          {selectedDocument ? (
            <>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">Detalle</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-stone-950">
                {selectedDocument.fileName || selectedDocument.templateName || selectedDocument.documentType}
              </h2>
              <div className="mt-4 space-y-3 text-sm text-stone-600">
                <p><strong className="text-stone-900">Obra:</strong> {selectedDocument.workLabel}</p>
                <p><strong className="text-stone-900">Carpeta:</strong> {selectedDocument.folderPath}</p>
                <p><strong className="text-stone-900">Creado por:</strong> {selectedDocument.createdBy?.label ?? "Usuario"}</p>
                <p><strong className="text-stone-900">Creado:</strong> {formatDate(selectedDocument.generatedAt)}</p>
                <p><strong className="text-stone-900">Actualizado:</strong> {formatDate(selectedDocument.updatedAt)}</p>
                <p>
                  <strong className="text-stone-900">Estado:</strong>{" "}
                  <span className={selectedDocument.status === "REJECTED" ? "font-medium text-red-700" : undefined}>
                    {statusLabel(selectedDocument.status)}
                  </span>
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {selectedDocument.canEdit ? (
                  <Button asChild className="rounded-md">
                    <Link href={`/document-generation?generatedId=${encodeURIComponent(selectedDocument.id)}`}>
                      <FilePenLine className="mr-2 size-4" />
                      Editar
                    </Link>
                  </Button>
                ) : null}
                <Button asChild variant="outline" className="rounded-md">
                  <Link href={`/document-generation/review?id=${encodeURIComponent(selectedDocument.id)}`}>
                    Abrir documento
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button type="button" variant="outline" className="rounded-md" onClick={() => void copyReviewLink()}>
                  <Copy className="mr-2 size-4" />
                  Copiar link de revision
                </Button>
              </div>
            </>
          ) : (
            <div className="grid min-h-[220px] place-items-center text-center text-sm text-stone-500">
              Selecciona un documento para ver su detalle.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
