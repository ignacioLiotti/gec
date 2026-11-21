import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
	LineageFixture,
	OcrMultiLineageFixture,
	SpreadsheetLineageFixture,
} from "../helpers/lineage";
import type { FixtureManifest } from "./manifest";

type LineageFixtureController = {
	createSingle(label: string): Promise<LineageFixture>;
	createOcrMulti(label: string): Promise<OcrMultiLineageFixture>;
	createSpreadsheet(label: string): Promise<SpreadsheetLineageFixture>;
	injectLegacyConflict(
		fixture: LineageFixture,
		args: { lineageRowKey: string; value: unknown },
	): Promise<string>;
};

function obraPayload(id: string, tenantId: string, name: string) {
	return {
		id,
		tenant_id: tenantId,
		n: crypto.randomInt(1_000_000, 9_999_999),
		designacion_y_ubicacion: name,
		sup_de_obra_m2: 100,
		entidad_contratante: "Synthetic E2E",
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
	};
}

function ocrColumns(tablaId: string) {
	return [
		{
			id: crypto.randomUUID(),
			tabla_id: tablaId,
			field_key: "item_code",
			label: "Item Code",
			data_type: "text",
			position: 0,
			required: true,
			config: { lineageKey: true, ocrScope: "item" },
		},
		{
			id: crypto.randomUUID(),
			tabla_id: tablaId,
			field_key: "description",
			label: "Description",
			data_type: "text",
			position: 1,
			required: false,
			config: { ocrScope: "item" },
		},
		{
			id: crypto.randomUUID(),
			tabla_id: tablaId,
			field_key: "amount",
			label: "Amount",
			data_type: "number",
			position: 2,
			required: false,
			config: { ocrScope: "item" },
		},
	];
}

function spreadsheetColumns(tablaId: string) {
	return [
		{
			id: crypto.randomUUID(),
			tabla_id: tablaId,
			field_key: "cert_id",
			label: "Cert ID",
			data_type: "text",
			position: 0,
			required: true,
			config: { lineageKey: true, ocrScope: "item" },
		},
		{
			id: crypto.randomUUID(),
			tabla_id: tablaId,
			field_key: "description",
			label: "Description",
			data_type: "text",
			position: 1,
			required: false,
			config: { ocrScope: "item" },
		},
		{
			id: crypto.randomUUID(),
			tabla_id: tablaId,
			field_key: "amount",
			label: "Amount",
			data_type: "number",
			position: 2,
			required: false,
			config: { ocrScope: "item" },
		},
	];
}

function assertWrite(error: { message: string } | null, operation: string) {
	if (error) throw new Error(`${operation}: ${error.message}`);
}

