import {
  headerFields,
  specFieldId,
  specSectionIds,
  type ReferenceSourceDescriptor,
  type SpecField,
  type SpecFieldType,
  type SpecSection,
  type TemplateSpec,
} from "@/lib/document-template-spec";

/** What the builder has selected: a section, or one field/column inside it. */
export type SpecSelection = { section: number; field?: number } | null;

export type SectionKind = SpecSection["kind"];

export const FIELD_TYPE_LABELS: Record<SpecFieldType, string> = {
  text: "Texto",
  textarea: "Texto largo",
  number: "Número",
  money: "Importe",
  date: "Fecha",
  select: "Lista",
  reference: "Vínculo",
  lookup: "Dato traído",
  formula: "Fórmula",
};

export const SECTION_LABELS: Record<SectionKind, string> = {
  header: "Encabezado",
  fields: "Campos",
  table: "Tabla",
  totals: "Totales",
  text: "Texto libre",
  signatures: "Firmas",
};

export function createBlankSpec(): TemplateSpec {
  return {
    version: 1,
    name: "Documento sin título",
    documentType: "",
    numberPrefix: "",
    sections: [
      { kind: "header" },
      { kind: "fields", title: "Datos", fields: [] },
      { kind: "signatures", labels: ["Firma"] },
    ],
  };
}

export function slugifyKey(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return /^[a-z]/.test(slug) ? slug : `campo_${slug || "nuevo"}`;
}

/** Fields of a section as stored; header defaults become explicit. */
export function sectionFieldList(section: SpecSection): SpecField[] {
  if (section.kind === "header") return headerFields(section);
  if (section.kind === "fields" || section.kind === "totals") return section.fields;
  if (section.kind === "table") return section.columns;
  return [];
}

function withFieldList(section: SpecSection, fields: SpecField[]): SpecSection {
  if (section.kind === "table") return { ...section, columns: fields };
  if (section.kind === "header" || section.kind === "fields" || section.kind === "totals") return { ...section, fields };
  return section;
}

export function hasFieldList(section: SpecSection) {
  return section.kind !== "text" && section.kind !== "signatures";
}

/** Keys that must stay unique together: document fields and table keys. */
export function documentKeys(spec: TemplateSpec) {
  const keys = new Set<string>();
  for (const section of spec.sections) {
    if (section.kind === "table") keys.add(section.key);
    else sectionFieldList(section).forEach((field) => keys.add(field.key));
  }
  return keys;
}

function keysForScope(spec: TemplateSpec, sectionIndex: number) {
  const section = spec.sections[sectionIndex];
  return section?.kind === "table" ? new Set(section.columns.map((column) => column.key)) : documentKeys(spec);
}

export function uniqueKey(base: string, taken: Set<string>) {
  let key = base;
  for (let suffix = 2; taken.has(key); suffix += 1) key = `${base}_${suffix}`;
  return key;
}

const NEW_FIELD_LABELS: Record<SpecFieldType, string> = {
  text: "Texto",
  textarea: "Observaciones",
  number: "Cantidad",
  money: "Importe",
  date: "Fecha",
  select: "Estado",
  reference: "Responsable",
  lookup: "Email",
  formula: "Total",
};

export function createField(
  type: SpecFieldType,
  taken: Set<string>,
  context: { sources: ReferenceSourceDescriptor[]; referenceKeys: string[] },
): SpecField {
  const label = NEW_FIELD_LABELS[type];
  const field: SpecField = { key: uniqueKey(slugifyKey(label), taken), label, type };
  if (type === "select") field.options = ["Opción 1", "Opción 2"];
  if (type === "formula") field.formula = "";
  if (type === "reference") {
    const source = context.sources.find((entry) => entry.key === "usuarios") ?? context.sources[0];
    field.reference = { source: source?.key ?? "usuarios", display: source?.display ?? "nombre" };
  }
  if (type === "lookup") field.lookup = { from: context.referenceKeys[0] ?? "", attribute: "" };
  return field;
}

