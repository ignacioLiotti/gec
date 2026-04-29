import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type APIRequestContext } from "@playwright/test";

import { buildExcelObraName } from "./obras";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const TINY_PNG_DATA_URL =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sW7xS0AAAAASUVORK5CYII=";

export type LineageFixture = {
	obraId: string;
	obraName: string;
	tablaId: string;
	macroTableId: string;
	macroCustomColumnId: string;
	macroSourceColumnId: string;
};

export type OcrMultiLineageFixture = {
	obraId: string;
	obraName: string;
	tablaIds: string[];
};

export type SpreadsheetLineageFixture = {
	obraId: string;
	obraName: string;
	tablaId: string;
};

function getAdminClient() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!url || !serviceRoleKey) {
		throw new Error(
			"Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for lineage E2E helpers.",
		);
	}

	return createClient(url, serviceRoleKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	});
}

export function getLineageAdminClient(): SupabaseClient {
	return getAdminClient();
}

export async function createLineageFixture(
	_request: APIRequestContext,
	label: string,
): Promise<LineageFixture> {
	const obraName = buildExcelObraName(`Lineage ${label}`);
	const admin = getAdminClient();
	const slug = crypto.randomUUID().slice(0, 8);
	const obraN = crypto.randomInt(1_000_000, 9_999_999);

	const { error: tenantError } = await admin.from("tenants").upsert(
		{
			id: DEFAULT_TENANT_ID,
			name: "Default Tenant",
		},
		{ onConflict: "id" },
	);
	if (tenantError) {
		throw new Error(
			`Failed to ensure default tenant for lineage fixture: ${tenantError.message}`,
		);
	}

	const { data: obra, error: obraError } = await admin
		.from("obras")
		.insert({
			tenant_id: DEFAULT_TENANT_ID,
			n: obraN,
			designacion_y_ubicacion: obraName,
			sup_de_obra_m2: 100,
			entidad_contratante: "Tenant E2E",
			mes_basico_de_contrato: "01/01/2025",
			iniciacion: "15/01/2025",
			contrato_mas_ampliaciones: 1000,
			certificado_a_la_fecha: 0,
			saldo_a_certificar: 1000,
			segun_contrato: 12,
			prorrogas_acordadas: 0,
			plazo_total: 12,
			plazo_transc: 1,
			porcentaje: 10,
			custom_data: {},
		})
		.select("id")
		.single();
	if (obraError || !obra) {
		throw new Error(
			`Failed to create obra for lineage fixture: ${obraError?.message ?? "unknown"}`,
		);
	}

	const { data: tabla, error: tablaError } = await admin
		.from("obra_tablas")
		.insert({
			obra_id: obra.id,
			name: `[E2E][Lineage] OCR ${slug}`,
			source_type: "ocr",
			settings: {
				ocrFolder: `e2e-lineage-${slug}`,
			},
		})
		.select("id")
		.single();
	if (tablaError || !tabla) {
		throw new Error(`Failed to create OCR tabla: ${tablaError?.message ?? "unknown"}`);
	}

	const { error: columnsError } = await admin.from("obra_tabla_columns").insert([
		{
			tabla_id: tabla.id,
			field_key: "item_code",
			label: "Item Code",
			data_type: "text",
			position: 0,
			required: true,
			config: { lineageKey: true, ocrScope: "item" },
		},
		{
			tabla_id: tabla.id,
			field_key: "description",
			label: "Description",
			data_type: "text",
			position: 1,
			required: false,
			config: { ocrScope: "item" },
		},
		{
			tabla_id: tabla.id,
			field_key: "amount",
			label: "Amount",
			data_type: "number",
			position: 2,
			required: false,
			config: { ocrScope: "item" },
		},
	]);
	if (columnsError) {
		throw new Error(`Failed to create OCR columns: ${columnsError.message}`);
	}

	const { data: macroTable, error: macroTableError } = await admin
		.from("macro_tables")
		.insert({
			tenant_id: DEFAULT_TENANT_ID,
			name: `[E2E][Lineage] Macro ${slug}`,
			description: "Macro table for lineage E2E",
			settings: {},
		})
		.select("id")
		.single();
	if (macroTableError || !macroTable) {
		throw new Error(
			`Failed to create macro table: ${macroTableError?.message ?? "unknown"}`,
		);
	}

	const { error: sourceError } = await admin.from("macro_table_sources").insert({
		macro_table_id: macroTable.id,
		obra_tabla_id: tabla.id,
		position: 0,
	});
	if (sourceError) {
		throw new Error(`Failed to create macro source: ${sourceError.message}`);
	}

	const { data: macroColumns, error: macroColumnsError } = await admin
		.from("macro_table_columns")
		.insert([
			{
				macro_table_id: macroTable.id,
				column_type: "source",
				source_field_key: "item_code",
				label: "Codigo item",
				data_type: "text",
				position: 0,
				config: {},
			},
			{
				macro_table_id: macroTable.id,
				column_type: "custom",
				source_field_key: null,
				label: "Nota manual",
				data_type: "text",
				position: 1,
				config: {},
			},
		])
		.select("id, column_type");
	if (macroColumnsError || !macroColumns || macroColumns.length < 2) {
		throw new Error(
			`Failed to create macro columns: ${macroColumnsError?.message ?? "unknown"}`,
		);
	}

	const sourceColumn = macroColumns.find((column) => column.column_type === "source");
	const customColumn = macroColumns.find((column) => column.column_type === "custom");
	if (!sourceColumn || !customColumn) {
		throw new Error("Failed to resolve macro columns for lineage fixture.");
	}

	return {
		obraId: obra.id,
		obraName,
		tablaId: tabla.id,
		macroTableId: macroTable.id,
		macroCustomColumnId: customColumn.id as string,
		macroSourceColumnId: sourceColumn.id as string,
	};
}

