import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const CERTIFICADO_SPREADSHEET_PRESETS = [
	{
		key: "pmc_resumen",
		name: "PMC Resumen",
		description:
			"Resumen mensual del certificado: periodo, monto, avance acumulado.",
		columns: [
			{
				field_key: "periodo",
				label: "Periodo",
				data_type: "text",
				position: 0,
				required: false,
				config: { excelKeywords: ["periodo", "mes", "month", "correspondiente"] },
			},
			{
				field_key: "nro_certificado",
				label: "N Certificado",
				data_type: "text",
				position: 1,
				required: false,
				config: { excelKeywords: ["nro", "numero", "certificado", "cert", "n"] },
			},
			{
				field_key: "fecha_certificacion",
				label: "Fecha Certificacion",
				data_type: "text",
				position: 2,
				required: false,
				config: { excelKeywords: ["fecha", "certificacion", "date"] },
			},
			{
				field_key: "monto_certificado",
				label: "Monto Certificado",
				data_type: "currency",
				position: 3,
				required: false,
				config: { excelKeywords: ["monto", "importe", "certificado"] },
			},
			{
				field_key: "avance_fisico_acumulado_pct",
				label: "Avance Fisico Acum. %",
				data_type: "number",
				position: 4,
				required: false,
				config: { excelKeywords: ["avance", "fisico", "acumulado", "%"] },
			},
			{
				field_key: "monto_acumulado",
				label: "Monto Acumulado",
				data_type: "currency",
				position: 5,
				required: false,
				config: { excelKeywords: ["monto", "acumulado", "total"] },
			},
			{
				field_key: "n_expediente",
				label: "N Expediente",
				data_type: "text",
				position: 6,
				required: false,
				config: { excelKeywords: ["expediente", "exp", "nro", "numero", "n"] },
			},
		],
	},
	{
		key: "pmc_items",
		name: "PMC Items",
		description:
			"Desglose por rubro/item del certificado con avances e importes.",
		columns: [
			{
				field_key: "item_code",
				label: "Codigo Item",
				data_type: "text",
				position: 0,
				required: false,
				config: { excelKeywords: ["item", "codigo", "cod", "rubro"] },
			},
			{
				field_key: "descripcion",
				label: "Descripcion",
				data_type: "text",
				position: 1,
				required: false,
				config: { excelKeywords: ["descripcion", "rubro", "concepto", "detalle"] },
			},
			{
				field_key: "incidencia_pct",
				label: "Incidencia %",
				data_type: "number",
				position: 2,
				required: false,
				config: { excelKeywords: ["incidencia", "%"] },
			},
			{
				field_key: "monto_rubro",
				label: "Monto Rubro",
				data_type: "currency",
				position: 3,
				required: false,
				config: { excelKeywords: ["total", "rubro", "monto"] },
			},
			{
				field_key: "avance_anterior_pct",
				label: "Avance Anterior %",
				data_type: "number",
				position: 4,
				required: false,
				config: { excelKeywords: ["anterior", "avance", "%"] },
			},
			{
				field_key: "avance_periodo_pct",
				label: "Avance Periodo %",
				data_type: "number",
				position: 5,
				required: false,
				config: { excelKeywords: ["presente", "periodo", "avance", "%"] },
			},
			{
				field_key: "avance_acumulado_pct",
				label: "Avance Acumulado %",
				data_type: "number",
				position: 6,
				required: false,
				config: { excelKeywords: ["acumulado", "avance", "%"] },
			},
			{
				field_key: "monto_anterior",
				label: "Monto Anterior $",
				data_type: "currency",
				position: 7,
				required: false,
				config: { excelKeywords: ["anterior", "cert", "importe"] },
			},
			{
				field_key: "monto_presente",
				label: "Monto Presente $",
				data_type: "currency",
				position: 8,
				required: false,
				config: { excelKeywords: ["presente", "cert", "importe"] },
			},
			{
				field_key: "monto_acumulado",
				label: "Monto Acumulado $",
				data_type: "currency",
				position: 9,
				required: false,
				config: { excelKeywords: ["total", "acumulado", "cert", "importe"] },
			},
		],
	},
	{
		key: "curva_plan",
		name: "Curva Plan",
		description: "Curva de inversiones con avance mensual y acumulado.",
		columns: [
			{
				field_key: "periodo",
				label: "Periodo",
				data_type: "text",
				position: 0,
				required: false,
				config: { excelKeywords: ["mes", "periodo", "month"] },
			},
			{
				field_key: "avance_mensual_pct",
				label: "Avance Mensual %",
				data_type: "number",
				position: 1,
				required: false,
				config: { excelKeywords: ["avance", "mensual", "%"] },
			},
			{
				field_key: "avance_acumulado_pct",
				label: "Avance Acumulado %",
				data_type: "number",
				position: 2,
				required: false,
				config: { excelKeywords: ["acumulado", "financiero", "%"] },
			},
		],
	},
];

