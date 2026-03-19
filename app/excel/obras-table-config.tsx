'use client';

import type { ReactNode } from "react";
import Link from "next/link";
import {
	type ColumnDef,
	type FormTableConfig,
	type FormTableRow,
	type HeaderGroup,
	type TabFilterOption,
	type SaveRowsArgs,
} from "@/components/form-table/types";
import { FilterSection, RangeInputGroup } from "@/components/form-table/filter-components";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Obra } from "@/app/excel/schema";
import type { ExcelPageMainTableColumnConfig, ExcelPageObra } from "@/lib/excel/types";
import { Building2, Calendar, Clock, DollarSign, Ruler } from "lucide-react";

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
	__pendingNavigation?: boolean;
};

type ObrasDetalleField = Extract<keyof Omit<ObrasDetalleRow, "id">, string>;

const currencyFormatter = new Intl.NumberFormat("es-AR", {
	style: "currency",
	currency: "ARS",
});

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
	"__pendingNavigation",
]);
const FORMULA_REF_PATTERN = /\[([a-zA-Z0-9_]+)\]/g;

let nextSequentialN = 0;

const sanitizeText = (value?: string | null) => (value ?? "").trim();
const isValidObraId = (value: unknown): value is string =>
	typeof value === "string" && UUID_PATTERN.test(value.trim());
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const toNumber = (value: unknown): number => {
	if (typeof value === "number") return Number.isFinite(value) ? value : 0;
	if (typeof value === "string") {
		const cleaned = value.replace(",", ".").replace(/[^0-9.-]/g, "");
		const parsed = Number(cleaned);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
};

const clampPercentage = (value: unknown): number => {
	const pct = toNumber(value);
	return Math.max(0, Math.min(100, pct));
};

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function formatCurrency(value?: number | string | null) {
	if (value == null || value === "") return "—";
	return currencyFormatter.format(toNumber(value));
}

const computeCertificado = (row: ObrasDetalleRow) => {
	const contrato = toNumber(row.contratoMasAmpliaciones);
	const avance = clampPercentage(row.porcentaje);
	return roundCurrency(contrato * (avance / 100));
};

const computeSaldo = (row: ObrasDetalleRow) => {
	const contrato = toNumber(row.contratoMasAmpliaciones);
	return roundCurrency(contrato - computeCertificado(row));
};

const renderAvanceContent = (
	value: unknown,
	options?: { labelClassName?: string }
): ReactNode => {
	const avance = clampPercentage(value);
	const displayValue = Number.isInteger(avance) ? String(avance) : avance.toFixed(1);

	return (
		<div className="flex w-full items-center gap-2 px-3">
			<div className="h-2 flex-1 overflow-hidden rounded-full bg-orange-300/90">
				<div
					className="h-full rounded-full bg-orange-primary/80 transition-[width]"
					style={{ width: `${avance}%` }}
				/>
			</div>
			<span className={cn("min-w-[3rem] text-right font-mono tabular-nums", options?.labelClassName)}>
				{displayValue}%
			</span>
		</div>
	);
};

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
		id:
			typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
				? crypto.randomUUID()
				: `row-${Date.now()}-${Math.random()}`,
		__pendingNavigation: true,
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
		id:
			typeof row.id === "string" && !row.__pendingNavigation && isValidObraId(row.id)
				? row.id
				: undefined,
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
		enableHide: false,
		enablePin: true,
		editable: false,
		cellType: "text",
		width: 25,
		enableResize: false,
		enableSort: false,
		defaultValue: null,
	},
	{
		id: "designacionYUbicacion",
		label: "Designación y Ubicación",
		field: "designacionYUbicacion",
		enableHide: true,
		enablePin: true,
		editable: true,
		cellType: "text",
		defaultValue: "",
		cellConfig: {
			renderReadOnly: ({ value, row }) => {
				const text = String(value || "");
				if (!text) return <span className="text-muted-foreground">-</span>;
				const canNavigate = isValidObraId(row.id) && !row.__pendingNavigation;
				if (!canNavigate) {
					return <span className="font-semibold">{text}</span>;
				}
				return (
					<Link href={`/excel/${row.id}`} prefetch={false} className="font-semibold hover:text-primary">
						{text}
					</Link>
				);
			},
		},
	},
	{
		id: "supDeObraM2",
		label: "Sup. de Obra (m²)",
		field: "supDeObraM2",
		enableHide: true,
		enablePin: false,
		cellType: "text",
		defaultValue: null,
	},
	{
		id: "entidadContratante",
		label: "Entidad Contratante",
		field: "entidadContratante",
		enableHide: true,
		enablePin: true,
		cellType: "text",
		defaultValue: "",
	},
	{
		id: "mesBasicoDeContrato",
		label: "Mes Básico de Contrato",
		field: "mesBasicoDeContrato",
		enableHide: true,
		enablePin: false,
		cellType: "text",
		defaultValue: "",
	},
	{
		id: "iniciacion",
		label: "Iniciación",
		field: "iniciacion",
		enableHide: true,
		enablePin: false,
		cellType: "text",
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
		defaultValue: null,
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
		defaultValue: null,
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
		defaultValue: null,
	},
	{
		id: "segunContrato",
		label: "Según Contrato",
		field: "segunContrato",
		enableHide: true,
		enablePin: false,
		cellType: "text",
		defaultValue: null,
	},
	{
		id: "prorrogasAcordadas",
		label: "Prórrogas Acordadas",
		field: "prorrogasAcordadas",
		enableHide: true,
		enablePin: false,
		cellType: "text",
		defaultValue: null,
	},
	{
		id: "plazoTotal",
		label: "Plazo Total",
		field: "plazoTotal",
		enableHide: true,
		enablePin: false,
		cellType: "text",
		defaultValue: null,
	},
	{
		id: "plazoTransc",
		label: "Plazo Transcurrido",
		field: "plazoTransc",
		enableHide: true,
		enablePin: false,
		cellType: "text",
		defaultValue: null,
	},
	{
		id: "porcentaje",
		label: "% Avance",
		field: "porcentaje",
		enableHide: true,
		enablePin: false,
		cellType: "badge",
		cellConfig: {
			renderReadOnly: ({ value }) => renderAvanceContent(value),
			renderEditable: ({ value, input }) => (
				<div className="group relative h-full w-full">
					<div className="pointer-events-none flex h-full w-full items-center group-focus-within:opacity-0">
						{renderAvanceContent(value, { labelClassName: "transition-opacity" })}
					</div>
					{input}
				</div>
			),
		},
		defaultValue: null,
	},
];

