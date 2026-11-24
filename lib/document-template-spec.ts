import { analyzeDocumentFormula, DOCUMENT_FORMULA_FUNCTIONS } from "@/lib/document-formula";
import {
	escapeHtml,
	normalizeDocumentType,
	type TemplateField,
	type TemplateSchema,
} from "@/lib/document-generation";

/**
 * Template Spec v1: the single, linear description of a document template.
 *
 * The visual builder edits a spec and an LLM can write one from the guide
 * returned by `buildTemplateSpecGuide`. Both go through the same path:
 *
 *   catalog (sources) -> spec -> validateTemplateSpec -> compileTemplateSpec
 *   -> stored template (schema + contentHtml, spec kept in schema.spec)
 *
 * The compiled schema is the existing TemplateSchema, so drafts, generation,
 * versioning and permissions keep working unchanged.
 */

export const TEMPLATE_SPEC_VERSION = 1;

export const SPEC_FIELD_TYPES = [
	"text",
	"textarea",
	"number",
	"money",
	"date",
	"select",
	"reference",
	"lookup",
	"formula",
] as const;

export type SpecFieldType = (typeof SPEC_FIELD_TYPES)[number];
export type SpecAuto = "today" | "obra" | "sequence";

export type SpecField = {
	key: string;
	label: string;
	type: SpecFieldType;
	required?: boolean;
	description?: string;
	default?: string | number;
	/** select */
	options?: Array<string | { value: string; label?: string }>;
	/** select: allow typing a value that is not in the list */
	allowOther?: boolean;
	/** select: also offer the organization's users as options */
	includeUsers?: boolean;
	/** reference */
	reference?: {
		source: string;
		display: string;
		match?: string;
		copy?: Array<{ from: string; to: string }>;
	};
	/** lookup */
	lookup?: { from: string; attribute: string };
	/** formula */
	formula?: string;
	/** formula output format (default money) */
	format?: "money" | "number";
	auto?: SpecAuto;
	/** fields/header sections: take the whole row instead of half */
	width?: "full";
	/** fields: print only the value, without "Label:" */
	hideLabel?: boolean;
	/** totals: bold row; table column: bold text */
	emphasis?: boolean;
};

/** Layout options shared by body sections: two consecutive "half" sections share a row. */
type SectionLayout = { width?: "half"; boxed?: boolean };

export type SpecSection =
	| { kind: "header"; title?: string; subtitle?: string; /** issuer block: first line is the name, the rest are detail lines */ issuer?: string; fields?: SpecField[] }
	| ({ kind: "fields"; title?: string; fields: SpecField[] } & SectionLayout)
	| ({ kind: "table"; key: string; title: string; required?: boolean; columns: SpecField[] } & SectionLayout)
	| ({ kind: "totals"; title?: string; fields: SpecField[] } & SectionLayout)
	| ({ kind: "text"; title?: string; body: string } & SectionLayout)
	| ({ kind: "signatures"; labels: string[] } & SectionLayout);

export type TemplateSpec = {
	version: 1;
	name: string;
	documentType: string;
	description?: string;
	targetFolderPath?: string;
	numberPrefix?: string;
	fileName?: string;
	/** Visual options of the generated layout. */
	style?: { accent?: string };
	sections: SpecSection[];
};

export type ReferenceSourceAttribute = {
	key: string;
	label: string;
	/** "rows" marks an attribute holding table rows (usable as `attr.column` in copy). */
	type?: "text" | "number" | "date" | "rows";
	columns?: Array<{ key: string; label: string }>;
};

export type ReferenceSourceDescriptor = {
	key: string;
	label: string;
	group: "app" | "tabla" | "documento";
	description: string;
	display: string;
	requiresWork: boolean;
	attributes: ReferenceSourceAttribute[];
};

export type SpecIssue = { path: string; message: string };

export type SpecValidation = {
	ok: boolean;
	errors: SpecIssue[];
	warnings: SpecIssue[];
};

const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
const RESERVED_KEYS = new Set(["templateName", "documentType", "workName", "folderPath", "__refs", "__documentAi"]);
/** File names read these as the document number, so only the numbering field may use them. */
const NUMBER_ALIAS_KEYS = new Set(["numero", "number", "nro"]);
const ACCENT_PATTERN = /^#[0-9a-fA-F]{6}$/;
const TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*(?:\|\s*(money|number|date)\s*)?\}\}/g;

const DEFAULT_HEADER_FIELDS: SpecField[] = [
	{ key: "numero", label: "Número", type: "text", auto: "sequence" },
	{ key: "fecha", label: "Fecha", type: "date", auto: "today" },
];

export function headerFields(section: Extract<SpecSection, { kind: "header" }>) {
	return section.fields && section.fields.length > 0 ? section.fields : DEFAULT_HEADER_FIELDS;
}

function sectionFields(section: SpecSection): SpecField[] {
	if (section.kind === "header") return headerFields(section);
	if (section.kind === "fields" || section.kind === "totals") return section.fields;
	return [];
}

/** Document-level fields (not table columns), in order. */
export function listSpecFields(spec: TemplateSpec) {
	return spec.sections.flatMap(sectionFields);
}

