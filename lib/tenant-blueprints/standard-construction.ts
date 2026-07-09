import type { ExcelPageMainTableColumnConfig } from "@/lib/excel/types";
import { getTenantDataFlowBuilderConfig } from "@/lib/data-flow-builder";
import {
	STANDARD_TENANT_BLUEPRINT_KEY,
	STANDARD_TENANT_BLUEPRINT_VERSION,
} from "./constants";

type BlueprintColumn = {
	fieldKey: string;
	label: string;
	dataType: "text" | "number" | "currency" | "date" | "boolean";
	required?: boolean;
	position?: number;
};

type BlueprintTable = {
	key: string;
	name: string;
	description: string;
	linkedFolderPath: string;
	position: number;
	settings: Record<string, unknown>;
	columns: BlueprintColumn[];
};

type BlueprintMacro = {
	key: string;
	name: string;
	description: string;
	sourceTableKey: string;
	position: number;
	columns: BlueprintColumn[];
};

const BASE_MAIN_TABLE_COLUMNS: Array<
	ExcelPageMainTableColumnConfig & { baseColumnId: string }
> = [
	{ id: "n", baseColumnId: "n", kind: "base", label: "N°", enabled: true, width: 55, cellType: "text", required: true, editable: false, enableHide: false, enablePin: true, enableSort: false, enableResize: false },
	{ id: "designacionYUbicacion", baseColumnId: "designacionYUbicacion", kind: "base", label: "Designación y ubicación", enabled: true, width: 320, cellType: "text", required: true, editable: true, enableHide: true, enablePin: true, enableSort: true, enableResize: true },
	{ id: "especialidad", baseColumnId: "especialidad", kind: "custom", label: "Especialidad", enabled: true, width: 160, cellType: "text", editable: true, enableHide: true, enablePin: false, enableSort: true, enableResize: true },
	{ id: "supDeObraM2", baseColumnId: "supDeObraM2", kind: "base", label: "Sup. de obra (m²)", enabled: true, width: 140, cellType: "number", editable: true, enableHide: true, enablePin: false, enableSort: true, enableResize: true },
	{ id: "entidadContratante", baseColumnId: "entidadContratante", kind: "base", label: "Entidad contratante", enabled: true, width: 210, cellType: "text", editable: true, enableHide: true, enablePin: true, enableSort: true, enableResize: true },
	{ id: "mesBasicoDeContrato", baseColumnId: "mesBasicoDeContrato", kind: "base", label: "Mes básico de contrato", enabled: true, width: 175, cellType: "date", editable: true, enableHide: true, enablePin: false, enableSort: true, enableResize: true },
	{ id: "iniciacion", baseColumnId: "iniciacion", kind: "base", label: "Iniciación", enabled: true, width: 140, cellType: "date", editable: true, enableHide: true, enablePin: false, enableSort: true, enableResize: true },
	{ id: "contratoMasAmpliaciones", baseColumnId: "contratoMasAmpliaciones", kind: "formula", label: "Contrato + ampliaciones", enabled: true, width: 195, formula: "[contratoMasAmpliaciones]", formulaFormat: "currency", cellType: "currency", editable: true, enableHide: true, enablePin: false, enableSort: true, enableResize: true },
	{ id: "certificadoALaFecha", baseColumnId: "certificadoALaFecha", kind: "formula", label: "Certificado a la fecha", enabled: true, width: 190, formula: "[contratoMasAmpliaciones] * ([porcentaje] / 100)", formulaFormat: "currency", cellType: "currency", editable: false, enableHide: true, enablePin: false, enableSort: true, enableResize: true },
	{ id: "saldoACertificar", baseColumnId: "saldoACertificar", kind: "formula", label: "Saldo a certificar", enabled: true, width: 175, formula: "[contratoMasAmpliaciones] - [certificadoALaFecha]", formulaFormat: "currency", cellType: "currency", editable: false, enableHide: true, enablePin: false, enableSort: true, enableResize: true },
	{ id: "segunContrato", baseColumnId: "segunContrato", kind: "base", label: "Según contrato", enabled: true, width: 145, cellType: "number", editable: true, enableHide: true, enablePin: false, enableSort: true, enableResize: true },
	{ id: "prorrogasAcordadas", baseColumnId: "prorrogasAcordadas", kind: "base", label: "Prórrogas acordadas", enabled: true, width: 165, cellType: "number", editable: true, enableHide: true, enablePin: false, enableSort: true, enableResize: true },
	{ id: "plazoTotal", baseColumnId: "plazoTotal", kind: "base", label: "Plazo total", enabled: true, width: 125, cellType: "number", editable: true, enableHide: true, enablePin: false, enableSort: true, enableResize: true },
	{ id: "plazoTransc", baseColumnId: "plazoTransc", kind: "base", label: "Plazo transcurrido", enabled: true, width: 160, cellType: "number", editable: true, enableHide: true, enablePin: false, enableSort: true, enableResize: true },
	{ id: "porcentaje", baseColumnId: "porcentaje", kind: "base", label: "% avance", enabled: true, width: 120, cellType: "badge", editable: true, enableHide: true, enablePin: false, enableSort: true, enableResize: true },
];

