'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import type { AnyFormState } from "@tanstack/form-core";
import {
	useReactTable,
	getCoreRowModel,
	ColumnDef as TanStackColumnDef,
	flexRender,
	VisibilityState,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Sheet,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
	ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Textarea } from "@/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ColumnResizer, balanceTableColumns } from "@/components/ui/column-resizer";
import { ColumnVisibilityMenu } from "@/components/data-table/column-visibility-menu";
import { format as formatDate } from "date-fns";
import {
	ExternalLink,
	Filter,
	Search as SearchIcon,
	ArrowUp,
	ArrowDown,
	ArrowUpDown,
	Minus,
	Loader2,
	ChevronLeft,
	ChevronRight,
} from "lucide-react";

type TableRow = {
	id: string;
	field1?: string;
	field2?: string;
	field3?: string;
	field4?: string;
	field5?: boolean;
	field6?: number | null;
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

type FormValues = {
	rowOrder: string[];
	rowsById: Record<string, TableRow>;
};

type FormFieldComponent = (props: {
	name: string;
	children: (field: any) => ReactNode;
	validators?: FieldValidators;
}) => JSX.Element;

type RenderCellArgs = {
	column: ColumnDef;
	row: TableRow;
	rowId: string;
	FieldComponent: FormFieldComponent;
	highlightQuery: string;
	isCellDirty: boolean;
	isRowDirty: boolean;
	onCopyCell: (value: unknown) => void;
	onCopyColumn: () => void;
	onCopyRow: () => void;
	onClearValue?: () => void;
	onRestoreValue?: () => void;
	canRestore?: boolean;
	customMenuItems?: ColumnDef["cellMenuItems"];
};

type SortState = {
	columnId: string | null;
	direction: "asc" | "desc";
};

type SimpleAdvancedFilters = {
	status: "any" | "activo" | "inactivo" | "pendiente";
	hasUrl: boolean;
	tagIncludes: string;
	minPrice: string;
	maxPrice: string;
};

type DetailAdvancedFilters = {
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

type DataSourceMode = "demo" | "obras" | "obrasDetail";

type ServerPaginationMeta = {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
};

type CellType =
	| 'text'
	| 'number'
	| 'currency'
	| 'date'
	| 'boolean'
	| 'checkbox'
	| 'toggle'
	| 'tags'
	| 'link'
	| 'avatar'
	| 'image'
	| 'icon'
	| 'text-icon'
	| 'badge';

type CellConfig = {
	// Boolean/Checkbox/Toggle
	onToggle?: (value: boolean, row: TableRow) => void;

	// Currency
	currencyCode?: string;
	currencyLocale?: string;

	// Date
	dateFormat?: 'short' | 'medium' | 'long' | 'custom';
	customDateFormat?: string;

	// Tags
	tagVariant?: 'default' | 'secondary' | 'outline' | 'destructive';
	tagSeparator?: string; // How to split string into tags (e.g., ",")

	// Link
	href?: string | ((row: TableRow) => string);
	target?: '_blank' | '_self';

	// Avatar
	avatarFallback?: string | ((row: TableRow) => string);

	// Icon
	iconName?: string | ((row: TableRow) => string);
	iconClassName?: string;

	// Text + Icon
	iconPosition?: 'left' | 'right';

	// Badge
	badgeVariant?: 'default' | 'secondary' | 'outline' | 'destructive';
	badgeMap?: Record<string, { label: string; variant: string }>;
};

type FieldValidators = {
	onChange?: (value: unknown) => string | undefined;
	onBlur?: (value: unknown) => string | undefined;
};

type ColumnDef = {
	id: string;
	label: string;
	field: keyof Omit<TableRow, 'id'>;
	required?: boolean;
	enableHide?: boolean;
	enablePin?: boolean;
	editable?: boolean;
	cellType?: CellType;
	cellConfig?: CellConfig;
	sortFn?: (a: TableRow, b: TableRow) => number;
	searchFn?: (row: TableRow, query: string) => boolean;
	validators?: FieldValidators;
	cellMenuItems?: Array<{
		id: string;
		label: string;
		onSelect?: (row: TableRow) => void;
	}>;
	defaultValue?: unknown;
};

type HeaderGroup = {
	id: string;
	label: string;
	columns: string[]; // column IDs in this group
	className?: string;
};

const DEMO_COLUMNS: ColumnDef[] = [
	{
		id: "field1",
		label: "Nombre (Text)",
		field: "field1",
		required: true,
		enableHide: false,
		enablePin: true,
		cellType: 'text',
		sortFn: (a, b) => a.field1.localeCompare(b.field1, "es", { sensitivity: "base" }),
		searchFn: (row, query) => row.field1.toLowerCase().includes(query),
		validators: {
			onBlur: requiredValidator("Nombre (Text)"),
		},
		defaultValue: "",
	},
	{
		id: "field2",
		label: "URL (Link)",
		field: "field2",
		required: true,
		enableHide: false,
		enablePin: true,
		cellType: 'link',
		cellConfig: {
			href: (row) => row.field2 || '#',
			target: '_blank',
		},
		sortFn: (a, b) => (a.field2 || "").localeCompare(b.field2 || "", "es", { sensitivity: "base" }),
		searchFn: (row, query) => (row.field2 || "").toLowerCase().includes(query),
		validators: {
			onBlur: requiredValidator("URL (Link)"),
		},
		defaultValue: "",
	},
	{
		id: "field3",
		label: "Tags",
		field: "field3",
		required: false,
		enableHide: true,
		enablePin: true,
		cellType: 'tags',
		cellConfig: {
			tagSeparator: ',',
			tagVariant: 'secondary',
		},
		sortFn: (a, b) => (a.field3 || "").localeCompare(b.field3 || "", "es", { sensitivity: "base" }),
		searchFn: (row, query) => (row.field3 || "").toLowerCase().includes(query),
		defaultValue: "",
	},
	{
		id: "field4",
		label: "Estado (Badge)",
		field: "field4",
		required: false,
		enableHide: true,
		enablePin: true,
		cellType: 'badge',
		cellConfig: {
			badgeMap: {
				'activo': { label: 'Activo', variant: 'default' },
				'inactivo': { label: 'Inactivo', variant: 'secondary' },
				'pendiente': { label: 'Pendiente', variant: 'outline' },
			},
		},
		sortFn: (a, b) => (a.field4 || "").localeCompare(b.field4 || "", "es", { sensitivity: "base" }),
		searchFn: (row, query) => (row.field4 || "").toLowerCase().includes(query),
		defaultValue: "",
	},
	{
		id: "field5",
		label: "Completado (Toggle)",
		field: "field5",
		required: false,
		enableHide: true,
		enablePin: true,
		cellType: 'boolean',
		sortFn: (a, b) => Number(a.field5) - Number(b.field5),
		searchFn: (row, query) => {
			const label = row.field5 ? "si true completado" : "no false pendiente";
			return label.includes(query);
		},
		defaultValue: false,
	},
	{
		id: "field6",
		label: "Precio (Currency)",
		field: "field6",
		required: false,
		enableHide: true,
		enablePin: false,
		cellType: 'currency',
		cellConfig: {
			currencyCode: 'USD',
			currencyLocale: 'es-AR',
		},
		sortFn: (a, b) => (a.field6 ?? 0) - (b.field6 ?? 0),
		searchFn: (row, query) => String(row.field6 ?? "").includes(query),
		defaultValue: null,
	},
];

// Only group some columns - field1, field2, field5, field6 are NOT grouped
const headerGroups: HeaderGroup[] = [
	{
		id: "group-metadata",
		label: "Metadatos",
		columns: ["field3", "field4"],
		className: "bg-blue-50",
	},
];

const DEMO_TAB_FILTERS: TabFilterOption[] = [
	{ id: "all", label: "Todas" },
	{ id: "completed", label: "Completadas", predicate: (row) => row.field5 === true },
	{ id: "pending", label: "Pendientes", predicate: (row) => row.field5 === false },
];

const DETAIL_COLUMNS: ColumnDef[] = [
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
		label: "Sup. de Obra (m2)",
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
		label: "Contrato más Ampliaciones",
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
		label: "Plazo Total Transcurrido",
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
		label: "%",
		field: "porcentaje",
		enableHide: true,
		enablePin: false,
		cellType: "text",
		sortFn: (a, b) => (a.porcentaje ?? 0) - (b.porcentaje ?? 0),
		searchFn: (row, query) => String(row.porcentaje ?? "").includes(query),
		defaultValue: null,
	},
];

const DETAIL_HEADER_GROUPS: HeaderGroup[] = [];

const DETAIL_TAB_FILTERS: TabFilterOption[] = [
	{ id: "all", label: "Todas" },
	{ id: "in-process", label: "En proceso", predicate: (row) => (row.porcentaje ?? 0) < 100 },
	{ id: "completed", label: "Completadas", predicate: (row) => (row.porcentaje ?? 0) >= 100 },
];

type TableConfig = {
	columns: ColumnDef[];
	headerGroups: HeaderGroup[];
	tabFilters: TabFilterOption[];
	searchPlaceholder: string;
};

const TABLE_CONFIGS: Record<DataSourceMode, TableConfig> = {
	demo: {
		columns: DEMO_COLUMNS,
		headerGroups,
		tabFilters: DEMO_TAB_FILTERS,
		searchPlaceholder: "Buscar por nombre, etiquetas o URL...",
	},
	obras: {
		columns: DEMO_COLUMNS,
		headerGroups,
		tabFilters: DEMO_TAB_FILTERS,
		searchPlaceholder: "Buscar obras (campo demo)",
	},
	obrasDetail: {
		columns: DETAIL_COLUMNS,
		headerGroups: DETAIL_HEADER_GROUPS,
		tabFilters: DETAIL_TAB_FILTERS,
		searchPlaceholder: "Buscar en columnas de obras",
	},
};

type TabFilterOption = {
	id: string;
	label: string;
	predicate?: (row: TableRow) => boolean;
	showBadge?: boolean;
};

const tabFilters: TabFilterOption[] = [
	{ id: "all", label: "Todas" },
	{ id: "completed", label: "Completadas", predicate: (row) => row.field5 === true },
	{ id: "pending", label: "Pendientes", predicate: (row) => row.field5 === false },
];

const defaultSimpleAdvancedFilters: SimpleAdvancedFilters = {
	status: "any",
	hasUrl: false,
	tagIncludes: "",
	minPrice: "",
	maxPrice: "",
};

const defaultDetailAdvancedFilters: DetailAdvancedFilters = {
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
};

const DEFAULT_COL_WIDTH = 160;
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];
const DEFAULT_PAGE_SIZE = 10;
const DATA_SOURCE_TABS = [
	{ id: "demo", label: "Datos de Ejemplo" },
	{ id: "obras", label: "Obras (resumen)" },
	{ id: "obrasDetail", label: "Obras Detalle" },
];

