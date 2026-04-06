import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_TENANT_NAME = "Codex Demo Tenant Smoke";
const DEFAULT_SOURCE_TENANT_NAME = "Demo 20260405-210632";
const DOCUMENTS_BUCKET = "obra-documents";
const ORDER_FOLDER_PATH = "ordenes-de-compra";
const ORDER_TABLE_NAME = "Ordenes de Compra";
const ORDER_TEMPLATE_NAME = "Ordenes de Compra";

const EXTRA_ORDER_DOCS = {
	"Orden-de-compra1.png": {
		nroOrden: "OC-PLANTILLA-001",
		fecha: "14/03/2026",
		solicitante: "Jefatura de Obra",
		proveedor: "Insumos de Obra Federal SA",
		totalOrden: 70809834,
		items: [
			{
				cantidad: 1141,
				unidad: "bolsa",
				material: "Cemento portland x 50 kg",
				precioUnitario: 9800,
				precioTotal: 11181800,
			},
		],
	},
	"Orden-de-compra1 (2).png": {
		nroOrden: "OC-PLANTILLA-002",
		fecha: "18/03/2026",
		solicitante: "Abastecimiento Central",
		proveedor: "Insumos de Obra Federal SA",
		totalOrden: 11181800,
		items: [
			{
				cantidad: 1141,
				unidad: "bolsa",
				material: "Cemento portland x 50 kg",
				precioUnitario: 9800,
				precioTotal: 11181800,
			},
		],
	},
};