export function insertField(spec: TemplateSpec, sectionIndex: number, at: number, field: SpecField): TemplateSpec {
  return {
    ...spec,
    sections: spec.sections.map((section, index) => {
      if (index !== sectionIndex) return section;
      const fields = [...sectionFieldList(section)];
      fields.splice(at, 0, field);
      return withFieldList(section, fields);
    }),
  };
}

export function updateField(
  spec: TemplateSpec,
  sectionIndex: number,
  fieldIndex: number,
  update: (field: SpecField) => SpecField,
): TemplateSpec {
  return {
    ...spec,
    sections: spec.sections.map((section, index) =>
      index === sectionIndex
        ? withFieldList(section, sectionFieldList(section).map((field, position) => (position === fieldIndex ? update(field) : field)))
        : section,
    ),
  };
}

export function removeField(spec: TemplateSpec, sectionIndex: number, fieldIndex: number): TemplateSpec {
  return {
    ...spec,
    sections: spec.sections.map((section, index) =>
      index === sectionIndex ? withFieldList(section, sectionFieldList(section).filter((_, position) => position !== fieldIndex)) : section,
    ),
  };
}

export function moveField(spec: TemplateSpec, sectionIndex: number, fieldIndex: number, offset: -1 | 1): TemplateSpec {
  const fields = [...sectionFieldList(spec.sections[sectionIndex])];
  const target = fieldIndex + offset;
  if (target < 0 || target >= fields.length) return spec;
  [fields[fieldIndex], fields[target]] = [fields[target], fields[fieldIndex]];
  return { ...spec, sections: spec.sections.map((section, index) => (index === sectionIndex ? withFieldList(section, fields) : section)) };
}

/**
 * Renames a key and the formulas, lookups and copy targets that use it, so a
 * rename in the builder never leaves dangling references.
 */
export function renameFieldKey(spec: TemplateSpec, sectionIndex: number, fieldIndex: number, nextKey: string): TemplateSpec {
  const section = spec.sections[sectionIndex];
  const previous = sectionFieldList(section)[fieldIndex]?.key;
  if (!previous || previous === nextKey) return spec;
  const inTable = section.kind === "table" ? section.key : null;
  const escaped = previous.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const renameInFormula = (formula: string | undefined, sameScope: boolean) => {
    if (!formula) return formula;
    let next = formula;
    if (sameScope || !inTable) next = next.replace(new RegExp(`\\[${escaped}\\]`, "g"), `[${nextKey}]`);
    if (inTable) next = next.replace(new RegExp(`\\b${inTable}\\.${escaped}\\b`, "g"), `${inTable}.${nextKey}`);
    return next;
  };
  const renameTarget = (target: string) => {
    if (inTable) return target === `${inTable}.${previous}` ? `${inTable}.${nextKey}` : target;
    return target === previous ? nextKey : target;
  };

  return {
    ...spec,
    sections: spec.sections.map((current, index) => {
      if (!hasFieldList(current)) return current;
      const sameScope = inTable ? index === sectionIndex : current.kind !== "table";
      const fields = sectionFieldList(current).map((field, position) => {
        let next: SpecField = index === sectionIndex && position === fieldIndex ? { ...field, key: nextKey } : field;
        if (next.formula) next = { ...next, formula: renameInFormula(next.formula, sameScope) };
        if (next.lookup && sameScope && next.lookup.from === previous) next = { ...next, lookup: { ...next.lookup, from: nextKey } };
        if (next.reference?.copy) {
          next = { ...next, reference: { ...next.reference, copy: next.reference.copy.map((copy) => ({ ...copy, to: renameTarget(copy.to) })) } };
        }
        return next;
      });
      return withFieldList(current, fields);
    }),
  };
}

