'use client';

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormTableConfig, FormTableRow, FilterRendererProps, FetchRowsArgs, FetchRowsResult, SaveRowsArgs } from "../types";

export type CertificadoRow = FormTableRow & {
	obraId: string;
	obraName: string;
	ente: string;
	n_exp: string;
	n_certificado: number;
	monto: number;
	mes: string;
	estado: string;
	facturado: boolean;
	fecha_facturacion: string | null;
	nro_factura: string | null;
	concepto: string | null;
	cobrado: boolean;
	observaciones: string | null;
	vencimiento: string | null;
	fecha_pago: string | null;
};

type ToggleFilter = "all" | "si" | "no";

export type CertificadosFilters = {
	montoMin: string;
	montoMax: string;
	enteContains: string;
	facturado: ToggleFilter;
	cobrado: ToggleFilter;
	conceptoContains: string;
	fechaFacturacionMin: string;
	fechaFacturacionMax: string;
	fechaPagoMin: string;
	fechaPagoMax: string;
	vencimientoMin: string;
	vencimientoMax: string;
};

const defaultFilters = (): CertificadosFilters => ({
	montoMin: "",
	montoMax: "",
	enteContains: "",
	facturado: "all",
	cobrado: "all",
	conceptoContains: "",
	fechaFacturacionMin: "",
	fechaFacturacionMax: "",
	fechaPagoMin: "",
	fechaPagoMax: "",
	vencimientoMin: "",
	vencimientoMax: "",
});

const toggleMatches = (value: boolean, filter: ToggleFilter) => {
	if (filter === "all") return true;
	return filter === "si" ? value : !value;
};

const normalize = (value: string) =>
	value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();

const textIncludes = (value: string | null | undefined, needle: string) => {
	if (!needle.trim()) return true;
	const target = normalize(needle);
	return normalize(String(value ?? "")).includes(target);
};

const rangeMatches = (value: string | null | undefined, min: string, max: string) => {
	if (!min && !max) return true;
	if (!value) return false;
	const ts = new Date(value).getTime();
	if (Number.isNaN(ts)) return false;
	if (min) {
		const tsMin = new Date(min).getTime();
		if (!Number.isNaN(tsMin) && ts < tsMin) return false;
	}
	if (max) {
		const tsMax = new Date(max).getTime();
		if (!Number.isNaN(tsMax) && ts > tsMax) return false;
	}
	return true;
};

const amountMatches = (value: number, min: string, max: string) => {
	const parsedMin = Number(min);
	const parsedMax = Number(max);
	if (!min && !max) return true;
	if (min && !Number.isNaN(parsedMin) && value < parsedMin) return false;
	if (max && !Number.isNaN(parsedMax) && value > parsedMax) return false;
	return true;
};

const applyFilters = (row: CertificadoRow, filters: CertificadosFilters) => {
	return (
		amountMatches(row.monto, filters.montoMin, filters.montoMax) &&
		textIncludes(row.ente, filters.enteContains) &&
		toggleMatches(Boolean(row.facturado), filters.facturado) &&
		toggleMatches(Boolean(row.cobrado), filters.cobrado) &&
		textIncludes(row.concepto, filters.conceptoContains) &&
		rangeMatches(row.fecha_facturacion, filters.fechaFacturacionMin, filters.fechaFacturacionMax) &&
		rangeMatches(row.vencimiento, filters.vencimientoMin, filters.vencimientoMax) &&
		rangeMatches(row.fecha_pago, filters.fechaPagoMin, filters.fechaPagoMax)
	);
};

const countActiveFilters = (filters: CertificadosFilters) => {
	let count = 0;
	if (filters.montoMin) count += 1;
	if (filters.montoMax) count += 1;
	if (filters.enteContains.trim()) count += 1;
	if (filters.facturado !== "all") count += 1;
	if (filters.cobrado !== "all") count += 1;
	if (filters.conceptoContains.trim()) count += 1;
	if (filters.fechaFacturacionMin) count += 1;
	if (filters.fechaFacturacionMax) count += 1;
	if (filters.vencimientoMin) count += 1;
	if (filters.vencimientoMax) count += 1;
	if (filters.fechaPagoMin) count += 1;
	if (filters.fechaPagoMax) count += 1;
	return count;
};

const MAX_FETCH_LIMIT = 2000;