const ORDER_COLUMN_DEFS = [
	{
		field_key: "nroOrden",
		label: "NRO",
		data_type: "text",
		position: 0,
		required: false,
		scope: "parent",
		description: "Numero identificatorio de la orden de compra.",
	},
	{
		field_key: "fecha",
		label: "FECHA",
		data_type: "text",
		position: 1,
		required: false,
		scope: "parent",
		description: "Fecha de emision de la orden de compra en formato DD/MM/AAAA.",
	},
	{
		field_key: "solicitante",
		label: "SOLICITANTE",
		data_type: "text",
		position: 2,
		required: false,
		scope: "parent",
		description: "Persona o area que solicito la compra.",
	},
	{
		field_key: "proveedor",
		label: "PROVEEDOR",
		data_type: "text",
		position: 3,
		required: false,
		scope: "parent",
		description: "Empresa o proveedor asociado a la orden.",
	},
	{
		field_key: "totalOrden",
		label: "TOTAL ORDEN",
		data_type: "currency",
		position: 4,
		required: false,
		scope: "parent",
		description: "Monto total de la orden de compra.",
	},
	{
		field_key: "cantidad",
		label: "CANTIDAD",
		data_type: "number",
		position: 5,
		required: false,
		scope: "item",
		description: "Cantidad solicitada para el item.",
	},
	{
		field_key: "unidad",
		label: "UNIDAD",
		data_type: "text",
		position: 6,
		required: false,
		scope: "item",
		description: "Unidad de medida del item.",
	},
	{
		field_key: "material",
		label: "DETALLE DESCRIPTIVO",
		data_type: "text",
		position: 7,
		required: false,
		scope: "item",
		description: "Descripcion del material o servicio solicitado.",
	},
	{
		field_key: "precioUnitario",
		label: "PRECIO UNITARIO",
		data_type: "currency",
		position: 8,
		required: false,
		scope: "item",
		description: "Precio unitario del item.",
	},
	{
		field_key: "precioTotal",
		label: "PRECIO TOTAL",
		data_type: "currency",
		position: 9,
		required: false,
		scope: "item",
		description: "Monto total del item.",
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

function sanitizeFileName(fileName) {
	return String(fileName)
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-zA-Z0-9._() -]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function buildExtractedColumns() {
	return ORDER_COLUMN_DEFS.map((column) => ({
		label: column.label,
		aliases: [],
		dataType: column.data_type === "currency" ? "text" : column.data_type,
		examples: [],
		fieldKey: column.field_key,
		ocrScope: column.scope,
		required: column.required,
		description: column.description,
		excelKeywords: [],
	}));
}

function buildOrderTableSettings(defaultTableId, orderTemplateId) {
	return {
		ocrFolder: ORDER_FOLDER_PATH,
		ocrFolderLabel: "Ordenes de Compra",
		hasNestedData: true,
		ocrTemplateId: orderTemplateId,
		dataInputMethod: "both",
		manualEntryEnabled: true,
		spreadsheetTemplate: "auto",
		extractionRowMode: "multiple",
		documentTypes: [
			"orden de compra",
			"ordenes de compra",
			"pedido de materiales",
		],
		extractionInstructions:
			"Usar este folder para ordenes de compra de materiales. Extraer nro de orden, fecha, solicitante, proveedor y por cada item cantidad, unidad, detalle descriptivo, precio unitario y precio total. Si el documento incluye el total de la orden, conservarlo.",
		extractedTables: [
			{
				id: defaultTableId,
				name: ORDER_TABLE_NAME,
				columns: buildExtractedColumns(),
				rowMode: "multiple",
				documentTypes: [],
				hasNestedData: true,
				ocrTemplateId: orderTemplateId,
				dataInputMethod: "both",
				ocrTemplateName: null,
				manualEntryEnabled: true,
				spreadsheetTemplate: "auto",
				extractionInstructions:
					"Usar este folder para ordenes de compra de materiales. Extraer nro de orden, fecha, solicitante, proveedor y por cada item cantidad, unidad, detalle descriptivo, precio unitario y precio total. Si el documento incluye el total de la orden, conservarlo.",
			},
		],
	};
}

function buildColumnConfig(column) {
	return {
		ocrScope: column.scope,
		ocrDescription: column.description,
	};
}

function buildTemplateColumns() {
	return ORDER_COLUMN_DEFS.map((column) => ({
		label: column.label,
		aliases: [],
		dataType: "text",
		examples: [],
		fieldKey: column.field_key,
		ocrScope: column.scope,
		required: column.required,
		description: column.description,
		excelKeywords: [],
	}));
}

function buildTemplateRegions(sourceRegions) {
	const regions = Array.isArray(sourceRegions)
		? sourceRegions.map((region) => ({ ...region }))
		: [];
	const hasFecha = regions.some(
		(region) =>
			typeof region?.label === "string" &&
			region.label.trim().toUpperCase() === "FECHA"
	);
	if (!hasFecha) {
		regions.push({
			x: 460,
			y: 12.3203125,
			id: "fecha-orden-compra",
			type: "single",
			color: "#3b82f6",
			label: "FECHA",
			width: 150,
			height: 32,
			pageNumber: 1,
			description: "Fecha de emision de la orden de compra. En formato DD/MM/AAAA.",
		});
	}
	return regions.map((region) => {
		const label = typeof region.label === "string" ? region.label.trim().toUpperCase() : "";
		if (label === "NRO") {
			return {
				...region,
				description: "Numero identificatorio de la orden de compra.",
			};
		}
		if (label === "SOLICITANTE") {
			return {
				...region,
				description: "Persona o area que solicito la compra.",
			};
		}
		if (label === "PROVEEDOR") {
			return {
				...region,
				description: "Empresa o proveedor asociado a la orden.",
			};
		}
		if (label === "TOTAL ORDEN") {
			return {
				...region,
				description: "Monto total de la orden de compra.",
			};
		}
		return region;
	});
}

function buildGenericOrdersForObra(obra) {
	const obraNumber = Number(obra.n ?? 0);
	const baseOrders = [
		{
			nroOrden: `${obraNumber}108`,
			fecha: "12/02/2026",
			solicitante: "Coordinacion de obra",
			proveedor: "Suministros Urbanos SA",
			items: [
				{
					cantidad: 12,
					unidad: "UNI",
					material: "Tablero electrico metalico para distribucion interior",
					precioUnitario: 148500,
				},
				{
					cantidad: 40,
					unidad: "M2",
					material: "Porcelanato antideslizante trafico intenso",
					precioUnitario: 19350,
				},
			],
		},
		{
			nroOrden: `${obraNumber}214`,
			fecha: "05/03/2026",
			solicitante: "Jefatura tecnica",
			proveedor: "Servicios y Montajes Integrales",
			items: [
				{
					cantidad: 6,
					unidad: "UNI",
					material: "Luminaria estanca LED para areas comunes",
					precioUnitario: 86200,
				},
				{
					cantidad: 18,
					unidad: "UNI",
					material: "Canaleta metalica galvanizada 100 x 50 mm",
					precioUnitario: 27900,
				},
			],
		},
	];
	const selectedOrders =
		obraNumber === 101 ? baseOrders : [baseOrders[obraNumber % baseOrders.length]];

	return selectedOrders.map((order) => {
		const fileName = sanitizeFileName(`oc-${order.nroOrden}.txt`);
		const items = order.items.map((item) => ({
			...item,
			precioTotal: Number(item.cantidad) * Number(item.precioUnitario),
		}));
		const totalOrden = items.reduce((total, item) => total + item.precioTotal, 0);
		return {
			...order,
			fileName,
			items,
			totalOrden,
			content: [
				"ORDEN DE COMPRA",
				`NRO: ${order.nroOrden}`,
				`FECHA: ${order.fecha}`,
				`SOLICITANTE: ${order.solicitante}`,
				`PROVEEDOR: ${order.proveedor}`,
				"",
				"ITEMS",
				...items.map(
					(item, itemIndex) =>
						`${itemIndex + 1}. CANTIDAD: ${item.cantidad} | UNIDAD: ${item.unidad} | DETALLE DESCRIPTIVO: ${item.material} | PRECIO UNITARIO: ${item.precioUnitario.toFixed(2)} | PRECIO TOTAL: ${item.precioTotal.toFixed(2)}`
				),
				"",
				`TOTAL ORDEN: ${totalOrden.toFixed(2)}`,
			].join("\n"),
		};
	});
}

async function listStorageFilesRecursive(adminClient, prefix) {
	const files = [];

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
			files.push(childPath);
		}
	}

	await walk(prefix);
	return files;
}

