"use client";

import { ArrowRight, Calculator, Link2, Plus } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import { headerFields, type ReferenceSourceDescriptor, type SpecField, type SpecSection, type TemplateSpec } from "@/lib/document-template-spec";

import { FIELD_TYPE_LABELS, fieldId, sectionIds, type SpecSelection } from "./spec-editing";

const AUTO_LABELS = { sequence: "Numeración automática", today: "Hoy", obra: "Obra elegida" } as const;

export function FieldSourceChip({ field, sources }: { field: SpecField; sources: ReferenceSourceDescriptor[] }) {
  const chip = "inline-flex max-w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11px]";
  if (field.auto) return <span className={cn(chip, "bg-surface-recessed text-content-secondary")}>{AUTO_LABELS[field.auto]}</span>;
  if (field.type === "reference" && field.reference) {
    const reference = field.reference;
    const source = sources.find((entry) => entry.key === reference.source);
    const match = source?.attributes.find((attribute) => attribute.key === reference.match);
    return (
      <span className={cn(chip, "bg-info/10 text-info")}>
        <Link2 className="size-3 shrink-0" />
        <span className="truncate">
          {source?.label ?? reference.source}
          {match ? ` · por ${match.label.toLowerCase()}` : ""}
        </span>
        {reference.copy?.length ? <span className="shrink-0 rounded bg-info/15 px-1">copia {reference.copy.length}</span> : null}
      </span>
    );
  }
  if (field.type === "lookup") {
    return (
      <span className={cn(chip, "border border-dashed border-info/40 text-info")}>
        <ArrowRight className="size-3 shrink-0" />
        <span className="truncate font-mono">{field.lookup?.from || "?"}.{field.lookup?.attribute || "?"}</span>
      </span>
    );
  }
  if (field.type === "formula") {
    return (
      <span className={cn(chip, "bg-category/10 font-mono text-category")}>
        <Calculator className="size-3 shrink-0" />
        <span className="truncate">{field.formula?.trim() ? field.formula.replace(/\*/g, "×").replace(/\//g, "÷") : "Sin fórmula"}</span>
      </span>
    );
  }
  if (field.type === "select") {
    const options = (field.options ?? []).map((option) => (typeof option === "string" ? option : option.label ?? option.value));
    return <span className={cn(chip, "bg-surface-recessed text-content-secondary")}>{options.slice(0, 3).join(" / ") || "Sin opciones"}</span>;
  }
  return <span className={cn(chip, "bg-surface-recessed text-content-secondary")}>{FIELD_TYPE_LABELS[field.type]}</span>;
}

/** What the last assistant edit did, so the canvas can animate it. */
export type CanvasChange = {
  /** New sections/fields in document order; the order staggers their entrance. */
  added: Map<string, number>;
  changed: Set<string>;
  revision: number;
};

type CanvasProps = {
  spec: TemplateSpec;
  selection: SpecSelection;
  sources: ReferenceSourceDescriptor[];
  issueKeys: Set<string>;
  onSelect: (selection: SpecSelection) => void;
  onAddColumn: (sectionIndex: number) => void;
  change?: CanvasChange | null;
  /** Assistant mode: the canvas only shows the document; no selection or add buttons. */
  readOnly?: boolean;
};

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
const LAYOUT_TRANSITION = { layout: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } };

function isSelected(selection: SpecSelection, section: number, field?: number) {
  return selection?.section === section && selection.field === field;
}

export function BuilderCanvas({ spec, selection, sources, issueKeys, onSelect, onAddColumn, change, readOnly = false }: CanvasProps) {
  const reduceMotion = useReducedMotion();
  const ids = sectionIds(spec);
  const accent = spec.style?.accent;

  /** Entrance from the side of the screen the element sits on, staggered by document order. */
  const enter = (id: string, side: -1 | 1) => {
    const order = change?.added.get(id);
    if (order === undefined || reduceMotion) return false;
    return { opacity: 0, x: side * 260, filter: "blur(8px)", transition: { duration: 0 } };
  };
  const shown = (id: string) => ({
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: { duration: 0.65, ease: EASE_OUT, delay: Math.min((change?.added.get(id) ?? 0) * 0.045, 1.2) },
  });
  const exit = reduceMotion ? undefined : { opacity: 0, scale: 0.96, filter: "blur(6px)", transition: { duration: 0.25, ease: "easeIn" as const } };

  /** Short glow over parts the last edit modified. */
  const glow = (id: string) =>
    change?.changed.has(id) && !reduceMotion ? (
      <motion.span
        key={`glow-${change.revision}`}
        aria-hidden
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 1.8, ease: "easeOut", delay: 0.2 }}
        className="pointer-events-none absolute inset-0 rounded-md bg-orange-primary/10 ring-2 ring-orange-primary/45"
      />
    ) : null;

  const fieldButton = (section: SpecSection, field: SpecField, sectionIndex: number, fieldIndex: number, side: -1 | 1, className?: string) => {
    const id = fieldId(section, field);
    const selected = !readOnly && isSelected(selection, sectionIndex, fieldIndex);
    const hasIssue = issueKeys.has(`${sectionIndex}.${fieldIndex}`);
    return (
      <motion.button
        key={id}
        layout="position"
        initial={enter(id, side)}
        animate={shown(id)}
        exit={exit}
        transition={LAYOUT_TRANSITION}
        data-canvas-id={id}
        type="button"
        tabIndex={readOnly ? -1 : 0}
        onClick={(event) => {
          event.stopPropagation();
          if (!readOnly) onSelect({ section: sectionIndex, field: fieldIndex });
        }}
        className={cn(
          "relative -mx-1.5 min-w-0 rounded-md border border-transparent px-1.5 py-1 text-left transition-colors",
          !readOnly && "hover:bg-canvas-muted",
          readOnly && "cursor-default",
          selected && "border-orange-primary bg-accent-soft hover:bg-accent-soft",
          hasIssue && !selected && "border-destructive/40",
          field.width === "full" && section.kind !== "header" && "sm:col-span-2",
          className,
        )}
      >
        {glow(id)}
        <span className="flex items-center gap-1 text-[11px] text-content-secondary">
          {field.label}
          {field.required ? <span className="text-orange-primary">*</span> : null}
        </span>
        <span className="mt-0.5 flex min-h-6 items-center border-b border-stroke-soft pb-1">
          <FieldSourceChip field={field} sources={sources} />
        </span>
      </motion.button>
    );
  };

  const sectionTitle = (text: string, selected: boolean) => (
    <div
      className={cn("mb-2 text-[11px] font-semibold uppercase tracking-wide text-content-muted transition-colors duration-700", selected && "text-orange-primary")}
      style={accent && !selected ? { color: accent } : undefined}
    >
      {text}
    </div>
  );

  const block = (sectionIndex: number, section: SpecSection, children: React.ReactNode, title?: string) => {
    const id = ids[sectionIndex];
    const selected = !readOnly && isSelected(selection, sectionIndex);
    const blockId = `s:${id}`;
    return (
      <motion.div
        key={id}
        layout="position"
        initial={enter(blockId, sectionIndex % 2 ? 1 : -1)}
        animate={shown(blockId)}
        exit={exit}
        transition={LAYOUT_TRANSITION}
        data-canvas-id={blockId}
        role={readOnly ? undefined : "button"}
        tabIndex={readOnly ? undefined : 0}
        onClick={() => {
          if (!readOnly) onSelect({ section: sectionIndex });
        }}
        onKeyDown={(event) => {
          if (!readOnly && event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            onSelect({ section: sectionIndex });
          }
        }}
        className={cn(
          "relative -mx-3 mb-3 rounded-lg border-[1.5px] border-transparent p-3 outline-none transition-colors",
          !readOnly && "cursor-pointer hover:border-stroke-soft focus-visible:border-orange-primary/60",
          selected && "border-orange-primary hover:border-orange-primary",
          issueKeys.has(String(sectionIndex)) && !selected && "border-destructive/40",
        )}
      >
        {glow(blockId)}
        {title ? sectionTitle(title, selected) : null}
        {children}
        {section.kind === "fields" && section.fields.length === 0 && !readOnly ? (
          <div className="rounded-lg border border-dashed border-stroke-strong p-4 text-center text-xs text-content-muted">Elegí un tipo de campo a la izquierda</div>
        ) : null}
      </motion.div>
    );
  };

  return (
    <motion.div layout="size" transition={LAYOUT_TRANSITION} className="mx-auto w-full max-w-[780px] rounded-sm border border-stroke-soft bg-surface px-6 py-8 shadow-lg sm:px-11 sm:py-10">
      <AnimatePresence initial={false}>
        {spec.sections.map((section, sectionIndex) => {
          switch (section.kind) {
            case "header":
              return block(
                sectionIndex,
                section,
                <div
                  className="flex flex-wrap items-start gap-4 border-b-2 border-transparent pb-3 transition-colors duration-700"
                  style={accent ? { borderBottomColor: accent } : undefined}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xl font-bold tracking-tight text-content">{section.title || spec.name || "Sin título"}</div>
                    {section.subtitle ? <div className="text-xs text-content-secondary">{section.subtitle}</div> : null}
                  </div>
                  <div className="flex w-full flex-col gap-1.5 sm:w-48">
                    <AnimatePresence initial={false}>
                      {headerFields(section).map((field, fieldIndex) => fieldButton(section, field, sectionIndex, fieldIndex, 1))}
                    </AnimatePresence>
                  </div>
                </div>,
              );
            case "fields": {
              let column = 0;
              return block(
                sectionIndex,
                section,
                <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                  <AnimatePresence initial={false}>
                    {section.fields.map((field, fieldIndex) => {
                      const side: -1 | 1 = field.width === "full" ? (fieldIndex % 2 ? 1 : -1) : column % 2 ? 1 : -1;
                      column = field.width === "full" ? 0 : column + 1;
                      return fieldButton(section, field, sectionIndex, fieldIndex, side);
                    })}
                  </AnimatePresence>
                </div>,
                section.title || "Campos",
              );
            }
            case "table":
              return block(
                sectionIndex,
                section,
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr>
                        {section.columns.map((column, columnIndex) => {
                          const id = fieldId(section, column);
                          return (
                            <motion.th
                              key={id}
                              initial={enter(id, 1)}
                              animate={shown(id)}
                              className="border-b-[1.5px] border-content p-1 text-left align-bottom font-normal transition-colors duration-700"
                              style={accent ? { borderBottomColor: accent } : undefined}
                            >
                              {fieldButton(section, column, sectionIndex, columnIndex, 1, "mx-0 w-full")}
                            </motion.th>
                          );
                        })}
                        {readOnly ? null : (
                          <th className="w-8 border-b-[1.5px] border-dashed border-content-muted p-1">
                            <button
                              type="button"
                              aria-label="Agregar columna"
                              onClick={(event) => {
                                event.stopPropagation();
                                onAddColumn(sectionIndex);
                              }}
                              className="grid size-7 place-items-center rounded-md text-content-muted hover:bg-canvas-muted hover:text-orange-primary"
                            >
                              <Plus className="size-4" />
                            </button>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {[0, 1].map((row) => (
                        <tr key={row}>
                          {section.columns.map((column) => (
                            <td key={column.key} className="h-7 border-b border-stroke-soft" />
                          ))}
                          {readOnly ? null : <td />}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>,
                `${section.title || "Tabla"} · ${section.key}`,
              );
            case "totals":
              return block(
                sectionIndex,
                section,
                <div className="ml-auto flex w-full max-w-xs flex-col gap-1">
                  <AnimatePresence initial={false}>
                    {section.fields.map((field, fieldIndex) => fieldButton(section, field, sectionIndex, fieldIndex, 1))}
                  </AnimatePresence>
                </div>,
                section.title || "Totales",
              );
            case "text":
              return block(
                sectionIndex,
                section,
                <p className="whitespace-pre-wrap rounded-md border border-dashed border-stroke-soft p-2.5 text-sm text-content-secondary">{section.body || "Texto vacío"}</p>,
                section.title || "Texto",
              );
            case "signatures":
              return block(
                sectionIndex,
                section,
                <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2">
                  {section.labels.map((label, index) => (
                    <div key={index} className="border-t border-content pt-1.5 text-center text-xs text-content-secondary">
                      {label}
                    </div>
                  ))}
                </div>,
              );
          }
        })}
      </AnimatePresence>
    </motion.div>
  );
}
