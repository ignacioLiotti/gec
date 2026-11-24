import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import {
	formatDocumentTypeLabel,
	type DocumentTemplateSummary,
	type ReferenceRecord,
} from "@/lib/document-generation";
import {
	assertWorkInTenant,
	loadActorsByIds,
	loadTemplateCatalog,
	type AccessContext,
} from "@/lib/document-generation-server";
import type { ReferenceSourceAttribute, ReferenceSourceDescriptor } from "@/lib/document-template-spec";

/**
 * Reference sources: the app data a template field can link to.
 *
 *   usuarios               members of the tenant
 *   obras                  obras of the tenant
 *   tabla:<slug>           rows of an obra tabla defined in the tenant defaults
 *   documento:<TYPE>       documents already generated in the obra
 *
 * The catalog describes sources and attributes (used by the builder, the
 * spec validator and LLMs). Records are loaded per obra while filling a
 * document. Reads go through the caller's Supabase client so row level
 * security applies, except tenant members, which reuse the existing
 * member lookup of document generation.
 */

const RECORD_LIMIT = 500;
const LINKABLE_DOCUMENT_STATUSES = ["GENERATED", "UNDER_REVIEW", "APPROVED"];

export function slugifySourceName(value: string) {
	return value
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");
}

function columnType(dataType: unknown): ReferenceSourceAttribute["type"] {
	if (dataType === "number" || dataType === "currency") return "number";
	if (dataType === "date") return "date";
	return "text";
}

function latestTemplatesByType(templates: DocumentTemplateSummary[]) {
	const latest = new Map<string, DocumentTemplateSummary>();
	for (const template of templates) {
		const current = latest.get(template.documentType);
		if (!current || template.version > current.version) latest.set(template.documentType, template);
	}
	return [...latest.values()];
}

function documentSource(template: DocumentTemplateSummary): ReferenceSourceDescriptor {
	const attributes: ReferenceSourceAttribute[] = [
		{ key: "label", label: "Documento", type: "text" },
		{ key: "estado", label: "Estado", type: "text" },
		{ key: "fecha_emision", label: "Fecha de emisión", type: "date" },
	];
	for (const field of template.schema.fields) {
		if (field.type === "table") {
			attributes.push({
				key: field.key,
				label: field.label,
				type: "rows",
				columns: (field.columns ?? []).map((column) => ({ key: column.key, label: column.label })),
			});
		} else if (!field.repeatableGroup && !attributes.some((attribute) => attribute.key === field.key)) {
			attributes.push({
				key: field.key,
				label: field.label,
				type: field.type === "number" || field.type === "money" ? "number" : field.type === "date" ? "date" : "text",
			});
		}
	}
	return {
		key: `documento:${template.documentType}`,
		label: template.name || formatDocumentTypeLabel(template.documentType),
		group: "documento",
		description: `Documentos de tipo ${formatDocumentTypeLabel(template.documentType)} ya generados en la obra.`,
		display: "label",
		requiresWork: true,
		attributes,
	};
}

export async function loadReferenceSourceCatalog(access: AccessContext): Promise<ReferenceSourceDescriptor[]> {
	const [tablasResult, templates] = await Promise.all([
		access.supabase
			.from("obra_default_tablas")
			.select("id, name, description, position")
			.eq("tenant_id", access.tenantId)
			.order("position", { ascending: true }),
		loadTemplateCatalog(access, { activeOnly: true }),
	]);
	if (tablasResult.error) throw tablasResult.error;
	const tablas = (tablasResult.data ?? []) as Array<{ id: string; name: string; description: string | null }>;

	const columnsByTabla = new Map<string, ReferenceSourceAttribute[]>();
	if (tablas.length > 0) {
		const { data: columns, error } = await access.supabase
			.from("obra_default_tabla_columns")
			.select("default_tabla_id, field_key, label, data_type, position")
			.in("default_tabla_id", tablas.map((tabla) => tabla.id))
			.order("position", { ascending: true });
		if (error) throw error;
		for (const column of columns ?? []) {
			const tablaId = String(column.default_tabla_id);
			columnsByTabla.set(tablaId, [
				...(columnsByTabla.get(tablaId) ?? []),
				{ key: String(column.field_key), label: String(column.label), type: columnType(column.data_type) },
			]);
		}
	}

	const sources: ReferenceSourceDescriptor[] = [
		{
			key: "usuarios",
			label: "Usuarios",
			group: "app",
			description: "Miembros de la organización.",
			display: "nombre",
			requiresWork: false,
			attributes: [
				{ key: "nombre", label: "Nombre", type: "text" },
				{ key: "email", label: "Email", type: "text" },
			],
		},
		{
			key: "obras",
			label: "Obras",
			group: "app",
			description: "Obras de la organización.",
			display: "nombre",
			requiresWork: false,
			attributes: [
				{ key: "nombre", label: "Nombre", type: "text" },
				{ key: "numero", label: "Número", type: "number" },
			],
		},
	];

	for (const tabla of tablas) {
		const attributes = columnsByTabla.get(tabla.id) ?? [];
		if (attributes.length === 0) continue;
		sources.push({
			key: `tabla:${slugifySourceName(tabla.name)}`,
			label: tabla.name,
			group: "tabla",
			description: tabla.description?.trim() || `Filas de la tabla "${tabla.name}" de la obra.`,
			display: attributes.find((attribute) => attribute.type === "text")?.key ?? attributes[0].key,
			requiresWork: true,
			attributes,
		});
	}

	for (const template of latestTemplatesByType(templates)) sources.push(documentSource(template));
	return sources;
}