async function getTenantByName(adminClient, name) {
	const { data, error } = await adminClient
		.from("tenants")
		.select("id, name")
		.eq("name", name)
		.single();
	if (error || !data) {
		throw error ?? new Error(`Tenant "${name}" not found.`);
	}
	return data;
}

async function getFirstObra(adminClient, tenantId) {
	const { data, error } = await adminClient
		.from("obras")
		.select("id, n, designacion_y_ubicacion")
		.eq("tenant_id", tenantId)
		.order("n", { ascending: true })
		.limit(1)
		.single();
	if (error || !data) throw error ?? new Error("No obra found.");
	return data;
}

async function ensureOrderTemplate(adminClient, {
	targetTenantId,
	sourceTenantId,
}) {
	const { data: sourceTemplate, error: sourceError } = await adminClient
		.from("ocr_templates")
		.select("*")
		.eq("tenant_id", sourceTenantId)
		.eq("name", ORDER_TEMPLATE_NAME)
		.single();
	if (sourceError || !sourceTemplate) {
		throw sourceError ?? new Error("Source order OCR template not found.");
	}

	const payload = {
		name: ORDER_TEMPLATE_NAME,
		description:
			"Plantilla OCR para ordenes de compra con fecha, solicitante, proveedor y detalle de items.",
		template_bucket: sourceTemplate.template_bucket ?? null,
		template_path: sourceTemplate.template_path ?? null,
		template_file_name: sourceTemplate.template_file_name ?? null,
		template_width: sourceTemplate.template_width ?? null,
		template_height: sourceTemplate.template_height ?? null,
		regions: buildTemplateRegions(sourceTemplate.regions),
		columns: buildTemplateColumns(),
		is_active: true,
	};

	const { data: existingTemplate, error: existingError } = await adminClient
		.from("ocr_templates")
		.select("id")
		.eq("tenant_id", targetTenantId)
		.eq("name", ORDER_TEMPLATE_NAME)
		.maybeSingle();
	if (existingError) throw existingError;

	if (existingTemplate) {
		const { error } = await adminClient
			.from("ocr_templates")
			.update(payload)
			.eq("id", existingTemplate.id);
		if (error) throw error;
		return existingTemplate.id;
	}

	const { data, error } = await adminClient
		.from("ocr_templates")
		.insert({
			tenant_id: targetTenantId,
			...payload,
		})
		.select("id")
		.single();
	if (error || !data) {
		throw error ?? new Error("Failed to create order OCR template.");
	}
	return data.id;
}