const DEMO_ROWS: TableRow[] = [
	{
		id: "demo-1",
		field1: "Edificio Aurora",
		field2: "https://aurora.example.com",
		field3: "Arquitectura, Vivienda",
		field4: "Activo",
		field5: true,
		field6: 1250000,
	},
	{
		id: "demo-2",
		field1: "Parque Central",
		field2: "https://central.example.com",
		field3: "Infraestructura",
		field4: "Pendiente",
		field5: false,
		field6: 890000,
	},
	{
		id: "demo-3",
		field1: "Colegio Horizonte",
		field2: "https://horizonte.example.com",
		field3: "Educación",
		field4: "En proceso",
		field5: false,
		field6: 410000,
	},
	{
		id: "demo-4",
		field1: "Hospital Norte",
		field2: "https://hospitalnorte.example.com",
		field3: "Salud, Emergencias",
		field4: "Activo",
		field5: true,
		field6: 2100000,
	},
	{
		id: "demo-5",
		field1: "Centro Cultural",
		field2: "https://cultural.example.com",
		field3: "Cultura",
		field4: "Planeado",
		field5: false,
		field6: 560000,
	},
];

function createRow(columns: ColumnDef[]): TableRow {
	const hasCrypto =
		typeof crypto !== "undefined" && typeof crypto.randomUUID === "function";
	const row: TableRow = {
		id: hasCrypto ? crypto.randomUUID() : `row-${Date.now()}-${Math.random()}`,
	};
	columns.forEach((column) => {
		if (column.field) {
			const defaultValue = column.defaultValue;
			if (typeof defaultValue !== "undefined") {
				(row as any)[column.field] = defaultValue;
			} else {
				switch (column.cellType) {
					case "boolean":
					case "checkbox":
					case "toggle":
						(row as any)[column.field] = false;
						break;
					case "currency":
					case "number":
						(row as any)[column.field] = 0;
						break;
					default:
						(row as any)[column.field] = "";
				}
			}
		}
	});
	return row;
}

function isValueEmpty(value: unknown) {
	if (value == null) return true;
	if (typeof value === "string") return value.trim() === "";
	return false;
}

function defaultSearchMatcher(value: unknown, query: string) {
	if (!query) return true;
	if (value == null) return false;
	if (typeof value === "string") {
		return value.toLowerCase().includes(query);
	}
	return String(value).toLowerCase().includes(query);
}

function requiredValidator(label: string) {
	return (value: unknown) => (isValueEmpty(value) ? `${label} es obligatorio` : undefined);
}

function shallowEqualValues(a: unknown, b: unknown) {
	if (typeof a === "number" && typeof b === "number") {
		if (Number.isNaN(a) && Number.isNaN(b)) return true;
	}
	return a === b;
}

