'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ComponentType, ReactNode } from "react";
import { motion } from "framer-motion";
import {
	AlertCircle,
	AlertTriangle,
	BadgeDollarSign,
	Building2,
	Calendar,
	FileText,
	Hash,
	Landmark,
	LineChart as LineChartIcon,
	MapPin,
	Percent,
	Ruler,
	TrendingUp,
} from "lucide-react";
import {
	CartesianGrid,
	Line,
	LineChart,
	ReferenceArea,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

import type { Obra } from "@/app/excel/schema";
import type { MainTableColumnConfig } from "@/components/form-table/configs/obras-detalle";
import type { OcrTablaColumn, TablaDataRow } from "./file-manager/types";
import { CurveEditorDialog } from "./curve-editor-dialog";
import { QuickActionsPanel } from "@/components/quick-actions/quick-actions-panel";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	coerceMainColumnInputValue,
	formatMainColumnValue,
} from "@/lib/main-table-columns";
import { cn } from "@/lib/utils";
import { GlassyIcon } from "@/components/ui/glassy-icon";

type GeneralTabQuickActions = {
	obraId: string;
	quickActions: Array<{
		id: string;
		name: string;
		description?: string | null;
		folderPaths: string[];
	}>;
	folders: Array<{
		id: string;
		name: string;
		path: string;
		isOcr?: boolean;
		dataInputMethod?: "ocr" | "manual" | "both";
	}>;
	tablas: Array<{
		id: string;
		name: string;
		settings: Record<string, unknown>;
		columns: OcrTablaColumn[];
	}>;
	customStepRenderers?: Record<string, any>;
};

type ReportFinding = {
	id: string;
	rule_key: string;
	severity: "info" | "warn" | "critical";
	title: string;
	message: string | null;
	created_at: string;
};

type ReportCurvePoint = {
	label: string;
	planPct: number | null;
	realPct: number | null;
	sortOrder: number;
};

type GeneralTabReportsData = {
	findings: ReportFinding[];
	curve: {
		points: ReportCurvePoint[];
		planTableName: string;
		resumenTableName: string;
	} | null;
};

type MacroCertificateColumn = {
	id: string;
	label: string;
	sourceFieldKey?: string | null;
};

type MacroCertificateRow = {
	id: string;
	_obraId?: unknown;
	[key: string]: unknown;
};

type MacroCertificateData = {
	columns: MacroCertificateColumn[];
	rows: MacroCertificateRow[];
} | null;

type GeneralTabProps = {
	form: any; // FormApi type requires 11-12 type arguments, using any for simplicity
	isGeneralTabEditMode: boolean;
	hasUnsavedChanges: () => boolean;
	onSave: () => void | Promise<void>;
	isSaving: boolean;
	isFieldDirty: (field: keyof Obra) => boolean;
	applyObraToForm: (obra: Obra) => void;
	initialFormValues: Obra;
	getErrorMessage: (errors: unknown) => string;
	quickActionsAllData?: GeneralTabQuickActions;
	reportsData?: GeneralTabReportsData;
	mainTableColumns?: MainTableColumnConfig[];
	mainTableColumnValues?: Record<string, unknown>;
	setCustomMainColumnValue?: (columnId: string, value: unknown) => void;
	certificadosExtraidosRows?: TablaDataRow[];
	certificadoContableMacro?: MacroCertificateData;
	curveImportConfig?: {
		obraId: string;
		curvaPlanTableId: string | null;
		curvaPlanTableName: string;
		pmcResumenTableId: string | null;
		pmcResumenTableName: string;
		onImported?: () => Promise<void> | void;
	};
	derivedCertificadosNotice?: {
		sourceLabel: string | null;
		updatedFieldKeys: Array<"certificadoALaFecha" | "saldoACertificar" | "porcentaje">;
		updatedFieldLabels: string[];
		blockedFieldKeys: Array<"saldoACertificar" | "porcentaje">;
		blockedFieldLabels: string[];
		warningMessage: string | null;
	} | null;
};

const STATIC_GENERAL_FIELD_IDS = new Set([
	"porcentaje",
	"designacionYUbicacion",
	"entidadContratante",
	"mesBasicoDeContrato",
	"iniciacion",
	"n",
	"supDeObraM2",
	"contratoMasAmpliaciones",
	"certificadoALaFecha",
	"saldoACertificar",
	"segunContrato",
	"prorrogasAcordadas",
	"plazoTotal",
	"plazoTransc",
]);

const periodLabel = (period: string): string => {
	const [year, month] = period.split("-");
	const y = Number.parseInt(year, 10);
	const m = Number.parseInt(month, 10);
	if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return period;
	return new Date(y, m - 1, 1).toLocaleDateString("es-AR", {
		month: "short",
		year: "numeric",
	});
};

const CircularProgress = ({ value }: { value: number }) => {
	const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
	const radius = 60;
	const strokeWidth = 30;
	const circumference = 2 * Math.PI * radius;
	const offset = circumference - (clamped / 100) * circumference;

	return (
		<div className="relative mx-auto flex items-center justify-center h-full w-full">
			<svg
				width={(radius + strokeWidth) * 2}
				height={(radius + strokeWidth) * 2}
				viewBox={`0 0 ${(radius + strokeWidth) * 2} ${(radius + strokeWidth) * 2}`}
				className="drop-shadow-sm"
			>
				<circle
					className="text-muted/40 h-full w-full"
					stroke="currentColor"
					fill="transparent"
					strokeWidth={strokeWidth}
					r={radius}
					cx={radius + strokeWidth}
					cy={radius + strokeWidth}
				/>
				<motion.circle
					className="text-orange-primary/80 h-full w-full"
					stroke="currentColor"
					fill="transparent"
					strokeWidth={strokeWidth}
					strokeLinecap="round"
					r={radius}
					cx={radius + strokeWidth}
					cy={radius + strokeWidth}
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					initial={{ strokeDashoffset: circumference }}
					animate={{ strokeDashoffset: offset }}
					transition={{ type: "spring", stiffness: 140, damping: 20 }}
				/>
			</svg>
			<div className="absolute flex flex-col items-center justify-center h-full w-full">
				<div className="text-3xl font-bold leading-none">
					{Number.isNaN(clamped) ? 0 : Math.round(clamped)}%
				</div>
				<div className="mt-1 text-xs text-muted-foreground">Completado</div>
			</div>
		</div>
	);
};

function ShellCard({
	title,
	icon: Icon,
	action,
	children,
	className,
	bodyClassName,
}: {
	title: string;
	icon: ComponentType<{ className?: string }>;
	action?: ReactNode;
	children: ReactNode;
	className?: string;
	bodyClassName?: string;
}) {
	return (
		<section
			className={cn(
				"overflow-hidden rounded-xl bg-white shadow-card",
				className
			)}
		>
			<header className="flex items-center justify-between gap-3 border-b border-[#f0f0f0] px-5 py-3.5">
				<div className="flex items-center gap-2.5">
					<GlassyIcon size={8} primaryVar="var(--color-orange-primary)" className="w-8">
						<Icon className={cn("size-4.5 text-primary", title === "Datos Financieros" && "size-5")} />
					</GlassyIcon>
					<h2 className="text-[18px] font-semibold text-[#1a1a1a]">{title}</h2>
				</div>
				{action}
			</header>
			<div className={cn("p-5", bodyClassName)}>{children}</div>
		</section>
	);
}