export async function cleanupLineageFixture(fixture: LineageFixture) {
	const admin = getAdminClient();
	await admin.from("macro_tables").delete().eq("id", fixture.macroTableId);
	await admin.from("obras").delete().eq("id", fixture.obraId);
}

export async function cleanupSimpleFixture(
	fixture: OcrMultiLineageFixture | SpreadsheetLineageFixture,
) {
	const admin = getAdminClient();
	await admin.from("obras").delete().eq("id", fixture.obraId);
}

export async function importOcrStub(
	request: APIRequestContext,
	fixture: LineageFixture,
	args: {
		docKey: string;
		extraction: Record<string, unknown>;
		forceLineageConflict?: boolean;
	},
) {
	const response = await request.post(
		`/api/obras/${fixture.obraId}/tablas/${fixture.tablaId}/import/ocr?skipStorage=1`,
		{
			headers: {
				"x-e2e-ocr-stub": "true",
			},
			multipart: {
				imageDataUrl: TINY_PNG_DATA_URL,
				existingBucket: "obra-documents",
				existingPath: `${fixture.obraId}/e2e-lineage/${args.docKey}.png`,
				existingFileName: `${args.docKey}.png`,
				e2eExtractionJson: JSON.stringify(args.extraction),
				...(args.forceLineageConflict
					? { e2eForceLineageConflict: "true" }
					: {}),
			},
		},
	);

	return response;
}

export async function fetchTablaRows(
	request: APIRequestContext,
	fixture: LineageFixture,
) {
	const response = await request.get(
		`/api/obras/${fixture.obraId}/tablas/${fixture.tablaId}/rows`,
	);
	expect(response.ok()).toBeTruthy();
	const payload = (await response.json()) as {
		rows?: Array<Record<string, unknown>>;
	};
	return Array.isArray(payload.rows) ? payload.rows : [];
}

export async function fetchMacroRows(
	request: APIRequestContext,
	fixture: LineageFixture,
) {
	const response = await request.get(`/api/macro-tables/${fixture.macroTableId}/rows`);
	expect(response.ok()).toBeTruthy();
	return (await response.json()) as Record<string, unknown>;
}

export async function saveMacroOverride(
	request: APIRequestContext,
	fixture: LineageFixture,
	rowId: string,
	value: unknown,
) {
	return request.post(`/api/macro-tables/${fixture.macroTableId}/rows`, {
		data: {
			customValues: [
				{
					sourceRowId: rowId,
					columnId: fixture.macroCustomColumnId,
					value,
				},
			],
		},
	});
}