async function fetchCertificados({ search }: FetchRowsArgs<CertificadosFilters>): Promise<FetchRowsResult<CertificadoRow>> {
	const params = new URLSearchParams();
	params.set("page", "1");
	params.set("limit", String(MAX_FETCH_LIMIT));
	if (search?.trim()) {
		params.set("q", search.trim());
	}

	const response = await fetch(`/api/certificados?${params.toString()}`, { cache: "no-store" });
	if (!response.ok) {
		const message = await response.json().catch(() => ({}));
		throw new Error(message?.error ?? "No se pudieron cargar los certificados");
	}
	const data = await response.json();
	const rows = Array.isArray(data.certificados) ? (data.certificados as CertificadoRow[]) : [];
	return {
		rows,
		pagination: data.pagination,
	};
}

const MUTABLE_FIELDS: Array<keyof CertificadoRow> = [
	"facturado",
	"fecha_facturacion",
	"nro_factura",
	"concepto",
	"cobrado",
	"observaciones",
	"vencimiento",
	"fecha_pago",
];

const toPayload = (row: CertificadoRow) => {
	const payload: Record<string, unknown> = {};
	for (const field of MUTABLE_FIELDS) {
		const value = row[field];
		if (typeof value === "boolean") {
			payload[field] = value;
		} else if (value === "" || typeof value === "undefined") {
			payload[field] = null;
		} else {
			payload[field] = value;
		}
	}
	return payload;
};