const BASE_COLUMNS_BY_ID = new Map(columns.map((column) => [column.id, column]));

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
	config: ExcelPageMainTableColumnConfig
): ColumnDef<ObrasDetalleRow> => {
	const formula = config.formula ?? "";
	const format = config.formulaFormat ?? "number";
	const resolvedCellType =
		config.cellType ??
		(format === "currency"
			? "currency"
			: ("text" as ColumnDef<ObrasDetalleRow>["cellType"]));
	const getValue = (row: ObrasDetalleRow) => evaluateFormulaValue(row, formula);

	return {
		id: config.id,
		label: config.label || config.id,
		field: config.id as ObrasDetalleField,
		enableHide: config.enableHide ?? true,
		enablePin: config.enablePin ?? false,
		editable: false,
		cellType: resolvedCellType,
		defaultValue: null,
		width: config.width,
		enableResize: config.enableResize ?? true,
		enableSort: config.enableSort ?? true,
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
		searchFn: (row, query) => getValue(row).toLocaleString("es-AR").includes(query),
	};
};

const buildCustomColumn = (
	config: ExcelPageMainTableColumnConfig
): ColumnDef<ObrasDetalleRow> => ({
	id: config.id,
	label: config.label || config.id,
	field: config.id as ObrasDetalleField,
	enableHide: config.enableHide ?? true,
	enablePin: config.enablePin ?? false,
	editable: config.editable ?? true,
	cellType: config.cellType ?? "text",
	defaultValue: "",
	width: config.width,
	enableResize: config.enableResize ?? true,
	enableSort: config.enableSort ?? true,
});

