'use client';

import { useCallback } from "react";
import {
	BooleanConditionFilter,
	DateConditionFilter,
	FilterSection,
	NumberConditionFilter,
	TextConditionFilter,
	createDateFilterValue,
	createNumberFilterValue,
	createTextFilterValue,
	type BooleanFilterCondition,
	type DateFilterValue,
	type NumberFilterValue,
	type TextFilterValue,
} from "@/components/form-table/filter-components";
import { Building2, CalendarDays, DollarSign, ToggleLeft, Type } from "lucide-react";
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

export type CertificadosFilters = {
	monto: NumberFilterValue;
	ente: TextFilterValue;
	facturado: BooleanFilterCondition;
	cobrado: BooleanFilterCondition;
	concepto: TextFilterValue;
	fechaFacturacion: DateFilterValue;
	fechaPago: DateFilterValue;
	vencimiento: DateFilterValue;
};

const defaultFilters = (): CertificadosFilters => ({
	monto: createNumberFilterValue("between"),
	ente: createTextFilterValue("contains"),
	facturado: "all",
	cobrado: "all",
	concepto: createTextFilterValue("contains"),
	fechaFacturacion: createDateFilterValue("between"),
	fechaPago: createDateFilterValue("between"),
	vencimiento: createDateFilterValue("between"),
});

const toggleMatches = (value: boolean, filter: BooleanFilterCondition) => {
	if (filter === "all") return true;
	return filter === "yes" ? value : !value;
};

const normalize = (value: string) =>
	value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();

const isBlank = (value: unknown) => String(value ?? "").trim().length === 0;

const textMatches = (value: string | null | undefined, filter: TextFilterValue) => {
	const cell = String(value ?? "");
	const target = filter.value.trim();
	if (filter.condition === "empty") return isBlank(cell);
	if (filter.condition === "not_empty") return !isBlank(cell);
	if (!target) return true;
	const normalizedCell = normalize(cell);
	const normalizedTarget = normalize(target);
	switch (filter.condition) {
		case "not_contains":
			return !normalizedCell.includes(normalizedTarget);
		case "equals":
			return normalizedCell === normalizedTarget;
		case "starts_with":
			return normalizedCell.startsWith(normalizedTarget);
		case "ends_with":
			return normalizedCell.endsWith(normalizedTarget);
		case "contains":
		default:
			return normalizedCell.includes(normalizedTarget);
	}
};

const parseDateAtStartOfDay = (value: string | null | undefined) => {
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	date.setHours(0, 0, 0, 0);
	return date.getTime();
};

const addDays = (date: Date, days: number) => {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	next.setHours(0, 0, 0, 0);
	return next.getTime();
};

const startOfCurrentWeek = (today: Date) => {
	const next = new Date(today);
	const day = next.getDay();
	const diff = day === 0 ? -6 : 1 - day;
	next.setDate(next.getDate() + diff);
	next.setHours(0, 0, 0, 0);
	return next.getTime();
};

const endOfCurrentWeek = (today: Date) => addDays(new Date(startOfCurrentWeek(today)), 6);

const dateMatches = (value: string | null | undefined, filter: DateFilterValue) => {
	const cell = parseDateAtStartOfDay(value);
	const todayDate = new Date();
	todayDate.setHours(0, 0, 0, 0);
	const today = todayDate.getTime();
	if (filter.condition === "empty") return cell == null;
	if (filter.condition === "not_empty") return cell != null;
	if (cell == null) return false;

	const single = parseDateAtStartOfDay(filter.value);
	const start = parseDateAtStartOfDay(filter.start);
	const end = parseDateAtStartOfDay(filter.end);
	const cellDate = new Date(cell);

	switch (filter.condition) {
		case "equals":
			return single == null ? true : cell === single;
		case "before":
			return single == null ? true : cell < single;
		case "after":
			return single == null ? true : cell > single;
		case "between":
			if (start != null && cell < start) return false;
			if (end != null && cell > end) return false;
			return true;
		case "from_until_today":
			return single == null ? true : cell >= single && cell <= today;
		case "until":
			return single == null ? true : cell <= single;
		case "today":
			return cell === today;
		case "this_week":
			return cell >= startOfCurrentWeek(todayDate) && cell <= endOfCurrentWeek(todayDate);
		case "this_month":
			return cellDate.getFullYear() === todayDate.getFullYear() && cellDate.getMonth() === todayDate.getMonth();
		case "this_year":
			return cellDate.getFullYear() === todayDate.getFullYear();
		case "last_7_days":
			return cell >= addDays(todayDate, -7) && cell <= today;
		case "last_30_days":
			return cell >= addDays(todayDate, -30) && cell <= today;
		case "next_7_days":
			return cell >= today && cell <= addDays(todayDate, 7);
		case "next_30_days":
			return cell >= today && cell <= addDays(todayDate, 30);
		case "overdue":
			return cell < today;
		case "not_overdue":
			return cell >= today;
		default:
			return true;
	}
};

const numberMatches = (value: number | null | undefined, filter: NumberFilterValue) => {
	if (filter.condition === "empty") return value == null || Number.isNaN(Number(value));
	if (filter.condition === "not_empty") return value != null && !Number.isNaN(Number(value));
	const numericValue = Number(value);
	if (Number.isNaN(numericValue)) return false;
	const single = Number(filter.value);
	const min = Number(filter.min);
	const max = Number(filter.max);
	switch (filter.condition) {
		case "equals":
			return filter.value ? numericValue === single : true;
		case "gt":
			return filter.value ? numericValue > single : true;
		case "gte":
			return filter.value ? numericValue >= single : true;
		case "lt":
			return filter.value ? numericValue < single : true;
		case "lte":
			return filter.value ? numericValue <= single : true;
		case "between":
			if (filter.min && !Number.isNaN(min) && numericValue < min) return false;
			if (filter.max && !Number.isNaN(max) && numericValue > max) return false;
			return true;
		default:
			return true;
	}
};

