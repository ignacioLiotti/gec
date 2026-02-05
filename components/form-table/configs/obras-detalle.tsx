'use client';

import type { ReactNode } from "react";
import { memo } from "react";
import {
	FormTableConfig,
	ColumnDef,
	TabFilterOption,
	HeaderGroup,
	FormTableRow,
	SaveRowsArgs,
} from "@/components/form-table/types";
import { requiredValidator } from "@/components/form-table/form-table";
import { FilterSection, RangeInputGroup } from "@/components/form-table/filter-components";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
		onFinishFirstMessage: null,
		onFinishSecondMessage: null,
		onFinishSecondSendAt: null,
	};
};

const mapDetailRowToPayload = (row: ObrasDetalleRow, index: number): Obra => {
	const parsedN = toNumber(row.n);
	const normalizedN =
		Number.isFinite(parsedN) && parsedN >= 1 ? Math.trunc(parsedN) : index + 1;
	return {
		id: typeof row.id === "string" ? row.id : undefined,
		n: normalizedN,
		designacionYUbicacion: sanitizeText(row.designacionYUbicacion),
		supDeObraM2: toNumber(row.supDeObraM2),
		entidadContratante: sanitizeText(row.entidadContratante),
		mesBasicoDeContrato: sanitizeText(row.mesBasicoDeContrato),
		iniciacion: sanitizeText(row.iniciacion),
		contratoMasAmpliaciones: toNumber(row.contratoMasAmpliaciones),
		certificadoALaFecha: toNumber(row.certificadoALaFecha),
		saldoACertificar: toNumber(row.saldoACertificar),
		segunContrato: toNumber(row.segunContrato),
		prorrogasAcordadas: toNumber(row.prorrogasAcordadas),
		plazoTotal: toNumber(row.plazoTotal),
		plazoTransc: toNumber(row.plazoTransc),
		porcentaje: clampPercentage(row.porcentaje),
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
		width: 50,
		enableResize: false,
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
	},
	{
		id: "certificadoALaFecha",
		label: "Certificado a la Fecha",
		field: "certificadoALaFecha",
		enableHide: true,
		enablePin: false,
		cellType: "currency",
		cellConfig: {
			currencyCode: "ARS",
			currencyLocale: "es-AR",
		},
		sortFn: (a, b) => toNumber(a.certificadoALaFecha) - toNumber(b.certificadoALaFecha),
		searchFn: (row, query) => String(row.certificadoALaFecha ?? "").includes(query),
		defaultValue: null,
	},
	{
		id: "saldoACertificar",
		label: "Saldo a Certificar",
		field: "saldoACertificar",
		enableHide: true,
		enablePin: false,
		cellType: "currency",
		cellConfig: {
			currencyCode: "ARS",
			currencyLocale: "es-AR",
		},
		sortFn: (a, b) => toNumber(a.saldoACertificar) - toNumber(b.saldoACertificar),
		searchFn: (row, query) => String(row.saldoACertificar ?? "").includes(query),
		defaultValue: null,
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
	},
];

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
	if (!matchesRange(row.certificadoALaFecha, filters.cafMin, filters.cafMax)) return false;
	if (!matchesRange(row.saldoACertificar, filters.sacMin, filters.sacMax)) return false;
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
	onFinishFirstMessage?: string | null;
	onFinishSecondMessage?: string | null;
	onFinishSecondSendAt?: string | null;
};

function mapObraToDetailRow(obra: ObrasDetalleApiRow): ObrasDetalleRow {
	return {
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
		onFinishFirstMessage: obra.onFinishFirstMessage ?? null,
		onFinishSecondMessage: obra.onFinishSecondMessage ?? null,
		onFinishSecondSendAt: obra.onFinishSecondSendAt ?? null,
	};
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

export const obrasDetalleConfig: FormTableConfig<ObrasDetalleRow, DetailAdvancedFilters> = {
	tableId: "form-table-obras-detalle",
	title: "Obras detalle",
	description: "Gestione el dataset de obras con filtros avanzados y edición en línea.",
	columns,
	headerGroups,
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
