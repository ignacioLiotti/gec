'use client';

import type { ReactNode } from "react";
import { memo, useMemo, useState } from "react";
import {
	FormTableConfig,
	ColumnDef,
	TabFilterOption,
	HeaderGroup,
	FormTableRow,
	SaveRowsArgs,
	RowColorInfo,
} from "@/components/form-table/types";
import { requiredValidator } from "@/components/form-table/form-table";
import { FilterSection, RangeInputGroup } from "@/components/form-table/filter-components";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Obra } from "@/app/excel/schema";
import {
	ExternalLink,
	Ruler,
	Building2,
	Calendar,
	DollarSign,
	Clock,
} from "lucide-react";
import Link from "next/link";
import { usePrefetchObra } from "@/lib/use-prefetch-obra";

/**
 * Pure CSS tooltip for truncated text - no React state, no scroll listeners.
 * Uses native title attribute fallback with CSS enhancement.
 */
const TruncatedTextWithTooltip = memo(function TruncatedTextWithTooltip({
	text
}: {
	text: string
}) {
	return (
		<span
			title={text}
			className="group-hover:underline truncate block"
		>
			{text}
		</span>
	);
});

/**
 * Link component with hover prefetch for obra detail pages.
 * Prefetches data when user hovers over the link for faster navigation.
 */
const ObraDetailLink = memo(function ObraDetailLink({
	obraId,
	text,
}: {
	obraId: string;
	text: string;
}) {
	const { prefetchObra } = usePrefetchObra();

	return (
		<Link
			href={`/excel/${obraId}`}
			className="inline-flex items-center gap-2 font-semibold text-foreground hover:text-primary group absolute top-0 left-0 w-full h-full justify-start p-2"
			onMouseEnter={() => prefetchObra(obraId)}
		>
			<ExternalLink className="min-h-4 min-w-4 max-w-4 max-h-4 text-muted-foreground group-hover:text-primary" />
			<TruncatedTextWithTooltip text={text} />
		</Link>
	);
});

export type DetailAdvancedFilters = {
	supMin: string;
	supMax: string;
	entidades: string[];
	mesYear: string;
	mesContains: string;
	iniYear: string;
	iniContains: string;
	cmaMin: string;
	cmaMax: string;
	cafMin: string;
	cafMax: string;
	sacMin: string;
	sacMax: string;
	scMin: string;
	scMax: string;
	paMin: string;
	paMax: string;
	ptMin: string;
	ptMax: string;
	ptrMin: string;
	ptrMax: string;
};

type RangeFilterKey = Exclude<keyof DetailAdvancedFilters, "entidades">;

export type ObrasDetalleRow = FormTableRow & {
	n?: number | string | null;
	designacionYUbicacion?: string | null;
	supDeObraM2?: number | string | null;
	entidadContratante?: string | null;
	mesBasicoDeContrato?: string | null;
	iniciacion?: string | null;
	contratoMasAmpliaciones?: number | string | null;
	certificadoALaFecha?: number | string | null;
	saldoACertificar?: number | string | null;
	segunContrato?: number | string | null;
	prorrogasAcordadas?: number | string | null;
	plazoTotal?: number | string | null;
	plazoTransc?: number | string | null;
	porcentaje?: number | string | null;
	customData?: Record<string, unknown> | null;
	onFinishFirstMessage?: string | null;
	onFinishSecondMessage?: string | null;
	onFinishSecondSendAt?: string | null;
};

const currencyFormatter = new Intl.NumberFormat("es-AR", {
	style: "currency",
	currency: "ARS",
});

const FALLBACK_ID = () => `row-${Date.now()}-${Math.random()}`;
const generateRowId = () =>
	typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
		? crypto.randomUUID()
		: FALLBACK_ID();

let nextSequentialN = 0;

function formatCurrency(value?: number | string | null) {
	if (value == null || value === "") return "—";
	return currencyFormatter.format(toNumber(value));
}

const toNumber = (value: unknown): number => {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : 0;
	}
	if (typeof value === "string") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
};

const clampPercentage = (value: unknown): number => {
	const pct = toNumber(value);
	if (!Number.isFinite(pct)) return 0;
	return Math.max(0, Math.min(100, pct));
};

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const computeCertificado = (row: ObrasDetalleRow) => {
	const contrato = toNumber(row.contratoMasAmpliaciones);
	const avance = clampPercentage(row.porcentaje);
	return roundCurrency(contrato * (avance / 100));
};

const computeSaldo = (row: ObrasDetalleRow) => {
	const contrato = toNumber(row.contratoMasAmpliaciones);
	return roundCurrency(contrato - computeCertificado(row));
};

type RuleFieldType = "number" | "date";
type RuleCalculation = "raw" | "delta" | "ratio_pct" | "days_from_today" | "days_between";
type RuleOperator = "gte" | "lte" | "between" | "eq" | "neq" | "before" | "after";

type RowRuleCondition = {
	id: string;
	field: keyof ObrasDetalleRow;
	fieldType: RuleFieldType;
	calculation: RuleCalculation;
	referenceField?: keyof ObrasDetalleRow | null;
	op: RuleOperator;
	threshold?: number | null;
	thresholdMax?: number | null;
	dateValue?: string | null;
	dateValueMax?: string | null;
};

type RowColorRule = {
	id: string;
	logic: "all" | "any";
	color: "amber" | "red" | "green" | "blue";
	conditions: RowRuleCondition[];
};

type CompiledRowRuleCondition = RowRuleCondition & {
	parsedDateValue: number | null;
	parsedDateValueMax: number | null;
};

type CompiledRowColorRule = Omit<RowColorRule, "conditions"> & {
	conditions: CompiledRowRuleCondition[];
};

type LegacyRowColorRule = {
	id?: string;
	field?: keyof ObrasDetalleRow;
	calculation?: "raw" | "delta" | "ratio_pct";
	referenceField?: keyof ObrasDetalleRow | null;
	op?: "gte" | "lte" | "between";
	threshold?: number;
	thresholdMax?: number | null;
	color?: "amber" | "red" | "green" | "blue";
};

const ROW_COLOR_RULES_KEY = "obras-detalle:row-color-rules";
const ROW_COLOR_EVENT = "form-table:refresh";
const ROW_COLOR_TABLE_ID = "form-table-obras-detalle";
let inMemoryRowColorRules: RowColorRule[] = [];
let inMemoryCompiledRowColorRules: CompiledRowColorRule[] = [];
let rowColorRulesLoaded = false;
let previewedRowColorRuleId: string | null = null;

const emitRowColorRefresh = () => {
	if (typeof window === "undefined") return;
	try {
		window.dispatchEvent(
			new CustomEvent(ROW_COLOR_EVENT, {
				detail: { tableId: ROW_COLOR_TABLE_ID },
			})
		);
	} catch {
		// ignore
	}
};

const ROW_RULE_FIELD_OPTIONS: Array<{
	field: keyof ObrasDetalleRow;
	label: string;
	type: RuleFieldType;
}> = [
		{ field: "supDeObraM2", label: "Sup. de Obra (m²)", type: "number" },
		{ field: "contratoMasAmpliaciones", label: "Contrato + Ampliaciones", type: "number" },
		{ field: "certificadoALaFecha", label: "Certificado a la Fecha", type: "number" },
		{ field: "saldoACertificar", label: "Saldo a Certificar", type: "number" },
		{ field: "segunContrato", label: "Según Contrato", type: "number" },
		{ field: "prorrogasAcordadas", label: "Prórrogas Acordadas", type: "number" },
		{ field: "plazoTotal", label: "Plazo Total", type: "number" },
		{ field: "plazoTransc", label: "Plazo Transcurrido", type: "number" },
		{ field: "porcentaje", label: "% Avance", type: "number" },
		{ field: "mesBasicoDeContrato", label: "Mes Básico de Contrato", type: "date" },
		{ field: "iniciacion", label: "Iniciación", type: "date" },
		{ field: "onFinishSecondSendAt", label: "2° envío finalización", type: "date" },
	];

const getFieldOption = (field: keyof ObrasDetalleRow) =>
	ROW_RULE_FIELD_OPTIONS.find((option) => option.field === field);

const parseDateMs = (value: unknown): number | null => {
	if (!value) return null;
	if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
	const raw = String(value).trim();
	if (!raw) return null;
	const native = Date.parse(raw);
	if (!Number.isNaN(native)) return native;
	const match = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:\s+.*)?$/);
	if (!match) return null;
	const day = Number(match[1]);
	const month = Number(match[2]) - 1;
	const year = Number(match[3]);
	const date = new Date(year, month, day);
	const ts = date.getTime();
	return Number.isNaN(ts) ? null : ts;
};

const getFieldNumericValue = (row: ObrasDetalleRow, field: keyof ObrasDetalleRow) => {
	if (field === "certificadoALaFecha") return computeCertificado(row);
	if (field === "saldoACertificar") return computeSaldo(row);
	return toNumber(row[field]);
};

const getFieldDateMs = (row: ObrasDetalleRow, field: keyof ObrasDetalleRow) => {
	return parseDateMs(row[field]);
};