async function loadUserRecords(access: AccessContext): Promise<ReferenceRecord[]> {
	const admin = createSupabaseAdminClient();
	const { data, error } = await admin.from("memberships").select("user_id").eq("tenant_id", access.tenantId);
	if (error) throw error;
	const userIds = [...new Set((data ?? []).map((row) => String(row.user_id)).filter(Boolean))];
	const actors = await loadActorsByIds(userIds);
	return userIds
		.map((userId) => actors[userId])
		.filter(Boolean)
		.map((actor) => ({
			id: actor.id,
			label: actor.label,
			values: { nombre: actor.fullName || actor.label, email: actor.email ?? "" },
		}))
		.sort((left, right) => left.label.localeCompare(right.label));
}

async function loadObraRecords(access: AccessContext): Promise<ReferenceRecord[]> {
	const { data, error } = await access.supabase
		.from("obras")
		.select("id, n, designacion_y_ubicacion")
		.eq("tenant_id", access.tenantId)
		.is("deleted_at", null)
		.order("n", { ascending: true })
		.limit(RECORD_LIMIT);
	if (error) throw error;
	return (data ?? []).map((obra) => ({
		id: String(obra.id),
		label: [obra.n != null ? String(obra.n) : "", obra.designacion_y_ubicacion ?? ""].filter(Boolean).join(" · "),
		values: { nombre: obra.designacion_y_ubicacion ?? "", numero: obra.n ?? null },
	}));
}

async function loadTablaRecords(access: AccessContext, workId: string, slug: string): Promise<ReferenceRecord[]> {
	const { data: tablas, error } = await access.supabase.from("obra_tablas").select("id, name").eq("obra_id", workId);
	if (error) throw error;
	const tabla = (tablas ?? []).find((entry) => slugifySourceName(String(entry.name)) === slug);
	if (!tabla) return [];
	const [columnsResult, rowsResult] = await Promise.all([
		access.supabase.from("obra_tabla_columns").select("field_key, data_type, position").eq("tabla_id", tabla.id).order("position", { ascending: true }),
		access.supabase.from("obra_tabla_rows").select("id, data, created_at").eq("tabla_id", tabla.id).order("created_at", { ascending: true }).limit(RECORD_LIMIT),
	]);
	if (columnsResult.error) throw columnsResult.error;
	if (rowsResult.error) throw rowsResult.error;
	const labelKey =
		(columnsResult.data ?? []).find((column) => columnType(column.data_type) === "text")?.field_key ??
		columnsResult.data?.[0]?.field_key;
	return (rowsResult.data ?? []).map((row, index) => {
		const values = row.data && typeof row.data === "object" && !Array.isArray(row.data) ? (row.data as Record<string, unknown>) : {};
		const label = labelKey ? String(values[labelKey] ?? "").trim() : "";
		return { id: String(row.id), label: label || `Fila ${index + 1}`, values };
	});
}

async function loadDocumentRecords(access: AccessContext, workId: string, documentType: string): Promise<ReferenceRecord[]> {
	const { data, error } = await access.supabase
		.from("generated_documents")
		.select("id, file_name, status, input_data, generated_at")
		.eq("tenant_id", access.tenantId)
		.eq("obra_id", workId)
		.eq("document_type", documentType)
		.in("status", LINKABLE_DOCUMENT_STATUSES)
		.order("generated_at", { ascending: false })
		.limit(RECORD_LIMIT);
	if (error) throw error;
	return (data ?? []).map((document) => {
		const inputData =
			document.input_data && typeof document.input_data === "object" && !Array.isArray(document.input_data)
				? (document.input_data as Record<string, unknown>)
				: {};
		const values = Object.fromEntries(Object.entries(inputData).filter(([key]) => !key.startsWith("__")));
		const label = String(document.file_name ?? "").replace(/\.pdf$/i, "") || String(document.id);
		return {
			id: String(document.id),
			label,
			values: {
				...values,
				label,
				estado: document.status,
				fecha_emision: typeof document.generated_at === "string" ? document.generated_at.slice(0, 10) : "",
			},
		};
	});
}

/**
 * Loads records of the requested sources. Obra-scoped sources return no
 * records without a workId. Unknown source keys are ignored.
 */
export async function loadReferenceRecords(
	access: AccessContext,
	params: { sources: string[]; workId?: string | null },
): Promise<Record<string, ReferenceRecord[]>> {
	const workId = params.workId?.trim() || null;
	const work = workId ? await assertWorkInTenant(access.supabase, access.tenantId, workId) : null;
	if (workId && !work) throw new Error("Obra no encontrada");

	const entries = await Promise.all(
		[...new Set(params.sources)].map(async (source): Promise<[string, ReferenceRecord[]] | null> => {
			if (source === "usuarios") return [source, await loadUserRecords(access)];
			if (source === "obras") return [source, await loadObraRecords(access)];
			if (source.startsWith("tabla:")) return [source, work ? await loadTablaRecords(access, work.id, source.slice(6)) : []];
			if (source.startsWith("documento:")) return [source, work ? await loadDocumentRecords(access, work.id, source.slice(10)) : []];
			return null;
		}),
	);
	return Object.fromEntries(entries.filter((entry): entry is [string, ReferenceRecord[]] => entry != null));
}
