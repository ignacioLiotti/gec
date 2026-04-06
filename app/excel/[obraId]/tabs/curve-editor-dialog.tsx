"use client";

import { useCallback, useMemo, useState } from "react";
import { ArrowLeft, FilePlus2, LineChart as LineChartIcon, Loader2, PencilLine } from "lucide-react";

import { AdvanceCurveChart, type AdvanceCurvePoint } from "@/components/advance-curve-chart";
import {
	FormTable,
	FormTableContent,
	useFormTable,
} from "@/components/form-table/form-table";
import type { ColumnDef, FormTableConfig, FormTableRow } from "@/components/form-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type CurveEditorMode = "certificado" | "plan";

type CurveEditorDialogProps = {
	obraId: string;
	curvaPlanTableId: string | null;
	curvaPlanTableName: string;
	pmcResumenTableId: string | null;
	pmcResumenTableName: string;
	onSaved?: () => Promise<void> | void;
};

type TablaColumnDataType = "text" | "number" | "currency" | "date" | "boolean";

type TablaColumnDefinition = {
	id: string;
	fieldKey: string;
	label: string;
	dataType: TablaColumnDataType;
	required: boolean;
};

type TablaDefinition = {
	id: string;
	name: string;
	columns: TablaColumnDefinition[];
};

type TablaApiRow = {
	id: string;
	data: Record<string, unknown>;
	source?: string | null;
};

type CurveEditorRow = FormTableRow & {
	source?: string;
	[key: string]: unknown;
};

type CurveEditorDataBundle = {
	tablasById: Record<string, TablaDefinition>;
	planRows: CurveEditorRow[];
	resumenRows: CurveEditorRow[];
	curveStartPeriod: string | null;
};

type CurveFieldMatch = {
	xField: string | null;
	yField: string | null;
	xLabel: string;
	yLabel: string;
};

type CurveEditorWorkspaceProps = {
	editedSeries: "plan" | "real";
	basePlanRows: CurveEditorRow[];
	baseResumenRows: CurveEditorRow[];
	curveStartPeriod: string | null;
	fieldMatch: CurveFieldMatch;
	tableName: string;
	comparedAgainstName: string;
};

type CurveRuleConfig = {
	mappings?: {
		curve?: {
			plan?: {
				startPeriod?: string | null;
			};
		};
	};
};

const DEFAULT_TABLE_PAGE_SIZE = 250;

const MODE_META: Record<
	CurveEditorMode,
	{
		title: string;
		description: string;
		icon: typeof FilePlus2;
		toneClassName: string;
		xCandidates: string[];
		xTokenGroups: string[][];
		yCandidates: string[];
		yTokenGroups: string[][];
	}
> = {
	certificado: {
		title: "Agregar certificado",
		description:
			"Edita la tabla PMC Resumen para cargar un certificado nuevo o corregir meses ya certificados.",
		icon: FilePlus2,
		toneClassName: "border-[#ffd7bf] bg-[#fff8f2] text-[#a84e16]",
		xCandidates: ["fecha_certificacion", "periodo", "periodo_key", "period", "mes", "fecha"],
		xTokenGroups: [["fecha", "cert"], ["periodo"], ["mes"]],
		yCandidates: [
			"avance_fisico_acumulado_pct",
			"avance_fisico_acum_pct",
			"avance_fisico_acumulado",
			"avance_acumulado_pct",
			"avance_acum_pct",
		],
		yTokenGroups: [["avance", "fisico", "acum"], ["avance", "acum"]],
	},
	plan: {
		title: "Editar curva plan",
		description:
			"Ajusta la curva de avance plan y agrega filas para recalcular la proyección completa.",
		icon: PencilLine,
		toneClassName: "border-sky-200 bg-sky-50 text-sky-700",
		xCandidates: ["periodo", "periodo_key", "period", "mes"],
		xTokenGroups: [["periodo"], ["period"], ["mes"]],
		yCandidates: ["avance_acumulado_pct", "avance_acum_pct", "avance_acumulado", "avance_pct"],
		yTokenGroups: [["avance", "acum"], ["acumulado"]],
	},
};

function normalizeText(value: string): string {
	return value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.trim();
}

function normalizeFieldKey(value: string): string {
	return normalizeText(value)
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");
}

function periodLabel(periodKey: string): string {
	const match = periodKey.match(/^(\d{4})-(\d{2})$/);
	if (!match) return periodKey;
	const year = Number.parseInt(match[1], 10);
	const month = Number.parseInt(match[2], 10) - 1;
	const date = new Date(Date.UTC(year, month, 1));
	return date.toLocaleDateString("es-AR", {
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	});
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

function detectCurveMonthIndexBase(curvaRows: TablaApiRow[]): 0 | 1 {
	for (const row of curvaRows) {
		const periodo = getRowFieldValueByCandidates(
			row.data,
			["periodo", "periodo_key", "period", "mes"],
			[["periodo"], ["period"], ["mes"]],
		);
		if (getCurveMonthNumber(periodo) === 0) return 0;
	}
	return 1;
}

function curveSortOrderToPeriodKey(sortOrder: number): string | null {
	if (!Number.isInteger(sortOrder) || sortOrder < 1000) return null;
	const year = Math.floor(sortOrder / 12);
	const monthIndex = sortOrder % 12;
	if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11) return null;
	return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
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
		return { label: raw, order: year * 12 + month };
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
		/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|sept|octubre|noviembre|diciembre)[\s\-_./]*(\d{2,4})/,
	);
	if (fullMonthYear) {
		const month = MONTH_INDEX[fullMonthYear[1]];
		if (month != null) {
			const yearRaw = Number.parseInt(fullMonthYear[2], 10);
			const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
			return { label: raw, order: year * 12 + month };
		}
	}

	return { label: raw, order: fallback };
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

	const normalizedEntries = Object.entries(rowData).map(
		([key, value]) => [normalizeFieldKey(key), value] as const,
	);
	const normalizedCandidates = new Set(candidates.map((key) => normalizeFieldKey(key)));
	for (const [key, value] of normalizedEntries) {
		if (normalizedCandidates.has(key)) return value;
	}

	for (const [key, value] of normalizedEntries) {
		const tokens = key.split("_").filter(Boolean);
		for (const group of tokenGroups) {
			if (group.every((token) => tokens.some((entry) => entry.includes(token)))) {
				return value;
			}
		}
	}

	return null;
}

