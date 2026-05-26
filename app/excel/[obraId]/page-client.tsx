'use client';

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { obraSchema, type Obra } from "../schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useParams } from "next/navigation";
import { Pencil, Eye, StickyNote, X, AlertTriangle, RotateCcw, Trash2, FilePlus2 } from "lucide-react";
import { AnimatePresence, m } from "framer-motion";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { ExcelObraName } from "@/components/excel-obra-name";
import { ExcelPageTabs } from "@/components/excel-page-tabs";
import { DemoPageTour } from "@/components/demo-tours/demo-page-tour";
import { ContextualWizard, type WizardFlow } from "@/components/ui/contextual-wizard";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
	coerceMainColumnInputValue,
	formatMainColumnValue,
} from "@/lib/main-table-columns";
import { evaluateMathExpression } from "@/lib/safe-math-expression";
import { ObraGeneralTab } from "./tabs/general-tab";
import { obraOverviewTour } from "@/lib/demo-tours/screen-tour-flows";
import {
	GUIDED_EXCEL_STAGE_PARAM,
	GUIDED_EXCEL_STAGES,
	getGuidedExcelStage,
	isGuidedExcelTour,
} from "@/lib/demo-tours/excel-guided-flow";
import type { OcrFolderLink, OcrTablaColumn, TablaDataRow } from "./tabs/file-manager/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTenantAdminStatus } from "@/hooks/use-tenant-admin-status";
import {
	DEFAULT_MAIN_TABLE_COLUMN_CONFIG,
	invalidateObrasTableSessionCache,
	type MainTableColumnConfig,
} from "@/components/form-table/configs/obras-detalle";
import {
	Sheet,
	SheetContent,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { HydratedDateText } from "@/components/ui/hydrated-date-text";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	fetchObraDetail,
	fetchObraDataFlowConfig,
	fetchDataFlowSuggestions,
	fetchMemoriaNotes,
	fetchMaterialOrders,
	fetchCertificates,
	fetchOcrLinks,
	fetchObraRecipients,
	fetchFlujoActions,
	fetchPendingDocs,
	fetchMacroTablesList,
	fetchAllMacroTableRows,
	normalizeForSearch,
	normalizeMacroTableName,
	isCertificadoContableMacroTable,
	type MemoriaNote,
	type DataFlowSuggestion,
	type DerivedCertificadosNotice,
	type DerivedCertificadosField,
	type PendingDoc,
	type ReportFinding,
	type TablaRowRecord,
	type GeneralReportCurvePoint,
	type GeneralTabReportsData,
	type MacroTableListItem,
	type MacroTableColumnItem,
	type MacroTableRowItem,
} from "@/lib/obra-queries";
import type {
	Certificate,
	NewCertificateFormState,
	MaterialOrder,
	MaterialItem,
	ObraRole,
	ObraUser,
	ObraUserRole,
	FlujoAction,
} from "./tabs/types";

const ObraFlujoTab = dynamic(
	() => import("./tabs/flujo-tab").then((mod) => mod.ObraFlujoTab),
	{
		loading: () => (
			<TabsContent value="flujo" className="space-y-6">
				<div className="p-4 text-sm text-muted-foreground">Cargando flujo?</div>
			</TabsContent>
		),
	}
);

const ObraDocumentsTab = dynamic(
	() => import("./tabs/documents-tab").then((mod) => mod.ObraDocumentsTab),
	{
		loading: () => (
			<div className="flex h-[600px] animate-pulse gap-4">
				<div className="w-64 shrink-0 rounded-lg border bg-stone-100" />
				<div className="flex-1 rounded-lg border bg-stone-100" />
			</div>
		),
	}
);

const InsurancePoliciesTab = dynamic(
	() => import("./tabs/insurance-policies-tab").then((mod) => mod.InsurancePoliciesTab),
	{
		loading: () => (
			<div className="h-[420px] animate-pulse rounded-lg border bg-stone-100" />
		),
	}
);

const EMPTY_GENERAL_REPORTS_DATA: GeneralTabReportsData = { findings: [], curve: null };
const EMPTY_DATA_FLOW_SUGGESTIONS: DataFlowSuggestion[] = [];
const EMPTY_MATERIAL_ORDERS: MaterialOrder[] = [];
const EMPTY_OBRA_ROLES: ObraRole[] = [];
const EMPTY_OBRA_USERS: ObraUser[] = [];
const EMPTY_OBRA_USER_ROLES: ObraUserRole[] = [];
const EMPTY_FLUJO_ACTIONS: FlujoAction[] = [];

const certificateFormDefault: NewCertificateFormState = {
	n_exp: "",
	n_certificado: "",
	monto: "",
	mes: "",
	estado: "CERTIFICADO",
};

const emptyObra: Obra = {
	id: "",
	n: 1,
	designacionYUbicacion: "",
	supDeObraM2: 0,
	entidadContratante: "",
	mesBasicoDeContrato: "",
	iniciacion: "",
	contratoMasAmpliaciones: 0,
	certificadoALaFecha: 0,
	saldoACertificar: 0,
	segunContrato: 0,
	prorrogasAcordadas: 0,
	plazoTotal: 0,
	plazoTransc: 0,
	porcentaje: 0,
	customData: {},
	onFinishFirstMessage: null,
	onFinishSecondMessage: null,
	onFinishSecondSendAt: null,
};

const DOCUMENTS_BUCKET = "obra-documents";

// Local types not exported from lib
type CurveRuleConfig = {
	mappings?: {
		recommendations?: {
			certTableId?: string;
			montoAcumuladoColumnKey?: string;
			dateOrPeriodColumnKey?: string;
		};
		curve?: {
			planTableId?: string;
			resumenTableId?: string;
			measurementTableId?: string;
			plan?: {
				startPeriod?: string;
			};
		};
		unpaidCerts?: {
			certTableId?: string;
			issuedAtColumnKey?: string;
		};
		inactivity?: {
			certTableId?: string;
			certIssuedAtColumnKey?: string;
		};
		monthlyMissingCert?: {
			certTableId?: string;
			certIssuedAtColumnKey?: string;
		};
	};
};

type DefaultFolder = {
	id: string;
	name: string;
	path: string;
	isOcr?: boolean;
	dataInputMethod?: "ocr" | "manual" | "both";
};

type QuickAction = {
	id: string;
	name: string;
	description?: string | null;
	folderPaths: string[];
	obraId?: string | null;
};

type ObraTabla = {
	id: string;
	name: string;
	settings: Record<string, unknown>;
	columns: OcrTablaColumn[];
};

const toLocalDateTimeValue = (value: string | null) => {
	if (!value) return null;
	const hasTimezone = /(?:[Zz]|[+-]\d{2}:\d{2})$/.test(value);
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	if (!hasTimezone) {
		return value.slice(0, 16);
	}
	const offset = date.getTimezoneOffset();
	const local = new Date(date.getTime() - offset * 60_000);
	return local.toISOString().slice(0, 16);
};

const toIsoDateTime = (value: string | null) => {
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString();
};

async function fetchPermissionChecks(keys: string[]): Promise<Record<string, boolean>> {
	const params = new URLSearchParams();
	for (const key of keys) params.append("key", key);
	const response = await fetch(`/api/permissions/check?${params.toString()}`, {
		cache: "no-store",
	});
	const payload = await response.json().catch(() => ({}));
	if (!response.ok) {
		throw new Error(payload.error ?? "No se pudieron consultar los permisos");
	}
	return payload.permissions ?? {};
}

async function fetchFindings(obraId: string, periodKey?: string): Promise<ReportFinding[]> {
	const query = periodKey ? `?period=${encodeURIComponent(periodKey)}` : "";
	const response = await fetch(`/api/obras/${obraId}/findings${query}`);
	if (!response.ok) return [];
	const data = await response.json().catch(() => ({}));
	return Array.isArray(data?.findings) ? (data.findings as ReportFinding[]) : [];
}

async function fetchTablaRowsAll(
	obraId: string,
	tablaId: string,
	maxPages = 20
): Promise<TablaRowRecord[]> {
	const allRows: TablaRowRecord[] = [];
	for (let page = 1; page <= maxPages; page++) {
		const response = await fetch(
			`/api/obras/${obraId}/tablas/${tablaId}/rows?page=${page}&limit=200&includeCount=0`
		);
		if (!response.ok) break;
		const payload = await response.json().catch(() => ({}));
		const rows = Array.isArray(payload?.rows) ? (payload.rows as TablaRowRecord[]) : [];
		allRows.push(...rows);
		const hasNext = Boolean(payload?.pagination?.hasNextPage);
		if (!hasNext) break;
	}
	return allRows;
}

async function fetchRulesConfig(obraId: string): Promise<CurveRuleConfig | null> {
	const response = await fetch(`/api/obras/${obraId}/rules`);
	if (!response.ok) return null;
	const payload = await response.json().catch(() => ({}));
	if (!payload || typeof payload !== "object") return null;
	return (payload as { config?: CurveRuleConfig }).config ?? null;
}

function normalizeText(value: string): string {
	return value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.trim();
}

function isCertificadosExtraidosFolder(folderName: string): boolean {
	const normalized = normalizeText(folderName)
		.replace(/\\/g, "/")
		.replace(/[_\s]+/g, "-");

	return (
		normalized.includes("documentos/certificados/certificados-extraidos") ||
		normalized.includes("certificados/certificados-extraidos") ||
		(normalized.includes("certificados") && normalized.includes("extraidos"))
	);
}

function isCertificadoResumenLink(link: OcrFolderLink): boolean {
	const keySet = new Set((link.columns ?? []).map((column) => normalizeFieldKey(column.fieldKey)));
	return (
		keySet.has("monto_acumulado") &&
		keySet.has("monto_certificado") &&
		(keySet.has("periodo") || keySet.has("fecha_certificacion")) &&
		!keySet.has("item_code") &&
		!keySet.has("avance_mensual_pct")
	);
}

function parsePercent(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	const raw = String(value ?? "").trim();
	if (!raw) return null;
	const stripped = raw.replace(/[%\s$]/g, "");
	const lastDot = stripped.lastIndexOf(".");
	const lastComma = stripped.lastIndexOf(",");
	let normalized = stripped;
	if (lastComma > lastDot) {
		normalized = stripped.replace(/\./g, "").replace(",", ".");
	} else if (lastDot > lastComma) {
		normalized = stripped.replace(/,/g, "");
	}
	const parsed = Number.parseFloat(normalized);
	return Number.isFinite(parsed) ? parsed : null;
}

function parseCurrencyLike(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	const raw = String(value ?? "").trim();
	if (!raw) return null;
	const stripped = raw.replace(/[^\d,.-]/g, "");
	if (!stripped) return null;
	const lastDot = stripped.lastIndexOf(".");
	const lastComma = stripped.lastIndexOf(",");
	const normalized =
		lastComma > lastDot
			? stripped.replace(/\./g, "").replace(",", ".")
			: stripped.replace(/,/g, "");
	const parsed = Number.parseFloat(normalized);
	return Number.isFinite(parsed) ? parsed : null;
}

function parseDateTimestamp(value: unknown): number | null {
	const raw = String(value ?? "").trim();
	if (!raw) return null;
	const normalized = normalizeText(raw).replace(/\./g, "");

	const ymd = normalized.match(/^(\d{4})[/-](\d{1,2})(?:[/-](\d{1,2}))?$/);
	if (ymd) {
		const year = Number.parseInt(ymd[1], 10);
		const month = Number.parseInt(ymd[2], 10) - 1;
		const day = Number.parseInt(ymd[3] ?? "1", 10);
		return Date.UTC(year, month, day);
	}

	const dmy = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
	if (dmy) {
		const day = Number.parseInt(dmy[1], 10);
		const month = Number.parseInt(dmy[2], 10) - 1;
		const rawYear = Number.parseInt(dmy[3], 10);
		const year = rawYear < 100 ? 2000 + rawYear : rawYear;
		return Date.UTC(year, month, day);
	}

	const parsed = new Date(raw);
	return Number.isNaN(parsed.getTime())
		? null
		: Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

type CertificadosRecommendationMapping = {
	montoAcumuladoColumnKey?: string | null;
	dateOrPeriodColumnKey?: string | null;
};

const DERIVED_CERTIFICADOS_FIELD_TO_DATA_FLOW_FIELD: Record<DerivedCertificadosField, string> = {
	certificadoALaFecha: "certificado_a_la_fecha",
	saldoACertificar: "saldo_a_certificar",
	porcentaje: "porcentaje",
};

const DATA_FLOW_DERIVED_CERTIFICADOS_FIELDS = new Set(
	Object.values(DERIVED_CERTIFICADOS_FIELD_TO_DATA_FLOW_FIELD),
);

function useDeferredGeneralExtrasReady({
	obraId,
	isGeneralTabActive,
	isValidObraId,
	isObraLoaded,
}: {
	obraId: string | undefined;
	isGeneralTabActive: boolean;
	isValidObraId: boolean;
	isObraLoaded: boolean;
}) {
	const [deferredGeneralQueriesObraId, setDeferredGeneralQueriesObraId] = useState<string | null>(null);
	const isReady = deferredGeneralQueriesObraId === obraId;

	useEffect(() => {
		if (
			!isValidObraId ||
			!obraId ||
			!isGeneralTabActive ||
			!isObraLoaded ||
			isReady
		) {
			return;
		}

		const timeoutId = window.setTimeout(() => {
			setDeferredGeneralQueriesObraId(obraId);
		}, 0);

		return () => window.clearTimeout(timeoutId);
	}, [
		isGeneralTabActive,
		isObraLoaded,
		isReady,
		isValidObraId,
		obraId,
	]);

	return isReady;
}

function normalizeOptionalMappingKey(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function hasValue(value: unknown): boolean {
	if (value == null) return false;
	if (typeof value === "string") return value.trim().length > 0;
	return true;
}

function getCertificadoDateOrPeriodValue(
	rowData: Record<string, unknown> | null | undefined,
	options?: CertificadosRecommendationMapping,
): unknown {
	const configuredColumnKey = normalizeOptionalMappingKey(options?.dateOrPeriodColumnKey);
	if (configuredColumnKey) {
		return getRowFieldValueByCandidates(rowData, [configuredColumnKey]);
	}
	return (
		getRowFieldValueByCandidates(
			rowData,
			["fecha_certificacion", "fecha", "issued_at", "date"],
			[["fecha", "cert"], ["fecha"]],
		) ??
		getRowFieldValueByCandidates(
			rowData,
			["periodo", "periodo_key", "period", "mes"],
			[["periodo"], ["period"], ["mes"]],
		)
	);
}

function getCertificadoMontoAcumuladoValue(
	rowData: Record<string, unknown> | null | undefined,
	options?: CertificadosRecommendationMapping,
): number | null {
	const configuredColumnKey = normalizeOptionalMappingKey(options?.montoAcumuladoColumnKey);
	if (configuredColumnKey) {
		const configuredValue = parseCurrencyLike(
			getRowFieldValueByCandidates(rowData, [configuredColumnKey]),
		);
		if (configuredValue != null) return configuredValue;
	}
	return parseCurrencyLike(
		getRowFieldValueByCandidates(
			rowData,
			["monto_acumulado", "monto_acumulado_total", "acumulado", "total_acumulado"],
			[["monto", "acumul"], ["acumulado"]],
		),
	);
}

function getCertificadoMontoValue(
	rowData: Record<string, unknown> | null | undefined,
	options?: CertificadosRecommendationMapping,
): number | null {
	const montoAcumulado = getCertificadoMontoAcumuladoValue(rowData, options);
	if (montoAcumulado != null) return montoAcumulado;
	return parseCurrencyLike(
		getRowFieldValueByCandidates(
			rowData,
			["monto_certificado", "monto", "importe", "total"],
			[["monto", "cert"], ["importe"]],
		),
	);
}

function getCertificadoRowSortValue(
	row: TablaDataRow,
	fallbackIndex: number,
	options?: CertificadosRecommendationMapping,
): number {
	const rowData = (row.data as Record<string, unknown> | null | undefined) ?? null;
	const dateOrPeriod = getCertificadoDateOrPeriodValue(rowData, options);
	const fechaTs = parseDateTimestamp(dateOrPeriod);
	if (fechaTs != null) return fechaTs;

	if (hasValue(dateOrPeriod)) {
		const parsed = parseMonthOrder(dateOrPeriod, fallbackIndex);
		if (parsed.order >= 1000) {
			const year = Math.floor(parsed.order / 12);
			const month = parsed.order % 12;
			return Date.UTC(year, month, 1);
		}
		return parsed.order;
	}

	return -fallbackIndex;
}

function sortCertificadosExtraidosRows(
	rows: TablaDataRow[],
	options?: CertificadosRecommendationMapping,
): TablaDataRow[] {
	return rows
		.map((row, index) => ({ row, index }))
		.sort((a, b) => {
			const sortA = getCertificadoRowSortValue(a.row, a.index, options);
			const sortB = getCertificadoRowSortValue(b.row, b.index, options);
			return sortB - sortA;
		})
		.map((entry) => entry.row);
}

const roundDerivedValue = (value: number) =>
	Math.round((value + Number.EPSILON) * 100) / 100;

const isUnsetDerivedNumber = (value: unknown) => {
	const numeric = Number(value ?? 0);
	return !Number.isFinite(numeric) || Math.abs(numeric) < 0.000001;
};

const approximatelyEqual = (a: unknown, b: unknown, epsilon = 0.01) => {
	const numA = Number(a ?? 0);
	const numB = Number(b ?? 0);
	if (!Number.isFinite(numA) || !Number.isFinite(numB)) return false;
	return Math.abs(numA - numB) <= epsilon;
};

const MONTH_INDEX: Record<string, number> = {
	ene: 0,
	enero: 0,
	feb: 1,
	febrero: 1,
	mar: 2,
	marzo: 2,
	abr: 3,
	abril: 3,
	may: 4,
	mayo: 4,
	jun: 5,
	junio: 5,
	jul: 6,
	julio: 6,
	ago: 7,
	agosto: 7,
	sep: 8,
	sept: 8,
	septiembre: 8,
	oct: 9,
	octubre: 9,
	nov: 10,
	noviembre: 10,
	dic: 11,
	diciembre: 11,
	jan: 0,
	apr: 3,
	aug: 7,
	dec: 11,
};

function parseMonthOrder(rawValue: unknown, fallback: number): { label: string; order: number } {
	const raw = String(rawValue ?? "").trim();
	if (!raw) return { label: `Mes ${fallback + 1}`, order: fallback };

	const norm = normalizeText(raw).replace(/\./g, "");
	const mesN = norm.match(/mes\s*(\d{1,3})/);
	if (mesN) {
		const n = Number.parseInt(mesN[1], 10);
		return { label: `Mes ${n}`, order: n };
	}

	const ymd = norm.match(/^(\d{4})[/-](\d{1,2})$/);
	if (ymd) {
		const year = Number.parseInt(ymd[1], 10);
		const month = Number.parseInt(ymd[2], 10) - 1;
		return { label: raw, order: year * 12 + Math.max(0, Math.min(11, month)) };
	}

	const dmy = norm.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
	if (dmy) {
		const month = Number.parseInt(dmy[2], 10) - 1;
		const yearRaw = Number.parseInt(dmy[3], 10);
		const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
		return { label: raw, order: year * 12 + Math.max(0, Math.min(11, month)) };
	}

	const monthYear = norm.match(/^(\d{1,2})[/-](\d{2,4})$/);
	if (monthYear) {
		const month = Number.parseInt(monthYear[1], 10) - 1;
		const yearRaw = Number.parseInt(monthYear[2], 10);
		const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
		return { label: raw, order: year * 12 + Math.max(0, Math.min(11, month)) };
	}

	const dayDeMonthYear = norm.match(
		/(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|sept|octubre|noviembre|diciembre)\s+de\s+(\d{2,4})/
	);
	if (dayDeMonthYear) {
		const month = MONTH_INDEX[dayDeMonthYear[2]];
		if (month != null) {
			const yearRaw = Number.parseInt(dayDeMonthYear[3], 10);
			const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
			return { label: raw, order: year * 12 + month };
		}
	}

	const monYear = norm.match(/([a-z]{3})[-\s_/]*(\d{2,4})/);
	if (monYear) {
		const month = MONTH_INDEX[monYear[1]];
		if (month != null) {
			const yearRaw = Number.parseInt(monYear[2], 10);
			const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
			return { label: raw, order: year * 12 + month };
		}
	}

	const fullMonthYear = norm.match(
		/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|sept|octubre|noviembre|diciembre)[\s\-_./]*(\d{2,4})/
	);
	if (fullMonthYear) {
		const month = MONTH_INDEX[fullMonthYear[1]];
		if (month != null) {
			const yearRaw = Number.parseInt(fullMonthYear[2], 10);
			const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
			return { label: raw, order: year * 12 + month };
		}
	}

	const mesDePattern = norm.match(
		/mes\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|sept|octubre|noviembre|diciembre)\s+(\d{2,4})/
	);
	if (mesDePattern) {
		const month = MONTH_INDEX[mesDePattern[1]];
		if (month != null) {
			const yearRaw = Number.parseInt(mesDePattern[2], 10);
			const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
			return { label: raw, order: year * 12 + month };
		}
	}

	return { label: raw, order: fallback };
}