export function createSection(kind: SectionKind, spec: TemplateSpec): SpecSection {
  const taken = documentKeys(spec);
  switch (kind) {
    case "header":
      return { kind: "header" };
    case "fields":
      return { kind: "fields", title: "Datos", fields: [] };
    case "table":
      return {
        kind: "table",
        key: uniqueKey("items", taken),
        title: "Ítems",
        columns: [
          { key: "descripcion", label: "Descripción", type: "text" },
          { key: "cantidad", label: "Cantidad", type: "number" },
          { key: "precio_unitario", label: "Precio unitario", type: "money" },
          { key: "precio_total", label: "Total", type: "formula", formula: "[cantidad] * [precio_unitario]" },
        ],
      };
    case "totals": {
      const table = spec.sections.find((section): section is Extract<SpecSection, { kind: "table" }> => section.kind === "table");
      const column =
        table?.columns.find((entry) => entry.type === "formula") ?? table?.columns.find((entry) => entry.type === "money");
      return {
        kind: "totals",
        fields: [
          {
            key: uniqueKey("total", taken),
            label: "Total",
            type: "formula",
            formula: table && column ? `SUMA(${table.key}.${column.key})` : "",
          },
        ],
      };
    }
    case "text":
      return { kind: "text", title: "", body: "Texto del documento." };
    case "signatures":
      return { kind: "signatures", labels: ["Firma"] };
  }
}

/** Inserts a section after `after`, keeping signatures last. */
export function insertSection(spec: TemplateSpec, section: SpecSection, after: number | null): TemplateSpec {
  const sections = [...spec.sections];
  const signatures = sections.findIndex((entry) => entry.kind === "signatures");
  let at = after == null ? sections.length : after + 1;
  if (section.kind === "header") at = 0;
  else if (section.kind !== "signatures" && signatures >= 0 && at > signatures) at = signatures;
  sections.splice(at, 0, section);
  return { ...spec, sections };
}

export function moveSection(spec: TemplateSpec, index: number, offset: -1 | 1): TemplateSpec {
  const target = index + offset;
  if (target < 0 || target >= spec.sections.length) return spec;
  const sections = [...spec.sections];
  [sections[index], sections[target]] = [sections[target], sections[index]];
  return { ...spec, sections };
}

/** Maps a validation path like `sections[2].columns[4].formula` to a selection. */
export function selectionFromIssuePath(path: string): SpecSelection {
  const section = /^sections\[(\d+)\]/.exec(path);
  if (!section) return null;
  const field = /\.(?:fields|columns)(?:\(default\))?\[(\d+)\]/.exec(path);
  return { section: Number(section[1]), ...(field ? { field: Number(field[1]) } : {}) };
}

export function findSelectedField(spec: TemplateSpec, selection: SpecSelection) {
  if (!selection || selection.field == null) return null;
  const section = spec.sections[selection.section];
  if (!section) return null;
  const field = sectionFieldList(section)[selection.field];
  return field ? { section, field } : null;
}

export { keysForScope };

/** Stable identities for sections and fields across edits (shared with the printed layout). */
export const sectionIds = specSectionIds;
export const fieldId = specFieldId;

function specFingerprints(spec: TemplateSpec) {
  const prints = new Map<string, string>();
  const ids = sectionIds(spec);
  spec.sections.forEach((section, index) => {
    const shape = Object.fromEntries(Object.entries(section).filter(([key]) => key !== "fields" && key !== "columns"));
    prints.set(`s:${ids[index]}`, JSON.stringify(shape));
    for (const field of sectionFieldList(section)) prints.set(fieldId(section, field), JSON.stringify(field));
  });
  return prints;
}

/** What an edit added (in document order) and which existing parts changed. */
export function diffSpecs(previous: TemplateSpec | null, next: TemplateSpec) {
  const before = previous ? specFingerprints(previous) : new Map<string, string>();
  const after = specFingerprints(next);
  const added: string[] = [];
  const changed = new Set<string>();
  for (const [id, print] of after) {
    const old = before.get(id);
    if (old === undefined) added.push(id);
    else if (old !== print) changed.add(id);
  }
  return { added, changed, styleChanged: JSON.stringify(previous?.style ?? null) !== JSON.stringify(next.style ?? null) };
}

/** A spec with nothing to fill in yet (the blank starting point). */
export function isBlankSpec(spec: TemplateSpec) {
  return spec.sections.every((section) => section.kind === "header" || section.kind === "signatures" || sectionFieldList(section).length === 0);
}