const TABLES: BlueprintTable[] = [
	{
		key: "certificates",
		name: "Certificados de obra",
		description: "Certificación mensual, avance físico e importes acumulados.",
		linkedFolderPath: "certificados",
		position: 0,
		settings: {
			dataInputMethod: "both",
			manualEntryEnabled: true,
			spreadsheetTemplate: "certificado",
			documentTypes: ["certificado", "certificado de obra"],
			extractionInstructions: "Extraer una fila por certificado y conservar importes y avance acumulados.",
			extractionRowMode: "multiple",
		},
		columns: [
			{ fieldKey: "periodo", label: "Período", dataType: "text", required: true },
			{ fieldKey: "nro_certificado", label: "N° certificado", dataType: "text" },
			{ fieldKey: "fecha_certificacion", label: "Fecha de certificación", dataType: "date" },
			{ fieldKey: "monto_certificado", label: "Monto certificado", dataType: "currency" },
			{ fieldKey: "avance_fisico_acumulado_pct", label: "Avance físico acumulado %", dataType: "number" },
			{ fieldKey: "monto_acumulado", label: "Monto acumulado", dataType: "currency" },
			{ fieldKey: "n_expediente", label: "N° expediente", dataType: "text" },
		],
	},
	{
		key: "purchase-orders",
		name: "Órdenes de compra",
		description: "Registro de órdenes, proveedores, importes y estado de entrega.",
		linkedFolderPath: "ordenes-de-compra",
		position: 1,
		settings: {
			dataInputMethod: "both",
			manualEntryEnabled: true,
			spreadsheetTemplate: "auto",
			documentTypes: ["orden de compra", "orden de provisión"],
			extractionInstructions: "Extraer una fila por orden de compra y normalizar proveedor, moneda, totales y estado.",
			extractionRowMode: "multiple",
		},
		columns: [
			{ fieldKey: "numero_orden", label: "N° de orden", dataType: "text", required: true },
			{ fieldKey: "fecha", label: "Fecha", dataType: "date" },
			{ fieldKey: "proveedor", label: "Proveedor", dataType: "text" },
			{ fieldKey: "cuit_proveedor", label: "CUIT proveedor", dataType: "text" },
			{ fieldKey: "descripcion", label: "Descripción", dataType: "text" },
			{ fieldKey: "rubro", label: "Rubro", dataType: "text" },
			{ fieldKey: "moneda", label: "Moneda", dataType: "text" },
			{ fieldKey: "subtotal", label: "Subtotal", dataType: "currency" },
			{ fieldKey: "impuestos", label: "Impuestos", dataType: "currency" },
			{ fieldKey: "total", label: "Total", dataType: "currency" },
			{ fieldKey: "estado", label: "Estado", dataType: "text" },
			{ fieldKey: "fecha_entrega", label: "Fecha de entrega", dataType: "date" },
		],
	},
];

const MACROS: BlueprintMacro[] = [
	{
		key: "certificates-summary",
		name: "Resumen de certificados",
		description: "Certificados de todas las obras en una sola vista.",
		sourceTableKey: "certificates",
		position: 0,
		columns: TABLES[0].columns.filter((column) => ["periodo", "nro_certificado", "monto_certificado", "monto_acumulado"].includes(column.fieldKey)),
	},
	{
		key: "purchase-orders-summary",
		name: "Resumen de órdenes de compra",
		description: "Órdenes, proveedores, estados e importes de todas las obras.",
		sourceTableKey: "purchase-orders",
		position: 1,
		columns: TABLES[1].columns.filter((column) => ["numero_orden", "fecha", "proveedor", "total", "estado"].includes(column.fieldKey)),
	},
	{
		key: "progress-summary",
		name: "Avance y certificación",
		description: "Evolución física y económica por período.",
		sourceTableKey: "certificates",
		position: 2,
		columns: TABLES[0].columns.filter((column) => ["periodo", "avance_fisico_acumulado_pct", "monto_acumulado"].includes(column.fieldKey)),
	},
];

export function buildStandardConstructionBlueprint() {
	const dataFlowConfig = {
		dataFlowBuilder: getTenantDataFlowBuilderConfig(null),
	};
	const tables = TABLES.map((table) => ({
		...table,
		columns: table.columns.map((column, position) => ({ ...column, position })),
	}));
	const macros = MACROS.map((macro) => ({
		...macro,
		columns: macro.columns.map((column, position) => ({ ...column, position })),
	}));

	return {
		key: STANDARD_TENANT_BLUEPRINT_KEY,
		version: STANDARD_TENANT_BLUEPRINT_VERSION,
		label: "Construcción estándar",
		description: "Una base lista para administrar obras, documentos, certificados y compras.",
		mainTableColumns: BASE_MAIN_TABLE_COLUMNS,
		folders: [
			{ name: "Contratos", path: "contratos", position: 0 },
			{ name: "Certificados", path: "certificados", position: 1 },
			{ name: "Órdenes de compra", path: "ordenes-de-compra", position: 2 },
			{ name: "Seguros y pólizas", path: "seguros-y-polizas", position: 3 },
			{ name: "Planos", path: "planos", position: 4 },
			{ name: "Curva de avance", path: "curva-de-avance", position: 5 },
			{ name: "Fotos de obra", path: "fotos-de-obra", position: 6 },
			{ name: "Documentación técnica", path: "documentacion-tecnica", position: 7 },
		],
		tables,
		quickActions: [
			{ name: "Cargar certificado", description: "Subir o completar un certificado de obra.", folderPaths: ["certificados"], position: 0 },
			{ name: "Registrar orden de compra", description: "Cargar una orden y revisar los datos extraídos.", folderPaths: ["ordenes-de-compra"], position: 1 },
		],
		roles: [
			{ templateKey: "viewer", name: "Consulta", description: "Puede consultar obras e informes sin modificar datos.", color: "#64748b" },
			{ templateKey: "editor", name: "Carga y edición", description: "Puede cargar documentos y actualizar información operativa.", color: "#2563eb" },
			{ templateKey: "obra_manager", name: "Responsable de obra", description: "Gestiona obras, documentación y seguimiento diario.", color: "#d97706" },
		],
		macros,
		dataFlowConfig,
	};
}

export type StandardConstructionBlueprint = ReturnType<
	typeof buildStandardConstructionBlueprint
>;
