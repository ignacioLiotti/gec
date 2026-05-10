"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, FilePenLine, Loader2, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DocumentGenerationPermissionMap } from "@/lib/document-generation-server";
import { cn } from "@/lib/utils";
import { DocumentGenerationNav } from "./document-nav";

type DraftListItem = {
  id: string;
  workId: string;
  workLabel: string;
  folderPath: string;
  documentType: string;
  templateId: string;
  templateName: string | null;
  status: string;
  inputData: Record<string, unknown>;
  validationErrors: Array<{ key: string; message: string }>;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; fullName: string | null; email: string | null; label: string } | null;
  canEdit: boolean;
};

type DraftsResponse = {
  drafts: DraftListItem[];
  works: Array<{ id: string; label: string }>;
  creators: Array<{ id: string; label: string }>;
};

type Props = {
  canViewAllDrafts: boolean;
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
    case "READY_TO_GENERATE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

export function DocumentDraftsPageClient({ canViewAllDrafts, permissions }: Props) {
  const [drafts, setDrafts] = useState<DraftListItem[]>([]);
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
        if (canViewAllDrafts && filters.createdBy) query.set("createdBy", filters.createdBy);
        if (filters.from) query.set("from", filters.from);
        if (filters.to) query.set("to", filters.to);

        const response = await fetch(`/api/document-generation/drafts?${query.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as DraftsResponse & { error?: string };
        if (!response.ok) throw new Error(payload.error || "No se pudieron cargar los borradores");
        if (cancelled) return;

        setDrafts(payload.drafts ?? []);
        setWorks(payload.works ?? []);
        setCreators(payload.creators ?? []);
        setSelectedId((current) => {
          const nextId = payload.drafts?.[0]?.id ?? "";
          return payload.drafts?.some((draft) => draft.id === current) ? current : nextId;
        });
      } catch (error) {
        if (!cancelled) {
          console.error("[document-drafts] load failed", error);
          setDrafts([]);
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
  }, [canViewAllDrafts, filters]);

  const selectedDraft = useMemo(
    () => drafts.find((draft) => draft.id === selectedId) ?? null,
    [drafts, selectedId],
  );

  return (
    <div className="grid gap-6 px-4 py-6 sm:px-6 xl:grid-cols-[minmax(0,1.1fr)_420px]">
      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]">
        <div className="border-b border-stone-200 bg-[linear-gradient(180deg,#ffffff_0%,#fafaf9_100%)] px-5 py-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">Borradores</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-stone-950">
                  Retoma documentos sin terminar.
                </h1>
                <DocumentGenerationNav permissions={permissions} />
              </div>
              <p className="mt-1 text-sm text-stone-500">
                Filtra por fecha, obra y estado para volver a editar un documento.
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
              <option value="DRAFT">Incompletos</option>
              <option value="READY_TO_GENERATE">Listos para generar</option>
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
            {canViewAllDrafts ? (
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
            ) : (
              <div className="hidden xl:block" />
            )}
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
          ) : drafts.length === 0 ? (
            <div className="grid min-h-[420px] place-items-center px-6 text-center text-sm text-stone-500">
              No encontramos borradores con esos filtros.
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
                {drafts.map((draft) => (
                  <tr
                    key={draft.id}
                    className={cn(
                      "cursor-pointer border-b border-stone-100 transition hover:bg-stone-50/70",
                      selectedId === draft.id && "bg-stone-50",
                    )}
                    onClick={() => setSelectedId(draft.id)}
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-stone-900">{draft.templateName ?? draft.documentType}</p>
                      <p className="mt-1 text-sm text-stone-500">{draft.folderPath}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-stone-700">{draft.workLabel}</td>
                    <td className="px-5 py-4 text-sm text-stone-700">{draft.createdBy?.label ?? "Usuario"}</td>
                    <td className="px-5 py-4">
                      <span className={cn("rounded-full border px-3 py-1 text-xs font-medium", statusBadgeClasses(draft.status))}>
                        {draft.status === "READY_TO_GENERATE" ? "Listo" : "En borrador"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-stone-700">{formatDate(draft.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
          {selectedDraft ? (
            <>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">Detalle</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-stone-950">
                {selectedDraft.templateName ?? selectedDraft.documentType}
              </h2>
              <div className="mt-4 space-y-3 text-sm text-stone-600">
                <p><strong className="text-stone-900">Obra:</strong> {selectedDraft.workLabel}</p>
                <p><strong className="text-stone-900">Carpeta:</strong> {selectedDraft.folderPath}</p>
                <p><strong className="text-stone-900">Creado por:</strong> {selectedDraft.createdBy?.label ?? "Usuario"}</p>
                <p><strong className="text-stone-900">Actualizado:</strong> {formatDate(selectedDraft.updatedAt)}</p>
                <p><strong className="text-stone-900">Campos con error:</strong> {selectedDraft.validationErrors.length}</p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild className="rounded-md">
                  <Link href={`/document-generation?draftId=${encodeURIComponent(selectedDraft.id)}`}>
                    <FilePenLine className="mr-2 size-4" />
                    Continuar edicion
                  </Link>
                </Button>
                <Button asChild variant="outline" className="rounded-md">
                  <Link href={`/document-generation?draftId=${encodeURIComponent(selectedDraft.id)}`}>
                    Abrir documento
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              </div>
            </>
          ) : (
            <div className="grid min-h-[220px] place-items-center text-center text-sm text-stone-500">
              Selecciona un borrador para ver su detalle.
            </div>
          )}
        </div>

        {selectedDraft?.validationErrors?.length ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">Pendientes</p>
            <div className="mt-4 space-y-3">
              {selectedDraft.validationErrors.map((error) => (
                <div key={`${error.key}-${error.message}`} className="flex items-start gap-2 text-sm text-stone-700">
                  <AlertCircle className="mt-0.5 size-4 text-amber-600" />
                  <span>{error.message}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
