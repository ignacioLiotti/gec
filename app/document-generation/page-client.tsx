"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  Check,
  ChevronsUpDown,
  Copy,
  Download,
  Eye,
  FileCheck2,
  FileText,
  FolderOpen,
  Info,
  LayoutTemplate,
  Loader2,
  MoreHorizontal,
  Plus,
  Save,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";

import {
  DOCUMENT_TYPE_LABELS,
  applyTemplateAutoInputData,
  buildInitialInputData,
  type DocumentTemplateSummary,
  type DocumentType,
  normalizeDocumentType,
  renderDocumentHtml,
  type TemplateField,
  validateTemplateInput,
  type ValidationError,
} from "@/lib/document-generation";
import { Button } from "@/components/ui/button";
import { DocumentApprovedSeal } from "@/components/document-approved-seal";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type WorkOption = {
  id: string;
  label: string;
};

type FolderConfig = {
  path: string;
  name: string;
  allowedDocumentTypes: DocumentType[];
  defaultDocumentType: DocumentType | null;
};

type BootstrapResponse = {
  works: WorkOption[];
  folderConfigs: FolderConfig[];
  templates: DocumentTemplateSummary[];
  context: {
    workId: string | null;
    workLabel: string | null;
    existingSequenceCount: number;
    existingDocumentCount?: number;
    folderPath: string | null;
    folderCandidates: FolderConfig[];
    allowedDocumentTypes: DocumentType[];
    documentType: DocumentType | null;
    selectedTemplate: DocumentTemplateSummary | null;
    initialInputData: Record<string, unknown>;
  };
};

type DraftResponse = {
  draft: {
    id: string;
    status: string;
    validation_errors: ValidationError[];
    input_data: Record<string, unknown>;
  };
};

type DraftDetailResponse = {
  draft: {
    id: string;
    workId: string;
    workLabel: string;
    folderPath: string;
    documentType: string;
    templateId: string;
    templateName: string | null;
    status: string;
    inputData: Record<string, unknown>;
    validationErrors: ValidationError[];
    canEdit: boolean;
  };
};

type GeneratedDetailResponse = {
  document: {
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
    canEdit: boolean;
    previewHtml: string;
  };
};

type GeneratedDocumentResponse = {
  generatedDocument: {
    id: string;
    status: string;
    file_name: string;
    storage_path?: string;
  };
  relativeFolderPath: string;
  relativeFilePath: string;
  previewHtml: string;
};

type RepeatableGroupDescriptor = {
  key: string;
  label: string;
  fields: TemplateField[];
};

type ValidationIssue = {
  kind: "error" | "warn";
  message: string;
};

function getRepeatableGroups(fields: TemplateField[]): RepeatableGroupDescriptor[] {
  const groups = new Map<string, { label: string; fields: TemplateField[] }>();

  for (const field of fields) {
    if (field.type === "table") {
      groups.set(field.key, {
        label: field.label,
        fields: field.columns ?? [],
      });
      continue;
    }

    if (!field.repeatableGroup) continue;
    const current = groups.get(field.repeatableGroup) ?? {
      label: field.repeatableGroupLabel || field.repeatableGroup,
      fields: [],
    };
    current.fields.push(field);
    groups.set(field.repeatableGroup, current);
  }

  return Array.from(groups.entries()).map(([key, value]) => ({
    key,
    label: value.label,
    fields: value.fields,
  }));
}

function createRepeatableRow(fields: TemplateField[]) {
  return Object.fromEntries(fields.map((field) => [field.key, field.defaultValue ?? ""]));
}

function readRepeatableRows(inputData: Record<string, unknown>, groupKey: string) {
  const rows = inputData[groupKey];
  return Array.isArray(rows) ? rows : [];
}

function rowHasValues(row: unknown) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return false;
  return Object.values(row).some((value) => String(value ?? "").trim().length > 0);
}

function countFilledRows(rows: unknown[]) {
  return rows.filter((row) => rowHasValues(row)).length;
}

function humanizeStatus(status: string) {
  return status.toLowerCase().replace(/_/g, " ");
}