const applyFilters = (row: CertificadoRow, filters: CertificadosFilters) => {
	return (
		numberMatches(row.monto, filters.monto) &&
		textMatches(row.ente, filters.ente) &&
		toggleMatches(Boolean(row.facturado), filters.facturado) &&
		toggleMatches(Boolean(row.cobrado), filters.cobrado) &&
		textMatches(row.concepto, filters.concepto) &&
		dateMatches(row.fecha_facturacion, filters.fechaFacturacion) &&
		dateMatches(row.vencimiento, filters.vencimiento) &&
		dateMatches(row.fecha_pago, filters.fechaPago)
	);
};

const textFilterIsActive = (filter: TextFilterValue) =>
	filter.condition === "empty" ||
	filter.condition === "not_empty" ||
	filter.value.trim().length > 0;

const numberFilterIsActive = (filter: NumberFilterValue) =>
	filter.condition === "empty" ||
	filter.condition === "not_empty" ||
	(filter.condition === "between"
		? filter.min.trim().length > 0 || filter.max.trim().length > 0
		: filter.value.trim().length > 0);

const dateFilterIsActive = (filter: DateFilterValue) =>
	[
		"today",
		"this_week",
		"this_month",
		"this_year",
		"last_7_days",
		"last_30_days",
		"next_7_days",
		"next_30_days",
		"overdue",
		"not_overdue",
		"empty",
		"not_empty",
	].includes(filter.condition) ||
	(filter.condition === "between"
		? filter.start.trim().length > 0 || filter.end.trim().length > 0
		: filter.value.trim().length > 0);

const countActiveFilters = (filters: CertificadosFilters) => {
	let count = 0;
	if (numberFilterIsActive(filters.monto)) count += 1;
	if (textFilterIsActive(filters.ente)) count += 1;
	if (filters.facturado !== "all") count += 1;
	if (filters.cobrado !== "all") count += 1;
	if (textFilterIsActive(filters.concepto)) count += 1;
	if (dateFilterIsActive(filters.fechaFacturacion)) count += 1;
	if (dateFilterIsActive(filters.vencimiento)) count += 1;
	if (dateFilterIsActive(filters.fechaPago)) count += 1;
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

function FiltersContent({ filters, onChange }: FilterRendererProps<CertificadosFilters>) {
	const update = useCallback(
		(key: keyof CertificadosFilters, value: CertificadosFilters[keyof CertificadosFilters]) => {
			onChange((prev) => ({ ...prev, [key]: value }));
		},
		[onChange]
	);

	const montoActive = numberFilterIsActive(filters.monto) ? 1 : 0;
	const enteActive = textFilterIsActive(filters.ente) ? 1 : 0;
	const estadoActive = [filters.facturado, filters.cobrado].filter((v) => v !== "all").length;
	const fechasActive = [
		filters.fechaFacturacion,
		filters.vencimiento,
		filters.fechaPago,
	].filter(dateFilterIsActive).length;
	const conceptoActive = textFilterIsActive(filters.concepto) ? 1 : 0;

	return (
		<div className="space-y-3">
			<FilterSection title="Monto certificado" icon={DollarSign} activeCount={montoActive} defaultOpen>
				<NumberConditionFilter
					label="Monto"
					value={filters.monto}
					onChange={(value) => update("monto", value)}
					onClear={() => update("monto", createNumberFilterValue("between"))}
					placeholder="1000000"
				/>
			</FilterSection>

			<FilterSection title="Ente contratante" icon={Building2} activeCount={enteActive} defaultOpen>
				<TextConditionFilter
					label="Ente contratante"
					value={filters.ente}
					onChange={(value) => update("ente", value)}
					onClear={() => update("ente", createTextFilterValue("contains"))}
					placeholder="Buscar ente..."
				/>
			</FilterSection>

			<FilterSection title="Estado" icon={ToggleLeft} activeCount={estadoActive} defaultOpen>
				<div className="space-y-3">
					<BooleanConditionFilter
						label="Facturado"
						value={filters.facturado}
						onChange={(value) => update("facturado", value)}
						onClear={() => update("facturado", "all")}
					/>
					<BooleanConditionFilter
						label="Cobrado"
						value={filters.cobrado}
						onChange={(value) => update("cobrado", value)}
						onClear={() => update("cobrado", "all")}
					/>
				</div>
			</FilterSection>

			<FilterSection title="Fechas" icon={CalendarDays} activeCount={fechasActive} defaultOpen>
				<div className="space-y-3">
					<DateConditionFilter
						label="Fecha facturacion"
						value={filters.fechaFacturacion}
						onChange={(value) => update("fechaFacturacion", value)}
						onClear={() => update("fechaFacturacion", createDateFilterValue("between"))}
					/>
					<DateConditionFilter
						label="Vencimiento"
						value={filters.vencimiento}
						onChange={(value) => update("vencimiento", value)}
						onClear={() => update("vencimiento", createDateFilterValue("between"))}
					/>
					<DateConditionFilter
						label="Fecha pago"
						value={filters.fechaPago}
						onChange={(value) => update("fechaPago", value)}
						onClear={() => update("fechaPago", createDateFilterValue("between"))}
					/>
				</div>
			</FilterSection>

			<FilterSection title="Concepto" icon={Type} activeCount={conceptoActive} defaultOpen>
				<TextConditionFilter
					label="Concepto"
					value={filters.concepto}
					onChange={(value) => update("concepto", value)}
					onClear={() => update("concepto", createTextFilterValue("contains"))}
					placeholder="Buscar concepto..."
				/>
			</FilterSection>
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
