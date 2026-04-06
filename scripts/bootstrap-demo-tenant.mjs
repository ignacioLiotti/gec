import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_OWNER_EMAIL = "ignacioliotti@gmail.com";
const DEFAULT_OWNER_NAME = "Ignacio Liotti";
const DEFAULT_OWNER_PASSWORD = "IgnacioDemo123!";
const DEFAULT_SOURCE_TENANT_NAME = "Codex Demo Tenant Smoke";
const DOCUMENTS_BUCKET = "obra-documents";

const BASE_MAIN_TABLE_COLUMNS = [
	{
		id: "n",
		label: "N",
		cellType: "text",
		width: 25,
		required: true,
		editable: false,
		enableHide: false,
		enablePin: true,
		enableSort: false,
		enableResize: false,
	},
	{
		id: "designacionYUbicacion",
		label: "Designacion y Ubicacion",
		cellType: "text",
		required: true,
		editable: true,
		enableHide: true,
		enablePin: true,
	},
	{
		id: "supDeObraM2",
		label: "Sup. de Obra (m2)",
		cellType: "text",
		enableHide: true,
		enablePin: false,
	},
	{
		id: "entidadContratante",
		label: "Entidad Contratante",
		cellType: "text",
		enableHide: true,
		enablePin: true,
	},
	{
		id: "mesBasicoDeContrato",
		label: "Mes Basico de Contrato",
		cellType: "text",
		enableHide: true,
		enablePin: false,
	},
	{
		id: "iniciacion",
		label: "Iniciacion",
		cellType: "text",
		enableHide: true,
		enablePin: false,
	},
	{
		id: "contratoMasAmpliaciones",
		label: "Contrato + Ampliaciones",
		cellType: "currency",
		enableHide: true,
		enablePin: false,
	},
	{
		id: "certificadoALaFecha",
		label: "Certificado a la Fecha",
		cellType: "currency",
		enableHide: true,
		enablePin: false,
		editable: false,
	},
	{
		id: "saldoACertificar",
		label: "Saldo a Certificar",
		cellType: "currency",
		enableHide: true,
		enablePin: false,
		editable: false,
	},
	{
		id: "segunContrato",
		label: "Segun Contrato",
		cellType: "text",
		enableHide: true,
		enablePin: false,
	},
	{
		id: "prorrogasAcordadas",
		label: "Prorrogas Acordadas",
		cellType: "text",
		enableHide: true,
		enablePin: false,
	},
	{
		id: "plazoTotal",
		label: "Plazo Total",
		cellType: "text",
		enableHide: true,
		enablePin: false,
	},
	{
		id: "plazoTransc",
		label: "Plazo Transcurrido",
		cellType: "text",
		enableHide: true,
		enablePin: false,
	},
	{
		id: "porcentaje",
		label: "% Avance",
		cellType: "badge",
		enableHide: true,
		enablePin: false,
	},
];

const DEMO_CUSTOM_COLUMNS = [
	{
		id: "project_manager",
		kind: "custom",
		label: "Project Manager",
		enabled: true,
		width: 180,
		cellType: "text",
		editable: true,
		enableHide: true,
		enablePin: false,
		enableSort: true,
		enableResize: true,
	},
	{
		id: "commercial_stage",
		kind: "custom",
		label: "Commercial Stage",
		enabled: true,
		width: 170,
		cellType: "text",
		editable: true,
		enableHide: true,
		enablePin: false,
		enableSort: true,
		enableResize: true,
	},
	{
		id: "forecast_close",
		kind: "custom",
		label: "Forecast Close",
		enabled: true,
		width: 150,
		cellType: "date",
		editable: true,
		enableHide: true,
		enablePin: false,
		enableSort: true,
		enableResize: true,
	},
];

const DEFAULT_FOLDERS = [
	{ name: "Certificados", path: "certificados", position: 0 },
	{ name: "Curva de Avance", path: "curva-de-avance", position: 1 },
	{ name: "Ordenes de Compra", path: "ordenes-de-compra", position: 2 },
	{ name: "Fotos de Obra", path: "fotos-de-obra", position: 3 },
];

const DEFAULT_TABLES = [
	{
		name: "Certificados Extraidos",
		description:
			"Tablas derivadas para certificados. Genera PMC Resumen, PMC Items y Curva Plan.",
		source_type: "ocr",
		linked_folder_path: "certificados",
		position: 0,
		settings: {
			dataInputMethod: "both",
			manualEntryEnabled: true,
			spreadsheetTemplate: "certificado",
			documentTypes: ["certificado", "certificado de obra"],
			extractionInstructions:
				"Usar este folder para certificados mensuales. La importacion debe fan-out a PMC Resumen y PMC Items.",
		},
		columns: [
			{ field_key: "periodo", label: "Periodo", data_type: "text", position: 0 },
			{
				field_key: "monto_certificado",
				label: "Monto Certificado",
				data_type: "currency",
				position: 1,
			},
			{
				field_key: "monto_acumulado",
				label: "Monto Acumulado",
				data_type: "currency",
				position: 2,
			},
		],
	},
	{
		name: "Curva de Avance Manual",
		description:
			"Tabla destino para la carga manual de la curva de avance desde Documentos.",
		source_type: "ocr",
		linked_folder_path: "curva-de-avance",
		position: 1,
		settings: {
			dataInputMethod: "both",
			manualEntryEnabled: true,
			spreadsheetTemplate: "auto",
			documentTypes: ["curva de avance", "curva plan"],
			extractionInstructions:
				"Usar este folder para la planilla de curva de avance. Debe actualizar una fila por periodo.",
		},
		columns: [
			{ field_key: "periodo", label: "Periodo", data_type: "text", position: 0 },
			{
				field_key: "avance_mensual_pct",
				label: "Avance Mensual %",
				data_type: "number",
				position: 1,
			},
			{
				field_key: "avance_acumulado_pct",
				label: "Avance Acumulado %",
				data_type: "number",
				position: 2,
			},
		],
	},
];

