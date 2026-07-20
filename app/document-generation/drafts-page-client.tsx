"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronsUpDown,
  Copy,
  Download,
  FilePenLine,
  Loader2,
  RefreshCcw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GENERATED_DOCUMENT_STATUS_LABELS } from "@/lib/document-generation";
import { cn } from "@/lib/utils";

type HistoryListItem = {
  id: string;
  workId: string;
  workLabel: string;
  folderPath: string;
  documentType: string;
  templateId: string;
  templateName: string | null;
  sourceDraftId: string | null;
  storagePath: string;
  fileName: string;
  status: string;
  inputData: Record<string, unknown>;
  generatedAt: string;
  updatedAt: string;
  createdBy: { id: string; fullName: string | null; email: string | null; label: string } | null;
  canEdit: boolean;
  canDelete: boolean;
};

type HistoryResponse = {
  documents: HistoryListItem[];
  works: Array<{ id: string; label: string }>;
  creators: Array<{ id: string; label: string }>;
};

type DateParts = { date: string; time: string };

function formatDateParts(value: string): DateParts | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: value, time: "" };

  return {
    date: new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(parsed),
    time: new Intl.DateTimeFormat("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(parsed),
  };
}

function formatDate(value: string) {
  const parts = formatDateParts(value);
  if (!parts) return "-";
  return parts.time ? `${parts.date} · ${parts.time} h` : parts.date;
}

function statusBadgeVariant(status: string): "success" | "destructive" | "warning" | "neutral" {
  switch (status) {
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "destructive";
    case "UNDER_REVIEW":
    case "GENERATED":
      return "warning";
    default:
      return "neutral";
  }
}

function statusLabel(status: string) {
  if (status === "GENERATED" || status === "UNDER_REVIEW") return "Esperando revisión";
  return GENERATED_DOCUMENT_STATUS_LABELS[status] ?? status;
}

function DocumentDate({ value }: { value: string }) {
  const parts = formatDateParts(value);
  if (!parts) return <span className="text-content-muted">-</span>;

  return (
    <time dateTime={value} className="block min-w-32 whitespace-nowrap">
      <span className="block text-sm font-medium tabular-nums text-content">{parts.date}</span>
      {parts.time ? (
        <span className="mt-0.5 block text-xs tabular-nums text-content-muted">{parts.time} h</span>
      ) : null}
    </time>
  );
}

