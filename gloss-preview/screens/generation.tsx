import { useRef, useState } from "react";
import {
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type {
  PreviewDataset,
  PreviewDraft,
  PreviewDraftRow,
  PreviewScreenProps,
} from "../contracts";
import { EmptyState, PageHeading } from "../shared";
import { DocumentComposer } from "./generation-composer";
import { ReadinessRail, MobileReviewBar } from "./generation-rail";
import { ReviewSheet } from "./generation-review";
import {
  cloneDraft,
  createDraft,
  getDraftIssues,
  getDraftTotals,
  resolveDraft,
  type ChangeDraftField,
  type GenerationSection,
} from "./generation-model";
import type { GenerationSectionStatus } from "./generation-review-contract";
import styles from "./generation.module.css";

export interface GenerationPreviewProps extends PreviewScreenProps {
  obraId?: string;
  draftId?: string;
}
const SECTIONS: Array<{ id: GenerationSection; label: string }> = [
  { id: "context", label: "Destino y plantilla" },
  { id: "header", label: "Encabezado" },
  { id: "supplier", label: "Proveedor" },
  { id: "items", label: "Materiales" },
  { id: "conditions", label: "Condiciones" },
];

function ContextSummary({
  draft,
  data,
  open,
  onToggle,
  onObraChange,
  onFolderChange,
  onTemplateChange,
  errors,
}: {
  draft: PreviewDraft;
  data: PreviewDataset;
  open: boolean;
  onToggle: () => void;
  onObraChange: (id: string) => void;
  onFolderChange: (path: string) => void;
  onTemplateChange: (id: string) => void;
  errors: Record<string, string>;
}) {
  const obra = data.obras.find((o) => o.id === draft.obraId);
  const folder = data.folders.find((f) => f.path === draft.folderPath);
  const template = data.templates.find((t) => t.id === draft.templateId);
  return (
    <section className={styles.context} aria-label="Destino y plantilla">
      <div className={styles.contextSummary}>
        <div className={styles.contextPath}>
          <Building2 aria-hidden="true" />
          <strong>{obra?.name || "Elegí una obra"}</strong>
          <ChevronRight aria-hidden="true" />
          <Folder aria-hidden="true" />
          <span>{folder?.name || "Elegí una carpeta"}</span>
        </div>
        <Button
          id="gen-context-toggle"
          variant="ghost"
          size="sm"
          aria-expanded={open}
          aria-controls="gen-context-fields"
          onClick={onToggle}
        >
          {open ? "Listo" : "Cambiar"}
          <ChevronDown className={styles.disclosureIcon} data-open={open} />
        </Button>
      </div>
      {!open && (
        <p className={styles.contextCaption}>
          {template?.name} <span aria-hidden="true">·</span> {draft.code}
        </p>
      )}
      <div
        className={styles.contextFields}
        id="gen-context-fields"
        hidden={!open}
      >
        <div className={styles.contextSelects}>
          <div>
            <Label htmlFor="gen-context-obra">Obra</Label>
            <NativeSelect
              id="gen-context-obra"
              value={draft.obraId}
              onChange={(e) => onObraChange(e.target.value)}
              data-generation-key="obraId"
              aria-invalid={Boolean(errors.obraId)}
              aria-describedby={
                errors.obraId ? "gen-context-obra-error" : undefined
              }
            >
              {data.obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.number} · {o.name}
                </option>
              ))}
            </NativeSelect>
            {errors.obraId && (
              <p className={styles.fieldError} id="gen-context-obra-error">
                {errors.obraId}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="gen-context-folder">Carpeta destino</Label>
            <NativeSelect
              id="gen-context-folder"
              value={draft.folderPath}
              onChange={(e) => onFolderChange(e.target.value)}
              data-generation-key="folderPath"
              aria-invalid={Boolean(errors.folderPath)}
              aria-describedby={
                errors.folderPath ? "gen-context-folder-error" : undefined
              }
            >
              {data.folders.map((f) => (
                <option key={f.path} value={f.path}>
                  {f.name}
                </option>
              ))}
            </NativeSelect>
            {errors.folderPath && (
              <p className={styles.fieldError} id="gen-context-folder-error">
                {errors.folderPath}
              </p>
            )}
          </div>
        </div>
        <div>
          <p className={styles.templateLabel} id="gen-template-label">
            Plantilla
          </p>
          <RadioGroup
            value={draft.templateId}
            onValueChange={onTemplateChange}
            className={styles.templates}
            aria-labelledby="gen-template-label"
            data-generation-key="templateId"
            tabIndex={-1}
            aria-invalid={Boolean(errors.templateId)}
            aria-describedby={
              errors.templateId ? "gen-template-error" : undefined
            }
          >
            {data.templates.map((t) => (
              <label
                key={t.id}
                className={styles.template}
                data-selected={draft.templateId === t.id}
              >
                <span className={styles.templateIcon}>
                  <FileText aria-hidden="true" />
                </span>
                <span>
                  <small>{t.type}</small>
                  <strong>{t.name}</strong>
                  <span>{t.description}</span>
                </span>
                <RadioGroupItem
                  id={`gen-template-${t.id}`}
                  value={t.id}
                  aria-label={t.name}
                />
              </label>
            ))}
          </RadioGroup>
          {errors.templateId && (
            <p id="gen-template-error" className={styles.fieldError}>
              {errors.templateId}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function GenerationEditor({
  initialDraft,
  data,
  actions,
}: PreviewScreenProps & { initialDraft: PreviewDraft }) {
  const [draft, setDraft] = useState(() => cloneDraft(initialDraft));
  const [contextOpen, setContextOpen] = useState(
    () => !data.drafts.some((d) => d.id === initialDraft.id),
  );
  const [saveState, setSaveState] = useState<"saved" | "dirty">(() =>
    data.drafts.some((d) => d.id === initialDraft.id) ? "saved" : "dirty",
  );
  const [validationScope, setValidationScope] = useState<
    GenerationSection | "all" | "none"
  >("none");
  const [sheet, setSheet] = useState<"closed" | "review" | "generated">(
    "closed",
  );
  const [generatedId, setGeneratedId] = useState<string | null>(null);
  const [removedRow, setRemovedRow] = useState<{
    row: PreviewDraftRow;
    index: number;
  } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const screenRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const issues = getDraftIssues(draft, data);
  const errors = Object.fromEntries(
    issues
      .filter(
        (issue) =>
          validationScope === "all" || validationScope === issue.section,
      )
      .map((issue) => [issue.key, issue.message]),
  );
  const sections: GenerationSectionStatus[] = SECTIONS.map((section) => {
    const pending = issues.filter((issue) => issue.section === section.id);
    return { ...section, pending: pending.length, firstKey: pending[0]?.key };
  });
  const totals = getDraftTotals(draft);
  const obra = data.obras.find((o) => o.id === draft.obraId);
  const template = data.templates.find((t) => t.id === draft.templateId);
  const folder = data.folders.find((f) => f.path === draft.folderPath);
  const generatedDocument = data.documents.find((d) => d.id === generatedId);

  const focusKey = (key: string) => {
    if (["obraId", "folderPath", "templateId"].includes(key))
      setContextOpen(true);
    requestAnimationFrame(() => {
      const target = screenRef.current?.querySelector<HTMLElement>(
        `[data-generation-key="${CSS.escape(key)}"]`,
      );
      if (target) {
        returnFocusRef.current = target;
        target.focus({ preventScroll: true });
        target.scrollIntoView({
          block: "center",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
        });
      }
    });
  };
  const changeField: ChangeDraftField = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaveState("dirty");
  };
  const changeObra = (id: string) => {
    if (id === draft.obraId) return;
    if (saveState === "dirty") actions.onSaveDraft(cloneDraft(draft));
    const next =
      resolveDraft(data, id) ?? createDraft(data, id, draft.templateId);
    setDraft(cloneDraft(next));
    setSaveState(data.drafts.some((d) => d.id === next.id) ? "saved" : "dirty");
    setValidationScope("none");
    setGeneratedId(null);
    setRemovedRow(null);
    setAnnouncement(
      `Se cargó ${data.obras.find((o) => o.id === id)?.name || "la obra"}.${saveState === "dirty" ? " El borrador anterior quedó guardado." : ""}`,
    );
  };
  const newDraft = () => {
    if (saveState === "dirty") actions.onSaveDraft(cloneDraft(draft));
    const dataIncludingCurrentDraft = {
      ...data,
      drafts: [...data.drafts.filter((saved) => saved.id !== draft.id), cloneDraft(draft)],
    };
    setDraft(createDraft(dataIncludingCurrentDraft, draft.obraId, draft.templateId));
    setSaveState("dirty");
    setValidationScope("none");
    setContextOpen(true);
    setGeneratedId(null);
    setRemovedRow(null);
    requestAnimationFrame(() =>
      document.getElementById("gen-context-obra")?.focus(),
    );
  };
  const addRow = () => {
    const id = crypto.randomUUID();
    setDraft((current) => ({
      ...current,
      rows: [
        ...current.rows,
        { id, description: "", quantity: 1, unit: "un", price: 0 },
      ],
    }));
    setSaveState("dirty");
    setRemovedRow(null);
    return id;
  };
  const changeRow = (id: string, patch: Partial<PreviewDraftRow>) => {
    setDraft((current) => ({
      ...current,
      rows: current.rows.map((row) =>
        row.id === id ? { ...row, ...patch } : row,
      ),
    }));
    setSaveState("dirty");
    setRemovedRow(null);
  };
  const duplicateRow = (id: string) => {
    const index = draft.rows.findIndex((row) => row.id === id);
    if (index < 0) return;
    const rows = [...draft.rows];
    rows.splice(index + 1, 0, { ...rows[index], id: crypto.randomUUID() });
    setDraft({ ...draft, rows });
    setSaveState("dirty");
    setRemovedRow(null);
  };
  const removeRow = (id: string) => {
    const index = draft.rows.findIndex((row) => row.id === id);
    if (index < 0) return;
    setRemovedRow({ row: { ...draft.rows[index] }, index });
    setDraft({ ...draft, rows: draft.rows.filter((row) => row.id !== id) });
    setSaveState("dirty");
  };
  const undoRemove = () => {
    if (!removedRow) return;
    const rows = [...draft.rows];
    rows.splice(removedRow.index, 0, removedRow.row);
    setDraft({ ...draft, rows });
    setSaveState("dirty");
    setRemovedRow(null);
  };
  const save = () => {
    actions.onSaveDraft(cloneDraft(draft));
    setSaveState("saved");
    setAnnouncement("Borrador guardado en esta sesión.");
  };
  const review = () => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setSheet("review");
  };
  const fixPending = (key?: string) => {
    setValidationScope("all");
    setSheet("closed");
    const target = key ?? issues[0]?.key;
    if (target) focusKey(target);
  };
  const focusSection = (section: GenerationSection) => {
    setValidationScope(section);
    const first = issues.find((issue) => issue.section === section)?.key;
    if (first) {
      focusKey(first);
      return;
    }
    if (section === "context") {
      setContextOpen(true);
      requestAnimationFrame(() =>
        document.getElementById("gen-context-obra")?.focus(),
      );
      return;
    }
    document.getElementById(`gen-${section}`)?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  const generate = () => {
    const freshIssues = getDraftIssues(draft, data);
    if (freshIssues.length) {
      fixPending(freshIssues[0].key);
      return;
    }
    const created = actions.onGenerateDocument(cloneDraft(draft));
    setGeneratedId(created.id);
    setSaveState("saved");
    setSheet("generated");
  };
  const openGenerated = () => {
    if (!generatedDocument) return;
    actions.onNavigate({
      view: "documents",
      obraId: generatedDocument.obraId,
      folderPath: generatedDocument.folderPath,
      documentId: generatedDocument.id,
      mode: "files",
    });
  };

  return (
    <div className={styles.screen} ref={screenRef}>
      <PageHeading
        eyebrow="Documentos de obra · Borrador"
        title={template?.type || "Nuevo documento"}
        actions={
          <Button variant="outline" onClick={newDraft}>
            <Plus />
            Nuevo documento
          </Button>
        }
      />
      <ContextSummary
        draft={draft}
        data={data}
        open={contextOpen}
        onToggle={() => setContextOpen((value) => !value)}
        onObraChange={changeObra}
        onFolderChange={(path) => changeField("folderPath", path)}
        onTemplateChange={(id) => changeField("templateId", id)}
        errors={errors}
      />
      <div className={styles.workbench}>
        <DocumentComposer
          draft={draft}
          errors={errors}
          onFieldChange={changeField}
          onRowChange={changeRow}
          onAddRow={addRow}
          onDuplicateRow={duplicateRow}
          onRemoveRow={removeRow}
          removedRow={removedRow}
          onUndoRemove={undoRemove}
        />
        <ReadinessRail
          sections={sections}
          attempted={validationScope !== "none"}
          errorCount={issues.length}
          totals={totals}
          discount={draft.discount}
          destination={{
            obraName: obra?.name || "Sin obra",
            folderName: folder?.name || "Sin carpeta",
            fileName: `${draft.code || "Documento"}.html`,
          }}
          saveState={saveState}
          lastGenerated={generatedDocument}
          onReview={review}
          onSave={save}
          onFocusSection={focusSection}
          onFocusFirstError={() => {
            setValidationScope("all");
            if (issues[0]) focusKey(issues[0].key);
          }}
          onOpenGenerated={openGenerated}
        />
      </div>
      <p className={styles.sessionNote}>
        <Check aria-hidden="true" />
        Vista de comparación con datos de ejemplo. Los borradores se conservan
        durante esta sesión.
      </p>
      <div className={styles.announcement} role="status" aria-live="polite">
        {announcement}
      </div>
      <MobileReviewBar
        total={totals.total}
        pending={issues.length}
        onReview={review}
        onSave={save}
      />
      <ReviewSheet
        open={sheet !== "closed"}
        onOpenChange={(open) => setSheet(open ? "review" : "closed")}
        stage={sheet === "generated" ? "generated" : "review"}
        draft={draft}
        obraName={obra?.name || "Sin obra"}
        templateName={template?.name || "Sin plantilla"}
        folderName={folder?.name || "Sin carpeta"}
        issues={issues}
        generatedDocument={generatedDocument}
        onGenerate={generate}
        onFixPending={fixPending}
        onOpenDocument={openGenerated}
        returnFocusRef={returnFocusRef}
      />
    </div>
  );
}

export function GenerationPreview({
  data,
  actions,
  obraId,
  draftId,
}: GenerationPreviewProps) {
  const firstObra = data.obras.find((o) => o.id === obraId) ?? data.obras[0];
  const firstTemplate = data.templates[0];
  if (!firstObra || !firstTemplate || !data.folders.length)
    return (
      <EmptyState
        title="Falta configuración de ejemplo"
        description="Se necesita una obra, una carpeta y una plantilla."
      />
    );
  const initialDraft =
    resolveDraft(data, obraId, draftId) ??
    createDraft(data, firstObra.id, firstTemplate.id);
  return (
    <GenerationEditor
      key={`${obraId ?? "latest"}:${draftId ?? "default"}`}
      initialDraft={initialDraft}
      data={data}
      actions={actions}
    />
  );
}