async function saveCertificados({ dirtyRows, deletedRowIds }: SaveRowsArgs<CertificadoRow>) {
	const updates = dirtyRows.map(async (row) => {
		const payload = toPayload(row);
		const res = await fetch(`/api/certificados/${row.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			throw new Error(body?.error ?? "No se pudo actualizar el certificado");
		}
	});

	const deletions = deletedRowIds
		.filter((id) => id && !id.startsWith("temp-") && !id.startsWith("import-"))
		.map(async (id) => {
			const res = await fetch(`/api/certificados/${id}`, { method: "DELETE" });
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body?.error ?? "No se pudo eliminar el certificado");
			}
		});

	await Promise.all([...updates, ...deletions]);
}

function ToggleGroup({
	label,
	value,
	onChange,
}: {
	label: string;
	value: ToggleFilter;
	onChange: (next: ToggleFilter) => void;
}) {
	const handleClick = useCallback(
		(next: ToggleFilter) => () => {
			onChange(next);
		},
		[onChange]
	);
	return (
		<div className="space-y-2">
			<p className="text-xs font-medium text-muted-foreground">{label}</p>
			<div className="flex gap-2">
				{(["all", "si", "no"] as ToggleFilter[]).map((option) => (
					<Button
						key={option}
						type="button"
						variant={value === option ? "default" : "outline"}
						size="sm"
						className="flex-1"
						onClick={handleClick(option)}
					>
						{option === "all" ? "Todos" : option === "si" ? "Sí" : "No"}
					</Button>
				))}
			</div>
		</div>
	);
}

function FiltersContent({ filters, onChange }: FilterRendererProps<CertificadosFilters>) {
	const update = useCallback(
		(key: keyof CertificadosFilters, value: CertificadosFilters[keyof CertificadosFilters]) => {
			onChange((prev) => ({ ...prev, [key]: value }));
		},
		[onChange]
	);

	return (
		<div className="space-y-5">
			<div className="rounded-lg border p-4 space-y-3">
				<p className="text-sm font-semibold">Monto certificado</p>
				<div className="flex items-center gap-2">
					<Input
						type="number"
						placeholder="Mínimo"
						value={filters.montoMin}
						onChange={(event) => update("montoMin", event.target.value)}
					/>
					<span className="text-muted-foreground">a</span>
					<Input
						type="number"
						placeholder="Máximo"
						value={filters.montoMax}
						onChange={(event) => update("montoMax", event.target.value)}
					/>
				</div>
			</div>

			<div className="rounded-lg border p-4 space-y-3">
				<p className="text-sm font-semibold">Ente contratante</p>
				<Input
					placeholder="Contiene..."
					value={filters.enteContains}
					onChange={(event) => update("enteContains", event.target.value)}
				/>
			</div>

			<div className="rounded-lg border p-4 space-y-4">
				<ToggleGroup label="Facturado" value={filters.facturado} onChange={(value) => update("facturado", value)} />
				<ToggleGroup label="Cobrado" value={filters.cobrado} onChange={(value) => update("cobrado", value)} />
			</div>

			<div className="rounded-lg border p-4 space-y-3">
				<p className="text-sm font-semibold">Fechas</p>
				<div className="space-y-3">
					<div className="space-y-1">
						<p className="text-xs text-muted-foreground uppercase">Facturación</p>
						<div className="flex items-center gap-2">
							<Input
								type="date"
								value={filters.fechaFacturacionMin}
								onChange={(event) => update("fechaFacturacionMin", event.target.value)}
							/>
							<span className="text-muted-foreground">a</span>
							<Input
								type="date"
								value={filters.fechaFacturacionMax}
								onChange={(event) => update("fechaFacturacionMax", event.target.value)}
							/>
						</div>
					</div>
					<div className="space-y-1">
						<p className="text-xs text-muted-foreground uppercase">Vencimiento</p>
						<div className="flex items-center gap-2">
							<Input
								type="date"
								value={filters.vencimientoMin}
								onChange={(event) => update("vencimientoMin", event.target.value)}
							/>
							<span className="text-muted-foreground">a</span>
							<Input
								type="date"
								value={filters.vencimientoMax}
								onChange={(event) => update("vencimientoMax", event.target.value)}
							/>
						</div>
					</div>
					<div className="space-y-1">
						<p className="text-xs text-muted-foreground uppercase">Fecha de pago</p>
						<div className="flex items-center gap-2">
							<Input
								type="date"
								value={filters.fechaPagoMin}
								onChange={(event) => update("fechaPagoMin", event.target.value)}
							/>
							<span className="text-muted-foreground">a</span>
							<Input
								type="date"
								value={filters.fechaPagoMax}
								onChange={(event) => update("fechaPagoMax", event.target.value)}
							/>
						</div>
					</div>
				</div>
			</div>

			<div className="rounded-lg border p-4 space-y-3">
				<p className="text-sm font-semibold">Concepto</p>
				<Input
					placeholder="Contiene..."
					value={filters.conceptoContains}
					onChange={(event) => update("conceptoContains", event.target.value)}
				/>
			</div>
		</div>
	);
}

export const certificadosConfig: FormTableConfig<CertificadoRow, CertificadosFilters> = {
	tableId: "certificados-form-table",
	title: "Certificados por obra",
	description: "Gestioná y editá todos los certificados en una sola vista.",
	searchPlaceholder: "Buscar certificados...",
	defaultPageSize: 25,
	columns: [
		{
			id: "obraName",
			label: "Obra",
			field: "obraName",
			enableHide: false,
		},
		{
			id: "ente",
			label: "Ente",
			field: "ente",
		},
		{
			id: "facturado",
			label: "Facturado",
			field: "facturado",
			cellType: "checkbox",
			editable: true,
		},
		{
			id: "fecha_facturacion",
			label: "Fecha facturación",
			field: "fecha_facturacion",
			cellType: "date",
			editable: true,
		},
		{
			id: "nro_factura",
			label: "N° factura",
			field: "nro_factura",
			editable: true,
		},
		{
			id: "monto",
			label: "Monto",
			field: "monto",
			cellType: "currency",
			editable: false,
			cellConfig: {
				currencyCode: "ARS",
				currencyLocale: "es-AR",
			},
		},
		{
			id: "concepto",
			label: "Concepto",
			field: "concepto",
			editable: true,
		},
		{
			id: "cobrado",
			label: "Cobrado",
			field: "cobrado",
			cellType: "checkbox",
			editable: true,
		},
		{
			id: "n_exp",
			label: "N° expediente",
			field: "n_exp",
			editable: false,
		},
		{
			id: "observaciones",
			label: "Observaciones",
			field: "observaciones",
			editable: true,
		},
		{
			id: "vencimiento",
			label: "Vencimiento",
			field: "vencimiento",
			cellType: "date",
			editable: true,
		},
		{
			id: "fecha_pago",
			label: "Fecha pago",
			field: "fecha_pago",
			cellType: "date",
			editable: true,
		},
	],
	createFilters: defaultFilters,
	renderFilters: (props) => <FiltersContent {...props} />,
	applyFilters,
	countActiveFilters,
	fetchRows: fetchCertificados,
	onSave: saveCertificados,
	emptyStateMessage: "No encontramos certificados para los filtros aplicados.",
	showInlineSearch: true,
	showActionsColumn: false,
	allowAddRows: false,
};
`use client`;