const parseStoredRules = (): RowColorRule[] => {
	if (typeof window === "undefined") return inMemoryRowColorRules;
	try {
		const raw = window.localStorage.getItem(ROW_COLOR_RULES_KEY);
		const parsed = raw ? JSON.parse(raw) : [];
		if (!Array.isArray(parsed)) return [];
		const next: RowColorRule[] = [];
		for (const candidate of parsed as Array<Partial<RowColorRule> & LegacyRowColorRule>) {
			if (Array.isArray(candidate.conditions)) {
				const conditions = candidate.conditions
					.filter((c) => c && typeof c.field === "string")
					.map((c) => {
						const field = c.field as keyof ObrasDetalleRow;
						const option = getFieldOption(field);
						return {
							id:
								typeof c.id === "string" && c.id
									? c.id
									: `${String(field)}-${Math.random().toString(36).slice(2, 7)}`,
							field,
							fieldType: option?.type ?? "number",
							calculation:
								c.calculation === "delta" ||
									c.calculation === "ratio_pct" ||
									c.calculation === "days_from_today" ||
									c.calculation === "days_between"
									? c.calculation
									: "raw",
							referenceField:
								typeof c.referenceField === "string"
									? (c.referenceField as keyof ObrasDetalleRow)
									: null,
							op:
								c.op === "lte" ||
									c.op === "between" ||
									c.op === "eq" ||
									c.op === "neq" ||
									c.op === "before" ||
									c.op === "after"
									? c.op
									: "gte",
							threshold:
								typeof c.threshold === "number" && Number.isFinite(c.threshold)
									? c.threshold
									: null,
							thresholdMax:
								typeof c.thresholdMax === "number" && Number.isFinite(c.thresholdMax)
									? c.thresholdMax
									: null,
							dateValue: typeof c.dateValue === "string" ? c.dateValue : null,
							dateValueMax: typeof c.dateValueMax === "string" ? c.dateValueMax : null,
						} satisfies RowRuleCondition;
					});
				if (conditions.length === 0) continue;
				next.push({
					id:
						typeof candidate.id === "string" && candidate.id
							? candidate.id
							: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
					logic: candidate.logic === "any" ? "any" : "all",
					color:
						candidate.color === "red" ||
							candidate.color === "green" ||
							candidate.color === "blue" ||
							candidate.color === "amber"
							? candidate.color
							: "amber",
					conditions,
				});
				continue;
			}
			// Legacy one-condition support
			if (typeof candidate.field !== "string") continue;
			const field = candidate.field as keyof ObrasDetalleRow;
			const option = getFieldOption(field);
			next.push({
				id:
					typeof candidate.id === "string" && candidate.id
						? candidate.id
						: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
				logic: "all",
				color:
					candidate.color === "red" ||
						candidate.color === "green" ||
						candidate.color === "blue" ||
						candidate.color === "amber"
						? candidate.color
						: "amber",
				conditions: [
					{
						id: `cond-${Math.random().toString(36).slice(2, 7)}`,
						field,
						fieldType: option?.type ?? "number",
						calculation:
							candidate.calculation === "delta" || candidate.calculation === "ratio_pct"
								? candidate.calculation
								: "raw",
						referenceField:
							typeof candidate.referenceField === "string"
								? candidate.referenceField
								: null,
						op:
							candidate.op === "lte" || candidate.op === "between"
								? candidate.op
								: "gte",
						threshold:
							typeof candidate.threshold === "number" && Number.isFinite(candidate.threshold)
								? candidate.threshold
								: 0,
						thresholdMax:
							typeof candidate.thresholdMax === "number" &&
								Number.isFinite(candidate.thresholdMax)
								? candidate.thresholdMax
								: null,
						dateValue: null,
						dateValueMax: null,
					},
				],
			});
		}
		return next;
	} catch {
		return inMemoryRowColorRules;
	}
};

const compileRowColorRules = (rules: RowColorRule[]): CompiledRowColorRule[] =>
	rules.map((rule) => ({
		...rule,
		conditions: rule.conditions.map((condition) => ({
			...condition,
			parsedDateValue: parseDateMs(condition.dateValue),
			parsedDateValueMax: parseDateMs(condition.dateValueMax),
		})),
	}));

const ensureRowColorRulesLoaded = () => {
	if (rowColorRulesLoaded) return;
	inMemoryRowColorRules = parseStoredRules();
	inMemoryCompiledRowColorRules = compileRowColorRules(inMemoryRowColorRules);
	rowColorRulesLoaded = true;
};

const readRowColorRules = (): RowColorRule[] => {
	ensureRowColorRulesLoaded();
	return inMemoryRowColorRules;
};

const writeRowColorRules = (rules: RowColorRule[]) => {
	inMemoryRowColorRules = rules;
	inMemoryCompiledRowColorRules = compileRowColorRules(rules);
	rowColorRulesLoaded = true;
	if (typeof window !== "undefined") {
		try {
			window.localStorage.setItem(ROW_COLOR_RULES_KEY, JSON.stringify(rules));
		} catch {
			// in-memory fallback only
		}
		emitRowColorRefresh();
	}
};

const setPreviewedRowColorRule = (ruleId: string | null) => {
	previewedRowColorRuleId = ruleId;
	emitRowColorRefresh();
};

const removeRowColorRule = (ruleId: string) => {
	const existing = readRowColorRules();
	writeRowColorRules(existing.filter((rule) => rule.id !== ruleId));
};

const clearRowColorRulesForField = (field: keyof ObrasDetalleRow) => {
	const existing = readRowColorRules();
	writeRowColorRules(
		existing.filter(
			(rule) => !rule.conditions.some((condition) => condition.field === field)
		)
	);
};

const evaluateNumericCondition = (value: number, condition: RowRuleCondition) => {
	const threshold = condition.threshold ?? 0;
	const thresholdMax = condition.thresholdMax ?? threshold;
	if (condition.op === "gte") return value >= threshold;
	if (condition.op === "lte") return value <= threshold;
	if (condition.op === "eq") return value === threshold;
	if (condition.op === "neq") return value !== threshold;
	return value >= Math.min(threshold, thresholdMax) && value <= Math.max(threshold, thresholdMax);
};

const evaluateCondition = (row: ObrasDetalleRow, condition: CompiledRowRuleCondition) => {
	if (condition.fieldType === "date") {
		if (condition.calculation === "days_from_today") {
			const dateMs = getFieldDateMs(row, condition.field);
			if (dateMs == null) return false;
			const now = Date.now();
			const days = Math.floor((now - dateMs) / (1000 * 60 * 60 * 24));
			return evaluateNumericCondition(days, condition);
		}
		if (condition.calculation === "days_between") {
			const base = getFieldDateMs(row, condition.field);
			const ref = condition.referenceField ? getFieldDateMs(row, condition.referenceField) : null;
			if (base == null || ref == null) return false;
			const days = Math.floor((base - ref) / (1000 * 60 * 60 * 24));
			return evaluateNumericCondition(days, condition);
		}
		const baseDate = getFieldDateMs(row, condition.field);
		if (baseDate == null) return false;
		const targetDate = condition.parsedDateValue;
		const targetDateMax = condition.parsedDateValueMax;
		if (condition.op === "before") return targetDate != null ? baseDate < targetDate : false;
		if (condition.op === "after") return targetDate != null ? baseDate > targetDate : false;
		if (condition.op === "eq") return targetDate != null ? baseDate === targetDate : false;
		if (condition.op === "neq") return targetDate != null ? baseDate !== targetDate : false;
		if (condition.op === "between") {
			if (targetDate == null || targetDateMax == null) return false;
			return (
				baseDate >= Math.min(targetDate, targetDateMax) &&
				baseDate <= Math.max(targetDate, targetDateMax)
			);
		}
		return false;
	}
	const base = getFieldNumericValue(row, condition.field);
	let metric = base;
	if (condition.calculation === "delta") {
		const ref = condition.referenceField ? getFieldNumericValue(row, condition.referenceField) : 0;
		metric = base - ref;
	} else if (condition.calculation === "ratio_pct") {
		const ref = condition.referenceField ? getFieldNumericValue(row, condition.referenceField) : 0;
		metric = ref === 0 ? 0 : (base / ref) * 100;
	}
	return evaluateNumericCondition(metric, condition);
};

const getMatchedRulesForRow = (row: ObrasDetalleRow) => {
	ensureRowColorRulesLoaded();
	return inMemoryCompiledRowColorRules.filter((rule) =>
		rule.logic === "any"
			? rule.conditions.some((condition) => evaluateCondition(row, condition))
			: rule.conditions.every((condition) => evaluateCondition(row, condition))
	);
};

const getRowColorInfo = (row: ObrasDetalleRow): RowColorInfo | undefined => {
	const matched = getMatchedRulesForRow(row);
	const first = matched[0];
	if (!first) return undefined;
	const previewing =
		previewedRowColorRuleId != null &&
		matched.some((rule) => rule.id === previewedRowColorRuleId);
	return { tone: first.color, previewing };
};

const rowOverlayBadgesFromRules = (row: ObrasDetalleRow) => {
	const matched = getMatchedRulesForRow(row);
	if (matched.length <= 1) return [];
	const extras = matched.slice(1);
	const colorLabel: Record<RowColorRule["color"], string> = {
		amber: "ambar",
		red: "roja",
		green: "verde",
		blue: "azul",
	};
	return extras.map((rule, index) => ({
		id: rule.id,
		label: `+${index + 1} ${colorLabel[rule.color]}`,
		tone: rule.color,
	}));
};

