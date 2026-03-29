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
import { Pencil, Eye, StickyNote, X, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { ExcelPageTabs } from "@/components/excel-page-tabs";
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
import { ObraGeneralTab } from "./tabs/general-tab";
import type { OcrFolderLink, OcrTablaColumn, TablaDataRow } from "./tabs/file-manager/types";
import { useIsMobile } from "@/hooks/use-mobile";
import {
	DEFAULT_MAIN_TABLE_COLUMN_CONFIG,
	type MainTableColumnConfig,
} from "@/components/form-table/configs/obras-detalle";
import {
	Sheet,
	SheetContent,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

const ObraFlujoTab = dynamic(
	() => import("./tabs/flujo-tab").then((mod) => mod.ObraFlujoTab),
	{
		loading: () => (
			<TabsContent value="flujo" className="space-y-6">
				<div className="p-4 text-sm text-muted-foreground">Cargando flujo...</div>
			</TabsContent>
		),
	}
);

const ObraDocumentsTab = dynamic(
	() => import("./tabs/documents-tab").then((mod) => mod.ObraDocumentsTab),
	{
		loading: () => (
			<TabsContent value="documentos" className="space-y-6">
				<div className="p-4 text-sm text-muted-foreground">Cargando documentos...</div>
			</TabsContent>
		),
	}
);

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

// Query functions for React Query caching
async function fetchObraDetail(obraId: string): Promise<Obra> {
	const response = await fetch(`/api/obras/${obraId}`);
	if (!response.ok) {
		const result = await response.json().catch(() => ({}));
		throw new Error(result.error ?? "No se pudo cargar la obra");
	}
	const data = await response.json();
	return data.obra as Obra;
}

async function fetchMemoriaNotes(obraId: string): Promise<MemoriaNote[]> {
	const res = await fetch(`/api/obras/${obraId}/memoria`);
	if (!res.ok) return [];
	const out = await res.json();
	const items = Array.isArray(out?.notes) ? out.notes : [];
	return items.map((n: any) => ({
		id: String(n.id),
		text: String(n.text ?? ""),
		createdAt: String(n.createdAt ?? n.created_at ?? ""),
		userId: String(n.userId ?? n.user_id ?? ""),
		userName: typeof n.userName === "string" ? n.userName : n.user_name ?? null,
	}));
}

// Normalize string for search (remove diacritics, lowercase) - used once at load time
const normalizeForSearch = (v: string): string =>
	v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

async function fetchMaterialOrders(obraId: string): Promise<MaterialOrder[]> {
	const res = await fetch(`/api/obras/${obraId}/materials`);
	if (!res.ok) return [];
	const data = await res.json();
	const orders = (data?.orders || []) as Array<any>;
	// Pre-normalize searchable fields at load time to avoid normalize() on every keystroke
	return orders.map((o: any) => {
		const nroOrden = String(o.nroOrden || o.id);
		const solicitante = String(o.solicitante || "");
		const gestor = String(o.gestor || "");
		const proveedor = String(o.proveedor || "");
		return {
			id: String(o.id),
			nroOrden,
			solicitante,
			gestor,
			proveedor,
			docPath: o.docPath,
			docBucket: o.docBucket,
			// Pre-normalized for efficient filtering
			_nroOrdenNorm: normalizeForSearch(nroOrden),
			_solicitanteNorm: normalizeForSearch(solicitante),
			_gestorNorm: normalizeForSearch(gestor),
			_proveedorNorm: normalizeForSearch(proveedor),
			items: (o.items || []).map((it: any, idx: number) => {
				const unidad = String(it.unidad || "");
				const material = String(it.material || "");
				return {
					id: `${o.id}-i-${idx}`,
					cantidad: Number(it.cantidad || 0),
					unidad,
					material,
					precioUnitario: Number(it.precioUnitario || 0),
					// Pre-normalized for efficient filtering
					_unidadNorm: normalizeForSearch(unidad),
					_materialNorm: normalizeForSearch(material),
				};
			}),
		};
	});
}

async function fetchCertificates(obraId: string): Promise<{ certificates: Certificate[]; total: number }> {
	const response = await fetch(`/api/obras/${obraId}/certificates`);
	if (!response.ok) {
		throw new Error("Failed to load certificates");
	}
	const data = await response.json();
	return { certificates: data.certificates || [], total: data.total || 0 };
}

async function fetchOcrLinks(obraId: string): Promise<OcrFolderLink[]> {
	const response = await fetch(`/api/obras/${obraId}/tablas/ocr-links?limit=500`);
	if (!response.ok) {
		throw new Error("Failed to load OCR links");
	}
	const data = await response.json().catch(() => ({}));
	return Array.isArray(data?.links) ? (data.links as OcrFolderLink[]) : [];
}

type MacroTableListItem = {
	id: string;
	name: string;
};

type MacroTableColumnItem = {
	id: string;
	label: string;
	sourceFieldKey?: string | null;
};

type MacroTableRowItem = {
	id: string;
	_obraId?: unknown;
	[key: string]: unknown;
};

function normalizeMacroTableName(value: string): string {
	return value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

function isCertificadoContableMacroTable(name: string): boolean {
	const normalized = normalizeMacroTableName(name);
	return (
		normalized === "certificado contable" ||
		normalized === "certificados contable" ||
		(normalized.includes("certificado") && normalized.includes("contable"))
	);
}

async function fetchMacroTablesList(): Promise<MacroTableListItem[]> {
	const response = await fetch("/api/macro-tables");
	if (!response.ok) {
		throw new Error("Failed to load macro tables");
	}
	const data = await response.json();
	return Array.isArray(data?.macroTables) ? (data.macroTables as MacroTableListItem[]) : [];
}

async function fetchAllMacroTableRows(macroTableId: string, obraId?: string): Promise<{
	columns: MacroTableColumnItem[];
	rows: MacroTableRowItem[];
}> {
	const rows: MacroTableRowItem[] = [];
	let columns: MacroTableColumnItem[] = [];
	let page = 1;
	let totalPages = 1;

	do {
		const params = new URLSearchParams({
			page: String(page),
			limit: "200",
		});
		if (obraId) {
			params.set("obraId", obraId);
		}
		const response = await fetch(
			`/api/macro-tables/${encodeURIComponent(macroTableId)}/rows?${params.toString()}`
		);
		if (!response.ok) {
			throw new Error("Failed to load macro table rows");
		}
		const data = await response.json();
		if (page === 1 && Array.isArray(data?.columns)) {
			columns = data.columns as MacroTableColumnItem[];
		}
		if (Array.isArray(data?.rows)) {
			rows.push(...(data.rows as MacroTableRowItem[]));
		}
		totalPages = Math.max(1, Number(data?.pagination?.totalPages ?? 1));
		page += 1;
	} while (page <= totalPages);

	return { columns, rows };
}

async function fetchObraRecipients(obraId: string): Promise<{ roles: ObraRole[]; users: ObraUser[]; userRoles: ObraUserRole[] }> {
	const res = await fetch(`/api/obra-recipients?obraId=${obraId}`);
	if (!res.ok) return { roles: [], users: [], userRoles: [] };
	const data = await res.json();
	return {
		roles: data.roles ?? [],
		users: data.users ?? [],
		userRoles: data.userRoles ?? [],
	};
}

async function fetchFlujoActions(obraId: string): Promise<FlujoAction[]> {
	const res = await fetch(`/api/flujo-actions?obraId=${obraId}`);
	if (!res.ok) throw new Error("Failed to load flujo actions");
	const data = await res.json();
	return data.actions || [];
}

async function fetchPendientes(obraId: string): Promise<PendingDoc[]> {
	const res = await fetch(`/api/obras/${obraId}/pendientes`);
	if (!res.ok) return [];
	const data = await res.json();
	return (data?.pendientes ?? []).map((p: any) => ({
		id: p.id as string,
		name: String(p.name ?? ""),
		poliza: String(p.poliza ?? ""),
		dueMode: (p.dueMode ?? "fixed") as "fixed" | "after_completion",
		dueDate: String(p.dueDate ?? ""),
		offsetDays: Number(p.offsetDays ?? 0),
		done: Boolean(p.done ?? false),
	}));
}

type MemoriaNote = {
	id: string;
	text: string;
	createdAt: string;
	userId: string;
	userName: string | null;
};

type DerivedCertificadosNotice = {
	sourceLabel: string | null;
	updatedFieldKeys: Array<"certificadoALaFecha" | "saldoACertificar" | "porcentaje">;
	updatedFieldLabels: string[];
	blockedFieldKeys: Array<"saldoACertificar" | "porcentaje">;
	blockedFieldLabels: string[];
	warningMessage: string | null;
};

type DerivedCertificadosField =
	| "certificadoALaFecha"
	| "saldoACertificar"
	| "porcentaje";

type PendingDoc = {
	id: string;
	name: string;
	poliza: string;
	dueMode: "fixed" | "after_completion";
	dueDate: string;
	offsetDays: number;
	done: boolean
};

type ReportFinding = {
	id: string;
	rule_key: string;
	severity: "info" | "warn" | "critical";
	title: string;
	message: string | null;
	created_at: string;
};

type TablaRowRecord = {
	id: string;
	data: Record<string, unknown>;
	created_at?: string;
};

type GeneralReportCurvePoint = {
	label: string;
	planPct: number | null;
	realPct: number | null;
	sortOrder: number;
	periodKey?: string | null;
};

type GeneralTabReportsData = {
	findings: ReportFinding[];
	curve: {
		points: GeneralReportCurvePoint[];
		planTableName: string;
		resumenTableName: string;
	} | null;
};

type CurveRuleConfig = {
	mappings?: {
		curve?: {
			planTableId?: string;
			resumenTableId?: string;
			measurementTableId?: string;
			plan?: {
				startPeriod?: string;
			};
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
			`/api/obras/${obraId}/tablas/${tablaId}/rows?page=${page}&limit=200`
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

function getCertificadoRowSortValue(row: TablaDataRow, fallbackIndex: number): number {
	const rowData = (row.data as Record<string, unknown> | null | undefined) ?? null;
	const fecha =
		getRowFieldValueByCandidates(
			rowData,
			["fecha_certificacion", "fecha", "issued_at", "date"],
			[["fecha", "cert"], ["fecha"]],
		);
	const fechaTs = parseDateTimestamp(fecha);
	if (fechaTs != null) return fechaTs;

	const periodo = getRowFieldValueByCandidates(
		rowData,
		["periodo", "periodo_key", "period", "mes"],
		[["periodo"], ["period"], ["mes"]],
	);
	if (periodo != null) {
		const parsed = parseMonthOrder(periodo, fallbackIndex);
		if (parsed.order >= 1000) {
			const year = Math.floor(parsed.order / 12);
			const month = parsed.order % 12;
			return Date.UTC(year, month, 1);
		}
		return parsed.order;
	}

	return -fallbackIndex;
}

function sortCertificadosExtraidosRows(rows: TablaDataRow[]): TablaDataRow[] {
	return rows
		.map((row, index) => ({ row, index }))
		.sort((a, b) => {
			const sortA = getCertificadoRowSortValue(a.row, a.index);
			const sortB = getCertificadoRowSortValue(b.row, b.index);
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

	const dmy = norm.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
	if (dmy) {
		const month = Number.parseInt(dmy[2], 10) - 1;
		const yearRaw = Number.parseInt(dmy[3], 10);
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

function getLatestCertificadoMontoAcumulado(rows: TablaDataRow[]): number | null {
	const sorted = rows
		.map((row, index) => ({ row, index }))
		.sort((a, b) => getCertificadoRowSortValue(b.row, b.index) - getCertificadoRowSortValue(a.row, a.index))
		.map((entry) => entry.row);

	for (const row of sorted) {
		const rowData = (row.data as Record<string, unknown> | null | undefined) ?? null;
		const montoAcumulado = parseCurrencyLike(
			getRowFieldValueByCandidates(
				rowData,
				["monto_acumulado", "monto_acumulado_total", "acumulado", "total_acumulado"],
				[["monto", "acumul"], ["acumulado"]],
			),
		);
		if (montoAcumulado != null) {
			return roundDerivedValue(montoAcumulado);
		}
	}

	return null;
}

function getLatestCertificadoSourceLabel(rows: TablaDataRow[]): string | null {
	const sorted = rows
		.map((row, index) => ({ row, index }))
		.sort((a, b) => getCertificadoRowSortValue(b.row, b.index) - getCertificadoRowSortValue(a.row, a.index))
		.map((entry) => entry.row);

	for (const [index, row] of sorted.entries()) {
		const rowData = (row.data as Record<string, unknown> | null | undefined) ?? null;
		const montoAcumulado = parseCurrencyLike(
			getRowFieldValueByCandidates(
				rowData,
				["monto_acumulado", "monto_acumulado_total", "acumulado", "total_acumulado"],
				[["monto", "acumul"], ["acumulado"]],
			),
		);
		if (montoAcumulado == null) continue;

		const fecha = getRowFieldValueByCandidates(
			rowData,
			["fecha_certificacion", "fecha", "issued_at", "date"],
			[["fecha", "cert"], ["fecha"]],
		);
		if (typeof fecha === "string" && fecha.trim()) return fecha.trim();

		const periodo = getRowFieldValueByCandidates(
			rowData,
			["periodo", "periodo_key", "period", "mes"],
			[["periodo"], ["period"], ["mes"]],
		);
		if (periodo != null) return parseMonthOrder(periodo, index).label;
	}

	return null;
}

function isMeaningfulCertificadoResumenRow(row: TablaDataRow): boolean {
	const rowData = (row.data as Record<string, unknown> | null | undefined) ?? null;
	const montoAcumulado = parseCurrencyLike(
		getRowFieldValueByCandidates(
			rowData,
			["monto_acumulado", "monto_acumulado_total", "acumulado", "total_acumulado"],
			[["monto", "acumul"], ["acumulado"]],
		),
	);
	const montoCertificado = parseCurrencyLike(
		getRowFieldValueByCandidates(
			rowData,
			["monto_certificado", "monto", "importe", "total"],
			[["monto", "cert"], ["importe"]],
		),
	);
	const periodoOFecha =
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

	return Boolean(periodoOFecha) && (montoAcumulado != null || montoCertificado != null);
}

function computeDerivedCertificadosMetrics(
	rows: TablaDataRow[],
	contratoMasAmpliaciones: unknown,
	certificadoOverride?: unknown,
): DerivedCertificadosMetrics | null {
	const latestCertificado = certificadoOverride != null
		? parseCurrencyLike(certificadoOverride)
		: getLatestCertificadoMontoAcumulado(rows);
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

function getCurveMonthNumber(rawValue: unknown): number | null {
	const mesN = normalizeText(String(rawValue ?? "")).match(/mes\s*(\d{1,3})/);
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
		for (const [key, value] of normalizedEntries) {
			const tokenSet = key.split("_").filter(Boolean);
			for (const group of tokenGroups) {
				if (group.every((token) => tokenSet.some((entry) => entry.includes(token)))) {
					return value;
				}
			}
		}
	}

	return null;
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

	resumenRows.forEach((row, index) => {
		const rowData = (row.data as Record<string, unknown> | null | undefined) ?? null;
		// Prefer explicit certification date to avoid wrong ordering from long period text.
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
		if (!periodSource || avance == null) return;
		const parsed = parseMonthOrder(periodSource, index);
		const periodKey = parsed.order >= 1000
			? `${Math.floor(parsed.order / 12)}-${String((parsed.order % 12) + 1).padStart(2, "0")}`
			: null;
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

	const sortedPoints = [...points.values()]
		.sort((a, b) => a.sortOrder - b.sortOrder)
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

	for (let order = minOrder; order <= maxOrder; order += 1) {
		const existing = pointsByOrder.get(order);
		const periodKey = curveSortOrderToPeriodKey(order);
		if (!periodKey) continue;

		continuousPoints.push(
			existing ?? {
				label: periodLabel(periodKey),
				planPct: null,
				realPct: null,
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

// Formula compiler cache - compiles formula once, reuses the evaluator function
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

	// Compile the evaluator function once
	try {
		const argNames = fieldNames.map((_, i) => `__v${i}__`);
		const fnBody = `"use strict"; return (${expressionTemplate});`;
		const evaluatorFn = new Function(...argNames, fnBody) as (...args: number[]) => number;

		const compiled = {
			fieldNames,
			evaluate: (values: number[]): number | null => {
				try {
					const result = evaluatorFn(...values);
					return Number.isFinite(result) ? Number(result) : null;
				} catch {
					return null;
				}
			}
		};

		formulaCache.set(trimmed, compiled);
		return compiled;
	} catch {
		return null;
	}
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

function ObraDetailPageContent() {
	const params = useParams();
	const queryClient = useQueryClient();
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const isMobile = useIsMobile();
	const obraId = useMemo(() => {
		const raw = (params as Record<string, string | string[] | undefined>)?.obraId;
		if (Array.isArray(raw)) return raw[0];
		return raw;
	}, [params]);
	const isValidObraId = Boolean(obraId && obraId !== "undefined");
	const initialTab = searchParams?.get("tab") || "general";
	const [activeTab, setActiveTab] = useState(initialTab);
	const isGeneralTabActive = activeTab === "general";
	const isDocumentsTabActive = activeTab === "documentos";
	const isFlujoTabActive = activeTab === "flujo";
	const isCertificatesTabActive = activeTab === "certificates";

	// React Query hooks for cached data fetching
	// Core obra data - always fetch
	const obraQuery = useQuery({
		queryKey: ['obra', obraId],
		queryFn: () => fetchObraDetail(obraId!),
		enabled: !!obraId && obraId !== "undefined",
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
	});

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
		queryFn: () => fetchOcrLinks(obraId!),
		enabled: isValidObraId && isGeneralTabActive,
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
		queryFn: () => fetchPendientes(obraId!),
		enabled: isValidObraId,
		staleTime: 5 * 60 * 1000,
	});

	const tablasQuery = useQuery({
		queryKey: ["obra-tablas", obraId],
		enabled: isValidObraId,
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
				(Array.isArray(link.rows) ? link.rows : []).some(isMeaningfulCertificadoResumenRow)
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
	const currentPeriodKey = useMemo(() => {
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
	}, []);

	const generalReportsQuery = useQuery({
		queryKey: [
			"obra",
			obraId,
			"general-reports",
			currentPeriodKey,
			certificadoTableRefs.curvaPlanId ?? "none",
			certificadoTableRefs.pmcResumenId ?? "none",
		],
		enabled: isValidObraId && isGeneralTabActive,
		queryFn: async () => {
			const rulesConfig = await fetchRulesConfig(obraId!);
			const rulesCurvePlanTableId = rulesConfig?.mappings?.curve?.planTableId ?? null;
			const rulesResumenTableId =
				rulesConfig?.mappings?.curve?.resumenTableId ??
				rulesConfig?.mappings?.curve?.measurementTableId ??
				null;
			const curvaTableId = rulesCurvePlanTableId ?? certificadoTableRefs.curvaPlanId;
			const resumenTableId = rulesResumenTableId ?? certificadoTableRefs.pmcResumenId;
			const curvaTableName =
				(curvaTableId ? tablasById.get(curvaTableId)?.name : null) ??
				certificadoTableRefs.curvaPlanName;
			const resumenTableName =
				(resumenTableId ? tablasById.get(resumenTableId)?.name : null) ??
				certificadoTableRefs.pmcResumenName;

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
				curveStartPeriod: rulesConfig?.mappings?.curve?.plan?.startPeriod ?? null,
			});
			return {
				findings,
				curve:
					points.length > 0
						? {
							points,
							planTableName: curvaTableName,
							resumenTableName,
						}
						: null,
			} satisfies GeneralTabReportsData;
		},
		staleTime: 60 * 1000,
	});

	const defaultsQuery = useQuery({
		queryKey: ["obra-defaults", obraId],
		enabled: isValidObraId && isGeneralTabActive,
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

	// Derived state from queries
	const isLoading = obraQuery.isLoading;
	const loadError = obraQuery.error?.message ?? null;
	const routeError = !obraId || obraId === "undefined" ? "Obra no encontrada" : null;
	const certificates = certificatesQuery.data?.certificates ?? [];
	const memoriaNotes = memoriaQuery.data ?? [];
	const materialOrders = materialsQuery.data ?? [];
	const obraRoles = recipientsQuery.data?.roles ?? [];
	const obraUsers = recipientsQuery.data?.users ?? [];
	const obraUserRoles = recipientsQuery.data?.userRoles ?? [];
	const flujoActions = flujoActionsQuery.data ?? [];
	const isLoadingFlujoActions = flujoActionsQuery.isLoading;
	const certificadosExtraidosRows = useMemo<TablaDataRow[]>(() => {
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
				.filter(isMeaningfulCertificadoResumenRow)
		);
	}, [ocrLinksQuery.data]);
	const obraData = obraQuery.data;
	const latestExtractedCertificadoALaFecha = useMemo(
		() => getLatestCertificadoMontoAcumulado(certificadosExtraidosRows),
		[certificadosExtraidosRows]
	);
	const latestExtractedCertificadoSourceLabel = useMemo(
		() => getLatestCertificadoSourceLabel(certificadosExtraidosRows),
		[certificadosExtraidosRows]
	);
	const generalReportsData = generalReportsQuery.data ?? { findings: [], curve: null };
	const handleCurveDataImported = useCallback(async () => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: ["obra", obraId, "general-reports"] }),
			queryClient.invalidateQueries({ queryKey: ["obra", obraId, "ocr-links"] }),
			queryClient.invalidateQueries({ queryKey: ["obra-certificado-contable-macro", obraId] }),
		]);
	}, [obraId, queryClient]);
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
	const [initialFormValues, setInitialFormValues] = useState<Obra>(emptyObra);
	const [derivedCertificadosNotice, setDerivedCertificadosNotice] =
		useState<DerivedCertificadosNotice | null>(null);
	const [pendingDerivedFieldValues, setPendingDerivedFieldValues] = useState<
		Partial<Record<DerivedCertificadosField, number>>
	>({});
	const [mainTableColumnsConfig, setMainTableColumnsConfig] = useState<
		MainTableColumnConfig[] | null
	>(null);

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

	useEffect(() => {
		let cancelled = false;
		const loadMainTableConfig = async () => {
			try {
				const response = await fetch("/api/main-table-config", { cache: "no-store" });
				if (!response.ok) return;
				const payload = (await response.json()) as { columns?: MainTableColumnConfig[] };
				if (!cancelled) {
					setMainTableColumnsConfig(
						Array.isArray(payload.columns) ? payload.columns : []
					);
				}
			} catch {
				if (!cancelled) setMainTableColumnsConfig(null);
			}
		};
		void loadMainTableConfig();
		return () => {
			cancelled = true;
		};
	}, []);

	// Sync URL when tab changes (low priority, non-blocking)
	const setQueryParams = useCallback((patch: Record<string, string | null | undefined>) => {
		const params = new URLSearchParams(searchParams?.toString() || "");
		for (const [key, value] of Object.entries(patch)) {
			if (value == null || value === "") params.delete(key); else params.set(key, value);
		}
		const qs = params.toString();
		// Use startTransition to mark URL update as low-priority
		startTransition(() => {
			router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
		});
	}, [router, pathname, searchParams]);

	// Handle tab change: update local state immediately, sync URL in background
	const handleTabChange = useCallback((value: string) => {
		setActiveTab(value); // Immediate state update
		setQueryParams({ tab: value }); // Background URL sync
	}, [setQueryParams]);

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
				const hasMateriales = Boolean((rootList || []).find((it: any) => it.name === 'materiales' && !it.metadata));
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
					// @ts-ignore: dynamic import without types is fine for client rasterization
					const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf');
					const array = new Uint8Array(await file.arrayBuffer());
					const loadingTask = pdfjs.getDocument({ data: array, disableWorker: true });
					const pdf = await loadingTask.promise;
					const page = await pdf.getPage(1);
					const viewport = page.getViewport({ scale: 2 });
					const canvasEl = document.createElement('canvas');
					canvasEl.width = Math.ceil(viewport.width);
					canvasEl.height = Math.ceil(viewport.height);
					const ctx = canvasEl.getContext('2d');
					if (!ctx) throw new Error('No canvas context');
					await page.render({ canvasContext: ctx as any, viewport }).promise;
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
				const out = await res.json().catch(() => ({} as any));
				throw new Error(out?.error || "No se pudo importar");
			}
			const out = await res.json();
			// Build preview order form
			const extractedItems = (out.items || []).map((it: any) => ({
				cantidad: String(it.cantidad ?? ''),
				unidad: String(it.unidad ?? ''),
				material: String(it.material ?? ''),
				precioUnitario: String(it.precioUnitario ?? ''),
			}));
			const meta = out.meta || {};
			setImportPreviewOrder({
				nroOrden: meta.nroOrden ?? '',
				solicitante: meta.solicitante ?? '',
				gestor: meta.gestor ?? '',
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
		solicitante: string;
		gestor: string;
		proveedor: string;
		items: NewOrderItemForm[];
	};

	const emptyNewOrderForm: NewOrderForm = {
		nroOrden: "",
		solicitante: "",
		gestor: "",
		proveedor: "",
		items: [
			{ cantidad: "", unidad: "", material: "", precioUnitario: "" },
		],
	};

	const [newOrder, setNewOrder] = useState<NewOrderForm>(() => ({ ...emptyNewOrderForm }));

	const updateNewOrderMeta = useCallback(
		(field: "nroOrden" | "solicitante" | "gestor" | "proveedor", value: string) => {
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
		const solicitante = newOrder.solicitante.trim();
		const gestor = newOrder.gestor.trim();
		const proveedor = newOrder.proveedor.trim();

		const order: MaterialOrder = {
			id: orderId,
			nroOrden,
			solicitante,
			gestor,
			proveedor,
			items: normalizedItems,
			// Pre-normalize for filtering
			_nroOrdenNorm: normalizeForSearch(nroOrden),
			_solicitanteNorm: normalizeForSearch(solicitante),
			_gestorNorm: normalizeForSearch(gestor),
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
				(order._solicitanteNorm ?? "").includes(q) ||
				(order._gestorNorm ?? "").includes(q) ||
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

				setInitialFormValues({
					...initialFormValues,
					...value,
					id: obraId,
				});
				setDerivedCertificadosNotice(null);
				setPendingDerivedFieldValues({});
				toast.success("Obra actualizada correctamente");

				queryClient.invalidateQueries({ queryKey: ['obra', obraId] });
				queryClient.invalidateQueries({ queryKey: ['obras-dashboard'] });
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

	const activeMainTableColumns = useMemo(
		() =>
			(mainTableColumnsConfig ?? DEFAULT_MAIN_TABLE_COLUMN_CONFIG).filter(
				(column) => column.enabled !== false
			),
		[mainTableColumnsConfig]
	);

	const mainTableColumnValues = (() => {
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
	})();

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
			const first = errors[0] as any;
			if (typeof first === "string") return first;
			if (first && typeof first === "object" && "message" in first) return String(first.message);
			return JSON.stringify(first);
		}
		if (typeof errors === "object" && errors !== null) {
			const anyErr: any = errors;
			if ("message" in anyErr) return String(anyErr.message);
			return JSON.stringify(anyErr);
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
			setPendingDerivedFieldValues({});
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

	useEffect(() => {
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
			savedCertificadoIsManual ? obraData.certificadoALaFecha : undefined,
		);
		const currentMetrics = computeDerivedCertificadosMetrics(
			certificadosExtraidosRows,
			form.state.values.contratoMasAmpliaciones,
			savedCertificadoIsManual || currentCertificadoIsDirty
				? form.state.values.certificadoALaFecha
				: undefined,
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

		const fieldLabels: Record<DerivedCertificadosField, string> = {
			certificadoALaFecha: "Certificado a la fecha",
			saldoACertificar: "Saldo a certificar",
			porcentaje: "Porcentaje de avance",
		};
		const blockedFieldKeys = currentMetrics.blockedFieldKeys;
		const hasUpdates = Object.keys(updates).length > 0;
		const hasBlockedFields = blockedFieldKeys.length > 0;

		blockedFieldKeys.forEach((field) => {
			const pendingValue = nextPendingDerivedFieldValues[field];
			if (pendingValue == null) return;
			if (approximatelyEqual(form.state.values[field], pendingValue)) {
				form.setFieldValue(field, initialFormValues[field] as any);
			}
			delete nextPendingDerivedFieldValues[field];
			pendingChanged = true;
		});

		if (!hasUpdates && !hasBlockedFields) {
			if (pendingChanged) {
				setPendingDerivedFieldValues(nextPendingDerivedFieldValues);
			}
			setDerivedCertificadosNotice(null);
			return;
		}

		(Object.entries(updates) as Array<[DerivedCertificadosField, number]>).forEach(
			([field, nextValue]) => {
				form.setFieldValue(field, nextValue as any);
				nextPendingDerivedFieldValues[field] = nextValue;
				pendingChanged = true;
			},
		);
		if (pendingChanged) {
			setPendingDerivedFieldValues(nextPendingDerivedFieldValues);
		}
		setDerivedCertificadosNotice({
			sourceLabel: latestExtractedCertificadoSourceLabel,
			updatedFieldKeys: Object.keys(updates) as DerivedCertificadosField[],
			updatedFieldLabels: (Object.keys(updates) as DerivedCertificadosField[]).map(
				(field) => fieldLabels[field],
			),
			blockedFieldKeys,
			blockedFieldLabels: blockedFieldKeys.map((field) => blockedFieldLabels[field]),
			warningMessage: currentMetrics.warningMessage,
		});
	}, [
		certificadosExtraidosRows,
		form,
		form.state.values.certificadoALaFecha,
		form.state.values.contratoMasAmpliaciones,
		form.state.values.porcentaje,
		form.state.values.saldoACertificar,
		initialFormValues.certificadoALaFecha,
		initialFormValues.porcentaje,
		initialFormValues.saldoACertificar,
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
				<StickyNote className="h-4 w-4 text-primary" />
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
									const out = await res.json().catch(() => ({} as any));
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
									<div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary capitalize">
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
									{new Date(note.createdAt).toLocaleDateString("es-AR")}
								</span>
							</div>
							<p className="text-foreground leading-relaxed">{note.text}</p>
						</div>
					))
				)}
			</div>
		</>
	);

	return (
		<div className="container max-w-full mx-auto px-4 pt-2">
			{routeError ? (
				<motion.div
					initial={{ opacity: 0, scale: 0.95 }}
					animate={{ opacity: 1, scale: 1 }}
					className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-destructive"
				>
					<p className="font-medium">{routeError}</p>
				</motion.div>
			) : isLoading ? (
				<motion.div
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
				</motion.div>
			) : loadError ? (
				<motion.div
					initial={{ opacity: 0, scale: 0.95 }}
					animate={{ opacity: 1, scale: 1 }}
					className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-destructive"
				>
					<p className="font-medium">{loadError}</p>
				</motion.div>
			) : (
				<div className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-6">
					<div className="flex-1 min-w-0">
						<Tabs
							value={activeTab}
							onValueChange={handleTabChange}
							className="space-y-4"
						>
							{/* <p className="text-3xl font-normal">{obraData?.designacionYUbicacion ?? ""}</p> */}
							<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2 bg-white shadow-card rounded-xl p-3">
								<div className="flex flex-wrap items-center gap-2">
									<ExcelPageTabs
										tabBadges={
											derivedCertificadosNotice
												? { general: "Actualizado" }
												: undefined
										}
									/>
									{isObraAtRisk && (
										<Tooltip>
											<TooltipTrigger asChild>
												<Badge className="bg-amber-100 text-amber-800 border-amber-200 rounded-md py-1.5">
													<AlertTriangle className="h-3.5 w-3.5 mr-1" />
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
								{activeTab === "general" && (
									<div className="flex flex-wrap items-center gap-2 justify-end">
										<motion.div
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
													<Eye className="h-4 w-4" />
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
													<Pencil className="h-4 w-4" />
													<span className={cn("hidden sm:inline text-base md:text-sm", isGeneralTabEditMode ? "inline" : "hidden")}>Edición</span>
												</Button>
											</div>
										</motion.div>
										<Button
											type="button"
											variant={isMemoriaOpen ? "default" : "secondary"}
											onClick={() => setIsMemoriaOpen((open) => !open)}
											className="gap-2"
											aria-label="Memoria"
										>
											<StickyNote className="h-4 w-4" />
											<span className="hidden sm:inline">Memoria</span>
										</Button>
									</div>
								)}
							</div>
							{derivedCertificadosNotice && activeTab !== "general" ? (
								<motion.div
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
								</motion.div>
							) : null}

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
									mainTableColumns={activeMainTableColumns}
									mainTableColumnValues={mainTableColumnValues}
									setCustomMainColumnValue={setCustomMainColumnValue}
									certificadosExtraidosRows={certificadosExtraidosRows}
									certificadoContableMacro={certificadoContableMacroQuery.data ?? null}
									curveImportConfig={
										obraId
											? {
												obraId,
												curvaPlanTableId: certificadoTableRefs.curvaPlanId,
												curvaPlanTableName: certificadoTableRefs.curvaPlanName,
												pmcResumenTableId: certificadoTableRefs.pmcResumenId,
												pmcResumenTableName: certificadoTableRefs.pmcResumenName,
												onImported: handleCurveDataImported,
											}
											: undefined
									}
									derivedCertificadosNotice={derivedCertificadosNotice}
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
															{formatMainColumnValue(rawValue, column.cellType)}
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
								/>
							) : null}

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
								<motion.aside
									initial={{ x: 320, opacity: 0 }}
									animate={{ x: 0, opacity: 1 }}
									exit={{ x: 320, opacity: 0 }}
									transition={{ duration: 0.25, ease: "easeOut" }}
									className="w-full lg:w-80 shrink-0 rounded-lg border bg-card shadow-sm p-4 flex flex-col gap-4"
								>
									{memoriaContent}
								</motion.aside>
							)}
						</AnimatePresence>
					)}
				</div>
			)}
		</div>
	);
}

export default function ObraDetailPage() {
	return (
		<Suspense fallback={<div className="flex items-center justify-center p-8 text-sm text-muted-foreground">Cargando obra...</div>}>
			<ObraDetailPageContent />
		</Suspense>
	);
}