function getClearedValue(column: ColumnDef) {
	switch (column.cellType) {
		case "boolean":
		case "checkbox":
		case "toggle":
			return false;
		case "number":
		case "currency":
			return null;
		default:
			return "";
	}
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightedText({ text, query }: { text: string; query: string }) {
	if (!query) return <>{text}</>;
	const regex = new RegExp(`(${escapeRegExp(query)})`, "ig");
	const parts = text.split(regex);
	return (
		<>
			{parts.map((part, idx) =>
				part.toLowerCase() === query.toLowerCase() ? (
					<mark key={`${part}-${idx}`} className="bg-yellow-200 px-0.5">
						{part}
					</mark>
				) : (
					<span key={`${part}-${idx}`}>{part}</span>
				)
			)}
		</>
	);
}

function defaultSortByField(field: keyof Omit<TableRow, "id">) {
	return (a: TableRow, b: TableRow) => {
		const valueA = a[field];
		const valueB = b[field];
		if (typeof valueA === "number" && typeof valueB === "number") {
			return valueA - valueB;
		}
		return String(valueA ?? "").localeCompare(String(valueB ?? ""), "es", {
			sensitivity: "base",
			numeric: true,
		});
	};
}

function snapshotValues(
	rowOrder: string[],
	rowsById: Record<string, TableRow>
): FormValues {
	return {
		rowOrder: [...rowOrder],
		rowsById: rowOrder.reduce<Record<string, TableRow>>((acc, id) => {
			const row = rowsById[id];
			if (row) {
				acc[id] = { ...row };
			}
			return acc;
		}, {}),
	};
}

function mapObraToSimpleRow(obra: {
	id: string;
	designacionYUbicacion?: string | null;
	entidadContratante?: string | null;
	mesBasicoDeContrato?: string | null;
	n?: number | null;
	porcentaje?: number | null;
	segunContrato?: number | null;
}): TableRow {
	return {
		id: obra.id,
		field1: obra.designacionYUbicacion ?? "",
		field2: obra.entidadContratante ?? "",
		field3: obra.mesBasicoDeContrato ?? "",
		field4: obra.n != null ? `Obra #${obra.n}` : "Sin número",
		field5: (obra.porcentaje ?? 0) >= 100,
		field6: obra.segunContrato ?? 0,
	};
}

function mapObraToDetailRow(obra: ReturnType<typeof mapDbRowToObra>): TableRow {
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

function tableRowToCsv(row: TableRow, cols: ColumnDef[]) {
	const values = cols.map((col) => {
		const raw = row[col.field];
		if (typeof raw === "boolean") {
			return raw ? "true" : "false";
		}
		return raw ?? "";
	});
	return values
		.map((value) => {
			const safe = String(value ?? "");
			return `"${safe.replace(/"/g, '""')}"`;
		})
		.join(";");
}

async function copyToClipboard(text: string) {
	if (typeof navigator === "undefined" || !navigator.clipboard) {
		console.warn("Clipboard API not available");
		return false;
	}
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch (error) {
		console.error("copyToClipboard error", error);
		return false;
	}
}

function readPersistedArray(key: string): string[] {
	if (typeof window === "undefined") return [];
	try {
		const raw = window.localStorage.getItem(key);
		const parsed = raw ? (JSON.parse(raw) as string[]) : [];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function writePersistedArray(key: string, value: string[]) {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// ignore
	}
}

// Cell renderer function
function renderReadOnlyValue(
	value: unknown,
	row: TableRow,
	column: ColumnDef,
	highlightQuery: string
): ReactNode {
	const cellType = column.cellType || 'text';
	const config = column.cellConfig || {};

	switch (cellType) {
		case 'number':
			return (
				<span className="font-mono tabular-nums">
					{typeof value === 'number' ? value.toLocaleString() : value ?? '-'}
				</span>
			);
		case 'currency': {
			const amount =
				typeof value === 'number'
					? value
					: Number.parseFloat(String(value ?? 0)) || 0;
			const formatted = new Intl.NumberFormat(config.currencyLocale || 'es-AR', {
				style: 'currency',
				currency: config.currencyCode || 'USD',
			}).format(amount);
			return <span className="font-mono tabular-nums">{formatted}</span>;
		}
		case 'date': {
			if (!value) return <span>-</span>;
			const date = new Date(String(value));
			if (Number.isNaN(date.getTime())) return <span>-</span>;
			if (config.dateFormat === 'custom' && config.customDateFormat) {
				try {
					return <span>{formatDate(date, config.customDateFormat)}</span>;
				} catch {
					return <span>{date.toISOString().slice(0, 10)}</span>;
				}
			}
			const options: Intl.DateTimeFormatOptions =
				config.dateFormat === 'short'
					? { dateStyle: 'short' }
					: config.dateFormat === 'long'
						? { dateStyle: 'long' }
						: { dateStyle: 'medium' };
			return <span>{date.toLocaleDateString('es-AR', options)}</span>;
		}
		case 'boolean':
		case 'checkbox':
		case 'toggle': {
			const boolValue = Boolean(value);
			return (
				<span
					className={cn(
						"inline-flex items-center gap-1",
						boolValue ? "text-green-600" : "text-gray-400"
					)}
				>
					{boolValue ? "●" : "○"}
					<span className="text-xs">{boolValue ? "Sí" : "No"}</span>
				</span>
			);
		}
		case 'tags': {
			const tagsStr = String(value || '');
			if (!tagsStr) return <span>-</span>;
			const tags = config.tagSeparator
				? tagsStr.split(config.tagSeparator).map((t) => t.trim()).filter(Boolean)
				: [tagsStr];
			return (
				<div className="flex flex-wrap gap-1">
					{tags.map((tag) => (
						<Badge key={tag} variant={config.tagVariant || 'secondary'}>
							<HighlightedText text={tag} query={highlightQuery} />
						</Badge>
					))}
				</div>
			);
		}
		case 'link': {
			const text = String(value || '');
			if (!text) return <span>-</span>;
			const href =
				typeof config.href === 'function'
					? config.href(row)
					: config.href || text;
			return (
				<a
					href={href}
					target={config.target || '_blank'}
					rel={config.target === '_blank' ? 'noopener noreferrer' : undefined}
					className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
				>
					<HighlightedText text={text} query={highlightQuery} />
					{config.target === '_blank' && <ExternalLink className="w-3 h-3" />}
				</a>
			);
		}
		case 'avatar': {
			const text = String(value || '');
			const fallback =
				typeof config.avatarFallback === 'function'
					? config.avatarFallback(row)
					: config.avatarFallback || text.substring(0, 2).toUpperCase();
			return (
				<Avatar className="w-8 h-8">
					<AvatarImage src={text} alt={fallback} />
					<AvatarFallback>{fallback}</AvatarFallback>
				</Avatar>
			);
		}
		case 'image': {
			const src = String(value || '');
			if (!src) return <span>-</span>;
			return (
				<img
					src={src}
					alt="Vista previa"
					className="w-10 h-10 object-cover rounded"
				/>
			);
		}
		case 'badge': {
			const text = String(value || '');
			if (!text) return <span>-</span>;
			if (config.badgeMap?.[text]) {
				const mapped = config.badgeMap[text];
				return <Badge variant={mapped.variant as any}>{mapped.label}</Badge>;
			}
			return (
				<Badge variant={config.badgeVariant || 'default'}>
					<HighlightedText text={text} query={highlightQuery} />
				</Badge>
			);
		}
		case 'text-icon': {
			const text = String(value || '');
			if (!text) return <span>-</span>;
			const iconName =
				typeof config.iconName === 'function'
					? config.iconName(row)
					: config.iconName;
			return (
				<div
					className={cn(
						"inline-flex items-center gap-2",
						config.iconPosition === 'right' ? 'flex-row-reverse' : ''
					)}
				>
					{iconName && (
						<span className={cn("text-muted-foreground", config.iconClassName)}>
							{iconName}
						</span>
					)}
					<span>
						<HighlightedText text={text} query={highlightQuery} />
					</span>
				</div>
			);
		}
		default:
			return (
				<span>
					<HighlightedText text={String(value || '-')} query={highlightQuery} />
				</span>
			);
	}
}

type EditableContentArgs = {
	column: ColumnDef;
	row: TableRow;
	value: unknown;
	setValue: (value: unknown) => void;
	handleBlur: () => void;
	highlightQuery: string;
};

function renderEditableContent({
	column,
	row,
	value,
	setValue,
	handleBlur,
	highlightQuery,
}: EditableContentArgs): ReactNode {
	const cellType = column.cellType || 'text';
	const config = column.cellConfig || {};

	switch (cellType) {
		case 'currency': {
			const formatted =
				value == null || value === ""
					? "-"
					: new Intl.NumberFormat(config.currencyLocale || 'es-AR', {
						style: 'currency',
						currency: config.currencyCode || 'USD',
					}).format(Number(value) || 0);
			return (
				<Input
					type="number"
					step="0.01"
					className="w-full h-full rounded-none border-none focus-visible:ring-orange-primary/40 z-100 absolute top-0 left-0 focus-visible:ring-offset-1 children-input-hidden"
					value={value ?? ""}
					onChange={(event) => {
						const next = event.target.value;
						setValue(next === "" ? null : Number(next));
					}}
					onBlur={handleBlur}
					placeholder="0.00"
					required={column.required}
				/>
			);
		}
		case 'number':
			return (
				<Input
					type="number"
					className="w-full h-full rounded-none border-none focus-visible:ring-orange-primary/40 z-100 absolute top-0 left-0 focus-visible:ring-offset-1 children-input-hidden"
					value={value ?? ""}
					onChange={(event) => {
						const next = event.target.value;
						setValue(next === "" ? null : Number(next));
					}}
					onBlur={handleBlur}
					required={column.required}
				/>
			);
		case 'date':
			return (
				<Input
					type="date"
					className="w-full h-full rounded-none border-none focus-visible:ring-orange-primary/40 z-100 absolute top-0 left-0 focus-visible:ring-offset-1 children-input-hidden"
					value={value ?? ""}
					onChange={(event) => setValue(event.target.value)}
					onBlur={handleBlur}
					required={column.required}
				/>
			);
		case 'boolean':
		case 'checkbox':
			return (
				<div className="flex items-center gap-2 w-full h-full justify-center ">
					<Checkbox
						checked={Boolean(value)}
						onCheckedChange={(checked) => {
							setValue(Boolean(checked));
							config.onToggle?.(Boolean(checked), row);
						}}
					/>
					<span className="text-xs text-muted-foreground">
						{Boolean(value) ? 'Sí' : 'No'}
					</span>
				</div>
			);
		case 'toggle':
			return (
				<div className="flex items-center gap-2 children-input-shown">
					<Switch
						checked={Boolean(value)}
						onCheckedChange={(checked) => {
							setValue(checked);
							config.onToggle?.(checked, row);
						}}
					/>
					<span className="text-xs text-muted-foreground">
						{checkedLabel(Boolean(value))}
					</span>
				</div>
			);
		case 'tags': {
			const tagsStr = String(value ?? '');
			const tags = tagsStr
				? (config.tagSeparator
					? tagsStr.split(config.tagSeparator).map((t) => t.trim()).filter(Boolean)
					: [tagsStr])
				: [];
			return (
				<div className="space-y-1 w-full h-full">
					<Input
						value={tagsStr}
						className="w-full h-full rounded-none border-none focus-visible:ring-orange-primary/40 z-100 absolute top-0 left-0 focus-visible:ring-offset-1 focus-visible:opacity-100 opacity-0 peer children-input-hidden"
						onChange={(event) => setValue(event.target.value)}
						onBlur={handleBlur}
						placeholder="Ej: diseño, arquitectura"
					/>
					{tags.length > 0 && (
						<div className="flex flex-wrap gap-1 w-full h-full peer-focus:opacity-0 opacity-100 p-3 ">
							{tags.map((tag) => (
								<Badge key={tag} variant={config.tagVariant || 'secondary'} className="max-h-6 children-input-shown">
									<HighlightedText text={tag} query={highlightQuery} />
								</Badge>
							))}
						</div>
					)}
				</div>
			);
		}
		case 'link': {
			const text = String(value ?? '');
			const href =
				typeof config.href === 'function'
					? config.href(row)
					: text || config.href || '#';
			return (
				<div className="space-y-1 overflow-hidden">
					<Input
						className="w-full h-full rounded-none border-none focus-visible:ring-orange-primary/40 z-100 absolute top-0 left-0 focus-visible:ring-offset-1 peer opacity-0 focus-visible:opacity-100 children-input-hidden "
						value={text}
						onChange={(event) => setValue(event.target.value)}
						onBlur={handleBlur}
						placeholder="https://..."
						required={column.required}
					/>
					{text && (
						<a
							href={href}
							target={config.target || '_blank'}
							rel={config.target === '_blank' ? 'noopener noreferrer' : undefined}
							className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline w-full h-full justify-center peer-focus:opacity-0 opacity-100 p-3 absolute top-0 left-0 overflow-hidden  ring-offset-0 z-10 children-input-shown"
						>
							<HighlightedText text={text} query={highlightQuery} />
							<ExternalLink className="w-3 h-3" />
						</a>
					)}
				</div>
			);
		}
		case 'avatar': {
			const text = String(value ?? '');
			const fallback =
				typeof config.avatarFallback === 'function'
					? config.avatarFallback(row)
					: config.avatarFallback || text.substring(0, 2).toUpperCase();
			return (
				<div className="flex items-center gap-3">
					<Avatar className="w-8 h-8 shrink-0">
						<AvatarImage src={text} alt={fallback} />
						<AvatarFallback>{fallback}</AvatarFallback>
					</Avatar>
					<Input
						value={text}
						onChange={(event) => setValue(event.target.value)}
						onBlur={handleBlur}
						placeholder="https://..."
					/>
				</div>
			);
		}
		case 'image': {
			const src = String(value ?? '');
			return (
				<div className="flex items-center gap-3">
					<div className="h-10 w-10 overflow-hidden rounded border bg-muted">
						{src ? (
							<img src={src} alt="Vista previa" className="h-full w-full object-cover" />
						) : (
							<span className="text-[10px] text-muted-foreground block text-center leading-10">
								Sin imagen
							</span>
						)}
					</div>
					<Input
						value={src}
						onChange={(event) => setValue(event.target.value)}
						onBlur={handleBlur}
						placeholder="https://..."
					/>
				</div>
			);
		}
		case 'badge':
			return (
				<div className="space-y-1">
					<Input
						value={value ?? ""}
						onChange={(event) => setValue(event.target.value)}
						onBlur={handleBlur}
						className="w-full h-full rounded-none border-none focus-visible:ring-orange-primary/40 z-100 absolute top-0 left-0 focus-visible:ring-offset-1 peer opacity-0 focus-visible:opacity-100 children-input-hidden"
					/>
					<div className="peer-focus:opacity-0 opacity-100 p-3 children-input-shown">{renderReadOnlyValue(value, row, column, highlightQuery)}</div>
				</div>
			);
		case 'text-icon':
			return (
				<div className="space-y-1 children-input-hidden">
					<Input
						value={value ?? ""}
						onChange={(event) => setValue(event.target.value)}
						onBlur={handleBlur}
					/>
					<div>{renderReadOnlyValue(value, row, column, highlightQuery)}</div>
				</div>
			);
		default:
			return (
				<Input
					className="w-full h-full rounded-none border-none focus-visible:ring-orange-primary/40 z-100 absolute top-0 left-0 focus-visible:ring-offset-1 children-input-hidden"
					value={value ?? ""}
					onChange={(event) => setValue(event.target.value)}
					onBlur={handleBlur}
					required={column.required}
				/>
			);
	}
}

function renderCellByType({
	column,
	row,
	rowId,
	FieldComponent,
	highlightQuery,
	isCellDirty,
	isRowDirty,
	onCopyCell,
	onCopyColumn,
	onCopyRow,
	onClearValue,
	onRestoreValue,
	canRestore,
	customMenuItems,
}: RenderCellArgs): ReactNode {
	const fieldPath = `rowsById.${rowId}.${column.field}` as const;
	const editable = column.editable !== false;
	const validators = column.validators;

	return (
		<FieldComponent name={fieldPath} validators={validators}>
			{(field: any) => {
				const fieldValue = field.state.value;
				const setValue = (value: unknown) => field.handleChange(value);
				const errorMessage = field.state.meta?.errors?.[0];
				const content = editable
					? renderEditableContent({
						column,
						row,
						value: fieldValue,
						setValue,
						handleBlur: field.handleBlur,
						highlightQuery,
					})
					: renderReadOnlyValue(fieldValue, row, column, highlightQuery);

				const body = (
					<div
						className={cn(
							"transition-colors absolute top-0 left-0 w-full h-full ",
							isCellDirty || isRowDirty
								? "outline outline-amber-500/50 bg-amber-50/60 shadow-sm"
								: ""
						)}
					>
						{content}
						{editable && errorMessage && (
							<p className="text-xs text-destructive">{errorMessage}</p>
						)}
					</div>
				);

				return (
					<ContextMenu>
						<ContextMenuTrigger className="[&[data-state=open]_.children-input-hidden]:ring-2 [&[data-state=open]_.children-input-hidden]:ring-orange-primary/40 [&[data-state=open]_.children-input-shown]:opacity-0 [&[data-state=open]_.children-input-hidden]:opacity-100">
							<>{body}</>
						</ContextMenuTrigger>
						<ContextMenuContent className="w-56 z-[10000000]">
							{canRestore && onRestoreValue && (
								<>
									<ContextMenuItem onClick={onRestoreValue} className="bg-amber-100/50 border-amber-500/50 border">
										Restaurar valor previo
									</ContextMenuItem>
									<ContextMenuSeparator />
								</>
							)}
							<ContextMenuItem onClick={() => onCopyCell(fieldValue)}>
								Copiar valor
							</ContextMenuItem>
							<ContextMenuItem onClick={onCopyColumn}>Copiar columna</ContextMenuItem>
							<ContextMenuItem onClick={onCopyRow}>Copiar fila (CSV)</ContextMenuItem>
							{editable && (
								<ContextMenuItem onClick={onClearValue}>
									Limpiar valor
								</ContextMenuItem>
							)}
							{customMenuItems && customMenuItems.length > 0 && (
								<>
									<ContextMenuSeparator />
									{customMenuItems.map((item) => (
										<ContextMenuItem
											key={item.id}
											onClick={() => item.onSelect?.(row)}
										>
											{item.label}
										</ContextMenuItem>
									))}
								</>
							)}
						</ContextMenuContent>
					</ContextMenu>
				);
			}}
		</FieldComponent>
	);
}
function checkedLabel(value: boolean) {
	return value ? "Activo" : "Inactivo";
}

export default function FormTablePage() {
	const TABLE_ID = "form-table";

	// TanStack Form setup
	const form = useForm<FormValues>({
		defaultValues: {
			rowOrder: [],
			rowsById: {},
		},
	});

	const rowOrderSelector = useCallback(
		(state: AnyFormState<FormValues>) => state.values?.rowOrder ?? [],
		[]
	);
	const rowsByIdSelector = useCallback(
		(state: AnyFormState<FormValues>) => state.values?.rowsById ?? {},
		[]
	);

	const rowOrder = useStore(form.store, rowOrderSelector);
	const rowsById = useStore(form.store, rowsByIdSelector);
	const [isSaving, setIsSaving] = useState(false);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
	const [isServerPaging, setIsServerPaging] = useState(false);
	const [dataSource, setDataSource] = useState<DataSourceMode>("demo");
	const [isFetchingServerRows, setIsFetchingServerRows] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const [serverMeta, setServerMeta] = useState<ServerPaginationMeta>({
		page: 1,
		limit: DEFAULT_PAGE_SIZE,
		total: 0,
		totalPages: 1,
		hasNextPage: false,
		hasPreviousPage: false,
	});
	const initialValuesRef = useRef<FormValues>({ rowOrder: [], rowsById: {} });
	const tableConfig = TABLE_CONFIGS[dataSource];
	const columns = tableConfig.columns;
	const headerGroups = tableConfig.headerGroups;
	const tabFilters = tableConfig.tabFilters;
	const searchPlaceholder = tableConfig.searchPlaceholder;

	const [searchValue, setSearchValue] = useState("");
	const [activeTab, setActiveTab] = useState<string>(tabFilters[0]?.id ?? "all");
	useEffect(() => {
		setActiveTab(tableConfig.tabFilters[0]?.id ?? "all");
	}, [tableConfig]);
	const [isFiltersOpen, setIsFiltersOpen] = useState(false);
	const [simpleFilters, setSimpleFilters] = useState<SimpleAdvancedFilters>(defaultSimpleAdvancedFilters);
	const [detailFilters, setDetailFilters] = useState<DetailAdvancedFilters>(defaultDetailAdvancedFilters);
	const [filtersDraft, setFiltersDraft] = useState<SimpleAdvancedFilters | DetailAdvancedFilters>(
		defaultSimpleAdvancedFilters
	);
	const [draftSource, setDraftSource] = useState<DataSourceMode>("demo");
	const [sortState, setSortState] = useState<SortState>({ columnId: null, direction: "asc" });
	const [colWidths, setColWidths] = useState<Record<number, number>>({});
	const colRefs = useRef<(HTMLTableColElement | null)[]>([]);

	const setFormRows = useCallback(
		(nextRows: TableRow[]) => {
			const nextOrder = nextRows.map((row) => row.id);
			const nextMap = nextRows.reduce<Record<string, TableRow>>((acc, row) => {
				acc[row.id] = { ...row };
				return acc;
			}, {});
			form.setFieldValue("rowOrder", () => nextOrder);
			form.setFieldValue("rowsById", () => nextMap);
			initialValuesRef.current = snapshotValues(nextOrder, nextMap);
		},
		[form]
	);

	const rows = useMemo(() => {
		return rowOrder.map((id) => rowsById[id]).filter((row): row is TableRow => Boolean(row));
	}, [rowOrder, rowsById]);

	useEffect(() => {
		if (initialValuesRef.current.rowOrder.length === 0 && rowOrder.length > 0) {
			initialValuesRef.current = snapshotValues(rowOrder, rowsById);
		}
	}, [rowOrder, rowsById]);

	useEffect(() => {
		if (dataSource === "demo") {
			setFormRows(DEMO_ROWS);
		}
	}, [dataSource, setFormRows]);

	const fetchObrasPage = useCallback(
		async (mode: DataSourceMode, targetPage: number, targetLimit: number) => {
			setIsFetchingServerRows(true);
			setServerError(null);
			try {
				const params = new URLSearchParams({
					page: String(targetPage),
					limit: String(targetLimit),
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
					? payload.detalleObras
					: [];
				const mapper = mode === "obrasDetail" ? mapObraToDetailRow : mapObraToSimpleRow;
				const mappedRows = detalle.map(mapper);
				setFormRows(mappedRows);
				const pagination = payload.pagination as Partial<ServerPaginationMeta> | undefined;
				setServerMeta({
					page: pagination?.page ?? targetPage,
					limit: pagination?.limit ?? targetLimit,
					total: pagination?.total ?? mappedRows.length,
					totalPages: pagination?.totalPages ?? 1,
					hasNextPage: pagination?.hasNextPage ?? false,
					hasPreviousPage: pagination?.hasPreviousPage ?? false,
				});
			} catch (error) {
				console.error("Error fetching obras", error);
				setServerError(
					error instanceof Error
						? error.message
						: "No se pudo obtener la página solicitada"
				);
			} finally {
				setIsFetchingServerRows(false);
			}
		},
		[setFormRows]
	);

	useEffect(() => {
		if (dataSource === "obras" || dataSource === "obrasDetail") {
			setIsServerPaging(true);
			void fetchObrasPage(dataSource, page, pageSize);
		} else {
			setIsServerPaging(false);
		}
	}, [dataSource, page, pageSize, fetchObrasPage]);

	const getInitialRow = useCallback(
		(rowId: string) => initialValuesRef.current.rowsById[rowId],
		[]
	);

	const getInitialCellValue = useCallback(
		(rowId: string, column: ColumnDef) =>
			initialValuesRef.current.rowsById[rowId]?.[column.field],
		[]
	);

	const isCellDirty = useCallback(
		(rowId: string, column: ColumnDef) => {
			const initialRow = getInitialRow(rowId);
			const currentRow = rowsById[rowId];
			if (!currentRow) return false;
			if (!initialRow) return true;
			const field = column.field;
			const currentValue = currentRow[field];
			const initialValue = initialRow[field];
			return !shallowEqualValues(currentValue, initialValue);
		},
		[getInitialRow, rowsById]
	);

	const isRowDirty = useCallback(
		(rowId: string) => {
			//make it return true if any cell is dirty and then an array of the dirty cells 
			const initialRow = getInitialRow(rowId);
			const currentRow = rowsById[rowId];
			const dirtyCells: ColumnDef[] = [];
			if (!currentRow) return { dirty: false, cells: [] };
			if (!initialRow) return { dirty: true, cells: [] };
			for (const column of columns) {
				if (column.field && column.field !== ("id" as any)) {
					if (!shallowEqualValues(currentRow[column.field], initialRow[column.field])) {
						dirtyCells.push(column);
					}
				}
			}
			return { dirty: dirtyCells.length > 0, cells: dirtyCells };
		},
		[getInitialRow, rowsById, columns]
	);

	const hasUnsavedChanges = useMemo(
		() => rowOrder.some((rowId) => isRowDirty(rowId).dirty ?? false),
		[rowOrder, isRowDirty]
	);

	useEffect(() => {
		if (!isFiltersOpen) return;
		setDraftSource(dataSource);
		setFiltersDraft(
			dataSource === "obrasDetail" ? detailFilters : simpleFilters
		);
	}, [isFiltersOpen, dataSource, detailFilters, simpleFilters]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		try {
			const stored = localStorage.getItem(`resizable-cols:${TABLE_ID}`);
			if (stored) {
				const parsed = JSON.parse(stored) as Record<number, number>;
				setColWidths(parsed);
			}
		} catch {
			// ignore
		}
	}, [TABLE_ID]);

	// Column management state
	const [hiddenColumnIds, setHiddenColumnIds] = useState<string[]>(() =>
		readPersistedArray(`${TABLE_ID}:hidden`)
	);
	const [pinnedColumnIds, setPinnedColumnIds] = useState<string[]>(() =>
		readPersistedArray(`${TABLE_ID}:pinned`)
	);
	const [columnOffsets, setColumnOffsets] = useState<Record<string, number>>({});
	const tableRef = useRef<HTMLTableElement | null>(null);

	const columnIndexMap = useMemo(() => {
		const map: Record<string, number> = {};
		columns.forEach((column, index) => {
			map[column.id] = index;
		});
		return map;
	}, []);

	const columnsById = useMemo(() => {
		const map: Record<string, ColumnDef> = {};
		columns.forEach((column) => {
			map[column.id] = column;
		});
		return map;
	}, []);

	const groupedColumnLookup = useMemo(() => {
		const map = new Map<string, HeaderGroup>();
		headerGroups.forEach((group) => {
			group.columns.forEach((columnId) => {
				map.set(columnId, group);
			});
		});
		return map;
	}, []);

	const hideableColumns = useMemo(
		() => new Set(columns.filter((col) => col.enableHide !== false).map((col) => col.id)),
		[]
	);

	const pinnableColumns = useMemo(
		() => new Set(columns.filter((col) => col.enablePin !== false).map((col) => col.id)),
		[]
	);

	const normalizedSearch = searchValue.trim().toLowerCase();

	const highlightQuery = normalizedSearch;

	const matchesGlobalSearch = useCallback(
		(row: TableRow) => {
			if (!normalizedSearch) return true;
			return columns.some((column) => {
				if (column.searchFn) {
					return column.searchFn(row, normalizedSearch);
				}
				const rawValue = row[column.field];
				return defaultSearchMatcher(rawValue, normalizedSearch);
			});
		},
		[normalizedSearch, columns]
	);

	const applySimpleFilters = useCallback((row: TableRow, filters: SimpleAdvancedFilters) => {
		if (filters.status !== "any" && row.field4 !== filters.status) {
			return false;
		}
		if (filters.hasUrl && !(row.field2 && row.field2.trim())) {
			return false;
		}
		if (filters.tagIncludes) {
			const tagNeedle = filters.tagIncludes.trim().toLowerCase();
			if (!tagNeedle) {
				// ignore if only whitespace
			} else if (!(row.field3 || "").toLowerCase().includes(tagNeedle)) {
				return false;
			}
		}
		const min = filters.minPrice ? Number(filters.minPrice) : null;
		const max = filters.maxPrice ? Number(filters.maxPrice) : null;
		const price = row.field6 ?? null;
		if (min != null && (price == null || price < min)) {
			return false;
		}
		if (max != null && (price == null || price > max)) {
			return false;
		}
		return true;
	}, []);

	const applyDetailFilters = useCallback((row: TableRow, filters: DetailAdvancedFilters) => {
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
	}, []);

	const searchFilteredRows = useMemo(
		() => rows.filter((row) => matchesGlobalSearch(row)),
		[rows, matchesGlobalSearch]
	);

	const advancedFilteredRows = useMemo(() => {
		if (dataSource === "obrasDetail") {
			return searchFilteredRows.filter((row) => applyDetailFilters(row, detailFilters));
		}
		return searchFilteredRows.filter((row) => applySimpleFilters(row, simpleFilters));
	}, [searchFilteredRows, dataSource, detailFilters, simpleFilters, applyDetailFilters, applySimpleFilters]);

	const tabCounts = useMemo(() => {
		const counts: Record<string, number> = {};
		tabFilters.forEach((tab) => {
			counts[tab.id] = tab.predicate
				? advancedFilteredRows.filter(tab.predicate).length
				: advancedFilteredRows.length;
		});
		return counts;
	}, [advancedFilteredRows]);

	const tabFilteredRows = useMemo(() => {
		const currentTab = tabFilters.find((tab) => tab.id === activeTab);
		if (!currentTab?.predicate) {
			return advancedFilteredRows;
		}
		return advancedFilteredRows.filter(currentTab.predicate);
	}, [advancedFilteredRows, activeTab]);

	const sortedRows = useMemo(() => {
		if (!sortState.columnId) return tabFilteredRows;
		const column = columns.find((col) => col.id === sortState.columnId);
		if (!column) return tabFilteredRows;
		const comparator = column.sortFn ?? defaultSortByField(column.field);
		const sorted = [...tabFilteredRows].sort((a, b) => comparator(a, b));
		return sortState.direction === "asc" ? sorted : sorted.reverse();
	}, [tabFilteredRows, sortState]);

	const activeFilterCount = useMemo(() => {
		if (dataSource === "obrasDetail") {
			const filters = detailFilters;
			let count = 0;
			if (filters.supMin) count += 1;
			if (filters.supMax) count += 1;
			if (filters.entidades.filter((v) => v.trim().length > 0).length > 0) count += 1;
			if (filters.mesYear) count += 1;
			if (filters.mesContains) count += 1;
			if (filters.iniYear) count += 1;
			if (filters.iniContains) count += 1;
			if (filters.cmaMin) count += 1;
			if (filters.cmaMax) count += 1;
			if (filters.cafMin) count += 1;
			if (filters.cafMax) count += 1;
			if (filters.sacMin) count += 1;
			if (filters.sacMax) count += 1;
			if (filters.scMin) count += 1;
			if (filters.scMax) count += 1;
			if (filters.paMin) count += 1;
			if (filters.paMax) count += 1;
			if (filters.ptMin) count += 1;
			if (filters.ptMax) count += 1;
			if (filters.ptrMin) count += 1;
			if (filters.ptrMax) count += 1;
			return count;
		}
		let count = 0;
		if (simpleFilters.status !== "any") count += 1;
		if (simpleFilters.hasUrl) count += 1;
		if (simpleFilters.tagIncludes.trim()) count += 1;
		if (simpleFilters.minPrice) count += 1;
		if (simpleFilters.maxPrice) count += 1;
		return count;
	}, [dataSource, detailFilters, simpleFilters]);

	// Persist hidden columns
	useEffect(() => {
		writePersistedArray(`${TABLE_ID}:hidden`, hiddenColumnIds);
	}, [hiddenColumnIds]);

	// Persist pinned columns
	useEffect(() => {
		writePersistedArray(`${TABLE_ID}:pinned`, pinnedColumnIds);
	}, [pinnedColumnIds]);

	// Clean up and sort pinned columns
	useEffect(() => {
		setPinnedColumnIds((prev) => {
			const next = prev.filter((id) => pinnableColumns.has(id));
			next.sort((a, b) => {
				const indexA = columnIndexMap[a] ?? Number.MAX_SAFE_INTEGER;
				const indexB = columnIndexMap[b] ?? Number.MAX_SAFE_INTEGER;
				return indexA - indexB;
			});
			return next;
		});
	}, [pinnableColumns, columnIndexMap]);

	const isColumnHidden = useCallback(
		(columnId: string) => hideableColumns.has(columnId) && hiddenColumnIds.includes(columnId),
		[hideableColumns, hiddenColumnIds]
	);

	const isColumnPinned = useCallback(
		(columnId: string) => pinnableColumns.has(columnId) && pinnedColumnIds.includes(columnId),
		[pinnableColumns, pinnedColumnIds]
	);

	const togglePinColumn = useCallback(
		(columnId: string) => {
			if (!pinnableColumns.has(columnId)) return;
			setPinnedColumnIds((prev) => {
				const set = new Set(prev);
				if (set.has(columnId)) {
					set.delete(columnId);
				} else {
					set.add(columnId);
				}
				const nextPinned = Array.from(set);
				nextPinned.sort((a, b) => {
					const indexA = columnIndexMap[a] ?? Number.MAX_SAFE_INTEGER;
					const indexB = columnIndexMap[b] ?? Number.MAX_SAFE_INTEGER;
					return indexA - indexB;
				});
				return nextPinned;
			});
		},
		[pinnableColumns, columnIndexMap]
	);

	const recalcPinnedOffsets = useCallback(() => {
		const offsets: Record<string, number> = {};
		let accumulator = 0;
		pinnedColumnIds.forEach((columnId) => {
			if (isColumnHidden(columnId)) return;
			const colIndex = columnIndexMap[columnId];
			if (colIndex == null) return;
			const colEl = colRefs.current[colIndex];
			const width = colEl?.getBoundingClientRect().width || colWidths[colIndex] || DEFAULT_COL_WIDTH;
			offsets[columnId] = accumulator;
			accumulator += width;
		});
		setColumnOffsets(offsets);
	}, [pinnedColumnIds, isColumnHidden, columnIndexMap, colWidths]);

	useEffect(() => {
		recalcPinnedOffsets();
	}, [recalcPinnedOffsets]);

	useEffect(() => {
		const handleResize = () => recalcPinnedOffsets();
		window.addEventListener("resize", handleResize);
		const table = tableRef.current;
		const handleColumnResize = () => recalcPinnedOffsets();
		if (table) {
			table.addEventListener("columnResized", handleColumnResize as EventListener);
		}
		return () => {
			window.removeEventListener("resize", handleResize);
			if (table) {
				table.removeEventListener("columnResized", handleColumnResize as EventListener);
			}
		};
	}, [recalcPinnedOffsets]);

	useEffect(() => {
		const table = tableRef.current;
		if (!table) return;
		const handler = (event: Event) => {
			const detail = (event as CustomEvent)?.detail as { tableId?: string; colIndex?: number; newWidth?: number };
			if (!detail || detail.tableId !== TABLE_ID) return;
			if (typeof detail.colIndex !== "number" || typeof detail.newWidth !== "number") return;
			setColWidths((prev) => {
				if (prev[detail.colIndex] === detail.newWidth) return prev;
				return { ...prev, [detail.colIndex]: detail.newWidth };
			});
		};
		table.addEventListener("columnResized", handler as EventListener);
		return () => {
			table.removeEventListener("columnResized", handler as EventListener);
		};
	}, [TABLE_ID]);

	const getStickyProps = useCallback(
		(columnId: string, baseClassName?: string) => {
			const offset = columnOffsets[columnId];
			const pinned = isColumnPinned(columnId);
			return {
				className: cn(
					baseClassName,
					pinned && offset !== undefined ? "sticky z-20 outline outline-orange-primary/60" : ""
				),
				style: {
					left: pinned && offset !== undefined ? `${offset}px` : undefined,
				},
			};
		},
		[columnOffsets, isColumnHidden, isColumnPinned]
	);

	const hiddenIndices = useMemo(
		() =>
			hiddenColumnIds
				.filter((columnId) => hideableColumns.has(columnId))
				.map((columnId) => columnIndexMap[columnId])
				.filter((value): value is number => typeof value === "number"),
		[hiddenColumnIds, hideableColumns, columnIndexMap]
	);

	const handleBalanceColumns = useCallback(() => {
		balanceTableColumns(TABLE_ID, {
			hiddenCols: hiddenIndices,
			minVisibleWidth: 100,
		});
	}, [hiddenIndices]);

	const handleApplyAdvancedFilters = useCallback(() => {
		if (draftSource === "obrasDetail") {
			setDetailFilters(filtersDraft as DetailAdvancedFilters);
		} else {
			setSimpleFilters(filtersDraft as SimpleAdvancedFilters);
		}
		setIsFiltersOpen(false);
	}, [draftSource, filtersDraft]);

	const handleResetAdvancedFilters = useCallback(() => {
		if (draftSource === "obrasDetail") {
			setFiltersDraft(defaultDetailAdvancedFilters);
			setDetailFilters(defaultDetailAdvancedFilters);
		} else {
			setFiltersDraft(defaultSimpleAdvancedFilters);
			setSimpleFilters(defaultSimpleAdvancedFilters);
		}
	}, []);

	const renderSimpleFiltersForm = useCallback(() => {
		const current = filtersDraft as SimpleAdvancedFilters;
		return (
			<>
				<div className="space-y-2">
					<Label htmlFor="status-filter">Estado</Label>
					<Select
						value={current.status}
						onValueChange={(value) =>
							setFiltersDraft((prev) => ({
								...(prev as SimpleAdvancedFilters),
								status: value as SimpleAdvancedFilters["status"],
							}))
						}
					>
						<SelectTrigger id="status-filter">
							<SelectValue placeholder="Cualquier estado" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="any">Cualquiera</SelectItem>
							<SelectItem value="activo">Activo</SelectItem>
							<SelectItem value="inactivo">Inactivo</SelectItem>
							<SelectItem value="pendiente">Pendiente</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label htmlFor="tag-filter">Etiquetas que contienen</Label>
					<Input
						id="tag-filter"
						value={current.tagIncludes}
						onChange={(event) =>
							setFiltersDraft((prev) => ({
								...(prev as SimpleAdvancedFilters),
								tagIncludes: event.target.value,
							}))
						}
						placeholder="Ej: arquitectura"
					/>
				</div>
				<div className="space-y-2">
					<Label>Rango de precio</Label>
					<div className="grid grid-cols-2 gap-3">
						<Input
							type="number"
							placeholder="Mínimo"
							value={current.minPrice}
							onChange={(event) =>
								setFiltersDraft((prev) => ({
									...(prev as SimpleAdvancedFilters),
									minPrice: event.target.value,
								}))
							}
						/>
						<Input
							type="number"
							placeholder="Máximo"
							value={current.maxPrice}
							onChange={(event) =>
								setFiltersDraft((prev) => ({
									...(prev as SimpleAdvancedFilters),
									maxPrice: event.target.value,
								}))
							}
						/>
					</div>
				</div>
				<div className="flex items-center justify-between rounded-lg border px-4 py-3">
					<div>
						<p className="text-sm font-medium">Solo filas con URL</p>
						<p className="text-xs text-muted-foreground">
							Filtra registros con enlaces completos
						</p>
					</div>
					<Switch
						checked={current.hasUrl}
						onCheckedChange={(checked) =>
							setFiltersDraft((prev) => ({
								...(prev as SimpleAdvancedFilters),
								hasUrl: checked,
							}))
						}
					/>
				</div>
			</>
		);
	}, [filtersDraft]);

	const renderDetailFiltersForm = useCallback(() => {
		const current = filtersDraft as DetailAdvancedFilters;
		const handleRangeChange = (key: keyof DetailAdvancedFilters, value: string) => {
			setFiltersDraft((prev) => ({
				...(prev as DetailAdvancedFilters),
				[key]: value,
			}));
		};
		return (
			<div className="space-y-4">
				<div className="grid grid-cols-2 gap-3">
					<div>
						<Label>Sup. mínima (m²)</Label>
						<Input
							value={current.supMin}
							onChange={(event) => handleRangeChange("supMin", event.target.value)}
						/>
					</div>
					<div>
						<Label>Sup. máxima (m²)</Label>
						<Input
							value={current.supMax}
							onChange={(event) => handleRangeChange("supMax", event.target.value)}
						/>
					</div>
				</div>
				<div className="space-y-2">
					<Label>Entidades (una por línea)</Label>
					<Textarea
						value={current.entidades.join("\n")}
						onChange={(event) => {
							const values = event.target.value
								.split(/\r?\n|,/)
								.map((value) => value.trim())
								.filter(Boolean);
							setFiltersDraft((prev) => ({
								...(prev as DetailAdvancedFilters),
								entidades: values,
							}));
						}}
					/>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<div>
						<Label>Mes básico (año exacto)</Label>
						<Input
							value={current.mesYear}
							onChange={(event) => handleRangeChange("mesYear", event.target.value)}
						/>
					</div>
					<div>
						<Label>Mes básico contiene</Label>
						<Input
							value={current.mesContains}
							onChange={(event) => handleRangeChange("mesContains", event.target.value)}
						/>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<div>
						<Label>Iniciación (año)</Label>
						<Input
							value={current.iniYear}
							onChange={(event) => handleRangeChange("iniYear", event.target.value)}
						/>
					</div>
					<div>
						<Label>Iniciación contiene</Label>
						<Input
							value={current.iniContains}
							onChange={(event) => handleRangeChange("iniContains", event.target.value)}
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
								value={(current as any)[minKey]}
								onChange={(event) => handleRangeChange(minKey as keyof DetailAdvancedFilters, event.target.value)}
							/>
						</div>
						<div>
							<Label>{label} (máx)</Label>
							<Input
								value={(current as any)[maxKey]}
								onChange={(event) => handleRangeChange(maxKey as keyof DetailAdvancedFilters, event.target.value)}
							/>
						</div>
					</div>
				))}
			</div>
		);
	}, [filtersDraft]);

	const toggleSort = useCallback((columnId: string) => {
		setSortState((prev) => {
			if (prev.columnId !== columnId) {
				return { columnId, direction: "asc" };
			}
			if (prev.direction === "asc") {
				return { columnId, direction: "desc" };
			}
			return { columnId: null, direction: "asc" };
		});
	}, []);

	const applySortDirection = useCallback((columnId: string, direction: "asc" | "desc") => {
		setSortState({ columnId, direction });
	}, []);

	const clearSort = useCallback(() => {
		setSortState({ columnId: null, direction: "asc" });
	}, []);

	const clientTotalPages = useMemo(() => {
		if (sortedRows.length === 0) return 1;
		return Math.max(1, Math.ceil(sortedRows.length / pageSize));
	}, [sortedRows.length, pageSize]);

	useEffect(() => {
		if (!isServerPaging && page > clientTotalPages) {
			setPage(clientTotalPages);
		}
	}, [clientTotalPages, isServerPaging, page]);

	const processedRows = useMemo(() => {
		if (isServerPaging) {
			return sortedRows;
		}
		const start = (page - 1) * pageSize;
		return sortedRows.slice(start, start + pageSize);
	}, [isServerPaging, page, pageSize, sortedRows]);

	const processedRowsRef = useRef<TableRow[]>(processedRows);
	useEffect(() => {
		processedRowsRef.current = processedRows;
	}, [processedRows]);

	const datasetTotalCount = isServerPaging
		? serverMeta.total || processedRows.length
		: sortedRows.length;

	const totalPages = isServerPaging
		? serverMeta.totalPages || 1
		: clientTotalPages;

	const hasNextPage = isServerPaging
		? serverMeta.hasNextPage
		: page < clientTotalPages;
	const hasPreviousPage = isServerPaging
		? serverMeta.hasPreviousPage
		: page > 1;

	const totalRowCount = datasetTotalCount;
	const visibleRowCount = processedRows.length;

	const FieldComponent = form.Field as FormFieldComponent;

	const handleClearCell = useCallback(
		(rowId: string, column: ColumnDef) => {
			if (column.editable === false) return;
			const clearedValue = getClearedValue(column);
			form.setFieldValue(
				`rowsById.${rowId}.${column.field}` as const,
				() => clearedValue
			);
		},
		[form]
	);

	const handleRestoreCell = useCallback(
		(rowId: string, column: ColumnDef) => {
			const initialRow = initialValuesRef.current.rowsById[rowId];
			if (!initialRow) return;
			const initialValue = initialRow[column.field];
			form.setFieldValue(
				`rowsById.${rowId}.${column.field}` as const,
				() => initialValue
			);
		},
		[form]
	);

	const handleCopyCell = useCallback(async (value: unknown) => {
		const success = await copyToClipboard(value == null ? "" : String(value));
		toast[success ? "success" : "error"](
			success ? "Valor copiado al portapapeles" : "No se pudo copiar"
		);
	}, []);

	const handleCopyColumn = useCallback(async (column: ColumnDef) => {
		const snapshot = processedRowsRef.current;
		const values = snapshot.map((row) => row[column.field] ?? "").join("\n");
		const success = await copyToClipboard(values);
		toast[success ? "success" : "error"](
			success ? "Columna copiada" : "No se pudo copiar la columna"
		);
	}, []);

	const handleCopyRow = useCallback(async (row: TableRow) => {
		const success = await copyToClipboard(tableRowToCsv(row, columns));
		toast[success ? "success" : "error"](
			success ? "Fila copiada en CSV" : "No se pudo copiar la fila"
		);
	}, [columns]);

	// TanStack Table column definitions (static)
	const tableColumns = useMemo<TanStackColumnDef<TableRow>[]>(() => {
		return columns.map((col) => ({
			id: col.id,
			accessorKey: col.field,
			header: col.label,
			cell: (info) => info.getValue() ?? "",
		}));
	}, []);

	// TanStack Table column visibility state
	const columnVisibility = useMemo<VisibilityState>(() => {
		const state: VisibilityState = {};
		hiddenColumnIds.forEach((id) => {
			state[id] = false;
		});
		return state;
	}, [hiddenColumnIds]);

	// TanStack Table instance
	const table = useReactTable({
		data: processedRows,
		columns: tableColumns,
		getCoreRowModel: getCoreRowModel(),
		getRowId: (row) => row.id,
		state: {
			columnVisibility,
		},
		onColumnVisibilityChange: (updater) => {
			const newVisibility = typeof updater === 'function' ? updater(columnVisibility) : updater;
			const hidden = Object.keys(newVisibility).filter((key) => !newVisibility[key]);
			setHiddenColumnIds(hidden);
		},
		enableColumnResizing: false, // We handle resizing manually
		columnResizeMode: 'onChange',
	});

	const handleAddRow = useCallback(() => {
		const newRow = createRow(columns);
		form.setFieldValue("rowOrder", (prev = []) => [...prev, newRow.id]);
		form.setFieldValue("rowsById", (prev = {}) => ({ ...prev, [newRow.id]: newRow }));
		toast.success("Fila vacía agregada");
	}, [columns, form]);

	const handleDelete = useCallback((id: string) => {
		form.setFieldValue("rowOrder", (prev = []) => prev.filter((rowId) => rowId !== id));
		form.setFieldValue("rowsById", (prev = {}) => {
			if (!(id in prev)) return prev;
			const next = { ...prev };
			delete next[id];
			return next;
		});
		toast.success("Fila eliminada");
	}, [form]);

	const handleSave = useCallback(async () => {
		if (!hasUnsavedChanges) return;
		setIsSaving(true);
		try {
			// Simulate API save delay
			await new Promise((resolve) => setTimeout(resolve, 900));
			initialValuesRef.current = snapshotValues(rowOrder, rowsById);
			toast.success("Cambios guardados correctamente");
		} catch (error) {
			console.error("Error saving rows", error);
			toast.error("No se pudieron guardar los cambios");
		} finally {
			setIsSaving(false);
		}
	}, [hasUnsavedChanges, rowOrder, rowsById]);

	return (
		<TooltipProvider delayDuration={200}>
			<div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
				<div className="container mx-auto px-4 py-8 max-w-[calc(98vw-var(--sidebar-current-width))]">
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						className="space-y-2"
					>
						<div>
							<h1 className="text-3xl font-bold">Tabla de Formulario con TanStack</h1>
						</div>

						<div className="rounded-lg border bg-card">
							<div className="flex items-center justify-between">
								{dataSource === "obras" && isFetchingServerRows && (
									<span className="text-xs text-muted-foreground">Cargando...</span>
								)}
							</div>
							<Tabs
								value={dataSource}
								onValueChange={(value) => {
									const next = value as DataSourceMode;
									setPage(1);
									setDataSource(next);
								}}
							>
								<TabsList>
									{DATA_SOURCE_TABS.map((tab) => (
										<TabsTrigger key={tab.id} value={tab.id} className="gap-2">
											{tab.label}
										</TabsTrigger>
									))}
								</TabsList>
							</Tabs>
						</div>

						{/* <div className="rounded-lg border bg-card p-6 space-y-4">
							<h2 className="text-xl font-semibold">Características Disponibles:</h2>
							<ul className="space-y-2 text-sm grid grid-cols-1 md:grid-cols-2 gap-3">
							<li className="flex items-start gap-2">
								<span className="text-blue-600">⚡</span>
								<span><strong>TanStack Table:</strong> Gestión reactiva de tabla y columnas</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="text-blue-600">⚡</span>
								<span><strong>TanStack Form:</strong> Estado de formulario con validación</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="text-purple-600">🎨</span>
								<span><strong>Cell Types:</strong> 14 tipos de celdas (text, number, currency, date, boolean, checkbox, toggle, tags, link, avatar, image, icon, badge, text-icon)</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="text-green-600">✓</span>
								<span><strong>Encabezados Agrupados:</strong> Múltiples niveles de encabezados</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="text-green-600">✓</span>
								<span><strong>Visibilidad:</strong> TanStack column visibility integrada</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="text-green-600">✓</span>
								<span><strong>Fijado:</strong> Fija columnas (ícono pin) para scroll horizontal</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="text-green-600">✓</span>
								<span><strong>Redimensionar:</strong> Arrastra bordes de encabezados</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="text-green-600">✓</span>
								<span><strong>Auto-ajuste:</strong> Doble click en borde para ajustar contenido</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="text-green-600">✓</span>
								<span><strong>Rebalancear:</strong> Distribuye espacio equitativamente</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="text-green-600">✓</span>
								<span><strong>Persistencia:</strong> Preferencias guardadas en localStorage</span>
							</li>
						</ul>
					</div> */}

						{/* Toolbar with Column Management */}
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div className="flex flex-wrap items-center gap-2">
								<div className="relative">
									<SearchIcon className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
									<Input
										className="w-64 pl-8"
										value={searchValue}
								onChange={(event) => setSearchValue(event.target.value)}
								placeholder={searchPlaceholder}
									/>
								</div>
								<Sheet open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
									<SheetTrigger asChild>
										<Button
											type="button"
											variant={activeFilterCount > 0 ? "default" : "outline"}
											size="sm"
											className="gap-2"
										>
											<Filter className="h-4 w-4" />
											<span>Filtros avanzados</span>
											{activeFilterCount > 0 && (
												<Badge variant="secondary" className="ml-1">
													{activeFilterCount}
												</Badge>
											)}
										</Button>
									</SheetTrigger>
									<SheetContent
										side="right"
										className="sm:w-[420px] w-[90vw] my-auto max-h-[96vh] overflow-y-auto px-6 py-7"
									>
										<SheetHeader>
											<SheetTitle>Filtros avanzados</SheetTitle>
										</SheetHeader>
									<div className="mt-6 space-y-5">
										{draftSource === "obrasDetail" ? (
											<>
												<div className="grid grid-cols-2 gap-3">
													<div>
														<Label>Sup. mínima (m²)</Label>
														<Input
															value={(filtersDraft as DetailAdvancedFilters).supMin}
															onChange={(event) =>
																setFiltersDraft((prev) => ({
																	...(prev as DetailAdvancedFilters),
																	supMin: event.target.value,
																}))
															}
															placeholder="Ej: 100"
														/>
													</div>
													<div>
														<Label>Sup. máxima (m²)</Label>
														<Input
															value={(filtersDraft as DetailAdvancedFilters).supMax}
															onChange={(event) =>
																setFiltersDraft((prev) => ({
																	...(prev as DetailAdvancedFilters),
																	supMax: event.target.value,
																}))
															}
															placeholder="Ej: 1000"
														/>
													</div>
												</div>
												<div className="space-y-2">
													<Label>Entidades (una por línea)</Label>
													<Textarea
														value={(filtersDraft as DetailAdvancedFilters).entidades.join("\n")}
														onChange={(event) => {
															const values = event.target.value
																.split(/\r?\n|,/)
																.map((value) => value.trim())
																.filter(Boolean);
															setFiltersDraft((prev) => ({
																...(prev as DetailAdvancedFilters),
																entidades: values,
															}));
														}}
														placeholder="Municipalidad, Provincia..."
													/>
												</div>
												<div className="grid grid-cols-2 gap-3">
													<div>
														<Label>Mes básico (año exacto)</Label>
														<Input
															value={(filtersDraft as DetailAdvancedFilters).mesYear}
															onChange={(event) =>
																setFiltersDraft((prev) => ({
																	...(prev as DetailAdvancedFilters),
																	mesYear: event.target.value,
																}))
															}
															placeholder="Ej: 2023"
														/>
													</div>
													<div>
														<Label>Mes básico contiene</Label>
														<Input
															value={(filtersDraft as DetailAdvancedFilters).mesContains}
															onChange={(event) =>
																setFiltersDraft((prev) => ({
																	...(prev as DetailAdvancedFilters),
																	mesContains: event.target.value,
																}))
															}
															placeholder="Ej: enero"
														/>
													</div>
												</div>
												<div className="grid grid-cols-2 gap-3">
													<div>
														<Label>Iniciación (año)</Label>
														<Input
															value={(filtersDraft as DetailAdvancedFilters).iniYear}
															onChange={(event) =>
																setFiltersDraft((prev) => ({
																	...(prev as DetailAdvancedFilters),
																	iniYear: event.target.value,
																}))
															}
														/>
													</div>
													<div>
														<Label>Iniciación contiene</Label>
														<Input
															value={(filtersDraft as DetailAdvancedFilters).iniContains}
															onChange={(event) =>
																setFiltersDraft((prev) => ({
																	...(prev as DetailAdvancedFilters),
																	iniContains: event.target.value,
																}))
															}
														/>
													</div>
												</div>
												<div className="grid grid-cols-2 gap-3">
													{[
														["cmaMin", "cmaMax", "Contrato + Ampliaciones"],
														["cafMin", "cafMax", "Certificado a la fecha"],
														["sacMin", "sacMax", "Saldo a certificar"],
														["scMin", "scMax", "Según contrato"],
														["paMin", "paMax", "Prórrogas acordadas"],
														["ptMin", "ptMax", "Plazo total"],
														["ptrMin", "ptrMax", "Plazo total transc."],
													].map(([minKey, maxKey, label]) => (
														<div key={minKey} className="col-span-2">
															<Label>{label}</Label>
															<div className="grid grid-cols-2 gap-3 mt-1">
																<Input
																	placeholder="Mínimo"
																	value={(filtersDraft as DetailAdvancedFilters)[minKey as keyof DetailAdvancedFilters] as string}
																	onChange={(event) =>
																		setFiltersDraft((prev) => ({
																			...(prev as DetailAdvancedFilters),
																			[minKey]: event.target.value,
																		}))
																	}
																/>
																<Input
																	placeholder="Máximo"
																	value={(filtersDraft as DetailAdvancedFilters)[maxKey as keyof DetailAdvancedFilters] as string}
																	onChange={(event) =>
																		setFiltersDraft((prev) => ({
																			...(prev as DetailAdvancedFilters),
																			[maxKey]: event.target.value,
																		}))
																	}
																/>
															</div>
														</div>
													))}
												</div>
											</>
										) : (
											<>
												<div className="space-y-2">
													<Label htmlFor="status-filter">Estado</Label>
													<Select
														value={(filtersDraft as SimpleAdvancedFilters).status}
														onValueChange={(value) =>
															setFiltersDraft((prev) => ({
																...(prev as SimpleAdvancedFilters),
																status: value as SimpleAdvancedFilters["status"],
															}))
														}
													>
														<SelectTrigger id="status-filter">
															<SelectValue placeholder="Cualquier estado" />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="any">Cualquiera</SelectItem>
															<SelectItem value="activo">Activo</SelectItem>
															<SelectItem value="inactivo">Inactivo</SelectItem>
															<SelectItem value="pendiente">Pendiente</SelectItem>
														</SelectContent>
													</Select>
												</div>
												<div className="space-y-2">
													<Label htmlFor="tag-filter">Etiquetas que contienen</Label>
													<Input
														id="tag-filter"
														value={(filtersDraft as SimpleAdvancedFilters).tagIncludes}
														onChange={(event) =>
															setFiltersDraft((prev) => ({
																...(prev as SimpleAdvancedFilters),
																tagIncludes: event.target.value,
															}))
														}
														placeholder="Ej: arquitectura"
													/>
												</div>
												<div className="space-y-2">
													<Label>Rango de precio</Label>
													<div className="grid grid-cols-2 gap-3">
														<Input
															type="number"
															placeholder="Mínimo"
															value={(filtersDraft as SimpleAdvancedFilters).minPrice}
															onChange={(event) =>
																setFiltersDraft((prev) => ({
																	...(prev as SimpleAdvancedFilters),
																	minPrice: event.target.value,
																}))
															}
														/>
														<Input
															type="number"
															placeholder="Máximo"
															value={(filtersDraft as SimpleAdvancedFilters).maxPrice}
															onChange={(event) =>
																setFiltersDraft((prev) => ({
																	...(prev as SimpleAdvancedFilters),
																	maxPrice: event.target.value,
																}))
															}
														/>
													</div>
												</div>
											</>
										)}
									</div>
									<SheetFooter className="mt-6 gap-2">
											<Button type="button" variant="outline" onClick={handleResetAdvancedFilters}>
												Reiniciar
											</Button>
											<Button type="button" onClick={handleApplyAdvancedFilters}>
												Aplicar
											</Button>
										</SheetFooter>
									</SheetContent>
								</Sheet>
								<ColumnVisibilityMenu
									columns={columns.map((column) => ({
										id: column.id,
										label: column.label,
										canHide: column.enableHide !== false,
										canPin: column.enablePin !== false,
									}))}
									hiddenColumns={hiddenColumnIds}
									setHiddenColumns={setHiddenColumnIds}
									pinnedColumns={pinnedColumnIds}
									togglePin={togglePinColumn}
									onBalanceColumns={handleBalanceColumns}
									disabled={false}
								/>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								{sortState.columnId && (
									<Button type="button" variant="ghost" size="sm" className="gap-1" onClick={clearSort}>
										<Minus className="h-4 w-4" />
										Limpiar orden
									</Button>
								)}
								<Button
									type="button"
									onClick={handleSave}
									disabled={!hasUnsavedChanges || isSaving}
									variant={hasUnsavedChanges ? "default" : "outline"}
									className="gap-2"
								>
									{isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
									{isSaving ? "Guardando..." : "Guardar cambios"}
								</Button>
								<Button type="button" onClick={handleAddRow}>
									Agregar fila vacía
								</Button>
							</div>
						</div>

						{dataSource === "obras" && serverError && (
							<div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
								{serverError}
							</div>
						)}

						<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
							<TabsList>
								{tabFilters.map((tab) => (
									<TabsTrigger key={tab.id} value={tab.id} className="gap-2">
										<span>{tab.label}</span>
										<span className="rounded-full bg-muted px-2 py-0.5 text-xs">
											{tabCounts[tab.id] ?? 0}
										</span>
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>

						{/* Table */}
						<div className="relative border border-border rounded-lg overflow-x-auto w-full bg-white">
							{isServerPaging && isFetchingServerRows && (
								<div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm">
									<Loader2 className="h-6 w-6 animate-spin text-primary" />
									<p className="text-sm font-medium text-muted-foreground">Sincronizando con el servidor…</p>
								</div>
							)}
							<div className="max-h-[70vh] overflow-auto bg-[repeating-linear-gradient(-60deg,transparent_0%,transparent_5px,var(--border)_5px,var(--border)_6px,transparent_6px)] bg-repeat">
								<table ref={tableRef} data-table-id={TABLE_ID} className="w-full table-fixed text-sm">
									<colgroup>
										{columns.map((column, index) => (
											// eslint-disable-next-line jsx-a11y/aria-role
											<col
												key={column.id}
												ref={(el) => {
													colRefs.current[index] = el;
												}}
												style={{
													width: `${colWidths[index] ?? DEFAULT_COL_WIDTH}px`,
													display: isColumnHidden(column.id) ? "none" : undefined,
												}}
											/>
										))}
										<col
											ref={(el) => {
												colRefs.current[columns.length] = el;
											}}
											style={{
												width: `${colWidths[columns.length] ?? 140}px`,
											}}
										/>
									</colgroup>
									<thead className="sticky top-0 z-30 bg-sidebar">
										{/* Header Groups Row */}
										<tr>
											{(() => {
												const emittedGroups = new Set<string>();
												return (
													<>
														{columns.map((column) => {
															if (isColumnHidden(column.id)) return null;
															const group = groupedColumnLookup.get(column.id);
															if (!group) {
																return (
																	<th
																		key={`no-group-${column.id}`}
																		rowSpan={2}
																		{...getStickyProps(
																			column.id,
																			"relative px-4 py-4 text-left text-xs font-semibold uppercase outline outline-border bg-sidebar"
																		)}
																	>
																		<div className="flex w-full h-full px-4 py-3 absolute top-0 left-0 items-center justify-between gap-2">
																			<ContextMenu>
																				<ContextMenuTrigger asChild>
																					<button
																						type="button"
																						onClick={() => toggleSort(column.id)}
																						className="flex w-full items-center justify-between gap-2 text-left"
																					>
																						<span>{column.label}</span>
																						<span className="text-muted-foreground">
																							{sortState.columnId === column.id ? (
																								sortState.direction === "asc" ? (
																									<ArrowUp className="h-3.5 w-3.5" />
																								) : (
																									<ArrowDown className="h-3.5 w-3.5" />
																								)
																							) : (
																								<ArrowUpDown className="h-3.5 w-3.5" />
																							)}
																						</span>
																					</button>
																				</ContextMenuTrigger>
																				<ContextMenuContent>
																					<ContextMenuItem onClick={() => applySortDirection(column.id, "asc")}>
																						Orden ascendente
																					</ContextMenuItem>
																					<ContextMenuItem onClick={() => applySortDirection(column.id, "desc")}>
																						Orden descendente
																					</ContextMenuItem>
																					<ContextMenuItem onClick={clearSort}>
																						Quitar orden
																					</ContextMenuItem>
																				</ContextMenuContent>
																			</ContextMenu>
																		</div>
																		<ColumnResizer
																			tableId={TABLE_ID}
																			colIndex={columnIndexMap[column.id]}
																			mode="fixed"
																		/>
																	</th>
																);
															}

															if (emittedGroups.has(group.id)) return null;
															emittedGroups.add(group.id);
															const visibleColumns = group.columns.filter(
																(columnId) => !isColumnHidden(columnId)
															);
															if (visibleColumns.length === 0) return null;

															return (
																<th
																	key={`group-${group.id}`}
																	colSpan={visibleColumns.length}
																	className={cn(
																		"px-4 py-2 text-center text-xs font-semibold uppercase outline outline-border bg-muted",
																		group.className
																	)}
																>
																	{group.label}
																</th>
															);
														})}
														<th
															rowSpan={2}
															className="relative px-4 py-4 text-right text-xs font-semibold uppercase outline outline-border bg-sidebar"
														>
															<div className="flex w-full h-full px-4 py-3 absolute top-0 left-0 items-center justify-end gap-2">
																<span>Acciones</span>
															</div>
															<ColumnResizer
																tableId={TABLE_ID}
																colIndex={columns.length}
																mode="fixed"
															/>
														</th>
													</>
												);
											})()}
										</tr>

										{/* Individual Column Headers Row */}
										<tr>
											{columns.map((column, colIndex) => {
												if (isColumnHidden(column.id)) return null;
												if (!groupedColumnLookup.has(column.id)) return null;

												const baseClassName = cn(
													"relative px-4 py-4 text-left text-xs font-semibold uppercase outline outline-border bg-sidebar"
												);

												return (
													<th key={column.id} {...getStickyProps(column.id, baseClassName)}>
														<div className="flex w-full h-full px-4 py-3 absolute top-0 left-0 items-center justify-between gap-2">
															<ContextMenu>
																<ContextMenuTrigger asChild>
																	<button
																		type="button"
																		onClick={() => toggleSort(column.id)}
																		className="flex w-full items-center justify-between gap-2 text-left"
																	>
																		<span>{column.label}</span>
																		<span className="text-muted-foreground">
																			{sortState.columnId === column.id ? (
																				sortState.direction === "asc" ? (
																					<ArrowUp className="h-3.5 w-3.5" />
																				) : (
																					<ArrowDown className="h-3.5 w-3.5" />
																				)
																			) : (
																				<ArrowUpDown className="h-3.5 w-3.5" />
																			)}
																		</span>
																	</button>
																</ContextMenuTrigger>
																<ContextMenuContent>
																	<ContextMenuItem onClick={() => applySortDirection(column.id, "asc")}>
																		Orden ascendente
																	</ContextMenuItem>
																	<ContextMenuItem onClick={() => applySortDirection(column.id, "desc")}>
																		Orden descendente
																	</ContextMenuItem>
																	<ContextMenuItem onClick={clearSort}>
																		Quitar orden
																	</ContextMenuItem>
																</ContextMenuContent>
															</ContextMenu>
														</div>
														<ColumnResizer tableId={TABLE_ID} colIndex={colIndex} mode="fixed" />
													</th>
												);
											})}
										</tr>
									</thead>
									<tbody className="bg-white">
										{table.getRowModel().rows.length === 0 ? (
											<tr>
												<td
													colSpan={columns.length + 1}
													className="px-6 py-12 text-center text-sm text-muted-foreground"
												>
													No encontramos filas que coincidan con tu búsqueda o filtros. Ajusta los criterios o agrega una nueva fila vacía para comenzar.
												</td>
											</tr>
										) : (
											table.getRowModel().rows.map((row, rowIndex) => {
												const { dirty, cells } = isRowDirty(row.original.id);
												const dirtyCellIds = new Set(cells.map((cell) => cell.id));
												const hasInitialRow = Boolean(initialValuesRef.current.rowsById[row.original.id]);
												return (
													<tr
														key={row.original.id}
														className={cn(
															"border-b transition-colors duration-150 group relative",
															rowIndex % 2 === 0 ? "bg-white" : "bg-[hsl(50,17%,98%)]",
															dirty ? "bg-amber-50/60 group/row-dirty" : ""
														)}
													>
														{row.getVisibleCells().map((cell) => {
															const columnId = cell.column.id;
															const columnMeta = columnsById[columnId];
															if (!columnMeta) return null;
															const cellDirty =
																dirtyCellIds.has(columnId) || isCellDirty(row.original.id, columnMeta);
															const baseClassName = cn(
																"outline outline-border border-border relative group-hover:bg-[hsl(50,17%,95%)]",
																rowIndex % 2 === 0 ? "bg-white" : "bg-[hsl(50,17%,98%)]"
															);
															return (
																<td key={cell.id} {...getStickyProps(columnId, baseClassName)}>
																	{renderCellByType({
																		column: columnMeta,
																		row: row.original,
																		rowId: row.original.id,
																		FieldComponent,
																		highlightQuery,
																		isCellDirty: cellDirty,
																		isRowDirty: dirty,
																		onCopyCell: handleCopyCell,
																		onCopyColumn: () => handleCopyColumn(columnMeta),
																		onCopyRow: () => handleCopyRow(row.original),
																		onClearValue:
																			columnMeta.editable === false
																				? undefined
																				: () => handleClearCell(row.original.id, columnMeta),
																		onRestoreValue:
																			cellDirty && hasInitialRow
																				? () => handleRestoreCell(row.original.id, columnMeta)
																				: undefined,
																		canRestore: cellDirty && hasInitialRow,
																		customMenuItems: columnMeta.cellMenuItems,
																	})}
																</td>
															);
														})}
														<td
															className={cn(
																"px-4 py-3 text-right outline outline-border border-border group-hover:bg-[hsl(50,17%,95%)] space-y-2",
																rowIndex % 2 === 0 ? "bg-white" : "bg-[hsl(50,17%,98%)]"
															)}
														>
															{dirty && (
																<Tooltip>
																	<TooltipTrigger asChild>
																		<div className="text-[10px] uppercase tracking-wide absolute p-0 h-5 text-transparent group-hover/row-dirty:text-primary group-hover/row-dirty:px-2 group-hover/row-dirty:py-1 group-hover/row-dirty:max-h-5 group-hover/row-dirty:-top-5 max-h-2 top-0 left-0 z-[100] bg-amber-500/50 group-hover/row-dirty:rounded-t-sm group-hover/row-dirty:rounded-b-none rounded-b-sm transition-all duration-150">
																			Sin guardar
																		</div>
																	</TooltipTrigger>
																	<TooltipContent>
																		Los cambios de esta fila aún no han sido guardados. <br /><br /> Ha modificado las columnas:
																		<ul>
																			{cells.map((cell) => <li key={cell.id}><Badge variant="secondary" className="text-[10px] uppercase tracking-wide">{cell.label}</Badge></li>)}
																		</ul>
																	</TooltipContent>
																</Tooltip>
															)}
															<Button
																type="button"
																variant="ghost"
																size="sm"
																onClick={() => handleDelete(row.original.id)}
																className="text-destructive hover:text-destructive"
															>
																Eliminar
															</Button>
														</td>
													</tr>
												);
											})
										)}
									</tbody>
								</table>
							</div>
						</div>

						<div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
							<div className="flex items-center gap-2">
								<span>Filas por página</span>
								<Select
									value={String(pageSize)}
									onValueChange={(value) => {
										setPageSize(Number(value));
										setPage(1);
									}}
								>
									<SelectTrigger className="w-[90px]">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{PAGE_SIZE_OPTIONS.map((size) => (
											<SelectItem key={size} value={String(size)}>
												{size}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="flex items-center gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => setPage((prev) => Math.max(1, prev - 1))}
									disabled={!hasPreviousPage || (isServerPaging && isFetchingServerRows)}
									className="gap-1"
								>
									<ChevronLeft className="h-4 w-4" />
									Anterior
								</Button>
								<span className="text-xs text-muted-foreground">
									Página {page} de {totalPages}
								</span>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => setPage((prev) => prev + 1)}
									disabled={!hasNextPage || (isServerPaging && isFetchingServerRows)}
									className="gap-1"
								>
									Siguiente
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>
						</div>

						{totalRowCount > 0 && (
							<div className="flex justify-between items-center text-sm text-muted-foreground">
								<p>
									Mostrando <span className="font-medium text-foreground">{visibleRowCount}</span> de{" "}
									<span className="font-medium text-foreground">{totalRowCount}</span> filas
								</p>
								{activeFilterCount > 0 && (
									<p className="text-xs">
										Filtros activos: <span className="font-medium text-foreground">{activeFilterCount}</span>
									</p>
								)}
							</div>
						)}
					</motion.div>
				</div>
			</div>
		</TooltipProvider>
	);
}