export async function createOcrMultiLineageFixture(
	_request: APIRequestContext,
	label: string,
): Promise<OcrMultiLineageFixture> {
	const obraName = buildExcelObraName(`Lineage Multi ${label}`);
	const admin = getAdminClient();
	const slug = crypto.randomUUID().slice(0, 8);
	const obraN = crypto.randomInt(1_000_000, 9_999_999);

	await admin.from("tenants").upsert(
		{
			id: DEFAULT_TENANT_ID,
			name: "Default Tenant",
		},
		{ onConflict: "id" },
	);

	const { data: obra, error: obraError } = await admin
		.from("obras")
		.insert({
			tenant_id: DEFAULT_TENANT_ID,
			n: obraN,
			designacion_y_ubicacion: obraName,
			sup_de_obra_m2: 100,
			entidad_contratante: "Tenant E2E",
			mes_basico_de_contrato: "01/01/2025",
			iniciacion: "15/01/2025",
			contrato_mas_ampliaciones: 1000,
			certificado_a_la_fecha: 0,
			saldo_a_certificar: 1000,
			segun_contrato: 12,
			prorrogas_acordadas: 0,
			plazo_total: 12,
			plazo_transc: 1,
			porcentaje: 10,
			custom_data: {},
		})
		.select("id")
		.single();
	if (obraError || !obra) {
		throw new Error(
			`Failed to create obra for OCR multi fixture: ${obraError?.message ?? "unknown"}`,
		);
	}

	const tablaIds: string[] = [];
	for (const suffix of ["A", "B"]) {
		const { data: tabla, error: tablaError } = await admin
			.from("obra_tablas")
			.insert({
				obra_id: obra.id,
				name: `[E2E][Lineage] OCR Multi ${suffix} ${slug}`,
				source_type: "ocr",
				settings: {
					ocrFolder: `e2e-lineage-multi-${slug}`,
				},
			})
			.select("id")
			.single();
		if (tablaError || !tabla) {
			throw new Error(
				`Failed to create OCR multi tabla: ${tablaError?.message ?? "unknown"}`,
			);
		}
		tablaIds.push(tabla.id);

		const { error: columnsError } = await admin.from("obra_tabla_columns").insert([
			{
				tabla_id: tabla.id,
				field_key: "item_code",
				label: "Item Code",
				data_type: "text",
				position: 0,
				required: true,
				config: { lineageKey: true, ocrScope: "item" },
			},
			{
				tabla_id: tabla.id,
				field_key: "description",
				label: "Description",
				data_type: "text",
				position: 1,
				required: false,
				config: { ocrScope: "item" },
			},
			{
				tabla_id: tabla.id,
				field_key: "amount",
				label: "Amount",
				data_type: "number",
				position: 2,
				required: false,
				config: { ocrScope: "item" },
			},
		]);
		if (columnsError) {
			throw new Error(`Failed to create OCR multi columns: ${columnsError.message}`);
		}
	}

	return {
		obraId: obra.id,
		obraName,
		tablaIds,
	};
}