function WorkFilterCombobox({
  value,
  works,
  onChange,
}: {
  value: string;
  works: Array<{ id: string; label: string }>;
  onChange: (workId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const selectedWork = works.find((work) => work.id === value) ?? null;

  const selectWork = (workId: string) => {
    onChange(workId);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id="history-work-filter"
          type="button"
          variant="outline"
          role="combobox"
          aria-controls={listId}
          aria-expanded={open}
          className="h-10 w-full min-w-0 justify-between rounded-md border-stroke bg-surface px-3 text-sm font-medium"
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {selectedWork?.label ?? "Todas las obras"}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 text-content-muted" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[var(--radix-popover-trigger-width)] min-w-[min(24rem,calc(100vw-2rem))] max-w-[min(42rem,calc(100vw-2rem))] p-0"
      >
        <Command>
          <CommandInput placeholder="Buscar obra..." />
          <CommandList id={listId} className="max-h-[18rem]">
            <CommandEmpty>No se encontró ninguna obra.</CommandEmpty>
            <CommandItem value="Todas las obras" onSelect={() => selectWork("")}>
              <Check
                className={cn(
                  "size-4 shrink-0 text-orange-primary",
                  value ? "opacity-0" : "opacity-100",
                )}
              />
              <span>Todas las obras</span>
            </CommandItem>
            {works.map((work) => (
              <CommandItem
                key={work.id}
                value={`${work.label} ${work.id}`}
                onSelect={() => selectWork(work.id)}
                className="items-start gap-2.5"
              >
                <Check
                  className={cn(
                    "mt-0.5 size-4 shrink-0 text-orange-primary",
                    value === work.id ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="min-w-0 text-sm leading-snug">{work.label}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function DocumentDraftsPageClient() {
  const [documents, setDocuments] = useState<HistoryListItem[]>([]);
  const [works, setWorks] = useState<Array<{ id: string; label: string }>>([]);
  const [creators, setCreators] = useState<Array<{ id: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

  const hasActiveFilters =
    filters.status !== "ALL" || Boolean(filters.workId || filters.createdBy || filters.from || filters.to);

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

  const downloadDocument = (document: HistoryListItem) => {
    if (!document.storagePath || !document.workId) {
      toast.error("Este documento no tiene un archivo disponible para descargar.");
      return;
    }

    const query = new URLSearchParams({
      path: document.storagePath,
      download: "1",
    });
    const anchor = window.document.createElement("a");
    anchor.href = `/api/obras/${encodeURIComponent(document.workId)}/documents/access?${query.toString()}`;
    anchor.download = document.fileName || document.templateName || document.documentType;
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const deleteSelectedDocument = async () => {
    if (!selectedDocument?.canDelete || deletingId) return;

    const documentId = selectedDocument.id;
    setDeletingId(documentId);
    try {
      const response = await fetch(
        `/api/document-generation/generated/${encodeURIComponent(documentId)}`,
        { method: "DELETE" },
      );
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "No se pudo eliminar el documento");
      }

      const deletedIndex = documents.findIndex((document) => document.id === documentId);
      const nextDocuments = documents.filter((document) => document.id !== documentId);
      const nextSelectedDocument = nextDocuments[Math.min(deletedIndex, nextDocuments.length - 1)] ?? null;
      setDocuments((current) => current.filter((document) => document.id !== documentId));
      setSelectedId((current) => current === documentId ? nextSelectedDocument?.id ?? "" : current);
      toast.success("Documento eliminado.");
    } catch (error) {
      console.error("[document-history] delete failed", error);
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el documento");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="grid gap-6 px-4 py-6 sm:px-6 xl:grid-cols-[minmax(0,1.1fr)_420px]">
      <section className="overflow-hidden rounded-2xl border border-stroke-soft bg-surface">
        <div className="border-b border-stroke-soft bg-surface px-5 py-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-content-muted">Historial</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-content">
                  Documentos creados.
                </h1>
              </div>
              <p className="mt-1 text-sm text-content-muted">
                Filtra por fecha, obra y estado para revisar o editar documentos disponibles.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="rounded-md"
              onClick={() => setFilters((current) => ({ ...current }))}
            >
              <RefreshCcw className={cn("mr-2 size-4", loading && "animate-spin")} />
              Actualizar
            </Button>
          </div>
        </div>

        <div className="border-b border-stroke-soft bg-surface-recessed px-5 py-4">
          <div className="mb-3 flex min-h-8 items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-content-secondary">Filtros</p>
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFilters({ status: "ALL", workId: "", createdBy: "", from: "", to: "" })}
              >
                <X className="size-3.5" />
                Limpiar
              </Button>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor="history-status-filter" className="text-xs text-content-secondary">Estado</Label>
              <Select
                value={filters.status}
                onValueChange={(status) => setFilters((current) => ({ ...current, status }))}
              >
                <SelectTrigger id="history-status-filter" className="h-10 w-full rounded-md border-stroke bg-surface">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="ALL">Todos los estados</SelectItem>
                  <SelectItem value="PENDING">Esperando revisión</SelectItem>
                  <SelectItem value="APPROVED">Aprobado</SelectItem>
                  <SelectItem value="REJECTED">Rechazado</SelectItem>
                  <SelectItem value="CANCELLED">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor="history-work-filter" className="text-xs text-content-secondary">Obra</Label>
              <WorkFilterCombobox
                value={filters.workId}
                works={works}
                onChange={(workId) => setFilters((current) => ({ ...current, workId }))}
              />
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor="history-creator-filter" className="text-xs text-content-secondary">Creado por</Label>
              <Select
                value={filters.createdBy || "ALL"}
                onValueChange={(createdBy) => setFilters((current) => ({
                  ...current,
                  createdBy: createdBy === "ALL" ? "" : createdBy,
                }))}
              >
                <SelectTrigger id="history-creator-filter" className="h-10 w-full rounded-md border-stroke bg-surface">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="ALL">Todos los usuarios</SelectItem>
                  {creators.map((creator) => (
                    <SelectItem key={creator.id} value={creator.id}>{creator.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor="history-from-filter" className="text-xs text-content-secondary">Desde</Label>
              <Input
                id="history-from-filter"
                type="date"
                value={filters.from}
                onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
                className="h-10 border border-stroke bg-surface px-3"
              />
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor="history-to-filter" className="text-xs text-content-secondary">Hasta</Label>
              <Input
                id="history-to-filter"
                type="date"
                value={filters.to}
                onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
                className="h-10 border border-stroke bg-surface px-3"
              />
            </div>
          </div>
        </div>

        <div className="overflow-auto">
          {loading ? (
            <div className="grid min-h-[420px] place-items-center">
              <Loader2 className="size-5 animate-spin text-content-muted" />
            </div>
          ) : documents.length === 0 ? (
            <div className="grid min-h-[420px] place-items-center px-6 text-center text-sm text-content-muted">
              No encontramos documentos con esos filtros.
            </div>
          ) : (
            <table className="w-full min-w-[1030px]">
              <thead className="bg-surface">
                <tr className="border-b border-stroke-soft text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-content-muted">
                  <th className="px-5 py-3">Documento</th>
                  <th className="px-5 py-3">Obra</th>
                  <th className="px-5 py-3">Creado por</th>
                  <th className="min-w-44 px-5 py-3">Estado</th>
                  <th className="min-w-44 px-5 py-3">Última actualización</th>
                  <th className="px-5 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr
                    key={document.id}
                    className={cn(
                      "cursor-pointer border-b border-stroke-soft transition-colors hover:bg-surface-recessed",
                      selectedId === document.id && "bg-surface-muted",
                    )}
                    onClick={() => setSelectedId(document.id)}
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-content">
                        {document.fileName || document.templateName || document.documentType}
                      </p>
                      <p className="mt-1 text-sm text-content-muted">{document.folderPath}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-content-secondary">{document.workLabel}</td>
                    <td className="px-5 py-4 text-sm text-content-secondary">{document.createdBy?.label ?? "Usuario"}</td>
                    <td className="px-5 py-4">
                      <Badge variant={statusBadgeVariant(document.status)} size="sm" shape="pill">
                        {statusLabel(document.status)}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <DocumentDate value={document.updatedAt} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!document.storagePath}
                        onClick={(event) => {
                          event.stopPropagation();
                          downloadDocument(document);
                        }}
                      >
                        <Download className="size-4" />
                        Descargar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-stroke-soft bg-surface p-5">
          {selectedDocument ? (
            <>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-content-muted">Detalle</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-content">
                {selectedDocument.fileName || selectedDocument.templateName || selectedDocument.documentType}
              </h2>
              <div className="mt-4 space-y-3 text-sm text-content-secondary">
                <p><strong className="text-content">Obra:</strong> {selectedDocument.workLabel}</p>
                <p><strong className="text-content">Carpeta:</strong> {selectedDocument.folderPath}</p>
                <p><strong className="text-content">Creado por:</strong> {selectedDocument.createdBy?.label ?? "Usuario"}</p>
                <p><strong className="text-content">Creado:</strong> {formatDate(selectedDocument.generatedAt)}</p>
                <p><strong className="text-content">Actualizado:</strong> {formatDate(selectedDocument.updatedAt)}</p>
                <p>
                  <strong className="text-content">Estado:</strong>{" "}
                  <Badge variant={statusBadgeVariant(selectedDocument.status)} size="sm" shape="pill">
                    {statusLabel(selectedDocument.status)}
                  </Badge>
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
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-md"
                  disabled={!selectedDocument.storagePath}
                  onClick={() => downloadDocument(selectedDocument)}
                >
                  <Download className="mr-2 size-4" />
                  Descargar PDF
                </Button>
                <Button type="button" variant="outline" className="rounded-md" onClick={() => void copyReviewLink()}>
                  <Copy className="mr-2 size-4" />
                  Copiar link de revision
                </Button>
                {selectedDocument.canDelete ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="destructiveSecondary"
                        className="rounded-md"
                        disabled={deletingId === selectedDocument.id}
                      >
                        {deletingId === selectedDocument.id ? (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : (
                          <Trash2 className="mr-2 size-4" />
                        )}
                        Eliminar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar este documento?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Se eliminaran de forma permanente el PDF y los datos extraidos asociados. El
                          borrador de origen se conserva. Esta accion no se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className={buttonVariants({ variant: "destructive" })}
                          onClick={() => void deleteSelectedDocument()}
                        >
                          Eliminar documento
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}
              </div>
            </>
          ) : (
            <div className="grid min-h-[220px] place-items-center text-center text-sm text-content-muted">
              Selecciona un documento para ver su detalle.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