const buildRowColorMenuItems = (
	field: keyof ObrasDetalleRow,
	label: string
): NonNullable<ColumnDef<ObrasDetalleRow>["cellMenuItems"]> => [
		{
			id: `${String(field)}-row-gte`,
			label: `Color fila si ${label} >= esta celda`,
			onSelect: (row) => {
				const threshold = getFieldNumericValue(row, field);
				const existing = readRowColorRules();
				writeRowColorRules([
					...existing,
					{
						id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
						logic: "all",
						color: "amber",
						conditions: [
							{
								id: `cond-${Math.random().toString(36).slice(2, 7)}`,
								field,
								fieldType: getFieldOption(field)?.type ?? "number",
								calculation: "raw",
								referenceField: null,
								op: "gte",
								threshold,
								thresholdMax: null,
								dateValue: null,
								dateValueMax: null,
							},
						],
					},
				]);
			},
		},
		{
			id: `${String(field)}-row-lte`,
			label: `Color fila si ${label} <= esta celda`,
			onSelect: (row) => {
				const threshold = getFieldNumericValue(row, field);
				const existing = readRowColorRules();
				writeRowColorRules([
					...existing,
					{
						id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
						logic: "all",
						color: "red",
						conditions: [
							{
								id: `cond-${Math.random().toString(36).slice(2, 7)}`,
								field,
								fieldType: getFieldOption(field)?.type ?? "number",
								calculation: "raw",
								referenceField: null,
								op: "lte",
								threshold,
								thresholdMax: null,
								dateValue: null,
								dateValueMax: null,
							},
						],
					},
				]);
			},
		},
		{
			id: `${String(field)}-row-clear`,
			label: `Quitar color por ${label}`,
			onSelect: () => clearRowColorRulesForField(field),
		},
	];

type RuleConditionDraft = {
	id: string;
	field: keyof ObrasDetalleRow;
	fieldType: RuleFieldType;
	calculation: RuleCalculation;
	referenceField: keyof ObrasDetalleRow | null;
	op: RuleOperator;
	threshold: string;
	thresholdMax: string;
	dateValue: string;
	dateValueMax: string;
};

