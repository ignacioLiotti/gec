"use client";

import { ArrowDown, ArrowUp, Copy, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { analyzeDocumentFormula, DOCUMENT_FORMULA_FUNCTIONS } from "@/lib/document-formula";
import {
  SPEC_FIELD_TYPES,
  type ReferenceSourceDescriptor,
  type SpecAuto,
  type SpecField,
  type SpecSection,
  type TemplateSpec,
} from "@/lib/document-template-spec";

import {
  FIELD_TYPE_LABELS,
  SECTION_LABELS,
  documentKeys,
  insertField,
  keysForScope,
  moveField,
  moveSection,
  removeField,
  renameFieldKey,
  sectionFieldList,
  slugifyKey,
  uniqueKey,
  updateField,
  type SpecSelection,
} from "./spec-editing";

type InspectorProps = {
  spec: TemplateSpec;
  selection: SpecSelection;
  sources: ReferenceSourceDescriptor[];
  sample: Record<string, unknown>;
  /** Keys of the published version; their keys do not follow label edits. */
  savedKeys: Set<string>;
  onChange: (spec: TemplateSpec) => void;
  onSelect: (selection: SpecSelection) => void;
  onOpenLinks: () => void;
};

function Row({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-content-secondary">
        {label}
      </Label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <label className="mt-4 flex items-center justify-between gap-3 text-sm text-content">
      <span>{label}</span>
      <Switch size="sm" checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}

function SourceOptions({ sources }: { sources: ReferenceSourceDescriptor[] }) {
  const groups: Array<[string, ReferenceSourceDescriptor["group"]]> = [
    ["App", "app"],
    ["Tablas de obra", "tabla"],
    ["Documentos", "documento"],
  ];
  return (
    <>
      {groups.map(([label, group]) => {
        const entries = sources.filter((source) => source.group === group);
        return entries.length ? (
          <optgroup key={group} label={label}>
            {entries.map((source) => (
              <option key={source.key} value={source.key}>
                {source.label}
              </option>
            ))}
          </optgroup>
        ) : null;
      })}
    </>
  );
}

function formatSampleValue(value: unknown, field: SpecField) {
  if (typeof value !== "number") return null;
  return field.format === "number"
    ? value.toLocaleString("es-AR", { maximumFractionDigits: 4 })
    : `$ ${value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function BuilderInspector({ spec, selection, sources, sample, savedKeys, onChange, onSelect, onOpenLinks }: InspectorProps) {
  if (!selection) return <TemplateSettings spec={spec} sources={sources} onChange={onChange} />;
  const section = spec.sections[selection.section];
  if (!section) return <TemplateSettings spec={spec} sources={sources} onChange={onChange} />;
  if (selection.field == null) {
    return <SectionSettings spec={spec} sectionIndex={selection.section} section={section} onChange={onChange} onSelect={onSelect} />;
  }
  const field = sectionFieldList(section)[selection.field];
  if (!field) return <SectionSettings spec={spec} sectionIndex={selection.section} section={section} onChange={onChange} onSelect={onSelect} />;
  return (
    <FieldSettings
      spec={spec}
      sectionIndex={selection.section}
      fieldIndex={selection.field}
      section={section}
      field={field}
      sources={sources}
      sample={sample}
      savedKeys={savedKeys}
      onChange={onChange}
      onSelect={onSelect}
      onOpenLinks={onOpenLinks}
    />
  );
}

function TemplateSettings({ spec, sources, onChange }: { spec: TemplateSpec; sources: ReferenceSourceDescriptor[]; onChange: (spec: TemplateSpec) => void }) {
  const set = (patch: Partial<TemplateSpec>) => onChange({ ...spec, ...patch });
  const used = new Set<string>();
  for (const section of spec.sections) {
    for (const field of sectionFieldList(section)) if (field.type === "reference" && field.reference) used.add(field.reference.source);
  }
  return (
    <div>
      <h2 className="text-base font-semibold text-content">Plantilla</h2>
      <Row label="Nombre" htmlFor="spec-name">
        <Input id="spec-name" value={spec.name} onChange={(event) => set({ name: event.target.value })} />
      </Row>
      <Row label="Tipo de documento" htmlFor="spec-type">
        <Input
          id="spec-type"
          className="font-mono"
          value={spec.documentType}
          placeholder="RECEPCION_MATERIALES"
          onChange={(event) => set({ documentType: event.target.value.toUpperCase().replace(/[^A-Z0-9_]+/g, "_") })}
        />
      </Row>
      <Row label="Descripción" htmlFor="spec-description">
        <Textarea id="spec-description" rows={2} value={spec.description ?? ""} onChange={(event) => set({ description: event.target.value })} />
      </Row>
      <Row label="Carpeta de la obra" htmlFor="spec-folder">
        <Input id="spec-folder" value={spec.targetFolderPath ?? ""} placeholder="compras/recepciones" onChange={(event) => set({ targetFolderPath: event.target.value })} />
      </Row>
      <Row label="Prefijo del número" htmlFor="spec-prefix">
        <Input id="spec-prefix" className="font-mono" value={spec.numberPrefix ?? ""} placeholder="REC-" onChange={(event) => set({ numberPrefix: event.target.value })} />
      </Row>
      <Row label="Nombre del archivo" htmlFor="spec-file">
        <Input id="spec-file" className="font-mono" value={spec.fileName ?? ""} placeholder={`${spec.name} {{numero}}`} onChange={(event) => set({ fileName: event.target.value })} />
      </Row>
      <div className="mt-6 border-t border-stroke-soft pt-4">
        <div className="text-xs font-medium text-content-secondary">Datos de la app que usa</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {used.size === 0 ? <span className="text-xs text-content-muted">Ninguno</span> : null}
          {[...used].map((key) => (
            <span key={key} className="rounded-md bg-info/10 px-2 py-1 text-xs text-info">
              {sources.find((source) => source.key === key)?.label ?? key}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionSettings({
  spec,
  sectionIndex,
  section,
  onChange,
  onSelect,
}: {
  spec: TemplateSpec;
  sectionIndex: number;
  section: SpecSection;
  onChange: (spec: TemplateSpec) => void;
  onSelect: (selection: SpecSelection) => void;
}) {
  const setSection = (next: SpecSection) => onChange({ ...spec, sections: spec.sections.map((entry, index) => (index === sectionIndex ? next : entry)) });
  const fields = sectionFieldList(section);
  return (
    <div>
      <h2 className="text-base font-semibold text-content">{SECTION_LABELS[section.kind]}</h2>
      {section.kind !== "signatures" ? (
        <Row label="Título" htmlFor="section-title">
          <Input
            id="section-title"
            value={section.title ?? ""}
            placeholder={section.kind === "header" ? spec.name : ""}
            onChange={(event) => setSection({ ...section, title: event.target.value } as SpecSection)}
          />
        </Row>
      ) : null}
      {section.kind === "header" ? (
        <Row label="Subtítulo" htmlFor="section-subtitle">
          <Input id="section-subtitle" value={section.subtitle ?? ""} placeholder="Razón social, CUIT…" onChange={(event) => setSection({ ...section, subtitle: event.target.value })} />
        </Row>
      ) : null}
      {section.kind === "table" ? (
        <>
          <Row label="Clave de la tabla" htmlFor="section-key">
            <Input
              id="section-key"
              className="font-mono"
              value={section.key}
              onChange={(event) => setSection({ ...section, key: slugifyKey(event.target.value) })}
            />
          </Row>
          <Toggle label="Requiere al menos una fila" checked={Boolean(section.required)} onCheckedChange={(required) => setSection({ ...section, required })} />
        </>
      ) : null}
      {section.kind === "text" ? (
        <Row label="Texto" htmlFor="section-body">
          <Textarea id="section-body" rows={6} value={section.body} onChange={(event) => setSection({ ...section, body: event.target.value })} />
          <span className="text-xs text-content-muted">
            Insertá campos con <code className="font-mono">{"{{clave}}"}</code>.
          </span>
        </Row>
      ) : null}
      {section.kind === "signatures" ? (
        <Row label="Firmas, una por línea" htmlFor="section-signatures">
          <Textarea
            id="section-signatures"
            rows={4}
            value={section.labels.join("\n")}
            onChange={(event) => setSection({ ...section, labels: event.target.value.split("\n") })}
          />
        </Row>
      ) : null}
      {fields.length ? (
        <div className="mt-4 flex flex-col gap-0.5 rounded-lg border border-stroke-soft p-1">
          {fields.map((field, fieldIndex) => (
            <button
              key={fieldIndex}
              type="button"
              onClick={() => onSelect({ section: sectionIndex, field: fieldIndex })}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-content hover:bg-canvas-muted"
            >
              <span className="min-w-0 flex-1 truncate">{field.label}</span>
              <span className="text-[11px] text-content-muted">{FIELD_TYPE_LABELS[field.type]}</span>
            </button>
          ))}
        </div>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-2 border-t border-stroke-soft pt-4">
        <Button type="button" size="sm" variant="outline" aria-label="Subir bloque" onClick={() => { onChange(moveSection(spec, sectionIndex, -1)); onSelect({ section: Math.max(0, sectionIndex - 1) }); }}>
          <ArrowUp className="size-4" />
        </Button>
        <Button type="button" size="sm" variant="outline" aria-label="Bajar bloque" onClick={() => { onChange(moveSection(spec, sectionIndex, 1)); onSelect({ section: Math.min(spec.sections.length - 1, sectionIndex + 1) }); }}>
          <ArrowDown className="size-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="ml-auto"
          onClick={() => {
            onChange({ ...spec, sections: spec.sections.filter((_, index) => index !== sectionIndex) });
            onSelect(null);
          }}
        >
          <Trash2 className="size-4" />
          Quitar bloque
        </Button>
      </div>
    </div>
  );
}

function FieldSettings({
  spec,
  sectionIndex,
  fieldIndex,
  section,
  field,
  sources,
  sample,
  savedKeys,
  onChange,
  onSelect,
  onOpenLinks,
}: {
  spec: TemplateSpec;
  sectionIndex: number;
  fieldIndex: number;
  section: SpecSection;
  field: SpecField;
  sources: ReferenceSourceDescriptor[];
  sample: Record<string, unknown>;
  savedKeys: Set<string>;
  onChange: (spec: TemplateSpec) => void;
  onSelect: (selection: SpecSelection) => void;
  onOpenLinks: () => void;
}) {
  const isColumn = section.kind === "table";
  const scopeFields = sectionFieldList(section);
  const siblingsInScope = isColumn ? scopeFields : spec.sections.filter((entry) => entry.kind !== "table").flatMap(sectionFieldList);
  const referenceFields = siblingsInScope.filter((entry) => entry.type === "reference" && entry.key !== field.key);
  const set = (update: (current: SpecField) => SpecField) => onChange(updateField(spec, sectionIndex, fieldIndex, update));

  const changeType = (type: SpecField["type"]) =>
    set((current) => {
      const next: SpecField = { key: current.key, label: current.label, type, ...(current.required ? { required: true } : {}), ...(current.auto ? { auto: current.auto } : {}) };
      if (type === "select") next.options = current.options ?? ["Opción 1", "Opción 2"];
      if (type === "formula") next.formula = current.formula ?? "";
      if (type === "reference") {
        const source = sources.find((entry) => entry.key === "usuarios") ?? sources[0];
        next.reference = current.reference ?? { source: source?.key ?? "usuarios", display: source?.display ?? "nombre" };
      }
      if (type === "lookup") next.lookup = current.lookup ?? { from: referenceFields[0]?.key ?? "", attribute: "" };
      if (type === "lookup" || type === "formula") delete next.required;
      return next;
    });

  const sourceOf = (key: string | undefined) => sources.find((entry) => entry.key === key);
  const referenceSource = field.type === "reference" ? sourceOf(field.reference?.source) : undefined;
  const lookupOrigin = field.type === "lookup" ? referenceFields.find((entry) => entry.key === field.lookup?.from) : undefined;
  const lookupSource = sourceOf(lookupOrigin?.reference?.source);

  const toggleBroughtAttribute = (attribute: string, label: string, checked: boolean) => {
    const existing = scopeFields.findIndex((entry) => entry.type === "lookup" && entry.lookup?.from === field.key && entry.lookup.attribute === attribute);
    if (!checked) {
      if (existing >= 0) onChange(removeField(spec, sectionIndex, existing));
      return;
    }
    if (existing >= 0) return;
    const taken = keysForScope(spec, sectionIndex);
    onChange(
      insertField(spec, sectionIndex, fieldIndex + 1, {
        key: uniqueKey(`${field.key}_${slugifyKey(attribute)}`, taken),
        label: `${label} de ${field.label.toLowerCase()}`,
        type: "lookup",
        lookup: { from: field.key, attribute },
      }),
    );
  };

  const analysis = field.type === "formula" && field.formula?.trim() ? analyzeDocumentFormula(field.formula) : null;
  const sampleValue = isColumn
    ? (Array.isArray(sample[section.key]) ? (sample[section.key] as Record<string, unknown>[])[0]?.[field.key] : undefined)
    : sample[field.key];
  const tables = spec.sections.filter((entry): entry is Extract<SpecSection, { kind: "table" }> => entry.kind === "table");
  const formulaTokens = isColumn
    ? scopeFields.filter((entry) => entry.key !== field.key && ["number", "money", "formula", "lookup"].includes(entry.type)).map((entry) => `[${entry.key}]`)
    : siblingsInScope.filter((entry) => entry.key !== field.key && ["number", "money", "formula", "lookup"].includes(entry.type)).map((entry) => `[${entry.key}]`);
  const aggregateTokens = isColumn
    ? []
    : tables.flatMap((table) => table.columns.filter((column) => ["number", "money", "formula", "lookup"].includes(column.type)).map((column) => `SUMA(${table.key}.${column.key})`));
  const insertToken = (token: string) => set((current) => ({ ...current, formula: `${current.formula ?? ""}${current.formula?.trim() ? " " : ""}${token}` }));

  return (
    <div>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-content">{field.label || "Sin etiqueta"}</h2>
          <div className="truncate font-mono text-xs text-content-muted">
            {isColumn ? `${section.key}.` : ""}
            {field.key}
          </div>
        </div>
        <span className="rounded-full border border-stroke-soft px-2 py-0.5 text-[11px] text-content-secondary">{isColumn ? "Columna" : "Campo"}</span>
      </div>

      <Row label="Etiqueta" htmlFor="field-label">
        <Input
          id="field-label"
          value={field.label}
          onChange={(event) => {
            const label = event.target.value;
            let next = updateField(spec, sectionIndex, fieldIndex, (current) => ({ ...current, label }));
            // Keys follow the label only for fields added since the last publish.
            const autoKey = !savedKeys.has(field.key) && field.key.startsWith(slugifyKey(field.label));
            if (autoKey && label.trim()) {
              const taken = keysForScope(spec, sectionIndex);
              taken.delete(field.key);
              next = renameFieldKey(next, sectionIndex, fieldIndex, uniqueKey(slugifyKey(label), taken));
            }
            onChange(next);
          }}
        />
      </Row>
      <Row label="Clave" htmlFor="field-key">
        <Input
          id="field-key"
          className="font-mono"
          value={field.key}
          onChange={(event) => {
            const key = slugifyKey(event.target.value);
            const taken = isColumn ? keysForScope(spec, sectionIndex) : documentKeys(spec);
            taken.delete(field.key);
            onChange(renameFieldKey(spec, sectionIndex, fieldIndex, uniqueKey(key, taken)));
          }}
        />
      </Row>

      <div className="mt-4">
        <div className="text-xs font-medium text-content-secondary">Tipo</div>
        <div className="mt-1.5 grid grid-cols-3 gap-1">
          {SPEC_FIELD_TYPES.filter((type) => type !== "lookup" || referenceFields.length > 0 || field.type === "lookup").map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={field.type === type}
              onClick={() => changeType(type)}
              className={
                field.type === type
                  ? "rounded-md border border-orange-primary bg-accent-soft px-1 py-1.5 text-[11px] text-orange-primary"
                  : "rounded-md border border-stroke-soft bg-surface px-1 py-1.5 text-[11px] text-content-secondary hover:border-stroke"
              }
            >
              {FIELD_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {field.type === "select" ? (
        <>
          <Row label="Opciones, una por línea" htmlFor="field-options">
            <Textarea
              id="field-options"
              rows={4}
              value={(field.options ?? []).map((option) => (typeof option === "string" ? option : option.label ?? option.value)).join("\n")}
              onChange={(event) => set((current) => ({ ...current, options: event.target.value.split("\n") }))}
            />
          </Row>
          <Toggle label="Permitir otra opción" checked={Boolean(field.allowOther)} onCheckedChange={(allowOther) => set((current) => ({ ...current, allowOther }))} />
          <Toggle label="Sumar usuarios de la organización" checked={Boolean(field.includeUsers)} onCheckedChange={(includeUsers) => set((current) => ({ ...current, includeUsers: includeUsers || undefined }))} />
        </>
      ) : null}

      {field.type === "reference" && field.reference ? (
        <>
          <Row label="Vincular con" htmlFor="field-source">
            <NativeSelect
              id="field-source"
              value={field.reference.source}
              onChange={(event) => {
                const source = sourceOf(event.target.value);
                set((current) => ({ ...current, reference: { source: event.target.value, display: source?.display ?? "" } }));
              }}
            >
              {!referenceSource ? <option value={field.reference.source}>{field.reference.source}</option> : null}
              <SourceOptions sources={sources} />
            </NativeSelect>
          </Row>
          {referenceSource ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Row label="Mostrar" htmlFor="field-display">
                  <NativeSelect
                    id="field-display"
                    value={field.reference.display}
                    onChange={(event) => set((current) => ({ ...current, reference: { ...current.reference!, display: event.target.value } }))}
                  >
                    {referenceSource.attributes.filter((attribute) => attribute.type !== "rows").map((attribute) => (
                      <option key={attribute.key} value={attribute.key}>{attribute.label}</option>
                    ))}
                  </NativeSelect>
                </Row>
                <Row label="Identificar también por" htmlFor="field-match">
                  <NativeSelect
                    id="field-match"
                    value={field.reference.match ?? ""}
                    onChange={(event) => set((current) => ({ ...current, reference: { ...current.reference!, match: event.target.value || undefined } }))}
                  >
                    <option value="">Nada más</option>
                    {referenceSource.attributes.filter((attribute) => attribute.type !== "rows" && attribute.key !== field.reference?.display).map((attribute) => (
                      <option key={attribute.key} value={attribute.key}>{attribute.label}</option>
                    ))}
                  </NativeSelect>
                </Row>
              </div>
              <div className="mt-4 text-xs font-medium text-content-secondary">Traer también</div>
              <div className="mt-1.5 flex flex-col rounded-lg border border-stroke-soft p-1">
                {referenceSource.attributes.filter((attribute) => attribute.type !== "rows" && attribute.key !== field.reference?.display).map((attribute) => (
                  <label key={attribute.key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-content hover:bg-canvas-muted">
                    <input
                      type="checkbox"
                      className="accent-orange-primary"
                      checked={scopeFields.some((entry) => entry.type === "lookup" && entry.lookup?.from === field.key && entry.lookup.attribute === attribute.key)}
                      onChange={(event) => toggleBroughtAttribute(attribute.key, attribute.label, event.target.checked)}
                    />
                    <span className="min-w-0 flex-1 truncate">{attribute.label}</span>
                    <span className="font-mono text-[11px] text-content-muted">{field.key}.{attribute.key}</span>
                  </label>
                ))}
              </div>
              {!isColumn ? (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-canvas-muted px-3 py-2 text-xs text-content-secondary">
                  <span>{field.reference.copy?.length ? `Copia ${field.reference.copy.length} datos al elegir` : "No copia datos al elegir"}</span>
                  <Button type="button" size="xs" variant="ghost" onClick={onOpenLinks}>Vínculos</Button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-xs text-destructive">Esta fuente no existe en la organización.</p>
          )}
        </>
      ) : null}

      {field.type === "lookup" ? (
        <>
          <Row label="Viene de" htmlFor="field-lookup-from">
            <NativeSelect
              id="field-lookup-from"
              value={field.lookup?.from ?? ""}
              onChange={(event) => set((current) => ({ ...current, lookup: { from: event.target.value, attribute: "" } }))}
            >
              <option value="">Elegí un vínculo</option>
              {referenceFields.map((entry) => (
                <option key={entry.key} value={entry.key}>{entry.label}</option>
              ))}
            </NativeSelect>
          </Row>
          {lookupSource ? (
            <Row label="Dato" htmlFor="field-lookup-attribute">
              <NativeSelect
                id="field-lookup-attribute"
                value={field.lookup?.attribute ?? ""}
                onChange={(event) => set((current) => ({ ...current, lookup: { from: current.lookup?.from ?? "", attribute: event.target.value } }))}
              >
                <option value="">Elegí un dato</option>
                {lookupSource.attributes.filter((attribute) => attribute.type !== "rows").map((attribute) => (
                  <option key={attribute.key} value={attribute.key}>{attribute.label}</option>
                ))}
              </NativeSelect>
            </Row>
          ) : null}
        </>
      ) : null}

      {field.type === "formula" ? (
        <>
          <Row label="Fórmula" htmlFor="field-formula">
            <Textarea
              id="field-formula"
              rows={3}
              spellCheck={false}
              className="font-mono text-xs"
              value={field.formula ?? ""}
              onChange={(event) => set((current) => ({ ...current, formula: event.target.value }))}
            />
          </Row>
          <div className="mt-2 flex flex-wrap gap-1">
            {[...formulaTokens, ...aggregateTokens].map((token) => (
              <button key={token} type="button" onClick={() => insertToken(token)} className="rounded-md border border-stroke-soft bg-surface px-1.5 py-0.5 font-mono text-[11px] text-content-secondary hover:border-category hover:text-category">
                {token}
              </button>
            ))}
            {DOCUMENT_FORMULA_FUNCTIONS.filter((entry) => !isColumn || !["SUMA", "PROMEDIO", "CONTAR"].includes(entry.name)).map((entry) => (
              <button key={entry.name} type="button" title={entry.description} onClick={() => insertToken(entry.usage.split(" o ")[0])} className="rounded-md bg-category/10 px-1.5 py-0.5 font-mono text-[11px] text-category">
                {entry.name}
              </button>
            ))}
          </div>
          <div className={analysis && !analysis.ok ? "mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive" : "mt-3 flex justify-between gap-2 rounded-lg bg-category/10 px-3 py-2 text-xs text-category"}>
            {analysis && !analysis.ok ? (
              analysis.error
            ) : (
              <>
                <span>Con datos de ejemplo</span>
                <strong>{formatSampleValue(sampleValue, field) ?? "Sin resultado"}</strong>
              </>
            )}
          </div>
          <Row label="Formato" htmlFor="field-format">
            <NativeSelect id="field-format" value={field.format ?? "money"} onChange={(event) => set((current) => ({ ...current, format: event.target.value as "money" | "number" }))}>
              <option value="money">Importe</option>
              <option value="number">Número</option>
            </NativeSelect>
          </Row>
        </>
      ) : null}

      {!isColumn && (field.type === "text" || field.type === "date" || field.type === "number") ? (
        <Row label="Completar solo" htmlFor="field-auto">
          <NativeSelect
            id="field-auto"
            value={field.auto ?? ""}
            onChange={(event) => set((current) => ({ ...current, auto: (event.target.value || undefined) as SpecAuto | undefined }))}
          >
            <option value="">No</option>
            <option value="sequence">Numeración automática</option>
            <option value="today">Fecha de hoy</option>
            <option value="obra">Nombre de la obra</option>
          </NativeSelect>
        </Row>
      ) : null}

      {field.type !== "formula" && field.type !== "lookup" && !field.auto ? (
        <Toggle label="Obligatorio" checked={Boolean(field.required)} onCheckedChange={(required) => set((current) => ({ ...current, required: required || undefined }))} />
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2 border-t border-stroke-soft pt-4">
        <Button type="button" size="sm" variant="outline" aria-label="Mover antes" onClick={() => { onChange(moveField(spec, sectionIndex, fieldIndex, -1)); onSelect({ section: sectionIndex, field: Math.max(0, fieldIndex - 1) }); }}>
          <ArrowUp className="size-4" />
        </Button>
        <Button type="button" size="sm" variant="outline" aria-label="Mover después" onClick={() => { onChange(moveField(spec, sectionIndex, fieldIndex, 1)); onSelect({ section: sectionIndex, field: Math.min(scopeFields.length - 1, fieldIndex + 1) }); }}>
          <ArrowDown className="size-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            const taken = keysForScope(spec, sectionIndex);
            onChange(insertField(spec, sectionIndex, fieldIndex + 1, { ...structuredClone(field), key: uniqueKey(field.key, taken), label: `${field.label} (copia)` }));
            onSelect({ section: sectionIndex, field: fieldIndex + 1 });
          }}
        >
          <Copy className="size-4" />
          Duplicar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="ml-auto"
          onClick={() => {
            onChange(removeField(spec, sectionIndex, fieldIndex));
            onSelect({ section: sectionIndex });
          }}
        >
          <Trash2 className="size-4" />
          Quitar
        </Button>
      </div>
    </div>
  );
}
