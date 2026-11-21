import { Profiler, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import {
	FormTable,
	FormTableContent,
	FormTableToolbar,
	FormTableTabs,
	FormTablePagination,
	FormTableBulkEditBar,
	useFormTable,
} from "@/components/form-table/form-table";
import type { FormTableContextValue } from "@/components/form-table/context";
import type {
	ColumnDef,
	FormTableConfig,
	FormTableRow,
	SaveRowsArgs,
} from "@/components/form-table/types";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@/app/globals.css";

type TestRow = FormTableRow & {
	name: string;
	amount: number;
	active: boolean;
	category: string;
	date: string;
	detail: string;
};
type Filters = { activeOnly: boolean };
declare global {
	interface Window {
		table: FormTableContextValue<TestRow, Filters>;
		saved: SaveRowsArgs<TestRow>[];
		failSave: boolean;
		saveDelay: number;
		requests: Array<{ page: number; search?: string; sort?: unknown }>;
		measures: number[];
		renderCount: number;
		setQuery: (query: string) => void;
		setColumns: (columns: ColumnDef<TestRow>[]) => void;
	}
}
window.saved = [];
window.requests = [];
window.measures = [];
window.renderCount = 0;
window.failSave = false;
window.saveDelay = 0;

const params = new URLSearchParams(location.search);
const scenario = params.get("scenario") ?? "client";
const count = Number(params.get("rows") ?? 80);
const dataset: TestRow[] = Array.from({ length: count }, (_, i) => ({
	id: `row-${i}`,
	name: `Obra ${String(i).padStart(5, "0")}`,
	amount: i * 10,
	active: i % 2 === 0,
	category: i % 2 === 0 ? "Público" : "Privado",
	date: "2026-09-07",
	detail: `Detalle ${i}`,
}));
const initialColumns: ColumnDef<TestRow>[] = [
	{
		id: "name",
		field: "name",
		label: "Nombre",
		required: true,
		width: 220,
		cellConfig: {
			renderReadOnly: ({ value }) => {
				window.renderCount++;
				return <span>{String(value)}</span>;
			},
		},
	},
	{ id: "amount", field: "amount", label: "Monto", cellType: "number", width: 140 },
	{ id: "active", field: "active", label: "Activo", cellType: "checkbox", width: 100 },
	{
		id: "category",
		field: "category",
		label: "Tipo",
		cellType: "select",
		width: 160,
		cellConfig: { selectOptions: [{ text: "Público" }, { text: "Privado" }] },
	},
	{ id: "date", field: "date", label: "Fecha", cellType: "date", width: 170 },
];
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function TableContents() {
	const table = useFormTable<TestRow, Filters>();
	useEffect(() => {
		window.table = table;
	}, [table]);
	return (
		<TooltipProvider>
			<div style={{ height: "80vh", display: "flex", flexDirection: "column", gap: 12 }}>
				<FormTableToolbar />
				<FormTableTabs />
				<FormTableBulkEditBar />
				<div style={{ flex: 1, minHeight: 0, display: "flex" }}>
					<FormTableContent />
				</div>
				<FormTablePagination />
			</div>
		</TooltipProvider>
	);
}

function TableBridge() {
	const table = useFormTable<TestRow, Filters>();
	useEffect(() => {
		window.table = table;
	}, [table]);
	return null;
}

function Fixture() {
	const [query, setQuery] = useState("");
	const [columns, setColumns] = useState(initialColumns);
	useEffect(() => {
		window.setQuery = setQuery;
		window.setColumns = setColumns;
	}, []);
	const config = useMemo<FormTableConfig<TestRow, Filters>>(
		() => ({
			tableId: "form-table-test",
			columns,
			toolbarActions: scenario === "default" ? <TableBridge /> : undefined,
			toolbarMode: params.get("toolbar") === "extras" ? "extras" : "default",
			defaultRows: scenario === "server" ? undefined : dataset,
			editMode: scenario === "always" ? "always" : "active-cell",
			readOnly: scenario === "readonly",
			enableRowVirtualization: true,
			enableColumnResizing: true,
			showRowNumbers: scenario !== "grouped",
			headerGroups:
				scenario === "grouped"
					? [{ id: "data", label: "Datos", columns: ["amount", "active"] }]
					: undefined,
			actionsColumnPosition: params.get("actions") === "start" ? "start" : "end",
			defaultPageSize: 25,
			lockedPageSize: scenario === "locked" ? 10 : undefined,
			disablePagination: scenario === "large",
			lockedSort: scenario === "locked" ? { columnId: "amount", direction: "desc" } : undefined,
			dirtyFields: ["detail"],
			revealNewRowOnAdd: true,
			createRow: () => ({
				id: "new-row",
				name: "",
				amount: 0,
				active: false,
				category: "",
				date: "",
				detail: "",
			}),
			createFilters: () => ({ activeOnly: false }),
			countActiveFilters: (filters) => Number(filters.activeOnly),
			applyFilters: (row, filters) => !filters.activeOnly || row.active,
			renderFilters: ({ filters, onChange }) => (
				<label>
					<input
						type="checkbox"
						checked={filters.activeOnly}
						onChange={(e) => onChange((prev) => ({ ...prev, activeOnly: e.target.checked }))}
					/>
					Solo activas
				</label>
			),
			tabFilters: [
				{ id: "all", label: "Todas" },
				{ id: "active", label: "Activas", predicate: (row) => row.active },
			],
			activeTabStorageKey: "form-table-test:tab",
			accordionRow:
				scenario === "accordion"
					? {
							defaultOpen: (row) => row.id === "row-0",
							renderContent: (row, context) => (
								<label>
									Detalle
									<input
										aria-label={`Detalle ${row.id}`}
										value={String(context.getValue("detail"))}
										onChange={(event) => context.setValue("detail", event.target.value)}
									/>
								</label>
							),
						}
					: undefined,
			serverSideData: scenario === "server",
			fetchRows:
				scenario === "server"
					? async (args) => {
							window.requests.push(args);
							await delay(args.search === "slow" ? 600 : 30);
							if (args.search === "error") throw new Error("Error de consulta simulado");
							const filtered = dataset.filter(
								(row) => !args.search || row.name.includes(args.search)
							);
							const sorted = args.sort?.direction === "desc" ? [...filtered].reverse() : filtered;
							return {
								rows: sorted.slice((args.page - 1) * args.limit, args.page * args.limit),
								pagination: {
									page: args.page,
									limit: args.limit,
									total: sorted.length,
									totalPages: Math.ceil(sorted.length / args.limit),
									hasNextPage: args.page * args.limit < sorted.length,
									hasPreviousPage: args.page > 1,
								},
							};
						}
					: undefined,
			onSave: async (args) => {
				await delay(window.saveDelay);
				if (window.failSave) throw new Error("Error de guardado simulado");
				window.saved.push(structuredClone(args));
			},
		}),
		[columns]
	);
	return (
		<div style={{ padding: 24, height: "85vh", fontFamily: "Arial, sans-serif" }}>
			<button id="outside">Fuera de la tabla</button>
			<Profiler id="table" onRender={(_id, _phase, duration) => window.measures.push(duration)}>
				<FormTable
					config={config}
					searchQuery={scenario === "controlled" ? query : undefined}
					onSearchQueryChange={setQuery}
				>
					{scenario === "default" ? undefined : <TableContents />}
				</FormTable>
			</Profiler>
			<Toaster />
		</div>
	);
}
createRoot(document.getElementById("root")!).render(<Fixture />);