const resolveColumnsFromConfig = (
	columnConfig?: ExcelPageMainTableColumnConfig[] | null
): ColumnDef<ObrasDetalleRow>[] => {
	if (!Array.isArray(columnConfig) || columnConfig.length === 0) return columns;

	const resolved: ColumnDef<ObrasDetalleRow>[] = [];
	for (const item of columnConfig) {
		if (!item?.enabled) continue;
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
		const baseColumn = BASE_COLUMNS_BY_ID.get(item.baseColumnId ?? item.id);
		if (!baseColumn) continue;
		resolved.push({
			...baseColumn,
			id: item.id || baseColumn.id,
			label: item.label || baseColumn.label,
			width: typeof item.width === "number" ? item.width : baseColumn.width,
			cellType: item.cellType ?? baseColumn.cellType,
			editable: item.editable ?? baseColumn.editable,
			enableHide: item.enableHide ?? baseColumn.enableHide,
			enablePin: item.enablePin ?? baseColumn.enablePin,
			enableSort: item.enableSort ?? baseColumn.enableSort,
			enableResize: item.enableResize ?? baseColumn.enableResize,
		});
	}

	return resolved.length > 0 ? resolved : columns;
};

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

	const superficieActive = [filters.supMin, filters.supMax].filter(Boolean).length;
	const entidadesActive = filters.entidades.length > 0 ? 1 : 0;
	const fechasActive = [filters.mesYear, filters.mesContains, filters.iniYear, filters.iniContains].filter(Boolean).length;
	const importesActive = [
		filters.cmaMin,
		filters.cmaMax,
		filters.cafMin,
		filters.cafMax,
		filters.sacMin,
		filters.sacMax,
	].filter(Boolean).length;
	const plazosActive = [
		filters.scMin,
		filters.scMax,
		filters.paMin,
		filters.paMax,
		filters.ptMin,
		filters.ptMax,
		filters.ptrMin,
		filters.ptrMax,
	].filter(Boolean).length;

	return (
		<div className="space-y-3">
			<FilterSection title="Superficie" icon={Ruler} activeCount={superficieActive} defaultOpen>
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

			<FilterSection title="Entidad contratante" icon={Building2} activeCount={entidadesActive} defaultOpen>
				<div className="space-y-1.5">
					<Label className="text-xs text-muted-foreground">
						Filtrar por entidades (una por línea o separadas por coma)
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
						className="min-h-[80px] resize-none text-sm"
					/>
				</div>
			</FilterSection>

			<FilterSection title="Fechas" icon={Calendar} activeCount={fechasActive} defaultOpen>
				<div className="space-y-3">
					<div className="space-y-1.5">
						<Label className="text-xs text-muted-foreground">Mes básico de contrato</Label>
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
						<Label className="text-xs text-muted-foreground">Fecha de iniciación</Label>
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

			<FilterSection title="Importes" icon={DollarSign} activeCount={importesActive} defaultOpen>
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

			<FilterSection title="Plazos" icon={Clock} activeCount={plazosActive} defaultOpen>
				<div className="space-y-3">
					<RangeInputGroup
						label="Según contrato (meses)"
						minValue={filters.scMin}
						maxValue={filters.scMax}
						onMinChange={(v) => handleRangeChange("scMin", v)}
						onMaxChange={(v) => handleRangeChange("scMax", v)}
					/>
					<RangeInputGroup
						label="Prórrogas acordadas"
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

	if (filters.mesYear && !(row.mesBasicoDeContrato || "").includes(filters.mesYear)) return false;
	if (
		filters.mesContains &&
		!(row.mesBasicoDeContrato || "").toLowerCase().includes(filters.mesContains.toLowerCase())
	)
		return false;
	if (filters.iniYear && !(row.iniciacion || "").includes(filters.iniYear)) return false;
	if (
		filters.iniContains &&
		!(row.iniciacion || "").toLowerCase().includes(filters.iniContains.toLowerCase())
	)
		return false;

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

export function mapObraToDetailRow(obra: ExcelPageObra): ObrasDetalleRow {
	const customData =
		obra.customData && typeof obra.customData === "object" && !Array.isArray(obra.customData)
			? obra.customData
			: {};
	const row: ObrasDetalleRow = {
		id: obra.id,
		__pendingNavigation: false,
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
		const response = await fetch("/api/obras", { cache: "no-store" });
		if (!response.ok) {
			const text = await response.text();
			throw new Error(text || "No se pudieron obtener las obras");
		}
		const payload = await response.json();
		const detalle = Array.isArray(payload.detalleObras)
			? (payload.detalleObras as ExcelPageObra[])
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
			throw new Error(baseMessage);
		}
	};

const obrasDetalleBaseConfig: Omit<
	FormTableConfig<ObrasDetalleRow, DetailAdvancedFilters>,
	"columns" | "headerGroups"
> = {
	tableId: "form-table-obras-detalle",
	title: "Obras detalle",
	description: "Gestione el dataset de obras con filtros avanzados y edición en línea.",
	tabFilters,
	searchPlaceholder: "Buscar en columnas de obras",
	defaultPageSize: 10,
	showActionsColumn: false,
	enableColumnResizing: true,
	createFilters,
	renderFilters,
	applyFilters,
	countActiveFilters,
	fetchRows: fetchObrasDetalle,
	onSave: saveObrasDetalle,
	createRow: createNewRow,
};

export const createObrasDetalleConfig = (
	columnConfig?: ExcelPageMainTableColumnConfig[] | null
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
