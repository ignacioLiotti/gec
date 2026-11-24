"use client";

import { ArrowRight, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import type { DocumentTemplateSummary } from "@/lib/document-generation";
import type { ReferenceSourceDescriptor, SpecField, TemplateSpec } from "@/lib/document-template-spec";

import { documentKeys, insertField, sectionFieldList, uniqueKey, updateField, type SpecSelection } from "./spec-editing";

type LinksProps = {
  spec: TemplateSpec;
  sources: ReferenceSourceDescriptor[];
  templates: DocumentTemplateSummary[];
  onChange: (spec: TemplateSpec) => void;
  onSelect: (selection: SpecSelection) => void;
};

type ReferenceLocation = { sectionIndex: number; fieldIndex: number; field: SpecField };

function documentReferenceFields(spec: TemplateSpec): ReferenceLocation[] {
  const found: ReferenceLocation[] = [];
  spec.sections.forEach((section, sectionIndex) => {
    if (section.kind === "table") return;
    sectionFieldList(section).forEach((field, fieldIndex) => {
      if (field.type === "reference" && field.reference) found.push({ sectionIndex, fieldIndex, field });
    });
  });
  return found;
}

function ChainNode({ title, subtitle, current }: { title: string; subtitle: string; current?: boolean }) {
  return (
    <div className={current ? "min-w-40 rounded-xl border border-orange-primary bg-surface px-3.5 py-2.5 shadow-sm" : "min-w-40 rounded-xl border border-stroke-soft bg-surface px-3.5 py-2.5"}>
      <div className="text-sm font-semibold text-content">{title}</div>
      <div className="text-xs text-content-secondary">{subtitle}</div>
    </div>
  );
}

export function BuilderLinks({ spec, sources, templates, onChange, onSelect }: LinksProps) {
  const references = documentReferenceFields(spec);
  const origins = references.filter(({ field }) => field.reference?.source.startsWith("documento:"));
  const ownSource = `documento:${spec.documentType}`;
  const continuations = templates.filter((template) =>
    template.documentType !== spec.documentType &&
    template.schema.fields.some((field) => field.type === "reference" && field.reference?.source === ownSource),
  );
  const usedSources = [...new Set(references.map(({ field }) => field.reference!.source))];

  const targets = spec.sections.flatMap((section) =>
    section.kind === "table"
      ? section.columns.map((column) => ({ value: `${section.key}.${column.key}`, label: `${section.title} → ${column.label}` }))
      : sectionFieldList(section).map((field) => ({ value: field.key, label: field.label })),
  );

  const addDocumentLink = () => {
    const source = sources.find((entry) => entry.group === "documento" && entry.key !== ownSource);
    const sectionIndex = spec.sections.findIndex((section) => section.kind === "fields");
    if (!source || sectionIndex < 0) return;
    onChange(
      insertField(spec, sectionIndex, 0, {
        key: uniqueKey("documento_origen", documentKeys(spec)),
        label: source.label,
        type: "reference",
        required: true,
        reference: { source: source.key, display: source.display, copy: [] },
      }),
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <section className="rounded-2xl border border-stroke-soft bg-surface p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-content">Circuito</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          {origins.map(({ field }) => (
            <div key={field.key} className="flex items-center gap-2.5">
              <ChainNode title={sources.find((source) => source.key === field.reference?.source)?.label ?? field.label} subtitle="Se crea desde" />
              <ArrowRight className="size-4 text-content-muted" />
            </div>
          ))}
          <ChainNode title={spec.name || "Esta plantilla"} subtitle="Esta plantilla" current />
          {continuations.map((template) => (
            <div key={template.id} className="flex items-center gap-2.5">
              <ArrowRight className="size-4 text-content-muted" />
              <ChainNode title={template.name} subtitle="Continúa en" />
            </div>
          ))}
        </div>
        {sources.some((source) => source.group === "documento" && source.key !== ownSource) ? (
          <Button type="button" size="sm" variant="outline" className="mt-4" onClick={addDocumentLink}>
            <Plus className="size-4" />
            Crear desde otro documento
          </Button>
        ) : null}
      </section>

      {references.map(({ sectionIndex, fieldIndex, field }) => {
        const reference = field.reference!;
        const source = sources.find((entry) => entry.key === reference.source);
        const sourceOptions = (source?.attributes ?? []).flatMap((attribute) =>
          attribute.type === "rows"
            ? (attribute.columns ?? []).map((column) => ({ value: `${attribute.key}.${column.key}`, label: `${attribute.label} → ${column.label}` }))
            : [{ value: attribute.key, label: attribute.label }],
        );
        const copies = reference.copy ?? [];
        const setCopies = (copy: Array<{ from: string; to: string }>) =>
          onChange(updateField(spec, sectionIndex, fieldIndex, (current) => ({ ...current, reference: { ...current.reference!, copy } })));
        return (
          <section key={`${sectionIndex}-${fieldIndex}`} className="rounded-2xl border border-stroke-soft bg-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-content">Al elegir {field.label.toLowerCase()}</h2>
                <button type="button" onClick={() => onSelect({ section: sectionIndex, field: fieldIndex })} className="font-mono text-xs text-content-muted hover:text-orange-primary">
                  {field.key} · {source?.label ?? reference.source}
                </button>
              </div>
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-orange-primary">{copies.length} datos</span>
            </div>
            {copies.length > 0 ? (
              <div className="mt-3 flex flex-col gap-2">
                {copies.map((copy, index) => (
                  <div key={index} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2">
                    <NativeSelect
                      aria-label="Dato de origen"
                      value={copy.from}
                      onChange={(event) => setCopies(copies.map((entry, position) => (position === index ? { ...entry, from: event.target.value } : entry)))}
                    >
                      {!sourceOptions.some((option) => option.value === copy.from) ? <option value={copy.from}>{copy.from}</option> : null}
                      {sourceOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </NativeSelect>
                    <ArrowRight className="size-4 text-content-muted" />
                    <NativeSelect
                      aria-label="Campo de destino"
                      value={copy.to}
                      onChange={(event) => setCopies(copies.map((entry, position) => (position === index ? { ...entry, to: event.target.value } : entry)))}
                    >
                      {!targets.some((option) => option.value === copy.to) ? <option value={copy.to}>{copy.to}</option> : null}
                      {targets.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </NativeSelect>
                    <Button type="button" size="icon-sm" variant="ghost" aria-label="Quitar dato" onClick={() => setCopies(copies.filter((_, position) => position !== index))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-content-muted">
                {sourceOptions.length ? "Solo guarda el vínculo." : "La fuente no tiene datos para copiar."}
              </p>
            )}
            {sourceOptions.length && targets.length ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => setCopies([...copies, { from: sourceOptions[0].value, to: targets[0].value }])}
              >
                <Plus className="size-4" />
                Copiar un dato
              </Button>
            ) : null}
          </section>
        );
      })}

      <section className="rounded-2xl border border-stroke-soft bg-surface p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-content">Datos de la app que usa</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {usedSources.length === 0 ? <span className="text-xs text-content-muted">Agregá un campo de tipo Vínculo.</span> : null}
          {usedSources.map((key) => {
            const source = sources.find((entry) => entry.key === key);
            return (
              <div key={key} className="rounded-lg border border-stroke-soft bg-canvas-muted px-3 py-2 text-sm text-content">
                {source?.label ?? key}
                <div className="text-[11px] text-content-muted">{source?.description ?? "Fuente desconocida"}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