type DerivedCertificadosMetrics = {
	certificadoALaFecha: number;
	saldoACertificar: number | null;
	porcentaje: number | null;
	blockedFieldKeys: Array<"saldoACertificar" | "porcentaje">;
	warningMessage: string | null;
};

function getLatestCertificadoMontoAcumulado(
	rows: TablaDataRow[],
	options?: CertificadosRecommendationMapping,
): number | null {
	const sorted = rows
		.map((row, index) => ({ row, index }))
		.sort(
			(a, b) =>
				getCertificadoRowSortValue(b.row, b.index, options) -
				getCertificadoRowSortValue(a.row, a.index, options),
		)
		.map((entry) => entry.row);

	let latestAcumulado: number | null = null;
	let acumuladoFallbackFromMontos = 0;
	let hasMontoCertificado = false;

	for (const row of sorted) {
		const rowData = (row.data as Record<string, unknown> | null | undefined) ?? null;
		if (latestAcumulado == null) {
			const montoAcumulado = getCertificadoMontoAcumuladoValue(rowData, options);
			if (montoAcumulado != null) {
				latestAcumulado = roundDerivedValue(montoAcumulado);
			}
		}
		const montoCertificado = parseCurrencyLike(
			getRowFieldValueByCandidates(
				rowData,
				["monto_certificado", "monto", "importe", "total"],
				[["monto", "cert"], ["importe"]],
			),
		);
		if (montoCertificado != null) {
			acumuladoFallbackFromMontos += montoCertificado;
			hasMontoCertificado = true;
		}
	}

	if (latestAcumulado != null) return latestAcumulado;
	if (hasMontoCertificado) return roundDerivedValue(acumuladoFallbackFromMontos);
	return null;
}

function getLatestCertificadoSourceLabel(
	rows: TablaDataRow[],
	options?: CertificadosRecommendationMapping,
): string | null {
	const sorted = rows
		.map((row, index) => ({ row, index }))
		.sort(
			(a, b) =>
				getCertificadoRowSortValue(b.row, b.index, options) -
				getCertificadoRowSortValue(a.row, a.index, options),
		)
		.map((entry) => entry.row);

	for (const [index, row] of sorted.entries()) {
		const rowData = (row.data as Record<string, unknown> | null | undefined) ?? null;
		const monto = getCertificadoMontoValue(rowData, options);
		if (monto == null) continue;

		const dateOrPeriod = getCertificadoDateOrPeriodValue(rowData, options);
		if (typeof dateOrPeriod === "string" && dateOrPeriod.trim()) return dateOrPeriod.trim();
		if (hasValue(dateOrPeriod)) return parseMonthOrder(dateOrPeriod, index).label;
	}

	return null;
}

function isMeaningfulCertificadoResumenRow(
	row: TablaDataRow,
	options?: CertificadosRecommendationMapping,
): boolean {
	const rowData = (row.data as Record<string, unknown> | null | undefined) ?? null;
	const monto = getCertificadoMontoValue(rowData, options);
	const dateOrPeriod = getCertificadoDateOrPeriodValue(rowData, options);

	return hasValue(dateOrPeriod) && monto != null;
}

/**
 * @deprecated Data-flow is the authority for certificate-derived metrics when configured.
 * Keep this as a temporary fallback for obras without data-flow ownership.
 */
function computeDerivedCertificadosMetrics(
	rows: TablaDataRow[],
	contratoMasAmpliaciones: unknown,
	options?: CertificadosRecommendationMapping,
	certificadoOverride?: unknown,
): DerivedCertificadosMetrics | null {
	const latestCertificado = certificadoOverride != null
		? parseCurrencyLike(certificadoOverride)
		: getLatestCertificadoMontoAcumulado(rows, options);
	if (latestCertificado == null) return null;

	const contrato = parseCurrencyLike(contratoMasAmpliaciones) ?? Number(contratoMasAmpliaciones ?? 0) ?? 0;
	const safeContrato = Number.isFinite(contrato) ? contrato : 0;

	if (safeContrato <= 0) {
		return {
			certificadoALaFecha: roundDerivedValue(latestCertificado),
			saldoACertificar: null,
			porcentaje: null,
			blockedFieldKeys: ["saldoACertificar", "porcentaje"],
			warningMessage:
				"Completá Contrato + ampliaciones para poder calcular Saldo a certificar y Porcentaje de avance desde certificados.",
		};
	}

	if (latestCertificado > safeContrato) {
		return {
			certificadoALaFecha: roundDerivedValue(latestCertificado),
			saldoACertificar: null,
			porcentaje: null,
			blockedFieldKeys: ["saldoACertificar", "porcentaje"],
			warningMessage:
				"El último certificado acumulado supera Contrato + ampliaciones. Revisá el contrato antes de aceptar Saldo a certificar y Porcentaje de avance.",
		};
	}

	const saldo = roundDerivedValue(safeContrato - latestCertificado);
	const porcentaje = roundDerivedValue((latestCertificado * 100) / safeContrato);

	return {
		certificadoALaFecha: roundDerivedValue(latestCertificado),
		saldoACertificar: saldo,
		porcentaje,
		blockedFieldKeys: [],
		warningMessage: null,
	};
}

function addMonths(periodKey: string, offset: number): string | null {
	const match = periodKey.match(/^(\d{4})-(\d{2})$/);
	if (!match) return null;
	const year = Number.parseInt(match[1], 10);
	const month = Number.parseInt(match[2], 10) - 1;
	const date = new Date(Date.UTC(year, month + offset, 1));
	if (!Number.isFinite(date.getTime())) return null;
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function periodKeyFromSortOrder(sortOrder: number): string | null {
	if (!Number.isInteger(sortOrder) || sortOrder < 1000) return null;
	return `${Math.floor(sortOrder / 12)}-${String((sortOrder % 12) + 1).padStart(2, "0")}`;
}

function periodKeyFromValue(value: unknown): string | null {
	if (!hasValue(value)) return null;
	const parsed = parseMonthOrder(value, 0);
	return periodKeyFromSortOrder(parsed.order);
}

function getCurveMonthNumber(rawValue: unknown): number | null {
	if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
		return Math.trunc(rawValue);
	}
	const normalized = normalizeText(String(rawValue ?? ""));
	const numericOnly = normalized.match(/^\d{1,3}$/);
	if (numericOnly) {
		return Number.parseInt(numericOnly[0], 10);
	}
	const mesN = normalized.match(/mes\s*(\d{1,3})/);
	if (!mesN) return null;
	const monthNumber = Number.parseInt(mesN[1], 10);
	return Number.isFinite(monthNumber) ? monthNumber : null;
}

function detectCurveMonthIndexBase(curvaRows: TablaRowRecord[]): 0 | 1 {
	for (const row of curvaRows) {
		const rowData = (row.data as Record<string, unknown> | null | undefined) ?? null;
		const periodo =
			getRowFieldValueByCandidates(
				rowData,
				["periodo", "periodo_key", "period", "mes"],
				[["periodo"], ["period"], ["mes"]],
			);
		if (getCurveMonthNumber(periodo) === 0) return 0;
	}
	return 1;
}

function periodLabel(periodKey: string): string {
	const match = periodKey.match(/^(\d{4})-(\d{2})$/);
	if (!match) return periodKey;
	const year = Number.parseInt(match[1], 10);
	const month = Number.parseInt(match[2], 10) - 1;
	const date = new Date(Date.UTC(year, month, 1));
	return date.toLocaleDateString("es-AR", { month: "short", year: "numeric", timeZone: "UTC" });
}

function curveSortOrderToPeriodKey(sortOrder: number): string | null {
	if (!Number.isInteger(sortOrder) || sortOrder < 1000) return null;
	const year = Math.floor(sortOrder / 12);
	const monthIndex = sortOrder % 12;
	if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11) return null;
	return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function normalizeFieldKey(value: string): string {
	return normalizeText(value)
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");
}

function getRowFieldValueByCandidates(
	rowData: Record<string, unknown> | null | undefined,
	candidates: string[],
	tokenGroups: string[][] = [],
): unknown {
	if (!rowData || typeof rowData !== "object") return null;
	for (const key of candidates) {
		if (key in rowData) return rowData[key];
	}

	const entries = Object.entries(rowData);
	const normalizedEntries = entries.map(([key, value]) => [normalizeFieldKey(key), value] as const);
	const normalizedCandidates = new Set(candidates.map((key) => normalizeFieldKey(key)));
	for (const [key, value] of normalizedEntries) {
		if (normalizedCandidates.has(key)) return value;
	}

	if (tokenGroups.length > 0) {
		const normalizedTokenGroups = tokenGroups.map((group) =>
			group.map((token) => normalizeFieldKey(token)),
		);
		for (const [key, value] of normalizedEntries) {
			const tokenSet = key.split("_").filter(Boolean);
			for (const group of normalizedTokenGroups) {
				if (group.every((token) => tokenSet.some((entry) => entry.includes(token)))) {
					return value;
				}
			}
		}
	}

	return null;
}

function parseCertificateSequence(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		return Math.trunc(value);
	}
	const raw = String(value ?? "").trim();
	if (!raw) return null;
	const match = raw.match(/-?\d+/);
	if (!match) return null;
	const parsed = Number.parseInt(match[0], 10);
	return Number.isFinite(parsed) ? parsed : null;
}

function buildCurvePoints(
	curvaRows: TablaRowRecord[],
	resumenRows: TablaRowRecord[],
	options?: { curveStartPeriod?: string | null }
): GeneralReportCurvePoint[] {
	const points = new Map<string, GeneralReportCurvePoint>();
	const curveStartPeriod =
		typeof options?.curveStartPeriod === "string" && /^\d{4}-\d{2}$/.test(options.curveStartPeriod)
			? options.curveStartPeriod
			: null;
	const curveMonthIndexBase = detectCurveMonthIndexBase(curvaRows);
	const usesRelativePlanMonths =
		curveStartPeriod != null &&
		curvaRows.some((row) => {
			const rowData = (row.data as Record<string, unknown> | null | undefined) ?? null;
			const periodo = getRowFieldValueByCandidates(
				rowData,
				["periodo", "periodo_key", "period", "mes"],
				[["periodo"], ["period"], ["mes"]],
			);
			return getCurveMonthNumber(periodo) != null;
		});

	curvaRows.forEach((row, index) => {
		const rowData = (row.data as Record<string, unknown> | null | undefined) ?? null;
		const periodo = getRowFieldValueByCandidates(
			rowData,
			["periodo", "periodo_key", "period", "mes"],
			[["periodo"], ["period"], ["mes"]],
		);
		const avance = parsePercent(
			getRowFieldValueByCandidates(
				rowData,
				["avance_acumulado_pct", "avance_acum_pct", "avance_acumulado", "avance_pct"],
				[["avance", "acum"], ["acumulado"]],
			),
		);
		if (!periodo || avance == null) return;
		const raw = String(periodo ?? "").trim();
		const monthNumber = getCurveMonthNumber(raw);
		const monthOffset =
			monthNumber == null ? null : Math.max(0, monthNumber - curveMonthIndexBase);
		const periodFromMesN =
			monthOffset != null && curveStartPeriod
				? addMonths(curveStartPeriod, monthOffset)
				: null;
		const parsed = parseMonthOrder(periodo, index);
		const periodKey = periodFromMesN ?? (parsed.order >= 1000 ? `${Math.floor(parsed.order / 12)}-${String((parsed.order % 12) + 1).padStart(2, "0")}` : null);
		const label = periodKey ? periodLabel(periodKey) : parsed.label;
		const order = periodKey
			? (() => {
				const [y, m] = periodKey.split("-");
				return Number.parseInt(y, 10) * 12 + (Number.parseInt(m, 10) - 1);
			})()
			: parsed.order;
		const key = periodKey ?? (normalizeText(label) || `plan-${index}`);
		const current = points.get(key);
		if (current) {
			current.planPct = avance;
			current.periodKey = current.periodKey ?? periodKey;
			current.sortOrder = Math.min(current.sortOrder, order);
		} else {
			points.set(key, {
				label,
				planPct: avance,
				realPct: null,
				sortOrder: order,
				periodKey,
			});
		}
	});

	const normalizedResumenRows = usesRelativePlanMonths
		? [...resumenRows]
			.map((row, index) => {
				const rowData = (row.data as Record<string, unknown> | null | undefined) ?? null;
				const explicitSequence = parseCertificateSequence(
					getRowFieldValueByCandidates(
						rowData,
						["n_certificado", "nro_certificado", "numero_certificado", "certificado"],
						[["certificado"], ["cert"]],
					),
				);
				const periodSource =
					getRowFieldValueByCandidates(
						rowData,
						["fecha_certificacion", "fecha", "issued_at", "date"],
						[["fecha", "cert"], ["fecha"]],
					) ??
					getRowFieldValueByCandidates(
						rowData,
						["periodo", "periodo_key", "period", "mes"],
						[["periodo"], ["period"], ["mes"]],
					);
				const parsedPeriod = parseMonthOrder(periodSource, index);
				return { row, index, explicitSequence, parsedPeriod };
			})
			.sort((a, b) => {
				if (a.explicitSequence != null && b.explicitSequence != null) {
					return a.explicitSequence - b.explicitSequence;
				}
				if (a.explicitSequence != null) return -1;
				if (b.explicitSequence != null) return 1;
				return a.parsedPeriod.order - b.parsedPeriod.order;
			})
		: resumenRows.map((row, index) => ({
			row,
			index,
			explicitSequence: null as number | null,
			parsedPeriod: parseMonthOrder(null, index),
		}));

	normalizedResumenRows.forEach(({ row, index, explicitSequence }, resumenIndex) => {
		const rowData = (row.data as Record<string, unknown> | null | undefined) ?? null;
		const avance = parsePercent(
			getRowFieldValueByCandidates(
				rowData,
				[
					"avance_fisico_acumulado_pct",
					"avance_fisico_acum_pct",
					"avance_fisico_acumulado",
					"avance_acumulado_pct",
					"avance_acum_pct",
				],
				[["avance", "fisico", "acum"], ["avance", "acum"]],
			),
		);
		if (avance == null) return;
		const periodSource =
			getRowFieldValueByCandidates(
				rowData,
				["fecha_certificacion", "fecha", "issued_at", "date"],
				[["fecha", "cert"], ["fecha"]],
			) ??
			getRowFieldValueByCandidates(
				rowData,
				["periodo", "periodo_key", "period", "mes"],
				[["periodo"], ["period"], ["mes"]],
			);
		if (!periodSource && !usesRelativePlanMonths) return;
		const parsed = parseMonthOrder(periodSource, index);
		const certSequence = explicitSequence ?? resumenIndex + 1;
		const relativePeriodKey =
			usesRelativePlanMonths && curveStartPeriod
				? addMonths(
					curveStartPeriod,
					Math.max(0, certSequence - curveMonthIndexBase),
				)
				: null;
		const periodKey =
			relativePeriodKey ??
			(parsed.order >= 1000
				? `${Math.floor(parsed.order / 12)}-${String((parsed.order % 12) + 1).padStart(2, "0")}`
				: null);
		const label = periodKey ? periodLabel(periodKey) : parsed.label;
		const order = periodKey
			? (() => {
				const [y, m] = periodKey.split("-");
				return Number.parseInt(y, 10) * 12 + (Number.parseInt(m, 10) - 1);
			})()
			: parsed.order;
		const key = periodKey ?? (normalizeText(label) || `real-${index}`);
		const current = points.get(key);
		if (current) {
			current.realPct = avance;
			current.periodKey = current.periodKey ?? periodKey;
			current.sortOrder = Math.min(current.sortOrder, order);
		} else {
			points.set(key, {
				label,
				planPct: null,
				realPct: avance,
				sortOrder: order,
				periodKey,
			});
		}
	});

	if (curveStartPeriod) {
		const [y, m] = curveStartPeriod.split("-");
		const startOrder = Number.parseInt(y, 10) * 12 + (Number.parseInt(m, 10) - 1);
		const existing = points.get(curveStartPeriod);
		if (existing) {
			if (existing.realPct == null) {
				existing.realPct = 0;
			}
			existing.sortOrder = Math.min(existing.sortOrder, startOrder);
		} else {
			points.set(curveStartPeriod, {
				label: periodLabel(curveStartPeriod),
				planPct: null,
				realPct: 0,
				sortOrder: startOrder,
				periodKey: curveStartPeriod,
			});
		}
	}

	const sortedPoints = Array.from(points.values())
		.toSorted((a, b) => a.sortOrder - b.sortOrder)
		.map((point) => ({
			...point,
			periodKey: point.periodKey ?? curveSortOrderToPeriodKey(point.sortOrder),
		}));

	const canFillMissingMonths =
		sortedPoints.length > 1 && sortedPoints.every((point) => point.periodKey != null);
	if (!canFillMissingMonths) {
		return sortedPoints;
	}

	const pointsByOrder = new Map(sortedPoints.map((point) => [point.sortOrder, point] as const));
	const minOrder = sortedPoints[0]?.sortOrder ?? 0;
	const maxOrder = sortedPoints[sortedPoints.length - 1]?.sortOrder ?? minOrder;
	const continuousPoints: GeneralReportCurvePoint[] = [];
	const maxRealSortOrder = usesRelativePlanMonths
		? sortedPoints.reduce<number | null>((max, point) => {
			if (point.realPct == null) return max;
			return max == null || point.sortOrder > max ? point.sortOrder : max;
		}, null)
		: null;

	for (let order = minOrder; order <= maxOrder; order += 1) {
		const existing = pointsByOrder.get(order);
		const periodKey = curveSortOrderToPeriodKey(order);
		if (!periodKey) continue;

		continuousPoints.push(
			existing ?? {
				label: periodLabel(periodKey),
				planPct: null,
				realPct:
					maxRealSortOrder != null && order <= maxRealSortOrder ? 0 : null,
				sortOrder: order,
				periodKey,
			}
		);
	}

	return continuousPoints;
}