function parseEnvFile(filePath) {
	if (!fs.existsSync(filePath)) return;
	const content = fs.readFileSync(filePath, "utf8");
	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		const separatorIndex = line.indexOf("=");
		if (separatorIndex === -1) continue;
		const key = line.slice(0, separatorIndex).trim();
		if (!key || process.env[key] !== undefined) continue;
		let value = line.slice(separatorIndex + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		process.env[key] = value;
	}
}

function loadEnvFiles() {
	const root = process.cwd();
	parseEnvFile(path.join(root, ".env.local"));
	parseEnvFile(path.join(root, ".env"));
}

function getVersionedSecret(baseKey) {
	const activeVersion = process.env[`${baseKey}_VERSION`];
	if (activeVersion) {
		return process.env[`${baseKey}_V${activeVersion}`];
	}
	return process.env[baseKey];
}

async function applyObraDefaults(supabase, obraId, tenantId) {
	const { data: defaultFolders, error: foldersError } = await supabase
		.from("obra_default_folders")
		.select("id, name, path, position")
		.eq("tenant_id", tenantId)
		.order("position", { ascending: true });

	if (foldersError) throw foldersError;

	const { data: defaultTablas, error: tablasError } = await supabase
		.from("obra_default_tablas")
		.select(
			"id, name, description, source_type, linked_folder_path, settings, position, ocr_template_id"
		)
		.eq("tenant_id", tenantId)
		.eq("source_type", "ocr")
		.order("position", { ascending: true });

	if (tablasError) {
		throw tablasError;
	}

	const defaultTablaIds = (defaultTablas ?? []).map((tabla) => tabla.id);
	const columnsByTabla = new Map();

	if (defaultTablaIds.length > 0) {
		const { data: defaultColumns, error: columnsError } = await supabase
			.from("obra_default_tabla_columns")
			.select(
				"id, default_tabla_id, field_key, label, data_type, position, required, config"
			)
			.in("default_tabla_id", defaultTablaIds)
			.order("position", { ascending: true });

		if (columnsError) {
			throw columnsError;
		}

		for (const column of defaultColumns ?? []) {
			const existing = columnsByTabla.get(column.default_tabla_id) ?? [];
			existing.push(column);
			columnsByTabla.set(column.default_tabla_id, existing);
		}
	}

	const tablaByFolderPath = new Map();
	for (const tabla of defaultTablas ?? []) {
		if (tabla.linked_folder_path) {
			tablaByFolderPath.set(tabla.linked_folder_path, tabla);
		}
	}

	let foldersApplied = 0;
	let tablasApplied = 0;

	for (const folder of defaultFolders ?? []) {
		const rawPath = typeof folder.path === "string" ? folder.path.trim() : "";
		if (!rawPath) continue;

		const keepPath = `${obraId}/${rawPath}/.keep`;
		const { error: uploadError } = await supabase.storage
			.from("obra-documents")
			.upload(keepPath, new Blob([""], { type: "text/plain" }), {
				upsert: true,
			});

		if (uploadError) {
			console.error(`[backfill] storage placeholder failed for ${keepPath}`, uploadError.message);
		} else {
			foldersApplied += 1;
		}

		const defaultTabla = tablaByFolderPath.get(rawPath);
		if (!defaultTabla) continue;

		const defaultSettings =
			defaultTabla.settings && typeof defaultTabla.settings === "object"
				? defaultTabla.settings
				: {};
		const spreadsheetTemplate =
			typeof defaultSettings.spreadsheetTemplate === "string"
				? defaultSettings.spreadsheetTemplate
				: "auto";

		if (spreadsheetTemplate === "certificado") {
			for (const preset of CERTIFICADO_SPREADSHEET_PRESETS) {
				const presetName = `${folder.name} · ${preset.name}`;
				const { data: existingPresetTabla, error: existingPresetError } = await supabase
					.from("obra_tablas")
					.select("id")
					.eq("obra_id", obraId)
					.eq("name", presetName)
					.maybeSingle();

				if (existingPresetError) throw existingPresetError;
				if (existingPresetTabla) continue;

				const presetSettings = {
					...defaultSettings,
					ocrFolder: rawPath,
					spreadsheetTemplate: "certificado",
					spreadsheetPresetKey: preset.key,
					defaultTablaId: defaultTabla.id,
				};
				if (defaultTabla.ocr_template_id) {
					presetSettings.ocrTemplateId = defaultTabla.ocr_template_id;
				}

				const { data: createdPresetTabla, error: presetTablaError } = await supabase
					.from("obra_tablas")
					.insert({
						obra_id: obraId,
						name: presetName,
						description: preset.description,
						source_type: defaultTabla.source_type,
						settings: presetSettings,
					})
					.select("id")
					.single();

				if (presetTablaError || !createdPresetTabla) {
					console.error(`[backfill] failed to create preset tabla ${presetName}`, presetTablaError?.message);
					continue;
				}

				const columnsPayload = preset.columns.map((column) => ({
					tabla_id: createdPresetTabla.id,
					field_key: column.field_key,
					label: column.label,
					data_type: column.data_type,
					position: column.position,
					required: column.required,
					config: column.config ?? {},
				}));
				const { error: insertPresetColumnsError } = await supabase
					.from("obra_tabla_columns")
					.insert(columnsPayload);

				if (insertPresetColumnsError) {
					console.error(
						`[backfill] failed to create preset columns for ${presetName}`,
						insertPresetColumnsError.message
					);
					continue;
				}

				tablasApplied += 1;
			}
			continue;
		}

		const { data: existingTabla, error: existingTablaError } = await supabase
			.from("obra_tablas")
			.select("id")
			.eq("obra_id", obraId)
			.eq("name", defaultTabla.name)
			.maybeSingle();

		if (existingTablaError) throw existingTablaError;
		if (existingTabla) continue;

		const settings = {
			...defaultSettings,
			ocrFolder: rawPath,
			defaultTablaId: defaultTabla.id,
			dataInputMethod: defaultSettings.dataInputMethod ?? "both",
		};
		if (defaultTabla.ocr_template_id) {
			settings.ocrTemplateId = defaultTabla.ocr_template_id;
		}

		const { data: createdTabla, error: createTablaError } = await supabase
			.from("obra_tablas")
			.insert({
				obra_id: obraId,
				name: defaultTabla.name,
				description: defaultTabla.description,
				source_type: defaultTabla.source_type,
				settings,
			})
			.select("id")
			.single();

		if (createTablaError || !createdTabla) {
			console.error(`[backfill] failed to create tabla ${defaultTabla.name}`, createTablaError?.message);
			continue;
		}

		const defaultColumns = columnsByTabla.get(defaultTabla.id) ?? [];
		if (defaultColumns.length > 0) {
			const columnsPayload = defaultColumns.map((column) => ({
				tabla_id: createdTabla.id,
				field_key: column.field_key,
				label: column.label,
				data_type: column.data_type,
				position: column.position,
				required: column.required,
				config: {
					...(column.config ?? {}),
					defaultColumnId: column.id,
				},
			}));

			const { error: insertColumnsError } = await supabase
				.from("obra_tabla_columns")
				.insert(columnsPayload);

			if (insertColumnsError) {
				console.error(
					`[backfill] failed to create columns for ${defaultTabla.name}`,
					insertColumnsError.message
				);
			}
		}

		tablasApplied += 1;
	}

	return { foldersApplied, tablasApplied };
}

