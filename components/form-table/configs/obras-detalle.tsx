'use client';

import type { ReactNode } from "react";
import {
	FormTableConfig,
	ColumnDef,
	TabFilterOption,
	HeaderGroup,
	FormTableRow,
	requiredValidator,
} from "@/components/form-table/form-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

export type ObrasDetalleRow = FormTableRow & {
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
};

const columns: ColumnDef<ObrasDetalleRow>[] = [
	{
		id: "n",
		label: "N°",
		field: "n",
		required: true,
		enableHide: false,
		enablePin: true,
		cellType: "text",
		sortFn: (a, b) => (a.n ?? 0) - (b.n ?? 0),
		searchFn: (row, query) => String(row.n ?? "").includes(query),
		validators: {
			onBlur: requiredValidator("N°"),
		},
		defaultValue: null,
	},
	{
		id: "designacionYUbicacion",
		label: "Designación y Ubicación",
		field: "designacionYUbicacion",
		required: true,
		enableHide: true,
		enablePin: true,
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
	},
	{
		id: "supDeObraM2",
		label: "Sup. de Obra (m²)",
		field: "supDeObraM2",
		enableHide: true,
		enablePin: false,
		cellType: "text",
		sortFn: (a, b) => (a.supDeObraM2 ?? 0) - (b.supDeObraM2 ?? 0),
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
		sortFn: (a, b) => (a.contratoMasAmpliaciones ?? 0) - (b.contratoMasAmpliaciones ?? 0),
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
		sortFn: (a, b) => (a.certificadoALaFecha ?? 0) - (b.certificadoALaFecha ?? 0),
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
		sortFn: (a, b) => (a.saldoACertificar ?? 0) - (b.saldoACertificar ?? 0),
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
		sortFn: (a, b) => (a.segunContrato ?? 0) - (b.segunContrato ?? 0),
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
		sortFn: (a, b) => (a.prorrogasAcordadas ?? 0) - (b.prorrogasAcordadas ?? 0),
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
		sortFn: (a, b) => (a.plazoTotal ?? 0) - (b.plazoTotal ?? 0),
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
		sortFn: (a, b) => (a.plazoTransc ?? 0) - (b.plazoTransc ?? 0),
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
		sortFn: (a, b) => (a.porcentaje ?? 0) - (b.porcentaje ?? 0),
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
	{ id: "in-process", label: "En proceso", predicate: (row) => (row.porcentaje ?? 0) < 100 },
	{ id: "completed", label: "Completadas", predicate: (row) => (row.porcentaje ?? 0) >= 100 },
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
	const handleRangeChange = (key: keyof DetailAdvancedFilters, value: string) => {
		onChange((prev) => ({ ...prev, [key]: value }));
	};

	return (
		<div className="space-y-4">
			<div className="grid grid-cols-2 gap-3">
				<div>
					<Label>Sup. mínima (m²)</Label>
					<Input
						value={filters.supMin}
						onChange={(event) => handleRangeChange("supMin", event.target.value)}
						placeholder="Ej: 100"
					/>
				</div>
				<div>
					<Label>Sup. máxima (m²)</Label>
					<Input
						value={filters.supMax}
						onChange={(event) => handleRangeChange("supMax", event.target.value)}
						placeholder="Ej: 1000"
					/>
				</div>
			</div>
			<div className="space-y-2">
				<Label>Entidades (una por línea)</Label>
				<Textarea
					value={filters.entidades.join("\n")}
					onChange={(event) => {
						const values = event.currentTarget.value
							.split(/\r?\n|,/)
							.map((value) => value.trim())
							.filter(Boolean);
						onChange((prev) => ({ ...prev, entidades: values }));
					}}
					placeholder="Municipalidad, Provincia..."
				/>
			</div>
			<div className="grid grid-cols-2 gap-3">
				<div>
					<Label>Mes básico (año exacto)</Label>
					<Input
						value={filters.mesYear}
						onChange={(event) => handleRangeChange("mesYear", event.target.value)}
						placeholder="Ej: 2023"
					/>
				</div>
				<div>
					<Label>Mes básico contiene</Label>
					<Input
						value={filters.mesContains}
						onChange={(event) => handleRangeChange("mesContains", event.target.value)}
						placeholder="Ej: enero"
					/>
				</div>
			</div>
			<div className="grid grid-cols-2 gap-3">
				<div>
					<Label>Iniciación (año)</Label>
					<Input
						value={filters.iniYear}
						onChange={(event) => handleRangeChange("iniYear", event.target.value)}
						placeholder="Ej: 2022"
					/>
				</div>
				<div>
					<Label>Iniciación contiene</Label>
					<Input
						value={filters.iniContains}
						onChange={(event) => handleRangeChange("iniContains", event.target.value)}
						placeholder="Ej: marzo"
					/>
				</div>
			</div>
			{[
				["cmaMin", "cmaMax", "Contrato + Ampliaciones"],
				["cafMin", "cafMax", "Certificado a la fecha"],
				["sacMin", "sacMax", "Saldo a certificar"],
				["scMin", "scMax", "Según contrato"],
				["paMin", "paMax", "Prórrogas acordadas"],
				["ptMin", "ptMax", "Plazo total"],
				["ptrMin", "ptrMax", "Plazo total transc."],
			].map(([minKey, maxKey, label]) => (
				<div key={minKey} className="grid grid-cols-2 gap-3">
					<div>
						<Label>{label} (mín)</Label>
						<Input
							value={(filters as Record<string, string>)[minKey]}
							onChange={(event) =>
								handleRangeChange(minKey as keyof DetailAdvancedFilters, event.target.value)
							}
							placeholder="0"
						/>
					</div>
					<div>
						<Label>{label} (máx)</Label>
						<Input
							value={(filters as Record<string, string>)[maxKey]}
							onChange={(event) =>
								handleRangeChange(maxKey as keyof DetailAdvancedFilters, event.target.value)
							}
							placeholder="0"
						/>
					</div>
				</div>
			))}
		</div>
	);
};

const applyFilters = (row: ObrasDetalleRow, filters: DetailAdvancedFilters) => {
	const matchesRange = (value: number | null | undefined, minStr: string, maxStr: string) => {
		const min = minStr ? Number(minStr) : null;
		const max = maxStr ? Number(maxStr) : null;
		if (min != null && (value == null || value < min)) return false;
		if (max != null && (value == null || value > max)) return false;
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
	};
}

const fetchObrasDetalle: FormTableConfig<ObrasDetalleRow, DetailAdvancedFilters>["fetchRows"] =
	async ({ page, limit }) => {
		const params = new URLSearchParams({
			page: String(page),
			limit: String(limit),
			status: "in-process",
		});
		const response = await fetch(`/api/obras?${params.toString()}`, {
			cache: "no-store",
		});
		if (!response.ok) {
			const text = await response.text();
			throw new Error(text || "No se pudieron obtener las obras");
		}
		const payload = await response.json();
		const detalle = Array.isArray(payload.detalleObras)
			? (payload.detalleObras as ObrasDetalleApiRow[])
			: [];
		return {
			rows: detalle.map(mapObraToDetailRow),
			pagination: payload.pagination ?? undefined,
		};
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
	createFilters,
	renderFilters,
	applyFilters,
	countActiveFilters,
	fetchRows: fetchObrasDetalle,
};