export async function createSpreadsheetLineageFixture(
	_request: APIRequestContext,
	label: string,
): Promise<SpreadsheetLineageFixture> {
	const obraName = buildExcelObraName(`Lineage Sheet ${label}`);
	const admin = getAdminClient();
	const slug = crypto.randomUUID().slice(0, 8);
	const obraN = crypto.randomInt(1_000_000, 9_999_999);

	await admin.from("tenants").upsert(
		{
			id: DEFAULT_TENANT_ID,
			name: "Default Tenant",
		},
		{ onConflict: "id" },
	);

	const { data: obra, error: obraError } = await admin
		.from("obras")
		.insert({
			tenant_id: DEFAULT_TENANT_ID,
			n: obraN,
			designacion_y_ubicacion: obraName,
			sup_de_obra_m2: 100,
			entidad_contratante: "Tenant E2E",
			mes_basico_de_contrato: "01/01/2025",
			iniciacion: "15/01/2025",
			contrato_mas_ampliaciones: 1000,
			certificado_a_la_fecha: 0,
			saldo_a_certificar: 1000,
			segun_contrato: 12,
			prorrogas_acordadas: 0,
			plazo_total: 12,
			plazo_transc: 1,
			porcentaje: 10,
			custom_data: {},
		})
		.select("id")
		.single();
	if (obraError || !obra) {
		throw new Error(
			`Failed to create obra for spreadsheet fixture: ${obraError?.message ?? "unknown"}`,
		);
	}

	const { data: tabla, error: tablaError } = await admin
		.from("obra_tablas")
		.insert({
			obra_id: obra.id,
			name: `[E2E][Lineage] Spreadsheet ${slug}`,
			source_type: "ocr",
			settings: {
				ocrFolder: `e2e-lineage-sheet-${slug}`,
			},
		})
		.select("id")
		.single();
	if (tablaError || !tabla) {
		throw new Error(
			`Failed to create spreadsheet tabla: ${tablaError?.message ?? "unknown"}`,
		);
	}

	const { error: columnsError } = await admin.from("obra_tabla_columns").insert([
		{
			tabla_id: tabla.id,
			field_key: "cert_id",
			label: "Cert ID",
			data_type: "text",
			position: 0,
			required: true,
			config: { lineageKey: true, ocrScope: "item" },
		},
		{
			tabla_id: tabla.id,
			field_key: "description",
			label: "Description",
			data_type: "text",
			position: 1,
			required: false,
			config: { ocrScope: "item" },
		},
		{
			tabla_id: tabla.id,
			field_key: "amount",
			label: "Amount",
			data_type: "number",
			position: 2,
			required: false,
			config: { ocrScope: "item" },
		},
	]);
	if (columnsError) {
		throw new Error(`Failed to create spreadsheet columns: ${columnsError.message}`);
	}

	return {
		obraId: obra.id,
		obraName,
		tablaId: tabla.id,
	};
}

export async function importOcrMultiStub(
	request: APIRequestContext,
	fixture: OcrMultiLineageFixture,
	args: {
		docKey: string;
		extraction: Record<string, unknown>;
		forceLineageConflict?: boolean;
	},
) {
	return request.post(`/api/obras/${fixture.obraId}/tablas/import/ocr-multi?skipStorage=1`, {
		headers: {
			"x-e2e-ocr-stub": "true",
		},
		multipart: {
			tablaIds: JSON.stringify(fixture.tablaIds),
			imageDataUrl: TINY_PNG_DATA_URL,
			existingBucket: "obra-documents",
			existingPath: `${fixture.obraId}/e2e-lineage/${args.docKey}.png`,
			existingFileName: `${args.docKey}.png`,
			e2eExtractionJson: JSON.stringify(args.extraction),
			...(args.forceLineageConflict
				? { e2eForceLineageConflict: "true" }
				: {}),
		},
	});
}

export async function importSpreadsheetMultiCsv(
	request: APIRequestContext,
	fixture: SpreadsheetLineageFixture,
	args: {
		docKey: string;
		csv: string;
	},
) {
	return request.post(`/api/obras/${fixture.obraId}/tablas/import/spreadsheet-multi`, {
		multipart: {
			tablaIds: JSON.stringify([fixture.tablaId]),
			sheetAssignments: JSON.stringify({ [fixture.tablaId]: "CSV" }),
			columnMappings: JSON.stringify({
				[fixture.tablaId]: {
					cert_id: "cert_id",
					description: "description",
					amount: "amount",
				},
			}),
			manualValues: JSON.stringify({}),
			existingBucket: "obra-documents",
			existingPath: `${fixture.obraId}/e2e-lineage/${args.docKey}.csv`,
			existingFileName: `${args.docKey}.csv`,
			file: {
				name: `${args.docKey}.csv`,
				mimeType: "text/csv",
				buffer: Buffer.from(args.csv, "utf8"),
			},
		},
	});
}

export async function fetchLineageGraph(
	request: APIRequestContext,
	args: { obraId: string; tablaId: string; docPath?: string },
) {
	const search = new URLSearchParams({ tablaId: args.tablaId });
	if (args.docPath) search.set("docPath", args.docPath);
	const response = await request.get(`/api/obras/${args.obraId}/lineage-graph?${search.toString()}`);
	expect(response.ok()).toBeTruthy();
	return (await response.json()) as {
		nodes?: Array<Record<string, unknown>>;
		coverage?: { items?: Array<{ id?: string; status?: string }> };
		summary?: Record<string, unknown>;
	};
}