export function listSpecTables(spec: TemplateSpec) {
	return spec.sections.filter((section): section is Extract<SpecSection, { kind: "table" }> => section.kind === "table");
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Validates a spec. With a catalog, reference sources and attributes are
 * checked too. Messages name the path and say how to fix the problem, so an
 * LLM can correct the spec and retry.
 */
export function validateTemplateSpec(
	input: unknown,
	catalog?: ReferenceSourceDescriptor[],
): SpecValidation {
	const errors: SpecIssue[] = [];
	const warnings: SpecIssue[] = [];
	const error = (path: string, message: string) => errors.push({ path, message });

	if (!isPlainObject(input)) {
		return { ok: false, errors: [{ path: "", message: "La especificación debe ser un objeto JSON." }], warnings };
	}
	const spec = input as Partial<TemplateSpec>;
	if (spec.version !== TEMPLATE_SPEC_VERSION) error("version", "Usá version: 1.");
	if (typeof spec.name !== "string" || !spec.name.trim()) error("name", "Falta el nombre de la plantilla.");
	if (typeof spec.documentType !== "string" || !normalizeDocumentType(spec.documentType)) {
		error("documentType", 'Falta el tipo de documento, por ejemplo "RECEPCION_MATERIALES".');
	}
	if (spec.style !== undefined) {
		if (!isPlainObject(spec.style)) error("style", "style debe ser un objeto, por ejemplo { accent: \"#2563eb\" }.");
		else if (spec.style.accent !== undefined && !(typeof spec.style.accent === "string" && ACCENT_PATTERN.test(spec.style.accent))) {
			error("style.accent", "El color debe ser hexadecimal de 6 dígitos, por ejemplo #2563eb.");
		}
	}
	if (!Array.isArray(spec.sections) || spec.sections.length === 0) {
		error("sections", "Agregá al menos una sección.");
		return { ok: false, errors, warnings };
	}

	const sourcesByKey = new Map((catalog ?? []).map((source) => [source.key, source]));
	const topLevel = new Map<string, { field: SpecField; path: string }>();
	const tables = new Map<string, { columns: Map<string, SpecField>; path: string }>();
	let headerCount = 0;

	const checkFieldShape = (field: unknown, path: string): field is SpecField => {
		if (!isPlainObject(field)) {
			error(path, "Cada campo debe ser un objeto con key, label y type.");
			return false;
		}
		const candidate = field as Partial<SpecField>;
		if (typeof candidate.key !== "string" || !KEY_PATTERN.test(candidate.key)) {
			error(`${path}.key`, "La key debe ser snake_case: minúsculas, números y _, empezando con letra.");
		} else if (RESERVED_KEYS.has(candidate.key)) {
			error(`${path}.key`, `"${candidate.key}" está reservada; elegí otra key.`);
		} else if (NUMBER_ALIAS_KEYS.has(candidate.key) && candidate.auto !== "sequence") {
			error(`${path}.key`, `"${candidate.key}" se reserva para la numeración automática (auto: "sequence"); elegí otra key.`);
		}
		if (typeof candidate.label !== "string" || !candidate.label.trim()) error(`${path}.label`, "Falta la etiqueta visible.");
		if (!SPEC_FIELD_TYPES.includes(candidate.type as SpecFieldType)) {
			error(`${path}.type`, `Tipo inválido. Usá uno de: ${SPEC_FIELD_TYPES.join(", ")}.`);
			return false;
		}
		return typeof candidate.key === "string";
	};

	// 1. Shapes and key registry
	spec.sections.forEach((rawSection, sectionIndex) => {
		const path = `sections[${sectionIndex}]`;
		if (!isPlainObject(rawSection)) {
			error(path, "Cada sección debe ser un objeto con kind.");
			return;
		}
		const section = rawSection as SpecSection;
		if (section.kind !== "header") {
			if (section.width !== undefined && section.width !== "half") error(`${path}.width`, "width de una sección solo admite \"half\" (media fila).");
			if (section.boxed !== undefined && typeof section.boxed !== "boolean") error(`${path}.boxed`, "boxed debe ser true o false.");
		} else if (section.issuer !== undefined && typeof section.issuer !== "string") {
			error(`${path}.issuer`, "issuer debe ser texto; separá las líneas con \n.");
		}
		switch (section.kind) {
			case "header":
			case "fields":
			case "totals": {
				if (section.kind === "header") headerCount += 1;
				const fields = section.kind === "header" ? headerFields(section) : section.fields;
				if (!Array.isArray(fields)) {
					error(`${path}.fields`, "fields debe ser una lista.");
					return;
				}
				if (section.kind !== "header" && fields.length === 0) warnings.push({ path: `${path}.fields`, message: "La sección no tiene campos." });
				fields.forEach((field, fieldIndex) => {
					const fieldPath = section.kind === "header" && !section.fields?.length ? `${path}.fields(default)[${fieldIndex}]` : `${path}.fields[${fieldIndex}]`;
					if (!checkFieldShape(field, fieldPath)) return;
					if (topLevel.has(field.key) || tables.has(field.key)) {
						error(`${fieldPath}.key`, `La key "${field.key}" está repetida.`);
						return;
					}
					if (section.kind === "totals" && field.type !== "formula") {
						warnings.push({ path: `${fieldPath}.type`, message: "En totales se espera una fórmula." });
					}
					topLevel.set(field.key, { field, path: fieldPath });
				});
				break;
			}
			case "table": {
				if (typeof section.key !== "string" || !KEY_PATTERN.test(section.key)) {
					error(`${path}.key`, "La tabla necesita una key snake_case, por ejemplo \"items\".");
					return;
				}
				if (topLevel.has(section.key) || tables.has(section.key)) {
					error(`${path}.key`, `La key "${section.key}" está repetida.`);
					return;
				}
				if (typeof section.title !== "string" || !section.title.trim()) error(`${path}.title`, "Falta el título de la tabla.");
				if (!Array.isArray(section.columns) || section.columns.length === 0) {
					error(`${path}.columns`, "La tabla necesita al menos una columna.");
					return;
				}
				const columns = new Map<string, SpecField>();
				section.columns.forEach((column, columnIndex) => {
					const columnPath = `${path}.columns[${columnIndex}]`;
					if (!checkFieldShape(column, columnPath)) return;
					if (columns.has(column.key)) {
						error(`${columnPath}.key`, `La columna "${column.key}" está repetida en la tabla.`);
						return;
					}
					if (column.auto) error(`${columnPath}.auto`, "auto solo se usa en campos del documento, no en columnas.");
					columns.set(column.key, column);
				});
				tables.set(section.key, { columns, path });
				break;
			}
			case "text":
				if (typeof section.body !== "string" || !section.body.trim()) error(`${path}.body`, "El bloque de texto está vacío.");
				break;
			case "signatures":
				if (!Array.isArray(section.labels) || section.labels.length === 0 || section.labels.some((label) => typeof label !== "string" || !label.trim())) {
					error(`${path}.labels`, 'Indicá las firmas como una lista de textos, por ejemplo ["Recibió", "Entregó"].');
				}
				break;
			default:
				error(`${path}.kind`, "kind debe ser header, fields, table, totals, text o signatures.");
		}
	});
	if (headerCount > 1) error("sections", "Solo puede haber un encabezado.");

	// 2. Field semantics (needs the full registry)
	const checkSemantics = (field: SpecField, path: string, scope: Map<string, SpecField>, tableKey: string | null) => {
		if (field.type === "select") {
			if ((!Array.isArray(field.options) || field.options.length === 0) && !field.includeUsers) {
				error(`${path}.options`, "Una lista necesita options o includeUsers: true.");
			}
		}
		if (field.type === "reference") {
			const reference = field.reference;
			if (!isPlainObject(reference) || typeof reference.source !== "string" || typeof reference.display !== "string") {
				error(`${path}.reference`, "Un vínculo necesita reference.source y reference.display.");
			} else if (catalog) {
				const source = sourcesByKey.get(reference.source);
				if (!source) {
					error(`${path}.reference.source`, `No existe la fuente "${reference.source}". Fuentes: ${[...sourcesByKey.keys()].join(", ")}.`);
				} else {
					const attributeKeys = source.attributes.map((attribute) => attribute.key);
					if (!attributeKeys.includes(reference.display)) error(`${path}.reference.display`, `"${reference.display}" no es un atributo de ${source.key}. Atributos: ${attributeKeys.join(", ")}.`);
					if (reference.match && !attributeKeys.includes(reference.match)) error(`${path}.reference.match`, `"${reference.match}" no es un atributo de ${source.key}.`);
					(reference.copy ?? []).forEach((copy, copyIndex) => {
						const copyPath = `${path}.reference.copy[${copyIndex}]`;
						const [fromAttribute, fromColumn] = String(copy.from ?? "").split(".");
						const attribute = source.attributes.find((entry) => entry.key === fromAttribute);
						if (!attribute) error(`${copyPath}.from`, `"${copy.from}" no existe en ${source.key}.`);
						else if (fromColumn && attribute.type !== "rows") error(`${copyPath}.from`, `${fromAttribute} no tiene filas; usá "${fromAttribute}" sin columna.`);
						else if (fromColumn && attribute.columns && !attribute.columns.some((column) => column.key === fromColumn)) {
							error(`${copyPath}.from`, `La columna "${fromColumn}" no existe en ${fromAttribute}.`);
						}
						const [toKey, toColumn] = String(copy.to ?? "").split(".");
						if (toColumn) {
							if (!tables.get(toKey)?.columns.has(toColumn)) error(`${copyPath}.to`, `"${copy.to}" no es una columna de esta plantilla.`);
							if (!fromColumn) error(`${copyPath}.from`, "Para copiar a una columna, el origen también debe ser tabla.columna.");
						} else if (!topLevel.has(toKey)) {
							error(`${copyPath}.to`, `"${copy.to}" no es un campo de esta plantilla.`);
						}
					});
				}
			}
			if (tableKey && field.reference?.copy?.length) error(`${path}.reference.copy`, "copy solo se usa en vínculos del documento, no en columnas.");
		}
		if (field.type === "lookup") {
			const lookup = field.lookup;
			if (!isPlainObject(lookup) || typeof lookup.from !== "string" || typeof lookup.attribute !== "string") {
				error(`${path}.lookup`, "Un dato traído necesita lookup.from (key del vínculo) y lookup.attribute.");
			} else {
				const origin = scope.get(lookup.from);
				if (!origin || origin.type !== "reference") {
					error(`${path}.lookup.from`, `"${lookup.from}" debe ser un campo de tipo reference ${tableKey ? "de la misma tabla" : "del documento"}.`);
				} else if (catalog && origin.reference) {
					const source = sourcesByKey.get(origin.reference.source);
					if (source && !source.attributes.some((attribute) => attribute.key === lookup.attribute && attribute.type !== "rows")) {
						error(`${path}.lookup.attribute`, `"${lookup.attribute}" no es un atributo de ${source.key}. Atributos: ${source.attributes.filter((attribute) => attribute.type !== "rows").map((attribute) => attribute.key).join(", ")}.`);
					}
				}
			}
		}
		if (field.type === "formula") {
			if (typeof field.formula !== "string" || !field.formula.trim()) {
				error(`${path}.formula`, "Falta la fórmula.");
			} else {
				const analysis = analyzeDocumentFormula(field.formula);
				if (!analysis.ok) error(`${path}.formula`, analysis.error ?? "Fórmula inválida.");
				for (const reference of analysis.references) {
					if (reference === field.key) error(`${path}.formula`, "La fórmula no puede usar su propio campo.");
					else if (!scope.has(reference) && !topLevel.has(reference)) {
						error(`${path}.formula`, `[${reference}] no existe. ${tableKey ? "Usá columnas de la fila o campos del documento." : "Usá campos del documento; para columnas usá SUMA(tabla.columna)."}`);
					}
				}
				for (const { table, column } of analysis.columns) {
					if (!tables.get(table)?.columns.has(column)) error(`${path}.formula`, `${table}.${column} no es una columna de esta plantilla.`);
				}
			}
		}
		if (field.auto === "sequence" && field.type !== "text" && field.type !== "number") {
			error(`${path}.auto`, "La numeración automática va en un campo text o number.");
		}
		if (field.width !== undefined && field.width !== "full") error(`${path}.width`, "width solo admite \"full\" (toda la fila).");
		for (const flag of ["hideLabel", "emphasis"] as const) {
			if (field[flag] !== undefined && typeof field[flag] !== "boolean") error(`${path}.${flag}`, `${flag} debe ser true o false.`);
		}
	};

	const topScope = new Map([...topLevel].map(([key, entry]) => [key, entry.field]));
	for (const { field, path } of topLevel.values()) checkSemantics(field, path, topScope, null);
	for (const [tableKey, table] of tables) {
		let columnIndex = 0;
		for (const column of table.columns.values()) {
			checkSemantics(column, `${table.path}.columns[${columnIndex}]`, table.columns, tableKey);
			columnIndex += 1;
		}
	}

	// 3. Text tokens and file name
	const knownTokens = new Set([...topLevel.keys(), "templateName", "documentType", "workName", "folderPath", "numero", "number", "nro"]);
	spec.sections.forEach((section, sectionIndex) => {
		if (isPlainObject(section) && section.kind === "text" && typeof section.body === "string") {
			for (const match of section.body.matchAll(TOKEN_PATTERN)) {
				if (!knownTokens.has(match[1])) error(`sections[${sectionIndex}].body`, `{{${match[1]}}} no es un campo del documento.`);
			}
		}
	});
	if (typeof spec.fileName === "string") {
		for (const match of spec.fileName.matchAll(TOKEN_PATTERN)) {
			if (!knownTokens.has(match[1])) error("fileName", `{{${match[1]}}} no es un campo del documento.`);
		}
	}
	if (![...topLevel.values()].some((entry) => entry.field.auto === "sequence")) {
		warnings.push({ path: "sections", message: "Ningún campo tiene auto: \"sequence\"; los documentos no se numerarán solos." });
	}

	return { ok: errors.length === 0, errors, warnings };
}

/* ------------------------------------------------------------------ */
/* Compilation                                                         */
/* ------------------------------------------------------------------ */

function compileField(field: SpecField): TemplateField {
	const base: TemplateField = {
		key: field.key,
		label: field.label.trim(),
		type: "text",
		required: Boolean(field.required),
		source: "extra",
		description: field.description?.trim() || null,
		defaultValue: field.default,
		autoPopulate:
			field.auto === "today" ? "today"
			: field.auto === "obra" ? "selected_context_label"
			: field.auto === "sequence" ? "next_sequence_number"
			: undefined,
	};
	switch (field.type) {
		case "select":
			return {
				...base,
				type: "select",
				selectMode: field.allowOther ? "creatable" : "strict",
				...(field.includeUsers ? { optionSource: "tenant_users" as const } : {}),
				options: (field.options ?? []).map((option) =>
					typeof option === "string"
						? { value: option, label: option }
						: { value: option.value, label: option.label ?? option.value },
				),
			};
		case "reference":
			return {
				...base,
				type: "reference",
				reference: field.reference
					? {
							source: field.reference.source,
							display: field.reference.display,
							match: field.reference.match ?? null,
							...(field.reference.copy?.length ? { copy: field.reference.copy } : {}),
						}
					: null,
			};
		case "lookup":
			return { ...base, type: "lookup", required: false, lookup: field.lookup ?? null };
		case "formula":
			return { ...base, type: field.format === "number" ? "number" : "money", required: false, formula: field.formula ?? null };
		default:
			return { ...base, type: field.type };
	}
}

function isNumericField(field: SpecField) {
	return field.type === "number" || field.type === "money" || field.type === "formula";
}

function valueToken(field: SpecField) {
	const filter =
		field.type === "money" || (field.type === "formula" && field.format !== "number") ? "|money"
		: field.type === "number" || field.type === "formula" ? "|number"
		: field.type === "date" ? "|date"
		: "";
	return `{{${field.key}${filter}}}`;
}

/**
 * Document layout. Mirrors the house style of the hand-written GEC purchase
 * order: issuer at the left and document number at the right, letter-spaced
 * section titles, "Label: value" lines, side-by-side half-width sections,
 * boxed notes, totals at the right. Every part carries data-k (same ids as
 * the builder) so the assistant preview can animate edits; the attribute is
 * inert in the PDF.
 */
const DOCUMENT_STYLE = `<style>
.dg-doc{--dg-accent:#1c1917;font-family:Arial,Helvetica,sans-serif;color:#1c1917;font-size:11px;line-height:1.45;padding:2.6em 2.8em 2.2em;background:#fff;box-sizing:border-box}
.dg-doc *{box-sizing:border-box;min-width:0}
.dg-doc p{margin:0}
.dg-eyebrow{margin:0 0 .6em;font-size:.72em;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:#a8a29e}
.dg-mono{font-family:"Courier New",Courier,monospace;font-variant-numeric:tabular-nums}
.dg-head{display:grid;grid-template-columns:minmax(0,1fr) minmax(11em,18em);gap:2em;align-items:start}
.dg-brand{display:flex;align-items:center;gap:.6em;margin-bottom:.6em}
.dg-dot{width:1.1em;height:1.1em;border-radius:999px;background:var(--dg-accent);flex:none}
.dg-brand-name{font-size:1.75em;font-weight:700}
.dg-company{font-size:.86em;line-height:1.6;color:#78716c}
.dg-title{font-size:1.75em;font-weight:700;margin:0;letter-spacing:-.01em}
.dg-sub{color:#78716c;font-size:.9em;margin-top:.3em}
.dg-dochead{text-align:right}
.dg-doctype{font-size:.78em;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#a8a29e}
.dg-docnum{margin-top:.2em;font-size:2em;line-height:1.05;font-weight:700;letter-spacing:-.03em}
.dg-docmeta{display:flex;justify-content:flex-end;gap:.6em;margin-top:.5em;font-size:.86em;color:#78716c}
.dg-docmeta span:last-child{color:#1c1917}
.dg-rule{height:1px;background:#e7e5e4;margin:1.7em 0 1.4em}
.dg-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.4em 2.4em;margin-bottom:1.4em}
.dg-sec{margin-bottom:1.4em}
.dg-cell>.dg-sec+.dg-sec{margin-top:1.4em}
.dg-cell>.dg-sec{margin-bottom:0}
.dg-box{border:1px solid #e7e5e4;border-radius:.3em;background:#fcfcfb;padding:1em}
.dg-lines{display:grid;gap:.15em 2.4em}
.dg-lines.two{grid-template-columns:repeat(2,minmax(0,1fr))}
.dg-line{display:flex;gap:.35em;align-items:baseline;font-size:.93em;line-height:1.55;color:#57534e}
.dg-line.full{grid-column:1/-1}
.dg-line strong{flex:none;color:#1c1917}
.dg-strong{font-size:.93em;line-height:1.55;color:#1c1917}
.dg-strong.full{grid-column:1/-1}
.dg-block{display:block;white-space:pre-wrap;font-size:.92em;line-height:1.6;color:#44403c;min-height:1.6em}
.dg-line .dg-block{display:inline}
.dg-t{width:100%;border-collapse:collapse}
.dg-t th{padding:0 .55em .8em;border-bottom:1px solid #1c1917;font-size:.68em;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#292524;text-align:left}
.dg-t td{padding:.75em .55em;border-bottom:1px solid #e7e5e4;vertical-align:top;font-size:.86em;color:#292524;overflow-wrap:anywhere}
.dg-t .n{text-align:right;white-space:nowrap}
.dg-t .em{font-weight:700;color:#1c1917}
.dg-tot{margin-left:auto;width:min(100%,20em)}
.dg-trow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:1em;padding:.33em 0;font-size:.86em;align-items:baseline}
.dg-trow>span:first-child{color:#78716c}
.dg-trow>span:last-child{text-align:right;white-space:nowrap}
.dg-trow.em>span{font-weight:700;color:#1c1917;font-size:1.08em}
.dg-trow.last{border-top:1px solid var(--dg-accent);margin-top:.4em;padding-top:.5em}
.dg-trow.last>span{font-weight:700;color:#1c1917;font-size:1.08em}
.dg-sigs{display:flex;flex-wrap:wrap;gap:2em 3em;margin-top:1.4em}
.dg-sigs>div{width:min(100%,15.7em)}
.dg-sig{padding-top:2.7em;border-bottom:1px solid #a8a29e}
.dg-sig-l{display:block;margin-top:.6em;font-size:.72em;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#a8a29e}
@media (max-width:640px){.dg-doc{padding:1.4em}.dg-head,.dg-row,.dg-lines.two{grid-template-columns:1fr}.dg-dochead{text-align:left}.dg-docmeta{justify-content:flex-start}}
</style>`;

function renderTextBody(body: string) {
	// Escape literal text but keep {{tokens}} so the renderer fills them.
	let html = "";
	let last = 0;
	for (const match of body.matchAll(TOKEN_PATTERN)) {
		html += escapeHtml(body.slice(last, match.index));
		html += match[0];
		last = (match.index ?? 0) + match[0].length;
	}
	return html + escapeHtml(body.slice(last));
}

const attr = (id: string) => ` data-k="${escapeHtml(id)}"`;

/** Stable identities of sections, shared by the builder and the rendered layout. */
export function specSectionIds(spec: TemplateSpec): string[] {
	const seen = new Map<string, number>();
	return spec.sections.map((section) => {
		const base =
			section.kind === "table" ? `table:${section.key}`
			: section.kind === "header" || section.kind === "signatures" ? section.kind
			: `${section.kind}:${("title" in section && section.title) || sectionFields(section)[0]?.key || ""}`;
		const count = seen.get(base) ?? 0;
		seen.set(base, count + 1);
		return count ? `${base}#${count}` : base;
	});
}

export function specFieldId(section: SpecSection, field: SpecField) {
	return section.kind === "table" ? `c:${section.key}.${field.key}` : `f:${field.key}`;
}

function fieldValue(field: SpecField, numberPrefix: string) {
	const prefix = field.auto === "sequence" && numberPrefix ? escapeHtml(numberPrefix) : "";
	const token = `${prefix}${valueToken(field)}`;
	return field.type === "textarea" ? `<span class="dg-block">${token}</span>` : token;
}

function renderFieldLine(section: SpecSection, field: SpecField, numberPrefix: string) {
	const id = attr(specFieldId(section, field));
	const full = field.width === "full" || field.type === "textarea" ? " full" : "";
	if (field.hideLabel) return `<div class="dg-strong${full}"${id}>${fieldValue(field, numberPrefix)}</div>`;
	return `<p class="dg-line${full}"${id}><strong>${escapeHtml(field.label)}:</strong><span>${fieldValue(field, numberPrefix)}</span></p>`;
}

function renderHeader(spec: TemplateSpec, section: Extract<SpecSection, { kind: "header" }>, id: string) {
	const prefix = spec.numberPrefix ?? "";
	const fields = headerFields(section);
	const numberField = fields.find((field) => field.auto === "sequence");
	const metaFields = fields.filter((field) => field !== numberField);
	const title = escapeHtml(section.title || spec.name);
	const issuerLines = (section.issuer ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
	const left = issuerLines.length
		? `<div${attr("h:issuer")}><div class="dg-brand"><span class="dg-dot"></span><span class="dg-brand-name">${escapeHtml(issuerLines[0])}</span></div>${issuerLines.length > 1 ? `<p class="dg-company">${issuerLines.slice(1).map(escapeHtml).join("<br>")}</p>` : ""}</div>`
		: `<div${attr("h:title")}><h1 class="dg-title">${title}</h1>${section.subtitle ? `<p class="dg-sub">${escapeHtml(section.subtitle)}</p>` : ""}</div>`;
	const right = [
		issuerLines.length ? `<p class="dg-doctype"${attr("h:title")}>${title}</p>` : "",
		numberField ? `<p class="dg-docnum dg-mono"${attr(specFieldId(section, numberField))}>${fieldValue(numberField, prefix)}</p>` : "",
		...metaFields.map((field) => `<p class="dg-docmeta"${attr(specFieldId(section, field))}><span>${escapeHtml(field.label)}</span><span class="dg-mono">${fieldValue(field, prefix)}</span></p>`),
		issuerLines.length && section.subtitle ? `<p class="dg-docmeta">${escapeHtml(section.subtitle)}</p>` : "",
	].join("");
	return `<header class="dg-head"${attr(id)}>${left}<div class="dg-dochead">${right}</div></header><div class="dg-rule"></div>`;
}

function renderSection(spec: TemplateSpec, section: SpecSection, id: string) {
	const prefix = spec.numberPrefix ?? "";
	const half = section.kind !== "header" && section.width === "half";
	const box = section.kind !== "header" && section.kind !== "signatures" && section.boxed ? " dg-box" : "";
	const title = (text?: string) => (text ? `<p class="dg-eyebrow">${escapeHtml(text)}</p>` : "");
	switch (section.kind) {
		case "header":
			return renderHeader(spec, section, id);
		case "fields": {
			const columns = !half && section.fields.length > 2 ? " two" : "";
			return `<section class="dg-sec${box}"${attr(id)}>${title(section.title)}<div class="dg-lines${columns}">${section.fields.map((field) => renderFieldLine(section, field, prefix)).join("")}</div></section>`;
		}
		case "table":
			return `<section class="dg-sec${box}"${attr(id)}>${title(section.title)}<table class="dg-t"><thead><tr>${section.columns
				.map((column) => `<th class="${isNumericField(column) ? "n" : ""}"${attr(specFieldId(section, column))}>${escapeHtml(column.label)}</th>`)
				.join("")}</tr></thead><tbody>{{#${section.key}}}<tr>${section.columns
				.map((column) => `<td class="${[isNumericField(column) ? "n dg-mono" : "", column.emphasis ? "em" : ""].filter(Boolean).join(" ")}">${valueToken(column)}</td>`)
				.join("")}</tr>{{/${section.key}}}</tbody></table></section>`;
		case "totals":
			return `<section class="dg-sec${box}"${attr(id)}>${title(section.title)}<div class="dg-tot">${section.fields
				.map((field, index) => {
					const last = index === section.fields.length - 1 && section.fields.length > 1;
					const classes = ["dg-trow", field.emphasis ? "em" : "", last ? "last" : ""].filter(Boolean).join(" ");
					return `<div class="${classes}"${attr(specFieldId(section, field))}><span>${escapeHtml(field.label)}</span><span class="dg-mono">${valueToken(field)}</span></div>`;
				})
				.join("")}</div></section>`;
		case "text":
			return `<section class="dg-sec${box}"${attr(id)}>${title(section.title)}<p class="dg-block">${renderTextBody(section.body)}</p></section>`;
		case "signatures":
			return `<section class="dg-sec"${attr(id)}><div class="dg-sigs">${section.labels
				.map((label, index) => `<div${attr(`sig:${index}`)}><div class="dg-sig"></div><span class="dg-sig-l">${escapeHtml(label)}</span></div>`)
				.join("")}</div></section>`;
	}
}

/**
 * Consecutive half-width sections pair up into rows. An unpaired one at the end
 * of a run stacks under the left cell of the previous row, like a signature
 * line under the notes while the totals fill the right column.
 */
function renderHalfRun(run: string[]) {
	const rows: Array<[string, string]> = [];
	for (let index = 0; index + 1 < run.length; index += 2) rows.push([run[index], run[index + 1]]);
	if (run.length % 2 === 1) {
		const leftover = run[run.length - 1];
		if (rows.length) rows[rows.length - 1][0] += leftover;
		else rows.push([leftover, ""]);
	}
	return rows.map(([left, right]) => `<div class="dg-row"><div class="dg-cell">${left}</div><div class="dg-cell">${right}</div></div>`).join("");
}

export function renderSpecHtml(spec: TemplateSpec) {
	const ids = specSectionIds(spec);
	const parts: string[] = [];
	let run: string[] = [];
	const flush = () => {
		if (run.length) parts.push(renderHalfRun(run));
		run = [];
	};
	spec.sections.forEach((section, index) => {
		const html = renderSection(spec, section, ids[index]);
		if (section.kind !== "header" && section.width === "half") {
			run.push(html);
		} else {
			flush();
			parts.push(html);
		}
	});
	flush();
	const accent = spec.style?.accent && ACCENT_PATTERN.test(spec.style.accent) ? spec.style.accent : null;
	return `${DOCUMENT_STYLE}<div class="dg-doc"${accent ? ` style="--dg-accent:${accent}"` : ""}>${parts.join("")}</div>`;
}

export type CompiledTemplateSpec = {
	name: string;
	description: string | null;
	documentType: string;
	targetFolderPath: string | null;
	schema: TemplateSchema;
	contentHtml: string;
};

/** Compiles a valid spec. Call validateTemplateSpec first. */
export function compileTemplateSpec(spec: TemplateSpec): CompiledTemplateSpec {
	const fields: TemplateField[] = [];
	for (const section of spec.sections) {
		if (section.kind === "table") {
			fields.push({
				key: section.key,
				label: section.title.trim(),
				type: "table",
				required: Boolean(section.required),
				source: "extra",
				columns: section.columns.map(compileField),
			});
			continue;
		}
		fields.push(...sectionFields(section).map(compileField));
	}
	const numberField = listSpecFields(spec).find((field) => field.auto === "sequence");
	const prefix = spec.numberPrefix ?? "";
	return {
		name: spec.name.trim(),
		description: spec.description?.trim() || null,
		documentType: normalizeDocumentType(spec.documentType) ?? spec.documentType,
		targetFolderPath: spec.targetFolderPath?.trim() || null,
		schema: {
			fields,
			documentNumberFieldKey: numberField?.key ?? null,
			fileNamePattern:
				spec.fileName?.trim() ||
				`${spec.name.trim()}${numberField ? ` ${prefix}{{${numberField.key}}}` : ""}`,
			spec: spec as unknown as Record<string, unknown>,
		},
		contentHtml: renderSpecHtml(spec),
	};
}

/**
 * Reads the spec stored with a template. Templates created before the spec
 * existed get an equivalent spec from their fields; saving it replaces their
 * HTML layout with the generated one.
 */
export function readTemplateSpec(template: {
	name: string;
	description?: string | null;
	documentType: string;
	targetFolderPath?: string | null;
	schema: TemplateSchema;
}): { spec: TemplateSpec; derived: boolean } {
	const stored = template.schema.spec;
	if (stored && stored.version === TEMPLATE_SPEC_VERSION && Array.isArray(stored.sections)) {
		return { spec: stored as unknown as TemplateSpec, derived: false };
	}
	const toSpecField = (field: TemplateField): SpecField => {
		const auto: SpecAuto | undefined =
			field.autoPopulate === "today" ? "today"
			: field.autoPopulate === "next_sequence_number" ? "sequence"
			: field.autoPopulate === "selected_context_label" ? "obra"
			: undefined;
		const common = { key: field.key, label: field.label, required: field.required || undefined, ...(auto ? { auto } : {}) };
		if (field.formula) return { ...common, type: "formula", formula: field.formula, format: field.type === "number" ? "number" : "money" };
		if (field.type === "select") {
			return {
				...common,
				type: "select",
				options: (field.options ?? []).map((option) => ({ value: option.value, label: option.label })),
				allowOther: field.selectMode === "creatable" || undefined,
				includeUsers: field.optionSource === "tenant_users" || undefined,
			};
		}
		if (field.type === "reference" && field.reference) {
			return { ...common, type: "reference", reference: { source: field.reference.source, display: field.reference.display, ...(field.reference.match ? { match: field.reference.match } : {}), ...(field.reference.copy ? { copy: field.reference.copy } : {}) } };
		}
		if (field.type === "lookup" && field.lookup) return { ...common, type: "lookup", lookup: field.lookup };
		const simple = ["text", "textarea", "number", "money", "date"].includes(field.type) ? (field.type as SpecFieldType) : "text";
		return { ...common, type: simple };
	};
	const plainFields = template.schema.fields.filter((field) => field.type !== "table" && !field.repeatableGroup);
	const sections: SpecSection[] = [{ kind: "header", fields: plainFields.filter((field) => field.autoPopulate === "next_sequence_number" || field.autoPopulate === "today").map(toSpecField) }];
	const rest = plainFields.filter((field) => field.autoPopulate !== "next_sequence_number" && field.autoPopulate !== "today");
	if (rest.length) sections.push({ kind: "fields", title: "Datos", fields: rest.map(toSpecField) });
	for (const table of template.schema.fields.filter((field) => field.type === "table")) {
		sections.push({ kind: "table", key: table.key, title: table.label, required: table.required || undefined, columns: (table.columns ?? []).map(toSpecField) });
	}
	const groups = new Map<string, TemplateField[]>();
	for (const field of template.schema.fields.filter((entry) => entry.repeatableGroup)) {
		groups.set(field.repeatableGroup as string, [...(groups.get(field.repeatableGroup as string) ?? []), field]);
	}
	for (const [key, columns] of groups) {
		sections.push({ kind: "table", key, title: columns[0].repeatableGroupLabel || key, columns: columns.map(toSpecField) });
	}
	return {
		spec: {
			version: 1,
			name: template.name,
			documentType: template.documentType,
			...(template.description ? { description: template.description } : {}),
			...(template.targetFolderPath ? { targetFolderPath: template.targetFolderPath } : {}),
			...(template.schema.fileNamePattern ? { fileName: template.schema.fileNamePattern } : {}),
			sections,
		},
		derived: true,
	};
}

/* ------------------------------------------------------------------ */
/* Guide for LLMs and integrations                                     */
/* ------------------------------------------------------------------ */

export const EXAMPLE_TEMPLATE_SPEC: TemplateSpec = {
	version: 1,
	name: "Recepción de materiales",
	documentType: "RECEPCION_MATERIALES",
	description: "Registra lo recibido en obra contra una orden de compra.",
	targetFolderPath: "compras/recepciones",
	numberPrefix: "REC-",
	fileName: "Recepción {{numero}} - {{workName}}",
	sections: [
		{ kind: "header", subtitle: "Constructora" },
		{
			kind: "fields",
			title: "Datos de la recepción",
			fields: [
				{
					key: "orden_compra",
					label: "Orden de compra",
					type: "reference",
					required: true,
					reference: {
						source: "documento:PURCHASE_ORDER",
						display: "label",
						copy: [
							{ from: "proveedor", to: "proveedor" },
							{ from: "items.descripcion", to: "items.descripcion" },
							{ from: "items.cantidad", to: "items.cantidad_pedida" },
							{ from: "items.precio_unitario", to: "items.precio_unitario" },
						],
					},
				},
				{ key: "obra", label: "Obra", type: "text", auto: "obra" },
				{ key: "proveedor", label: "Proveedor", type: "text" },
				{ key: "responsable", label: "Recibió", type: "reference", required: true, reference: { source: "usuarios", display: "nombre", match: "email" } },
				{ key: "responsable_email", label: "Email de quien recibió", type: "lookup", lookup: { from: "responsable", attribute: "email" } },
				{ key: "estado_carga", label: "Estado de la carga", type: "select", options: ["Completa", "Parcial", "Con daños"] },
			],
		},
		{
			kind: "table",
			key: "items",
			title: "Materiales recibidos",
			required: true,
			columns: [
				{ key: "descripcion", label: "Material", type: "text", required: true },
				{ key: "cantidad_pedida", label: "Pedida", type: "number" },
				{ key: "cantidad", label: "Recibida", type: "number", required: true },
				{ key: "precio_unitario", label: "Precio unit.", type: "money" },
				{ key: "precio_total", label: "Total", type: "formula", formula: "[cantidad] * [precio_unitario]" },
			],
		},
		{
			kind: "totals",
			fields: [
				{ key: "subtotal", label: "Subtotal", type: "formula", formula: "SUMA(items.precio_total)" },
				{ key: "iva", label: "IVA 21 %", type: "formula", formula: "REDONDEAR([subtotal] * 0.21; 2)" },
				{ key: "total", label: "Total", type: "formula", formula: "[subtotal] + [iva]" },
			],
		},
		{ kind: "signatures", labels: ["Recibió", "Entregó"] },
	],
};

export function buildTemplateSpecGuide(catalog: ReferenceSourceDescriptor[]) {
	return {
		format: "sintesis.template-spec",
		version: TEMPLATE_SPEC_VERSION,
		purpose:
			"Describe a document template as one JSON object. The same spec drives the visual builder, the PDF layout and the fill-in form.",
		steps: [
			"1. Read `sources` to know which app data a reference field can link to and which attributes each source exposes.",
			"2. Write a spec following `shape`. Keys are snake_case and unique in the document; table column keys are unique within their table.",
			"3. POST { spec } to /api/document-generation/spec to validate. Fix every error by its `path` and retry until ok is true. The response includes a preview HTML.",
			"4. POST { spec } to /api/document-generation/templates to create the template, or PUT { templateId, spec, publishVersion: true } to publish a new version of an existing one.",
		],
		shape: {
			spec: "{ version: 1, name, documentType, description?, targetFolderPath?, numberPrefix?, fileName?, style?: { accent?: \"#rrggbb\" }, sections: Section[] }",
			sections: {
				header: "{ kind: 'header', title?, subtitle?, issuer?, fields? } — without fields it adds numero (auto sequence) and fecha (auto today).",
				fields: "{ kind: 'fields', title?, fields: Field[] }",
				table: "{ kind: 'table', key, title, required?, columns: Field[] } — rows are added while filling the document.",
				totals: "{ kind: 'totals', title?, fields: Field[] } — usually formulas over table columns.",
				text: "{ kind: 'text', title?, body } — fixed text; may include {{field_key}}.",
				signatures: "{ kind: 'signatures', labels: string[] }",
			},
			field: "{ key, label, type, required?, description?, default?, auto?, options?, allowOther?, includeUsers?, reference?, lookup?, formula?, format?, width?: \"full\", hideLabel?, emphasis? }",
			sectionLayout: "Every section except header accepts width?: \"half\" and boxed?: boolean.",
			layout: [
				"Printed layout: header with the issuer at the left (header.issuer: first line is the company name, next lines address, tax id, phones; separate lines with \n) and at the right the document title in small caps, the auto sequence number in large type and the other header fields as small label + value.",
				"Without issuer the header shows title and subtitle at the left.",
				"Body sections print one under the other. Two consecutive sections with width: \"half\" share a row, side by side. boxed: true draws a light box (notes, observations).",
				"Section titles print in letter-spaced small caps. Fields print as lines \"Label: value\"; hideLabel: true prints only the value (use it for the main value of a block, like the provider name under PROVEEDOR ADJUDICADO). A full-width fields section with more than two fields uses two columns of lines; width: \"full\" on a field takes the whole row.",
				"Tables: emphasis: true on a column prints it bold (the description). Totals print at the right; the last row gets a rule above and bold type; emphasis: true makes another row bold (for example Total).",
				"Signatures print as a line with the label in small caps below. A signatures section with width half sits next to a totals section with width half.",
				"style.accent (#rrggbb) colors the issuer dot and the rule above the final total.",
			],
			fileName: "Uses {{field_key}} plus {{workName}}, {{templateName}} and {{numero}}.",
		},
		fieldTypes: {
			text: "Short text.",
			textarea: "Long text.",
			number: "Number.",
			money: "Amount, printed as $ 1.234,56.",
			date: "Date, stored as YYYY-MM-DD and printed as DD/MM/YYYY.",
			select: "Choice from options: string[] or {value,label}[]. allowOther: true lets users type a new value. includeUsers: true also offers the organization's users.",
			reference:
				"Links to records of a source: reference { source, display, match?, copy? }. display is the attribute shown; match is an alternative attribute users or imports can type to identify the record (for example email). copy (document fields only) copies attributes of the chosen record into this document when it is picked: { from: 'attribute' | 'rows_attribute.column', to: 'field_key' | 'table_key.column' }.",
			lookup: "Read-only value taken from the record chosen in a reference field of the same scope: lookup { from: reference_key, attribute }.",
			formula:
				"Calculated value: formula plus format 'money' (default) or 'number'. In a table column it sees the row's columns and document fields. In document fields, columns are only reachable through aggregates such as SUMA(table.column).",
		},
		auto: {
			sequence: "Next document number of this type in the obra (use once, usually key numero).",
			today: "Today's date.",
			obra: "Name of the selected obra.",
		},
		formulas: {
			syntax: "Fields in brackets: [cantidad] * [precio_unitario]. Decimal point or comma. Arguments separated by ';'.",
			functions: DOCUMENT_FORMULA_FUNCTIONS,
		},
		sources: catalog,
		example: EXAMPLE_TEMPLATE_SPEC,
	};
}

/** Example values used to preview a spec before any document exists. */
export function buildSpecSampleInput(spec: TemplateSpec): Record<string, unknown> {
	const sample = (field: SpecField, index: number): unknown => {
		if (field.default != null) return field.default;
		switch (field.type) {
			case "number": return 10 * (index + 1);
			case "money": return 1500 * (index + 1);
			case "date": return new Date().toISOString().slice(0, 10);
			case "select": {
				const option = field.options?.[0];
				return typeof option === "string" ? option : option?.value ?? "";
			}
			case "formula":
			case "lookup": return "";
			// Free text stays blank, like a printed form waiting to be filled.
			default: return field.auto === "sequence" ? "1" : field.auto === "obra" ? "Obra de ejemplo" : "";
		}
	};
	const data: Record<string, unknown> = {};
	listSpecFields(spec).forEach((field, index) => { data[field.key] = sample(field, index); });
	for (const table of listSpecTables(spec)) {
		const label = table.columns.find((column) => column.type === "text" || column.type === "textarea");
		data[table.key] = [0, 1].map((row) =>
			Object.fromEntries(table.columns.map((column) => [column.key, column === label ? `Ítem ${row + 1}` : sample(column, row)])),
		);
	}
	return data;
}
