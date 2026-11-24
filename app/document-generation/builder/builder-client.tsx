"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Calculator,
  CalendarDays,
  ClipboardCopy,
  FileText,
  Hash,
  Link2,
  List,
  PenLine,
  Plus,
  Rows3,
  Sigma,
  Sparkles,
  Table2,
  Text,
  Type,
} from "lucide-react";
import { AnimatePresence } from "motion/react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  applyTemplateFormulaInputData,
  formatDocumentTypeLabel,
  renderDocumentHtml,
  type DocumentTemplateSummary,
} from "@/lib/document-generation";
import {
  buildSpecSampleInput,
  compileTemplateSpec,
  readTemplateSpec,
  validateTemplateSpec,
  type ReferenceSourceDescriptor,
  type SpecFieldType,
  type TemplateSpec,
} from "@/lib/document-template-spec";
import { cn } from "@/lib/utils";

import { AssistantDock, AssistantDropzone, AssistantReading, assistantSuggestions } from "./builder-assistant";
import { BuilderCanvas, type CanvasChange } from "./builder-canvas";
import { DocumentPreview } from "./builder-document-preview";
import { BuilderInspector } from "./builder-inspector";
import { BuilderLinks } from "./builder-links";
import {
  FIELD_TYPE_LABELS,
  SECTION_LABELS,
  createBlankSpec,
  createField,
  createSection,
  diffSpecs,
  hasFieldList,
  insertField,
  insertSection,
  isBlankSpec,
  keysForScope,
  sectionFieldList,
  selectionFromIssuePath,
  type SectionKind,
  type SpecSelection,
} from "./spec-editing";
import { useTemplateAssistant } from "./use-template-assistant";

type View = "design" | "links" | "preview" | "json";

const PALETTE: Array<{ type: SpecFieldType; icon: React.ComponentType<{ className?: string }> }> = [
  { type: "text", icon: Type },
  { type: "number", icon: Hash },
  { type: "money", icon: Sigma },
  { type: "date", icon: CalendarDays },
  { type: "select", icon: List },
  { type: "reference", icon: Link2 },
  { type: "formula", icon: Calculator },
  { type: "textarea", icon: Text },
];

const BLOCKS: Array<{ kind: SectionKind; icon: React.ComponentType<{ className?: string }> }> = [
  { kind: "fields", icon: Rows3 },
  { kind: "table", icon: Table2 },
  { kind: "totals", icon: Sigma },
  { kind: "text", icon: FileText },
  { kind: "signatures", icon: PenLine },
];

async function readJson<T>(response: Response): Promise<T & { error?: string }> {
  return (await response.json().catch(() => ({}))) as T & { error?: string };
}

function collectKeys(spec: TemplateSpec | null) {
  const keys = new Set<string>();
  spec?.sections.forEach((section) => sectionFieldList(section).forEach((field) => keys.add(field.key)));
  return keys;
}