const createConditionDraft = (): RuleConditionDraft => ({
	id: `cond-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
	field: "contratoMasAmpliaciones",
	fieldType: "number",
	calculation: "raw",
	referenceField: "porcentaje",
	op: "gte",
	threshold: "0",
	thresholdMax: "100",
	dateValue: "",
	dateValueMax: "",
});

const colorLabelEs: Record<RowColorRule["color"], string> = {
	amber: "ambar",
	red: "rojo",
	green: "verde",
	blue: "azul",
};

const logicLabelEs: Record<RowColorRule["logic"], string> = {
	all: "todas",
	any: "cualquiera",
};

const valueOrPlaceholder = (value: string, placeholder: string) =>
	value.trim() ? value.trim() : placeholder;

const dateOrPlaceholder = (value: string) => {
	if (!value.trim()) return "[fecha]";
	const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return value;
	return `${match[3]}/${match[2]}/${match[1]}`;
};

const fieldLabelEs = (field: keyof ObrasDetalleRow) =>
	getFieldOption(field)?.label ?? String(field);

const draftMetricSentence = (condition: RuleConditionDraft) => {
	const field = fieldLabelEs(condition.field);
	if (condition.calculation === "raw") return `el valor de "${field}"`;
	if (condition.calculation === "delta") {
		const ref = fieldLabelEs(condition.referenceField ?? condition.field);
		return `la diferencia entre "${field}" y "${ref}"`;
	}
	if (condition.calculation === "ratio_pct") {
		const ref = fieldLabelEs(condition.referenceField ?? condition.field);
		return `el porcentaje de "${field}" sobre "${ref}"`;
	}
	if (condition.calculation === "days_from_today") {
		return `los dias desde "${field}" hasta hoy`;
	}
	const ref = fieldLabelEs(condition.referenceField ?? condition.field);
	return `los dias entre "${field}" y "${ref}"`;
};

const draftConditionSentence = (condition: RuleConditionDraft) => {
	const metric = draftMetricSentence(condition);
	const isDateField = condition.fieldType === "date";
	const usesDateCompare =
		isDateField &&
		(condition.op === "before" ||
			condition.op === "after" ||
			condition.op === "between" ||
			condition.op === "eq" ||
			condition.op === "neq");
	if (usesDateCompare) {
		if (condition.op === "before") {
			return `${metric} es anterior a ${dateOrPlaceholder(condition.dateValue)}.`;
		}
		if (condition.op === "after") {
			return `${metric} es posterior a ${dateOrPlaceholder(condition.dateValue)}.`;
		}
		if (condition.op === "eq") {
			return `${metric} es igual a ${dateOrPlaceholder(condition.dateValue)}.`;
		}
		if (condition.op === "neq") {
			return `${metric} es distinta de ${dateOrPlaceholder(condition.dateValue)}.`;
		}
		return `${metric} esta entre ${dateOrPlaceholder(condition.dateValue)} y ${dateOrPlaceholder(condition.dateValueMax)}.`;
	}
	if (condition.op === "gte") {
		return `${metric} es mayor o igual a ${valueOrPlaceholder(condition.threshold, "[valor]")}.`;
	}
	if (condition.op === "lte") {
		return `${metric} es menor o igual a ${valueOrPlaceholder(condition.threshold, "[valor]")}.`;
	}
	if (condition.op === "eq") {
		return `${metric} es igual a ${valueOrPlaceholder(condition.threshold, "[valor]")}.`;
	}
	if (condition.op === "neq") {
		return `${metric} es distinto de ${valueOrPlaceholder(condition.threshold, "[valor]")}.`;
	}
	return `${metric} esta entre ${valueOrPlaceholder(condition.threshold, "[min]")} y ${valueOrPlaceholder(condition.thresholdMax, "[max]")}.`;
};

function RowRulesDialogTrigger() {
	const [open, setOpen] = useState(false);
	const [refreshTick, setRefreshTick] = useState(0);
	const [activeTab, setActiveTab] = useState<"creator" | "active">("creator");
	const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
	const [hoveredRuleId, setHoveredRuleId] = useState<string | null>(null);
	const [logic, setLogic] = useState<"all" | "any">("all");
	const [color, setColor] = useState<RowColorRule["color"]>("amber");
	const [conditions, setConditions] = useState<RuleConditionDraft[]>([createConditionDraft()]);
	const rules = useMemo(() => readRowColorRules(), [refreshTick]);
	const selectedRule = rules.find((rule) => rule.id === selectedRuleId) ?? null;
	const draftRuleSentence = useMemo(() => {
		if (conditions.length === 0) {
			return "La regla se aplicara cuando se cumplan las condiciones definidas.";
		}
		const separator = logic === "all" ? " y " : " o ";
		const body = conditions.map((condition) => draftConditionSentence(condition)).join(separator);
		return `Pintar la fila de color ${colorLabelEs[color]} cuando se cumpla ${logicLabelEs[logic]} de estas condiciones: ${body}`;
	}, [conditions, logic, color]);

	// Reset form state when dialog opens
	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen);
		if (nextOpen) {
			// Reset creator form on open
			setConditions([createConditionDraft()]);
			setLogic("all");
			setColor("amber");
			setActiveTab("creator");
			// Refresh rules list from in-memory state
			setRefreshTick((prev) => prev + 1);
		} else {
			// Cleanup on close
			setHoveredRuleId(null);
			setSelectedRuleId(null);
			setPreviewedRowColorRule(null);
		}
	};

	// Direct preview handlers - no useEffect delay
	const handleSelectRule = (ruleId: string) => {
		const nextId = selectedRuleId === ruleId ? null : ruleId; // Toggle
		setSelectedRuleId(nextId);
		setPreviewedRowColorRule(hoveredRuleId ?? nextId);
	};

	const handleHoverRule = (ruleId: string) => {
		setHoveredRuleId(ruleId);
		setPreviewedRowColorRule(ruleId);
	};

	const handleUnhoverRule = () => {
		setHoveredRuleId(null);
		setPreviewedRowColorRule(selectedRuleId);
	};

	const handleTabChange = (value: string) => {
		setActiveTab(value as "creator" | "active");
		if (value === "creator") {
			// Clear preview when switching to creator tab
			setSelectedRuleId(null);
			setHoveredRuleId(null);
			setPreviewedRowColorRule(null);
		}
	};

	const addRule = () => {
		const existingRules = readRowColorRules();
		const mappedConditions: RowRuleCondition[] = [];
		for (const condition of conditions) {
			const threshold = Number(condition.threshold);
			const thresholdMax = Number(condition.thresholdMax);
			const isDateField = condition.fieldType === "date";
			const usesDateCompare =
				isDateField && (condition.op === "before" || condition.op === "after" || condition.op === "between" || condition.op === "eq" || condition.op === "neq");
			if (!usesDateCompare && !Number.isFinite(threshold)) {
				toast.error("Completá un threshold numérico válido.");
				return;
			}
			if (condition.op === "between" && !usesDateCompare && !Number.isFinite(thresholdMax)) {
				toast.error("Completá el threshold máximo para la condición entre valores.");
				return;
			}
			if (usesDateCompare && !condition.dateValue) {
				toast.error("Completá la fecha de la condición.");
				return;
			}
			if (usesDateCompare && condition.op === "between" && !condition.dateValueMax) {
				toast.error("Completá la fecha máxima para la condición entre fechas.");
				return;
			}
			mappedConditions.push({
				id: condition.id,
				field: condition.field,
				fieldType: condition.fieldType,
				calculation: condition.calculation,
				referenceField:
					condition.calculation === "raw" || condition.calculation === "days_from_today"
						? null
						: condition.referenceField,
				op: condition.op,
				threshold: usesDateCompare ? null : threshold,
				thresholdMax:
					condition.op === "between" && !usesDateCompare ? thresholdMax : null,
				dateValue: usesDateCompare ? condition.dateValue : null,
				dateValueMax:
					usesDateCompare && condition.op === "between" ? condition.dateValueMax : null,
			});
		}
		const nextRuleId = `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
		writeRowColorRules([
			...existingRules,
			{
				id: nextRuleId,
				logic,
				color,
				conditions: mappedConditions,
			},
		]);
		// Reset creator form for next rule
		setConditions([createConditionDraft()]);
		setActiveTab("active");
		setSelectedRuleId(nextRuleId);
		setPreviewedRowColorRule(nextRuleId);
		setRefreshTick((prev) => prev + 1);
	};

	return (
		<>
			<Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
				Reglas de color de filas
			</Button>
			<Dialog open={open} onOpenChange={handleOpenChange}>
				<DialogContent className="max-w-3xl">
					<DialogHeader>
						<DialogTitle>Reglas de color por columna</DialogTitle>
					</DialogHeader>
					<Tabs value={activeTab} onValueChange={handleTabChange}>
						<TabsList className="grid w-full grid-cols-2">
							<TabsTrigger value="creator">Crear regla</TabsTrigger>
							<TabsTrigger value="active">Reglas activas ({rules.length})</TabsTrigger>
						</TabsList>
						<TabsContent value="creator" className="space-y-4 mt-4">
							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-1">
									<Label>Encadenado</Label>
									<Select value={logic} onValueChange={(value) => setLogic(value as "all" | "any")}>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">Todas las condiciones</SelectItem>
											<SelectItem value="any">Cualquiera de las condiciones</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-1">
									<Label>Color de fila</Label>
									<Select value={color} onValueChange={(value) => setColor(value as RowColorRule["color"])}>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="amber">Ambar</SelectItem>
											<SelectItem value="red">Rojo</SelectItem>
											<SelectItem value="green">Verde</SelectItem>
											<SelectItem value="blue">Azul</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
							<div className="rounded border bg-muted/40 p-3">
								<p className="text-xs font-medium">Vista previa de la regla</p>
								<p className="mt-1 text-xs text-muted-foreground">{draftRuleSentence}</p>
							</div>
							<div className="space-y-3 max-h-[340px] overflow-auto pr-1">
								{conditions.map((condition, index) => {
									const isDateField = condition.fieldType === "date";
									const usesDateCompare =
										isDateField &&
										(condition.op === "before" ||
											condition.op === "after" ||
											condition.op === "between" ||
											condition.op === "eq" ||
											condition.op === "neq");
									return (
										<div key={condition.id} className="rounded border p-3 space-y-3">
											<div className="flex items-center justify-between">
												<p className="text-xs font-medium">Condición {index + 1}</p>
												<Button
													type="button"
													size="sm"
													variant="ghost"
													onClick={() =>
														setConditions((prev) =>
															prev.length === 1
																? prev
																: prev.filter((item) => item.id !== condition.id)
														)
													}
												>
													Quitar
												</Button>
											</div>
											<div className="grid grid-cols-2 gap-2">
												<div className="space-y-1">
													<Label>Columna</Label>
													<Select
														value={String(condition.field)}
														onValueChange={(value) =>
															setConditions((prev) =>
																prev.map((item) => {
																	if (item.id !== condition.id) return item;
																	const option = getFieldOption(value as keyof ObrasDetalleRow);
																	return {
																		...item,
																		field: value as keyof ObrasDetalleRow,
																		fieldType: option?.type ?? "number",
																		calculation: option?.type === "date" ? "raw" : "raw",
																		op: option?.type === "date" ? "after" : "gte",
																	};
																})
															)
														}
													>
														<SelectTrigger>
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															{ROW_RULE_FIELD_OPTIONS.map((option) => (
																<SelectItem key={String(option.field)} value={String(option.field)}>
																	{option.label}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												</div>
												<div className="space-y-1">
													<Label>Cálculo</Label>
													<Select
														value={condition.calculation}
														onValueChange={(value) =>
															setConditions((prev) =>
																prev.map((item) =>
																	item.id === condition.id
																		? { ...item, calculation: value as RuleCalculation }
																		: item
																)
															)
														}
													>
														<SelectTrigger>
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="raw">Valor de columna</SelectItem>
															{condition.fieldType === "number" && (
																<>
																	<SelectItem value="delta">Diferencia (columna - referencia)</SelectItem>
																	<SelectItem value="ratio_pct">Porcentaje (columna / referencia * 100)</SelectItem>
																</>
															)}
															{condition.fieldType === "date" && (
																<>
																	<SelectItem value="days_from_today">Días desde hoy</SelectItem>
																	<SelectItem value="days_between">Días entre columnas</SelectItem>
																</>
															)}
														</SelectContent>
													</Select>
												</div>
											</div>
											{condition.calculation !== "raw" &&
												condition.calculation !== "days_from_today" && (
													<div className="space-y-1">
														<Label>Columna de referencia</Label>
														<Select
															value={String(condition.referenceField ?? "")}
															onValueChange={(value) =>
																setConditions((prev) =>
																	prev.map((item) =>
																		item.id === condition.id
																			? { ...item, referenceField: value as keyof ObrasDetalleRow }
																			: item
																	)
																)
															}
														>
															<SelectTrigger>
																<SelectValue />
															</SelectTrigger>
															<SelectContent>
																{ROW_RULE_FIELD_OPTIONS.filter(
																	(option) => option.type === condition.fieldType
																).map((option) => (
																	<SelectItem key={`ref-${String(option.field)}`} value={String(option.field)}>
																		{option.label}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
													</div>
												)}
											<div className="grid grid-cols-2 gap-2">
												<div className="space-y-1">
													<Label>Operador</Label>
													<Select
														value={condition.op}
														onValueChange={(value) =>
															setConditions((prev) =>
																prev.map((item) =>
																	item.id === condition.id
																		? { ...item, op: value as RuleOperator }
																		: item
																)
															)
														}
													>
														<SelectTrigger>
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															{condition.fieldType === "date" ? (
																<>
																	<SelectItem value="before">Antes de</SelectItem>
																	<SelectItem value="after">Después de</SelectItem>
																	<SelectItem value="between">Entre fechas</SelectItem>
																	<SelectItem value="eq">Igual a</SelectItem>
																	<SelectItem value="neq">Distinto de</SelectItem>
																	<SelectItem value="gte">Mayor o igual (numérico)</SelectItem>
																	<SelectItem value="lte">Menor o igual (numérico)</SelectItem>
																</>
															) : (
																<>
																	<SelectItem value="gte">Mayor o igual</SelectItem>
																	<SelectItem value="lte">Menor o igual</SelectItem>
																	<SelectItem value="between">Entre valores</SelectItem>
																	<SelectItem value="eq">Igual a</SelectItem>
																	<SelectItem value="neq">Distinto de</SelectItem>
																</>
															)}
														</SelectContent>
													</Select>
												</div>
												<div className="space-y-1">
													<Label>{usesDateCompare ? "Fecha" : "Valor de comparación"}</Label>
													<Input
														type={usesDateCompare ? "date" : "number"}
														value={usesDateCompare ? condition.dateValue : condition.threshold}
														onChange={(e) =>
															setConditions((prev) =>
																prev.map((item) =>
																	item.id === condition.id
																		? usesDateCompare
																			? { ...item, dateValue: e.target.value }
																			: { ...item, threshold: e.target.value }
																		: item
																)
															)
														}
													/>
												</div>
											</div>
											{condition.op === "between" && (
												<div className="space-y-1">
													<Label>{usesDateCompare ? "Fecha máxima" : "Valor máximo"}</Label>
													<Input
														type={usesDateCompare ? "date" : "number"}
														value={usesDateCompare ? condition.dateValueMax : condition.thresholdMax}
														onChange={(e) =>
															setConditions((prev) =>
																prev.map((item) =>
																	item.id === condition.id
																		? usesDateCompare
																			? { ...item, dateValueMax: e.target.value }
																			: { ...item, thresholdMax: e.target.value }
																		: item
																)
															)
														}
													/>
												</div>
											)}
										</div>
									);
								})}
							</div>
							<Button
								type="button"
								variant="outline"
								onClick={() => setConditions((prev) => [...prev, createConditionDraft()])}
							>
								Agregar condición
							</Button>
						</TabsContent>
						<TabsContent value="active" className="space-y-3 mt-4">
							<p className="text-xs text-muted-foreground">
								Seleccioná una regla para resaltar en la tabla las filas afectadas.
							</p>
							<div className="space-y-2 max-h-56 overflow-auto border rounded-md p-2">
								{rules.length === 0 && (
									<p className="text-sm text-muted-foreground">Sin reglas definidas.</p>
								)}
								{rules.map((rule) => (
									<div
										key={rule.id}
										className={cn(
											"flex items-center justify-between rounded border px-2 py-1 text-xs cursor-pointer transition-colors",
											selectedRuleId === rule.id && "border-primary bg-primary/5"
										)}
										onClick={() => handleSelectRule(rule.id)}
										onMouseEnter={() => handleHoverRule(rule.id)}
										onMouseLeave={handleUnhoverRule}
									>
										<span>
											{rule.logic === "all" ? "Todas" : "Cualquiera"} · {rule.conditions.length} condición(es) · {colorLabelEs[rule.color]}
										</span>
										<Button
											type="button"
											size="sm"
											variant="ghost"
											onClick={(event) => {
												event.stopPropagation();
												const wasSelected = selectedRuleId === rule.id;
												removeRowColorRule(rule.id);
												if (wasSelected) {
													setSelectedRuleId(null);
													setPreviewedRowColorRule(null);
												}
												setRefreshTick((prev) => prev + 1);
											}}
										>
											Quitar
										</Button>
									</div>
								))}
							</div>
							{selectedRule && (
								<div className="rounded border bg-muted/40 p-2 text-xs">
									Regla seleccionada: {selectedRule.logic === "all" ? "Todas" : "Cualquiera"} ·{" "}
									{selectedRule.conditions.length} condición(es) · {colorLabelEs[selectedRule.color]}
								</div>
							)}
						</TabsContent>
					</Tabs>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => {
								setHoveredRuleId(null);
								setSelectedRuleId(null);
								setPreviewedRowColorRule(null);
								writeRowColorRules([]); // triggers emitRowColorRefresh
								setRefreshTick((prev) => prev + 1);
							}}
						>
							Limpiar reglas
						</Button>
						<Button type="button" onClick={addRule} disabled={activeTab !== "creator"}>
							Agregar regla
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

const sanitizeText = (value?: string | null) => (value ?? "").trim();

const updateSequentialSeedFromRows = (rows: ObrasDetalleRow[]) => {
	const max = rows.reduce((maxValue, row) => {
		const current = toNumber(row.n);
		return current > maxValue ? current : maxValue;
	}, 0);
	nextSequentialN = Math.max(nextSequentialN, max);
};

const createNewRow = (): ObrasDetalleRow => {
	nextSequentialN += 1;
	return {
		id: generateRowId(),
		n: nextSequentialN,
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
};

const FIXED_OBRA_FIELDS = new Set([
	"id",
	"n",
	"designacionYUbicacion",
	"supDeObraM2",
	"entidadContratante",
	"mesBasicoDeContrato",
	"iniciacion",
	"contratoMasAmpliaciones",
	"certificadoALaFecha",
	"saldoACertificar",
	"segunContrato",
	"prorrogasAcordadas",
	"plazoTotal",
	"plazoTransc",
	"porcentaje",
	"onFinishFirstMessage",
	"onFinishSecondMessage",
	"onFinishSecondSendAt",
	"customData",
]);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const mapDetailRowToPayload = (row: ObrasDetalleRow, index: number): Obra => {
	const parsedN = toNumber(row.n);
	const normalizedN =
		Number.isFinite(parsedN) && parsedN >= 1 ? Math.trunc(parsedN) : index + 1;
	const certificadoALaFecha = computeCertificado(row);
	const saldoACertificar = computeSaldo(row);
	const customData: Record<string, unknown> = {
		...(isPlainObject(row.customData) ? row.customData : {}),
	};
	for (const [key, value] of Object.entries(row)) {
		if (FIXED_OBRA_FIELDS.has(key)) continue;
		customData[key] = value ?? null;
	}
	return {
		id: typeof row.id === "string" ? row.id : undefined,
		n: normalizedN,
		designacionYUbicacion: sanitizeText(row.designacionYUbicacion),
		supDeObraM2: toNumber(row.supDeObraM2),
		entidadContratante: sanitizeText(row.entidadContratante),
		mesBasicoDeContrato: sanitizeText(row.mesBasicoDeContrato),
		iniciacion: sanitizeText(row.iniciacion),
		contratoMasAmpliaciones: toNumber(row.contratoMasAmpliaciones),
		certificadoALaFecha,
		saldoACertificar,
		segunContrato: toNumber(row.segunContrato),
		prorrogasAcordadas: toNumber(row.prorrogasAcordadas),
		plazoTotal: toNumber(row.plazoTotal),
		plazoTransc: toNumber(row.plazoTransc),
		porcentaje: clampPercentage(row.porcentaje),
		customData,
		onFinishFirstMessage: row.onFinishFirstMessage ?? null,
		onFinishSecondMessage: row.onFinishSecondMessage ?? null,
		onFinishSecondSendAt: row.onFinishSecondSendAt ?? null,
	};
};

const columns: ColumnDef<ObrasDetalleRow>[] = [
	{
		id: "n",
		label: "N°",
		field: "n",
		required: true,
		enableHide: false,
		enablePin: true,
		editable: false,
		cellType: "text",
		width: 25,
		enableResize: false,
		enableSort: false,
		// sortFn: (a, b) => toNumber(a.n) - toNumber(b.n),
		// searchFn: (row, query) => String(row.n ?? "").includes(query),
		// validators: {
		// 	onBlur: requiredValidator("N°"),
		// },
		defaultValue: null,
	},
	{
		id: "designacionYUbicacion",
		label: "Designación y Ubicación",
		field: "designacionYUbicacion",
		required: true,
		enableHide: true,
		enablePin: true,
		editable: false,
		cellType: "text",
		sortFn: (a, b) =>
			(a.designacionYUbicacion || "").localeCompare(b.designacionYUbicacion || "", "es", {
				sensitivity: "base",
			}),
		searchFn: (row, query) => (row.designacionYUbicacion || "").toLowerCase().includes(query),
		validators: {
			onBlur: requiredValidator("Designación y Ubicación"),
		},
		defaultValue: "",
		cellConfig: {
			renderReadOnly: ({ value, row }) => {
				const text = String(value || "");
				if (!text) return <span className="text-muted-foreground">-</span>;
				const obraId = row.id;
				if (!obraId) return <span className="font-semibold">{text}</span>;

				return <ObraDetailLink obraId={obraId} text={text} />;
			},
		},
		cellMenuItems: [
			{
				id: "open-obra",
				label: "Abrir detalle de la obra",
				onSelect: (row) => {
					if (typeof window === "undefined") return;
					const targetId = row.id;
					if (!targetId) return;
					window.location.href = `/excel/${targetId}`;
				},
			},
		],
	},
	{
		id: "supDeObraM2",
		label: "Sup. de Obra (m²)",
		field: "supDeObraM2",
		enableHide: true,
		enablePin: false,
		cellType: "text",
		sortFn: (a, b) => toNumber(a.supDeObraM2) - toNumber(b.supDeObraM2),
		searchFn: (row, query) => String(row.supDeObraM2 ?? "").includes(query),
		defaultValue: null,
	},
	{
		id: "entidadContratante",
		label: "Entidad Contratante",
		field: "entidadContratante",
		enableHide: true,
		enablePin: true,
		cellType: "text",
		sortFn: (a, b) =>
			(a.entidadContratante || "").localeCompare(b.entidadContratante || "", "es", {
				sensitivity: "base",
			}),
		searchFn: (row, query) => (row.entidadContratante || "").toLowerCase().includes(query),
		defaultValue: "",
	},
	{
		id: "mesBasicoDeContrato",
		label: "Mes Básico de Contrato",
		field: "mesBasicoDeContrato",
		enableHide: true,
		enablePin: false,
		cellType: "text",
		sortFn: (a, b) =>
			(a.mesBasicoDeContrato || "").localeCompare(b.mesBasicoDeContrato || "", "es", {
				sensitivity: "base",
			}),
		searchFn: (row, query) => (row.mesBasicoDeContrato || "").toLowerCase().includes(query),
		defaultValue: "",
	},
	{
		id: "iniciacion",
		label: "Iniciación",
		field: "iniciacion",
		enableHide: true,
		enablePin: false,
		cellType: "text",
		sortFn: (a, b) =>
			(a.iniciacion || "").localeCompare(b.iniciacion || "", "es", {
				sensitivity: "base",
			}),
		searchFn: (row, query) => (row.iniciacion || "").toLowerCase().includes(query),
		defaultValue: "",
	},
	{
		id: "contratoMasAmpliaciones",
		label: "Contrato + Ampliaciones",
		field: "contratoMasAmpliaciones",
		enableHide: true,
		enablePin: false,
		cellType: "currency",
		cellConfig: {
			currencyCode: "ARS",
			currencyLocale: "es-AR",
		},
		sortFn: (a, b) => toNumber(a.contratoMasAmpliaciones) - toNumber(b.contratoMasAmpliaciones),
		searchFn: (row, query) => String(row.contratoMasAmpliaciones ?? "").includes(query),
		defaultValue: null,
		cellMenuItems: buildRowColorMenuItems("contratoMasAmpliaciones", "Contrato + Ampliaciones"),
	},
	{
		id: "certificadoALaFecha",
		label: "Certificado a la Fecha",
		field: "certificadoALaFecha",
		enableHide: true,
		enablePin: false,
		editable: false,
		cellType: "currency",
		cellConfig: {
			currencyCode: "ARS",
			currencyLocale: "es-AR",
			renderReadOnly: ({ row }) => formatCurrency(computeCertificado(row)),
		},
		sortFn: (a, b) => computeCertificado(a) - computeCertificado(b),
		searchFn: (row, query) => String(computeCertificado(row)).includes(query),
		defaultValue: null,
		cellMenuItems: buildRowColorMenuItems("certificadoALaFecha", "Certificado a la Fecha"),
	},
	{
		id: "saldoACertificar",
		label: "Saldo a Certificar",
		field: "saldoACertificar",
		enableHide: true,
		enablePin: false,
		editable: false,
		cellType: "currency",
		cellConfig: {
			currencyCode: "ARS",
			currencyLocale: "es-AR",
			renderReadOnly: ({ row }) => formatCurrency(computeSaldo(row)),
		},
		sortFn: (a, b) => computeSaldo(a) - computeSaldo(b),
		searchFn: (row, query) => String(computeSaldo(row)).includes(query),
		defaultValue: null,
		cellMenuItems: buildRowColorMenuItems("saldoACertificar", "Saldo a Certificar"),
	},
	{
		id: "segunContrato",
		label: "Según Contrato",
		field: "segunContrato",
		enableHide: true,
		enablePin: false,
		cellType: "text",
		sortFn: (a, b) => toNumber(a.segunContrato) - toNumber(b.segunContrato),
		searchFn: (row, query) => String(row.segunContrato ?? "").includes(query),
		defaultValue: null,
	},
	{
		id: "prorrogasAcordadas",
		label: "Prórrogas Acordadas",
		field: "prorrogasAcordadas",
		enableHide: true,
		enablePin: false,
		cellType: "text",
		sortFn: (a, b) => toNumber(a.prorrogasAcordadas) - toNumber(b.prorrogasAcordadas),
		searchFn: (row, query) => String(row.prorrogasAcordadas ?? "").includes(query),
		defaultValue: null,
	},
	{
		id: "plazoTotal",
		label: "Plazo Total",
		field: "plazoTotal",
		enableHide: true,
		enablePin: false,
		cellType: "text",
		sortFn: (a, b) => toNumber(a.plazoTotal) - toNumber(b.plazoTotal),
		searchFn: (row, query) => String(row.plazoTotal ?? "").includes(query),
		defaultValue: null,
	},
	{
		id: "plazoTransc",
		label: "Plazo Transcurrido",
		field: "plazoTransc",
		enableHide: true,
		enablePin: false,
		cellType: "text",
		sortFn: (a, b) => toNumber(a.plazoTransc) - toNumber(b.plazoTransc),
		searchFn: (row, query) => String(row.plazoTransc ?? "").includes(query),
		defaultValue: null,
	},
	{
		id: "porcentaje",
		label: "% Avance",
		field: "porcentaje",
		enableHide: true,
		enablePin: false,
		cellType: "text",
		sortFn: (a, b) => toNumber(a.porcentaje) - toNumber(b.porcentaje),
		searchFn: (row, query) => String(row.porcentaje ?? "").includes(query),
		defaultValue: null,
		cellMenuItems: buildRowColorMenuItems("porcentaje", "% Avance"),
	},
];

export type MainTableColumnKind = "base" | "formula" | "custom";
export type MainTableFormulaFormat = "number" | "currency";

export type MainTableColumnConfig = {
	id: string;
	kind: MainTableColumnKind;
	label: string;
	enabled: boolean;
	width?: number;
	baseColumnId?: string;
	formula?: string;
	formulaFormat?: MainTableFormulaFormat;
	cellType?: ColumnDef<ObrasDetalleRow>["cellType"];
	required?: boolean;
	editable?: boolean;
	enableHide?: boolean;
	enablePin?: boolean;
	enableSort?: boolean;
	enableResize?: boolean;
};

export const MAIN_TABLE_BASE_COLUMN_OPTIONS = columns.map((column) => ({
	id: column.id,
	label: column.label,
	defaultWidth: column.width,
}));

export const DEFAULT_MAIN_TABLE_COLUMN_CONFIG: MainTableColumnConfig[] = columns.map((column) => {
	const isContrato = column.id === "contratoMasAmpliaciones";
	const isCertificado = column.id === "certificadoALaFecha";
	const isSaldo = column.id === "saldoACertificar";
	const isCalculatedDefault = isContrato || isCertificado || isSaldo;
	const formula =
		isContrato
			? "[contratoMasAmpliaciones]"
			: isCertificado
				? "[contratoMasAmpliaciones] * ([porcentaje] / 100)"
				: isSaldo
					? "[contratoMasAmpliaciones] - [certificadoALaFecha]"
					: undefined;
	return {
		id: column.id,
		kind: isCalculatedDefault ? ("formula" as const) : ("base" as const),
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
});

const BASE_COLUMNS_BY_ID = new Map(columns.map((column) => [column.id, column]));
const FORMULA_REF_PATTERN = /\[([a-zA-Z0-9_]+)\]/g;

const evaluateFormulaValue = (row: ObrasDetalleRow, formula: string): number => {
	if (!formula.trim()) return 0;
	const numericExpression = formula.replace(FORMULA_REF_PATTERN, (_full, fieldName) => {
		const field = fieldName as keyof ObrasDetalleRow;
		if (field === "certificadoALaFecha") return String(computeCertificado(row));
		if (field === "saldoACertificar") return String(computeSaldo(row));
		return String(toNumber(row[field]));
	});
	if (!/^[0-9+\-*/().\s]+$/.test(numericExpression)) return 0;
	try {
		const result = Function(`"use strict"; return (${numericExpression});`)();
		return Number.isFinite(result) ? Number(result) : 0;
	} catch {
		return 0;
	}
};

const buildFormulaColumn = (
	config: MainTableColumnConfig
): ColumnDef<ObrasDetalleRow> => {
	const formula = config.formula ?? "";
	const format = config.formulaFormat ?? "number";
	const forcedCellType = config.cellType;
	const resolvedCellType =
		forcedCellType ??
		(format === "currency" ? "currency" : ("text" as ColumnDef<ObrasDetalleRow>["cellType"]));
	const getValue = (row: ObrasDetalleRow) => evaluateFormulaValue(row, formula);

	return {
		id: config.id,
		label: config.label || config.id,
		field: config.id as any,
		enableHide: true,
		enablePin: false,
		editable: false,
		cellType: resolvedCellType,
		cellConfig:
			resolvedCellType === "currency"
				? {
					currencyCode: "ARS",
					currencyLocale: "es-AR",
					renderReadOnly: ({ row }) => formatCurrency(getValue(row)),
				}
				: {
					renderReadOnly: ({ row }) => getValue(row).toLocaleString("es-AR"),
				},
		sortFn: (a, b) => getValue(a) - getValue(b),
		searchFn: (row, query) => String(getValue(row)).includes(query),
		defaultValue: null,
		width: config.width,
		enableSort: config.enableSort ?? true,
		enableResize: config.enableResize ?? true,
		required: config.required ?? false,
	};
};

const buildCustomColumn = (
	config: MainTableColumnConfig
): ColumnDef<ObrasDetalleRow> => {
	const cellType = config.cellType ?? "text";
	const readValue = (row: ObrasDetalleRow) => row[config.id];
	return {
		id: config.id,
		label: config.label || config.id,
		field: config.id as any,
		enableHide: config.enableHide ?? true,
		enablePin: config.enablePin ?? false,
		editable: config.editable ?? true,
		cellType,
		defaultValue:
			cellType === "number" || cellType === "currency"
				? 0
				: cellType === "boolean"
					? false
					: "",
		width: config.width,
		enableSort: config.enableSort ?? true,
		enableResize: config.enableResize ?? true,
		required: config.required ?? false,
		sortFn: (a, b) => {
			const left = readValue(a);
			const right = readValue(b);
			if (cellType === "number" || cellType === "currency") {
				return toNumber(left) - toNumber(right);
			}
			return String(left ?? "").localeCompare(String(right ?? ""), "es", {
				sensitivity: "base",
			});
		},
		searchFn: (row, query) =>
			String(readValue(row) ?? "")
				.toLowerCase()
				.includes(query.toLowerCase()),
	};
};

const resolveColumnsFromConfig = (
	columnConfig?: MainTableColumnConfig[] | null
): ColumnDef<ObrasDetalleRow>[] => {
	if (!Array.isArray(columnConfig) || columnConfig.length === 0) {
		return columns;
	}

	const resolved: ColumnDef<ObrasDetalleRow>[] = [];
	for (const item of columnConfig) {
		if (item.enabled === false) continue;
		if (item.kind === "formula") {
			if (!item.formula || !item.id) continue;
			resolved.push(buildFormulaColumn(item));
			continue;
		}
		if (item.kind === "custom") {
			if (!item.id) continue;
			resolved.push(buildCustomColumn(item));
			continue;
		}
		const baseId = item.baseColumnId ?? item.id;
		const baseColumn = BASE_COLUMNS_BY_ID.get(baseId);
		if (!baseColumn) continue;
		resolved.push({
			...baseColumn,
			id: item.id || baseColumn.id,
			label: item.label || baseColumn.label,
			width: typeof item.width === "number" ? item.width : baseColumn.width,
			cellType: item.cellType ?? baseColumn.cellType,
			required: item.required ?? baseColumn.required,
			editable: item.editable ?? baseColumn.editable,
			enableHide: item.enableHide ?? baseColumn.enableHide,
			enablePin: item.enablePin ?? baseColumn.enablePin,
			enableSort: item.enableSort ?? baseColumn.enableSort,
			enableResize: item.enableResize ?? baseColumn.enableResize,
		});
	}

	if (resolved.length === 0) return columns;
	return resolved;
};

const resolveHeaderGroupsFromColumns = (
	resolvedColumns: ColumnDef<ObrasDetalleRow>[]
): HeaderGroup[] => {
	const visibleIds = new Set(resolvedColumns.map((column) => column.id));
	return headerGroups
		.map((group) => ({
			...group,
			columns: group.columns.filter((columnId) => visibleIds.has(columnId)),
		}))
		.filter((group) => group.columns.length > 0);
};

// fechas 
const headerGroups: HeaderGroup[] = [
	{
		id: "fechas",
		label: "FECHAS",
		columns: ["mesBasicoDeContrato", "iniciacion"],
	},
	{
		id: "importes",
		label: "IMPORTES (EN PESOS) A VALORES BÁSICOS",
		columns: ["contratoMasAmpliaciones", "certificadoALaFecha", "saldoACertificar"],
	},
	{
		id: "plazos",
		label: "PLAZOS (EN MESES)",
		columns: ["segunContrato", "prorrogasAcordadas", "plazoTotal", "plazoTransc"],
	},
];



const tabFilters: TabFilterOption<ObrasDetalleRow>[] = [
	{ id: "all", label: "Todas" },
	{ id: "in-process", label: "En proceso", predicate: (row) => toNumber(row.porcentaje) < 100 },
	{ id: "completed", label: "Completadas", predicate: (row) => toNumber(row.porcentaje) >= 100 },
];

const createFilters = (): DetailAdvancedFilters => ({
	supMin: "",
	supMax: "",
	entidades: [],
	mesYear: "",
	mesContains: "",
	iniYear: "",
	iniContains: "",
	cmaMin: "",
	cmaMax: "",
	cafMin: "",
	cafMax: "",
	sacMin: "",
	sacMax: "",
	scMin: "",
	scMax: "",
	paMin: "",
	paMax: "",
	ptMin: "",
	ptMax: "",
	ptrMin: "",
	ptrMax: "",
});



const renderFilters = ({
	filters,
	onChange,
}: {
	filters: DetailAdvancedFilters;
	onChange: (updater: (prev: DetailAdvancedFilters) => DetailAdvancedFilters) => void;
}): ReactNode => {
	const handleRangeChange = (key: RangeFilterKey, value: string) => {
		onChange((prev) => ({ ...prev, [key]: value }));
	};

	// Count active filters per section
	const superficieActive = [filters.supMin, filters.supMax].filter(Boolean).length;
	const entidadesActive = filters.entidades.length > 0 ? 1 : 0;
	const fechasActive = [filters.mesYear, filters.mesContains, filters.iniYear, filters.iniContains].filter(Boolean).length;
	const importesActive = [
		filters.cmaMin, filters.cmaMax,
		filters.cafMin, filters.cafMax,
		filters.sacMin, filters.sacMax,
	].filter(Boolean).length;
	const plazosActive = [
		filters.scMin, filters.scMax,
		filters.paMin, filters.paMax,
		filters.ptMin, filters.ptMax,
		filters.ptrMin, filters.ptrMax,
	].filter(Boolean).length;

	return (
		<div className="space-y-3">
			{/* Superficie */}
			<FilterSection
				title="Superficie"
				icon={Ruler}
				activeCount={superficieActive}
				defaultOpen
			>
				<RangeInputGroup
					label="Superficie de obra (m²)"
					minValue={filters.supMin}
					maxValue={filters.supMax}
					onMinChange={(v) => handleRangeChange("supMin", v)}
					onMaxChange={(v) => handleRangeChange("supMax", v)}
					minPlaceholder="100"
					maxPlaceholder="10000"
				/>
			</FilterSection>

			{/* Entidades */}
			<FilterSection
				title="Entidad contratante"
				icon={Building2}
				activeCount={entidadesActive}
				defaultOpen
			>
				<div className="space-y-1.5">
					<Label className="text-xs text-muted-foreground">
						Filtrar por entidades (una por linea o separadas por coma)
					</Label>
					<Textarea
						value={filters.entidades.join("\n")}
						onChange={(event) => {
							const values = event.currentTarget.value
								.split(/\r?\n|,/)
								.map((value) => value.trim())
								.filter(Boolean);
							onChange((prev) => ({ ...prev, entidades: values }));
						}}
						placeholder="Municipalidad de Buenos Aires&#10;Gobierno de la Provincia..."
						className="min-h-[80px] text-sm resize-none"
					/>
					{filters.entidades.length > 0 && (
						<p className="text-[10px] text-muted-foreground">
							{filters.entidades.length} entidad{filters.entidades.length > 1 ? "es" : ""} seleccionada{filters.entidades.length > 1 ? "s" : ""}
						</p>
					)}
				</div>
			</FilterSection>

			{/* Fechas */}
			<FilterSection
				title="Fechas"
				icon={Calendar}
				activeCount={fechasActive}
				defaultOpen
			>
				<div className="space-y-3">
					<div className="space-y-1.5">
						<Label className="text-xs text-muted-foreground">Mes basico de contrato</Label>
						<div className="grid grid-cols-2 gap-2">
							<Input
								value={filters.mesYear}
								onChange={(e) => handleRangeChange("mesYear", e.target.value)}
								placeholder="Año (2024)"
								className="h-8 text-sm"
							/>
							<Input
								value={filters.mesContains}
								onChange={(e) => handleRangeChange("mesContains", e.target.value)}
								placeholder="Contiene (enero)"
								className="h-8 text-sm"
							/>
						</div>
					</div>
					<div className="space-y-1.5">
						<Label className="text-xs text-muted-foreground">Fecha de iniciacion</Label>
						<div className="grid grid-cols-2 gap-2">
							<Input
								value={filters.iniYear}
								onChange={(e) => handleRangeChange("iniYear", e.target.value)}
								placeholder="Año (2024)"
								className="h-8 text-sm"
							/>
							<Input
								value={filters.iniContains}
								onChange={(e) => handleRangeChange("iniContains", e.target.value)}
								placeholder="Contiene (marzo)"
								className="h-8 text-sm"
							/>
						</div>
					</div>
				</div>
			</FilterSection>

			{/* Importes */}
			<FilterSection
				title="Importes"
				icon={DollarSign}
				activeCount={importesActive}
				defaultOpen
			>
				<div className="space-y-3">
					<RangeInputGroup
						label="Contrato + Ampliaciones"
						minValue={filters.cmaMin}
						maxValue={filters.cmaMax}
						onMinChange={(v) => handleRangeChange("cmaMin", v)}
						onMaxChange={(v) => handleRangeChange("cmaMax", v)}
					/>
					<RangeInputGroup
						label="Certificado a la fecha"
						minValue={filters.cafMin}
						maxValue={filters.cafMax}
						onMinChange={(v) => handleRangeChange("cafMin", v)}
						onMaxChange={(v) => handleRangeChange("cafMax", v)}
					/>
					<RangeInputGroup
						label="Saldo a certificar"
						minValue={filters.sacMin}
						maxValue={filters.sacMax}
						onMinChange={(v) => handleRangeChange("sacMin", v)}
						onMaxChange={(v) => handleRangeChange("sacMax", v)}
					/>
				</div>
			</FilterSection>

			{/* Plazos */}
			<FilterSection
				title="Plazos"
				icon={Clock}
				activeCount={plazosActive}
				defaultOpen
			>
				<div className="space-y-3">
					<RangeInputGroup
						label="Segun contrato (meses)"
						minValue={filters.scMin}
						maxValue={filters.scMax}
						onMinChange={(v) => handleRangeChange("scMin", v)}
						onMaxChange={(v) => handleRangeChange("scMax", v)}
					/>
					<RangeInputGroup
						label="Prorrogas acordadas"
						minValue={filters.paMin}
						maxValue={filters.paMax}
						onMinChange={(v) => handleRangeChange("paMin", v)}
						onMaxChange={(v) => handleRangeChange("paMax", v)}
					/>
					<RangeInputGroup
						label="Plazo total"
						minValue={filters.ptMin}
						maxValue={filters.ptMax}
						onMinChange={(v) => handleRangeChange("ptMin", v)}
						onMaxChange={(v) => handleRangeChange("ptMax", v)}
					/>
					<RangeInputGroup
						label="Plazo transcurrido"
						minValue={filters.ptrMin}
						maxValue={filters.ptrMax}
						onMinChange={(v) => handleRangeChange("ptrMin", v)}
						onMaxChange={(v) => handleRangeChange("ptrMax", v)}
					/>
				</div>
			</FilterSection>
		</div>
	);
};

const applyFilters = (row: ObrasDetalleRow, filters: DetailAdvancedFilters) => {
	const matchesRange = (value: string | number | null | undefined, minStr: string, maxStr: string) => {
		const numValue = toNumber(value);
		const min = minStr ? Number(minStr) : null;
		const max = maxStr ? Number(maxStr) : null;
		if (min != null && numValue < min) return false;
		if (max != null && numValue > max) return false;
		return true;
	};

	if (!matchesRange(row.supDeObraM2, filters.supMin, filters.supMax)) return false;
	if (!matchesRange(row.contratoMasAmpliaciones, filters.cmaMin, filters.cmaMax)) return false;
	if (!matchesRange(computeCertificado(row), filters.cafMin, filters.cafMax)) return false;
	if (!matchesRange(computeSaldo(row), filters.sacMin, filters.sacMax)) return false;
	if (!matchesRange(row.segunContrato, filters.scMin, filters.scMax)) return false;
	if (!matchesRange(row.prorrogasAcordadas, filters.paMin, filters.paMax)) return false;
	if (!matchesRange(row.plazoTotal, filters.ptMin, filters.ptMax)) return false;
	if (!matchesRange(row.plazoTransc, filters.ptrMin, filters.ptrMax)) return false;

	if (filters.entidades.length > 0) {
		const entidad = (row.entidadContratante || "").toLowerCase().trim();
		const allowed = filters.entidades.some((value) => entidad === value.toLowerCase().trim());
		if (!allowed) return false;
	}

	if (filters.mesYear) {
		if (!(row.mesBasicoDeContrato || "").includes(filters.mesYear)) return false;
	}
	if (filters.mesContains) {
		if (
			!(row.mesBasicoDeContrato || "")
				.toLowerCase()
				.includes(filters.mesContains.toLowerCase())
		)
			return false;
	}
	if (filters.iniYear) {
		if (!(row.iniciacion || "").includes(filters.iniYear)) return false;
	}
	if (filters.iniContains) {
		if (
			!(row.iniciacion || "")
				.toLowerCase()
				.includes(filters.iniContains.toLowerCase())
		)
			return false;
	}

	return true;
};

const countActiveFilters = (filters: DetailAdvancedFilters) => {
	let count = 0;
	const tally = (value: string | string[]) => {
		if (Array.isArray(value)) {
			if (value.filter((v) => v.trim().length > 0).length > 0) count += 1;
		} else if (value) {
			count += 1;
		}
	};

	tally(filters.supMin);
	tally(filters.supMax);
	tally(filters.entidades);
	tally(filters.mesYear);
	tally(filters.mesContains);
	tally(filters.iniYear);
	tally(filters.iniContains);
	tally(filters.cmaMin);
	tally(filters.cmaMax);
	tally(filters.cafMin);
	tally(filters.cafMax);
	tally(filters.sacMin);
	tally(filters.sacMax);
	tally(filters.scMin);
	tally(filters.scMax);
	tally(filters.paMin);
	tally(filters.paMax);
	tally(filters.ptMin);
	tally(filters.ptMax);
	tally(filters.ptrMin);
	tally(filters.ptrMax);
	return count;
};

type ObrasDetalleApiRow = {
	id: string;
	n?: number | null;
	designacionYUbicacion?: string | null;
	supDeObraM2?: number | null;
	entidadContratante?: string | null;
	mesBasicoDeContrato?: string | null;
	iniciacion?: string | null;
	contratoMasAmpliaciones?: number | null;
	certificadoALaFecha?: number | null;
	saldoACertificar?: number | null;
	segunContrato?: number | null;
	prorrogasAcordadas?: number | null;
	plazoTotal?: number | null;
	plazoTransc?: number | null;
	porcentaje?: number | null;
	customData?: Record<string, unknown> | null;
	onFinishFirstMessage?: string | null;
	onFinishSecondMessage?: string | null;
	onFinishSecondSendAt?: string | null;
};

function mapObraToDetailRow(obra: ObrasDetalleApiRow): ObrasDetalleRow {
	const customData =
		obra.customData && typeof obra.customData === "object" && !Array.isArray(obra.customData)
			? obra.customData
			: {};
	const row: ObrasDetalleRow = {
		id: obra.id,
		n: obra.n ?? null,
		designacionYUbicacion: obra.designacionYUbicacion ?? "",
		supDeObraM2: obra.supDeObraM2 ?? null,
		entidadContratante: obra.entidadContratante ?? "",
		mesBasicoDeContrato: obra.mesBasicoDeContrato ?? "",
		iniciacion: obra.iniciacion ?? "",
		contratoMasAmpliaciones: obra.contratoMasAmpliaciones ?? null,
		certificadoALaFecha: obra.certificadoALaFecha ?? null,
		saldoACertificar: obra.saldoACertificar ?? null,
		segunContrato: obra.segunContrato ?? null,
		prorrogasAcordadas: obra.prorrogasAcordadas ?? null,
		plazoTotal: obra.plazoTotal ?? null,
		plazoTransc: obra.plazoTransc ?? null,
		porcentaje: obra.porcentaje ?? null,
		customData,
		onFinishFirstMessage: obra.onFinishFirstMessage ?? null,
		onFinishSecondMessage: obra.onFinishSecondMessage ?? null,
		onFinishSecondSendAt: obra.onFinishSecondSendAt ?? null,
	};
	for (const [key, value] of Object.entries(customData)) {
		if (row[key] === undefined) {
			row[key] = value;
		}
	}
	row.certificadoALaFecha = computeCertificado(row);
	row.saldoACertificar = computeSaldo(row);
	return row;
}

const fetchObrasDetalle: FormTableConfig<ObrasDetalleRow, DetailAdvancedFilters>["fetchRows"] =
	async () => {
		// Use next revalidate for ISR-style caching (revalidate every 60 seconds)
		const response = await fetch(`/api/obras`, {
			next: { revalidate: 60 },
		});
		if (!response.ok) {
			const text = await response.text();
			throw new Error(text || "No se pudieron obtener las obras");
		}
		const payload = await response.json();
		const detalle = Array.isArray(payload.detalleObras)
			? (payload.detalleObras as ObrasDetalleApiRow[])
			: [];
		const rows = detalle.map(mapObraToDetailRow);
		updateSequentialSeedFromRows(rows);
		return {
			rows,
			pagination: {
				page: 1,
				limit: rows.length,
				total: rows.length,
				totalPages: 1,
				hasNextPage: false,
				hasPreviousPage: false,
			},
		};
	};

const saveObrasDetalle: FormTableConfig<ObrasDetalleRow, DetailAdvancedFilters>["onSave"] =
	async ({ rows }: SaveRowsArgs<ObrasDetalleRow>) => {
		const payload = {
			detalleObras: rows.map((row, index) => mapDetailRowToPayload(row, index)),
		};
		const response = await fetch("/api/obras", {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});
		if (!response.ok) {
			const errorPayload = await response.json().catch(() => ({}));
			const baseMessage = errorPayload?.error ?? "No se pudieron guardar las obras";
			const detailsMessage = errorPayload?.details
				? JSON.stringify(errorPayload.details)
				: null;
			throw new Error(detailsMessage ? `${baseMessage}: ${detailsMessage}` : baseMessage);
		}
	};

const obrasDetalleBaseConfig: Omit<
	FormTableConfig<ObrasDetalleRow, DetailAdvancedFilters>,
	"columns" | "headerGroups"
> = {
	tableId: ROW_COLOR_TABLE_ID,
	title: "Obras detalle",
	description: "Gestione el dataset de obras con filtros avanzados y edición en línea.",
	tabFilters,
	searchPlaceholder: "Buscar en columnas de obras",
	toolbarActions: <RowRulesDialogTrigger />,
	defaultPageSize: 10,
	showActionsColumn: false,
	enableColumnResizing: true,
	createFilters,
	renderFilters,
	applyFilters,
	countActiveFilters,
	rowColorInfo: (row) => getRowColorInfo(row),
	rowOverlayBadges: (row) => rowOverlayBadgesFromRules(row),
	fetchRows: fetchObrasDetalle,
	onSave: saveObrasDetalle,
	createRow: createNewRow,
	// accordionRow: {
	// 	triggerLabel: "detalle extendido",
	// 	renderContent: (row) => {
	// 		const avance = clampPercentage(row.porcentaje);
	// 		return (
	// 			<div className="space-y-4">
	// 				<div className="grid gap-4 text-sm md:grid-cols-3">
	// 					<div>
	// 						<p className="text-xs uppercase text-muted-foreground">Entidad contratante</p>
	// 						<p className="font-medium text-foreground">{row.entidadContratante || "Sin datos"}</p>
	// 					</div>
	// 					<div>
	// 						<p className="text-xs uppercase text-muted-foreground">Mes básico de contrato</p>
	// 						<p className="font-medium text-foreground">{row.mesBasicoDeContrato || "—"}</p>
	// 					</div>
	// 					<div>
	// 						<p className="text-xs uppercase text-muted-foreground">Iniciación</p>
	// 						<p className="font-medium text-foreground">{row.iniciacion || "—"}</p>
	// 					</div>
	// 				</div>
	// 				<div className="grid gap-4 text-sm md:grid-cols-4">
	// 					<div>
	// 						<p className="text-xs uppercase text-muted-foreground">Contrato + Ampliaciones</p>
	// 						<p className="font-semibold">{formatCurrency(row.contratoMasAmpliaciones)}</p>
	// 					</div>
	// 					<div>
	// 						<p className="text-xs uppercase text-muted-foreground">Certificado a la fecha</p>
	// 						<p className="font-semibold">{formatCurrency(row.certificadoALaFecha)}</p>
	// 					</div>
	// 					<div>
	// 						<p className="text-xs uppercase text-muted-foreground">Saldo a certificar</p>
	// 						<p className="font-semibold">{formatCurrency(row.saldoACertificar)}</p>
	// 					</div>
	// 					<div>
	// 						<p className="text-xs uppercase text-muted-foreground">Según contrato</p>
	// 						<p className="font-semibold">{formatCurrency(row.segunContrato)}</p>
	// 					</div>
	// 				</div>
	// 				<div className="grid gap-4 text-sm md:grid-cols-3">
	// 					<div>
	// 						<p className="text-xs uppercase text-muted-foreground">Prórrogas acordadas</p>
	// 						<p className="font-medium">{row.prorrogasAcordadas ?? "—"}</p>
	// 					</div>
	// 					<div>
	// 						<p className="text-xs uppercase text-muted-foreground">Plazo total</p>
	// 						<p className="font-medium">{row.plazoTotal ?? "—"}</p>
	// 					</div>
	// 					<div>
	// 						<p className="text-xs uppercase text-muted-foreground">Plazo transcurrido</p>
	// 						<p className="font-medium">{row.plazoTransc ?? "—"}</p>
	// 					</div>
	// 				</div>
	// 				<div className="space-y-2">
	// 					<p className="text-xs uppercase text-muted-foreground">Avance físico</p>
	// 					<div className="flex items-center gap-3">
	// 						<div className="h-2 flex-1 rounded-full bg-muted">
	// 							<div
	// 								className="h-2 rounded-full bg-orange-primary transition-all"
	// 								style={{ width: `${avance}%` }}
	// 							/>
	// 						</div>
	// 						<span className="text-sm font-semibold text-foreground">{avance}%</span>
	// 					</div>
	// 				</div>
	// 			</div>
	// 		);
	// 	},
	// },
};

export const createObrasDetalleConfig = (
	columnConfig?: MainTableColumnConfig[] | null
): FormTableConfig<ObrasDetalleRow, DetailAdvancedFilters> => {
	const resolvedColumns = resolveColumnsFromConfig(columnConfig);
	return {
		...obrasDetalleBaseConfig,
		columns: resolvedColumns,
		headerGroups: resolveHeaderGroupsFromColumns(resolvedColumns),
	};
};

export const obrasDetalleConfig: FormTableConfig<ObrasDetalleRow, DetailAdvancedFilters> =
	createObrasDetalleConfig();