function buildCurvePoints(
	curvaRows: TablaApiRow[],
	resumenRows: TablaApiRow[],
	options?: { curveStartPeriod?: string | null },
): AdvanceCurvePoint[] {
	const points = new Map<
		string,
		AdvanceCurvePoint & {
			periodKey?: string | null;
		}
	>();
	const curveStartPeriod =
		typeof options?.curveStartPeriod === "string" && /^\d{4}-\d{2}$/.test(options.curveStartPeriod)
			? options.curveStartPeriod
			: null;
	const curveMonthIndexBase = detectCurveMonthIndexBase(curvaRows);
	const usesRelativePlanMonths =
		curveStartPeriod != null &&
		curvaRows.some((row) => {
			const periodo = getRowFieldValueByCandidates(
				row.data,
				["periodo", "periodo_key", "period", "mes"],
				[["periodo"], ["period"], ["mes"]],
			);
			return getCurveMonthNumber(periodo) != null;
		});

	curvaRows.forEach((row, index) => {
		const periodo = getRowFieldValueByCandidates(
			row.data,
			["periodo", "periodo_key", "period", "mes"],
			[["periodo"], ["period"], ["mes"]],
		);
		const avance = parsePercent(
			getRowFieldValueByCandidates(
				row.data,
				["avance_acumulado_pct", "avance_acum_pct", "avance_acumulado", "avance_pct"],
				[["avance", "acum"], ["acumulado"]],
			),
		);
		if (!periodo || avance == null) return;

		const raw = String(periodo).trim();
		const monthNumber = getCurveMonthNumber(raw);
		const monthOffset =
			monthNumber == null ? null : Math.max(0, monthNumber - curveMonthIndexBase);
		const periodFromMesN =
			monthOffset != null && curveStartPeriod ? addMonths(curveStartPeriod, monthOffset) : null;
		const parsed = parseMonthOrder(periodo, index);
		const periodKey =
			periodFromMesN ??
			(parsed.order >= 1000
				? `${Math.floor(parsed.order / 12)}-${String((parsed.order % 12) + 1).padStart(2, "0")}`
				: null);
		const label = periodKey ? periodLabel(periodKey) : parsed.label;
		const order =
			periodKey != null
				? Number.parseInt(periodKey.slice(0, 4), 10) * 12 + (Number.parseInt(periodKey.slice(5, 7), 10) - 1)
				: parsed.order;
		const key = periodKey ?? (normalizeText(label) || `plan-${index}`);
		const current = points.get(key);

		if (current) {
			current.planPct = avance;
			current.periodKey = current.periodKey ?? periodKey;
			current.sortOrder = Math.min(current.sortOrder, order);
			return;
		}

		points.set(key, {
			label,
			planPct: avance,
			realPct: null,
			sortOrder: order,
			periodKey,
		});
	});

	const normalizedResumenRows = usesRelativePlanMonths
		? [...resumenRows]
				.map((row, index) => {
					const explicitSequence = parseCertificateSequence(
						getRowFieldValueByCandidates(
							row.data,
							["n_certificado", "nro_certificado", "numero_certificado", "certificado"],
							[["certificado"], ["cert"]],
						),
					);
					const periodSource =
						getRowFieldValueByCandidates(
							row.data,
							["fecha_certificacion", "fecha", "issued_at", "date"],
							[["fecha", "cert"], ["fecha"]],
						) ??
						getRowFieldValueByCandidates(
							row.data,
							["periodo", "periodo_key", "period", "mes"],
							[["periodo"], ["period"], ["mes"]],
						);
					return {
						row,
						index,
						explicitSequence,
						parsedPeriod: parseMonthOrder(periodSource, index),
					};
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
		const avance = parsePercent(
			getRowFieldValueByCandidates(
				row.data,
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
				row.data,
				["fecha_certificacion", "fecha", "issued_at", "date"],
				[["fecha", "cert"], ["fecha"]],
			) ??
			getRowFieldValueByCandidates(
				row.data,
				["periodo", "periodo_key", "period", "mes"],
				[["periodo"], ["period"], ["mes"]],
			);
		if (!periodSource && !usesRelativePlanMonths) return;

		const parsed = parseMonthOrder(periodSource, index);
		const certSequence = explicitSequence ?? resumenIndex + 1;
		const relativePeriodKey =
			usesRelativePlanMonths && curveStartPeriod
				? addMonths(curveStartPeriod, Math.max(0, certSequence - curveMonthIndexBase))
				: null;
		const periodKey =
			relativePeriodKey ??
			(parsed.order >= 1000
				? `${Math.floor(parsed.order / 12)}-${String((parsed.order % 12) + 1).padStart(2, "0")}`
				: null);
		const label = periodKey ? periodLabel(periodKey) : parsed.label;
		const order =
			periodKey != null
				? Number.parseInt(periodKey.slice(0, 4), 10) * 12 + (Number.parseInt(periodKey.slice(5, 7), 10) - 1)
				: parsed.order;
		const key = periodKey ?? (normalizeText(label) || `real-${index}`);
		const current = points.get(key);

		if (current) {
			current.realPct = avance;
			current.periodKey = current.periodKey ?? periodKey;
			current.sortOrder = Math.min(current.sortOrder, order);
			return;
		}

		points.set(key, {
			label,
			planPct: null,
			realPct: avance,
			sortOrder: order,
			periodKey,
		});
	});

	if (curveStartPeriod) {
		const [y, m] = curveStartPeriod.split("-");
		const startOrder = Number.parseInt(y, 10) * 12 + (Number.parseInt(m, 10) - 1);
		const existing = points.get(curveStartPeriod);
		if (existing) {
			if (existing.realPct == null) existing.realPct = 0;
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
			label: point.label,
			planPct: point.planPct,
			realPct: point.realPct,
			sortOrder: point.sortOrder,
			periodKey: point.periodKey ?? curveSortOrderToPeriodKey(point.sortOrder),
		}));

	if (sortedPoints.length <= 1 || sortedPoints.some((point) => !point.periodKey)) {
		return sortedPoints;
	}

	const pointsByOrder = new Map(sortedPoints.map((point) => [point.sortOrder, point] as const));
	const minOrder = sortedPoints[0]?.sortOrder ?? 0;
	const maxOrder = sortedPoints[sortedPoints.length - 1]?.sortOrder ?? minOrder;
	const continuousPoints: AdvanceCurvePoint[] = [];
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
				realPct: maxRealSortOrder != null && order <= maxRealSortOrder ? 0 : null,
				sortOrder: order,
				periodKey,
			},
		);
	}

	return continuousPoints;
}