export function TemplateBuilderClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedTemplateId = searchParams.get("templateId");
  const isNew = searchParams.get("new") === "1";

  const [templates, setTemplates] = useState<DocumentTemplateSummary[]>([]);
  const [sources, setSources] = useState<ReferenceSourceDescriptor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [spec, setSpec] = useState<TemplateSpec | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [derived, setDerived] = useState(false);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<SpecSelection>(null);
  const [view, setView] = useState<View>("design");
  const [jsonDraft, setJsonDraft] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [serverIssues, setServerIssues] = useState<Array<{ path: string; message: string }>>([]);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [canvasChange, setCanvasChange] = useState<CanvasChange | null>(null);

  const applyAssistantSpec = (next: TemplateSpec) => {
    const diff = diffSpecs(spec, next);
    setCanvasChange((previous) => ({
      added: new Map(diff.added.map((id, order) => [id, order])),
      changed: diff.changed,
      revision: (previous?.revision ?? 0) + 1,
    }));
    setSpec(next);
    setServerIssues([]);
    setSelection(null);
    setView("design");
  };
  const assistant = useTemplateAssistant(spec, applyAssistantSpec);

  // Esc leaves the assistant, unless a request is still running.
  useEffect(() => {
    if (!assistantOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !assistant.pending) {
        setAssistantOpen(false);
        setCanvasChange(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [assistant.pending, assistantOpen]);


  useEffect(() => {
    let cancelled = false;
    Promise.all([fetch("/api/document-generation/templates"), fetch("/api/document-generation/sources")])
      .then(async ([templatesResponse, sourcesResponse]) => {
        const templatesPayload = await readJson<{ templates?: DocumentTemplateSummary[] }>(templatesResponse);
        const sourcesPayload = await readJson<{ sources?: ReferenceSourceDescriptor[] }>(sourcesResponse);
        if (!templatesResponse.ok) throw new Error(templatesPayload.error ?? "No se pudieron cargar las plantillas.");
        if (!sourcesResponse.ok) throw new Error(sourcesPayload.error ?? "No se pudieron cargar los datos de la app.");
        if (cancelled) return;
        setTemplates(templatesPayload.templates ?? []);
        setSources(sourcesPayload.sources ?? []);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "No se pudo cargar el editor.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Open the template named in the URL once the catalog is loaded.
  const routeKey = requestedTemplateId ?? (isNew ? "new" : null);
  if (!loading && routeKey !== loadedFor) {
    setLoadedFor(routeKey);
    setSelection(null);
    setCanvasChange(null);
    assistant.reset();
    setServerIssues([]);
    setView("design");
    const template = requestedTemplateId ? templates.find((entry) => entry.id === requestedTemplateId) : undefined;
    if (template) {
      const read = readTemplateSpec(template);
      setSpec(read.spec);
      setDerived(read.derived);
      setSavedKeys(read.derived ? new Set() : collectKeys(read.spec));
    } else if (isNew) {
      setSpec(createBlankSpec());
      setDerived(false);
      setSavedKeys(new Set());
    } else {
      setSpec(null);
    }
  }

  const selectedTemplate = requestedTemplateId ? templates.find((entry) => entry.id === requestedTemplateId) ?? null : null;

  const validation = useMemo(() => (spec ? validateTemplateSpec(spec, sources) : null), [sources, spec]);
  const compiled = useMemo(() => {
    if (!spec) return null;
    try {
      return compileTemplateSpec(spec);
    } catch {
      return null;
    }
  }, [spec]);
  const sample = useMemo(() => {
    if (!spec || !compiled) return {};
    try {
      return applyTemplateFormulaInputData(compiled.schema, buildSpecSampleInput(spec));
    } catch {
      return {};
    }
  }, [compiled, spec]);
  const issues = useMemo(() => [...(validation?.errors ?? []), ...serverIssues], [serverIssues, validation]);
  const issueKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const issue of issues) {
      const target = selectionFromIssuePath(issue.path);
      if (target) keys.add(target.field == null ? String(target.section) : `${target.section}.${target.field}`);
    }
    return keys;
  }, [issues]);

  const navigate = (params: Record<string, string>) => {
    const query = new URLSearchParams(params).toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const editSpec = useCallback((next: TemplateSpec) => {
    setSpec(next);
    setServerIssues([]);
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-content-secondary">Cargando editor…</div>;
  }
  if (loadError) {
    return <div className="m-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{loadError}</div>;
  }

  if (!spec) {
    return <TemplateLibrary templates={templates} onOpen={(id) => navigate({ templateId: id })} onCreate={() => navigate({ new: "1" })} />;
  }

  const addField = (type: SpecFieldType) => {
    let sectionIndex = selection?.section ?? -1;
    let current = spec;
    if (sectionIndex < 0 || !hasFieldList(current.sections[sectionIndex])) {
      sectionIndex = current.sections.findIndex((section) => section.kind === "fields");
    }
    if (sectionIndex < 0) {
      current = insertSection(current, createSection("fields", current), current.sections.length - 1);
      sectionIndex = current.sections.findIndex((section) => section.kind === "fields");
    }
    const section = current.sections[sectionIndex];
    const scope = sectionFieldList(section);
    const referenceKeys = scope.filter((field) => field.type === "reference").map((field) => field.key);
    const field = createField(type, keysForScope(current, sectionIndex), { sources, referenceKeys });
    const at = selection?.section === sectionIndex && selection.field != null ? selection.field + 1 : scope.length;
    editSpec(insertField(current, sectionIndex, at, field));
    setSelection({ section: sectionIndex, field: at });
    setView("design");
  };

  const addSection = (kind: SectionKind) => {
    const next = insertSection(spec, createSection(kind, spec), selection?.section ?? null);
    const index = next.sections.findIndex((section, position) => section !== spec.sections[position]);
    editSpec(next);
    setSelection({ section: index < 0 ? next.sections.length - 1 : index });
    setView("design");
  };

  const addColumn = (sectionIndex: number) => {
    const section = spec.sections[sectionIndex];
    const field = createField("text", keysForScope(spec, sectionIndex), { sources, referenceKeys: [] });
    const at = sectionFieldList(section).length;
    editSpec(insertField(spec, sectionIndex, at, { ...field, label: "Columna", key: field.key.replace(/^texto/, "columna") }));
    setSelection({ section: sectionIndex, field: at });
  };

  const openJson = () => {
    setJsonDraft(JSON.stringify(spec, null, 2));
    setJsonError(null);
    setView("json");
  };

  const applyJson = () => {
    try {
      const parsed = JSON.parse(jsonDraft) as TemplateSpec;
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.sections)) throw new Error("Falta la lista sections.");
      editSpec(parsed);
      setSelection(null);
      setJsonError(null);
      toast.success("Especificación aplicada.");
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : "El JSON no es válido.");
    }
  };

  const copyGuide = async () => {
    try {
      const response = await fetch("/api/document-generation/spec");
      const guide = await readJson<Record<string, unknown>>(response);
      if (!response.ok) throw new Error(guide.error ?? "No se pudo cargar la guía.");
      await navigator.clipboard.writeText(
        [
          "Generá una plantilla de documento para Síntesis.",
          "Respondé solo con el JSON de la especificación (Template Spec v1), siguiendo esta guía:",
          JSON.stringify(guide, null, 2),
        ].join("\n\n"),
      );
      toast.success("Guía copiada. Pegá la respuesta del asistente en la pestaña JSON.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo copiar la guía.");
    }
  };

  const save = async (status: "active" | "draft") => {
    if (validation && !validation.ok) {
      toast.error("Corregí los problemas antes de publicar.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/document-generation/templates", {
        method: selectedTemplate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedTemplate
          ? { templateId: selectedTemplate.id, spec, status, publishVersion: status === "active" }
          : { spec, status }),
      });
      const payload = await readJson<{
        template?: DocumentTemplateSummary | null;
        templates?: DocumentTemplateSummary[];
        errors?: Array<{ path: string; message: string }>;
      }>(response);
      if (!response.ok) {
        if (payload.errors?.length) setServerIssues(payload.errors);
        throw new Error(payload.error ?? "No se pudo publicar la plantilla.");
      }
      if (payload.templates) setTemplates(payload.templates);
      toast.success(status === "draft" ? "Plantilla guardada como borrador." : `Publicaste ${spec.name}${payload.template ? ` v${payload.template.version}` : ""}.`);
      if (payload.template) {
        setLoadedFor(payload.template.id);
        setDerived(false);
        setSavedKeys(collectKeys(spec));
        navigate({ templateId: payload.template.id });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo publicar la plantilla.");
    } finally {
      setSaving(false);
    }
  };

  const blank = isBlankSpec(spec);
  const toggleAssistant = () => {
    setAssistantOpen((open) => !open);
    setCanvasChange(null);
    setSelection(null);
    setView("design");
  };

  const previewHtml = compiled ? renderDocumentHtml(compiled.contentHtml, sample, { workName: "Obra de ejemplo", templateName: spec.name }) : "";

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col bg-canvas">
      <div className="flex flex-wrap items-center gap-2 border-b border-stroke-soft bg-surface px-4 py-2.5">
        <Button type="button" size="sm" variant="ghost" onClick={() => navigate({})}>
          Plantillas
        </Button>
        <span className="text-content-muted">/</span>
        <span className="min-w-0 max-w-[16rem] truncate text-sm font-semibold text-content">{spec.name || "Sin título"}</span>
        <Badge variant={selectedTemplate?.status === "active" ? "neutral" : "warning"}>{selectedTemplate?.status === "draft" ? "Borrador" : selectedTemplate ? `v${selectedTemplate.version}` : "Sin publicar"}</Badge>
        {assistantOpen ? null : (
          <Tabs value={view} onValueChange={(value) => (value === "json" ? openJson() : setView(value as View))} className="ml-1">
            <TabsList>
              <TabsTrigger value="design">Diseño</TabsTrigger>
              <TabsTrigger value="links">Vínculos</TabsTrigger>
              <TabsTrigger value="preview">Vista previa</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant={assistantOpen ? "default" : "outline"} onClick={toggleAssistant} disabled={Boolean(assistant.pending)}>
            <Sparkles className="size-4" />
            {assistantOpen ? "Volver al editor" : "Asistente"}
          </Button>
          {assistantOpen ? null : (
            <Button type="button" size="sm" variant="outline" onClick={copyGuide}>
              <ClipboardCopy className="size-4" />
              Copiar guía para IA
            </Button>
          )}
          {selectedTemplate?.status !== "active" ? (
            <Button type="button" size="sm" variant="outline" onClick={() => void save("draft")} disabled={saving}>Guardar borrador</Button>
          ) : null}
          <Button type="button" size="sm" onClick={() => void save("active")} disabled={saving}>
            {saving ? "Publicando…" : "Publicar"}
          </Button>
        </div>
      </div>

      {derived ? (
        <div className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-xs text-content">
          Esta plantilla tiene un diseño HTML propio. Al publicar desde el editor, se reemplaza por el diseño generado.
        </div>
      ) : null}
      {issues.length && !assistantOpen ? (
        <details className="border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-xs text-content">
          <summary className="flex cursor-pointer items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="size-3.5" />
            {issues.length} {issues.length === 1 ? "problema" : "problemas"} para publicar
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {issues.map((issue, index) => (
              <li key={`${issue.path}-${index}`}>
                <button
                  type="button"
                  className="text-left hover:text-orange-primary"
                  onClick={() => {
                    setSelection(selectionFromIssuePath(issue.path));
                    setView("design");
                  }}
                >
                  <span className="font-mono text-content-muted">{issue.path || "plantilla"}</span> · {issue.message}
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div
        className={cn(
          "grid flex-1 grid-cols-1 transition-[grid-template-columns] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:grid-cols-[240px_minmax(0,1fr)_330px]",
          assistantOpen && "lg:grid-cols-[0px_minmax(0,1fr)_0px]",
        )}
      >
        <aside
          inert={assistantOpen}
          className={cn(
            "overflow-hidden border-b border-stroke-soft bg-canvas-muted p-3 transition-[opacity,translate] duration-300 lg:border-b-0 lg:border-r",
            assistantOpen && "pointer-events-none opacity-0 max-lg:hidden lg:-translate-x-6",
          )}
        >
          <div className="min-w-[214px]">
          <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-content-muted">Agregar campo</div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {PALETTE.map(({ type, icon: Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => addField(type)}
                className="flex items-center gap-2 rounded-lg border border-stroke-soft bg-surface px-2 py-1.5 text-left text-xs text-content hover:border-orange-primary/40 hover:bg-accent-soft"
              >
                <Icon className="size-3.5 shrink-0 text-content-secondary" />
                {FIELD_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
          <div className="mt-4 px-1 text-[11px] font-semibold uppercase tracking-wide text-content-muted">Agregar bloque</div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {BLOCKS.map(({ kind, icon: Icon }) => (
              <button
                key={kind}
                type="button"
                onClick={() => addSection(kind)}
                className="flex items-center gap-2 rounded-lg border border-stroke-soft bg-surface px-2 py-1.5 text-left text-xs text-content hover:border-orange-primary/40 hover:bg-accent-soft"
              >
                <Icon className="size-3.5 shrink-0 text-content-secondary" />
                {SECTION_LABELS[kind]}
              </button>
            ))}
            {!spec.sections.some((section) => section.kind === "header") ? (
              <button type="button" onClick={() => addSection("header")} className="flex items-center gap-2 rounded-lg border border-stroke-soft bg-surface px-2 py-1.5 text-left text-xs text-content hover:bg-accent-soft">
                <Plus className="size-3.5" />
                Encabezado
              </button>
            ) : null}
          </div>
          <div className="mt-4 px-1 text-[11px] font-semibold uppercase tracking-wide text-content-muted">Estructura</div>
          <nav className="mt-1 flex flex-col">
            {spec.sections.map((section, sectionIndex) => (
              <div key={sectionIndex}>
                <button
                  type="button"
                  onClick={() => setSelection({ section: sectionIndex })}
                  className={cn(
                    "w-full truncate rounded-md px-2 py-1 text-left text-xs font-semibold text-content hover:bg-surface",
                    selection?.section === sectionIndex && selection.field == null && "bg-accent-soft text-orange-primary",
                  )}
                >
                  {section.kind === "table" ? section.title : section.kind === "signatures" ? "Firmas" : section.title || SECTION_LABELS[section.kind]}
                </button>
                {sectionFieldList(section).map((field, fieldIndex) => (
                  <button
                    key={fieldIndex}
                    type="button"
                    onClick={() => setSelection({ section: sectionIndex, field: fieldIndex })}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md py-1 pl-5 pr-2 text-left text-xs text-content-secondary hover:bg-surface",
                      selection?.section === sectionIndex && selection.field === fieldIndex && "bg-accent-soft text-orange-primary",
                      issueKeys.has(`${sectionIndex}.${fieldIndex}`) && "text-destructive",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{field.label}</span>
                    <span className="text-[10px] text-content-muted">{FIELD_TYPE_LABELS[field.type]}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
          </div>
        </aside>

        <main
          className={cn("min-w-0 p-4 sm:p-6", assistantOpen && "overflow-x-clip pb-80 sm:pb-80")}
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelection(null);
          }}
        >
          {assistantOpen ? (
            <AnimatePresence mode="wait" initial={false}>
              {blank && assistant.pending?.attachment ? (
                <AssistantReading key="reading" attachment={assistant.pending.attachment} />
              ) : blank ? (
                <AssistantDropzone key="drop" onFile={(file) => void assistant.send("", file)} />
              ) : (
                <DocumentPreview key="document" spec={spec} change={canvasChange} />
              )}
            </AnimatePresence>
          ) : view === "design" ? (
            <BuilderCanvas spec={spec} selection={selection} sources={sources} issueKeys={issueKeys} onSelect={setSelection} onAddColumn={addColumn} />
          ) : null}
          {view === "links" ? (
            <BuilderLinks
              spec={spec}
              sources={sources}
              templates={templates}
              onChange={editSpec}
              onSelect={(next) => {
                setSelection(next);
                setView("design");
              }}
            />
          ) : null}
          {view === "preview" ? (
            <iframe
              title="Vista previa del documento"
              sandbox=""
              srcDoc={previewHtml}
              className="mx-auto block h-[1000px] w-full max-w-[820px] rounded-sm border border-stroke-soft bg-white shadow-lg"
            />
          ) : null}
          {view === "json" ? (
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
              <Textarea
                aria-label="Especificación JSON"
                spellCheck={false}
                rows={28}
                className="font-mono text-xs"
                value={jsonDraft}
                onChange={(event) => setJsonDraft(event.target.value)}
              />
              {jsonError ? <p className="text-xs text-destructive">{jsonError}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={applyJson}>Aplicar JSON</Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(JSON.stringify(spec, null, 2));
                    toast.success("Especificación copiada.");
                  }}
                >
                  Copiar
                </Button>
              </div>
            </div>
          ) : null}
        </main>

        <aside
          inert={assistantOpen}
          className={cn(
            "overflow-hidden border-t border-stroke-soft bg-surface p-4 transition-[opacity,translate] duration-300 lg:border-l lg:border-t-0",
            assistantOpen && "pointer-events-none opacity-0 max-lg:hidden lg:translate-x-6",
          )}
        >
          <div className="min-w-[296px]">
          <BuilderInspector
            spec={spec}
            selection={selection}
            sources={sources}
            sample={sample}
            savedKeys={savedKeys}
            onChange={editSpec}
            onSelect={setSelection}
            onOpenLinks={() => setView("links")}
          />
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {assistantOpen ? (
          <AssistantDock
            key="assistant"
            messages={assistant.messages}
            pending={assistant.pending}
            suggestions={assistantSuggestions(spec, blank)}
            lastUndoableId={assistant.lastUndoableId}
            onSend={(text, file) => void assistant.send(text, file)}
            onUndo={assistant.undo}
          />
        ) : null}
      </AnimatePresence>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-0 z-30 h-64 bg-gradient-to-t from-canvas via-canvas/70 to-transparent opacity-0 transition-opacity duration-500",
          assistantOpen && "opacity-100",
        )}
      />
    </div>
  );
}

function TemplateLibrary({
  templates,
  onOpen,
  onCreate,
}: {
  templates: DocumentTemplateSummary[];
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const latest = new Map<string, DocumentTemplateSummary>();
  for (const template of templates) {
    const current = latest.get(template.key);
    if (!current || template.version > current.version) latest.set(template.key, template);
  }
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-content">Plantillas de documentos</h1>
        <Button type="button" className="ml-auto" onClick={onCreate}>
          <Plus className="size-4" />
          Nueva plantilla
        </Button>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...latest.values()].map((template) => {
          const linked = template.schema.fields.some((field) => field.type === "reference");
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onOpen(template.id)}
              className="flex flex-col gap-2 rounded-2xl border border-stroke-soft bg-surface p-4 text-left shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start gap-2">
                <span className="min-w-0 flex-1 font-semibold text-content">{template.name}</span>
                <Badge variant={template.status === "active" ? "success" : "neutral"}>{template.status === "active" ? "Activa" : template.status}</Badge>
              </div>
              <div className="flex flex-wrap gap-x-3 text-xs text-content-secondary">
                <span>{formatDocumentTypeLabel(template.documentType)}</span>
                <span>v{template.version}</span>
                <span>{template.schema.fields.length} campos</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {template.schema.spec ? <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] text-orange-primary">Editor visual</span> : null}
                {linked ? <span className="rounded-md bg-info/10 px-1.5 py-0.5 text-[11px] text-info">Con vínculos</span> : null}
              </div>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onCreate}
          className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-stroke-strong text-sm text-content-secondary hover:border-orange-primary hover:bg-accent-soft hover:text-orange-primary"
        >
          <Plus className="size-5" />
          Nueva plantilla
        </button>
      </div>
    </div>
  );
}