async function main() {
	loadEnvFiles();

	const obraIds = process.argv.slice(2).map((value) => value.trim()).filter(Boolean);
	if (obraIds.length === 0) {
		console.error("Usage: node scripts/backfill-obra-defaults.mjs <obra-id> [obra-id...]");
		process.exitCode = 1;
		return;
	}

	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceRoleKey = getVersionedSecret("SUPABASE_SERVICE_ROLE_KEY");

	if (!url || !serviceRoleKey) {
		console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env.");
		process.exitCode = 1;
		return;
	}

	const supabase = createClient(url, serviceRoleKey, {
		auth: { persistSession: false, autoRefreshToken: false },
	});

	for (const obraId of obraIds) {
		console.log(`[backfill] processing obra ${obraId}`);

		const { data: obra, error: obraError } = await supabase
			.from("obras")
			.select("id, tenant_id, n, designacion_y_ubicacion")
			.eq("id", obraId)
			.maybeSingle();

		if (obraError) {
			console.error(`[backfill] failed to load obra ${obraId}: ${obraError.message}`);
			process.exitCode = 1;
			continue;
		}

		if (!obra?.tenant_id) {
			console.error(`[backfill] obra not found or missing tenant: ${obraId}`);
			process.exitCode = 1;
			continue;
		}

		const result = await applyObraDefaults(supabase, obra.id, obra.tenant_id);
		console.log(
			`[backfill] obra #${obra.n} "${obra.designacion_y_ubicacion}" -> folders=${result.foldersApplied}, tablas=${result.tablasApplied}`
		);
	}
}

main().catch((error) => {
	console.error("[backfill] fatal error", error);
	process.exitCode = 1;
});