function mapTablaTypeToCellType(
	dataType: TablaColumnDataType,
): ColumnDef<CurveEditorRow>["cellType"] {
	switch (dataType) {
		case "number":
			return "number";
		case "currency":
			return "currency";
		case "date":
			return "date";
		case "boolean":
			return "boolean";
		default:
			return "text";
	}
}

function getDefaultValueForType(dataType: TablaColumnDataType): unknown {
	switch (dataType) {
		case "number":
		case "currency":
			return 0;
		case "boolean":
			return false;
		default:
			return "";
	}
}

function flattenTablaRows(rows: TablaApiRow[]): CurveEditorRow[] {
	return rows.map((row) => ({
		id: row.id,
		source: row.source ?? "manual",
		...(row.data ?? {}),
	}));
}

function toTablaApiRows(rows: CurveEditorRow[]): TablaApiRow[] {
	return rows.map((row) => {
		const data: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(row)) {
			if (key === "id" || key === "source") continue;
			data[key] = value;
		}
		return {
			id: row.id,
			source: typeof row.source === "string" ? row.source : "manual",
			data,
		};
	});
}

function toPreviewSeriesRows(
	rows: CurveEditorRow[],
	fieldMatch: CurveFieldMatch,
	editedSeries: "plan" | "real",
): TablaApiRow[] {
	if (!fieldMatch.xField || !fieldMatch.yField) {
		return toTablaApiRows(rows);
	}

	return rows.map((row) => {
		const data: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(row)) {
			if (key === "id" || key === "source") continue;
			data[key] = value;
		}
		const xValue = row[fieldMatch.xField];
		const yValue = row[fieldMatch.yField];

		if (editedSeries === "plan") {
			return {
				id: row.id,
				source: typeof row.source === "string" ? row.source : "manual",
				data: {
					...data,
					periodo: xValue,
					avance_acumulado_pct: yValue,
				},
			};
		}

		return {
			id: row.id,
			source: typeof row.source === "string" ? row.source : "manual",
			data: {
				...data,
				periodo: xValue,
				fecha_certificacion: xValue,
				avance_fisico_acumulado_pct: yValue,
			},
		};
	});
}

function getPreviewRowSortOrder(
	row: CurveEditorRow,
	fieldMatch: CurveFieldMatch,
	editedSeries: "plan" | "real",
	curveStartPeriod: string | null,
	monthIndexBase: 0 | 1,
	usesRelativePlanMonths: boolean,
	fallbackIndex: number,
): number | null {
	if (!fieldMatch.xField) return null;
	const xValue = row[fieldMatch.xField];
	if (editedSeries === "plan") {
		const raw = String(xValue ?? "").trim();
		if (!raw) return null;
		const monthNumber = getCurveMonthNumber(raw);
		const monthOffset =
			monthNumber == null ? null : Math.max(0, monthNumber - monthIndexBase);
		const periodFromMesN =
			monthOffset != null && curveStartPeriod ? addMonths(curveStartPeriod, monthOffset) : null;
		if (periodFromMesN) {
			const [y, m] = periodFromMesN.split("-");
			return Number.parseInt(y, 10) * 12 + (Number.parseInt(m, 10) - 1);
		}
		const parsed = parseMonthOrder(xValue, fallbackIndex);
		return parsed.order;
	}

	if (usesRelativePlanMonths && curveStartPeriod) {
		const certSequence =
			parseCertificateSequence(
				getRowFieldValueByCandidates(
					row,
					["n_certificado", "nro_certificado", "numero_certificado", "certificado"],
					[["certificado"], ["cert"]],
				),
			) ?? fallbackIndex + 1;
		const periodKey = addMonths(curveStartPeriod, Math.max(0, certSequence - monthIndexBase));
		if (periodKey) {
			const [y, m] = periodKey.split("-");
			return Number.parseInt(y, 10) * 12 + (Number.parseInt(m, 10) - 1);
		}
	}

	const parsed = parseMonthOrder(xValue, fallbackIndex);
	return parsed.order;
}