function getDocumentCode(inputData: Record<string, unknown>) {
  const candidateKeys = ["numero", "document_number", "nro", "folio", "codigo"];
  for (const key of candidateKeys) {
    const value = inputData[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "Sin numero";
}

function getTemplateFieldSpan(field: TemplateField) {
  if (field.type === "textarea") return "md:col-span-3";
  if (field.type === "select") return "md:col-span-2";
  return "";
}

function buildValidationIssues(args: {
  workId: string;
  folderPath: string;
  documentType: DocumentType | "";
  templateId: string;
  validationErrors: ValidationError[];
  repeatableGroups: RepeatableGroupDescriptor[];
  inputData: Record<string, unknown>;
}) {
  const { workId, folderPath, documentType, templateId, validationErrors, repeatableGroups, inputData } = args;
  const issues: ValidationIssue[] = [];

  if (!workId) issues.push({ kind: "error", message: "Falta seleccionar la obra." });
  if (!documentType) issues.push({ kind: "error", message: "Falta seleccionar el tipo documental." });
  if (!folderPath) issues.push({ kind: "error", message: "Falta seleccionar la carpeta destino." });
  if (!templateId) issues.push({ kind: "error", message: "Falta seleccionar la plantilla." });

  for (const error of validationErrors) {
    issues.push({ kind: "error", message: error.message });
  }

  for (const group of repeatableGroups) {
    const filledRows = countFilledRows(readRepeatableRows(inputData, group.key));
    if (filledRows === 0) {
      issues.push({
        kind: "warn",
        message: `${group.label}: aun no hay filas cargadas.`,
      });
    }
  }

  return issues;
}

function iconForContextField(kind: "work" | "type" | "folder" | "template") {
  switch (kind) {
    case "work":
      return <Building2 className="size-3.5" />;
    case "type":
      return <FileText className="size-3.5" />;
    case "folder":
      return <FolderOpen className="size-3.5" />;
    case "template":
      return <LayoutTemplate className="size-3.5" />;
  }
}

function controlBaseClass(error?: boolean) {
  return cn(
    "h-11 w-full rounded-md border bg-white px-3 text-sm text-stone-900 outline-none transition",
    "placeholder:text-stone-400 focus:border-[#ff5800] focus:ring-4 focus:ring-[#ff5800]/10",
    error ? "border-red-200" : "border-stone-200",
  );
}

function RepeatableRowMenu({
  onDuplicate,
  onRemove,
}: {
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex justify-center">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="rounded-md p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open ? (
        <>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
            aria-label="Cerrar menu"
          />
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[144px] overflow-hidden rounded-md border border-stone-200 bg-white shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDuplicate();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-stone-700 transition hover:bg-stone-50"
            >
              <Copy className="size-3.5" />
              Duplicar
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onRemove();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-700 transition hover:bg-red-50"
            >
              <Trash2 className="size-3.5" />
              Eliminar
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function PreviewToolButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex size-8 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function SectionCard({
  eyebrow,
  title,
  hint,
  children,
  rightSlot,
}: {
  eyebrow?: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]">
      <div className="border-b border-stone-200 bg-[linear-gradient(180deg,#ffffff_0%,#fafaf9_100%)] px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            {eyebrow ? <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">{eyebrow}</p> : null}
            <h2 className="text-[14px] font-semibold text-stone-950">{title}</h2>
            {hint ? <p className="mt-1 text-[13px] leading-6 text-stone-500">{hint}</p> : null}
          </div>
          {rightSlot}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function FormField({
  label,
  required,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <label className="flex items-center gap-1 text-[12px] font-semibold text-stone-800">
        {label}
        {required ? <span className="text-[#ff5800]">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-[11px] text-red-700">
          <AlertCircle className="size-3.5" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] text-stone-500">{hint}</p>
      ) : null}
    </div>
  );
}

function NativeSelect({
  value,
  onChange,
  options,
  placeholder,
  icon,
  error,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  icon?: React.ReactNode;
  error?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      {icon ? (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">
          {icon}
        </span>
      ) : null}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={cn(
          controlBaseClass(error),
          "appearance-none pr-10 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500",
          icon ? "pl-9" : "pl-3",
        )}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  icon,
  mono,
  error,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  mono?: boolean;
  error?: boolean;
  type?: "text" | "number" | "date";
}) {
  return (
    <div className="relative">
      {icon ? (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">
          {icon}
        </span>
      ) : null}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(controlBaseClass(error), icon ? "pl-9" : "pl-3", mono && "font-mono")}
      />
    </div>
  );
}

function CreatableCombobox({
  fieldKey,
  value,
  onChange,
  options,
  placeholder,
  error,
}: {
  fieldKey: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  error?: boolean;
}) {
  const listId = `document-field-options-${fieldKey}`;
  return (
    <div>
      <input
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(controlBaseClass(error), "pl-3")}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </datalist>
    </div>
  );
}

function TextAreaInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      rows={3}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full rounded-md border border-stone-200 bg-white px-3 py-3 text-sm text-stone-900 outline-none transition",
        "placeholder:text-stone-400 focus:border-[#ff5800] focus:ring-4 focus:ring-[#ff5800]/10",
      )}
    />
  );
}