async function ensureDefaultOrderTable(adminClient, tenantId, orderTemplateId) {
	const { data: existingTables, error: loadError } = await adminClient
		.from("obra_default_tablas")
		.select("id, name, linked_folder_path")
		.eq("tenant_id", tenantId)
		.eq("linked_folder_path", ORDER_FOLDER_PATH)
		.order("position", { ascending: true });
	if (loadError) throw loadError;

	const existingTable = existingTables?.[0] ?? null;
	let defaultTableId = existingTable?.id ?? null;

	if (defaultTableId) {
		const { error: updateError } = await adminClient
			.from("obra_default_tablas")
			.update({
				name: ORDER_TABLE_NAME,
				description: "Tabla OCR para ordenes de compra de materiales con datos de encabezado e items.",
				source_type: "ocr",
				position: 2,
				ocr_template_id: orderTemplateId,
			})
			.eq("id", defaultTableId);
		if (updateError) throw updateError;
	} else {
		const { data, error } = await adminClient
			.from("obra_default_tablas")
			.insert({
				tenant_id: tenantId,
				name: ORDER_TABLE_NAME,
				description: "Tabla OCR para ordenes de compra de materiales con datos de encabezado e items.",
				source_type: "ocr",
				linked_folder_path: ORDER_FOLDER_PATH,
				position: 2,
				ocr_template_id: orderTemplateId,
				settings: {},
			})
			.select("id")
			.single();
		if (error || !data) throw error ?? new Error("Failed to create default order table.");
		defaultTableId = data.id;
	}

	const { error: settingsError } = await adminClient
		.from("obra_default_tablas")
		.update({
			settings: buildOrderTableSettings(defaultTableId, orderTemplateId),
			ocr_template_id: orderTemplateId,
		})
		.eq("id", defaultTableId);
	if (settingsError) throw settingsError;

	const duplicateIds = (existingTables ?? [])
		.slice(1)
		.map((table) => table.id)
		.filter(Boolean);
	if (duplicateIds.length > 0) {
		const { error } = await adminClient
			.from("obra_default_tablas")
			.delete()
			.in("id", duplicateIds);
		if (error) throw error;
	}

	const { error: deleteColumnsError } = await adminClient
		.from("obra_default_tabla_columns")
		.delete()
		.eq("default_tabla_id", defaultTableId);
	if (deleteColumnsError) throw deleteColumnsError;

	const { error: insertColumnsError } = await adminClient
		.from("obra_default_tabla_columns")
		.insert(
			ORDER_COLUMN_DEFS.map((column) => ({
				default_tabla_id: defaultTableId,
				field_key: column.field_key,
				label: column.label,
				data_type: column.data_type,
				position: column.position,
				required: column.required,
				config: buildColumnConfig(column),
			}))
		);
	if (insertColumnsError) throw insertColumnsError;

	return defaultTableId;
}