const CERTIFICADO_PRESETS = [
	{
		key: "pmc_resumen",
		name: "PMC Resumen",
		description:
			"Resumen mensual del certificado: periodo, monto, avance acumulado.",
		columns: [
			{ field_key: "periodo", label: "Periodo", data_type: "text", position: 0 },
			{
				field_key: "nro_certificado",
				label: "Nro Certificado",
				data_type: "text",
				position: 1,
			},
			{
				field_key: "fecha_certificacion",
				label: "Fecha Certificacion",
				data_type: "text",
				position: 2,
			},
			{
				field_key: "monto_certificado",
				label: "Monto Certificado",
				data_type: "currency",
				position: 3,
			},
			{
				field_key: "avance_fisico_acumulado_pct",
				label: "Avance Fisico Acumulado %",
				data_type: "number",
				position: 4,
			},
			{
				field_key: "monto_acumulado",
				label: "Monto Acumulado",
				data_type: "currency",
				position: 5,
			},
			{
				field_key: "n_expediente",
				label: "Nro Expediente",
				data_type: "text",
				position: 6,
			},
		],
	},
	{
		key: "pmc_items",
		name: "PMC Items",
		description:
			"Desglose por rubro/item del certificado con avances e importes.",
		columns: [
			{ field_key: "item_code", label: "Codigo Item", data_type: "text", position: 0 },
			{ field_key: "descripcion", label: "Descripcion", data_type: "text", position: 1 },
			{
				field_key: "incidencia_pct",
				label: "Incidencia %",
				data_type: "number",
				position: 2,
			},
			{
				field_key: "monto_rubro",
				label: "Monto Rubro",
				data_type: "currency",
				position: 3,
			},
			{
				field_key: "avance_anterior_pct",
				label: "Avance Anterior %",
				data_type: "number",
				position: 4,
			},
			{
				field_key: "avance_periodo_pct",
				label: "Avance Periodo %",
				data_type: "number",
				position: 5,
			},
			{
				field_key: "avance_acumulado_pct",
				label: "Avance Acumulado %",
				data_type: "number",
				position: 6,
			},
			{
				field_key: "monto_anterior",
				label: "Monto Anterior",
				data_type: "currency",
				position: 7,
			},
			{
				field_key: "monto_presente",
				label: "Monto Presente",
				data_type: "currency",
				position: 8,
			},
			{
				field_key: "monto_acumulado",
				label: "Monto Acumulado",
				data_type: "currency",
				position: 9,
			},
		],
	},
	{
		key: "curva_plan",
		name: "Curva Plan",
		description: "Curva de inversiones con avance mensual y acumulado.",
		columns: [
			{ field_key: "periodo", label: "Periodo", data_type: "text", position: 0 },
			{
				field_key: "avance_mensual_pct",
				label: "Avance Mensual %",
				data_type: "number",
				position: 1,
			},
			{
				field_key: "avance_acumulado_pct",
				label: "Avance Acumulado %",
				data_type: "number",
				position: 2,
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

function parseArgs(argv) {
	const args = {};
	for (let index = 0; index < argv.length; index += 1) {
		const current = argv[index];
		if (!current.startsWith("--")) continue;
		const key = current.slice(2);
		const next = argv[index + 1];
		if (!next || next.startsWith("--")) {
			args[key] = "true";
			continue;
		}
		args[key] = next;
		index += 1;
	}
	return args;
}

function pad(value) {
	return String(value).padStart(2, "0");
}

function formatTimestamp(date) {
	return [
		date.getFullYear(),
		pad(date.getMonth() + 1),
		pad(date.getDate()),
		"-",
		pad(date.getHours()),
		pad(date.getMinutes()),
		pad(date.getSeconds()),
		].join("");
}

function buildRunSpecificTenantName(baseName, date = new Date()) {
	const trimmed = String(baseName ?? "").trim() || "Demo";
	return `${trimmed} ${formatTimestamp(date)}`;
}

function slugify(value) {
	return String(value)
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-+/g, "-");
}

function getPeriodKey(date) {
	return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

function shiftUtcMonth(date, offset) {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
}

function toIsoDate(date) {
	return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function buildMainTableColumnsConfig() {
	return [
		...BASE_MAIN_TABLE_COLUMNS.map((column) => {
			const isContrato = column.id === "contratoMasAmpliaciones";
			const isCertificado = column.id === "certificadoALaFecha";
			const isSaldo = column.id === "saldoACertificar";
			const isFormula = isContrato || isCertificado || isSaldo;
			let formula;
			if (isContrato) formula = "[contratoMasAmpliaciones]";
			if (isCertificado) formula = "[contratoMasAmpliaciones] * ([porcentaje] / 100)";
			if (isSaldo) formula = "[contratoMasAmpliaciones] - [certificadoALaFecha]";
			return {
				id: column.id,
				kind: isFormula ? "formula" : "base",
				label: column.label,
				enabled: true,
				width: column.width,
				baseColumnId: column.id,
				formula,
				formulaFormat: column.cellType === "currency" ? "currency" : "number",
				cellType: column.cellType,
				required: column.required,
				editable: column.editable,
				enableHide: column.enableHide,
				enablePin: column.enablePin,
				enableSort: column.enableSort,
				enableResize: column.enableResize,
			};
		}),
		...DEMO_CUSTOM_COLUMNS,
	];
}

function buildDemoObras(now = new Date()) {
	const currentPeriod = getPeriodKey(now);
	const prevOne = getPeriodKey(shiftUtcMonth(now, -1));
	const prevTwo = getPeriodKey(shiftUtcMonth(now, -2));
	const prevThree = getPeriodKey(shiftUtcMonth(now, -3));
	const curveStart = "2025-12";
	const forecastOne = toIsoDate(shiftUtcMonth(now, 4));
	const forecastTwo = toIsoDate(shiftUtcMonth(now, 6));
	const forecastThree = toIsoDate(shiftUtcMonth(now, 3));

	return [
		{
			n: 101,
			designacion_y_ubicacion: "Hospital Municipal Norte",
			sup_de_obra_m2: 12850,
			entidad_contratante: "Municipalidad de Cordoba",
			mes_basico_de_contrato: prevThree,
			iniciacion: toIsoDate(shiftUtcMonth(now, -10)),
			contrato_mas_ampliaciones: 156500000,
			certificado_a_la_fecha: 0,
			saldo_a_certificar: 0,
			segun_contrato: 18,
			prorrogas_acordadas: 2,
			plazo_total: 20,
			plazo_transc: 11,
			porcentaje: 63.4,
			custom_data: {
				project_manager: DEFAULT_OWNER_NAME,
				commercial_stage: "Live Demo",
				forecast_close: forecastOne,
			},
			demoScenario: {
				currentPeriod,
				prevOne,
				prevTwo,
				curveStart,
			},
		},
		{
			n: 102,
			designacion_y_ubicacion: "Centro Logistico Ribera",
			sup_de_obra_m2: 9400,
			entidad_contratante: "Grupo Delta",
			mes_basico_de_contrato: prevTwo,
			iniciacion: toIsoDate(shiftUtcMonth(now, -7)),
			contrato_mas_ampliaciones: 89200000,
			certificado_a_la_fecha: 0,
			saldo_a_certificar: 0,
			segun_contrato: 14,
			prorrogas_acordadas: 1,
			plazo_total: 15,
			plazo_transc: 6,
			porcentaje: 37.2,
			custom_data: {
				project_manager: DEFAULT_OWNER_NAME,
				commercial_stage: "Qualification",
				forecast_close: forecastTwo,
			},
		},
		{
			n: 103,
			designacion_y_ubicacion: "Escuela Tecnica Sur",
			sup_de_obra_m2: 6800,
			entidad_contratante: "Ministerio de Educacion",
			mes_basico_de_contrato: prevOne,
			iniciacion: toIsoDate(shiftUtcMonth(now, -12)),
			contrato_mas_ampliaciones: 110400000,
			certificado_a_la_fecha: 0,
			saldo_a_certificar: 0,
			segun_contrato: 12,
			prorrogas_acordadas: 0,
			plazo_total: 12,
			plazo_transc: 10,
			porcentaje: 82.1,
			custom_data: {
				project_manager: DEFAULT_OWNER_NAME,
				commercial_stage: "Proposal Sent",
				forecast_close: forecastThree,
			},
		},
	];
}

function buildCertificadoCsv(periodKey, montoCertificado, montoAcumulado) {
	return [
		"periodo,nro_certificado,fecha_certificacion,monto_certificado,avance_fisico_acumulado_pct,monto_acumulado,n_expediente",
		`${periodKey},12,${periodKey}-28,${montoCertificado},63.4,${montoAcumulado},EXP-2026-014`,
	].join("\n");
}

function buildCurvaCsv() {
	return [
		"periodo,avance_mensual_pct,avance_acumulado_pct",
		"Mes 1,8,8",
		"Mes 2,11,19",
		"Mes 3,13,32",
		"Mes 4,14,46",
		"Mes 5,17.4,63.4",
	].join("\n");
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
	if (tablasError) throw tablasError;

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
		if (columnsError) throw columnsError;
		for (const column of defaultColumns ?? []) {
			const current = columnsByTabla.get(column.default_tabla_id) ?? [];
			current.push(column);
			columnsByTabla.set(column.default_tabla_id, current);
		}
	}

	const tablaByFolderPath = new Map();
	for (const tabla of defaultTablas ?? []) {
		if (tabla.linked_folder_path) {
			tablaByFolderPath.set(tabla.linked_folder_path, tabla);
		}
	}

	for (const folder of defaultFolders ?? []) {
		const folderPath = typeof folder.path === "string" ? folder.path.trim() : "";
		if (!folderPath) continue;
		await supabase.storage
			.from(DOCUMENTS_BUCKET)
			.upload(`${obraId}/${folderPath}/.keep`, new Blob([""], { type: "text/plain" }), {
				upsert: true,
			});

		const defaultTabla = tablaByFolderPath.get(folderPath);
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
			for (const preset of CERTIFICADO_PRESETS) {
				const tablaName = `${folder.name} - ${preset.name}`;
				const { data: existingPreset } = await supabase
					.from("obra_tablas")
					.select("id")
					.eq("obra_id", obraId)
					.eq("name", tablaName)
					.maybeSingle();
				if (existingPreset) continue;

				const { data: createdTabla, error: createTablaError } = await supabase
					.from("obra_tablas")
					.insert({
						obra_id: obraId,
						name: tablaName,
						description: preset.description,
						source_type: defaultTabla.source_type,
						settings: {
							...defaultSettings,
							ocrFolder: folderPath,
							spreadsheetTemplate: "certificado",
							spreadsheetPresetKey: preset.key,
							defaultTablaId: defaultTabla.id,
						},
					})
					.select("id")
					.single();
				if (createTablaError || !createdTabla) throw createTablaError;

				const { error: presetColumnsError } = await supabase
					.from("obra_tabla_columns")
					.insert(
						preset.columns.map((column) => ({
							tabla_id: createdTabla.id,
							field_key: column.field_key,
							label: column.label,
							data_type: column.data_type,
							position: column.position,
							required: false,
							config: {},
						}))
					);
				if (presetColumnsError) throw presetColumnsError;
			}
			continue;
		}

		const { data: existingTabla } = await supabase
			.from("obra_tablas")
			.select("id")
			.eq("obra_id", obraId)
			.eq("name", defaultTabla.name)
			.maybeSingle();
		if (existingTabla) continue;

		const { data: createdTabla, error: createTablaError } = await supabase
			.from("obra_tablas")
			.insert({
				obra_id: obraId,
				name: defaultTabla.name,
				description: defaultTabla.description,
				source_type: defaultTabla.source_type,
				settings: {
					...defaultSettings,
					ocrFolder: folderPath,
					defaultTablaId: defaultTabla.id,
					dataInputMethod: defaultSettings.dataInputMethod ?? "both",
				},
			})
			.select("id")
			.single();
		if (createTablaError || !createdTabla) throw createTablaError;

		const defaultColumns = columnsByTabla.get(defaultTabla.id) ?? [];
		if (defaultColumns.length > 0) {
			const { error: insertColumnsError } = await supabase
				.from("obra_tabla_columns")
				.insert(
					defaultColumns.map((column) => ({
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
					}))
				);
			if (insertColumnsError) throw insertColumnsError;
		}
	}
}

async function listAllUsers(adminClient) {
	const users = [];
	let page = 1;
	while (true) {
		const { data, error } = await adminClient.auth.admin.listUsers({
			page,
			perPage: 200,
		});
		if (error) throw error;
		users.push(...(data.users ?? []));
		if ((data.users ?? []).length < 200) break;
		page += 1;
	}
	return users;
}

async function ensureOwnerUser(adminClient, { email, password, fullName }) {
	const users = await listAllUsers(adminClient);
	const existing = users.find(
		(user) => user.email?.toLowerCase() === email.toLowerCase()
	);
	if (existing) {
		const { error } = await adminClient.auth.admin.updateUserById(existing.id, {
			email_confirm: true,
			user_metadata: {
				...(existing.user_metadata ?? {}),
				full_name: fullName,
				display_name: fullName,
			},
		});
		if (error) throw error;
		return existing.id;
	}

	const { data, error } = await adminClient.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		user_metadata: {
			full_name: fullName,
			display_name: fullName,
		},
	});
	if (error || !data.user) throw error ?? new Error("Failed to create owner user");
	return data.user.id;
}

async function ensureProfile(adminClient, userId, fullName) {
	const { error } = await adminClient.from("profiles").upsert(
		{
			user_id: userId,
			full_name: fullName,
		},
		{ onConflict: "user_id" }
	);
	if (error) throw error;
}

async function resolveUniqueTenantName(adminClient, requestedName) {
	const baseName = requestedName.trim();
	let candidate = baseName;
	let attempt = 1;
	for (;;) {
		const { data, error } = await adminClient
			.from("tenants")
			.select("id")
			.eq("name", candidate)
			.maybeSingle();
		if (error) throw error;
		if (!data) return candidate;
		attempt += 1;
		candidate = `${baseName} (${attempt})`;
	}
}

async function assertTenantNameAvailable(adminClient, requestedName) {
	const candidate = requestedName.trim();
	const { data, error } = await adminClient
		.from("tenants")
		.select("id")
		.eq("name", candidate)
		.maybeSingle();
	if (error) throw error;
	if (data) {
		throw new Error(
			`Tenant name "${candidate}" already exists. Choose a different --tenant value.`
		);
	}
	return candidate;
}

async function createTenant(adminClient, name) {
	const { data, error } = await adminClient
		.from("tenants")
		.insert({ name })
		.select("id, name")
		.single();
	if (error || !data) throw error ?? new Error("Failed to create tenant");
	return data;
}

async function ensureMembership(adminClient, tenantId, userId) {
	const { error } = await adminClient.from("memberships").upsert(
		{
			tenant_id: tenantId,
			user_id: userId,
			role: "owner",
		},
		{ onConflict: "tenant_id,user_id" }
	);
	if (error) throw error;
}

async function seedRoles(adminClient, tenantId, ownerUserId) {
	const { data: permissions, error: permissionsError } = await adminClient
		.from("permissions")
		.select("id, key")
		.order("sort_order", { ascending: true });
	if (permissionsError) throw permissionsError;
	const permissionIdByKey = new Map(
		(permissions ?? []).map((row) => [row.key, row.id])
	);

	const createdRoleIds = [];

	const { data: demoAdminRole, error: demoAdminError } = await adminClient
		.from("roles")
		.insert({
			tenant_id: tenantId,
			key: null,
			name: "Demo Admin",
			description: "Tenant-scoped all-access role for demo environments.",
			color: "#0f766e",
			is_default: false,
		})
		.select("id")
		.single();
	if (demoAdminError || !demoAdminRole) throw demoAdminError;
	createdRoleIds.push(demoAdminRole.id);

	if ((permissions ?? []).length > 0) {
		const { error: demoRolePermissionsError } = await adminClient
			.from("role_permissions")
			.insert(
				permissions.map((permission) => ({
					role_id: demoAdminRole.id,
					permission_id: permission.id,
				}))
			);
		if (demoRolePermissionsError) throw demoRolePermissionsError;
	}

	const { data: templates, error: templatesError } = await adminClient
		.from("role_templates")
		.select("name, description, permissions")
		.order("name", { ascending: true });
	if (!templatesError) {
		for (const template of templates ?? []) {
			const { data: role, error: roleError } = await adminClient
				.from("roles")
				.insert({
					tenant_id: tenantId,
					key: null,
					name: template.name,
					description: template.description,
					color: "#334155",
					is_default: false,
				})
				.select("id")
				.single();
			if (roleError || !role) throw roleError;
			createdRoleIds.push(role.id);

			const permissionKeys = Array.isArray(template.permissions)
				? template.permissions
				: [];
			const rolePermissions = permissionKeys
				.map((key) => permissionIdByKey.get(String(key)))
				.filter(Boolean)
				.map((permissionId) => ({
					role_id: role.id,
					permission_id: permissionId,
				}));
			if (rolePermissions.length > 0) {
				const { error: rolePermissionsError } = await adminClient
					.from("role_permissions")
					.insert(rolePermissions);
				if (rolePermissionsError) throw rolePermissionsError;
			}
		}
	}

	if (createdRoleIds.length > 0) {
		const { error: assignRolesError } = await adminClient.from("user_roles").insert(
			createdRoleIds.map((roleId) => ({
				user_id: ownerUserId,
				role_id: roleId,
			}))
		);
		if (assignRolesError) throw assignRolesError;
	}
}

async function seedMainTableConfig(adminClient, tenantId, ownerUserId) {
	const { error } = await adminClient.from("tenant_main_table_configs").upsert(
		{
			tenant_id: tenantId,
			columns: buildMainTableColumnsConfig(),
			updated_by: ownerUserId,
		},
		{ onConflict: "tenant_id" }
	);
	if (error) throw error;
}

async function seedDefaultFoldersAndTables(adminClient, tenantId) {
	const { error: foldersError } = await adminClient
		.from("obra_default_folders")
		.insert(
			DEFAULT_FOLDERS.map((folder) => ({
				tenant_id: tenantId,
				name: folder.name,
				path: folder.path,
				position: folder.position,
			}))
		);
	if (foldersError) throw foldersError;

	const { data: createdTables, error: tablesError } = await adminClient
		.from("obra_default_tablas")
		.insert(
			DEFAULT_TABLES.map((table) => ({
				tenant_id: tenantId,
				name: table.name,
				description: table.description,
				source_type: table.source_type,
				linked_folder_path: table.linked_folder_path,
				settings: table.settings,
				position: table.position,
			}))
		)
		.select("id, name");
	if (tablesError) throw tablesError;

	const defaultTableIdByName = new Map(
		(createdTables ?? []).map((row) => [row.name, row.id])
	);
	const allColumns = [];
	for (const table of DEFAULT_TABLES) {
		const defaultTableId = defaultTableIdByName.get(table.name);
		if (!defaultTableId) continue;
		for (const column of table.columns) {
			allColumns.push({
				default_tabla_id: defaultTableId,
				field_key: column.field_key,
				label: column.label,
				data_type: column.data_type,
				position: column.position,
				required: false,
				config: {},
			});
		}
	}
	if (allColumns.length > 0) {
		const { error: columnsError } = await adminClient
			.from("obra_default_tabla_columns")
			.insert(allColumns);
		if (columnsError) throw columnsError;
	}
}

async function createObra(adminClient, tenantId, obraSeed) {
	const { demoScenario, ...obraPayload } = obraSeed;
	const { data, error } = await adminClient
		.from("obras")
		.insert({
			tenant_id: tenantId,
			...obraPayload,
		})
		.select("id, n, designacion_y_ubicacion")
		.single();
	if (error || !data) throw error ?? new Error("Failed to create obra");
	return data;
}

async function loadObraTables(adminClient, obraId) {
	const { data, error } = await adminClient
		.from("obra_tablas")
		.select("id, name, settings")
		.eq("obra_id", obraId)
		.order("created_at", { ascending: true });
	if (error) throw error;
	return data ?? [];
}

async function uploadTrackedTextFile(adminClient, {
	ownerUserId,
	obraId,
	folderPath,
	fileName,
	content,
	contentType = "text/plain",
}) {
	const storagePath = `${obraId}/${folderPath}/${fileName}`;
	const { error: uploadError } = await adminClient.storage
		.from(DOCUMENTS_BUCKET)
		.upload(storagePath, new Blob([content], { type: contentType }), {
			upsert: true,
		});
	if (uploadError) throw uploadError;

	const { error: trackingError } = await adminClient.from("obra_document_uploads").upsert(
		{
			obra_id: obraId,
			storage_bucket: DOCUMENTS_BUCKET,
			storage_path: storagePath,
			file_name: fileName,
			uploaded_by: ownerUserId,
		},
		{ onConflict: "storage_path" }
	);
	if (trackingError) throw trackingError;
	return storagePath;
}

async function insertRows(adminClient, tablaId, rows, source = "seed") {
	if (!rows.length) return;
	const { error } = await adminClient.from("obra_tabla_rows").insert(
		rows.map((row) => ({
			tabla_id: tablaId,
			data: row,
			source,
		}))
	);
	if (error) throw error;
}

async function seedScenarioData(adminClient, {
	tenantId,
	ownerUserId,
	obraId,
	obraSeed,
}) {
	const scenario = obraSeed.demoScenario;
	if (!scenario) return null;

	const obraTables = await loadObraTables(adminClient, obraId);
	const pmcResumen = obraTables.find(
		(tabla) => tabla.settings?.spreadsheetPresetKey === "pmc_resumen"
	);
	const pmcItems = obraTables.find(
		(tabla) => tabla.settings?.spreadsheetPresetKey === "pmc_items"
	);
	const curvaManual = obraTables.find(
		(tabla) => tabla.settings?.ocrFolder === "curva-de-avance"
	);
	if (!pmcResumen || !pmcItems || !curvaManual) {
		throw new Error("Failed to resolve seeded tabla references for the demo obra.");
	}

	const olderCertPath = await uploadTrackedTextFile(adminClient, {
		ownerUserId,
		obraId,
		folderPath: "certificados",
		fileName: `certificado-${scenario.prevOne}.csv`,
		content: buildCertificadoCsv(scenario.prevOne, 22100000, 99210000),
		contentType: "text/csv",
	});
	const olderCurvePath = await uploadTrackedTextFile(adminClient, {
		ownerUserId,
		obraId,
		folderPath: "curva-de-avance",
		fileName: `curva-de-avance-${scenario.prevOne}.csv`,
		content: buildCurvaCsv(),
		contentType: "text/csv",
	});

	await uploadTrackedTextFile(adminClient, {
		ownerUserId,
		obraId,
		folderPath: "ordenes-de-compra",
		fileName: "orden-compra-demo-001.txt",
		content: [
			"Orden de compra demo",
			"Proveedor: Hormigones del Norte",
			"Solicitante: Oficina Tecnica",
			"Items: Hormigon H21, Hierro ADN 420",
		].join("\n"),
	});
	await uploadTrackedTextFile(adminClient, {
		ownerUserId,
		obraId,
		folderPath: "fotos-de-obra",
		fileName: "avance-frente-norte.txt",
		content: [
			"Foto de obra demo",
			"Frente norte - avance estructural",
			"Uso: dejar evidencia visual para la demo",
		].join("\n"),
	});

	await insertRows(adminClient, pmcResumen.id, [
		{
			periodo: scenario.prevTwo,
			nro_certificado: "11",
			fecha_certificacion: `${scenario.prevTwo}-27`,
			monto_certificado: 18650000,
			avance_fisico_acumulado_pct: 49.8,
			monto_acumulado: 77110000,
			n_expediente: "EXP-2026-014",
			__docPath: olderCertPath,
			__docFileName: `certificado-${scenario.prevOne}.csv`,
		},
		{
			periodo: scenario.prevOne,
			nro_certificado: "12",
			fecha_certificacion: `${scenario.prevOne}-28`,
			monto_certificado: 22100000,
			avance_fisico_acumulado_pct: 63.4,
			monto_acumulado: 99210000,
			n_expediente: "EXP-2026-014",
			__docPath: olderCertPath,
			__docFileName: `certificado-${scenario.prevOne}.csv`,
		},
	]);

	await insertRows(adminClient, pmcItems.id, [
		{
			item_code: "01.01",
			descripcion: "Movimiento de suelo",
			incidencia_pct: 18.4,
			monto_rubro: 28800000,
			avance_anterior_pct: 68,
			avance_periodo_pct: 7,
			avance_acumulado_pct: 75,
			monto_anterior: 23500000,
			monto_presente: 5300000,
			monto_acumulado: 28800000,
			__docPath: olderCertPath,
			__docFileName: `certificado-${scenario.prevOne}.csv`,
		},
		{
			item_code: "03.02",
			descripcion: "Estructura de hormigon",
			incidencia_pct: 42.7,
			monto_rubro: 66800000,
			avance_anterior_pct: 54,
			avance_periodo_pct: 9.4,
			avance_acumulado_pct: 63.4,
			monto_anterior: 56900000,
			monto_presente: 9900000,
			monto_acumulado: 66800000,
			__docPath: olderCertPath,
			__docFileName: `certificado-${scenario.prevOne}.csv`,
		},
	]);

	await insertRows(adminClient, curvaManual.id, [
		{
			periodo: "Mes 1",
			avance_mensual_pct: 8,
			avance_acumulado_pct: 8,
			__docPath: olderCurvePath,
			__docFileName: `curva-de-avance-${scenario.prevOne}.csv`,
		},
		{
			periodo: "Mes 2",
			avance_mensual_pct: 11,
			avance_acumulado_pct: 19,
			__docPath: olderCurvePath,
			__docFileName: `curva-de-avance-${scenario.prevOne}.csv`,
		},
		{
			periodo: "Mes 3",
			avance_mensual_pct: 13,
			avance_acumulado_pct: 32,
			__docPath: olderCurvePath,
			__docFileName: `curva-de-avance-${scenario.prevOne}.csv`,
		},
		{
			periodo: "Mes 4",
			avance_mensual_pct: 14,
			avance_acumulado_pct: 46,
			__docPath: olderCurvePath,
			__docFileName: `curva-de-avance-${scenario.prevOne}.csv`,
		},
		{
			periodo: "Mes 5",
			avance_mensual_pct: 17.4,
			avance_acumulado_pct: 63.4,
			__docPath: olderCurvePath,
			__docFileName: `curva-de-avance-${scenario.prevOne}.csv`,
		},
	]);

	const { error: ruleConfigError } = await adminClient
		.from("obra_rule_config")
		.upsert({
			tenant_id: tenantId,
			obra_id: obraId,
			config_json: {
				enabledPacks: {
					curve: true,
					unpaidCerts: false,
					inactivity: false,
					monthlyMissingCert: true,
					stageStalled: false,
				},
				mappings: {
					curve: {
						planTableId: curvaManual.id,
						resumenTableId: pmcResumen.id,
						actualPctColumnKey: "avance_fisico_acumulado_pct",
						plan: {
							startPeriod: scenario.curveStart,
						},
					},
					monthlyMissingCert: {
						certTableId: pmcResumen.id,
						certIssuedAtColumnKey: "fecha_certificacion",
					},
				},
				thresholds: {
					curve: { warnBelow: 10, criticalBelow: 20 },
					unpaidCerts: { severity: "warn" },
					inactivity: { severity: "warn" },
					monthlyMissingCert: { severity: "warn" },
					stageStalled: { severity: "warn" },
				},
			},
			updated_at: new Date().toISOString(),
		});
	if (ruleConfigError) throw ruleConfigError;

	const { error: findingError } = await adminClient.from("obra_findings").insert({
		tenant_id: tenantId,
		obra_id: obraId,
		period_key: scenario.currentPeriod,
		rule_key: "cert.missing_current_month",
		severity: "warn",
		title: "Falta certificado del mes actual",
		message: `Se detectaron certificados en meses anteriores pero falta el certificado del periodo ${scenario.currentPeriod}.`,
		evidence_json: { period: scenario.currentPeriod },
		status: "open",
		created_at: new Date().toISOString(),
	});
	if (findingError) throw findingError;

	return {
		pmcResumenTableId: pmcResumen.id,
		curvaManualTableId: curvaManual.id,
		missingPeriod: scenario.currentPeriod,
	};
}

async function seedGenericFiles(adminClient, ownerUserId, obraId) {
	await uploadTrackedTextFile(adminClient, {
		ownerUserId,
		obraId,
		folderPath: "ordenes-de-compra",
		fileName: "orden-compra-demo.txt",
		content: [
			"Orden de compra demo",
			"Proveedor: Aceros del Centro",
			"Cantidad: 24",
			"Detalle: Malla electrosoldada",
		].join("\n"),
	});
	await uploadTrackedTextFile(adminClient, {
		ownerUserId,
		obraId,
		folderPath: "fotos-de-obra",
		fileName: "registro-avance-demo.txt",
		content: [
			"Registro visual demo",
			"Ubicacion: frente principal",
			"Estado: estructura terminada",
		].join("\n"),
	});
}

function stripKeys(record, keys) {
	const next = { ...record };
	for (const key of keys) {
		delete next[key];
	}
	return next;
}

function rewriteDeep(value, options) {
	const { exactStringMap, pathPrefixMap } = options;
	if (Array.isArray(value)) {
		return value.map((entry) => rewriteDeep(entry, options));
	}
	if (value && typeof value === "object") {
		const next = {};
		for (const [key, nestedValue] of Object.entries(value)) {
			next[key] = rewriteDeep(nestedValue, options);
		}
		return next;
	}
	if (typeof value !== "string") return value;
	if (exactStringMap.has(value)) {
		return exactStringMap.get(value);
	}
	for (const [fromPrefix, toPrefix] of pathPrefixMap.entries()) {
		if (value === fromPrefix || value.startsWith(`${fromPrefix}/`)) {
			return `${toPrefix}${value.slice(fromPrefix.length)}`;
		}
	}
	return value;
}

async function listStorageFilesRecursive(adminClient, prefix) {
	const results = [];

	async function walk(currentPrefix) {
		const { data, error } = await adminClient.storage
			.from(DOCUMENTS_BUCKET)
			.list(currentPrefix, {
				limit: 1000,
				sortBy: { column: "name", order: "asc" },
			});
		if (error) throw error;

		for (const entry of data ?? []) {
			const childPath = currentPrefix ? `${currentPrefix}/${entry.name}` : entry.name;
			if (entry.id == null) {
				await walk(childPath);
				continue;
			}
			results.push(childPath);
		}
	}

	await walk(prefix);
	return results;
}

async function loadSourceTenantSnapshot(adminClient, sourceTenantName) {
	const { data: tenant, error: tenantError } = await adminClient
		.from("tenants")
		.select("id, name")
		.eq("name", sourceTenantName)
		.maybeSingle();
	if (tenantError) throw tenantError;
	if (!tenant) {
		throw new Error(`Source tenant "${sourceTenantName}" not found.`);
	}

	const tenantId = tenant.id;
	const [
		mainTableConfig,
		defaultFolders,
		defaultTablas,
		quickActions,
		roles,
		obras,
		ocrTemplates,
		findings,
		ruleConfigs,
	] = await Promise.all([
		adminClient
			.from("tenant_main_table_configs")
			.select("*")
			.eq("tenant_id", tenantId)
			.maybeSingle(),
		adminClient
			.from("obra_default_folders")
			.select("*")
			.eq("tenant_id", tenantId)
			.order("position", { ascending: true }),
		adminClient
			.from("obra_default_tablas")
			.select("*")
			.eq("tenant_id", tenantId)
			.order("position", { ascending: true }),
		adminClient
			.from("obra_default_quick_actions")
			.select("*")
			.eq("tenant_id", tenantId)
			.order("position", { ascending: true }),
		adminClient
			.from("roles")
			.select("*")
			.eq("tenant_id", tenantId)
			.order("name", { ascending: true }),
		adminClient
			.from("obras")
			.select("*")
			.eq("tenant_id", tenantId)
			.order("n", { ascending: true }),
		adminClient
			.from("ocr_templates")
			.select("*")
			.eq("tenant_id", tenantId)
			.order("created_at", { ascending: true }),
		adminClient
			.from("obra_findings")
			.select("*")
			.eq("tenant_id", tenantId)
			.order("created_at", { ascending: true }),
		adminClient
			.from("obra_rule_config")
			.select("*")
			.eq("tenant_id", tenantId)
			.order("updated_at", { ascending: true }),
	]);

	for (const query of [
		mainTableConfig,
		defaultFolders,
		defaultTablas,
		quickActions,
		roles,
		obras,
		ocrTemplates,
		findings,
		ruleConfigs,
	]) {
		if (query.error) throw query.error;
	}

	const defaultTablaIds = (defaultTablas.data ?? []).map((row) => row.id);
	const obraIds = (obras.data ?? []).map((row) => row.id);
	const roleIds = (roles.data ?? []).map((row) => row.id);

	const [defaultTablaColumns, rolePermissions, obraTablas, uploads, materialOrders] = await Promise.all([
		defaultTablaIds.length > 0
			? adminClient
					.from("obra_default_tabla_columns")
					.select("*")
					.in("default_tabla_id", defaultTablaIds)
					.order("position", { ascending: true })
			: { data: [], error: null },
		roleIds.length > 0
			? adminClient.from("role_permissions").select("*").in("role_id", roleIds)
			: { data: [], error: null },
		obraIds.length > 0
			? adminClient
					.from("obra_tablas")
					.select("*")
					.in("obra_id", obraIds)
					.order("created_at", { ascending: true })
			: { data: [], error: null },
		obraIds.length > 0
			? adminClient
					.from("obra_document_uploads")
					.select("*")
					.in("obra_id", obraIds)
					.order("uploaded_at", { ascending: true })
			: { data: [], error: null },
		obraIds.length > 0
			? adminClient
					.from("material_orders")
					.select("*")
					.in("obra_id", obraIds)
					.order("created_at", { ascending: true })
			: { data: [], error: null },
	]);

	for (const query of [defaultTablaColumns, rolePermissions, obraTablas, uploads, materialOrders]) {
		if (query.error) throw query.error;
	}

	const obraTablaIds = (obraTablas.data ?? []).map((row) => row.id);
	const materialOrderIds = (materialOrders.data ?? []).map((row) => row.id);
	const [obraTablaColumns, obraTablaRows, ocrDocumentProcessing, materialOrderItems] =
		await Promise.all([
		obraTablaIds.length > 0
			? adminClient
					.from("obra_tabla_columns")
					.select("*")
					.in("tabla_id", obraTablaIds)
					.order("position", { ascending: true })
			: { data: [], error: null },
		obraTablaIds.length > 0
			? adminClient
					.from("obra_tabla_rows")
					.select("*")
					.in("tabla_id", obraTablaIds)
					.order("created_at", { ascending: true })
			: { data: [], error: null },
		obraTablaIds.length > 0
			? adminClient
					.from("ocr_document_processing")
					.select("*")
					.in("tabla_id", obraTablaIds)
					.order("created_at", { ascending: true })
			: { data: [], error: null },
		materialOrderIds.length > 0
			? adminClient
					.from("material_order_items")
					.select("*")
					.in("order_id", materialOrderIds)
					.order("created_at", { ascending: true })
			: { data: [], error: null },
		]);

	for (const query of [
		obraTablaColumns,
		obraTablaRows,
		ocrDocumentProcessing,
		materialOrderItems,
	]) {
		if (query.error) throw query.error;
	}

	return {
		tenant,
		mainTableConfig: mainTableConfig.data,
		defaultFolders: defaultFolders.data ?? [],
		defaultTablas: defaultTablas.data ?? [],
		defaultTablaColumns: defaultTablaColumns.data ?? [],
		quickActions: quickActions.data ?? [],
		roles: roles.data ?? [],
		rolePermissions: rolePermissions.data ?? [],
		obras: obras.data ?? [],
		obraTablas: obraTablas.data ?? [],
		obraTablaColumns: obraTablaColumns.data ?? [],
		obraTablaRows: obraTablaRows.data ?? [],
		ocrDocumentProcessing: ocrDocumentProcessing.data ?? [],
		uploads: uploads.data ?? [],
		materialOrders: materialOrders.data ?? [],
		materialOrderItems: materialOrderItems.data ?? [],
		ocrTemplates: ocrTemplates.data ?? [],
		findings: findings.data ?? [],
		ruleConfigs: ruleConfigs.data ?? [],
	};
}

async function cloneFromSourceTenant(adminClient, options) {
	const { sourceTenantName, targetTenantId, ownerUserId } = options;
	const snapshot = await loadSourceTenantSnapshot(adminClient, sourceTenantName);

	const defaultTablaIdMap = new Map();
	const obraIdMap = new Map();
	const obraPathPrefixMap = new Map();
	const roleIdMap = new Map();
	const ocrTemplateIdMap = new Map();
	const obraTablaIdMap = new Map();
	const materialOrderIdMap = new Map();

	for (const template of snapshot.ocrTemplates) {
		const { data, error } = await adminClient
			.from("ocr_templates")
			.insert({
				...stripKeys(template, ["id", "tenant_id"]),
				tenant_id: targetTenantId,
			})
			.select("id")
			.single();
		if (error || !data) throw error ?? new Error("Failed to clone OCR template");
		ocrTemplateIdMap.set(template.id, data.id);
	}

	const exactStringMap = new Map([...ocrTemplateIdMap.entries()]);
	const pathPrefixMap = new Map();
	const rewriteValue = (value) => rewriteDeep(value, { exactStringMap, pathPrefixMap });

	for (const defaultFolder of snapshot.defaultFolders) {
		const payload = {
			...stripKeys(defaultFolder, ["id", "tenant_id"]),
			tenant_id: targetTenantId,
		};
		const { error } = await adminClient.from("obra_default_folders").insert(payload);
		if (error) throw error;
	}

	for (const defaultTabla of snapshot.defaultTablas) {
		const payload = {
			...stripKeys(defaultTabla, ["id", "tenant_id"]),
			tenant_id: targetTenantId,
			ocr_template_id: defaultTabla.ocr_template_id
				? ocrTemplateIdMap.get(defaultTabla.ocr_template_id) ?? null
				: null,
			settings: rewriteValue(defaultTabla.settings ?? {}),
		};
		const { data, error } = await adminClient
			.from("obra_default_tablas")
			.insert(payload)
			.select("id")
			.single();
		if (error || !data) throw error ?? new Error("Failed to clone default tabla");
		defaultTablaIdMap.set(defaultTabla.id, data.id);
		exactStringMap.set(defaultTabla.id, data.id);
	}

	if (snapshot.defaultTablaColumns.length > 0) {
		const { error } = await adminClient.from("obra_default_tabla_columns").insert(
			snapshot.defaultTablaColumns.map((column) => ({
				...stripKeys(column, ["id", "default_tabla_id"]),
				default_tabla_id: defaultTablaIdMap.get(column.default_tabla_id),
				config: rewriteValue(column.config ?? {}),
			}))
		);
		if (error) throw error;
	}

	for (const role of snapshot.roles) {
		const { data, error } = await adminClient
			.from("roles")
			.insert({
				...stripKeys(role, ["id", "tenant_id"]),
				tenant_id: targetTenantId,
			})
			.select("id")
			.single();
		if (error || !data) throw error ?? new Error("Failed to clone role");
		roleIdMap.set(role.id, data.id);
	}

	if (snapshot.rolePermissions.length > 0) {
		const { error } = await adminClient.from("role_permissions").insert(
			snapshot.rolePermissions.map((row) => ({
				role_id: roleIdMap.get(row.role_id),
				permission_id: row.permission_id,
				created_at: row.created_at,
			}))
		);
		if (error) throw error;
	}

	if (roleIdMap.size > 0) {
		const { error } = await adminClient.from("user_roles").insert(
			Array.from(roleIdMap.values()).map((roleId) => ({
				user_id: ownerUserId,
				role_id: roleId,
			}))
		);
		if (error) throw error;
	}

	if (snapshot.mainTableConfig?.columns) {
		const { error } = await adminClient.from("tenant_main_table_configs").upsert(
			{
				tenant_id: targetTenantId,
				columns: rewriteValue(snapshot.mainTableConfig.columns),
				updated_by: ownerUserId,
			},
			{ onConflict: "tenant_id" }
		);
		if (error) throw error;
	}

	for (const obra of snapshot.obras) {
		const payload = {
			...stripKeys(obra, ["id", "tenant_id"]),
			tenant_id: targetTenantId,
			custom_data: rewriteValue(obra.custom_data ?? {}),
		};
		const { data, error } = await adminClient
			.from("obras")
			.insert(payload)
			.select("id, n, designacion_y_ubicacion")
			.single();
		if (error || !data) throw error ?? new Error("Failed to clone obra");
		obraIdMap.set(obra.id, data.id);
		exactStringMap.set(obra.id, data.id);
		pathPrefixMap.set(obra.id, data.id);
		obraPathPrefixMap.set(obra.id, data.id);
	}

	for (const quickAction of snapshot.quickActions) {
		const payload = {
			...stripKeys(quickAction, ["id", "tenant_id", "obra_id"]),
			tenant_id: targetTenantId,
			obra_id: quickAction.obra_id ? obraIdMap.get(quickAction.obra_id) ?? null : null,
			folder_paths: rewriteValue(quickAction.folder_paths ?? []),
		};
		const { error } = await adminClient.from("obra_default_quick_actions").insert(payload);
		if (error) throw error;
	}

	for (const obraTabla of snapshot.obraTablas) {
		const payload = {
			...stripKeys(obraTabla, ["id", "obra_id"]),
			obra_id: obraIdMap.get(obraTabla.obra_id),
			settings: rewriteValue(obraTabla.settings ?? {}),
		};
		const { data, error } = await adminClient
			.from("obra_tablas")
			.insert(payload)
			.select("id")
			.single();
		if (error || !data) throw error ?? new Error("Failed to clone obra tabla");
		obraTablaIdMap.set(obraTabla.id, data.id);
		exactStringMap.set(obraTabla.id, data.id);
	}

	if (snapshot.obraTablaColumns.length > 0) {
		const { error } = await adminClient.from("obra_tabla_columns").insert(
			snapshot.obraTablaColumns.map((column) => ({
				...stripKeys(column, ["id", "tabla_id"]),
				tabla_id: obraTablaIdMap.get(column.tabla_id),
				config: rewriteValue(column.config ?? {}),
			}))
		);
		if (error) throw error;
	}

	if (snapshot.obraTablaRows.length > 0) {
		const { error } = await adminClient.from("obra_tabla_rows").insert(
			snapshot.obraTablaRows.map((row) => ({
				...stripKeys(row, ["id", "tabla_id"]),
				tabla_id: obraTablaIdMap.get(row.tabla_id),
				data: rewriteValue(row.data ?? {}),
			}))
		);
		if (error) throw error;
	}

	if (snapshot.ocrDocumentProcessing.length > 0) {
		const { error } = await adminClient.from("ocr_document_processing").insert(
			snapshot.ocrDocumentProcessing.map((document) => ({
				...stripKeys(document, ["id", "tabla_id", "obra_id", "template_id"]),
				tabla_id: obraTablaIdMap.get(document.tabla_id),
				obra_id: obraIdMap.get(document.obra_id),
				template_id: document.template_id
					? ocrTemplateIdMap.get(document.template_id) ?? null
					: null,
				source_path: rewriteValue(document.source_path),
			}))
		);
		if (error) throw error;
	}

	for (const [sourceObraId, targetObraId] of obraPathPrefixMap.entries()) {
		const filePaths = await listStorageFilesRecursive(adminClient, sourceObraId);
		for (const sourcePath of filePaths) {
			const targetPath = `${targetObraId}${sourcePath.slice(sourceObraId.length)}`;
			const { data: fileData, error: downloadError } = await adminClient.storage
				.from(DOCUMENTS_BUCKET)
				.download(sourcePath);
			if (downloadError || !fileData) throw downloadError ?? new Error("Failed to download source file");
			const buffer = await fileData.arrayBuffer();
			const { error: uploadError } = await adminClient.storage
				.from(DOCUMENTS_BUCKET)
				.upload(targetPath, new Uint8Array(buffer), {
					upsert: true,
					contentType: fileData.type || undefined,
				});
			if (uploadError) throw uploadError;
		}
	}

	if (snapshot.uploads.length > 0) {
		const { error } = await adminClient.from("obra_document_uploads").insert(
			snapshot.uploads.map((upload) => ({
				...stripKeys(upload, ["id", "obra_id", "uploaded_by", "storage_path"]),
				obra_id: obraIdMap.get(upload.obra_id),
				uploaded_by: ownerUserId,
				storage_path: rewriteValue(upload.storage_path),
			}))
		);
		if (error) throw error;
	}

	for (const order of snapshot.materialOrders) {
		const { data, error } = await adminClient
			.from("material_orders")
			.insert({
				...stripKeys(order, ["id", "obra_id"]),
				obra_id: obraIdMap.get(order.obra_id),
				doc_path: rewriteValue(order.doc_path),
			})
			.select("id")
			.single();
		if (error || !data) throw error ?? new Error("Failed to clone material order");
		materialOrderIdMap.set(order.id, data.id);
	}

	if (snapshot.materialOrderItems.length > 0) {
		const { error } = await adminClient.from("material_order_items").insert(
			snapshot.materialOrderItems.map((item) => ({
				...stripKeys(item, ["id", "order_id"]),
				order_id: materialOrderIdMap.get(item.order_id),
			}))
		);
		if (error) throw error;
	}

	if (snapshot.ruleConfigs.length > 0) {
		const { error } = await adminClient.from("obra_rule_config").insert(
			snapshot.ruleConfigs.map((config) => ({
				...stripKeys(config, ["tenant_id", "obra_id"]),
				tenant_id: targetTenantId,
				obra_id: obraIdMap.get(config.obra_id),
				config_json: rewriteValue(config.config_json ?? {}),
			}))
		);
		if (error) throw error;
	}

	if (snapshot.findings.length > 0) {
		const { error } = await adminClient.from("obra_findings").insert(
			snapshot.findings.map((finding) => ({
				...stripKeys(finding, ["id", "tenant_id", "obra_id"]),
				tenant_id: targetTenantId,
				obra_id: obraIdMap.get(finding.obra_id),
				evidence_json: rewriteValue(finding.evidence_json ?? {}),
			}))
		);
		if (error) throw error;
	}

	const createdObras = snapshot.obras.map((obra) => ({
		id: obraIdMap.get(obra.id),
		n: obra.n,
		name: obra.designacion_y_ubicacion,
	}));

	return {
		sourceTenantId: snapshot.tenant.id,
		sourceTenantName: snapshot.tenant.name,
		obras: createdObras,
	};
}

async function main() {
	loadEnvFiles();
	const args = parseArgs(process.argv.slice(2));
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceRoleKey = getVersionedSecret("SUPABASE_SERVICE_ROLE_KEY");
	if (!url || !serviceRoleKey) {
		throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
	}

	const tenantLabel =
		typeof args.tenant === "string" && args.tenant.trim()
			? args.tenant.trim()
			: "Demo";
	const hasExplicitTenantName =
		typeof args.tenant === "string" && args.tenant.trim().length > 0;
	const ownerEmail =
		typeof args["owner-email"] === "string" && args["owner-email"].trim()
			? args["owner-email"].trim()
			: DEFAULT_OWNER_EMAIL;
	const ownerName =
		typeof args["owner-name"] === "string" && args["owner-name"].trim()
			? args["owner-name"].trim()
			: DEFAULT_OWNER_NAME;
	const ownerPassword =
		typeof args["owner-password"] === "string" && args["owner-password"].trim()
			? args["owner-password"].trim()
			: process.env.DEMO_TENANT_OWNER_PASSWORD?.trim() || DEFAULT_OWNER_PASSWORD;
	const sourceTenantName =
		typeof args["source-tenant"] === "string" && args["source-tenant"].trim()
			? args["source-tenant"].trim()
			: DEFAULT_SOURCE_TENANT_NAME;

	const adminClient = createClient(url, serviceRoleKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	});

	const finalTenantName = hasExplicitTenantName
		? await assertTenantNameAvailable(adminClient, tenantLabel)
		: await resolveUniqueTenantName(
				adminClient,
				buildRunSpecificTenantName(tenantLabel),
			);
	const ownerUserId = await ensureOwnerUser(adminClient, {
		email: ownerEmail,
		password: ownerPassword,
		fullName: ownerName,
	});
	await ensureProfile(adminClient, ownerUserId, ownerName);

	const tenant = await createTenant(adminClient, finalTenantName);
	await ensureMembership(adminClient, tenant.id, ownerUserId);
	const cloneSummary = await cloneFromSourceTenant(adminClient, {
		sourceTenantName,
		targetTenantId: tenant.id,
		ownerUserId,
	});

	const summary = {
		tenantId: tenant.id,
		tenantName: tenant.name,
		sourceTenantId: cloneSummary.sourceTenantId,
		sourceTenantName: cloneSummary.sourceTenantName,
		ownerUserId,
		ownerEmail,
		tenantSlugHint: slugify(tenant.name),
		obras: cloneSummary.obras,
	};

	console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
	console.error("[bootstrap-demo-tenant] fatal error");
	console.error(error);
	process.exitCode = 1;
});