export function DocumentGenerationPageClient() {
  const router = useRouter();
  const { push, replace } = router;
  const searchParams = useSearchParams();
  const queryParams = new URLSearchParams(searchParams);
  const getSearchParam = (key: string): string | null => queryParams.get(key);

  const initialWorkId = getSearchParam("workId") ?? "";
  const initialFolderPath = getSearchParam("folder") ?? getSearchParam("folderPath") ?? "";
  const initialDocumentType = normalizeDocumentType(getSearchParam("documentType"));
  const initialDraftId = getSearchParam("draftId") ?? "";
  const initialGeneratedId = getSearchParam("generatedId") ?? "";

  const [workId, setWorkId] = useState(initialWorkId);
  const [folderPath, setFolderPath] = useState(initialFolderPath);
  const [documentType, setDocumentType] = useState<DocumentType | "">(initialDocumentType ?? "");
  const [templateId, setTemplateId] = useState("");
  const [works, setWorks] = useState<WorkOption[]>([]);
  const [workLabel, setWorkLabel] = useState<string | null>(null);
  const [existingSequenceCount, setExistingSequenceCount] = useState(0);
  const [folderConfigs, setFolderConfigs] = useState<FolderConfig[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplateSummary[]>([]);
  const [inputData, setInputData] = useState<Record<string, unknown>>({});
  const [draftId, setDraftId] = useState<string>(initialDraftId);
  const [editingGeneratedId, setEditingGeneratedId] = useState<string>(initialGeneratedId);
  const [editingGeneratedStatus, setEditingGeneratedStatus] = useState<string>("");
  const [draftStatus, setDraftStatus] = useState<string>("");
  const [generatedDocument, setGeneratedDocument] = useState<GeneratedDocumentResponse | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(92);

  const loadBootstrap = useCallback(
    async (
      params?: { workId?: string; folderPath?: string; documentType?: string },
      options?: { templateId?: string; inputData?: Record<string, unknown>; replaceInputData?: boolean },
    ) => {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        if (params?.workId ?? workId) query.set("workId", params?.workId ?? workId);
        if (params?.folderPath ?? folderPath) query.set("folderPath", params?.folderPath ?? folderPath);
        if (params?.documentType ?? documentType) {
          query.set("documentType", params?.documentType ?? String(documentType));
        }

        const response = await fetch(`/api/document-generation/bootstrap?${query.toString()}`);
        const payload = (await response.json()) as BootstrapResponse & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "No se pudo cargar la configuracion");
        }

        setWorks(payload.works);
        setWorkLabel(payload.context.workLabel);
        setExistingSequenceCount(payload.context.existingSequenceCount ?? payload.context.existingDocumentCount ?? 0);
        setFolderConfigs(payload.folderConfigs);
        setTemplates(payload.templates);
        setFolderPath(payload.context.folderPath ?? (params?.folderPath ?? folderPath));
        setDocumentType(payload.context.documentType ?? "");
        setTemplateId(options?.templateId ?? payload.context.selectedTemplate?.id ?? "");
        setInputData((current) =>
          options?.replaceInputData
            ? { ...payload.context.initialInputData, ...(options.inputData ?? {}) }
            : { ...payload.context.initialInputData, ...current },
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error al cargar datos");
      } finally {
        setLoading(false);
      }
    },
    [documentType, folderPath, workId],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (initialDraftId) {
        setLoading(true);
        try {
          const response = await fetch(`/api/document-generation/drafts?id=${encodeURIComponent(initialDraftId)}`, {
            cache: "no-store",
          });
          const payload = (await response.json()) as DraftDetailResponse & { error?: string };
          if (!response.ok) {
            throw new Error(payload.error || "No se pudo cargar el borrador");
          }
          if (cancelled) return;
          if (!payload.draft.canEdit) {
            toast.error("No tienes permisos para editar este borrador.");
            replace("/document-generation/drafts", { scroll: false });
            return;
          }

          setWorkId(payload.draft.workId);
          setFolderPath(payload.draft.folderPath);
          setDocumentType(normalizeDocumentType(payload.draft.documentType) ?? "");
          setDraftId(payload.draft.id);
          setEditingGeneratedId("");
          setEditingGeneratedStatus("");
          setDraftStatus(payload.draft.status);
          setValidationErrors(payload.draft.validationErrors ?? []);
          setGeneratedDocument(null);
          await loadBootstrap(
            {
              workId: payload.draft.workId,
              folderPath: payload.draft.folderPath,
              documentType: payload.draft.documentType,
            },
            {
              templateId: payload.draft.templateId,
              inputData: payload.draft.inputData,
              replaceInputData: true,
            },
          );
        } catch (error) {
          if (!cancelled) {
            toast.error(error instanceof Error ? error.message : "No se pudo cargar el borrador");
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
        return;
      }

      if (initialGeneratedId) {
        setLoading(true);
        try {
          const response = await fetch(`/api/document-generation/generated/${encodeURIComponent(initialGeneratedId)}`, {
            cache: "no-store",
          });
          const payload = (await response.json()) as GeneratedDetailResponse & { error?: string };
          if (!response.ok) {
            throw new Error(payload.error || "No se pudo cargar el documento");
          }
          if (cancelled) return;
          if (!payload.document.canEdit) {
            toast.error("Solo puedes editar documentos tuyos que aun no fueron aprobados.");
            replace("/document-generation", { scroll: false });
            return;
          }

          setWorkId(payload.document.workId);
          setFolderPath(payload.document.folderPath);
          setDocumentType(normalizeDocumentType(payload.document.documentType) ?? "");
          setDraftId("");
          setDraftStatus("");
          setEditingGeneratedId(payload.document.id);
          setEditingGeneratedStatus(payload.document.status);
          setValidationErrors([]);
          setGeneratedDocument(null);
          await loadBootstrap(
            {
              workId: payload.document.workId,
              folderPath: payload.document.folderPath,
              documentType: payload.document.documentType,
            },
            {
              templateId: payload.document.templateId,
              inputData: payload.document.inputData,
              replaceInputData: true,
            },
          );
        } catch (error) {
          if (!cancelled) {
            toast.error(error instanceof Error ? error.message : "No se pudo cargar el documento");
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
        return;
      }

      setDraftId("");
      setEditingGeneratedId("");
      setEditingGeneratedStatus("");
      setDraftStatus("");
      setGeneratedDocument(null);
      setValidationErrors([]);
      await loadBootstrap({
        workId: initialWorkId,
        folderPath: initialFolderPath,
        documentType: initialDocumentType ?? undefined,
      });
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [initialDocumentType, initialDraftId, initialFolderPath, initialGeneratedId, initialWorkId, loadBootstrap, router]);

  useEffect(() => {
    const query = new URLSearchParams();
    if (workId) query.set("workId", workId);
    if (folderPath) query.set("folder", folderPath);
    if (documentType) query.set("documentType", documentType);
    if (draftId) query.set("draftId", draftId);
    if (editingGeneratedId) query.set("generatedId", editingGeneratedId);
    const next = query.toString();
    replace(`/document-generation${next ? `?${next}` : ""}`, { scroll: false });
  }, [documentType, draftId, editingGeneratedId, folderPath, router, workId]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) ?? null,
    [templateId, templates],
  );

  const visibleFolderOptions = useMemo(() => {
    if (!documentType) return folderConfigs;
    return folderConfigs.filter((config) => config.allowedDocumentTypes.includes(documentType));
  }, [documentType, folderConfigs]);

  const standaloneFields = useMemo(
    () => selectedTemplate?.schema.fields.filter((field) => !field.repeatableGroup && field.type !== "table") ?? [],
    [selectedTemplate],
  );

  const repeatableGroups = useMemo(
    () => getRepeatableGroups(selectedTemplate?.schema.fields ?? []),
    [selectedTemplate],
  );
  const deferredInputData = useDeferredValue(inputData);

  const previewHtml = useMemo(() => {
    if (!selectedTemplate) return "";
    const workLabel = works.find((work) => work.id === workId)?.label ?? "";
    return renderDocumentHtml(selectedTemplate.contentHtml, deferredInputData, {
      workName: workLabel,
      generatedAt: new Date().toLocaleDateString("es-AR"),
    });
  }, [deferredInputData, selectedTemplate, workId, works]);

  const validationErrorsByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const error of validationErrors) {
      map.set(error.key, error.message);
    }
    return map;
  }, [validationErrors]);

  const pendingFieldCount = useMemo(() => {
    if (!selectedTemplate) return 0;
    return validateTemplateInput(selectedTemplate.schema, deferredInputData).length;
  }, [deferredInputData, selectedTemplate]);

  const draftStatusLabel = draftStatus ? humanizeStatus(draftStatus) : "sin guardar";
  const documentCode = getDocumentCode(deferredInputData);
  const isEditingGeneratedDocument = Boolean(editingGeneratedId);
  const validationIssues = useMemo(
    () =>
      buildValidationIssues({
        workId,
        folderPath,
        documentType,
        templateId,
        validationErrors,
        repeatableGroups,
        inputData: deferredInputData,
      }),
    [deferredInputData, documentType, folderPath, repeatableGroups, templateId, validationErrors, workId],
  );

  const handleWorkChange = async (value: string) => {
    setWorkId(value);
    setDraftId("");
    setDraftStatus("");
    setGeneratedDocument(null);
    setValidationErrors([]);
    await loadBootstrap({ workId: value, folderPath, documentType: documentType || undefined });
  };

  const handleDocumentTypeChange = async (value: string) => {
    const nextType = normalizeDocumentType(value) ?? "";
    setDocumentType(nextType);
    setDraftId("");
    setDraftStatus("");
    setGeneratedDocument(null);
    setValidationErrors([]);
    await loadBootstrap({ workId, folderPath, documentType: nextType || undefined });
  };

  const handleFolderChange = async (value: string) => {
    setFolderPath(value);
    setDraftId("");
    setDraftStatus("");
    setGeneratedDocument(null);
    setValidationErrors([]);
    await loadBootstrap({ workId, folderPath: value, documentType: documentType || undefined });
  };

  const handleTemplateChange = (value: string) => {
    setTemplateId(value);
    setValidationErrors([]);
    const nextTemplate = templates.find((template) => template.id === value) ?? null;
    if (!nextTemplate) return;
    setInputData(
      applyTemplateAutoInputData(nextTemplate.schema, buildInitialInputData(nextTemplate.schema, inputData), {
        selectedContextId: workId,
        selectedContextLabel: workLabel,
        documentType,
        existingSequenceCount,
      }),
    );
  };

  const handleFieldChange = (field: TemplateField, value: string) => {
    setInputData((current) => ({
      ...current,
      [field.key]: value,
    }));
  };

  const handleRepeatableFieldChange = (
    groupKey: string,
    rowIndex: number,
    field: TemplateField,
    value: string,
  ) => {
    setInputData((current) => {
      const rows = readRepeatableRows(current, groupKey);
      return {
        ...current,
        [groupKey]: rows.map((row, index) => {
          const rowData =
            row && typeof row === "object" && !Array.isArray(row)
              ? (row as Record<string, unknown>)
              : {};
          return index === rowIndex ? { ...rowData, [field.key]: value } : rowData;
        }),
      };
    });
  };

  const addRepeatableRow = (groupKey: string, fields: TemplateField[]) => {
    setInputData((current) => ({
      ...current,
      [groupKey]: [...readRepeatableRows(current, groupKey), createRepeatableRow(fields)],
    }));
  };

  const duplicateRepeatableRow = (groupKey: string, rowIndex: number) => {
    setInputData((current) => {
      const rows = readRepeatableRows(current, groupKey);
      const next = rows.slice();
      const source = rows[rowIndex];
      next.splice(rowIndex + 1, 0, source);
      return {
        ...current,
        [groupKey]: next,
      };
    });
  };

  const removeRepeatableRow = (groupKey: string, rowIndex: number) => {
    setInputData((current) => ({
      ...current,
      [groupKey]: readRepeatableRows(current, groupKey).filter((_, index) => index !== rowIndex),
    }));
  };

  const handleSaveDraft = async () => {
    if (editingGeneratedId) {
      toast.error("Los documentos emitidos se actualizan directo al guardar cambios.");
      return;
    }
    if (!workId || !folderPath || !documentType || !templateId) {
      toast.error("Completa obra, carpeta, tipo documental y plantilla.");
      return;
    }

    setSavingDraft(true);
    try {
      const response = await fetch("/api/document-generation/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draftId || undefined,
          workId,
          folderPath,
          documentType,
          templateId,
          inputData,
        }),
      });
      const payload = (await response.json()) as DraftResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "No se pudo guardar el borrador");
      }

      setDraftId(payload.draft.id);
      setDraftStatus(payload.draft.status);
      setValidationErrors(payload.draft.validation_errors ?? []);
      setInputData(payload.draft.input_data ?? inputData);
      toast.success("Borrador guardado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el borrador");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleGenerate = async () => {
    if (!workId || !folderPath || !documentType || !templateId) {
      toast.error("Completa obra, carpeta, tipo documental y plantilla.");
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch("/api/document-generation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: draftId || undefined,
          generatedDocumentId: editingGeneratedId || undefined,
          workId,
          folderPath,
          documentType,
          templateId,
          inputData,
        }),
      });
      const payload = (await response.json()) as GeneratedDocumentResponse & {
        error?: string;
        validationErrors?: ValidationError[];
      };
      if (!response.ok) {
        setValidationErrors(payload.validationErrors ?? []);
        throw new Error(payload.error || "No se pudo generar el documento");
      }

      setGeneratedDocument(payload);
      if (editingGeneratedId) {
        setEditingGeneratedStatus(payload.generatedDocument.status);
      }
      setValidationErrors([]);
      toast.success(editingGeneratedId ? "Documento actualizado." : "Documento generado y guardado en la carpeta.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo generar el documento");
    } finally {
      setGenerating(false);
    }
  };

  const openInWork = () => {
    if (!generatedDocument || !workId) return;
    const query = new URLSearchParams({
      tab: "documentos",
      folder: generatedDocument.relativeFolderPath,
      file: generatedDocument.relativeFilePath,
    });
    push(`/excel/${workId}?${query.toString()}`);
  };

  const downloadGeneratedDocument = () => {
    if (!generatedDocument || !workId) return;
    const storagePath =
      generatedDocument.generatedDocument.storage_path || `${workId}/${generatedDocument.relativeFilePath}`;
    const query = new URLSearchParams({
      path: storagePath,
      download: "1",
    });
    const anchor = document.createElement("a");
    anchor.href = `/api/obras/${encodeURIComponent(workId)}/documents/access?${query.toString()}`;
    anchor.download = generatedDocument.generatedDocument.file_name || "documento.pdf";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const renderFieldControl = (
    field: TemplateField,
    value: unknown,
    onChange: (nextValue: string) => void,
  ) => {
    if (field.type === "textarea") {
      return (
        <TextAreaInput
          value={String(value ?? "")}
          onChange={onChange}
          placeholder={`Completar ${field.label.toLowerCase()}`}
        />
      );
    }

    if (field.type === "select") {
      const options = (field.options ?? []).map((option) => ({
        value: option.value,
        label: option.label,
      }));
      if (field.selectMode === "creatable") {
        return (
          <CreatableCombobox
            fieldKey={field.key}
            value={String(value ?? "")}
            onChange={onChange}
            placeholder={`Seleccionar o crear ${field.label.toLowerCase()}`}
            options={options}
          />
        );
      }
      return (
        <NativeSelect
          value={String(value ?? "")}
          onChange={onChange}
          placeholder={`Seleccionar ${field.label.toLowerCase()}`}
          options={options}
        />
      );
    }

    return (
      <TextInput
        value={String(value ?? "")}
        onChange={onChange}
        placeholder={`Completar ${field.label.toLowerCase()}`}
        mono={field.type === "money" || field.type === "number"}
        type={field.type === "date" ? "date" : field.type === "number" || field.type === "money" ? "number" : "text"}
        icon={field.type === "date" ? <CalendarDays className="size-3.5" /> : undefined}
      />
    );
  };

  return (
    <div className="w-full ">
      <div className="border-b border-stone-200 bg-white">
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-stone-950">
                {draftId ? "Editar borrador" : editingGeneratedId ? "Editar documento" : "Nuevo documento"}
              </h1>
              <span className="rounded-md border border-stone-200 bg-stone-50 px-3 py-1 font-mono text-xs text-stone-500">
                {documentCode}
              </span>
              {editingGeneratedId ? (
                <span className="rounded-md border border-stone-200 bg-white px-3 py-1 text-xs uppercase text-stone-500">
                  {generatedDocument?.generatedDocument.status ?? editingGeneratedStatus}
                </span>
              ) : null}
              <span className="rounded-md border border-stone-200 bg-white px-3 py-1 text-xs capitalize text-stone-500">
                {editingGeneratedId ? "documento emitido" : draftStatusLabel}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleSaveDraft}
              disabled={savingDraft || loading || Boolean(editingGeneratedId)}
              className="h-9 rounded-md px-4 text-stone-700"
              hidden={Boolean(editingGeneratedId)}
            >
              {savingDraft ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              Guardar borrador
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewDialogOpen(true)}
              className="h-9 rounded-md border-stone-200 bg-white px-4"
            >
              <Eye className="mr-2 size-4" />
              Vista previa completa
            </Button>
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={generating || loading || !selectedTemplate}
              className="h-9 rounded-md bg-[linear-gradient(180deg,#201E25_0%,#323137_100%)] px-4 text-white shadow-[0_2px_4px_rgba(0,0,0,0.10),0_0_0_1px_#0D0D0D]"
            >
              {generating ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <FileCheck2 className="mr-2 size-4" />
              )}
              {editingGeneratedId ? "Guardar cambios" : "Generar documento"}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid min-h-[calc(100vh-162px)] grid-cols-1 xl:grid-cols-[minmax(480px,1fr)_minmax(0,0.5fr)]">
        <div className="overflow-y-auto border-r ">
          <div className="px-4 pb-5 sm:px-6">
            <div className="mx-auto flex flex-col gap-4 mt-4">
              <SectionCard
                title="Contexto del documento"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Obra" required>
                    <NativeSelect
                      value={workId}
                      onChange={(value) => void handleWorkChange(value)}
                      icon={iconForContextField("work")}
                      options={works.map((work) => ({ value: work.id, label: work.label }))}
                      placeholder="Seleccionar obra"
                      disabled={isEditingGeneratedDocument}
                    />
                  </FormField>

                  <FormField label="Tipo documental" required>
                    <NativeSelect
                      value={documentType}
                      onChange={(value) => void handleDocumentTypeChange(value)}
                      icon={iconForContextField("type")}
                      options={Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => ({
                        value,
                        label,
                      }))}
                      placeholder="Seleccionar tipo"
                      disabled={isEditingGeneratedDocument}
                    />
                  </FormField>

                  <FormField label="Carpeta destino" required>
                    <NativeSelect
                      value={folderPath}
                      onChange={(value) => void handleFolderChange(value)}
                      icon={iconForContextField("folder")}
                      options={visibleFolderOptions.map((folder) => ({
                        value: folder.path,
                        label: `${folder.path} · ${folder.name}`,
                      }))}
                      placeholder="Seleccionar carpeta"
                      disabled={isEditingGeneratedDocument}
                    />
                  </FormField>

                  <FormField
                    label="Plantilla"
                    required
                    hint="La plantilla define los campos del paso siguiente."
                  >
                    <NativeSelect
                      value={templateId}
                      onChange={handleTemplateChange}
                      icon={iconForContextField("template")}
                      options={templates.map((template) => ({
                        value: template.id,
                        label: template.name,
                      }))}
                      placeholder="Seleccionar plantilla"
                    />
                  </FormField>
                </div>
              </SectionCard>

              <SectionCard
                title="Datos del documento"
                rightSlot={
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-orange-200 bg-white px-3 py-1 text-[11px] font-medium text-[#d65a07]">
                      {pendingFieldCount} pendientes
                    </span>
                    <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] font-medium text-stone-600">
                      borrador {draftStatusLabel}
                    </span>
                  </div>
                }
              >
                {selectedTemplate ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    {standaloneFields.map((field) => {
                      const value = inputData[field.key];
                      const error = validationErrorsByKey.get(field.key);
                      return (
                        <FormField
                          key={field.key}
                          label={field.label}
                          required={field.required}
                          hint={field.description || undefined}
                          error={error}
                          className={getTemplateFieldSpan(field)}
                        >
                          {renderFieldControl(field, value, (nextValue) => handleFieldChange(field, nextValue))}
                        </FormField>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center text-sm text-stone-500">
                    Selecciona una plantilla para mostrar los campos del documento.
                  </div>
                )}
              </SectionCard>

              {repeatableGroups.map((group) => {
                const rows = readRepeatableRows(inputData, group.key);
                const safeRows = rows.length > 0 ? rows : [createRepeatableRow(group.fields)];
                const filledRows = countFilledRows(rows);

                return (
                  <SectionCard
                    key={group.key}
                    title={group.label}
                    rightSlot={
                      <button
                        type="button"
                        onClick={() => addRepeatableRow(group.key, group.fields)}
                        className="inline-flex h-8 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-xs font-medium text-stone-700 transition hover:bg-stone-50"
                      >
                        <Plus className="size-3.5" />
                        Agregar fila
                      </button>
                    }
                  >
                    <div className="space-y-4">
                      <div className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] font-medium text-stone-600">
                        {filledRows} fila{filledRows === 1 ? "" : "s"} con datos
                      </div>

                      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white overflow-x-scroll">
                        <div
                          className="grid items-center bg-[#f1f3f6] text-[10px] font-bold uppercase tracking-[0.12em] text-[#5b616b]"
                          style={{
                            gridTemplateColumns: `40px repeat(${Math.max(group.fields.length, 1)}, minmax(120px, 1fr)) 40px`,
                          }}
                        >
                          <div className="px-3 py-2 text-center">#</div>
                          {group.fields.map((field) => (
                            <div key={`${group.key}-head-${field.key}`} className="px-3 py-2">
                              {field.label}
                            </div>
                          ))}
                          <div className="px-3 py-2 text-center" />
                        </div>

                        {safeRows.map((row, rowIndex) => {
                          const rowData =
                            row && typeof row === "object" && !Array.isArray(row)
                              ? (row as Record<string, unknown>)
                              : {};
                          return (
                            <div
                              key={`${group.key}-${rowIndex}`}
                              className="grid items-start border-t border-stone-200 bg-white"
                              style={{
                                gridTemplateColumns: `40px repeat(${Math.max(group.fields.length, 1)}, minmax(120px, 1fr)) 40px`,
                              }}
                            >
                              <div className="px-3 py-4 text-center font-mono text-xs text-stone-400">
                                {String(rowIndex + 1).padStart(2, "0")}
                              </div>
                              {group.fields.map((field) => (
                                <div key={`${group.key}-${rowIndex}-${field.key}`} className="p-2">
                                  {renderFieldControl(field, rowData[field.key], (nextValue) =>
                                    handleRepeatableFieldChange(group.key, rowIndex, field, nextValue),
                                  )}
                                </div>
                              ))}
                              <div className="px-2 py-3">
                                <RepeatableRowMenu
                                  onDuplicate={() => duplicateRepeatableRow(group.key, rowIndex)}
                                  onRemove={() => removeRepeatableRow(group.key, rowIndex)}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </SectionCard>
                );
              })}

              <SectionCard
                title="Revision"
              >
                {validationIssues.length === 0 ? (
                  <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <Check className="size-4 text-emerald-700" />
                    <p className="text-sm font-medium text-emerald-800">
                      Todo lo obligatorio esta completo. Ya puedes generar el documento.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                    <div className="flex items-center gap-2 border-b border-stone-200 bg-stone-50 px-4 py-3">
                      <Info className="size-4 text-stone-600" />
                      <p className="text-sm font-medium text-stone-900">Revisa antes de generar</p>
                      <span className="ml-auto font-mono text-xs text-stone-500">
                        {validationIssues.length} pendiente{validationIssues.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div>
                      {validationIssues.map((issue, index) => (
                        <div
                          key={`${issue.kind}-${issue.message}-${index}`}
                          className="flex items-center gap-3 border-t border-stone-100 px-4 py-3 text-sm text-stone-700 first:border-t-0"
                        >
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full",
                              issue.kind === "error" ? "bg-red-500" : "bg-amber-500",
                            )}
                          />
                          {issue.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </SectionCard>

              {generatedDocument ? (
                <SectionCard
                  eyebrow="Documento generado"
                  title={generatedDocument.generatedDocument.file_name}
                  hint={`Guardado en ${generatedDocument.relativeFolderPath}.`}
                  rightSlot={
                    generatedDocument.generatedDocument.status === "APPROVED" ? (
                      <DocumentApprovedSeal status={generatedDocument.generatedDocument.status} />
                    ) : (
                      <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] font-medium capitalize text-stone-700">
                        {humanizeStatus(generatedDocument.generatedDocument.status)}
                      </span>
                    )
                  }
                >
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" onClick={openInWork} className="rounded-md">
                      Ver en la obra
                    </Button>
                    <Button asChild type="button" variant="outline" className="rounded-md">
                      <Link
                        href={`/excel/${workId}?tab=documentos&folder=${encodeURIComponent(generatedDocument.relativeFolderPath)}&file=${encodeURIComponent(generatedDocument.relativeFilePath)}`}
                      >
                        Abrir documento
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={downloadGeneratedDocument}
                      className="rounded-md"
                    >
                      <Download className="mr-2 size-4" />
                      Descargar
                    </Button>
                    <Button asChild type="button" variant="outline" className="rounded-md">
                      <Link href="/document-generation/review">
                        Ir a revision
                      </Link>
                    </Button>
                  </div>
                </SectionCard>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="sticky top-0 flex max-h-[100vh] min-h-[640px] flex-col overflow-hidden bg-[#e9e7e1]">
          <div className="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-3">
            <div className="flex items-center gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">
                Vista previa
              </p>
              <span className="inline-flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1 font-mono text-[11px] text-stone-600">
                <span className="size-1.5 rounded-full bg-[#ff5800]" />
                en vivo
              </span>
            </div>

            <div className="flex items-center gap-2">
              <PreviewToolButton
                onClick={() => setPreviewZoom((current) => Math.max(50, current - 8))}
                disabled={!selectedTemplate}
              >
                <ZoomOut className="size-3.5" />
              </PreviewToolButton>
              <span className="min-w-[38px] text-center font-mono text-xs text-stone-600">
                {previewZoom}%
              </span>
              <PreviewToolButton
                onClick={() => setPreviewZoom((current) => Math.min(140, current + 8))}
                disabled={!selectedTemplate}
              >
                <ZoomIn className="size-3.5" />
              </PreviewToolButton>
              <div className="mx-1 h-5 w-px bg-stone-200" />
              <PreviewToolButton onClick={() => setPreviewDialogOpen(true)} disabled={!selectedTemplate}>
                <Eye className="size-3.5" />
              </PreviewToolButton>
            </div>
          </div>

          <div className="report-preview-container flex-1 overflow-auto p-6">
            {selectedTemplate ? (
              <div className="relative max-h-full">
                <DocumentApprovedSeal
                  status={generatedDocument?.generatedDocument.status ?? null}
                  size="sm"
                  className="absolute left-5 top-5 z-20 w-full"
                />
                <div className="report-paper report-paper-fit-preview bg-white ">
                  <div dangerouslySetInnerHTML={{ __html: previewHtml }} className="" />
                </div>
              </div>
            ) : (
              <div className="grid min-h-[560px] place-items-center rounded-xl border border-dashed border-stone-300 bg-white px-6 text-center">
                <div>
                  <p className="text-sm font-medium text-stone-800">
                    La vista previa aparece aca.
                  </p>
                  <p className="mt-2 text-sm text-stone-500">
                    Elige obra, tipo documental y plantilla para renderizar el documento.
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-hidden rounded-2xl p-0">
          <DialogHeader className="border-b border-stone-200 px-6 py-5">
            <DialogTitle>Vista previa completa</DialogTitle>
            <DialogDescription>
              Documento renderizado con los datos cargados hasta ahora.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(92vh-96px)] overflow-auto bg-[#f4f3ee] p-6">
            {selectedTemplate ? (
              <div className="mx-auto w-fit rounded-xl border border-stone-300 bg-[#e9e7e1] p-8 shadow-[0_4px_12px_rgba(31,35,40,0.06)]">
                <div className="relative report-paper min-w-max bg-white">
                  <DocumentApprovedSeal
                    status={generatedDocument?.generatedDocument.status ?? null}
                    size="md"
                    className="absolute left-5 top-5 z-20"
                  />
                  <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                </div>
              </div>
            ) : (
              <div className="grid min-h-[420px] place-items-center rounded-[24px] border border-dashed border-stone-300 bg-white px-6 text-center text-sm text-stone-500">
                Selecciona una plantilla para renderizar el documento.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