async function ensureObraOrderTable(adminClient, obraId, defaultTableId, orderTemplateId) {
	const { data: existingTables, error: loadError } = await adminClient
		.from("obra_tablas")
		.select("id, name, settings")
		.eq("obra_id", obraId)
		.eq("source_type", "ocr")
		.order("created_at", { ascending: true });
	if (loadError) throw loadError;

	const existingTable =
		(existingTables ?? []).find((table) => {
			const settings =
				table.settings && typeof table.settings === "object" ? table.settings : {};
			return (
				settings.defaultTablaId === defaultTableId ||
				settings.ocrFolder === ORDER_FOLDER_PATH ||
				table.name === ORDER_TABLE_NAME ||
				table.name === "Ordenes de Compra OCR"
			);
		}) ?? null;

	const payload = {
		name: ORDER_TABLE_NAME,
		description: "Extraccion OCR de ordenes de compra con encabezado e items de materiales.",
		source_type: "ocr",
		settings: buildOrderTableSettings(defaultTableId, orderTemplateId),
	};

	let tablaId = existingTable?.id ?? null;
	if (tablaId) {
		const { error } = await adminClient
			.from("obra_tablas")
			.update(payload)
			.eq("id", tablaId);
		if (error) throw error;
	} else {
		const { data, error } = await adminClient
			.from("obra_tablas")
			.insert({
				obra_id: obraId,
				...payload,
			})
			.select("id")
			.single();
		if (error || !data) throw error ?? new Error("Failed to create obra order table.");
		tablaId = data.id;
	}

	const duplicateIds = (existingTables ?? [])
		.filter((table) => table.id !== tablaId)
		.filter((table) => {
			const settings =
				table.settings && typeof table.settings === "object" ? table.settings : {};
			return (
				settings.defaultTablaId === defaultTableId ||
				settings.ocrFolder === ORDER_FOLDER_PATH ||
				table.name === ORDER_TABLE_NAME ||
				table.name === "Ordenes de Compra OCR"
			);
		})
		.map((table) => table.id);
	if (duplicateIds.length > 0) {
		const { error } = await adminClient
			.from("obra_tablas")
			.delete()
			.in("id", duplicateIds);
		if (error) throw error;
	}

	const { error: deleteColumnsError } = await adminClient
		.from("obra_tabla_columns")
		.delete()
		.eq("tabla_id", tablaId);
	if (deleteColumnsError) throw deleteColumnsError;

	const { error: insertColumnsError } = await adminClient.from("obra_tabla_columns").insert(
		ORDER_COLUMN_DEFS.map((column) => ({
			tabla_id: tablaId,
			field_key: column.field_key,
			label: column.label,
			data_type: column.data_type,
			position: column.position,
			required: column.required,
			config: buildColumnConfig(column),
		}))
	);
	if (insertColumnsError) throw insertColumnsError;

	return tablaId;
}

async function clearExistingOrderData(adminClient, obraId, tablaId) {
	const storagePrefix = `${obraId}/${ORDER_FOLDER_PATH}`;

	const { data: existingOrders, error: loadOrdersError } = await adminClient
		.from("material_orders")
		.select("id")
		.eq("obra_id", obraId);
	if (loadOrdersError) throw loadOrdersError;

	const orderIds = (existingOrders ?? []).map((order) => order.id);
	if (orderIds.length > 0) {
		const { error } = await adminClient
			.from("material_order_items")
			.delete()
			.in("order_id", orderIds);
		if (error) throw error;
	}

	const { error: deleteOrdersError } = await adminClient
		.from("material_orders")
		.delete()
		.eq("obra_id", obraId);
	if (deleteOrdersError) throw deleteOrdersError;

	const { error: deleteRowsError } = await adminClient
		.from("obra_tabla_rows")
		.delete()
		.eq("tabla_id", tablaId);
	if (deleteRowsError) throw deleteRowsError;

	const { error: deleteDocsError } = await adminClient
		.from("ocr_document_processing")
		.delete()
		.eq("tabla_id", tablaId);
	if (deleteDocsError) throw deleteDocsError;

	const { error: deleteUploadsError } = await adminClient
		.from("obra_document_uploads")
		.delete()
		.eq("obra_id", obraId)
		.like("storage_path", `${storagePrefix}/%`);
	if (deleteUploadsError) throw deleteUploadsError;

	const files = await listStorageFilesRecursive(adminClient, storagePrefix);
	if (files.length > 0) {
		const { error } = await adminClient.storage.from(DOCUMENTS_BUCKET).remove(files);
		if (error) throw error;
	}
}