export function createLineageFixtureController(params: {
	admin: SupabaseClient;
	tenantId: string;
	namespace: string;
	manifest: FixtureManifest;
}): LineageFixtureController {
	const { admin, tenantId, namespace, manifest } = params;

	async function createSingle(label: string): Promise<LineageFixture> {
		const slug = crypto.randomUUID().slice(0, 8);
		const obraId = crypto.randomUUID();
		const tablaId = crypto.randomUUID();
		const macroTableId = crypto.randomUUID();
		const macroSourceColumnId = crypto.randomUUID();
		const macroCustomColumnId = crypto.randomUUID();
		const obraName = `[E2E][${namespace}] Lineage ${label} ${slug}`;
		manifest.add("obra", obraId);
		manifest.add("tabla", tablaId);
		manifest.add("macro-table", macroTableId);

		assertWrite(
			(await admin.from("obras").insert(obraPayload(obraId, tenantId, obraName))).error,
			"Failed to create the lineage obra",
		);
		assertWrite(
			(
				await admin.from("obra_tablas").insert({
					id: tablaId,
					obra_id: obraId,
					name: `[E2E] OCR ${slug}`,
					source_type: "ocr",
					settings: { ocrFolder: `e2e-lineage-${slug}` },
				})
			).error,
			"Failed to create the lineage table",
		);
		const columns = ocrColumns(tablaId);
		columns.forEach((column) => manifest.add("tabla-column", column.id));
		assertWrite(
			(await admin.from("obra_tabla_columns").insert(columns)).error,
			"Failed to create lineage columns",
		);
		assertWrite(
			(
				await admin.from("macro_tables").insert({
					id: macroTableId,
					tenant_id: tenantId,
					name: `[E2E][${namespace}] Macro ${slug}`,
					description: "Synthetic lineage macro",
					settings: {},
				})
			).error,
			"Failed to create the lineage macro table",
		);
		const macroSourceId = crypto.randomUUID();
		manifest.add("macro-source", macroSourceId);
		assertWrite(
			(
				await admin.from("macro_table_sources").insert({
					id: macroSourceId,
					macro_table_id: macroTableId,
					obra_tabla_id: tablaId,
					position: 0,
				})
			).error,
			"Failed to create the lineage macro source",
		);
		manifest.add("macro-column", macroSourceColumnId);
		manifest.add("macro-column", macroCustomColumnId);
		assertWrite(
			(
				await admin.from("macro_table_columns").insert([
					{
						id: macroSourceColumnId,
						macro_table_id: macroTableId,
						column_type: "source",
						source_field_key: "item_code",
						label: "Codigo item",
						data_type: "text",
						position: 0,
						config: {},
					},
					{
						id: macroCustomColumnId,
						macro_table_id: macroTableId,
						column_type: "custom",
						source_field_key: null,
						label: "Nota manual",
						data_type: "text",
						position: 1,
						config: {},
					},
				])
			).error,
			"Failed to create lineage macro columns",
		);

		return {
			obraId,
			obraName,
			tablaId,
			macroTableId,
			macroCustomColumnId,
			macroSourceColumnId,
		};
	}

	async function createOcrMulti(label: string): Promise<OcrMultiLineageFixture> {
		const slug = crypto.randomUUID().slice(0, 8);
		const obraId = crypto.randomUUID();
		const tablaIds = [crypto.randomUUID(), crypto.randomUUID()];
		const obraName = `[E2E][${namespace}] Lineage Multi ${label} ${slug}`;
		manifest.add("obra", obraId);
		tablaIds.forEach((id) => manifest.add("tabla", id));

		assertWrite(
			(await admin.from("obras").insert(obraPayload(obraId, tenantId, obraName))).error,
			"Failed to create the OCR multi obra",
		);
		for (const [index, tablaId] of tablaIds.entries()) {
			assertWrite(
				(
					await admin.from("obra_tablas").insert({
						id: tablaId,
						obra_id: obraId,
						name: `[E2E] OCR Multi ${index + 1} ${slug}`,
						source_type: "ocr",
						settings: { ocrFolder: `e2e-lineage-multi-${slug}` },
					})
				).error,
				"Failed to create an OCR multi table",
			);
			const columns = ocrColumns(tablaId);
			columns.forEach((column) => manifest.add("tabla-column", column.id));
			assertWrite(
				(await admin.from("obra_tabla_columns").insert(columns)).error,
				"Failed to create OCR multi columns",
			);
		}

		return { obraId, obraName, tablaIds };
	}

	async function createSpreadsheet(label: string): Promise<SpreadsheetLineageFixture> {
		const slug = crypto.randomUUID().slice(0, 8);
		const obraId = crypto.randomUUID();
		const tablaId = crypto.randomUUID();
		const obraName = `[E2E][${namespace}] Lineage Sheet ${label} ${slug}`;
		manifest.add("obra", obraId);
		manifest.add("tabla", tablaId);

		assertWrite(
			(await admin.from("obras").insert(obraPayload(obraId, tenantId, obraName))).error,
			"Failed to create the spreadsheet lineage obra",
		);
		assertWrite(
			(
				await admin.from("obra_tablas").insert({
					id: tablaId,
					obra_id: obraId,
					name: `[E2E] Spreadsheet ${slug}`,
					source_type: "ocr",
					settings: { ocrFolder: `e2e-lineage-sheet-${slug}` },
				})
			).error,
			"Failed to create the spreadsheet lineage table",
		);
		const columns = spreadsheetColumns(tablaId);
		columns.forEach((column) => manifest.add("tabla-column", column.id));
		assertWrite(
			(await admin.from("obra_tabla_columns").insert(columns)).error,
			"Failed to create spreadsheet lineage columns",
		);

		return { obraId, obraName, tablaId };
	}

	async function injectLegacyConflict(
		fixture: LineageFixture,
		args: { lineageRowKey: string; value: unknown },
	) {
		const id = crypto.randomUUID();
		manifest.add("macro-value", id);
		const { error } = await admin.from("macro_table_custom_values").insert({
			id,
			macro_table_id: fixture.macroTableId,
			source_row_id: crypto.randomUUID(),
			source_tabla_id: fixture.tablaId,
			lineage_row_key: args.lineageRowKey,
			column_id: fixture.macroCustomColumnId,
			value: args.value,
			binding_status: "legacy",
			binding_error: null,
		});
		assertWrite(error, "Failed to inject a legacy lineage conflict");
		return id;
	}

	return { createSingle, createOcrMulti, createSpreadsheet, injectLegacyConflict };
}