function getXAxisSortOrder(
	value: unknown,
	editedSeries: "plan" | "real",
	curveStartPeriod: string | null,
	monthIndexBase: 0 | 1,
): number | null {
	if (value == null || String(value).trim() === "") return null;
	if (editedSeries === "plan") {
		const raw = String(value).trim();
		const monthNumber = getCurveMonthNumber(raw);
		const monthOffset =
			monthNumber == null ? null : Math.max(0, monthNumber - monthIndexBase);
		const periodFromMesN =
			monthOffset != null && curveStartPeriod ? addMonths(curveStartPeriod, monthOffset) : null;
		if (periodFromMesN) {
			const [y, m] = periodFromMesN.split("-");
			return Number.parseInt(y, 10) * 12 + (Number.parseInt(m, 10) - 1);
		}
	}
	const parsed = parseMonthOrder(value, Number.MAX_SAFE_INTEGER / 2);
	return parsed.order;
}

function createEmptyEditorRow(columns: TablaColumnDefinition[]): CurveEditorRow {
	const row: CurveEditorRow = {
		id: crypto.randomUUID(),
		source: "manual",
	};
	for (const column of columns) {
		row[column.fieldKey] = getDefaultValueForType(column.dataType);
	}
	return row;
}

function resolveFieldKey(
	columns: TablaColumnDefinition[],
	candidates: string[],
	tokenGroups: string[][],
): string | null {
	const exactMap = new Map<string, string>();
	for (const column of columns) {
		exactMap.set(normalizeFieldKey(column.fieldKey), column.fieldKey);
		exactMap.set(normalizeFieldKey(column.label), column.fieldKey);
	}

	for (const candidate of candidates) {
		const match = exactMap.get(normalizeFieldKey(candidate));
		if (match) return match;
	}

	for (const column of columns) {
		const normalized = normalizeFieldKey(`${column.fieldKey}_${column.label}`);
		const tokens = normalized.split("_").filter(Boolean);
		for (const group of tokenGroups) {
			if (group.every((token) => tokens.some((entry) => entry.includes(token)))) {
				return column.fieldKey;
			}
		}
	}

	return null;
}

function describeFieldLabel(columns: TablaColumnDefinition[], fieldKey: string | null, fallback: string): string {
	if (!fieldKey) return fallback;
	return columns.find((column) => column.fieldKey === fieldKey)?.label ?? fallback;
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
	const response = await fetch(input, init);
	const payload = await response.json().catch(() => ({} as Record<string, unknown>));
	if (!response.ok) {
		throw new Error(
			typeof payload.error === "string" ? payload.error : "No se pudo cargar la información.",
		);
	}
	return payload as T;
}

async function fetchTablaRowsAll(obraId: string, tablaId: string, maxPages = 20): Promise<TablaApiRow[]> {
	const allRows: TablaApiRow[] = [];
	for (let page = 1; page <= maxPages; page += 1) {
		const payload = await fetchJson<{
			rows?: Array<{
				id: string;
				data?: Record<string, unknown>;
				source?: string | null;
			}>;
			pagination?: { hasNextPage?: boolean };
		}>(`/api/obras/${obraId}/tablas/${tablaId}/rows?page=${page}&limit=200`);
		const rows = Array.isArray(payload.rows)
			? payload.rows.map((row) => ({
				id: row.id,
				data: row.data ?? {},
				source: row.source ?? "manual",
			}))
			: [];
		allRows.push(...rows);
		if (!payload.pagination?.hasNextPage) break;
	}
	return allRows;
}

const CURVE_EDITOR_STEPS: Array<{ label: string; key: "choose" | "edit" }> = [
	{ label: "Elegir acción", key: "choose" },
	{ label: "Editar datos", key: "edit" },
];