async function uploadTrackedFile(adminClient, {
	ownerUserId,
	obraId,
	fileName,
	data,
	contentType,
}) {
	const storagePath = `${obraId}/${ORDER_FOLDER_PATH}/${fileName}`;
	const { error: uploadError } = await adminClient.storage
		.from(DOCUMENTS_BUCKET)
		.upload(storagePath, data, {
			upsert: true,
			contentType,
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

async function insertOrder(adminClient, {
	obraId,
	tablaId,
	orderTemplateId,
	order,
	storagePath,
	source,
	useTemplateId,
}) {
	const { data: materialOrder, error: materialOrderError } = await adminClient
		.from("material_orders")
		.insert({
			obra_id: obraId,
			nro_orden: order.nroOrden,
			fecha: order.fecha,
			solicitante: order.solicitante,
			proveedor: order.proveedor,
			doc_bucket: DOCUMENTS_BUCKET,
			doc_path: storagePath,
		})
		.select("id")
		.single();
	if (materialOrderError || !materialOrder) {
		throw materialOrderError ?? new Error("Failed to create material order.");
	}

	const { error: itemsError } = await adminClient.from("material_order_items").insert(
		order.items.map((item) => ({
			order_id: materialOrder.id,
			cantidad: item.cantidad,
			unidad: item.unidad,
			material: item.material,
			precio_unitario: item.precioUnitario,
		}))
	);
	if (itemsError) throw itemsError;

	const { error: rowsError } = await adminClient.from("obra_tabla_rows").insert(
		order.items.map((item) => ({
			tabla_id: tablaId,
			source,
			data: {
				nroOrden: order.nroOrden,
				fecha: order.fecha,
				solicitante: order.solicitante,
				proveedor: order.proveedor,
				cantidad: item.cantidad,
				unidad: item.unidad,
				material: item.material,
				precioUnitario: item.precioUnitario,
				precioTotal: item.precioTotal,
				totalOrden: order.totalOrden,
				__docBucket: DOCUMENTS_BUCKET,
				__docPath: storagePath,
				__docFileName: path.basename(storagePath),
			},
		}))
	);
	if (rowsError) throw rowsError;

	const { error: ocrDocError } = await adminClient.from("ocr_document_processing").upsert(
		{
			tabla_id: tablaId,
			obra_id: obraId,
			source_bucket: DOCUMENTS_BUCKET,
			source_path: storagePath,
			source_file_name: path.basename(storagePath).toLowerCase(),
			status: "completed",
			rows_extracted: order.items.length,
			template_id: useTemplateId ? orderTemplateId : null,
			processed_at: new Date().toISOString(),
			processing_duration_ms: 320,
			retry_count: 0,
		},
		{ onConflict: "tabla_id,source_path" }
	);
	if (ocrDocError) throw ocrDocError;
}

async function seedGenericOrdersForObra(adminClient, {
	obra,
	ownerUserId,
	tablaId,
	orderTemplateId,
}) {
	const seededOrders = buildGenericOrdersForObra(obra);
	for (const order of seededOrders) {
		const storagePath = await uploadTrackedFile(adminClient, {
			ownerUserId,
			obraId: obra.id,
			fileName: order.fileName,
			data: new Blob([order.content], { type: "text/plain" }),
			contentType: "text/plain",
		});
		await insertOrder(adminClient, {
			obraId: obra.id,
			tablaId,
			orderTemplateId,
			order,
			storagePath,
			source: "seed-template",
			useTemplateId: false,
		});
	}
	return seededOrders.length;
}

async function seedExtraOrderDocsForFirstObra(adminClient, {
	sourceTenantId,
	targetObraId,
	targetTablaId,
	ownerUserId,
	orderTemplateId,
}) {
	const sourceObra = await getFirstObra(adminClient, sourceTenantId);
	const sourcePrefix = `${sourceObra.id}/${ORDER_FOLDER_PATH}`;
	let copied = 0;

	for (const [fileName, order] of Object.entries(EXTRA_ORDER_DOCS)) {
		const sourcePath = `${sourcePrefix}/${fileName}`;
		const { data: fileData, error: downloadError } = await adminClient.storage
			.from(DOCUMENTS_BUCKET)
			.download(sourcePath);
		if (downloadError || !fileData) {
			throw downloadError ?? new Error(`Failed to download ${sourcePath}`);
		}
		const buffer = new Uint8Array(await fileData.arrayBuffer());
		const storagePath = await uploadTrackedFile(adminClient, {
			ownerUserId,
			obraId: targetObraId,
			fileName,
			data: buffer,
			contentType: fileData.type || "image/png",
		});
		await insertOrder(adminClient, {
			obraId: targetObraId,
			tablaId: targetTablaId,
			orderTemplateId,
			order,
			storagePath,
			source: "seed-template-image",
			useTemplateId: true,
		});
		copied += 1;
	}

	return copied;
}

async function main() {
	loadEnvFiles();
	const args = parseArgs(process.argv.slice(2));
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceRoleKey = getVersionedSecret("SUPABASE_SERVICE_ROLE_KEY");
	if (!url || !serviceRoleKey) {
		throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
	}

	const targetTenantName =
		typeof args.tenant === "string" && args.tenant.trim()
			? args.tenant.trim()
			: DEFAULT_TENANT_NAME;
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

	const tenant = await getTenantByName(adminClient, targetTenantName);
	const sourceTenant = await getTenantByName(adminClient, sourceTenantName);

	const { data: membership, error: membershipError } = await adminClient
		.from("memberships")
		.select("user_id")
		.eq("tenant_id", tenant.id)
		.order("created_at", { ascending: true })
		.limit(1)
		.single();
	if (membershipError || !membership) {
		throw membershipError ?? new Error("No membership found for template tenant.");
	}

	const { data: obras, error: obrasError } = await adminClient
		.from("obras")
		.select("id, n, designacion_y_ubicacion")
		.eq("tenant_id", tenant.id)
		.order("n", { ascending: true });
	if (obrasError) throw obrasError;

	const orderTemplateId = await ensureOrderTemplate(adminClient, {
		targetTenantId: tenant.id,
		sourceTenantId: sourceTenant.id,
	});
	const defaultTableId = await ensureDefaultOrderTable(
		adminClient,
		tenant.id,
		orderTemplateId
	);

	const summary = [];
	for (const [index, obra] of (obras ?? []).entries()) {
		const tablaId = await ensureObraOrderTable(
			adminClient,
			obra.id,
			defaultTableId,
			orderTemplateId
		);
		await clearExistingOrderData(adminClient, obra.id, tablaId);
		const genericOrderCount = await seedGenericOrdersForObra(adminClient, {
			obra,
			ownerUserId: membership.user_id,
			tablaId,
			orderTemplateId,
		});
		const extraDocCount =
			index === 0
				? await seedExtraOrderDocsForFirstObra(adminClient, {
						sourceTenantId: sourceTenant.id,
						targetObraId: obra.id,
						targetTablaId: tablaId,
						ownerUserId: membership.user_id,
						orderTemplateId,
					})
				: 0;
		summary.push({
			obraId: obra.id,
			obraN: obra.n,
			obra: obra.designacion_y_ubicacion,
			tablaId,
			genericOrderCount,
			extraDocCount,
		});
	}

	console.log(
		JSON.stringify(
			{
				tenantId: tenant.id,
				tenantName: tenant.name,
				sourceTenantId: sourceTenant.id,
				sourceTenantName: sourceTenant.name,
				orderTemplateId,
				defaultTableId,
				obras: summary,
			},
			null,
			2
		)
	);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
