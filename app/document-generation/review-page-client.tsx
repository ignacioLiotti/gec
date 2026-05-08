"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, RefreshCcw, ShieldAlert, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DocumentApprovedSeal } from "@/components/document-approved-seal";

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

type GeneratedDetailResponse = {
  document: GeneratedListItem & {
    storagePath: string;
    previewHtml: string;
  };
  events: Array<{
    id: string;
    eventType: string;
    fromStatus: string | null;
    toStatus: string | null;
    payload: Record<string, unknown>;
    createdAt: string;
    createdBy: { id: string; fullName: string | null; email: string | null; label: string } | null;
  }>;
};

type GeneratedListResponse = {
  documents: GeneratedListItem[];
  works: Array<{ id: string; label: string }>;
  creators: Array<{ id: string; label: string }>;
  counts: { pending: number; approved: number; rejected: number };
};

const BUCKETS = [
  { key: "PENDING", label: "Pendientes" },
  { key: "APPROVED", label: "Aprobados" },
  { key: "REJECTED", label: "Desaprobados" },
] as const;

function formatDate(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function DocumentReviewPageClient() {
  const [bucket, setBucket] = useState<(typeof BUCKETS)[number]["key"]>("PENDING");
  const [documents, setDocuments] = useState<GeneratedListItem[]>([]);
  const [works, setWorks] = useState<Array<{ id: string; label: string }>>([]);
  const [creators, setCreators] = useState<Array<{ id: string; label: string }>>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [filters, setFilters] = useState({
    workId: "",
    createdBy: "",
    from: "",
    to: "",
    documentType: "",
  });
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<GeneratedDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        query.set("status", bucket);
        if (filters.workId) query.set("workId", filters.workId);
        if (filters.createdBy) query.set("createdBy", filters.createdBy);
        if (filters.from) query.set("from", filters.from);
        if (filters.to) query.set("to", filters.to);
        if (filters.documentType) query.set("documentType", filters.documentType);

        const response = await fetch(`/api/document-generation/generated?${query.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as GeneratedListResponse & { error?: string };
        if (!response.ok) throw new Error(payload.error || "No se pudo cargar la cola documental");
        if (cancelled) return;

        setDocuments(payload.documents ?? []);
        setWorks(payload.works ?? []);
        setCreators(payload.creators ?? []);
        setCounts(payload.counts ?? { pending: 0, approved: 0, rejected: 0 });
        setSelectedId((current) => {
          const nextId = payload.documents?.[0]?.id ?? "";
          return payload.documents?.some((document) => document.id === current) ? current : nextId;
        });
      } catch (error) {
        if (!cancelled) {
          console.error("[document-review] list failed", error);
          setDocuments([]);
          setSelectedId("");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [bucket, filters]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setDetailLoading(true);
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
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const availableDocumentTypes = useMemo(
    () => Array.from(new Set(documents.map((document) => document.documentType))).sort(),
    [documents],
  );

  const handleStatusChange = async (status: "UNDER_REVIEW" | "APPROVED" | "REJECTED") => {
    if (!selectedId) return;
    setUpdating(true);
    try {
      const response = await fetch(`/api/document-generation/generated/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo actualizar el estado");

      setDocuments((current) =>
        current.map((document) => (document.id === selectedId ? { ...document, status } : document)),
      );

      const refreshQuery = new URLSearchParams();
      refreshQuery.set("status", bucket);
      if (filters.workId) refreshQuery.set("workId", filters.workId);
      if (filters.createdBy) refreshQuery.set("createdBy", filters.createdBy);
      if (filters.from) refreshQuery.set("from", filters.from);
      if (filters.to) refreshQuery.set("to", filters.to);
      if (filters.documentType) refreshQuery.set("documentType", filters.documentType);
      const refreshResponse = await fetch(`/api/document-generation/generated?${refreshQuery.toString()}`, {
        cache: "no-store",
      });
      const refreshPayload = (await refreshResponse.json()) as GeneratedListResponse;
      setDocuments(refreshPayload.documents ?? []);
      setCounts(refreshPayload.counts ?? { pending: 0, approved: 0, rejected: 0 });
      setSelectedId((current) => {
        const nextId = refreshPayload.documents?.[0]?.id ?? "";
        return refreshPayload.documents?.some((document) => document.id === current) ? current : nextId;
      });
    } catch (error) {
      console.error("[document-review] update failed", error);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="grid gap-6 px-4 py-6 sm:px-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]">
        <div className="border-b border-stone-200 bg-[linear-gradient(180deg,#ffffff_0%,#fafaf9_100%)] px-5 py-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">Revision documental</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                Revisa, aprueba o rechaza documentos emitidos.
              </h1>
              <p className="mt-1 text-sm text-stone-500">
                Consulta historial por estado, fecha, obra y usuario creador.
              </p>
            </div>
            <Button type="button" variant="outline" className="rounded-md" onClick={() => setFilters((current) => ({ ...current }))}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
          </div>
        </div>

        <div className="border-b border-stone-200 px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {BUCKETS.map((entry) => {
              const count =
                entry.key === "PENDING" ? counts.pending : entry.key === "APPROVED" ? counts.approved : counts.rejected;
              return (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => setBucket(entry.key)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium transition",
                    bucket === entry.key
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50",
                  )}
                >
                  {entry.label} <span className="ml-2 opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-b border-stone-200 bg-stone-50/80 px-5 py-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
            <select
              value={filters.documentType}
              onChange={(event) => setFilters((current) => ({ ...current, documentType: event.target.value }))}
              className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm"
            >
              <option value="">Todos los tipos</option>
              {availableDocumentTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
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
              <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
            </div>
          ) : documents.length === 0 ? (
            <div className="grid min-h-[420px] place-items-center px-6 text-center text-sm text-stone-500">
              No encontramos documentos para esta vista.
            </div>
          ) : (
            <table className="w-full max-w-full">
              <thead className="bg-white">
                <tr className="border-b border-stone-200 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                  <th className="px-5 py-3">Documento</th>
                  <th className="px-5 py-3">Creador</th>
                  <th className="px-5 py-3">Emitido</th>
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
                      <div className="flex items-center gap-3">
                        <DocumentApprovedSeal status={document.status} className="shrink-0" />
                        <p className="text-sm font-semibold text-stone-900">{document.fileName}</p>
                      </div>
                      <p className="mt-1 text-sm text-stone-500">
                        {document.workLabel}
                        <Badge
                          variant="default"
                          className="ml-2 rounded-full border px-3 py-0.5 text-xs font-medium capitalize"
                        >
                          {document.templateName ?? document.documentType}
                        </Badge>
                      </p>
                    </td>
                    <td className="px-5 py-4 text-sm text-stone-700">{document.createdBy?.label ?? "Usuario"}</td>
                    <td className="px-5 py-4 text-sm text-stone-700">{formatDate(document.generatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <aside className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]">
        {detailLoading ? (
          <div className="grid min-h-[780px] place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
          </div>
        ) : detail?.document ? (
          <div className="flex h-full flex-col">
            <div className="border-b border-stone-200 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">Documento</p>
                  <h2 className="mt-2 text-lg font-semibold text-stone-950">{detail.document.fileName}</h2>
                </div>
                <DocumentApprovedSeal status={detail.document.status} size="md" className="shrink-0" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {detail.document.canEdit ? (
                  <Button asChild type="button" variant="outline" className="rounded-md">
                    <Link href={`/document-generation?generatedId=${encodeURIComponent(detail.document.id)}`}>
                      Editar documento
                    </Link>
                  </Button>
                ) : null}
                <Button type="button" className="rounded-md" disabled={updating} onClick={() => void handleStatusChange("APPROVED")}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Aprobar
                </Button>
                <Button type="button" variant="outline" className="rounded-md" disabled={updating} onClick={() => void handleStatusChange("REJECTED")}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Rechazar
                </Button>
                <Button type="button" variant="outline" className="rounded-md" disabled={updating} onClick={() => void handleStatusChange("UNDER_REVIEW")}>
                  <ShieldAlert className="mr-2 h-4 w-4" />
                  Marcar en revision
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-[#e9e7e1] p-5">
              {detail.document.previewHtml ? (
                <div className="relative rounded-sm bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.04)]">
                  <DocumentApprovedSeal
                    status={detail.document.status}
                    size="md"
                    className="absolute left-5 top-5 z-20"
                  />
                  <div className="report-paper w-full! min-w-max bg-white">
                    <div dangerouslySetInnerHTML={{ __html: detail.document.previewHtml }} />
                  </div>
                </div>
              ) : (
                <div className="grid min-h-[420px] place-items-center rounded-xl border border-dashed border-stone-300 bg-white px-5 text-center text-sm text-stone-500">
                  No pudimos renderizar la vista previa de este documento.
                </div>
              )}
            </div>

            {/* <div className="border-t border-stone-200 px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">Historial</p>
              <div className="mt-3 max-h-[220px] space-y-3 overflow-auto">
                {detail.events.length > 0 ? (
                  detail.events.map((event) => (
                    <div key={event.id} className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
                      <p className="text-sm font-medium text-stone-900">{event.eventType}</p>
                      <p className="mt-1 text-xs text-stone-500">
                        {event.createdBy?.label ?? "Usuario"} · {formatDate(event.createdAt)}
                      </p>
                      {event.toStatus ? (
                        <p className="mt-2 text-xs text-stone-600">
                          Estado: {event.fromStatus ? humanizeStatus(event.fromStatus) : "nuevo"} → {humanizeStatus(event.toStatus)}
                        </p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-stone-500">No hay eventos registrados todavia.</p>
                )}
              </div>
            </div> */}
          </div>
        ) : (
          <div className="grid min-h-[780px] place-items-center px-6 text-center text-sm text-stone-500">
            Selecciona un documento para revisarlo.
          </div>
        )}
      </aside>
    </div>
  );
}