const MAIN_FORMULA_REF_PATTERN = /\[([a-zA-Z0-9_]+)\]/g;

const toNumericValue = (value: unknown): number => {
	if (typeof value === "number") return Number.isFinite(value) ? value : 0;
	if (typeof value === "string") {
		const parsed = Number(value.replace(",", "."));
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
};

// Formula compiler cache - extracts formula references once and reuses the parsed shape.
const formulaCache = new Map<string, { fieldNames: string[]; evaluate: (values: number[]) => number | null }>();

const compileFormula = (formula: string): { fieldNames: string[]; evaluate: (values: number[]) => number | null } | null => {
	const trimmed = formula.trim();
	if (!trimmed) return null;

	const cached = formulaCache.get(trimmed);
	if (cached) return cached;

	// Extract field names in order of appearance
	const fieldNames: string[] = [];
	const seen = new Set<string>();
	let match: RegExpExecArray | null;
	const pattern = new RegExp(MAIN_FORMULA_REF_PATTERN.source, 'g');
	while ((match = pattern.exec(trimmed)) !== null) {
		const fieldName = match[1];
		if (!seen.has(fieldName)) {
			seen.add(fieldName);
			fieldNames.push(fieldName);
		}
	}

	// Build expression template with indexed placeholders
	let placeholderIndex = 0;
	const fieldIndexMap = new Map<string, number>();
	const expressionTemplate = trimmed.replace(MAIN_FORMULA_REF_PATTERN, (_full, fieldName) => {
		if (!fieldIndexMap.has(fieldName)) {
			fieldIndexMap.set(fieldName, placeholderIndex++);
		}
		return `__v${fieldIndexMap.get(fieldName)}__`;
	});

	// Validate expression structure (only allow safe math operations)
	const testExpression = expressionTemplate.replace(/__v\d+__/g, '0');
	if (!/^[0-9+\-*/().\s]+$/.test(testExpression)) {
		return null;
	}

	const compiled = {
		fieldNames,
		evaluate: (values: number[]): number | null => {
			const variables = Object.fromEntries(
				values.map((value, index) => [`__v${index}__`, value])
			);
			return evaluateMathExpression(expressionTemplate, variables).value;
		}
	};

	formulaCache.set(trimmed, compiled);
	return compiled;
};

const evaluateMainFormula = (
	formula: string,
	source: Record<string, unknown>
): number | null => {
	const compiled = compileFormula(formula);
	if (!compiled) return null;

	const values = compiled.fieldNames.map(fieldName => toNumericValue(source[fieldName]));
	return compiled.evaluate(values);
};

type ObraDetailPageClientProps = {
	initialObraId?: string;
	initialTab?: string;
};

function ObraDetailPageContent({
	initialObraId,
	initialTab = "general",
}: ObraDetailPageClientProps) {
	const params = useParams();
	const queryClient = useQueryClient();
	const { push, replace } = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const queryParams = useMemo(
		() => new URLSearchParams(searchParams?.toString() ?? ""),
		[searchParams],
	);
	const isMobile = useIsMobile();
	const {
		isAdmin: isTenantAdmin,
		isLoading: isTenantAdminStatusLoading,
		tenantId: activeTenantId,
	} = useTenantAdminStatus();
	const obraId = useMemo(() => {
		if (initialObraId) return initialObraId;
		const raw = (params as Record<string, string | string[] | undefined>)?.obraId;
		if (Array.isArray(raw)) return raw[0];
		return raw;
	}, [initialObraId, params]);
	const isValidObraId = Boolean(obraId && obraId !== "undefined");
	const resolvedInitialTab = queryParams.get("tab") || initialTab;
	const [activeTab, setActiveTab] = useState(resolvedInitialTab);
	const isGeneralTabActive = activeTab === "general";
	const isDocumentsTabActive = activeTab === "documentos";
	const isInsurancePoliciesTabActive = activeTab === "polizas";
	const isFlujoTabActive = activeTab === "flujo";
	const isCertificatesTabActive = activeTab === "certificates";
	const deletePermissionsQuery = useQuery({
		queryKey: ["permissions-check", "obra-delete", activeTenantId],
		queryFn: () => fetchPermissionChecks(["obras:delete"]),
		enabled: !isTenantAdminStatusLoading,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
	});
	const canDeleteObra = Boolean(deletePermissionsQuery.data?.["obras:delete"]);

	// React Query hooks for cached data fetching
	// Core obra data - always fetch
	const obraQuery = useQuery({
		queryKey: ['obra', obraId],
		queryFn: () => fetchObraDetail(obraId!),
		enabled: !!obraId && obraId !== "undefined",
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
	});
	const deferredGeneralQueriesReady = useDeferredGeneralExtrasReady({
		obraId,
		isGeneralTabActive,
		isValidObraId,
		isObraLoaded: obraQuery.isSuccess,
	});
	const shouldLoadGeneralExtras =
		isValidObraId &&
		isGeneralTabActive &&
		obraQuery.isSuccess &&
		deferredGeneralQueriesReady;

	// Memoria notes - always fetch (lightweight)
	const memoriaQuery = useQuery({
		queryKey: ['obra', obraId, 'memoria'],
		queryFn: () => fetchMemoriaNotes(obraId!),
		enabled: !!obraId && obraId !== "undefined",
		staleTime: 5 * 60 * 1000,
	});

	// Materials - always fetch (cached by React Query)
	const materialsQuery = useQuery({
		queryKey: ['obra', obraId, 'materials'],
		queryFn: () => fetchMaterialOrders(obraId!),
		enabled: isValidObraId && isDocumentsTabActive,
		staleTime: 5 * 60 * 1000,
	});

	// Certificates - always fetch (cached by React Query)
	const certificatesQuery = useQuery({
		queryKey: ['obra', obraId, 'certificates'],
		queryFn: () => fetchCertificates(obraId!),
		enabled: isValidObraId && isCertificatesTabActive,
		staleTime: 5 * 60 * 1000,
	});

	// Recipients - always fetch (cached by React Query)
	const recipientsQuery = useQuery({
		queryKey: ['obra', obraId, 'recipients'],
		queryFn: () => fetchObraRecipients(obraId!),
		enabled: isValidObraId && isFlujoTabActive,
		staleTime: 10 * 60 * 1000, // Recipients change less often
	});

	const ocrLinksQuery = useQuery({
		queryKey: ['obra', obraId, 'ocr-links'],
		queryFn: () => fetchOcrLinks(obraId!, { rowsLimit: 50 }),
		enabled: shouldLoadGeneralExtras,
		staleTime: 5 * 60 * 1000,
	});

	const dataFlowSuggestionsQuery = useQuery({
		queryKey: ["obra", obraId, "data-flow-suggestions"],
		queryFn: () => fetchDataFlowSuggestions(obraId!),
		enabled: shouldLoadGeneralExtras,
		staleTime: 30 * 1000,
	});

	const dataFlowConfigQuery = useQuery({
		queryKey: ["obra", obraId, "data-flow-config", "effective"],
		queryFn: () => fetchObraDataFlowConfig(obraId!),
		enabled: shouldLoadGeneralExtras,
		staleTime: 5 * 60 * 1000,
	});

	// Flujo actions - always fetch (cached by React Query)
	const flujoActionsQuery = useQuery({
		queryKey: ['obra', obraId, 'flujo-actions'],
		queryFn: () => fetchFlujoActions(obraId!),
		enabled: isValidObraId && isFlujoTabActive,
		staleTime: 5 * 60 * 1000,
	});

	// Pendientes - always fetch (cached by React Query)
	const pendientesQuery = useQuery({
		queryKey: ['obra', obraId, 'pendientes'],
		queryFn: () => fetchPendingDocs(obraId!),
		enabled: isValidObraId,
		staleTime: 5 * 60 * 1000,
	});

	const tablasQuery = useQuery({
		queryKey: ["obra-tablas", obraId],
		enabled: shouldLoadGeneralExtras,
		queryFn: async () => {
			const res = await fetch(`/api/obras/${obraId}/tablas`);
			if (!res.ok) throw new Error("No se pudieron cargar las tablas");
			const data = await res.json();
			const normalizeDataType = (value: unknown): OcrTablaColumn["dataType"] => {
				return value === "number" || value === "boolean" || value === "date" || value === "text" || value === "currency"
					? value
					: "text";
			};

			return (data.tablas ?? []).map((tabla: ObraTabla) => ({
				...tabla,
				columns: (tabla.columns ?? []).map((column) => ({
					...column,
					dataType: normalizeDataType(column.dataType),
					required: Boolean(column.required),
				})),
			})) as ObraTabla[];
		},
		staleTime: 5 * 60 * 1000,
	});
	const shouldLoadCertificadoContableMacro = useMemo(() => {
		if (!isValidObraId || activeTab !== "general") {
			return false;
		}

		const links = ocrLinksQuery.data ?? [];
		return links.some(
			(link) =>
				typeof link.folderName === "string" &&
				isCertificadosExtraidosFolder(link.folderName) &&
				isCertificadoResumenLink(link) &&
				(Array.isArray(link.rows) ? link.rows : []).some((row) =>
					isMeaningfulCertificadoResumenRow(row),
				)
		);
	}, [activeTab, isValidObraId, ocrLinksQuery.data]);

	const certificadoContableMacroQuery = useQuery({
		queryKey: ["obra-certificado-contable-macro", obraId],
		enabled: shouldLoadCertificadoContableMacro,
		queryFn: async () => {
			const macroTables = await fetchMacroTablesList();
			const targetMacroTable =
				macroTables.find((macroTable) => isCertificadoContableMacroTable(macroTable.name)) ?? null;
			if (!targetMacroTable) {
				return null;
			}

			const macroData = await fetchAllMacroTableRows(targetMacroTable.id, obraId);
			return {
				columns: macroData.columns,
				rows: macroData.rows,
			};
		},
		staleTime: 5 * 60 * 1000,
	});

	const certificadoTableRefs = useMemo(() => {
		const tablas: ObraTabla[] = Array.isArray(tablasQuery.data) ? tablasQuery.data : [];
		let curvaPlanId: string | null = null;
		let curvaPlanName = "Curva Plan";
		let pmcResumenId: string | null = null;
		let pmcResumenName = "PMC Resumen";

		tablas.forEach((tabla) => {
			const keySet = new Set((tabla.columns ?? []).map((column) => column.fieldKey));
			const normalizedName = normalizeText(tabla.name ?? "");
			const isCurvaByColumns =
				keySet.has("periodo") &&
				keySet.has("avance_mensual_pct") &&
				keySet.has("avance_acumulado_pct");
			const isResumenByColumns =
				keySet.has("avance_fisico_acumulado_pct") &&
				(keySet.has("periodo") || keySet.has("fecha_certificacion"));

			if (isCurvaByColumns || normalizedName.includes("curva plan")) {
				if (!curvaPlanId || normalizedName.includes("curva plan")) {
					curvaPlanId = tabla.id;
					curvaPlanName = tabla.name;
				}
			}
			if (isResumenByColumns || normalizedName.includes("pmc resumen")) {
				if (!pmcResumenId || normalizedName.includes("resumen")) {
					pmcResumenId = tabla.id;
					pmcResumenName = tabla.name;
				}
			}
		});

		return {
			curvaPlanId,
			curvaPlanName,
			pmcResumenId,
			pmcResumenName,
		};
	}, [tablasQuery.data]);
	const tablasById = useMemo(() => {
		const tablas: ObraTabla[] = Array.isArray(tablasQuery.data) ? tablasQuery.data : [];
		return new Map(tablas.map((tabla) => [tabla.id, tabla] as const));
	}, [tablasQuery.data]);
	const curveRulesConfigQuery = useQuery({
		queryKey: ["obra", obraId, "curve-rules-config"],
		enabled: shouldLoadGeneralExtras,
		queryFn: async () => fetchRulesConfig(obraId!),
		staleTime: 60 * 1000,
	});
	const certRecommendationsMapping = useMemo(() => {
		const mappings = curveRulesConfigQuery.data?.mappings;
		const certTableId = normalizeOptionalMappingKey(
			mappings?.recommendations?.certTableId ??
			mappings?.monthlyMissingCert?.certTableId ??
			mappings?.unpaidCerts?.certTableId ??
			mappings?.inactivity?.certTableId,
		);
		const montoAcumuladoColumnKey = normalizeOptionalMappingKey(
			mappings?.recommendations?.montoAcumuladoColumnKey,
		);
		const dateOrPeriodColumnKey = normalizeOptionalMappingKey(
			mappings?.recommendations?.dateOrPeriodColumnKey ??
			mappings?.monthlyMissingCert?.certIssuedAtColumnKey ??
			mappings?.unpaidCerts?.issuedAtColumnKey ??
			mappings?.inactivity?.certIssuedAtColumnKey,
		);
		return {
			certTableId,
			montoAcumuladoColumnKey,
			dateOrPeriodColumnKey,
		} satisfies CertificadosRecommendationMapping & { certTableId: string | null };
	}, [curveRulesConfigQuery.data]);
	const configuredCertRowsQuery = useQuery({
		queryKey: [
			"obra",
			obraId,
			"recommendations-cert-table-rows",
			certRecommendationsMapping.certTableId ?? "none",
		],
		enabled:
			isValidObraId &&
			isGeneralTabActive &&
			Boolean(certRecommendationsMapping.certTableId),
		queryFn: async () =>
			fetchTablaRowsAll(obraId!, certRecommendationsMapping.certTableId ?? ""),
		staleTime: 60 * 1000,
	});
	const selectedCurveTableRefs = useMemo(() => {
		const rulesConfig = curveRulesConfigQuery.data;
		const rulesCurvePlanTableId = rulesConfig?.mappings?.curve?.planTableId ?? null;
		const rulesResumenTableId =
			rulesConfig?.mappings?.curve?.resumenTableId ??
			rulesConfig?.mappings?.curve?.measurementTableId ??
			null;
		const curvaPlanId = rulesCurvePlanTableId ?? certificadoTableRefs.curvaPlanId;
		const pmcResumenId = rulesResumenTableId ?? certificadoTableRefs.pmcResumenId;

		return {
			curvaPlanId,
			curvaPlanName:
				(curvaPlanId ? tablasById.get(curvaPlanId)?.name : null) ??
				certificadoTableRefs.curvaPlanName,
			pmcResumenId,
			pmcResumenName:
				(pmcResumenId ? tablasById.get(pmcResumenId)?.name : null) ??
				certificadoTableRefs.pmcResumenName,
		};
	}, [certificadoTableRefs, curveRulesConfigQuery.data, tablasById]);
	const currentPeriodKey = useMemo(() => {
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
	}, []);
	const guidedTourStage = getGuidedExcelStage(searchParams);
	const isGuidedExcelFlow = isGuidedExcelTour(searchParams);

	const generalReportsQuery = useQuery({
		queryKey: [
			"obra",
			obraId,
			"general-reports",
			currentPeriodKey,
			selectedCurveTableRefs.curvaPlanId ?? "none",
			selectedCurveTableRefs.pmcResumenId ?? "none",
			periodKeyFromValue(obraQuery.data?.iniciacion) ?? "no-start-period",
		],
		enabled:
			isValidObraId &&
			isGeneralTabActive &&
			obraQuery.isSuccess &&
			tablasQuery.isSuccess &&
			curveRulesConfigQuery.isSuccess,
		queryFn: async () => {
			const rulesConfig = curveRulesConfigQuery.data;
			const curvaTableId = selectedCurveTableRefs.curvaPlanId;
			const resumenTableId = selectedCurveTableRefs.pmcResumenId;
			const curvaTableName = selectedCurveTableRefs.curvaPlanName;
			const resumenTableName = selectedCurveTableRefs.pmcResumenName;

			const findingsPromise = (async () => {
				const withPeriod = await fetchFindings(obraId!, currentPeriodKey);
				if (withPeriod.length > 0) return withPeriod;
				return fetchFindings(obraId!);
			})();
			const curvaPromise = curvaTableId
				? fetchTablaRowsAll(obraId!, curvaTableId)
				: Promise.resolve([] as TablaRowRecord[]);
			const resumenPromise = resumenTableId
				? fetchTablaRowsAll(obraId!, resumenTableId)
				: Promise.resolve([] as TablaRowRecord[]);

			const [findings, curvaRows, resumenRows] = await Promise.all([
				findingsPromise,
				curvaPromise,
				resumenPromise,
			]);

			const points = buildCurvePoints(curvaRows, resumenRows, {
				curveStartPeriod:
					rulesConfig?.mappings?.curve?.plan?.startPeriod ??
					periodKeyFromValue(obraQuery.data?.iniciacion),
			});
			const planPointsCount = points.filter((point) => point.planPct != null).length;
			const realPointsCount = points.filter((point) => point.realPct != null).length;
			return {
				findings,
				curve:
					points.length > 0
						? {
							points,
							planTableName: curvaTableName,
							resumenTableName,
							planRowsCount: curvaRows.length,
							resumenRowsCount: resumenRows.length,
							planPointsCount,
							realPointsCount,
						}
						: null,
			} satisfies GeneralTabReportsData;
		},
		staleTime: 60 * 1000,
	});

	const defaultsQuery = useQuery({
		queryKey: ["obra-defaults", obraId],
		enabled: shouldLoadGeneralExtras,
		queryFn: async () => {
			const res = await fetch(
				`/api/obra-defaults?obraId=${encodeURIComponent(String(obraId))}`
			);
			if (!res.ok) {
				const out = await res.json().catch(() => ({}));
				throw new Error(out?.error || "No se pudieron cargar los defaults");
			}
			return res.json() as Promise<{ folders: DefaultFolder[]; quickActions: QuickAction[] }>;
		},
		staleTime: 5 * 60 * 1000,
	});

	const tenantMarkerQuery = useQuery({
		queryKey: ["tenant-marker", activeTenantId ?? "none"],
		enabled: !isTenantAdminStatusLoading,
		queryFn: async () => {
			const response = await fetch("/api/tenant-marker", { cache: "no-store" });
			if (!response.ok) return false;
			const payload = (await response.json().catch(() => ({}))) as {
				isIlagDemoTenant?: unknown;
			};
			return payload.isIlagDemoTenant === true;
		},
		staleTime: 5 * 60 * 1000,
	});

	const mainTableConfigQuery = useQuery({
		queryKey: ["main-table-config", activeTenantId ?? "none"],
		queryFn: async () => {
			const response = await fetch("/api/main-table-config", { cache: "no-store" });
			if (!response.ok) return null;
			const payload = (await response.json()) as { columns?: MainTableColumnConfig[] };
			return Array.isArray(payload.columns) ? payload.columns : [];
		},
		enabled: !isTenantAdminStatusLoading,
		staleTime: 5 * 60 * 1000,
	});

	// Derived state from queries
	const isLoading = obraQuery.isLoading;
	const loadError = obraQuery.error?.message ?? null;
	const routeError = !obraId || obraId === "undefined" ? "Obra no encontrada" : null;
	const certificates = certificatesQuery.data?.certificates ?? [];
	const memoriaNotes = memoriaQuery.data ?? [];
	const materialOrders = materialsQuery.data ?? EMPTY_MATERIAL_ORDERS;
	const obraRoles = recipientsQuery.data?.roles ?? EMPTY_OBRA_ROLES;
	const obraUsers = recipientsQuery.data?.users ?? EMPTY_OBRA_USERS;
	const obraUserRoles = recipientsQuery.data?.userRoles ?? EMPTY_OBRA_USER_ROLES;
	const flujoActions = flujoActionsQuery.data ?? EMPTY_FLUJO_ACTIONS;
	const isLoadingFlujoActions = flujoActionsQuery.isLoading;
	const certificadosExtraidosRows = useMemo<TablaDataRow[]>(() => {
		if (certRecommendationsMapping.certTableId) {
			const rows = (configuredCertRowsQuery.data ?? []).map((row) => ({
				id: row.id,
				data: (row.data as Record<string, unknown>) ?? {},
			})) as TablaDataRow[];
			return sortCertificadosExtraidosRows(
				rows.filter((row) =>
					isMeaningfulCertificadoResumenRow(row, certRecommendationsMapping),
				),
				certRecommendationsMapping,
			);
		}

		const links = ocrLinksQuery.data ?? [];
		return sortCertificadosExtraidosRows(
			links
				.filter(
					(link) =>
						typeof link.folderName === "string" &&
						isCertificadosExtraidosFolder(link.folderName) &&
						isCertificadoResumenLink(link),
				)
				.flatMap((link) => (Array.isArray(link.rows) ? link.rows : []))
				.filter((row) => isMeaningfulCertificadoResumenRow(row))
		);
	}, [
		certRecommendationsMapping,
		configuredCertRowsQuery.data,
		ocrLinksQuery.data,
	]);
	const obraData = obraQuery.data;
	const latestExtractedCertificadoALaFecha = useMemo(
		() =>
			getLatestCertificadoMontoAcumulado(
				certificadosExtraidosRows,
				certRecommendationsMapping,
			),
		[certRecommendationsMapping, certificadosExtraidosRows]
	);
	const latestExtractedCertificadoSourceLabel = useMemo(
		() => {
			const dateOrPeriodLabel = getLatestCertificadoSourceLabel(
				certificadosExtraidosRows,
				certRecommendationsMapping,
			);
			const configuredTableName =
				certRecommendationsMapping.certTableId
					? tablasById.get(certRecommendationsMapping.certTableId)?.name ?? null
					: null;
			if (configuredTableName && dateOrPeriodLabel) {
				return `${dateOrPeriodLabel} - ${configuredTableName}`;
			}
			return configuredTableName ?? dateOrPeriodLabel;
		},
		[certRecommendationsMapping, certificadosExtraidosRows, tablasById]
	);
	const generalReportsData = generalReportsQuery.data ?? EMPTY_GENERAL_REPORTS_DATA;
	const isGeneralReportsInitialLoading =
		generalReportsQuery.isLoading ||
		(generalReportsQuery.isFetching && generalReportsQuery.data == null);
	const hasMissingCurrentMonthFinding = generalReportsData.findings.some(
		(finding) => finding.rule_key === "cert.missing_current_month",
	);
	const handleCurveDataImported = useCallback(async () => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: ["obra", obraId, "general-reports"] }),
			queryClient.invalidateQueries({ queryKey: ["obra", obraId, "ocr-links"] }),
			queryClient.invalidateQueries({ queryKey: ["obra-certificado-contable-macro", obraId] }),
		]);
	}, [obraId, queryClient]);
	const generalTabCurveImportConfig = useMemo(() => {
		if (!obraId) return undefined;
		return {
			obraId,
			curvaPlanTableId: selectedCurveTableRefs.curvaPlanId,
			curvaPlanTableName: selectedCurveTableRefs.curvaPlanName,
			pmcResumenTableId: selectedCurveTableRefs.pmcResumenId,
			pmcResumenTableName: selectedCurveTableRefs.pmcResumenName,
			onImported: handleCurveDataImported,
		};
	}, [
		handleCurveDataImported,
		obraId,
		selectedCurveTableRefs.curvaPlanId,
		selectedCurveTableRefs.curvaPlanName,
		selectedCurveTableRefs.pmcResumenId,
		selectedCurveTableRefs.pmcResumenName,
	]);
	const generalTabDataFlowSuggestions =
		dataFlowSuggestionsQuery.data ?? EMPTY_DATA_FLOW_SUGGESTIONS;
	const generalTabDataFlowSuggestionsError =
		dataFlowSuggestionsQuery.error instanceof Error
			? dataFlowSuggestionsQuery.error.message
			: null;
	const obraTimeProgress =
		obraData && obraData.plazoTotal > 0
			? (obraData.plazoTransc / obraData.plazoTotal) * 100
			: 0;
	const obraDelay =
		obraData && obraData.porcentaje != null
			? Math.round(obraTimeProgress - obraData.porcentaje)
			: 0;
	const isObraAtRisk =
		!!obraData &&
		(obraData.porcentaje ?? 0) < 100 &&
		obraTimeProgress > (obraData.porcentaje ?? 0) + 10;

	const customQuickActionSteps = useMemo(() => ({}), []);
	const quickActionsAllData = useMemo(() => {
		const defaultFolders = defaultsQuery.data?.folders ?? [];
		const mergedFolders = [...defaultFolders];
		const seenPaths = new Set(defaultFolders.map((folder) => folder.path));
		for (const tabla of tablasQuery.data ?? []) {
			const settings = (tabla.settings ?? {}) as Record<string, unknown>;
			const folderPathCandidate =
				typeof settings.ocrFolder === "string"
					? settings.ocrFolder.trim()
					: typeof settings.linkedFolderPath === "string"
						? settings.linkedFolderPath.trim()
						: "";
			if (!folderPathCandidate || seenPaths.has(folderPathCandidate)) continue;
			seenPaths.add(folderPathCandidate);
			const rawMode = settings.dataInputMethod;
			const dataInputMethod =
				rawMode === "ocr" || rawMode === "manual" || rawMode === "both"
					? rawMode
					: "both";
			mergedFolders.push({
				id: `tabla-folder-${tabla.id}`,
				name: tabla.name,
				path: folderPathCandidate,
				isOcr: true,
				dataInputMethod,
			});
		}
		return {
			obraId: String(obraId),
			quickActions: defaultsQuery.data?.quickActions ?? [],
			folders: mergedFolders,
			tablas: tablasQuery.data ?? [],
			customStepRenderers: customQuickActionSteps,
		};
	}, [defaultsQuery.data, tablasQuery.data, customQuickActionSteps, obraId]);

	// Local state for UI
	const [isAddingCertificate, setIsAddingCertificate] = useState(false);
	const [newCertificate, setNewCertificate] = useState<NewCertificateFormState>(
		() => ({ ...certificateFormDefault })
	);
	const [createCertificateError, setCreateCertificateError] = useState<string | null>(null);
	const [isCreatingCertificate, setIsCreatingCertificate] = useState(false);
	const mountedRef = useRef(true);
	const lastAppliedObraDataUpdatedAtRef = useRef<number>(0);
	const [currentUserId, setCurrentUserId] = useState<string | null>(null);
	const [isGeneralTabEditMode, setIsGeneralTabEditMode] = useState(false);
	const [isSavingObra, setIsSavingObra] = useState(false);
	const [isResolvingDataFlowSuggestion, setIsResolvingDataFlowSuggestion] = useState(false);
	const [isDeletingObra, setIsDeletingObra] = useState(false);
	const [initialFormValues, setInitialFormValues] = useState<Obra>(emptyObra);
	const [derivedCertificadosNotice, setDerivedCertificadosNotice] =
		useState<DerivedCertificadosNotice | null>(null);
	const [pendingDerivedFieldValues, setPendingDerivedFieldValues] = useState<
		Partial<Record<DerivedCertificadosField, number>>
	>({});
	const mainTableColumnsConfig = mainTableConfigQuery.data ?? null;

	const [isMemoriaOpen, setIsMemoriaOpen] = useState(false);
	const [memoriaDraft, setMemoriaDraft] = useState("");

	const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([
		{ id: "doc-1", name: "", poliza: "", dueMode: "fixed", dueDate: "", offsetDays: 0, done: false },
		{ id: "doc-2", name: "", poliza: "", dueMode: "fixed", dueDate: "", offsetDays: 0, done: false },
		{ id: "doc-3", name: "", poliza: "", dueMode: "fixed", dueDate: "", offsetDays: 0, done: false },
	]);

	const [selectedRecipientUserId, setSelectedRecipientUserId] = useState<string>("");
	const [selectedRecipientRoleId, setSelectedRecipientRoleId] = useState<string>("");

	const [isSavingFlujoAction, setIsSavingFlujoAction] = useState(false);
	const [isAddingFlujoAction, setIsAddingFlujoAction] = useState(false);
	const [newFlujoAction, setNewFlujoAction] = useState<Partial<FlujoAction>>({
		action_type: 'email',
		timing_mode: 'immediate',
		offset_value: 1,
		offset_unit: 'days',
		title: '',
		message: '',
		recipient_user_ids: [],
		notification_types: ["in_app", "email"],
		enabled: true,
	});

	const [globalMaterialsFilter, setGlobalMaterialsFilter] = useState("");
	const [expandedOrders, setExpandedOrders] = useState<Set<string>>(() => new Set());
	const [orderFilters, setOrderFilters] = useState<Record<string, string>>(() => ({}));
	const [documentsRecoveryRequestToken, setDocumentsRecoveryRequestToken] = useState(0);
	const isIlagDemoTenant = tenantMarkerQuery.data === true;
	const [isIlagMaterialsWizardOpen, setIsIlagMaterialsWizardOpen] = useState(false);

	useEffect(() => {
		if (isIlagDemoTenant) return;
		setIsIlagMaterialsWizardOpen(false);
	}, [isIlagDemoTenant]);

	// Sync URL when tab changes (low priority, non-blocking)
	const setQueryParams = useCallback((patch: Record<string, string | null | undefined>) => {
		const params = new URLSearchParams(searchParams?.toString() || "");
		for (const [key, value] of Object.entries(patch)) {
			if (value == null || value === "") params.delete(key); else params.set(key, value);
		}
		const qs = params.toString();
		// Use startTransition to mark URL update as low-priority
		startTransition(() => {
			replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
		});
	}, [pathname, replace, searchParams]);

	// Handle tab change: update local state immediately, sync URL in background
	const handleTabChange = useCallback((value: string) => {
		const activeTour = queryParams.get("tour") ?? null;
		const activeStage = queryParams.get(GUIDED_EXCEL_STAGE_PARAM) ?? null;
		setActiveTab(value); // Immediate state update
		if (activeTour === "excel-overview") {
			const nextStage =
				value === "documentos" &&
					(activeStage === GUIDED_EXCEL_STAGES.obraIntro ||
						activeStage === GUIDED_EXCEL_STAGES.obraMissingCertificado ||
						activeStage === GUIDED_EXCEL_STAGES.obraGoDocuments)
					? GUIDED_EXCEL_STAGES.documentsIntro
					: value === "general" && activeStage === GUIDED_EXCEL_STAGES.documentsReturnGeneral
						? GUIDED_EXCEL_STAGES.generalReviewUpdatedData
						: activeStage;
			setQueryParams({
				tab: value,
				tourStage: nextStage,
			});
			return;
		}
		if (value === "documentos" && activeTour === "obra-overview") {
			setQueryParams({ tab: value, tour: "documentos-overview" });
			return;
		}
		setQueryParams({ tab: value }); // Background URL sync
	}, [queryParams, setQueryParams]);

	const handleOpenDocumentsRecovery = useCallback(() => {
		if (activeTab !== "documentos") {
			setActiveTab("documentos");
			setQueryParams({ tab: "documentos" });
		}
		setDocumentsRecoveryRequestToken((prev) => prev + 1);
	}, [activeTab, setQueryParams]);

	const handleOpenDocumentsTrashPage = useCallback(() => {
		if (!obraId) return;
		push(`/excel/${encodeURIComponent(obraId)}/papelera`);
	}, [obraId, push]);

	const handleOpenObrasTrashPage = useCallback(() => {
		if (!isTenantAdmin) {
			toast.error("Solo administradores pueden ver la papelera de obras.");
			return;
		}
		push("/excel/papelera-obras");
	}, [isTenantAdmin, push]);

	const handleStartIlagMaterialsWizard = useCallback(() => {
		setIsIlagMaterialsWizardOpen(true);
		if (activeTab !== "documentos") {
			setActiveTab("documentos");
		}
		setQueryParams({
			tab: "documentos",
			ilagMaterialsReportGuide: "1",
		});
	}, [activeTab, setQueryParams]);

	const handleIlagMaterialsWizardOpenChange = useCallback(
		(nextOpen: boolean) => {
			setIsIlagMaterialsWizardOpen(nextOpen);
			if (nextOpen) return;
			setQueryParams({ ilagMaterialsReportGuide: null });
		},
		[setQueryParams],
	);

	// Import OC from PDF
	const importInputRef = useRef<HTMLInputElement | null>(null);
	const [isImportingMaterials, setIsImportingMaterials] = useState(false);
	const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
	const [importPreviewOrder, setImportPreviewOrder] = useState<NewOrderForm | null>(null);
	const lastUploadedDocRef = useRef<{ segments: string[]; name: string; mime?: string } | null>(null);

	const triggerImportMaterials = useCallback(() => {
		importInputRef.current?.click();
	}, []);

	const handleImportMaterials = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (!obraId || obraId === "undefined") {
			toast.error("Obra no encontrada");
			return;
		}
		try {
			setIsImportingMaterials(true);
			// Upload original file to Supabase Storage under <obraId>/materiales/
			try {
				const supabase = createSupabaseBrowserClient();
				const basePath = String(obraId);
				// Check if 'materiales' folder exists under obra root
				const { data: rootList } = await supabase.storage
					.from(DOCUMENTS_BUCKET)
					.list(basePath, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
				const hasMateriales = Boolean((rootList || []).find((it) => it.name === 'materiales' && !it.metadata));
				if (!hasMateriales) {
					const keepKey = `${basePath}/materiales/.keep`;
					await supabase.storage
						.from(DOCUMENTS_BUCKET)
						.upload(keepKey, new Blob([""], { type: 'text/plain' }), { upsert: true });
				}
				// Upload the file with a timestamped name to avoid collisions
				const safeName = `${Date.now()}-${file.name}`;
				const uploadKey = `${basePath}/materiales/${safeName}`;
				const { error: upErr } = await supabase.storage
					.from(DOCUMENTS_BUCKET)
					.upload(uploadKey, file, { upsert: false });
				if (!upErr) {
					lastUploadedDocRef.current = { segments: ["materiales"], name: safeName, mime: file.type };
				}
				toast.success('Archivo guardado en Documentos/materiales');
			} catch (uploadErr) {
				console.error('Upload to materiales failed', uploadErr);
				toast.error('No se pudo guardar el archivo en Documentos/materiales');
			}
			const fd = new FormData();
			if (file.type.includes("pdf")) {
				// Rasterize first page to PNG in-browser using pdfjs and send as imageDataUrl
				try {
					type PdfViewport = { width: number; height: number };
					type PdfPage = {
						getViewport(options: { scale: number }): PdfViewport;
						render(options: {
							canvasContext: CanvasRenderingContext2D;
							viewport: PdfViewport;
						}): { promise: Promise<void> };
					};
					type PdfDocument = { getPage(pageNumber: number): Promise<PdfPage> };
					type PdfJsModule = {
						getDocument(options: {
							data: Uint8Array;
							disableWorker: boolean;
						}): { promise: Promise<PdfDocument> };
					};
					const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfJsModule;
					const array = new Uint8Array(await file.arrayBuffer());
					const loadingTask = pdfjs.getDocument({ data: array.slice(), disableWorker: true });
					const pdf = await loadingTask.promise;
					const page = await pdf.getPage(1);
					const viewport = page.getViewport({ scale: 2 });
					const canvasEl = document.createElement('canvas');
					canvasEl.width = Math.ceil(viewport.width);
					canvasEl.height = Math.ceil(viewport.height);
					const ctx = canvasEl.getContext('2d');
					if (!ctx) throw new Error('No canvas context');
					await page.render({ canvasContext: ctx, viewport }).promise;
					const dataUrl = canvasEl.toDataURL('image/png');
					fd.append('imageDataUrl', dataUrl);
				} catch (pdfErr) {
					console.error('PDF rasterization failed', pdfErr);
					// Fallback: send file anyway (server will reject with a helpful message)
					fd.append('file', file);
				}
			} else {
				fd.append('file', file);
			}
			const res = await fetch(`/api/obras/${obraId}/materials/import?preview=1`, { method: "POST", body: fd });
			if (!res.ok) {
				const out = await res.json().catch(() => ({} as { error?: string }));
				throw new Error(out?.error || "No se pudo importar");
			}
			const out = await res.json();
			// Build preview order form
			type MaterialImportItem = {
				cantidad?: unknown;
				unidad?: unknown;
				material?: unknown;
				precioUnitario?: unknown;
			};
			const rawItems = Array.isArray(out?.items) ? (out.items as MaterialImportItem[]) : [];
			const extractedItems = rawItems.map((it) => ({
				cantidad: String(it.cantidad ?? ''),
				unidad: String(it.unidad ?? ''),
				material: String(it.material ?? ''),
				precioUnitario: String(it.precioUnitario ?? ''),
			}));
			const meta = out.meta || {};
			setImportPreviewOrder({
				nroOrden: meta.nroOrden ?? '',
				fecha: meta.fecha ?? '',
				solicitante: meta.solicitante ?? '',
				proveedor: meta.proveedor ?? '',
				items: extractedItems.length > 0 ? extractedItems : [{ cantidad: '', unidad: '', material: '', precioUnitario: '' }],
			});
			setIsImportPreviewOpen(true);
		} catch (err) {
			console.error(err);
			const message = err instanceof Error ? err.message : "No se pudo importar";
			toast.error(message);
		} finally {
			setIsImportingMaterials(false);
			if (importInputRef.current) importInputRef.current.value = "";
		}
	}, [obraId]);

	// Add-order dialog state
	const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);

	type NewOrderItemForm = {
		cantidad: string;
		unidad: string;
		material: string;
		precioUnitario: string;
	};

	type NewOrderForm = {
		nroOrden: string;
		fecha: string;
		solicitante: string;
		proveedor: string;
		items: NewOrderItemForm[];
	};

	const emptyNewOrderForm: NewOrderForm = {
		nroOrden: "",
		fecha: "",
		solicitante: "",
		proveedor: "",
		items: [
			{ cantidad: "", unidad: "", material: "", precioUnitario: "" },
		],
	};

	const [newOrder, setNewOrder] = useState<NewOrderForm>(() => ({ ...emptyNewOrderForm }));

	const updateNewOrderMeta = useCallback(
		(field: "nroOrden" | "fecha" | "solicitante" | "proveedor", value: string) => {
			setNewOrder((prev) => ({ ...prev, [field]: value }));
		},
		[]
	);

	const addNewOrderItem = useCallback(() => {
		setNewOrder((prev) => ({
			...prev,
			items: [...prev.items, { cantidad: "", unidad: "", material: "", precioUnitario: "" }],
		}));
	}, []);

	const removeNewOrderItem = useCallback((index: number) => {
		setNewOrder((prev) => {
			const items = [...prev.items];
			items.splice(index, 1);
			return { ...prev, items };
		});
	}, []);

	const updateNewOrderItem = useCallback((index: number, field: keyof NewOrderItemForm, value: string) => {
		setNewOrder((prev) => {
			const items = [...prev.items];
			items[index] = { ...items[index], [field]: value };
			return { ...prev, items };
		});
	}, []);

	const handleCreateOrder = useCallback((event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const orderId = `ord-${Date.now()}`;
		const normalizedItems: MaterialItem[] = newOrder.items
			.filter((it) => (it.material?.trim() ?? "").length > 0 && Number(it.cantidad) > 0)
			.map((it, idx) => {
				const unidad = it.unidad.trim();
				const material = it.material.trim();
				return {
					id: `${orderId}-i-${idx}`,
					cantidad: Number(it.cantidad) || 0,
					unidad,
					material,
					precioUnitario: Number(it.precioUnitario) || 0,
					// Pre-normalize for filtering
					_unidadNorm: normalizeForSearch(unidad),
					_materialNorm: normalizeForSearch(material),
				};
			});

		const nroOrden = newOrder.nroOrden.trim() || orderId;
		const fecha = newOrder.fecha.trim();
		const solicitante = newOrder.solicitante.trim();
		const proveedor = newOrder.proveedor.trim();

		const order: MaterialOrder = {
			id: orderId,
			nroOrden,
			fecha,
			solicitante,
			proveedor,
			items: normalizedItems,
			// Pre-normalize for filtering
			_nroOrdenNorm: normalizeForSearch(nroOrden),
			_fechaNorm: normalizeForSearch(fecha),
			_solicitanteNorm: normalizeForSearch(solicitante),
			_proveedorNorm: normalizeForSearch(proveedor),
		};

		queryClient.setQueryData<MaterialOrder[]>(
			['obra', obraId, 'materials'],
			(prev = []) => [order, ...prev]
		);
		setOrderFilters((prev) => ({ ...prev, [order.id]: "" }));
		setExpandedOrders((prev) => {
			const next = new Set(prev);
			next.add(order.id);
			return next;
		});
		setIsAddOrderOpen(false);
		setNewOrder({ ...emptyNewOrderForm });
	}, [newOrder, obraId, queryClient]);

	const toggleOrderExpanded = useCallback((orderId: string) => {
		setExpandedOrders((prev) => {
			const next = new Set(prev);
			if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
			return next;
		});
	}, []);

	const setOrderFilter = useCallback((orderId: string, value: string) => {
		setOrderFilters((prev) => ({ ...prev, [orderId]: value }));
	}, []);

	// Use pre-normalized fields from data load for efficient filtering
	const filteredOrders = useMemo(() => {
		if (!globalMaterialsFilter.trim()) return materialOrders;
		// Only normalize the query string once per filter change
		const q = normalizeForSearch(globalMaterialsFilter);
		return materialOrders
			.map((order) => ({
				...order,
				items: order.items.filter((it) =>
					// Use pre-normalized fields (computed at data load time)
					(it._materialNorm ?? "").includes(q) ||
					(it._unidadNorm ?? "").includes(q)
				),
			}))
			.filter((order) =>
				// Use pre-normalized fields (computed at data load time)
				(order._nroOrdenNorm ?? "").includes(q) ||
				(order._fechaNorm ?? "").includes(q) ||
				(order._solicitanteNorm ?? "").includes(q) ||
				(order._proveedorNorm ?? "").includes(q) ||
				order.items.length > 0
			);
	}, [materialOrders, globalMaterialsFilter]);

	const getOrderItemsFiltered = useCallback((order: MaterialOrder): MaterialItem[] => {
		const of = orderFilters[order.id]?.trim() ?? "";
		if (!of) return order.items;
		const q = normalizeForSearch(of);
		return order.items.filter((it) =>
			// Use pre-normalized fields
			(it._materialNorm ?? "").includes(q) || (it._unidadNorm ?? "").includes(q)
		);
	}, [orderFilters]);

	const getOrderTotal = useCallback((items: MaterialItem[]) => {
		return items.reduce((acc, it) => acc + it.cantidad * it.precioUnitario, 0);
	}, []);

	// Invalidate material orders cache to trigger refetch
	const refreshMaterialOrders = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: ['obra', obraId, 'materials'] });
	}, [obraId, queryClient]);

	const areObraValuesEqual = useCallback((a: unknown, b: unknown) => {
		if (typeof a === "object" && a != null && typeof b === "object" && b != null) {
			return JSON.stringify(a) === JSON.stringify(b);
		}
		return Object.is(a, b);
	}, []);

	const buildDirtyObraPayload = useCallback((current: Obra, initial: Obra): Partial<Obra> => {
		const dirty: Partial<Obra> = {};
		for (const key of Object.keys(current) as Array<keyof Obra>) {
			if (!areObraValuesEqual(current[key], initial[key])) {
				(dirty as Record<string, unknown>)[key] = current[key];
			}
		}
		return dirty;
	}, [areObraValuesEqual]);

	const persistObra = useCallback(
		async (value: Partial<Obra>, options?: { method?: "PUT" | "PATCH" }) => {
			if (!obraId || obraId === "undefined") {
				toast.error("Obra no encontrada");
				return;
			}

			const method = options?.method ?? "PUT";
			setIsSavingObra(true);
			try {
				const payload = {
					...value,
					...(method === "PUT" ? { id: obraId } : {}),
					...(typeof value.onFinishSecondSendAt !== "undefined"
						? {
							onFinishSecondSendAt:
								toIsoDateTime(value.onFinishSecondSendAt ?? null) ?? null,
						}
						: {}),
				};
				const response = await fetch(`/api/obras/${obraId}`, {
					method,
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(payload),
				});

				if (!response.ok) {
					const result = await response.json().catch(() => ({}));
					const details =
						typeof result?.details === "object" && result.details !== null
							? JSON.stringify(result.details)
							: "";
					throw new Error([result.error ?? "No se pudo actualizar la obra", details].filter(Boolean).join(": "));
				}

				setInitialFormValues((previous) => ({
					...previous,
					...value,
					id: obraId,
				}));
				setDerivedCertificadosNotice(null);
				setPendingDerivedFieldValues((previous) =>
					Object.keys(previous).length === 0 ? previous : {},
				);
				toast.success("Obra actualizada correctamente");

				queryClient.invalidateQueries({ queryKey: ['obra', obraId] });
				queryClient.invalidateQueries({ queryKey: ['obras-dashboard'] });
				invalidateObrasTableSessionCache();
			} catch (error) {
				console.error(error);
				toast.error(
					error instanceof Error
						? error.message
						: "No se pudo actualizar la obra"
				);
			} finally {
				setIsSavingObra(false);
			}
		},
		[obraId, initialFormValues, queryClient]
	);

	const handleDataFlowSuggestionDecision = useCallback(
		async (suggestionId: string, decision: "accept" | "reject") => {
			if (!obraId || obraId === "undefined") return;
			setIsResolvingDataFlowSuggestion(true);
			try {
				const response = await fetch(`/api/obras/${obraId}/data-flow-suggestions`, {
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ suggestionId, decision }),
				});
				const result = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw new Error(result.error ?? "No se pudo actualizar la solicitud de data-flow");
				}
				toast.success(decision === "accept" ? "Solicitud aplicada" : "Solicitud rechazada");
				await Promise.all([
					queryClient.invalidateQueries({ queryKey: ["obra", obraId] }),
					queryClient.invalidateQueries({ queryKey: ["obra", obraId, "data-flow-suggestions"] }),
					queryClient.invalidateQueries({ queryKey: ["obras-dashboard"] }),
				]);
				invalidateObrasTableSessionCache();
			} catch (error) {
				console.error(error);
				toast.error(
					error instanceof Error
						? error.message
						: "No se pudo actualizar la solicitud de data-flow"
				);
			} finally {
				setIsResolvingDataFlowSuggestion(false);
			}
		},
		[obraId, queryClient]
	);

	const form = useForm({
		defaultValues: emptyObra,
		validators: {
			onChange: obraSchema,
		},
		onSubmit: async ({ value }) => {
			const dirtyPayload = buildDirtyObraPayload(value, initialFormValues);
			if (Object.keys(dirtyPayload).length === 0) return;
			await persistObra(dirtyPayload, { method: "PATCH" });
		},
	});

	const saveCurrentObra = useCallback(async () => {
		const dirtyPayload = buildDirtyObraPayload(
			form.state.values as Obra,
			initialFormValues
		);
		if (Object.keys(dirtyPayload).length === 0) return;
		await persistObra(dirtyPayload, { method: "PATCH" });
	}, [buildDirtyObraPayload, form.state.values, initialFormValues, persistObra]);

	const handleDeleteObra = useCallback(async () => {
		if (!canDeleteObra) {
			toast.error("No tenes permiso para borrar obras.");
			return;
		}

		if (!obraId || obraId === "undefined") {
			toast.error("Obra no encontrada");
			return;
		}

		const confirmed = window.confirm(
			"Esta accion eliminara la obra. ¿Querés continuar?",
		);
		if (!confirmed) return;

		setIsDeletingObra(true);
		try {
			const response = await fetch(`/api/obras/${obraId}`, {
				method: "DELETE",
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(payload.error ?? "No se pudo eliminar la obra");
			}

			invalidateObrasTableSessionCache();
			queryClient.invalidateQueries({ queryKey: ["obras-dashboard"] });
			toast.success("Obra eliminada");
			push("/excel");
		} catch (error) {
			console.error(error);
			toast.error(
				error instanceof Error
					? error.message
					: "No se pudo eliminar la obra",
			);
		} finally {
			setIsDeletingObra(false);
		}
	}, [canDeleteObra, obraId, push, queryClient]);

	const activeMainTableColumns = useMemo(
		() =>
			(mainTableColumnsConfig ?? DEFAULT_MAIN_TABLE_COLUMN_CONFIG).filter(
				(column) => column.enabled !== false
			),
		[mainTableColumnsConfig]
	);

	const mainTableColumnValues = useMemo(() => {
		const customData =
			(form.state.values.customData as Record<string, unknown> | null) ?? {};
		const source = {
			...(form.state.values as Record<string, unknown>),
			...customData,
		};
		const values: Record<string, unknown> = {};
		for (const column of activeMainTableColumns) {
			values[column.id] =
				column.kind === "formula"
					? evaluateMainFormula(column.formula ?? "", source)
					: column.kind === "custom"
						? customData[column.id]
						: source[column.baseColumnId ?? column.id];
		}
		return values;
	}, [activeMainTableColumns, form.state.values]);

	// Only depend on form (stable hook reference) - read current customData at call time
	// to avoid stale closure and excessive callback recreation
	const setCustomMainColumnValue = useCallback(
		(columnId: string, value: unknown) => {
			// Read current value at call time, not capture time
			const previous =
				(form.state.values.customData as Record<string, unknown> | null) ?? {};
			const next = { ...previous };
			if (value == null || value === "") {
				delete next[columnId];
			} else {
				next[columnId] = value;
			}
			form.setFieldValue("customData", next);
		},
		[form]
	);

	// Helper to check if a field has unsaved changes
	const isFieldDirty = useCallback((fieldName: keyof Obra) => {
		const currentValue = form.state.values[fieldName];
		const initialValue = initialFormValues[fieldName];
		return currentValue !== initialValue;
	}, [form.state.values, initialFormValues]);

	// Helper to check if ANY field has unsaved changes
	const hasUnsavedChanges = useCallback(() => {
		return (Object.keys(form.state.values) as (keyof Obra)[]).some((key) => {
			return isFieldDirty(key);
		});
	}, [form.state.values, isFieldDirty]);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	useEffect(() => {
		void (async () => {
			try {
				const supabase = createSupabaseBrowserClient();
				const { data } = await supabase.auth.getUser();
				setCurrentUserId(data.user?.id ?? null);
			} catch {
				// no-op
			}
		})();
	}, []);

	const getErrorMessage = useCallback((errors: unknown): string => {
		if (!errors) return "";
		if (Array.isArray(errors)) {
			const first = errors[0] as unknown;
			if (typeof first === "string") return first;
			if (first && typeof first === "object" && "message" in first) return String(first.message);
			return JSON.stringify(first);
		}
		if (typeof errors === "object" && errors !== null) {
			const errorRecord = errors as Record<string, unknown>;
			if ("message" in errorRecord) return String(errorRecord.message);
			return JSON.stringify(errorRecord);
		}
		return String(errors);
	}, []);

	const applyObraToForm = useCallback(
		(raw: Obra) => {
			const normalized: Obra = {
				...emptyObra,
				...raw,
				onFinishSecondSendAt: toLocalDateTimeValue(raw.onFinishSecondSendAt ?? null),
			};

			(Object.keys(normalized) as (keyof Obra)[]).forEach((key) => {
				form.setFieldValue(key, normalized[key]);
			});

			// Store initial values for dirty tracking
			setInitialFormValues(normalized);
			setDerivedCertificadosNotice(null);
			setPendingDerivedFieldValues((previous) =>
				Object.keys(previous).length === 0 ? previous : {},
			);
		},
		[form]
	);

	// Apply obra data to form when it loads
	useEffect(() => {
		if (obraQuery.data) {
			const updatedAt = obraQuery.dataUpdatedAt ?? 0;
			if (updatedAt <= 0) return;
			if (updatedAt === lastAppliedObraDataUpdatedAtRef.current) return;
			lastAppliedObraDataUpdatedAtRef.current = updatedAt;
			applyObraToForm(obraQuery.data);
		}
	}, [obraQuery.data, obraQuery.dataUpdatedAt, applyObraToForm]);

	const hasDataFlowDerivedCertificadosAuthority = useMemo(() => {
		const ownedByConfig = dataFlowConfigQuery.data?.effectiveConfig?.results?.some((result) => {
			const targetFieldId = typeof result.targetObraFieldId === "string" ? result.targetObraFieldId.trim() : "";
			return result.writebackMode !== "none" && DATA_FLOW_DERIVED_CERTIFICADOS_FIELDS.has(targetFieldId);
		}) ?? false;
		if (ownedByConfig) return true;

		return (dataFlowSuggestionsQuery.data ?? []).some((suggestion) => {
			return suggestion.status === "pending" && DATA_FLOW_DERIVED_CERTIFICADOS_FIELDS.has(suggestion.field_id);
		});
	}, [dataFlowConfigQuery.data, dataFlowSuggestionsQuery.data]);

	useEffect(() => {
		if (hasDataFlowDerivedCertificadosAuthority) {
			setDerivedCertificadosNotice(null);
			setPendingDerivedFieldValues((previous) =>
				Object.keys(previous).length === 0 ? previous : {},
			);
			return;
		}
		if (!obraData || certificadosExtraidosRows.length === 0) return;
		if (latestExtractedCertificadoALaFecha == null) return;

		const savedCertificadoIsManual =
			!isUnsetDerivedNumber(obraData.certificadoALaFecha) &&
			!approximatelyEqual(
				obraData.certificadoALaFecha,
				latestExtractedCertificadoALaFecha,
			);
		const currentCertificadoIsDirty = !approximatelyEqual(
			form.state.values.certificadoALaFecha,
			initialFormValues.certificadoALaFecha,
		);

		const savedMetrics = computeDerivedCertificadosMetrics(
			certificadosExtraidosRows,
			obraData.contratoMasAmpliaciones,
			certRecommendationsMapping,
			savedCertificadoIsManual ? obraData.certificadoALaFecha : undefined,
		);
		const currentMetrics = computeDerivedCertificadosMetrics(
			certificadosExtraidosRows,
			form.state.values.contratoMasAmpliaciones,
			certRecommendationsMapping,
			savedCertificadoIsManual || currentCertificadoIsDirty
				? form.state.values.certificadoALaFecha
				: undefined,
		);
		const extractedMetrics = computeDerivedCertificadosMetrics(
			certificadosExtraidosRows,
			form.state.values.contratoMasAmpliaciones,
			certRecommendationsMapping,
		);

		if (!savedMetrics || !currentMetrics) return;

		const savedSaldoIsManual =
			!isUnsetDerivedNumber(obraData.saldoACertificar) &&
			!approximatelyEqual(
				obraData.saldoACertificar,
				savedMetrics.saldoACertificar,
			);
		const savedPorcentajeIsManual =
			!isUnsetDerivedNumber(obraData.porcentaje) &&
			!approximatelyEqual(
				obraData.porcentaje,
				savedMetrics.porcentaje,
			);

		const currentSaldoIsDirty = !approximatelyEqual(
			form.state.values.saldoACertificar,
			initialFormValues.saldoACertificar,
		);
		const currentPorcentajeIsDirty = !approximatelyEqual(
			form.state.values.porcentaje,
			initialFormValues.porcentaje,
		);

		const updates: Partial<Record<DerivedCertificadosField, number>> = {};
		const suggestedManualUpdates: Partial<Record<DerivedCertificadosField, number>> = {};
		const blockedFieldLabels: Record<"saldoACertificar" | "porcentaje", string> = {
			saldoACertificar: "Saldo a certificar",
			porcentaje: "Porcentaje de avance",
		};
		const nextPendingDerivedFieldValues = { ...pendingDerivedFieldValues };
		let pendingChanged = false;

		(Object.keys(nextPendingDerivedFieldValues) as DerivedCertificadosField[]).forEach((field) => {
			const pendingValue = nextPendingDerivedFieldValues[field];
			if (pendingValue == null) return;
			if (!approximatelyEqual(form.state.values[field], pendingValue)) {
				delete nextPendingDerivedFieldValues[field];
				pendingChanged = true;
			}
		});

		const maybeApplyDerivedField = (
			field: DerivedCertificadosField,
			nextValue: number,
			options: {
				currentValue: unknown;
				currentDirty: boolean;
				savedValue: unknown;
				savedManual: boolean;
			},
		) => {
			if (options.currentDirty) return;
			if (!isUnsetDerivedNumber(options.savedValue) && options.savedManual) return;
			if (approximatelyEqual(options.currentValue, nextValue)) return;
			updates[field] = nextValue;
		};

		maybeApplyDerivedField("certificadoALaFecha", currentMetrics.certificadoALaFecha, {
			currentValue: form.state.values.certificadoALaFecha,
			currentDirty: currentCertificadoIsDirty,
			savedValue: obraData.certificadoALaFecha,
			savedManual: savedCertificadoIsManual,
		});
		if (currentMetrics.saldoACertificar != null) {
			maybeApplyDerivedField("saldoACertificar", currentMetrics.saldoACertificar, {
				currentValue: form.state.values.saldoACertificar,
				currentDirty: currentSaldoIsDirty,
				savedValue: obraData.saldoACertificar,
				savedManual: savedSaldoIsManual,
			});
		}
		if (currentMetrics.porcentaje != null) {
			maybeApplyDerivedField("porcentaje", currentMetrics.porcentaje, {
				currentValue: form.state.values.porcentaje,
				currentDirty: currentPorcentajeIsDirty,
				savedValue: obraData.porcentaje,
				savedManual: savedPorcentajeIsManual,
			});
		}
		if (savedCertificadoIsManual && extractedMetrics) {
			const maybeSuggestManualField = (
				field: DerivedCertificadosField,
				nextValue: number | null,
				currentValue: unknown,
			) => {
				if (nextValue == null) return;
				if (approximatelyEqual(currentValue, nextValue)) return;
				suggestedManualUpdates[field] = nextValue;
			};
			maybeSuggestManualField(
				"certificadoALaFecha",
				extractedMetrics.certificadoALaFecha,
				form.state.values.certificadoALaFecha,
			);
			maybeSuggestManualField(
				"saldoACertificar",
				extractedMetrics.saldoACertificar,
				form.state.values.saldoACertificar,
			);
			maybeSuggestManualField(
				"porcentaje",
				extractedMetrics.porcentaje,
				form.state.values.porcentaje,
			);
		}

		const fieldLabels: Record<DerivedCertificadosField, string> = {
			certificadoALaFecha: "Certificado a la fecha",
			saldoACertificar: "Saldo a certificar",
			porcentaje: "Porcentaje de avance",
		};
		const blockedFieldKeys = currentMetrics.blockedFieldKeys;
		const hasUpdates = Object.keys(updates).length > 0;
		const hasManualSuggestions = Object.keys(suggestedManualUpdates).length > 0;
		const hasBlockedFields = blockedFieldKeys.length > 0;

		blockedFieldKeys.forEach((field) => {
			const pendingValue = nextPendingDerivedFieldValues[field];
			if (pendingValue == null) return;
			if (approximatelyEqual(form.state.values[field], pendingValue)) {
				form.setFieldValue(field, initialFormValues[field]);
			}
			delete nextPendingDerivedFieldValues[field];
			pendingChanged = true;
		});

		if (!hasUpdates && !hasBlockedFields && !hasManualSuggestions) {
			if (pendingChanged) {
				setPendingDerivedFieldValues(nextPendingDerivedFieldValues);
			}
			setDerivedCertificadosNotice(null);
			return;
		}

	(Object.entries(updates) as Array<[DerivedCertificadosField, number]>).forEach(
			([field, nextValue]) => {
				form.setFieldValue(field, nextValue);
				nextPendingDerivedFieldValues[field] = nextValue;
				pendingChanged = true;
			},
		);
		if (pendingChanged) {
			setPendingDerivedFieldValues(nextPendingDerivedFieldValues);
		}
		const effectiveUpdatedFieldKeys = hasUpdates
			? (Object.keys(updates) as DerivedCertificadosField[])
			: hasManualSuggestions
				? (Object.keys(suggestedManualUpdates) as DerivedCertificadosField[])
				: [];
		const manualSuggestionMessage = hasManualSuggestions
			? "Se detectaron nuevos valores desde Certificados Extraidos, pero los campos actuales parecen manuales. Revisalos y aplicalos si corresponde."
			: null;
		const recommendedValues: Partial<Record<DerivedCertificadosField, number>> = {
			...(updates as Partial<Record<DerivedCertificadosField, number>>),
			...(suggestedManualUpdates as Partial<Record<DerivedCertificadosField, number>>),
		};
		setDerivedCertificadosNotice({
			sourceLabel: latestExtractedCertificadoSourceLabel,
			updatedFieldKeys: effectiveUpdatedFieldKeys,
			updatedFieldLabels: effectiveUpdatedFieldKeys.map(
				(field) => fieldLabels[field],
			),
			recommendedValues,
			blockedFieldKeys,
			blockedFieldLabels: blockedFieldKeys.map((field) => blockedFieldLabels[field]),
			warningMessage:
				[currentMetrics.warningMessage, manualSuggestionMessage]
					.filter((message): message is string => Boolean(message))
					.join(" ") || null,
		});
	}, [
		certRecommendationsMapping,
		certificadosExtraidosRows,
		form,
		form.state.values.certificadoALaFecha,
		form.state.values.contratoMasAmpliaciones,
		form.state.values.porcentaje,
		form.state.values.saldoACertificar,
		initialFormValues.certificadoALaFecha,
		initialFormValues.porcentaje,
		initialFormValues.saldoACertificar,
		hasDataFlowDerivedCertificadosAuthority,
		latestExtractedCertificadoALaFecha,
		latestExtractedCertificadoSourceLabel,
		obraData,
		pendingDerivedFieldValues,
	]);

	// Apply pendientes data when it loads
	useEffect(() => {
		if (pendientesQuery.data && pendientesQuery.data.length > 0) {
			setPendingDocs(pendientesQuery.data);
		}
	}, [pendientesQuery.data]);

	const handleNewCertificateChange = useCallback(
		(field: keyof NewCertificateFormState, value: string) => {
			setNewCertificate((prev) => ({ ...prev, [field]: value }));
		},
		[]
	);

	const handleToggleAddCertificate = useCallback(() => {
		setCreateCertificateError(null);
		setIsAddingCertificate((prev) => {
			const next = !prev;
			if (!next) {
				setNewCertificate({ ...certificateFormDefault });
			}
			return next;
		});
	}, []);

	const updatePendingDoc = useCallback((index: number, field: keyof PendingDoc, value: string | boolean | number) => {
		setPendingDocs((prev) => {
			const next = [...prev];
			next[index] = { ...next[index], [field]: value } as PendingDoc;
			return next;
		});
	}, []);

	const scheduleReminderForDoc = useCallback(async (doc: PendingDoc) => {
		if (!obraId || obraId === "undefined") return;
		if (doc.dueMode !== "fixed" || !doc.dueDate) return;
		try {
			const res = await fetch("/api/doc-reminders", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					obraId,
					obraName: null,
					documentName: doc.name || "Documento",
					dueDate: doc.dueDate,
					notifyUserId: currentUserId,
					pendienteId: doc.id && /[0-9a-f-]{36}/i.test(doc.id) ? doc.id : null,
				}),
			});
			if (!res.ok) throw new Error("Failed to schedule");
			toast.success("Recordatorio programado");
		} catch (err) {
			console.error(err);
			toast.error("No se pudo programar el recordatorio");
		}
	}, [obraId, currentUserId]);

	// Pendientes are loaded via React Query (pendientesQuery) - no manual fetch needed

	const savePendingDoc = useCallback(async (doc: PendingDoc, index: number) => {
		if (!obraId || obraId === "undefined") return;
		try {
			const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(doc.id);
			const method = isUuid ? "PUT" : "POST";
			const res = await fetch(`/api/obras/${obraId}/pendientes`, {
				method,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: isUuid ? doc.id : undefined,
					name: doc.name,
					poliza: doc.poliza || null,
					dueMode: doc.dueMode,
					dueDate: doc.dueMode === "fixed" ? (doc.dueDate || null) : null,
					offsetDays: doc.dueMode === "after_completion" ? Number(doc.offsetDays || 0) : null,
					done: doc.done,
				}),
			});
			if (!res.ok) throw new Error("No se pudo guardar");
			const json = await res.json().catch(() => ({}));
			let effectiveDoc = doc;
			if (!isUuid && json?.pendiente?.id) {
				const newId = String(json.pendiente.id);
				effectiveDoc = { ...doc, id: newId };
				setPendingDocs((prev) => {
					const next = [...prev];
					next[index] = effectiveDoc;
					return next;
				});
			}
			toast.success("Pendiente actualizado");
			if (effectiveDoc.dueMode === "fixed" && effectiveDoc.dueDate) {
				await scheduleReminderForDoc(effectiveDoc);
			}
		} catch (err) {
			console.error(err);
			toast.error("No se pudo guardar el pendiente");
		}
	}, [obraId, scheduleReminderForDoc]);

	const deletePendingDoc = useCallback(async (doc: PendingDoc, index: number) => {
		if (!obraId || obraId === "undefined") return;

		// If it's a temporary (unsaved) doc, just remove it from the list
		const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(doc.id);
		if (!isUuid) {
			setPendingDocs((prev) => prev.filter((_, i) => i !== index));
			return;
		}

		try {
			const res = await fetch(`/api/obras/${obraId}/pendientes?id=${doc.id}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error("No se pudo eliminar");
			setPendingDocs((prev) => prev.filter((_, i) => i !== index));
			toast.success("Pendiente eliminado");
		} catch (err) {
			console.error(err);
			toast.error("No se pudo eliminar el pendiente");
		}
	}, [obraId]);

	// Recipients are now loaded via React Query (recipientsQuery) - no manual effect needed

	const saveFlujoAction = useCallback(async () => {
		if (!obraId || obraId === "undefined") return;
		if (!newFlujoAction.title) {
			toast.error("El título es requerido");
			return;
		}

		setIsSavingFlujoAction(true);

		try {
			// Derive recipient user IDs from explicit selection and optional role
			let recipientUserIds: string[] = [];
			if (selectedRecipientUserId) {
				recipientUserIds.push(selectedRecipientUserId);
			}
			if (selectedRecipientRoleId) {
				const roleId = selectedRecipientRoleId;
				const roleUserIds = obraUserRoles
					.filter((ur) => ur.role_id === roleId)
					.map((ur) => ur.user_id);
				recipientUserIds.push(...roleUserIds);
			}

			recipientUserIds = Array.from(new Set(recipientUserIds));

			const res = await fetch("/api/flujo-actions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					obraId,
					actionType: newFlujoAction.action_type,
					timingMode: newFlujoAction.timing_mode,
					offsetValue: newFlujoAction.offset_value,
					offsetUnit: newFlujoAction.offset_unit,
					scheduledDate: newFlujoAction.scheduled_date,
					title: newFlujoAction.title,
					message: newFlujoAction.message,
					recipientUserIds,
					notificationTypes: (newFlujoAction.notification_types ??
						["in_app"]) as ("in_app" | "email")[],
				}),
			});

			if (!res.ok) throw new Error("Failed to save flujo action");

			// Get the created action from response
			const data = await res.json();
			const createdAction = data.action as FlujoAction;

			// Optimistic update - add the new action immediately
			if (createdAction) {
				queryClient.setQueryData<FlujoAction[]>(
					['obra', obraId, 'flujo-actions'],
					(prev = []) => [...prev, createdAction]
				);
			}

			// Reset form and close immediately
			setNewFlujoAction({
				action_type: 'email',
				timing_mode: 'immediate',
				offset_value: 1,
				offset_unit: 'days',
				title: '',
				message: '',
				recipient_user_ids: [],
				notification_types: ["in_app", "email"],
				enabled: true,
			});
			setSelectedRecipientUserId("");
			setSelectedRecipientRoleId("");
			setIsAddingFlujoAction(false);
			toast.success("Acción de flujo creada");
		} catch (err) {
			console.error("Error saving flujo action:", err);
			toast.error("No se pudo guardar la acción de flujo");
		} finally {
			setIsSavingFlujoAction(false);
		}
	}, [obraId, newFlujoAction, obraUserRoles, queryClient, selectedRecipientRoleId, selectedRecipientUserId]);

	const deleteFlujoAction = useCallback(async (actionId: string) => {
		if (!obraId || obraId === "undefined") return;

		try {
			const res = await fetch(`/api/flujo-actions?id=${actionId}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error("Failed to delete flujo action");
			queryClient.setQueryData<FlujoAction[]>(
				['obra', obraId, 'flujo-actions'],
				(prev = []) => prev.filter((a) => a.id !== actionId)
			);
			toast.success("Acción de flujo eliminada");
		} catch (err) {
			console.error("Error deleting flujo action:", err);
			toast.error("No se pudo eliminar la acción de flujo");
		}
	}, [obraId, queryClient]);

	const toggleFlujoAction = useCallback(async (actionId: string, enabled: boolean) => {
		if (!obraId || obraId === "undefined") return;

		try {
			const res = await fetch("/api/flujo-actions", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: actionId, enabled }),
			});
			if (!res.ok) throw new Error("Failed to toggle flujo action");
			queryClient.setQueryData<FlujoAction[]>(
				['obra', obraId, 'flujo-actions'],
				(prev = []) => prev.map((a) => (a.id === actionId ? { ...a, enabled } : a))
			);
			toast.success(enabled ? "Acción activada" : "Acción desactivada");
		} catch (err) {
			console.error("Error toggling flujo action:", err);
			toast.error("No se pudo actualizar la acción");
		}
	}, [obraId, queryClient]);

	const updateFlujoAction = useCallback(async (actionId: string, updates: Partial<FlujoAction>) => {
		if (!obraId || obraId === "undefined") return;

		try {
			// Convert snake_case to camelCase for API
			// Also convert empty strings to null for optional fields
			const apiPayload: Record<string, unknown> = { id: actionId };
			if (updates.title !== undefined) apiPayload.title = updates.title;
			if (updates.message !== undefined) apiPayload.message = updates.message || null;
			if (updates.timing_mode !== undefined) apiPayload.timingMode = updates.timing_mode;
			if (updates.offset_value !== undefined) apiPayload.offsetValue = updates.offset_value;
			if (updates.offset_unit !== undefined) apiPayload.offsetUnit = updates.offset_unit;
			if (updates.scheduled_date !== undefined) apiPayload.scheduledDate = updates.scheduled_date || null;
			if (updates.enabled !== undefined) apiPayload.enabled = updates.enabled;
			if (updates.notification_types !== undefined) apiPayload.notificationTypes = updates.notification_types;

			// Check if timing is being changed - need to reload to get new scheduled_for
			const timingChanged = updates.timing_mode !== undefined ||
				updates.offset_value !== undefined ||
				updates.offset_unit !== undefined ||
				updates.scheduled_date !== undefined;

			const res = await fetch("/api/flujo-actions", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(apiPayload),
			});
			if (!res.ok) throw new Error("Failed to update flujo action");

			// If timing changed, reload all actions to get updated scheduled_for
			// Otherwise just update locally
			if (timingChanged) {
				await queryClient.invalidateQueries({ queryKey: ['obra', obraId, 'flujo-actions'] });
			} else {
				queryClient.setQueryData<FlujoAction[]>(
					['obra', obraId, 'flujo-actions'],
					(prev = []) => prev.map((a) => (a.id === actionId ? { ...a, ...updates } : a))
				);
			}
			toast.success("Acción actualizada correctamente");
		} catch (err) {
			console.error("Error updating flujo action:", err);
			toast.error("No se pudo actualizar la acción");
		}
	}, [obraId, queryClient]);

	const refreshCertificates = useCallback(async () => {
		if (!obraId || obraId === "undefined") {
			return;
		}
		await queryClient.invalidateQueries({ queryKey: ['obra', obraId, 'certificates'] });
	}, [obraId, queryClient]);

	const handleCreateCertificate = useCallback(
		async (event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();

			if (!obraId || obraId === "undefined") {
				toast.error("Obra no encontrada");
				return;
			}

			const trimmedExp = newCertificate.n_exp.trim();
			const trimmedMes = newCertificate.mes.trim();
			const certificadoRaw = newCertificate.n_certificado.trim();
			const montoRaw = newCertificate.monto.trim();
			const nCertNumber = Number(newCertificate.n_certificado);
			const montoNumber = Number(newCertificate.monto);

			if (!trimmedExp) {
				setCreateCertificateError("El número de expediente es obligatorio");
				return;
			}

			if (!certificadoRaw || Number.isNaN(nCertNumber)) {
				setCreateCertificateError("El número de certificado debe ser un número");
				return;
			}

			if (!montoRaw || Number.isNaN(montoNumber)) {
				setCreateCertificateError("El monto debe ser un número");
				return;
			}

			if (!trimmedMes) {
				setCreateCertificateError("El mes es obligatorio");
				return;
			}

			setCreateCertificateError(null);
			setIsCreatingCertificate(true);

			try {
				const response = await fetch(`/api/obras/${obraId}/certificates`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						n_exp: trimmedExp,
						n_certificado: nCertNumber,
						monto: montoNumber,
						mes: trimmedMes,
						estado: newCertificate.estado.trim() || "CERTIFICADO",
					}),
				});

				if (!response.ok) {
					const result = await response.json().catch(() => ({}));
					throw new Error(result.error ?? "No se pudo crear el certificado");
				}

				toast.success("Certificado agregado correctamente");
				setNewCertificate({ ...certificateFormDefault });
				await refreshCertificates();
			} catch (error) {
				console.error("Error creating certificate:", error);
				const message =
					error instanceof Error
						? error.message
						: "No se pudo crear el certificado";
				setCreateCertificateError(message);
				toast.error(message);
			} finally {
				setIsCreatingCertificate(false);
			}
		},
		[obraId, newCertificate, refreshCertificates]
	);

	// Certificates are loaded via React Query (certificatesQuery) - no manual refetch on mount needed

	const memoriaHeader = (
		<div className="flex items-center justify-between gap-2">
			<div className="flex items-center gap-2">
				<StickyNote className="size-4 text-primary" />
				<h2 className="text-sm font-semibold">Memoria descriptiva de la obra</h2>
			</div>
		</div>
	);

	const memoriaContent = (
		<>
			{!isMobile && memoriaHeader}

			<div className="space-y-2">
				<label className="text-xs font-medium text-muted-foreground">
					Nueva nota
				</label>
				<Textarea
					value={memoriaDraft}
					onChange={(e) => setMemoriaDraft(e.target.value)}
					placeholder="Escribe aquí notas, decisiones o contexto importante sobre esta obra..."
					className="min-h-[80px] text-sm"
				/>
				<div className="flex justify-end">
					<Button
						type="button"
						size="sm"
						disabled={!memoriaDraft.trim()}
						onClick={async () => {
							const text = memoriaDraft.trim();
							if (!text || !obraId || obraId === "undefined") return;
							try {
								const res = await fetch(`/api/obras/${obraId}/memoria`, {
									method: "POST",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({ text }),
								});
								if (!res.ok) {
									const out = await res.json().catch(() => ({} as { error?: string }));
									throw new Error(out?.error || "No se pudo guardar la nota");
								}
								const out = await res.json();
								const note = out?.note;
								if (note) {
									const newNote: MemoriaNote = {
										id: String(note.id),
										text: String(note.text ?? ""),
										createdAt: String(note.createdAt ?? note.created_at ?? ""),
										userId: String(note.userId ?? note.user_id ?? ""),
										userName:
											typeof note.userName === "string"
												? note.userName
												: note.user_name ?? null,
									};
									queryClient.setQueryData<MemoriaNote[]>(
										['obra', obraId, 'memoria'],
										(prev = []) => [newNote, ...prev]
									);
								}
								setMemoriaDraft("");
							} catch (err) {
								console.error(err);
								const message =
									err instanceof Error ? err.message : "No se pudo guardar la nota";
								toast.error(message);
							}
						}}
					>
						Guardar nota
					</Button>
				</div>
			</div>

			<Separator />

			<div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
				{memoriaNotes.length === 0 ? (
					<p className="text-xs text-muted-foreground">
						Todavía no hay notas para esta obra. Usa este espacio para registrar decisiones,
						aclaraciones o contexto importante.
					</p>
				) : (
					memoriaNotes.map((note) => (
						<div
							key={note.id}
							className="rounded-md border bg-background/60 px-3 py-2 text-xs space-y-1"
						>
							<div className="flex items-center justify-between gap-2">
								<div className="flex items-center gap-2">
									<div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary capitalize">
										{(note.userName || "?")
											.split(" ")
											.filter(Boolean)
											.slice(0, 2)
											.map((part) => part[0])
											.join("")}
									</div>
									<div className="flex flex-col">
										<span className="font-medium text-foreground">
											{note.userName || "Usuario"}
										</span>
										{currentUserId === note.userId && (
											<span className="text-[10px] text-muted-foreground">
												Tú
											</span>
										)}
									</div>
								</div>
								<span className="text-[10px] text-muted-foreground">
									<HydratedDateText
										value={note.createdAt}
										options={{ day: "2-digit", month: "2-digit", year: "numeric" }}
									/>
								</span>
							</div>
							<p className="text-foreground leading-relaxed">{note.text}</p>
						</div>
					))
				)}
			</div>
		</>
	);

	const ilagMaterialsReportFlow = useMemo<WizardFlow | null>(() => {
		if (!isIlagDemoTenant) return null;
		return {
			id: "ilag-materials-analysis-report",
			title: "Reporte de Analisis de Materiales",
			steps: [
				{
					id: "intro",
					targetId: "obra-page-ilag-material-report-button",
					title: "Reporte de Analisis de Materiales",
					content:
						"Esta guia te muestra el flujo completo para cargar el Excel de materiales y generar el reporte.",
					placement: "bottom",
				},
				{
					id: "go-documents",
					targetId: "obra-page-file-manager-tab",
					title: "Abri Documentos",
					content:
						"Hace clic en la pestana Documentos para continuar con la carga del archivo.",
					placement: "bottom",
					allowClickThrough: true,
					requiredAction: "click_target",
					waitForMs: 2400,
					fallback: "continue",
				},
				{
					id: "open-target-folder",
					targetId: "documents-folder-thumbnail-presupuesto-personalizado",
					title: "Carpeta presupuesto-personalizado",
					content:
						"Entra en la carpeta presupuesto-personalizado. Si no existe, creala con ese nombre.",
					placement: "bottom",
					allowClickThrough: true,
					requiredAction: "click_target",
					waitForMs: 3000,
					fallback: "continue",
				},
				{
					id: "drop-excel",
					targetId: "documents-dropzone",
					title: "Carga el archivo Excel",
					content:
						"Arrastra y suelta el Excel en esa carpeta para importar los datos. Si ya está cargado, podes continuar.",
					placement: "top",
					waitForMs: 2600,
					fallback: "continue",
				},
				{
					id: "switch-to-table-mode",
					targetId: "documents-view-mode-table",
					title: "Pasa a vista Tabla",
					content:
						"Cambia a la vista Tabla para revisar que los datos se hayan cargado correctamente.",
					placement: "left",
					allowClickThrough: true,
					requiredAction: "click_target",
					waitForMs: 2600,
					fallback: "continue",
				},
				{
					id: "generate-report-from-table-view",
					targetId: "documents-table-generate-report",
					title: "Generar reporte desde Tabla",
					content:
						"En la vista Tabla, selecciona 'presupuesto personalizado - materiales' y hace clic en Generar reporte.",
					placement: "left",
					allowClickThrough: true,
					requiredAction: "click_target",
					waitForMs: 2600,
					fallback: "continue",
				},
			],
		};
	}, [isIlagDemoTenant]);

	const guidedObraFlow = useMemo<WizardFlow | null>(() => {
		if (!isGuidedExcelFlow) return null;
		if (guidedTourStage === GUIDED_EXCEL_STAGES.generalReviewUpdatedData) {
			return {
				id: "guided-obra-review-updates",
				title: "Recorrido guiado",
				steps: [
					{
						id: "review-updated-data",
						targetId: "obra-curva-avance",
						title: "El nuevo certificado ya está incorporado",
						content:
							"La línea naranja muestra el avance real con el certificado que cargaste.",
						placement: "bottom",
						skippable: false,
					},
				],
			};
		}

		if (activeTab !== "general") return null;

		if (guidedTourStage === GUIDED_EXCEL_STAGES.obraIntro) {
			return {
				id: "guided-obra-general",
				title: "Recorrido guiado",
				steps: [
					{
						id: "obra-general",
						targetId: "obra-page-content",
						title: "El estado completo de la obra, en una sola pantalla",
						content:
							"Avance físico, importes del contrato, fechas clave y alertas activas. Todo lo que necesitás para entender el estado real de la obra sin abrir ninguna planilla.",
						placement: "top",
						skippable: true,
					},
					{
						id: "missing-certificado",
						targetId: hasMissingCurrentMonthFinding
							? "obra-general-missing-current-certificado"
							: "obra-general-findings",
						title: "Falta el certificado del mes actual",
						content:
							"El sistema detectó que la obra tiene certificados anteriores pero el del mes actual todavía no fue cargado. Lo subimos ahora desde Documentos.",
						placement: "right",
						skippable: true,
						waitForMs: 2800,
					},
					{
						id: "go-documents",
						targetId: "obra-page-file-manager-tab",
						title: "Andá a Documentos",
						content:
							"Hacé clic en la pestaña Documentos para cargar el certificado faltante. Subís el PDF y el sistema extrae los datos automáticamente.",
						placement: "bottom",
						allowClickThrough: true,
						requiredAction: "click_target",
						skippable: true,
						waitForMs: 2200,
					},
				],
			};
		}

		if (guidedTourStage === GUIDED_EXCEL_STAGES.obraMissingCertificado) {
			return {
				id: "guided-obra-missing-cert",
				title: "Recorrido guiado",
				steps: [
					{
						id: "missing-certificado",
						targetId: hasMissingCurrentMonthFinding
							? "obra-general-missing-current-certificado"
							: "obra-general-findings",
						title: "Falta el certificado del mes actual",
						content:
							"Esta obra tiene historial cargado pero le falta el certificado del período actual. Lo cargamos ahora desde Documentos.",
						placement: "left",
						skippable: true,
						waitForMs: 2800,
					},
					{
						id: "go-documents",
						targetId: "obra-page-file-manager-tab",
						title: "Abrí Documentos",
						content:
							"Entrá a Documentos para completar la carga que falta y revisar los datos extraídos.",
						placement: "bottom",
						allowClickThrough: true,
						requiredAction: "click_target",
						skippable: true,
						waitForMs: 2200,
					},
				],
			};
		}

		if (guidedTourStage === GUIDED_EXCEL_STAGES.obraGoDocuments) {
			return {
				id: "guided-obra-go-documents",
				title: "Recorrido guiado",
				steps: [
					{
						id: "go-documents",
						targetId: "obra-page-file-manager-tab",
						title: "Abrí Documentos",
						content:
							"Hacé clic acá para subir el certificado faltante.",
						placement: "bottom",
						allowClickThrough: true,
						requiredAction: "click_target",
						skippable: true,
						waitForMs: 2200,
					},
				],
			};
		}

		return null;
	}, [activeTab, guidedTourStage, hasMissingCurrentMonthFinding, isGuidedExcelFlow]);

	const finishGuidedExcelFlow = useCallback(() => {
		setQueryParams({
			tour: null,
			tourStage: null,
		});
		push("/macro?tour=macro-overview");
	}, [push, setQueryParams]);

	return (
		<div className="relative container max-w-full mx-auto px-4 pt-2">
			<DemoPageTour flow={obraOverviewTour} />
			{ilagMaterialsReportFlow ? (
				<ContextualWizard
					open={isIlagMaterialsWizardOpen}
					onOpenChange={handleIlagMaterialsWizardOpenChange}
					flow={ilagMaterialsReportFlow}
					finishLabel="Entendido"
				/>
			) : null}
			{guidedObraFlow ? (
				<ContextualWizard
					open
					onOpenChange={(nextOpen) => {
						if (!nextOpen) {
							setQueryParams({
								tour: null,
								tourStage: null,
							});
						}
					}}
					flow={guidedObraFlow}
					showCloseButton={true}
					onComplete={finishGuidedExcelFlow}
				/>
			) : null}
			{routeError ? (
				<m.div
					initial={{ opacity: 0, scale: 0.95 }}
					animate={{ opacity: 1, scale: 1 }}
					className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-destructive"
				>
					<p className="font-medium">{routeError}</p>
				</m.div>
			) : isLoading ? (
				<m.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					className="animate-pulse space-y-4"
				>
					<div className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-6">
						<div className="flex-1 min-w-0 space-y-4">
							<div className="rounded-lg border border-stone-200 bg-white p-4">
								<div className="h-6 w-48 rounded bg-stone-200" />
								<div className="mt-3 h-4 w-72 rounded bg-stone-100" />
								<div className="mt-2 h-4 w-64 rounded bg-stone-100" />
							</div>

							<div className="rounded-lg border border-stone-200 bg-white p-3">
								<div className="flex gap-2">
									<div className="h-8 w-24 rounded bg-stone-200" />
									<div className="h-8 w-24 rounded bg-stone-100" />
									<div className="h-8 w-24 rounded bg-stone-100" />
									<div className="h-8 w-24 rounded bg-stone-100" />
								</div>
							</div>

							<div className="rounded-lg border border-stone-200 bg-white p-4 space-y-3">
								<div className="h-4 w-40 rounded bg-stone-200" />
								<div className="h-32 rounded bg-stone-100" />
								<div className="h-4 w-56 rounded bg-stone-100" />
							</div>
						</div>

						<div className="w-full lg:w-[340px] space-y-4">
							<div className="rounded-lg border border-stone-200 bg-white p-4 space-y-2">
								<div className="h-4 w-32 rounded bg-stone-200" />
								<div className="h-8 w-full rounded bg-stone-100" />
								<div className="h-8 w-full rounded bg-stone-100" />
							</div>
							<div className="rounded-lg border border-stone-200 bg-white p-4 space-y-3">
								<div className="h-4 w-28 rounded bg-stone-200" />
								<div className="h-16 w-full rounded bg-stone-100" />
								<div className="h-16 w-full rounded bg-stone-100" />
							</div>
						</div>
					</div>
				</m.div>
			) : loadError ? (
				<m.div
					initial={{ opacity: 0, scale: 0.95 }}
					animate={{ opacity: 1, scale: 1 }}
					className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-destructive"
				>
					<p className="font-medium">{loadError}</p>
				</m.div>
			) : (
				<div className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-6">
					<div className="flex-1 min-w-0">
						<div className="mb-3 flex min-w-0 flex-col gap-3 border-b border-stone-200 pb-3 pt-2 xl:flex-row xl:items-center xl:justify-between">
							<ExcelObraName />
							<div className="flex flex-wrap items-center gap-2 xl:justify-end">
								{activeTab === "documentos" ? (
									<>
										<Button
											type="button"
											variant="secondary"
											size="sm"
											className="h-8 gap-2"
											onClick={handleOpenDocumentsRecovery}
										>
											<RotateCcw className="size-4" />
											<span className="text-base md:text-sm">Recuperar</span>
										</Button>
										<Button
											type="button"
											variant="secondary"
											size="sm"
											className="h-8 gap-2"
											onClick={handleOpenDocumentsTrashPage}
										>
											<Trash2 className="size-4" />
											<span className="text-base md:text-sm">Papelera</span>
										</Button>
									</>
								) : null}
								{canDeleteObra ? (
									<Button
										type="button"
										variant="destructive"
										size="sm"
										className="h-8 gap-2"
										onClick={() => void handleDeleteObra()}
										disabled={isDeletingObra}
									>
										<Trash2 className="size-4" />
										<span className="text-base md:text-sm">
											{isDeletingObra ? "Eliminando..." : "Borrar obra"}
										</span>
									</Button>
								) : null}
							</div>
						</div>
						<Tabs
							value={activeTab}
							onValueChange={handleTabChange}
							className="space-y-4"
						>
							{/* <p className="text-3xl font-normal">{obraData?.designacionYUbicacion ?? ""}</p> */}
							<div
								data-wizard-target="obra-page-tabs"
								className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2 "
							>
								<div className="flex flex-wrap items-center gap-2">
									<ExcelPageTabs
										tabBadges={
											derivedCertificadosNotice
												? { general: "Actualizado" }
												: undefined
										}
									/>
									{isIlagDemoTenant ? (
										<Button
											type="button"
											variant="default"
											size="sm"
											data-wizard-target="obra-page-ilag-material-report-button"
											className="h-8 max-w-full text-xs md:text-sm"
											onClick={handleStartIlagMaterialsWizard}
										>
											Guia de Presupuesto
										</Button>
									) : null}
									{isObraAtRisk && (
										<Tooltip>
											<TooltipTrigger asChild>
												<Badge className="bg-amber-100 text-amber-800 border-amber-200 rounded-md py-1.5">
													<AlertTriangle className="size-3.5 mr-1" />
													{obraDelay}% atrasada
												</Badge>
											</TooltipTrigger>
											<TooltipContent className="max-w-xs">
												Se calcula comparando el avance de tiempo con el avance físico.
												Si el tiempo transcurrido supera el avance en más de 10%, la obra se marca como atrasada.
											</TooltipContent>
										</Tooltip>
									)}
								</div>
								<div className="flex flex-wrap items-center gap-2 justify-end">
									{/* <Button
										type="button"
										variant="outline"
										size="sm"
										className="h-8 gap-2"
										onClick={() => push(`/document-generation?workId=${obraId}`)}
									>
										<FilePlus2 className="size-4" />
										<span className="text-base md:text-sm">Generar documento</span>
									</Button> */}
									{/* {isTenantAdmin && ( */}
									{/* <> */}
									{/* <Button
												type="button"
												variant="outline"
												size="sm"
												className="h-8 gap-2"
												onClick={handleOpenObrasTrashPage}
											>
												<Trash2 className="size-4" />
												<span className="text-base md:text-sm">Papelera obras</span>
											</Button> */}
									{/* <Button
												type="button"
												variant="destructive"
												size="sm"
												className="h-8 gap-2"
												onClick={() => void handleDeleteObra()}
												disabled={isDeletingObra}
											>
												<Trash2 className="size-4" />
												<span className="text-base md:text-sm">
													{isDeletingObra ? "Eliminando..." : "Borrar obra"}
												</span>
											</Button> */}
									{/* </> */}
									{/* )} */}
									{activeTab === "general" && (
										<>
											<m.div
												initial={{ opacity: 0 }}
												animate={{ opacity: 1 }}
												className="flex justify-end"
											>
												<div className="inline-flex items-center rounded-md border border-stone-200 bg-stone-50 p-1">
													<Button
														type="button"
														variant={!isGeneralTabEditMode ? "default" : "ghost"}
														size="sm"
														className="gap-2 h-8 px-3"
														aria-pressed={!isGeneralTabEditMode}
														onClick={() => setIsGeneralTabEditMode(false)}
													>
														<Eye className="size-4" />
														<span className={cn("hidden sm:inline text-base md:text-sm", !isGeneralTabEditMode ? "inline" : "hidden")}>Vista previa</span>
													</Button>
													<Button
														type="button"
														variant={isGeneralTabEditMode ? "default" : "ghost"}
														size="sm"
														className="gap-2 h-8 px-3"
														aria-pressed={isGeneralTabEditMode}
														onClick={() => setIsGeneralTabEditMode(true)}
													>
														<Pencil className="size-4" />
														<span className={cn("hidden sm:inline text-base md:text-sm", isGeneralTabEditMode ? "inline" : "hidden")}>Edición</span>
													</Button>
												</div>
											</m.div>
											<Button
												type="button"
												variant={isMemoriaOpen ? "default" : "secondary"}
												onClick={() => setIsMemoriaOpen((open) => !open)}
												className="gap-2"
												aria-label="Memoria"
											>
												<StickyNote className="size-4" />
												<span className="hidden sm:inline">Memoria</span>
											</Button>
										</>
									)}
									{/* {activeTab === "documentos" && (
										<>
											<Button
												type="button"
												variant="outline"
												size="sm"
												className="h-8 gap-2"
												onClick={handleOpenDocumentsRecovery}
											>
												<RotateCcw className="size-4" />
												<span className="text-base md:text-sm">Recuperar</span>
											</Button>
											<Button
												type="button"
												variant="secondary"
												size="sm"
												className="h-8 gap-2"
												onClick={handleOpenDocumentsTrashPage}
											>
												<Trash2 className="size-4" />
												<span className="text-base md:text-sm">Papelera</span>
											</Button>
										</>
									)} */}
								</div>
							</div>
							{/* {derivedCertificadosNotice && activeTab !== "general" ? (
								<m.div
									initial={{ opacity: 0, y: 12 }}
									animate={{ opacity: 1, y: 0 }}
									className="mb-2 flex flex-col gap-3 rounded-xl border border-[#f7b26a] bg-[#fffaf5] p-4 text-[#7a4b13] shadow-card sm:flex-row sm:items-center sm:justify-between"
								>
									<div className="space-y-1">
										<p className="text-sm font-semibold">
											Se detectaron actualizaciones en General desde Certificados Extraidos · PMC Resumen
										</p>
										<p className="text-sm">
											{derivedCertificadosNotice.updatedFieldLabels.length > 0 ? (
												<>
													Actualizamos {derivedCertificadosNotice.updatedFieldLabels.join(", ")}
													{derivedCertificadosNotice.sourceLabel
														? ` con el ultimo certificado detectado (${derivedCertificadosNotice.sourceLabel})`
														: " con el ultimo certificado detectado"}.
													Revisa General y guarda para persistirlos.
												</>
											) : (
												<>Hay certificados nuevos para revisar en General antes de confirmar los cálculos.</>
											)}
										</p>
										{derivedCertificadosNotice.warningMessage ? (
											<p className="text-sm font-medium text-[#b45309]">
												{derivedCertificadosNotice.warningMessage}
											</p>
										) : null}
									</div>
									<Button
										type="button"
										variant="outline"
										className="border-[#f7b26a] bg-white text-[#7a4b13] hover:bg-[#fff3e6]"
										onClick={() => handleTabChange("general")}
									>
										Ir a General
									</Button>
								</m.div>
							) : null} */}

							<div data-wizard-target="obra-page-content">
								{isGeneralTabActive ? (
									<ObraGeneralTab
										form={form}
										isGeneralTabEditMode={isGeneralTabEditMode}
										hasUnsavedChanges={hasUnsavedChanges}
										onSave={saveCurrentObra}
										isSaving={isSavingObra}
										isFieldDirty={isFieldDirty}
										applyObraToForm={applyObraToForm}
										initialFormValues={initialFormValues}
										getErrorMessage={getErrorMessage}
										quickActionsAllData={quickActionsAllData}
										reportsData={generalReportsData}
										isReportsLoading={isGeneralReportsInitialLoading}
										mainTableColumns={activeMainTableColumns}
										mainTableColumnValues={mainTableColumnValues}
										setCustomMainColumnValue={setCustomMainColumnValue}
										certificadosExtraidosRows={certificadosExtraidosRows}
										certificadoContableMacro={certificadoContableMacroQuery.data ?? null}
										curveImportConfig={generalTabCurveImportConfig}
										derivedCertificadosNotice={derivedCertificadosNotice}
										dataFlowSuggestions={generalTabDataFlowSuggestions}
										dataFlowSuggestionsError={generalTabDataFlowSuggestionsError}
										onDataFlowSuggestionDecision={handleDataFlowSuggestionDecision}
										isResolvingDataFlowSuggestion={isResolvingDataFlowSuggestion}
									/>
								) : null}
								{/* {activeTab === "general" && (
								<section className="rounded-lg border bg-card shadow-sm overflow-hidden">
									<div className="bg-muted/50 px-4 sm:px-6 py-4 border-b">
										<h2 className="text-base sm:text-lg font-semibold">
											Campos de tabla principal
										</h2>
										<p className="text-xs text-muted-foreground">
											Se muestran todas las columnas configuradas para esta organización.
										</p>
									</div>
									<div className="p-4 sm:p-6 space-y-3">
										{activeMainTableColumns.map((column) => {
												const rawValue = mainTableColumnValues[column.id];
												const isBooleanType =
													column.cellType === "boolean" ||
													column.cellType === "checkbox" ||
													column.cellType === "toggle";
												const isSelectType = column.cellType === "select";
												const selectOptions = isSelectType
													? sanitizeMainTableSelectOptions(column.selectOptions)
													: [];

												if (isGeneralTabEditMode && column.kind === "custom") {
													const inputType =
														column.cellType === "number" || column.cellType === "currency"
															? "number"
															: column.cellType === "date"
																? "date"
																: "text";
													const selectValue =
														rawValue === true ? "true" : rawValue === false ? "false" : "unset";
													return (
														<div
															key={column.id}
															className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-2 items-center"
														>
															<p className="text-sm text-muted-foreground">{column.label}</p>
															{isBooleanType ? (
																<Select
																	value={selectValue}
																	onValueChange={(value) => {
																		setCustomMainColumnValue(
																			column.id,
																			coerceMainColumnInputValue(value, column.cellType)
																		);
																	}}
																>
																	<SelectTrigger>
																		<SelectValue placeholder="Sin definir" />
																	</SelectTrigger>
																	<SelectContent>
																		<SelectItem value="unset">Sin definir</SelectItem>
																		<SelectItem value="true">Sí</SelectItem>
																		<SelectItem value="false">No</SelectItem>
																	</SelectContent>
																</Select>
															) : isSelectType ? (
																<div className="space-y-1.5">
																	{(() => {
																		const currentValue = String(rawValue ?? "").trim();
																		const matchedSelectOption = resolveMainTableSelectOption(
																			currentValue,
																			selectOptions
																		);
																		const selectSuggestion =
																			currentValue && !matchedSelectOption
																				? findClosestMainTableSelectOption(currentValue, selectOptions)
																				: null;
																		const unresolvedValue = "__current__";
																		const clearValue = "__clear__";
																		return (
																			<>
																				<Select
																					value={matchedSelectOption ? matchedSelectOption.value : unresolvedValue}
																					onValueChange={(value) => {
																						if (value === unresolvedValue) return;
																						if (value === clearValue) {
																							setCustomMainColumnValue(column.id, null);
																							return;
																						}
																						setCustomMainColumnValue(
																							column.id,
																							coerceMainColumnInputValue(value, column.cellType)
																						);
																					}}
																				>
																					<SelectTrigger>
																						<SelectValue placeholder="Seleccionar opcion" />
																					</SelectTrigger>
																					<SelectContent>
																						<SelectItem value={clearValue}>Sin definir</SelectItem>
																						{!matchedSelectOption ? (
																							<SelectItem value={unresolvedValue} disabled>
																								{currentValue
																									? `Actual: ${currentValue}`
																									: "Sin definir"}
																							</SelectItem>
																						) : null}
																						{selectOptions.map((option) => (
																							<SelectItem key={option.value} value={option.value}>
																								{option.label}
																							</SelectItem>
																						))}
																					</SelectContent>
																				</Select>
																				{selectSuggestion ? (
																					<p className="text-xs text-amber-700">
																						Sugerencia: {selectSuggestion.option.label}
																					</p>
																				) : null}
																			</>
																		);
																	})()}
																</div>
															) : (
																<Input
																	type={inputType}
																	value={String(rawValue ?? "")}
																	onChange={(event) => {
																		setCustomMainColumnValue(
																			column.id,
																			coerceMainColumnInputValue(
																				event.target.value,
																				column.cellType
																			)
																		);
																	}}
																/>
															)}
														</div>
													);
												}

												return (
													<div
														key={column.id}
														className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-2"
													>
														<p className="text-sm text-muted-foreground">{column.label}</p>
														<p className="text-sm">
															{formatMainColumnValue(rawValue, column.cellType, column)}
														</p>
													</div>
												);
											})}
									</div>
								</section>
							)} */}

								{isFlujoTabActive ? (
									<ObraFlujoTab
										isAddingFlujoAction={isAddingFlujoAction}
										setIsAddingFlujoAction={setIsAddingFlujoAction}
										isSavingFlujoAction={isSavingFlujoAction}
										newFlujoAction={newFlujoAction}
										setNewFlujoAction={setNewFlujoAction}
										selectedRecipientUserId={selectedRecipientUserId}
										setSelectedRecipientUserId={setSelectedRecipientUserId}
										selectedRecipientRoleId={selectedRecipientRoleId}
										setSelectedRecipientRoleId={setSelectedRecipientRoleId}
										obraUsers={obraUsers}
										obraRoles={obraRoles}
										obraUserRoles={obraUserRoles}
										saveFlujoAction={saveFlujoAction}
										toggleFlujoAction={toggleFlujoAction}
										deleteFlujoAction={deleteFlujoAction}
										updateFlujoAction={updateFlujoAction}
										flujoActions={flujoActions}
										isLoadingFlujoActions={isLoadingFlujoActions}
									/>
								) : null}

								{isInsurancePoliciesTabActive && obraId ? (
									<InsurancePoliciesTab obraId={obraId} />
								) : null}

								{/* <ObraCertificatesTab
								certificates={certificates}
								certificatesTotal={certificatesTotal}
								certificatesLoading={certificatesLoading}
								isAddingCertificate={isAddingCertificate}
								isCreatingCertificate={isCreatingCertificate}
								createCertificateError={createCertificateError}
								newCertificate={newCertificate}
								handleToggleAddCertificate={handleToggleAddCertificate}
								handleCreateCertificate={handleCreateCertificate}
								handleNewCertificateChange={handleNewCertificateChange}
							/> */}

								{isDocumentsTabActive ? (
									<ObraDocumentsTab
										obraId={obraId}
										materialOrders={materialOrders}
										refreshMaterialOrders={refreshMaterialOrders}
										recoveryRequestToken={documentsRecoveryRequestToken}
									/>
								) : null}
							</div>

						</Tabs>
					</div>
					{isMobile ? (
						<Sheet open={isMemoriaOpen} onOpenChange={setIsMemoriaOpen}>
							<SheetContent side="bottom" className="h-[70vh] p-4">
								<div className="flex flex-col gap-4">
									{memoriaHeader}
									{memoriaContent}
								</div>
							</SheetContent>
						</Sheet>
					) : (
						<AnimatePresence>
							{isMemoriaOpen && (
								<m.aside
									initial={{ x: 320, opacity: 0 }}
									animate={{ x: 0, opacity: 1 }}
									exit={{ x: 320, opacity: 0 }}
									transition={{ duration: 0.25, ease: "easeOut" }}
									className="w-full lg:w-80 shrink-0 rounded-lg border bg-card shadow-sm p-4 flex flex-col gap-4"
								>
									{memoriaContent}
								</m.aside>
							)}
						</AnimatePresence>
					)}
				</div>
			)}
		</div>
	);
}

export default function ObraDetailPage(props: ObraDetailPageClientProps) {
	return (
		<Suspense fallback={<div className="flex items-center justify-center p-8 text-sm text-muted-foreground">Cargando obra?</div>}>
			<ObraDetailPageContent {...props} />
		</Suspense>
	);
}