function WizardSteps({ currentStep }: { currentStep: "choose" | "edit" }) {
	const currentIndex = CURVE_EDITOR_STEPS.findIndex((s) => s.key === currentStep);
	return (
		<div className="flex items-start">
			{CURVE_EDITOR_STEPS.map((step, index) => {
				const isActive = index === currentIndex;
				const isComplete = index < currentIndex;
				const isLast = index === CURVE_EDITOR_STEPS.length - 1;
				return (
					<div key={step.key} className="flex items-start">
						<div className="flex flex-col items-center gap-1.5">
							<div
								className={cn(
									"flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-semibold transition-all duration-200",
									isComplete
										? "border-orange-500 bg-orange-500 text-white"
										: isActive
											? "border-orange-500 bg-white text-orange-500 ring-4 ring-orange-500/10"
											: "border-stone-300 bg-white text-stone-400",
								)}
							>
								{isComplete ? (
									<svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
										<path
											d="M2 6.5l2.5 2.5 5.5-5.5"
											stroke="currentColor"
											strokeWidth="1.75"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
								) : (
									index + 1
								)}
							</div>
							<span
								className={cn(
									"text-[10px] font-medium tracking-[0.1em] uppercase transition-colors duration-200",
									isActive ? "text-orange-500" : isComplete ? "text-stone-600" : "text-stone-400",
								)}
							>
								{step.label}
							</span>
						</div>

						{!isLast && (
							<div className="relative mx-2 mt-3 h-[2px] w-8 overflow-hidden rounded-full bg-stone-200">
								<div
									className="absolute inset-y-0 left-0 rounded-full bg-orange-500 transition-[width] duration-300 ease-out"
									style={{ width: isComplete ? "100%" : "0%" }}
								/>
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}

function CurveEditorOptionCard({
	mode,
	selected,
	disabled,
	tableName,
	onSelect,
}: {
	mode: CurveEditorMode;
	selected: boolean;
	disabled: boolean;
	tableName: string;
	onSelect: (mode: CurveEditorMode) => void;
}) {
	const meta = MODE_META[mode];
	const Icon = meta.icon;

	return (
		<button
			type="button"
			onClick={() => onSelect(mode)}
			disabled={disabled}
			className={cn(
				"group rounded-2xl border p-5 text-left transition-all duration-150 active:scale-[0.98]",
				selected
					? "border-[#f29b63] bg-[linear-gradient(180deg,#fff8f1_0%,#fffdf9_100%)] shadow-[0_18px_40px_-26px_rgba(242,155,99,0.75),0_0_0_3px_rgba(249,115,22,0.07)]"
					: "border-stone-200 bg-white hover:border-[#f3c6a6] hover:bg-[#fffaf6]",
				disabled && "cursor-not-allowed opacity-55 active:scale-100 hover:border-stone-200 hover:bg-white",
			)}
		>
			<div className="flex items-start justify-between gap-4">
				<div
					className={cn(
						"inline-flex h-11 w-11 items-center justify-center rounded-2xl border",
						selected ? meta.toneClassName : "border-stone-200 bg-stone-50 text-stone-500",
					)}
				>
					<Icon className="h-5 w-5" />
				</div>
				<Badge
					variant="outline"
					className={cn(
						"rounded-full border-stone-200 bg-white text-[11px] font-medium text-stone-600",
						selected && "border-[#f6b37d] bg-[#fff7f1] text-[#9a4b17]",
					)}
				>
					{tableName}
				</Badge>
			</div>
			<div className="mt-5 space-y-2">
				<p className="text-base font-semibold text-stone-900">{meta.title}</p>
				<p className="text-sm leading-6 text-stone-600">{meta.description}</p>
			</div>
		</button>
	);
}

function CurveEditorWorkspace({
	editedSeries,
	basePlanRows,
	baseResumenRows,
	curveStartPeriod,
	fieldMatch,
	tableName,
	comparedAgainstName,
}: CurveEditorWorkspaceProps) {
	const { rows, actions, meta } = useFormTable<CurveEditorRow, Record<string, never>>();
	const currentTableRows = useMemo(
		() => toPreviewSeriesRows(rows.currentRows, fieldMatch, editedSeries),
		[editedSeries, fieldMatch, rows.currentRows],
	);
	const previewPlanRows = useMemo(
		() => (editedSeries === "plan" ? currentTableRows : toTablaApiRows(basePlanRows)),
		[basePlanRows, currentTableRows, editedSeries],
	);
	const previewResumenRows = useMemo(
		() => (editedSeries === "real" ? currentTableRows : toTablaApiRows(baseResumenRows)),
		[baseResumenRows, currentTableRows, editedSeries],
	);
	const monthIndexBase = useMemo<0 | 1>(
		() => detectCurveMonthIndexBase(previewPlanRows),
		[previewPlanRows],
	);
	const usesRelativePlanMonths = useMemo(
		() =>
			curveStartPeriod != null &&
			previewPlanRows.some((row) => {
				const periodo = getRowFieldValueByCandidates(
					row.data,
					["periodo", "periodo_key", "period", "mes"],
					[["periodo"], ["period"], ["mes"]],
				);
				return getCurveMonthNumber(periodo) != null;
			}),
		[curveStartPeriod, previewPlanRows],
	);
	const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
	const [focusedRowId, setFocusedRowId] = useState<string | null>(null);
	const activeRowId = focusedRowId ?? hoveredRowId;
	const rowSortOrderMap = useMemo(() => {
		return new Map(
			rows.currentRows.map((row, index) => [
				row.id,
				getPreviewRowSortOrder(
					row,
					fieldMatch,
					editedSeries,
					curveStartPeriod,
					monthIndexBase,
					usesRelativePlanMonths,
					index,
				),
			] as const),
		);
	}, [curveStartPeriod, editedSeries, fieldMatch, monthIndexBase, rows.currentRows, usesRelativePlanMonths]);
	const highlightedSortOrder = activeRowId ? rowSortOrderMap.get(activeRowId) ?? null : null;
	const previewPoints = useMemo(() => {
		return buildCurvePoints(previewPlanRows, previewResumenRows, {
			curveStartPeriod,
		});
	}, [curveStartPeriod, previewPlanRows, previewResumenRows]);

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
			<div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,0.60fr)_minmax(0,1.08fr)]">
				<section className="flex min-h-[300px] flex-col rounded-2xl border border-stone-200 bg-white">
					<div className="border-b border-stone-100 px-5 py-4">
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant="outline" className="rounded-full border-stone-200 bg-stone-50 text-stone-700">
								{tableName}
							</Badge>
							<span className="text-xs text-stone-400">vs</span>
							<Badge variant="outline" className="rounded-full border-stone-200 bg-stone-50 text-stone-700">
								{comparedAgainstName}
							</Badge>
						</div>
						<p className="mt-2 text-sm text-stone-500">
							La curva se recalcula en tiempo real con los cambios que hagas en la tabla.
						</p>
					</div>
					<div className="flex-1 px-4 pb-4">
						<AdvanceCurveChart
							points={previewPoints}
							focusedSeries={editedSeries}
							highlightedSortOrder={highlightedSortOrder}
						/>
					</div>
				</section>

				<section className="flex min-h-[300px] flex-col rounded-2xl border border-stone-200 bg-white">
					<div className="border-b border-stone-100 px-5 py-4">
						<div className="flex flex-wrap items-center gap-2">
							<Badge className="rounded-full border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50">
								X: {fieldMatch.xLabel}
							</Badge>
							<Badge className="rounded-full border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
								Y: {fieldMatch.yLabel}
							</Badge>
						</div>
						<p className="mt-2 text-sm text-stone-500">
							Las columnas resaltadas alimentan el gráfico. El resto también se puede editar si hace falta.
						</p>
					</div>
					<div
						className="min-h-0 flex-1 px-4 pb-2 pt-4"
						onMouseOver={(event) => {
							const row = (event.target as HTMLElement | null)?.closest<HTMLTableRowElement>("tr[data-row-id]");
							setHoveredRowId(row?.dataset.rowId ?? null);
						}}
						onMouseLeave={() => setHoveredRowId(null)}
						onFocusCapture={(event) => {
							const row = (event.target as HTMLElement | null)?.closest<HTMLTableRowElement>("tr[data-row-id]");
							setFocusedRowId(row?.dataset.rowId ?? null);
						}}
						onBlurCapture={(event) => {
							const nextTarget = event.relatedTarget as HTMLElement | null;
							const nextRow = nextTarget?.closest<HTMLTableRowElement>("tr[data-row-id]");
							setFocusedRowId(nextRow?.dataset.rowId ?? null);
						}}
					>
						<FormTableContent
							className="rounded-xl border border-stone-200"
							innerClassName="min-h-[380px] max-h-[56vh]"
						/>
					</div>
				</section>
			</div>
			<div className="flex items-center justify-center gap-3 px-4 py-3">
				<Button
					type="button"
					variant="outline"
					onClick={actions.addRow}
				>
					Agregar fila vacia
				</Button>
				{meta.hasUnsavedChanges ? (
					<Button
						type="button"
						variant="destructiveSecondary"
						onClick={actions.discard}
						disabled={meta.isSaving}
					>
						Descartar cambios
					</Button>
				) : null}
				<Button
					type="button"
					onClick={() => void actions.save()}
					disabled={!meta.hasUnsavedChanges || meta.isSaving}
				>
					{meta.isSaving ? "Guardando..." : "Guardar cambios"}
				</Button>
			</div>
		</div>
	);
}

export function CurveEditorDialog({
	obraId,
	curvaPlanTableId,
	curvaPlanTableName,
	pmcResumenTableId,
	pmcResumenTableName,
	onSaved,
}: CurveEditorDialogProps) {
	const [open, setOpen] = useState(false);
	const [step, setStep] = useState<"choose" | "edit">("choose");
	const [mode, setMode] = useState<CurveEditorMode | null>(null);
	const [bundle, setBundle] = useState<CurveEditorDataBundle | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);

	const availableModes = useMemo(
		() =>
		([
			pmcResumenTableId ? "certificado" : null,
			curvaPlanTableId ? "plan" : null,
		].filter(Boolean) as CurveEditorMode[]),
		[curvaPlanTableId, pmcResumenTableId],
	);

	const activeMode = mode ?? (availableModes.length === 1 ? availableModes[0] : null);
	const activeMeta = activeMode ? MODE_META[activeMode] : null;
	const activeTableId = activeMode === "plan" ? curvaPlanTableId : pmcResumenTableId;
	const activeTableName = activeMode === "plan" ? curvaPlanTableName : pmcResumenTableName;
	const comparedAgainstName = activeMode === "plan" ? pmcResumenTableName : curvaPlanTableName;
	const editedSeries: "plan" | "real" | null =
		activeTableId != null && activeTableId === curvaPlanTableId
			? "plan"
			: activeTableId != null && activeTableId === pmcResumenTableId
				? "real"
				: activeMode === "plan"
					? "plan"
					: activeMode === "certificado"
						? "real"
						: null;
	const activeTable = activeTableId && bundle ? bundle.tablasById[activeTableId] ?? null : null;
	const activeRows = useMemo(
		() => (activeMode === "plan" ? bundle?.planRows ?? [] : bundle?.resumenRows ?? []),
		[activeMode, bundle?.planRows, bundle?.resumenRows],
	);

	const fieldMatch = useMemo<CurveFieldMatch>(() => {
		if (!activeMode || !activeTable) {
			return {
				xField: null,
				yField: null,
				xLabel: "Periodo",
				yLabel: "Avance acumulado",
			};
		}

		const meta = MODE_META[activeMode];
		const xField = resolveFieldKey(activeTable.columns, meta.xCandidates, meta.xTokenGroups);
		const yField = resolveFieldKey(activeTable.columns, meta.yCandidates, meta.yTokenGroups);

		return {
			xField,
			yField,
			xLabel: describeFieldLabel(activeTable.columns, xField, "Periodo"),
			yLabel: describeFieldLabel(activeTable.columns, yField, "Avance acumulado"),
		};
	}, [activeMode, activeTable]);
	const xAxisColumnId = useMemo(() => {
		if (!activeTable || !fieldMatch.xField) return null;
		return activeTable.columns.find((column) => column.fieldKey === fieldMatch.xField)?.id ?? null;
	}, [activeTable, fieldMatch.xField]);
	const editorMonthIndexBase = useMemo<0 | 1>(() => {
		if (editedSeries !== "plan" || !fieldMatch.xField) return 1;
		for (const row of activeRows) {
			if (getCurveMonthNumber(row[fieldMatch.xField]) === 0) {
				return 0;
			}
		}
		return 1;
	}, [activeRows, editedSeries, fieldMatch.xField]);

	const loadEditorData = useCallback(async () => {
		if (!curvaPlanTableId && !pmcResumenTableId) {
			setLoadError("La obra no tiene tablas Curva Plan o PMC Resumen disponibles para editar.");
			return;
		}

		setIsLoading(true);
		setLoadError(null);
		try {
			const [tablasPayload, rulesConfig, planRows, resumenRows] = await Promise.all([
				fetchJson<{ tablas?: TablaDefinition[] }>(`/api/obras/${obraId}/tablas`),
				fetchJson<{ config?: CurveRuleConfig }>(`/api/obras/${obraId}/rules`).catch(() => ({ config: null })),
				curvaPlanTableId ? fetchTablaRowsAll(obraId, curvaPlanTableId) : Promise.resolve([]),
				pmcResumenTableId ? fetchTablaRowsAll(obraId, pmcResumenTableId) : Promise.resolve([]),
			]);

			const relevantIds = new Set(
				[curvaPlanTableId, pmcResumenTableId].filter(
					(value): value is string => typeof value === "string" && value.length > 0,
				),
			);
			const tablasById = Object.fromEntries(
				(tablasPayload.tablas ?? [])
					.filter((tabla) => relevantIds.has(tabla.id))
					.map((tabla) => [tabla.id, tabla]),
			) as Record<string, TablaDefinition>;

			setBundle({
				tablasById,
				planRows: flattenTablaRows(planRows),
				resumenRows: flattenTablaRows(resumenRows),
				curveStartPeriod: rulesConfig.config?.mappings?.curve?.plan?.startPeriod ?? null,
			});
		} catch (error) {
			setLoadError(
				error instanceof Error ? error.message : "No se pudo preparar el editor de curva.",
			);
		} finally {
			setIsLoading(false);
		}
	}, [curvaPlanTableId, obraId, pmcResumenTableId]);

	const resetState = useCallback(() => {
		setStep("choose");
		setMode(null);
		setBundle(null);
		setIsLoading(false);
		setLoadError(null);
	}, []);

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			setOpen(nextOpen);
			if (!nextOpen) {
				resetState();
			}
		},
		[resetState],
	);

	const handleContinue = useCallback(async () => {
		if (!activeMode) return;
		setStep("edit");
		if (!bundle && !isLoading) {
			await loadEditorData();
		}
	}, [activeMode, bundle, isLoading, loadEditorData]);

	const tableConfig = useMemo<FormTableConfig<CurveEditorRow, Record<string, never>> | null>(() => {
		if (!activeMode || !activeTableId || !activeTable) return null;

		const columns: ColumnDef<CurveEditorRow>[] = activeTable.columns.map((column) => {
			const isXAxis = fieldMatch.xField === column.fieldKey;
			const isYAxis = fieldMatch.yField === column.fieldKey;
			return {
				id: column.id,
				label: isXAxis ? `${column.label} (X)` : isYAxis ? `${column.label} (Y)` : column.label,
				field: column.fieldKey as Extract<keyof CurveEditorRow, string>,
				required: column.required,
				editable: true,
				cellType: mapTablaTypeToCellType(column.dataType),
				sortFn: isXAxis
					? (a, b) => {
						const orderA = getXAxisSortOrder(
							a[column.fieldKey],
							editedSeries ?? "plan",
							bundle?.curveStartPeriod ?? null,
							editorMonthIndexBase,
						);
						const orderB = getXAxisSortOrder(
							b[column.fieldKey],
							editedSeries ?? "plan",
							bundle?.curveStartPeriod ?? null,
							editorMonthIndexBase,
						);
						if (orderA == null && orderB == null) return String(a.id).localeCompare(String(b.id));
						if (orderA == null) return 1;
						if (orderB == null) return -1;
						if (orderA !== orderB) return orderA - orderB;
						return String(a.id).localeCompare(String(b.id));
					}
					: undefined,
				cellConfig: {
					syncOnChange: isXAxis || isYAxis,
				},
				defaultValue: getDefaultValueForType(column.dataType),
				cellClassName: isXAxis
					? "bg-sky-50/85 group-hover:bg-sky-50"
					: isYAxis
						? "bg-amber-50/85 group-hover:bg-amber-50"
						: undefined,
			};
		});

		return {
			tableId: `curve-editor-${obraId}-${activeMode}`,
			columns,
			lockedSort: xAxisColumnId ? { columnId: xAxisColumnId, direction: "asc" } : undefined,
			defaultRows: activeRows,
			createRow: () => createEmptyEditorRow(activeTable.columns),
			defaultPageSize: DEFAULT_TABLE_PAGE_SIZE,
			lockedPageSize: DEFAULT_TABLE_PAGE_SIZE,
			showToolbar: false,
			showInlineSearch: false,
			allowAddRows: true,
			onSave: async ({ rows, dirtyRows, deletedRowIds }) => {
				const response = await fetch(`/api/obras/${obraId}/tablas/${activeTableId}/rows`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						dirtyRows,
						deletedRowIds,
					}),
				});
				const payload = await response.json().catch(() => ({} as Record<string, unknown>));
				if (!response.ok) {
					throw new Error(
						typeof payload.error === "string"
							? payload.error
							: "No se pudieron guardar los cambios de la curva.",
					);
				}

				setBundle((current) => {
					if (!current) return current;
					if (activeMode === "plan") {
						return { ...current, planRows: rows };
					}
					return { ...current, resumenRows: rows };
				});

				await onSaved?.();
			},
		};
	}, [activeMode, activeRows, activeTable, activeTableId, bundle?.curveStartPeriod, editedSeries, editorMonthIndexBase, fieldMatch.xField, fieldMatch.yField, obraId, onSaved, xAxisColumnId]);

	const canOpen = availableModes.length > 0;

	return (
		<>
			<Button
				type="button"
				size="sm"
				variant="outline"
				className="gap-2"
				onClick={() => setOpen(true)}
				disabled={!canOpen}
			>
				<LineChartIcon className="size-4" />
				Modificar curva
			</Button>

			<Dialog open={open} onOpenChange={handleOpenChange}>
				<DialogContent className="flex max-h-[92vh] w-[96vw] max-w-[1460px] flex-col overflow-hidden rounded-[28px] border-stone-200 bg-background p-0 rounded-md">
					<DialogTitle className="sr-only">
						{step === "choose" ? "Modificar curva de avance" : activeMeta?.title ?? "Editor de curva"}
					</DialogTitle>

					{step === "choose" ? (
						/* ── Choose step: same centered single-column wizard layout as obra-defaults ── */
						<div className="flex flex-1 flex-col overflow-y-auto px-4 py-8">
							<div className="mx-auto w-full max-w-xl space-y-8 py-4">
								{/* Step indicator + title block */}
								<div className="space-y-6 text-center">
									<div className="flex items-start justify-center">
										<WizardSteps currentStep={step} />
									</div>
									<div className="space-y-2">
										<h3 className="text-balance text-3xl font-semibold tracking-tight text-stone-950">
											Modificar curva de avance
										</h3>
										<p className="mx-auto max-w-sm text-sm leading-6 text-stone-500">
											Elegí si querés cargar un certificado nuevo o ajustar la curva plan. En el paso siguiente vas a ver el gráfico y la tabla en la misma pantalla.
										</p>
									</div>
								</div>

								{/* Option cards */}
								<div className="grid gap-4 sm:grid-cols-2">
									<CurveEditorOptionCard
										mode="certificado"
										selected={activeMode === "certificado"}
										disabled={!pmcResumenTableId}
										tableName={pmcResumenTableName}
										onSelect={setMode}
									/>
									<CurveEditorOptionCard
										mode="plan"
										selected={activeMode === "plan"}
										disabled={!curvaPlanTableId}
										tableName={curvaPlanTableName}
										onSelect={setMode}
									/>
								</div>

								{/* Navigation footer */}
								<div className="flex items-center justify-between gap-4 border-t border-stone-200 pt-5">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="text-stone-500"
										onClick={() => handleOpenChange(false)}
									>
										Cancelar
									</Button>
									<Button
										type="button"
										onClick={() => void handleContinue()}
										disabled={!activeMode}
										className="active:scale-[0.97] transition-transform"
									>
										Continuar
									</Button>
								</div>
							</div>
						</div>
					) : (
						/* ── Edit step: wide panel layout (chart + table need the space) ── */
						<>
							<DialogHeader className="gap-3 border-b border-stone-200 bg-background px-6 py-5">
								<div className="flex flex-wrap items-start justify-center gap-4">
									<div className="space-y-3 text-center flex flex-col items-center">
										<WizardSteps currentStep={step} />
										<p className="text-3xl font-semibold text-stone-950">
											{activeMeta?.title ?? "Editor de curva"}
										</p>
									</div>
								</div>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="gap-2 text-stone-500 hover:text-stone-900 absolute top-4 left-4"
									onClick={() => setStep("choose")}
								>
									<ArrowLeft className="size-4" />
									Volver
								</Button>
							</DialogHeader>

							<div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-5">
								{isLoading ? (
									<div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-stone-300 bg-white min-h-[75vh] ">
										<Loader2 className="h-6 w-6 animate-spin text-stone-500" />
										<p className="text-sm text-stone-500">Preparando gráfico y tabla editable...</p>
									</div>
								) : loadError ? (
									<div className="flex flex-1 flex-col items-start justify-center rounded-3xl border border-[#f3c5ac] bg-[#fff7f2] p-6">
										<p className="text-base font-medium text-[#9a4b17]">{loadError}</p>
										<Button type="button" className="mt-4" onClick={() => void loadEditorData()}>
											Reintentar
										</Button>
									</div>
								) : tableConfig && bundle && activeMeta ? (
									<FormTable config={tableConfig} variant="embedded">
										<CurveEditorWorkspace
											editedSeries={editedSeries ?? "plan"}
											basePlanRows={bundle.planRows}
											baseResumenRows={bundle.resumenRows}
											curveStartPeriod={bundle.curveStartPeriod}
											fieldMatch={fieldMatch}
											tableName={activeTableName}
											comparedAgainstName={comparedAgainstName}
										/>
									</FormTable>
								) : (
									<div className="flex flex-1 items-center justify-center rounded-3xl border border-dashed border-stone-300 bg-white text-sm text-stone-500">
										No encontramos una tabla editable para esta acción.
									</div>
								)}
							</div>
						</>
					)}
				</DialogContent>
			</Dialog >
		</>
	);
}