function KpiItem({
	label,
	value,
	highlighted = false,
}: {
	label: string;
	value: string;
	highlighted?: boolean;
}) {
	return (
		<div
			className={cn(
				"space-y-1 rounded-xl px-3 py-2 transition-colors",
				highlighted && "border border-[#f7b26a] bg-[#fffaf5] shadow-[0_0_0_1px_rgba(247,178,106,0.15)]"
			)}
		>
			<p className="text-[11px] font-medium uppercase tracking-wide text-[#aaa]">{label}</p>
			<p className="text-lg font-semibold tabular-nums tracking-tight text-[#1a1a1a] sm:text-xl">
				{value}
			</p>
		</div>
	);
}

function MiniField({
	icon: Icon,
	label,
	value,
	highlighted = false,
}: {
	icon: ComponentType<{ className?: string }>;
	label: string;
	value: string;
	highlighted?: boolean;
}) {
	return (
		<div
			className={cn(
				"rounded-lg border border-[#f0f0f0] p-3 flex-1",
				highlighted && "border-[#f7b26a] bg-[#fff7ed]"
			)}
		>
			<div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-[#aaa]">
				<Icon className="size-3.5" />
				<span>{label}</span>
			</div>
			<div className="text-[13px] font-medium leading-snug text-[#1a1a1a]">{value}</div>
		</div>
	);
}

const SURFACE_INPUT_CLASS =
	"h-10 rounded-lg border-[#e8e8e8] bg-white text-[#1a1a1a] shadow-[0_0_0_1px_#00000012,0_1px_0_0_#fff_inset] focus-visible:ring-2 focus-visible:ring-orange-200";

const formatNumber = (value: unknown, suffix = "") => {
	const num = Number(value ?? 0);
	const safe = Number.isFinite(num) ? num : 0;
	return `${safe.toLocaleString("es-AR")}${suffix}`;
};

const formatCurrency = (value: unknown) => `$ ${formatNumber(value)}`;

type ObraCertificateSummary = {
	id: string;
	certificateNumber: string;
	expedienteNumber: string;
	location: string;
	period: string | null;
	amount: string | null;
	cobrado: string | null;
};

const CERTIFICATE_NUMBER_KEYS = [
	"n_certificado",
	"nro_certificado",
	"numero_certificado",
	"certificado",
	"certificate_number",
];
const CERTIFICATE_EXPEDIENTE_KEYS = [
	"n_exp",
	"n_expediente",
	"nro_expediente",
	"numero_expediente",
	"expediente",
	"expediente_numero",
];
const CERTIFICATE_LOCATION_KEYS = [
	"ubicacion_exte",
	"ubicacion_expediente",
	"ubicacion_actual",
	"ubicacion",
	"location",
];
const CERTIFICATE_PERIOD_KEYS = ["mes", "periodo", "period", "fecha", "fecha_certificacion"];
const CERTIFICATE_AMOUNT_KEYS = ["monto", "monto_certificado", "importe", "total"];

function isPlainRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeCertificateLookupValue(value: unknown): string {
	if (value == null) return "";
	const text = String(value).trim();
	if (!text) return "";
	const digits = text.replace(/\D/g, "");
	if (digits) {
		const normalizedDigits = digits.replace(/^0+/, "");
		return normalizedDigits || "0";
	}
	return text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();
}

function normalizeMacroColumnKey(value: string | null | undefined): string {
	return String(value ?? "")
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");
}

function formatCobradoValue(value: unknown): string | null {
	if (value == null) return null;
	if (typeof value === "boolean") return value ? "Si" : "No";
	const text = String(value).trim();
	if (!text) return null;
	const normalized = text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();
	if (["true", "si", "yes", "1"].includes(normalized)) return "Si";
	if (["false", "no", "0"].includes(normalized)) return "No";
	return text;
}

function findMacroColumnId(
	columns: MacroCertificateColumn[],
	options: { sourceFieldKeys?: string[]; labels?: string[] },
): string | null {
	const wantedSourceKeys = new Set(
		(options.sourceFieldKeys ?? []).map((key) => normalizeMacroColumnKey(key))
	);
	const wantedLabels = new Set((options.labels ?? []).map((label) => normalizeMacroColumnKey(label)));

	for (const column of columns) {
		const sourceKey = normalizeMacroColumnKey(column.sourceFieldKey);
		if (sourceKey && wantedSourceKeys.has(sourceKey)) return column.id;
	}

	for (const column of columns) {
		const labelKey = normalizeMacroColumnKey(column.label);
		if (labelKey && wantedLabels.has(labelKey)) return column.id;
	}

	return null;
}

function buildCobradoLookupByCertificateNumber(
	macroData: MacroCertificateData,
): Map<string, string> {
	if (!macroData) return new Map();
	const certificateColumnId = findMacroColumnId(macroData.columns, {
		sourceFieldKeys: CERTIFICATE_NUMBER_KEYS,
		labels: ["n certificado", "numero certificado", "certificado"],
	});
	const cobradoColumnId = findMacroColumnId(macroData.columns, {
		sourceFieldKeys: ["cobrado"],
		labels: ["cobrado"],
	});

	if (!certificateColumnId || !cobradoColumnId) {
		return new Map();
	}

	const lookup = new Map<string, string>();
	for (const row of macroData.rows) {
		const key = normalizeCertificateLookupValue(row[certificateColumnId]);
		if (!key) continue;
		const cobrado = formatCobradoValue(row[cobradoColumnId]);
		if (!cobrado) continue;
		lookup.set(key, cobrado);
	}
	return lookup;
}

function normalizeCertificateRecordKey(value: string): string {
	return value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");
}

function findRecordValueByCandidates(
	record: Record<string, unknown>,
	keys: string[],
	tokenGroups: string[][] = [],
): unknown {
	for (const key of keys) {
		if (key in record) return record[key];
	}

	const normalizedEntries = Object.entries(record).map(([key, value]) => [
		normalizeCertificateRecordKey(key),
		value,
	] as const);
	const normalizedCandidates = new Set(keys.map((key) => normalizeCertificateRecordKey(key)));

	for (const [key, value] of normalizedEntries) {
		if (normalizedCandidates.has(key)) return value;
	}

	for (const [key, value] of normalizedEntries) {
		if (
			tokenGroups.some((tokens) => tokens.every((token) => key.includes(normalizeCertificateRecordKey(token))))
		) {
			return value;
		}
	}

	return null;
}

function findDisplayValueByCandidates(
	record: Record<string, unknown>,
	keys: string[],
	tokenGroups: string[][] = [],
): string {
	const raw = findRecordValueByCandidates(record, keys, tokenGroups);
	if (raw == null) return "";
	const text = String(raw).trim();
	return text;
}

function formatCertificateAmount(value: unknown): string | null {
	if (value == null) return null;
	if (typeof value === "number" && Number.isFinite(value)) {
		return formatCurrency(value);
	}

	const text = String(value).trim();
	if (!text) return null;

	const normalized = text.replace(/[^\d,.-]/g, "");
	if (!normalized) return text;

	const lastComma = normalized.lastIndexOf(",");
	const lastDot = normalized.lastIndexOf(".");
	const parsed =
		lastComma > lastDot
			? Number(normalized.replace(/\./g, "").replace(",", "."))
			: Number(normalized.replace(/,/g, ""));

	return Number.isFinite(parsed) ? formatCurrency(parsed) : text;
}

function normalizeExtractedCertificateRows(
	rows: TablaDataRow[],
	certificadoContableMacro: MacroCertificateData,
): ObraCertificateSummary[] {
	const cobradoByCertificateNumber = buildCobradoLookupByCertificateNumber(certificadoContableMacro);
	return rows
		.map((row, index) => {
			const entry = isPlainRecord(row.data) ? row.data : {};
			const certificateNumber = findDisplayValueByCandidates(entry, CERTIFICATE_NUMBER_KEYS, [
				["certificado"],
				["cert", "numero"],
				["cert", "nro"],
			]);
			const expedienteNumber = findDisplayValueByCandidates(entry, CERTIFICATE_EXPEDIENTE_KEYS, [
				["expediente"],
				["exp", "numero"],
				["exp", "nro"],
			]);
			const location = findDisplayValueByCandidates(entry, CERTIFICATE_LOCATION_KEYS, [
				["ubicacion"],
				["location"],
			]);
			const period =
				findDisplayValueByCandidates(entry, CERTIFICATE_PERIOD_KEYS, [
					["periodo"],
					["fecha", "cert"],
					["mes"],
				]) || null;
			const cobrado =
				cobradoByCertificateNumber.get(
					normalizeCertificateLookupValue(certificateNumber)
				) ?? null;
			const amount = formatCertificateAmount(
				findRecordValueByCandidates(entry, CERTIFICATE_AMOUNT_KEYS, [
					["monto", "cert"],
					["monto", "acumul"],
					["importe"],
					["total"],
				]),
			);
			const hasVisibleData = Boolean(
				certificateNumber || expedienteNumber || location || period || cobrado || amount,
			);

			if (!hasVisibleData) return null;

			return {
				id: row.id || `obra-cert-ocr-${index}`,
				certificateNumber,
				expedienteNumber,
				location,
				period,
				amount,
				cobrado,
			};
		})
		.filter((entry): entry is ObraCertificateSummary => entry !== null);
}

function CertificatesSummaryCard({
	certificates,
}: {
	certificates: ObraCertificateSummary[];
}) {
	return (
		<ShellCard
			title="Certificados"
			icon={FileText}
			action={
				<span className="text-[11px] font-semibold uppercase tracking-wide text-[#f97316]">
					{certificates.length} {certificates.length === 1 ? "registro" : "registros"}
				</span>
			}
		>
			<div className="overflow-x-auto rounded-xl border border-[#f0f0f0] bg-[#fcfcfc]">
				<table className="min-w-full text-sm">
					<thead className="bg-[#f8f8f8]">
						<tr className="border-b border-[#f0f0f0] text-left">
							<th className="px-4 py-3 font-semibold text-[#777]">N° certificado</th>
							<th className="px-4 py-3 font-semibold text-[#777]">N° expediente</th>
							<th className="px-4 py-3 font-semibold text-[#777]">Ubicación exte.</th>
							<th className="px-4 py-3 font-semibold text-[#777]">Período</th>
							<th className="px-4 py-3 font-semibold text-[#777]">Monto</th>
							<th className="px-4 py-3 font-semibold text-[#777]">Cobrado</th>
						</tr>
					</thead>
					<tbody>
						{certificates.map((certificate) => (
							<tr
								key={certificate.id}
								className="border-b border-[#f0f0f0] last:border-b-0"
							>
								<td className="px-4 py-3 font-medium text-[#1a1a1a]">
									{certificate.certificateNumber || "Sin dato"}
								</td>
								<td className="px-4 py-3 text-[#1a1a1a]">
									{certificate.expedienteNumber || "Sin dato"}
								</td>
								<td className="px-4 py-3 text-[#1a1a1a]">
									{certificate.location || "Sin dato"}
								</td>
								<td className="px-4 py-3 text-[#1a1a1a]">
									{certificate.period || "Sin dato"}
								</td>
								<td className="px-4 py-3 text-[#1a1a1a]">
									{certificate.amount || "Sin dato"}
								</td>
								<td className="px-4 py-3">
									{certificate.cobrado ? (
										<span className="rounded-full bg-[#fff7ed] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#f97316]">
											{certificate.cobrado}
										</span>
									) : (
										<span className="text-[#999]">Sin dato</span>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</ShellCard>
	);
}

function GeneralInfoCard({
	values,
	isFieldDirty,
	className,
}: {
	values: Pick<
		Obra,
		| "designacionYUbicacion"
		| "entidadContratante"
		| "mesBasicoDeContrato"
		| "iniciacion"
		| "n"
		| "supDeObraM2"
	>;
	isFieldDirty: (field: keyof Obra) => boolean;
	className?: string;
}) {
	return (
		<ShellCard title="Información General" icon={Landmark} className={className}>
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<MiniField
					icon={MapPin}
					label="Designación y ubicación"
					value={values.designacionYUbicacion || "No especificado"}
					highlighted={isFieldDirty("designacionYUbicacion")}
				/>
				<MiniField
					icon={Building2}
					label="Entidad contratante"
					value={values.entidadContratante || "No especificado"}
					highlighted={isFieldDirty("entidadContratante")}
				/>
				<MiniField
					icon={Calendar}
					label="Mes básico"
					value={values.mesBasicoDeContrato || "No especificado"}
					highlighted={isFieldDirty("mesBasicoDeContrato")}
				/>
				<MiniField
					icon={Calendar}
					label="Iniciación"
					value={values.iniciacion || "No especificado"}
					highlighted={isFieldDirty("iniciacion")}
				/>
				<MiniField
					icon={Hash}
					label="N° de obra"
					value={`#${values.n ?? 0}`}
					highlighted={isFieldDirty("n")}
				/>
				<MiniField
					icon={Ruler}
					label="Superficie"
					value={`${formatNumber(values.supDeObraM2, " m²")}`}
					highlighted={isFieldDirty("supDeObraM2")}
				/>
			</div>
		</ShellCard>
	);
}

export const AdvanceCurveChart = ({
	points,
}: {
	points: ReportCurvePoint[];
}) => {
	if (points.length === 0) {
		return (
			<div className="rounded border border-dashed p-4 text-xs text-muted-foreground">
				No hay puntos de curva para graficar todavía.
			</div>
		);
	}

	const toPct100 = (value: number | null): number | null => {
		if (value == null || !Number.isFinite(value)) return null;
		return Math.abs(value) <= 1 ? value * 100 : value;
	};

	const normalizedPoints = points.map((point) => ({
		...point,
		planPct: toPct100(point.planPct),
		realPct: toPct100(point.realPct),
	}));

	const hasRealData = normalizedPoints.some((point) => point.realPct != null);
	const yMax = Math.max(
		100,
		...normalizedPoints.flatMap((point) => [point.planPct ?? 0, point.realPct ?? 0])
	);
	const chartData = normalizedPoints.map((point, index) => ({
		x: point.sortOrder,
		idx: index,
		label: point.label,
		planPct: point.planPct,
		realPct: point.realPct,
		missingReal: hasRealData && point.realPct == null,
	}));
	const now = new Date();
	const currentMonthOrder = now.getFullYear() * 12 + now.getMonth();
	const minX = Math.min(...chartData.map((d) => d.x));
	const maxX = Math.max(...chartData.map((d) => d.x));
	const markerX =
		Number.isFinite(currentMonthOrder)
			? Math.max(minX, Math.min(maxX, currentMonthOrder))
			: null;
	const timelineLabel = (() => {
		if (markerX == null) return null;
		const year = Math.floor(markerX / 12);
		const month = (markerX % 12) + 1;
		return `Hoy · ${periodLabel(`${year}-${String(month).padStart(2, "0")}`)}`;
	})();

	const yTicks = [0, 25, 50, 75, 100].filter((tick) => tick <= yMax || tick === 100);
	const labelStep = chartData.length > 12 ? Math.ceil(chartData.length / 12) : 1;
	const xTicks = chartData
		.filter((_, index) => index % labelStep === 0 || index === chartData.length - 1)
		.map((point) => point.x);
	const labelByX = new Map(chartData.map((point) => [point.x, point.label] as const));
	const pointByX = new Map(chartData.map((point) => [point.x, point] as const));
	const formatTooltipValue = (value: number | null | undefined, emptyLabel: string) =>
		value == null ? emptyLabel : `${Number(value).toFixed(2)}%`;
	const renderTooltip = ({
		active,
		label,
	}: {
		active?: boolean;
		label?: string | number;
	}) => {
		if (!active) return null;
		const x = Number(label);
		if (!Number.isFinite(x)) return null;
		const point = pointByX.get(x);
		if (!point) return null;

		return (
			<div className="min-w-[170px] rounded-md border border-[#d9d9d9] bg-white px-4 py-3 text-sm shadow-sm">
				<div className="mb-2 font-medium text-[#1a1a1a]">{point.label}</div>
				<div className="space-y-2">
					<div className="flex items-center justify-between gap-3">
						<span className="text-sky-500">Curva Plan</span>
						<span className="font-medium text-sky-500">
							{formatTooltipValue(point.planPct, "Sin dato")}
						</span>
					</div>
					<div className="flex items-center justify-between gap-3">
						<span className="text-[#ff5800]">PMC Resumen</span>
						<span className="font-medium text-[#ff5800]">
							{formatTooltipValue(point.realPct, "Sin certificado")}
						</span>
					</div>
				</div>
			</div>
		);
	};

	return (
		<div className="space-y-2 pt-4 ">
			<div className="rounded-md border bg-stone-50 p-2">
				<div className="h-[240px] w-full pt-5 pb-2 px-3">
					<ResponsiveContainer width="100%" height="100%">
						<LineChart
							data={chartData}
							margin={{ top: 12, right: 16, bottom: 30, left: 0 }}
						>
							<CartesianGrid stroke="currentColor" className="text-muted/30" vertical={false} />
							<XAxis
								dataKey="x"
								type="number"
								domain={[minX, maxX > minX ? maxX : minX + 1]}
								ticks={xTicks}
								tickLine={false}
								axisLine={false}
								tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
								tickFormatter={(value) => labelByX.get(Number(value)) ?? ""}
							/>
							<YAxis
								width={40}
								domain={[0, Math.ceil(yMax)]}
								ticks={yTicks}
								axisLine={false}
								tickLine={false}
								tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
								tickFormatter={(value) => `${value}%`}
							/>
							<Tooltip content={renderTooltip} />
							{chartData
								.filter((point) => point.missingReal)
								.map((point) => (
									<ReferenceArea
										key={`missing-real-${point.x}`}
										x1={point.x - 0.5}
										x2={point.x + 0.5}
										ifOverflow="extendDomain"
										fill="#ffedd5"
										fillOpacity={0.85}
										strokeOpacity={0}
									/>
								))}
							{markerX != null ? (
								<ReferenceLine
									x={markerX}
									stroke="#f59e0b"
									strokeWidth={1.5}
									strokeDasharray="5 4"
									label={
										timelineLabel
											? {
												value: timelineLabel,
												position: "top",
												fill: "#d97706",
												fontSize: 10,
											}
											: undefined
									}
								/>
							) : null}
							<Line
								type="monotone"
								dataKey="planPct"
								name="planPct"
								stroke="#0ea5e9"
								strokeWidth={2.5}
								strokeDasharray="6 4"
								dot={{ r: 3 }}
								isAnimationActive={false}
							/>
							<Line
								type="monotone"
								dataKey="realPct"
								name="realPct"
								stroke="#ff5800"
								strokeWidth={2.5}
								dot={{ r: 3 }}
								isAnimationActive={false}
							/>
						</LineChart>
					</ResponsiveContainer>
				</div>
				<div className="-mt-5 ml-4 flex flex-wrap items-center gap-4 text-xs">
					<div className="flex items-center gap-2">
						<span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
						<span className="text-muted-foreground">Curva Plan (avance acumulado)</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="h-2.5 w-2.5 rounded-full bg-[#ff5800]" />
						<span className="text-muted-foreground">PMC Resumen (avance físico acumulado)</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="h-0.5 w-3 bg-amber-500" />
						<span className="text-muted-foreground">Hoy (tiempo transcurrido)</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="h-2.5 w-3 rounded-sm bg-[#ffedd5]" />
						<span className="text-muted-foreground">Mes sin certificados</span>
					</div>
				</div>
			</div>
		</div>
	);
};

export function ObraGeneralTab({
	form,
	isGeneralTabEditMode,
	hasUnsavedChanges,
	onSave,
	isSaving,
	isFieldDirty,
	applyObraToForm,
	initialFormValues,
	getErrorMessage,
	quickActionsAllData,
	reportsData,
	mainTableColumns = [],
	mainTableColumnValues = {},
	setCustomMainColumnValue,
	certificadosExtraidosRows = [],
	certificadoContableMacro = null,
	curveImportConfig,
	derivedCertificadosNotice = null,
}: GeneralTabProps) {
	const extraMainTableColumns = mainTableColumns.filter((column) => {
		if (column.kind === "custom") return true;
		const sourceId = column.baseColumnId ?? column.id;
		return !STATIC_GENERAL_FIELD_IDS.has(sourceId) && !STATIC_GENERAL_FIELD_IDS.has(column.id);
	});
	const obraCertificates = normalizeExtractedCertificateRows(
		certificadosExtraidosRows,
		certificadoContableMacro,
	);
	const hasCertificates = obraCertificates.length > 0;
	const derivedFieldSet = new Set(derivedCertificadosNotice?.updatedFieldKeys ?? []);
	const blockedDerivedFieldSet = new Set(derivedCertificadosNotice?.blockedFieldKeys ?? []);
	const isDerivedFieldHighlighted = (
		field: "certificadoALaFecha" | "saldoACertificar" | "porcentaje"
	) => derivedFieldSet.has(field);
	const isDerivedFieldBlocked = (
		field: "saldoACertificar" | "porcentaje"
	) => blockedDerivedFieldSet.has(field);
	const isContratoBlockingDerived = blockedDerivedFieldSet.size > 0;

	return (
		<TabsContent value="general" className="space-y-6 pt-4">
			{isGeneralTabEditMode ? (
				<>
					<motion.form
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.4 }}
						className="space-y-5 rounded-2xl bg-[#f5f5f5] p-4 sm:p-5"
						onSubmit={(event) => {
							event.preventDefault();
							event.stopPropagation();
							form.handleSubmit();
						}}
					>
						{derivedCertificadosNotice ? (
							<motion.div
								initial={{ opacity: 0, y: 12 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.05 }}
								className="rounded-2xl border border-[#f7b26a] bg-[#fffaf5] p-4 text-[#7a4b13]"
							>
								<div className="flex items-start gap-3">
									<div className="mt-0.5 rounded-full bg-[#fff1df] p-2 text-[#f97316]">
										<AlertCircle className="h-4 w-4" />
									</div>
									<div className="space-y-1.5">
										<p className="text-sm font-semibold">
											Actualizamos valores desde Certificados Extraidos · PMC Resumen
										</p>
										<p className="text-sm leading-6">
											{derivedCertificadosNotice.updatedFieldLabels.length > 0
												? (
													<>
														Se recalcularon {derivedCertificadosNotice.updatedFieldLabels.join(", ")} usando el
														monto acumulado del ultimo certificado detectado
														{derivedCertificadosNotice.sourceLabel
															? ` (${derivedCertificadosNotice.sourceLabel})`
															: ""}.
													</>
												)
												: "Detectamos cambios en certificados extraídos que impactan los cálculos de esta obra."}
										</p>
										<p className="text-sm leading-6 text-[#9a6a31]">
											Por eso la obra quedo con cambios sin guardar: revisa los importes y
											guarda para confirmar la actualizacion en la ficha principal.
										</p>
										{derivedCertificadosNotice.warningMessage ? (
											<p className="text-sm leading-6 font-medium text-[#b45309]">
												{derivedCertificadosNotice.warningMessage}
											</p>
										) : null}
									</div>
								</div>
							</motion.div>
						) : null}
						<div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
							<motion.div
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								transition={{ delay: 0.1 }}
								className="lg:col-span-4"
							>
								<ShellCard
									title="Avance"
									icon={Percent}
									action={
										<span className="text-[11px] font-semibold uppercase tracking-wide text-[#f97316]">
											Progreso
										</span>
									}
									className="h-full"
								>
									<form.Field name="porcentaje">
										{(field: any) => (
											<div className="flex h-full flex-col gap-4">
												<div className="mx-auto w-full max-w-[240px] sm:max-w-none">
													<CircularProgress value={Number(field.state.value) ?? 0} />
												</div>
												<div
													className={cn(
														"rounded-lg border border-[#f0f0f0] p-3",
														(isDerivedFieldHighlighted("porcentaje") || isDerivedFieldBlocked("porcentaje")) &&
														"border-[#f7b26a] bg-[#fffaf5]"
													)}
												>
													<p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">
														Editar avance
													</p>
													<Input
														type="number"
														step="0.01"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														className={cn(
															SURFACE_INPUT_CLASS,
															"text-right",
															(isDerivedFieldHighlighted("porcentaje") || isDerivedFieldBlocked("porcentaje")) &&
															"border-[#f7b26a] bg-white"
														)}
													/>
													{getErrorMessage(field.state.meta.errors) && (
														<p className="mt-2 text-xs text-red-500">
															{getErrorMessage(field.state.meta.errors)}
														</p>
													)}
													{isDerivedFieldBlocked("porcentaje") && derivedCertificadosNotice?.warningMessage ? (
														<p className="mt-2 text-xs text-[#b45309]">
															{derivedCertificadosNotice.warningMessage}
														</p>
													) : null}
												</div>
											</div>
										)}
									</form.Field>
								</ShellCard>
							</motion.div>

							<motion.section
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.25 }}
								className="lg:col-span-8"
							>
								<ShellCard title="Información General" icon={Landmark} className="h-full">
									<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
										<form.Field name="designacionYUbicacion">
											{(field: any) => (
												<div className="sm:col-span-2">
													<label className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
														<MapPin className="h-3.5 w-3.5" />
														Designación y ubicación
													</label>
													<Input
														type="text"
														value={field.state.value}
														onChange={(e) => field.handleChange(e.target.value)}
														onBlur={field.handleBlur}
														className={SURFACE_INPUT_CLASS}
														placeholder="Describe la ubicación y características principales de la obra..."
													/>
													{getErrorMessage(field.state.meta.errors) && (
														<p className="mt-2 text-xs text-red-500">
															{getErrorMessage(field.state.meta.errors)}
														</p>
													)}
												</div>
											)}
										</form.Field>
										<form.Field name="entidadContratante">
											{(field: any) => (
												<div>
													<label className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
														<Building2 className="h-3.5 w-3.5" />
														Entidad contratante
													</label>
													<Input
														type="text"
														value={field.state.value}
														onChange={(e) => field.handleChange(e.target.value)}
														onBlur={field.handleBlur}
														className={SURFACE_INPUT_CLASS}
														placeholder="Nombre de la entidad"
													/>
												</div>
											)}
										</form.Field>
										<form.Field name="mesBasicoDeContrato">
											{(field: any) => (
												<div>
													<label className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
														<Calendar className="h-3.5 w-3.5" />
														Mes básico
													</label>
													<Input
														type="text"
														value={field.state.value}
														onChange={(e) => field.handleChange(e.target.value)}
														onBlur={field.handleBlur}
														className={SURFACE_INPUT_CLASS}
													/>
												</div>
											)}
										</form.Field>
										<form.Field name="iniciacion">
											{(field: any) => (
												<div>
													<label className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
														<Calendar className="h-3.5 w-3.5" />
														Iniciación
													</label>
													<Input
														type="text"
														value={field.state.value}
														onChange={(e) => field.handleChange(e.target.value)}
														onBlur={field.handleBlur}
														className={SURFACE_INPUT_CLASS}
													/>
												</div>
											)}
										</form.Field>
										<form.Field name="n">
											{(field: any) => (
												<div>
													<label className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
														<Hash className="h-3.5 w-3.5" />
														N° de obra
													</label>
													<Input
														type="number"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														className={SURFACE_INPUT_CLASS}
													/>
												</div>
											)}
										</form.Field>
										<form.Field name="supDeObraM2">
											{(field: any) => (
												<div>
													<label className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
														<Ruler className="h-3.5 w-3.5" />
														Superficie
													</label>
													<Input
														type="number"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														className={SURFACE_INPUT_CLASS}
													/>
												</div>
											)}
										</form.Field>
									</div>
								</ShellCard>
							</motion.section>
						</div>

						<motion.section
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.3 }}
						>
							<ShellCard title="Datos Financieros" icon={BadgeDollarSign}>
								<div className="space-y-5">
									<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
										<form.Field name="contratoMasAmpliaciones">
											{(field: any) => (
												<div className={cn(
													"rounded-xl p-2 transition-colors",
													isContratoBlockingDerived && "border border-[#f7b26a] bg-[#fffaf5]"
												)}>
													<label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
														Contrato + ampliaciones
													</label>
													<Input
														type="number"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														className={cn(
															SURFACE_INPUT_CLASS,
															"text-right font-mono",
															isContratoBlockingDerived && "border-[#f7b26a] bg-white"
														)}
														placeholder="0.00"
													/>
													{derivedCertificadosNotice?.warningMessage ? (
														<p className="mt-2 text-xs text-[#b45309]">
															{derivedCertificadosNotice.warningMessage}
														</p>
													) : null}
												</div>
											)}
										</form.Field>
										<form.Field name="certificadoALaFecha">
											{(field: any) => (
												<div className={cn(
													"rounded-xl p-2 transition-colors",
													isDerivedFieldHighlighted("certificadoALaFecha") && "border border-[#f7b26a] bg-[#fffaf5]"
												)}>
													<label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
														Certificado a la fecha
													</label>
													<Input
														type="number"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														className={cn(
															SURFACE_INPUT_CLASS,
															"text-right font-mono",
															isDerivedFieldHighlighted("certificadoALaFecha") &&
															"border-[#f7b26a] bg-white"
														)}
														placeholder="0.00"
													/>
												</div>
											)}
										</form.Field>
										<form.Field name="saldoACertificar">
											{(field: any) => (
												<div className={cn(
													"rounded-xl p-2 transition-colors",
													(isDerivedFieldHighlighted("saldoACertificar") || isDerivedFieldBlocked("saldoACertificar")) &&
													"border border-[#f7b26a] bg-[#fffaf5]"
												)}>
													<label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
														Saldo a certificar
													</label>
													<Input
														type="number"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														className={cn(
															SURFACE_INPUT_CLASS,
															"text-right font-mono",
															(isDerivedFieldHighlighted("saldoACertificar") || isDerivedFieldBlocked("saldoACertificar")) &&
															"border-[#f7b26a] bg-white"
														)}
														placeholder="0.00"
													/>
													{isDerivedFieldBlocked("saldoACertificar") && derivedCertificadosNotice?.warningMessage ? (
														<p className="mt-2 text-xs text-[#b45309]">
															{derivedCertificadosNotice.warningMessage}
														</p>
													) : null}
												</div>
											)}
										</form.Field>
									</div>
									<div className="h-px bg-[#f0f0f0]" />
									<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
										<form.Field name="segunContrato">
											{(field: any) => (
												<div>
													<label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
														Según contrato
													</label>
													<Input
														type="number"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														className={cn(SURFACE_INPUT_CLASS, "text-right")}
													/>
												</div>
											)}
										</form.Field>
										<form.Field name="prorrogasAcordadas">
											{(field: any) => (
												<div>
													<label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
														Prórrogas
													</label>
													<Input
														type="number"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														className={cn(SURFACE_INPUT_CLASS, "text-right")}
													/>
												</div>
											)}
										</form.Field>
										<form.Field name="plazoTotal">
											{(field: any) => (
												<div>
													<label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
														Plazo total
													</label>
													<Input
														type="number"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														className={cn(SURFACE_INPUT_CLASS, "text-right")}
													/>
												</div>
											)}
										</form.Field>
										<form.Field name="plazoTransc">
											{(field: any) => (
												<div>
													<label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
														Transcurrido
													</label>
													<Input
														type="number"
														value={field.state.value}
														onChange={(e) => field.handleChange(Number(e.target.value))}
														onBlur={field.handleBlur}
														className={cn(SURFACE_INPUT_CLASS, "text-right")}
													/>
												</div>
											)}
										</form.Field>
									</div>
								</div>
							</ShellCard>
						</motion.section>

						{extraMainTableColumns.length > 0 ? (
							<motion.section
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.35 }}
							>
								<ShellCard title="Campos Configurados" icon={FileText}>
									<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
										{extraMainTableColumns.map((column) => {
											const rawValue = mainTableColumnValues[column.id];
											const isBooleanType =
												column.cellType === "boolean" ||
												column.cellType === "checkbox" ||
												column.cellType === "toggle";
											const inputType =
												column.cellType === "number" || column.cellType === "currency"
													? "number"
													: column.cellType === "date"
														? "date"
														: "text";

											return (
												<div key={column.id} className="space-y-2">
													<label className="block text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
														{column.label}
													</label>
													{column.kind === "custom" && setCustomMainColumnValue ? (
														<form.Subscribe
															selector={(state: any) =>
																(state.values.customData as Record<string, unknown> | null)?.[
																column.id
																] ?? null
															}
														>
															{(liveValue: any) =>
																isBooleanType ? (
																	<Select
																		value={
																			liveValue === true
																				? "true"
																				: liveValue === false
																					? "false"
																					: "unset"
																		}
																		onValueChange={(value) =>
																			setCustomMainColumnValue(
																				column.id,
																				coerceMainColumnInputValue(value, column.cellType)
																			)
																		}
																	>
																		<SelectTrigger className={SURFACE_INPUT_CLASS}>
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
																		value={String(liveValue ?? "")}
																		onChange={(event) =>
																			setCustomMainColumnValue(
																				column.id,
																				coerceMainColumnInputValue(
																					event.target.value,
																					column.cellType
																				)
																			)
																		}
																		className={SURFACE_INPUT_CLASS}
																	/>
																)
															}
														</form.Subscribe>
													) : (
														<div className="rounded-lg border border-[#f0f0f0] p-3 text-sm text-[#1a1a1a]">
															{formatMainColumnValue(rawValue, column.cellType)}
														</div>
													)}
												</div>
											);
										})}
									</div>
								</ShellCard>
							</motion.section>
						) : null}
					</motion.form>
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.35 }}
						className="sticky bottom-0 left-0 z-10 flex w-full justify-end gap-3 rounded-xl border border-[#e8e8e8] bg-white/95 p-4 backdrop-blur"
					>
						<Button
							variant="outline"
							onClick={() => {
								applyObraToForm(initialFormValues);
							}}
						>
							Cancelar
						</Button>
						<Button
							type="button"
							disabled={!hasUnsavedChanges() || isSaving}
							className="min-w-[140px]"
							onClick={(e) => {
								e.preventDefault();
								void onSave();
							}}
						>
							{isSaving ? "Guardando..." : "Guardar cambios"}
						</Button>
					</motion.div>
				</>
			) : (
				<div className="space-y-5">
					<div className="flex flex-col lg:flex-row gap-4">
						<div className="flex-1 space-y-6 min-w-0">
							<div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
								<motion.div
									initial={{ opacity: 0, scale: 0.95 }}
									animate={{ opacity: 1, scale: 1 }}
									transition={{ delay: 0.1 }}
									className={cn(
										"lg:col-span-4",
										(isFieldDirty("porcentaje") || isDerivedFieldHighlighted("porcentaje") || isDerivedFieldBlocked("porcentaje")) &&
										"rounded-xl"
									)}
								>
									<ShellCard
										title="Avance"
										icon={Percent}
										className={cn(
											"h-full",
											(isFieldDirty("porcentaje") || isDerivedFieldHighlighted("porcentaje") || isDerivedFieldBlocked("porcentaje")) &&
											"border-[#f7b26a] bg-[#fffaf5]"
										)}
										action={
											isFieldDirty("porcentaje") || isDerivedFieldHighlighted("porcentaje") || isDerivedFieldBlocked("porcentaje") ? (
												<span className="text-[11px] font-semibold text-[#f97316]">Sin guardar</span>
											) : (
												<span className="text-[11px] font-semibold uppercase tracking-wide text-[#f97316]">
													Progreso
												</span>
											)
										}
									>
										<div className="flex h-full flex-col items-center gap-4">
											<div className="mx-auto w-full max-w-[240px] sm:max-w-none">
												<CircularProgress value={form.state.values.porcentaje ?? 0} />
											</div>
											<div
												className="w-full rounded-lg border border-[#f0f0f0] p-3"
												data-wizard-target="obra-general-findings"
											>
												<p className="text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">
													Alertas detectadas
												</p>
												{(reportsData?.findings?.length ?? 0) === 0 ? (
													<p className="mt-1.5 text-[13px] text-[#999]">
														No hay alertas abiertas para esta obra.
													</p>
												) : (
													<div className="mt-2 space-y-2">
														{reportsData?.findings.slice(0, 4).map((finding) => {
															const tone =
																finding.severity === "critical"
																	? "border-red-200 bg-red-50 text-red-700"
																	: finding.severity === "warn"
																		? "border-amber-200 bg-amber-50 text-amber-700"
																		: "border-sky-200 bg-sky-50 text-sky-700";
															return (
																<div
																	key={finding.id}
																	className={cn("rounded-md border px-3 py-2", tone)}
																	data-wizard-target={
																		finding.rule_key === "cert.missing_current_month"
																			? "obra-general-missing-current-certificado"
																			: undefined
																	}
																>
																	<div className="flex items-start gap-2">
																		<AlertTriangle className="mt-0.5 h-4 w-4" />
																		<div>
																			<p className="text-sm font-semibold">{finding.title}</p>
																			{finding.message ? (
																				<p className="mt-0.5 text-xs">{finding.message}</p>
																			) : null}
																		</div>
																	</div>
																</div>
															);
														})}
													</div>
												)}
											</div>
										</div>
									</ShellCard>
								</motion.div>

								<motion.section
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.25 }}
									className="lg:col-span-8"
								>
									<ShellCard
										title="Curva de avance"
										icon={LineChartIcon}
										bodyClassName="p-4"
										action={
											<div className="flex items-center gap-3">
												{reportsData?.curve ? (
													<p className="text-[11px] text-[#bbb]">
														{reportsData.curve.planTableName} vs {reportsData.curve.resumenTableName}
													</p>
												) : null}
												{curveImportConfig ? (
													<CurveEditorDialog
														obraId={curveImportConfig.obraId}
														curvaPlanTableId={curveImportConfig.curvaPlanTableId}
														curvaPlanTableName={curveImportConfig.curvaPlanTableName}
														pmcResumenTableId={curveImportConfig.pmcResumenTableId}
														pmcResumenTableName={curveImportConfig.pmcResumenTableName}
														onSaved={curveImportConfig.onImported}
													/>
												) : null}
											</div>
										}
									>
										{reportsData?.curve ? (
											<AdvanceCurveChart points={reportsData.curve.points} />
										) : (
											<div className="flex h-[274px] flex-col rounded-lg border border-dashed border-[#e8e8e8] p-4">
												<div className="rounded-lg border border-[#f0f0f0] px-4 py-3 text-[13px] text-[#bbb]">
													No se detectaron tablas Curva Plan + PMC Resumen con datos suficientes.
												</div>
												<div className="mt-4 flex-1 rounded-lg bg-[linear-gradient(to_right,rgba(240,240,240,0.6)_1px,transparent_1px),linear-gradient(to_bottom,rgba(240,240,240,0.6)_1px,transparent_1px)] bg-[size:24px_24px]" />
											</div>
										)}
									</ShellCard>
								</motion.section>
							</div>

							<div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
								{hasCertificates ? (
									<motion.section
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: 0.32 }}
										className="lg:col-span-6"
									>
										<CertificatesSummaryCard certificates={obraCertificates} />
									</motion.section>
								) : null}
								<motion.section
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.3 }}
									className={cn("lg:col-span-6", !hasCertificates && "lg:order-2")}
								>
									<ShellCard title="Datos Financieros" icon={BadgeDollarSign}>
										<div className="space-y-5">
											<div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
												<KpiItem
													label="Contrato + ampliaciones"
													value={formatCurrency(form.state.values.contratoMasAmpliaciones)}
													highlighted={isContratoBlockingDerived}
												/>
												<KpiItem
													label="Certificado a la fecha"
													value={formatCurrency(form.state.values.certificadoALaFecha)}
													highlighted={isDerivedFieldHighlighted("certificadoALaFecha")}
												/>
												<KpiItem
													label="Saldo a certificar"
													value={formatCurrency(form.state.values.saldoACertificar)}
													highlighted={isDerivedFieldHighlighted("saldoACertificar")}
												/>
											</div>
											<div className="h-px bg-[#f0f0f0]" />
											<div className="space-y-3">
												{/* Contract duration pills */}
												<div className="flex flex-wrap gap-3">
													<MiniField
														icon={FileText}
														label="Según contrato"
														value={`${formatNumber(form.state.values.segunContrato, " meses")}`}
														highlighted={isFieldDirty("segunContrato")}
													/>
													{Number(form.state.values.prorrogasAcordadas) > 0 && (
														<MiniField
															icon={TrendingUp}
															label="Prórrogas"
															value={`+${formatNumber(form.state.values.prorrogasAcordadas, " meses")}`}
															highlighted={isFieldDirty("prorrogasAcordadas")}
														/>
													)}
													{(() => {
														const total = Number(form.state.values.plazoTotal ?? 0);
														const elapsed = Number(form.state.values.plazoTransc ?? 0);
														const pct = total > 0 ? Math.min(100, (elapsed / total) * 100) : 0;
														const remaining = Math.max(0, total - elapsed);
														const isDirty = isFieldDirty("plazoTotal") || isFieldDirty("plazoTransc");
														return (
															<div className={cn(
																"rounded-lg border border-[#f0f0f0] p-3.5 flex flex-col flex-1",
																isDirty && "border-[#f7b26a] bg-[#fff7ed]"
															)}>
																<div className="mb-2.5 flex items-center justify-between">
																	<div className="flex items-center gap-1.5 text-[11px] text-[#aaa]">
																		<Calendar className="size-3.5" />
																		<span>Plazo de obra</span>
																	</div>
																	<span className="text-[12px] font-semibold tabular-nums text-[#1a1a1a]">
																		{formatNumber(elapsed)}{" "}
																		<span className="font-normal text-[#aaa]">/ {formatNumber(total)} meses</span>
																	</span>
																</div>
																<div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[#f0f0f0]">
																	<motion.div
																		className="absolute inset-y-0 left-0 rounded-full"
																		style={{ backgroundColor: "var(--color-orange-primary)", opacity: 0.8 }}
																		initial={{ width: "0%" }}
																		animate={{ width: `${pct}%` }}
																		transition={{ type: "spring", stiffness: 120, damping: 20 }}
																	/>
																</div>
																<div className="mt-2 flex items-center justify-between">
																	<span className="text-[11px] font-medium" style={{ color: "var(--color-orange-primary)" }}>
																		{formatNumber(elapsed)} meses transcurridos
																	</span>
																	{remaining > 0 && (
																		<span className="text-[11px] text-[#aaa]">{formatNumber(remaining)} restantes</span>
																	)}
																</div>
															</div>
														);
													})()}
												</div>
												{/* Plazo timeline progress card */}
											</div>
										</div>
									</ShellCard>
								</motion.section>
								{!hasCertificates ? (
									<motion.section
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: 0.32 }}
										className="lg:col-span-6 lg:order-1"
									>
										<GeneralInfoCard
											values={form.state.values}
											isFieldDirty={isFieldDirty}
											className="h-full"
										/>
									</motion.section>
								) : null}

							</div>
							<motion.section
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.28 }}
								className={cn("lg:col-span-12", !hasCertificates && "hidden")}
							>
								<ShellCard title="Información General" icon={Landmark}>
									<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
										<MiniField
											icon={MapPin}
											label="Designación y ubicación"
											value={form.state.values.designacionYUbicacion || "No especificado"}
											highlighted={isFieldDirty("designacionYUbicacion")}
										/>
										<MiniField
											icon={Building2}
											label="Entidad contratante"
											value={form.state.values.entidadContratante || "No especificado"}
											highlighted={isFieldDirty("entidadContratante")}
										/>
										<MiniField
											icon={Calendar}
											label="Mes básico"
											value={form.state.values.mesBasicoDeContrato || "No especificado"}
											highlighted={isFieldDirty("mesBasicoDeContrato")}
										/>
										<MiniField
											icon={Calendar}
											label="Iniciación"
											value={form.state.values.iniciacion || "No especificado"}
											highlighted={isFieldDirty("iniciacion")}
										/>
										<MiniField
											icon={Hash}
											label="N° de obra"
											value={`#${form.state.values.n ?? 0}`}
											highlighted={isFieldDirty("n")}
										/>
										<MiniField
											icon={Ruler}
											label="Superficie"
											value={`${formatNumber(form.state.values.supDeObraM2, " m²")}`}
											highlighted={isFieldDirty("supDeObraM2")}
										/>
									</div>
								</ShellCard>
							</motion.section>


							{extraMainTableColumns.length > 0 ? (
								<motion.section
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.34 }}
								>
									<ShellCard title="Campos Configurados" icon={FileText}>
										<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
											{extraMainTableColumns.map((column) => (
												<MiniField
													key={column.id}
													icon={FileText}
													label={column.label}
													value={formatMainColumnValue(
														mainTableColumnValues[column.id],
														column.cellType
													)}
												/>
											))}
										</div>
									</ShellCard>
								</motion.section>
							) : null}

							{hasUnsavedChanges() && (
								<motion.div
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.4 }}
									className="sticky bottom-0 left-0 z-10 flex flex-col items-end gap-3 rounded-xl border border-[#f7b26a] bg-[#fffaf5]/95 p-4 backdrop-blur"
								>
									<div className="flex items-center gap-2 text-orange-primary">
										<AlertCircle className="h-5 w-5" />
										<p className="text-sm font-semibold">Tenés cambios sin guardar</p>
									</div>
									{derivedCertificadosNotice ? (
										<p className="max-w-xl text-right text-sm text-[#9a6a31]">
											Parte de estos cambios viene de la tabla <span className="font-medium">Certificados Extraidos · PMC Resumen</span>.
											{derivedCertificadosNotice.updatedFieldLabels.length > 0 ? (
												<>
													Recalculamos {derivedCertificadosNotice.updatedFieldLabels.join(", ")}
													{derivedCertificadosNotice.sourceLabel
														? ` a partir del ultimo certificado detectado (${derivedCertificadosNotice.sourceLabel})`
														: " a partir del ultimo certificado detectado"}
													, pero hace falta que guardes para persistirlo.
												</>
											) : (
												<>Detectamos certificados nuevos, pero todavía faltan datos para terminar algunos cálculos.</>
											)}
										</p>
									) : null}
									{derivedCertificadosNotice?.warningMessage ? (
										<p className="max-w-xl text-right text-sm font-medium text-[#b45309]">
											{derivedCertificadosNotice.warningMessage}
										</p>
									) : null}
									<div className="flex gap-3 justify-end">
										<Button
											variant="outline"
											onClick={() => {
												applyObraToForm(initialFormValues);
											}}
										>
											Descartar cambios
										</Button>
										<Button
											onClick={(e) => {
												e.preventDefault();
												void onSave();
											}}
											disabled={!hasUnsavedChanges() || isSaving}
											className="gap-2"
										>
											{isSaving ? (
												<>
													<svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
														<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
														<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
													</svg>
													Guardando...
												</>
											) : (
												<>
													<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
													Guardar cambios
												</>
											)}
										</Button>
									</div>
								</motion.div>
							)}
						</div>

						{quickActionsAllData && (
							<QuickActionsPanel
								obraId={quickActionsAllData.obraId}
								actions={quickActionsAllData.quickActions}
								folders={quickActionsAllData.folders}
								tablas={quickActionsAllData.tablas}
								customStepRenderers={quickActionsAllData.customStepRenderers}
							/>
						)}
					</div>
				</div>
			)}
		</TabsContent>
	);
}
