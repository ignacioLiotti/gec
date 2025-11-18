'use client';

import * as React from "react";
import Link from "next/link";
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type ChangeEvent,
	type DragEvent,
} from "react";
import { useForm } from "@tanstack/react-form";
import { obrasFormSchema, type Obra, type ObrasForm } from "./schema";
import { toast } from "sonner";
import { AlertCircle, FileSpreadsheet, Plus, Trash2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import Papa from "papaparse";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ColGroup, ColumnResizer } from "@/components/ui/column-resizer";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SearchInput } from "./_components/SearchInput";
import { ColumnsMenu } from "./_components/ColumnsMenu";
import { ViewsMenu } from "./_components/ViewsMenu";
import { InBodyStates } from "./_components/InBodyStates";
import { CustomInput } from "./_components/CustomInput";
import { ObrasTable } from "./_components/ObrasTable";

const defaultObra: Obra = {
	id: undefined,
	n: 1,
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

const initialData: Obra[] = [
	{
		...defaultObra,
	},
];

const parseCsvNumber = (raw: string | null | undefined): number => {
	if (!raw) return 0;
	const cleaned = raw
		.replace(/\s+/g, "")
		.replace(/[^\d,.\-]/g, "")
		.replace(/\./g, "")
		.replace(",", ".");
	const result = Number(cleaned);
	return Number.isFinite(result) ? result : 0;
};

const normalizeCsvString = (raw: string | null | undefined): string => {
	return raw ? raw.trim() : "";
};

export default function ExcelPage() {
	const [isLoading, setIsLoading] = useState(true);
	const [activeTab, setActiveTab] =
		useState<"in-process" | "completed">("in-process");
	const [showCsvImport, setShowCsvImport] = useState(false);
	const [isDraggingCsv, setIsDraggingCsv] = useState(false);
	const [csvImportError, setCsvImportError] = useState<string | null>(null);
	const csvInputRef = useRef<HTMLInputElement | null>(null);
	const [rowsSnapshot, setRowsSnapshot] = useState<Obra[]>(initialData);

	// Server-side sorting & global search
	const COLUMN_TO_DB: Record<number, string> = {
		0: "n",
		1: "designacion_y_ubicacion",
		2: "sup_de_obra_m2",
		3: "entidad_contratante",
		4: "mes_basico_de_contrato",
		5: "iniciacion",
		6: "contrato_mas_ampliaciones",
		7: "certificado_a_la_fecha",
		8: "saldo_a_certificar",
		9: "segun_contrato",
		10: "prorrogas_acordadas",
		11: "plazo_total",
		12: "plazo_transc",
		13: "porcentaje",
	};
	const [orderBy, setOrderBy] = useState<string>("n");
	const [orderDir, setOrderDir] = useState<"asc" | "desc">("asc");
	const [query, setQuery] = useState("");
	const [filtersVersion, setFiltersVersion] = useState(0);

	const setSortByColumn = useCallback((colIndex: number) => {
		const db = COLUMN_TO_DB[colIndex];
		if (!db) return;
		const nextDir = orderBy === db ? (orderDir === "asc" ? "desc" : "asc") : "asc";
		setOrderBy(db);
		setOrderDir(nextDir);
	}, [orderBy, orderDir]);

	// Advanced filters state
	type FiltersState = {
		supMin: string; supMax: string;
		entidades: string[];
		mesYear: string; mesContains: string;
		iniYear: string; iniContains: string;
		cmaMin: string; cmaMax: string;
		cafMin: string; cafMax: string;
		sacMin: string; sacMax: string;
		scMin: string; scMax: string;
		paMin: string; paMax: string;
		ptMin: string; ptMax: string;
		ptrMin: string; ptrMax: string;
	};
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [filters, setFilters] = useState<FiltersState>({
		supMin: "", supMax: "",
		entidades: [],
		mesYear: "", mesContains: "",
		iniYear: "", iniContains: "",
		cmaMin: "", cmaMax: "",
		cafMin: "", cafMax: "",
		sacMin: "", sacMax: "",
		scMin: "", scMax: "",
		paMin: "", paMax: "",
		ptMin: "", ptMax: "",
		ptrMin: "", ptrMax: "",
	});

	const applyFiltersToParams = useCallback((params: URLSearchParams) => {
		const addNum = (key: keyof FiltersState, name: string) => {
			const v = filters[key] as unknown as string;
			if (v && v.trim() !== "") params.set(name, v.trim());
		};
		addNum("supMin", "supMin"); addNum("supMax", "supMax");
		filters.entidades.forEach((e) => { if (e.trim()) params.append("entidad", e); });
		if (filters.mesYear.trim()) params.set("mesYear", filters.mesYear.trim());
		if (filters.mesContains.trim()) params.set("mesContains", filters.mesContains.trim());
		if (filters.iniYear.trim()) params.set("iniYear", filters.iniYear.trim());
		if (filters.iniContains.trim()) params.set("iniContains", filters.iniContains.trim());
		addNum("cmaMin", "cmaMin"); addNum("cmaMax", "cmaMax");
		addNum("cafMin", "cafMin"); addNum("cafMax", "cafMax");
		addNum("sacMin", "sacMin"); addNum("sacMax", "sacMax");
		addNum("scMin", "scMin"); addNum("scMax", "scMax");
		addNum("paMin", "paMin"); addNum("paMax", "paMax");
		addNum("ptMin", "ptMin"); addNum("ptMax", "ptMax");
		addNum("ptrMin", "ptrMin"); addNum("ptrMax", "ptrMax");
	}, [filters]);

	const allEntidades = (() => {
		const set = new Set<string>();
		for (const obra of rowsSnapshot) {
			if (obra.entidadContratante?.trim()) set.add(obra.entidadContratante.trim());
		}
		return Array.from(set).sort((a, b) => a.localeCompare(b));
	})();

	// Column visibility state (indices 0..13)
	const ALL_COLUMNS: { index: number; label: string }[] = [
		{ index: 0, label: "N°" },
		{ index: 1, label: "Designación y Ubicación" },
		{ index: 2, label: "Sup. de Obra (m2)" },
		{ index: 3, label: "Entidad Contratante" },
		{ index: 4, label: "Mes Básico de Contrato" },
		{ index: 5, label: "Iniciación" },
		{ index: 6, label: "Contrato más Ampliaciones" },
		{ index: 7, label: "Certificado a la Fecha" },
		{ index: 8, label: "Saldo a Certificar" },
		{ index: 9, label: "Según Contrato" },
		{ index: 10, label: "Prórrogas Acordadas" },
		{ index: 11, label: "Plazo Total" },
		{ index: 12, label: "Plazo Total Transcurrido" },
		{ index: 13, label: "%" },
	];

	const [hiddenCols, setHiddenCols] = useState<number[]>([]);
	const isHidden = useCallback((i: number) => hiddenCols.includes(i), [hiddenCols]);

	// Column resize mode: balanced (proportional) vs fixed (independent pixel widths)
	const [resizeMode, setResizeMode] = useState<"balanced" | "fixed">(() => {
		try {
			return localStorage.getItem("excel:resizeMode") === "fixed" ? "fixed" : "balanced";
		} catch { return "balanced"; }
	});
	useEffect(() => {
		try { localStorage.setItem("excel:resizeMode", resizeMode); } catch { }
	}, [resizeMode]);

	// Persist column visibility
	useEffect(() => {
		try {
			const raw = localStorage.getItem("excel:hiddenCols");
			if (raw) {
				const arr = JSON.parse(raw) as number[];
				if (Array.isArray(arr)) setHiddenCols(arr);
			}
		} catch { /* ignore */ }
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	useEffect(() => {
		try {
			localStorage.setItem("excel:hiddenCols", JSON.stringify(hiddenCols));
		} catch { /* ignore */ }
	}, [hiddenCols]);

	// Pin columns (freeze) - array of column indices
	const [pinnedColumns, setPinnedColumns] = useState<number[]>(() => {
		try {
			const raw = localStorage.getItem("excel:pinnedColumns");
			if (raw) {
				const parsed = JSON.parse(raw) as number[];
				return Array.isArray(parsed) ? parsed : [];
			}
			return [];
		} catch { return []; }
	});

	useEffect(() => {
		try {
			localStorage.setItem("excel:pinnedColumns", JSON.stringify(pinnedColumns));
		} catch { /* ignore */ }
	}, [pinnedColumns]);

	const isPinned = useCallback((colIndex: number) => pinnedColumns.includes(colIndex), [pinnedColumns]);

	const togglePinColumn = useCallback((colIndex: number) => {
		setPinnedColumns((prev) => {
			const set = new Set(prev);
			if (set.has(colIndex)) {
				set.delete(colIndex);
			} else {
				set.add(colIndex);
			}
			return Array.from(set).sort((a, b) => a - b);
		});
	}, []);

	useEffect(() => {
		// Hide corresponding <col> elements and redistribute widths across visible columns
		const applyVisibilityToTable = (tableId: string) => {
			const table = document.querySelector(`table[data-table-id="${tableId}"]`);
			if (!table) return;
			const cols = table.querySelectorAll<HTMLTableColElement>("colgroup col");
			const visibleIndexes: number[] = [];
			cols.forEach((col, idx) => {
				const hide = hiddenCols.includes(idx);
				if (hide) {
					col.style.display = "none";
					col.style.width = "0px";
				} else {
					col.style.display = "";
					visibleIndexes.push(idx);
				}
			});

			// Only force percentage sizing in balanced mode
			if (resizeMode === "balanced") {
				if (visibleIndexes.length > 0) {
					const percentage = 100 / visibleIndexes.length;
					visibleIndexes.forEach((idx) => {
						const col = cols[idx] as HTMLTableColElement;
						col.style.width = `${percentage}%`;
					});
				}
			}
		};
		applyVisibilityToTable("excel-table");
	}, [hiddenCols, resizeMode]);

	// Pagination per tab
	const [inProcPage, setInProcPage] = useState(1);
	const [inProcLimit, setInProcLimit] = useState(10);
	const [compPage, setCompPage] = useState(1);
	const [compLimit, setCompLimit] = useState(10);

	const getErrorMessage = (errors: unknown): string => {
		if (!errors) return "";
		if (Array.isArray(errors)) {
			const first = errors[0] as any;
			if (typeof first === "string") return first;
			if (first && typeof first === "object" && "message" in first)
				return String(first.message);
			return JSON.stringify(first);
		}
		if (typeof errors === "object" && errors !== null) {
			const anyErr: any = errors;
			if ("message" in anyErr) return String(anyErr.message);
			return JSON.stringify(anyErr);
		}
		return String(errors);
	};

	const form = useForm({
		defaultValues: {
			detalleObras: initialData,
		} as ObrasForm,
		validators: {
			onChange: obrasFormSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				const response = await fetch("/api/obras", {
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(value),
				});

				if (!response.ok) {
					const result = await response.json().catch(() => ({}));
					throw new Error(result.error ?? "Error al guardar las obras");
				}

				toast.success("Obras guardadas exitosamente");

				try {
					const params = new URLSearchParams();
					params.set("orderBy", orderBy);
					params.set("orderDir", orderDir);
					if (query.trim()) params.set("q", query.trim());
					applyFiltersToParams(params);
					applyFiltersToParams(params);
					const qs = params.toString();
					const [rIn, rCo] = await Promise.all([
						fetch(`/api/obras?status=in-process${qs ? `&${qs}` : ""}`),
						fetch(`/api/obras?status=completed${qs ? `&${qs}` : ""}`),
					]);
					if (rIn.ok && rCo.ok) {
						const [dIn, dCo] = await Promise.all([rIn.json(), rCo.json()]);
						const inProc = Array.isArray(dIn?.detalleObras) ? dIn.detalleObras : [];
						const completed = Array.isArray(dCo?.detalleObras) ? dCo.detalleObras : [];
						form.setFieldValue(
							"detalleObras",
							[...inProc, ...completed],
						);
						setRowsSnapshot([...inProc, ...completed]);
					}
				} catch (refreshError) {
					console.error("Error refrescando obras", refreshError);
					toast.info(
						"Las obras se guardaron, pero no se pudieron refrescar los datos.",
					);
				}
			} catch (error) {
				console.error(error);
				toast.error(
					error instanceof Error
						? error.message
						: "Ocurrió un error al guardar las obras",
				);
			}
		},
	});

	useEffect(() => {
		let isMounted = true;

		async function loadObras() {
			try {
				setTableError(null);
				const params = new URLSearchParams();
				params.set("orderBy", orderBy);
				params.set("orderDir", orderDir);
				if (query.trim()) params.set("q", query.trim());
				applyFiltersToParams(params);
				const qs = params.toString();
				const [respInProc, respCompleted] = await Promise.all([
					fetch(`/api/obras?status=in-process${qs ? `&${qs}` : ""}`),
					fetch(`/api/obras?status=completed${qs ? `&${qs}` : ""}`),
				]);

				if (!respInProc.ok || !respCompleted.ok) {
					throw new Error("No se pudieron cargar las obras");
				}

				const [dataInProc, dataCompleted] = await Promise.all([
					respInProc.json(),
					respCompleted.json(),
				]);

				const inProc = Array.isArray(dataInProc?.detalleObras)
					? dataInProc.detalleObras
					: [];
				const completed = Array.isArray(dataCompleted?.detalleObras)
					? dataCompleted.detalleObras
					: [];

				if (isMounted) {
					const merged = [...inProc, ...completed];
					form.setFieldValue("detalleObras", merged);
					setRowsSnapshot(merged);
					setTableError(null);
				}
			} catch (error) {
				console.error(error);
				if (isMounted) {
					setTableError(error instanceof Error ? error.message : "No se pudieron cargar las obras");
				}
				if (isMounted) {
					toast.error(
						error instanceof Error
							? error.message
							: "No se pudieron cargar las obras",
					);
				}
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		}

		loadObras();

		return () => {
			isMounted = false;
		};
	}, [form, orderBy, orderDir, query, filtersVersion]);


	const importCsvText = useCallback(
		(text: string) => {
			const parsed = Papa.parse<string[]>(text, {
				delimiter: ";",
				skipEmptyLines: true,
			});

			const normalizedRows = parsed.data
				.map((row) => (row ?? []).map((cell) => normalizeCsvString(cell)))
				.filter((row) => row.some((cell) => cell.length > 0));

			const dataRows = normalizedRows.filter((row) => {
				const firstCell = row[0] ?? "";
				const description = row[1] ?? "";
				return /^\d+/.test(firstCell) && description.trim().length > 0;
			});

			if (dataRows.length === 0) {
				throw new Error("No se encontraron filas válidas en el CSV");
			}

			const obras = dataRows.map((row, index) => {
				const padded = [...row];
				while (padded.length < 15) {
					padded.push("");
				}

				const rawNumber = (padded[0] ?? "").replace(/[^\d-]/g, "");
				const parsedN = Number.parseInt(rawNumber, 10);
				const originalN = Number.isFinite(parsedN) && parsedN > 0 ? parsedN : null;
				const n = index + 1;
				const porcentaje = parseCsvNumber(padded[14]);

				const designacion = normalizeCsvString(padded[1]);
				const designacionYUbicacion =
					originalN && originalN !== n
						? `[${originalN}] ${designacion}`
						: designacion;

				const obra: Obra = {
					id: undefined,
					n,
					designacionYUbicacion,
					supDeObraM2: parseCsvNumber(padded[2]),
					entidadContratante: normalizeCsvString(padded[3]),
					mesBasicoDeContrato: normalizeCsvString(padded[4]),
					iniciacion: normalizeCsvString(padded[6]),
					contratoMasAmpliaciones: parseCsvNumber(padded[7]),
					certificadoALaFecha: parseCsvNumber(padded[8]),
					saldoACertificar: parseCsvNumber(padded[9]),
					segunContrato: parseCsvNumber(padded[10]),
					prorrogasAcordadas: parseCsvNumber(padded[11]),
					plazoTotal: parseCsvNumber(padded[12]),
					plazoTransc: parseCsvNumber(padded[13]),
					porcentaje: Math.max(0, Math.min(100, porcentaje)),
					onFinishFirstMessage: null,
					onFinishSecondMessage: null,
					onFinishSecondSendAt: null,
				};

				return obra;
			});

			form.setFieldValue("detalleObras", obras);
			setCsvImportError(null);
			setShowCsvImport(false);
			setIsDraggingCsv(false);

			const completedCount = obras.filter((obra) => obra.porcentaje === 100)
				.length;
			const inProcessCount = obras.length - completedCount;

			setActiveTab((current) => {
				if (current === "in-process" && inProcessCount > 0) {
					return "in-process";
				}
				if (current === "completed" && completedCount > 0) {
					return "completed";
				}
				if (inProcessCount > 0) {
					return "in-process";
				}
				if (completedCount > 0) {
					return "completed";
				}
				return "in-process";
			});

			toast.success(`Se importaron ${obras.length} obras desde CSV`);
		},
		[form],
	);

	const handleCsvFiles = useCallback(
		async (files: FileList | null) => {
			const file = files?.[0];
			if (!file) return;

			try {
				const buffer = await file.arrayBuffer();
				let text: string;
				try {
					text = new TextDecoder("windows-1252").decode(buffer);
				} catch {
					text = new TextDecoder().decode(buffer);
				}
				importCsvText(text);
				setCsvImportError(null);
			} catch (error) {
				console.error("Error importando CSV", error);
				const message =
					error instanceof Error
						? error.message
						: "No se pudo importar el CSV";
				setCsvImportError(message);
				toast.error(message);
			} finally {
				if (csvInputRef.current) {
					csvInputRef.current.value = "";
				}
			}
		},
		[importCsvText],
	);

	const handleCsvInputChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			void handleCsvFiles(event.target.files);
		},
		[handleCsvFiles],
	);

	const handleCsvDrop = useCallback(
		(event: DragEvent<HTMLDivElement>) => {
			event.preventDefault();
			event.stopPropagation();
			setIsDraggingCsv(false);
			setCsvImportError(null);
			void handleCsvFiles(event.dataTransfer.files);
		},
		[handleCsvFiles],
	);

	const handleCsvDragOver = useCallback(
		(event: DragEvent<HTMLDivElement>) => {
			event.preventDefault();
			event.stopPropagation();
			if (!isDraggingCsv) {
				setIsDraggingCsv(true);
			}
		},
		[isDraggingCsv],
	);

	const handleCsvDragLeave = useCallback(
		(event: DragEvent<HTMLDivElement>) => {
			event.preventDefault();
			event.stopPropagation();
			setIsDraggingCsv(false);
		},
		[],
	);

	// Helpers: clipboard and row actions (context menu)
	const copyToClipboard = useCallback(async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			toast.success("Copiado al portapapeles");
		} catch {
			toast.error("No se pudo copiar");
		}
	}, []);

	const obraToCsv = useCallback((obra: Obra) => {
		const values = [
			obra.n ?? "",
			obra.designacionYUbicacion ?? "",
			obra.supDeObraM2 ?? "",
			obra.entidadContratante ?? "",
			obra.mesBasicoDeContrato ?? "",
			obra.iniciacion ?? "",
			obra.contratoMasAmpliaciones ?? "",
			obra.certificadoALaFecha ?? "",
			obra.saldoACertificar ?? "",
			obra.segunContrato ?? "",
			obra.prorrogasAcordadas ?? "",
			obra.plazoTotal ?? "",
			obra.plazoTransc ?? "",
			obra.porcentaje ?? "",
		];
		return values.map((v) => String(v).replaceAll(";", ",")).join(";");
	}, []);

	// Field mapping by column index (0..13)
	const FIELD_BY_INDEX: (keyof Obra)[] = [
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
	];

	// Fuzzy highlight utility (very light)
	const highlightText = useCallback((text: string, q: string) => {
		if (!q.trim()) return text;
		try {
			const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			const regex = new RegExp(`(${escaped})`, "ig");
			return text.split(regex).map((part, i) =>
				regex.test(part) ? `<mark>${part}</mark>` : part,
			).join("");
		} catch {
			return text;
		}
	}, []);

	// In-body table states and expansion
	const [tableError, setTableError] = useState<string | null>(null);

	// Saved views (visibility, pin, query, filters)
	type SavedView = { name: string; hiddenCols: number[]; pinnedColumns: number[]; query: string; filters: FiltersState };
	const loadViews = (): SavedView[] => {
		try {
			const raw = localStorage.getItem("excel:views");
			const parsed = raw ? (JSON.parse(raw) as SavedView[]) : [];
			return Array.isArray(parsed) ? parsed : [];
		} catch { return []; }
	};
	const saveViews = (views: SavedView[]) => {
		try { localStorage.setItem("excel:views", JSON.stringify(views)); } catch { /* ignore */ }
	};
	const [views, setViews] = useState<SavedView[]>(() => loadViews());
	const saveCurrentAsView = useCallback(() => {
		const name = window.prompt("Nombre de la vista:");
		if (!name) return;
		const nextViews = [...views.filter(v => v.name !== name), { name, hiddenCols, pinnedColumns, query, filters }];
		setViews(nextViews);
		saveViews(nextViews);
		toast.success("Vista guardada");
	}, [views, hiddenCols, pinnedColumns, query, filters]);
	const applyView = useCallback((v: SavedView) => {
		setHiddenCols(v.hiddenCols || []);
		setPinnedColumns(v.pinnedColumns || []);
		setQuery(v.query || "");
		setFilters(v.filters || filters);
		setFiltersVersion((x) => x + 1);
	}, [filters]);
	const deleteView = useCallback((name: string) => {
		const next = views.filter(v => v.name !== name);
		setViews(next);
		saveViews(next);
	}, [views]);

	return (
		<div className="w-full mx-auto p-6 space-y-6 pt-0">
			{/* <div className="space-y-2">
				<p className="text-sm text-muted-foreground">
					Gestión de obras
				</p>
				<h1 className="text-4xl font-bold tracking-tight">
					Detalle de las Obras en Ejecución
				</h1>
			</div> */}


			{showCsvImport && (
				<div
					className={cn(
						"mb-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all duration-300",
						isDraggingCsv
							? "border-primary bg-primary/10 shadow-lg scale-[1.02]"
							: "border-muted-foreground/30 bg-muted/40 hover:border-muted-foreground/50 hover:bg-muted/60",
					)}
					onDragEnter={handleCsvDragOver}
					onDragOver={handleCsvDragOver}
					onDragLeave={handleCsvDragLeave}
					onDrop={handleCsvDrop}
					onClick={() => csvInputRef.current?.click()}
					role="button"
					tabIndex={0}
					onKeyDown={(event) => {
						if (event.key === "Enter" || event.key === " ") {
							event.preventDefault();
							csvInputRef.current?.click();
						}
					}}
				>
					<CustomInput
						ref={csvInputRef}
						type="file"
						accept=".csv,text/csv"
						className="hidden"
						onChange={handleCsvInputChange}
					/>
					<div className="flex flex-col items-center gap-3">
						<div className={cn(
							"flex h-16 w-16 items-center justify-center rounded-full transition-colors",
							isDraggingCsv ? "bg-primary/20" : "bg-muted"
						)}>
							<Upload className={cn(
								"h-8 w-8 transition-colors",
								isDraggingCsv ? "text-primary" : "text-muted-foreground"
							)} />
						</div>
						<div className="space-y-2">
							<p className="text-sm font-medium">
								Arrastrá y soltá un archivo CSV o hacé clic para seleccionarlo
							</p>
							<p className="text-xs text-muted-foreground">
								Usá el formato del archivo de ejemplo ubicado en{" "}
								<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">app/excel/Libro1.csv</code>
							</p>
						</div>
						{csvImportError && (
							<div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
								<AlertCircle className="h-4 w-4" />
								<span>{csvImportError}</span>
							</div>
						)}
					</div>
				</div>
			)}

			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "in-process" | "completed")} className="w-full">

					<div className="flex flex-wrap justify-between items-center gap-4 mb-6">
						<TabsList>
							<TabsTrigger value="in-process" className="gap-2">
								En proceso
							</TabsTrigger>
							<TabsTrigger value="completed" className="gap-2">
								Completadas
							</TabsTrigger>
						</TabsList>

						<div className="flex flex-wrap gap-2 items-center">
							<SearchInput value={query} onChange={setQuery} />
							<Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
								<SheetTrigger asChild>
									<Button variant="outline" size="sm" className="gap-2">
										<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
										Filtros
									</Button>
								</SheetTrigger>
								<SheetContent side="right" className="sm:w-[30vw] sm:max-w-[90vw] my-auto max-h-[96vh] overflow-y-auto px-6 py-7">
									<SheetHeader className="space-y-2 p-0">
										<SheetTitle className="text-xl">Filtros avanzados</SheetTitle>
										<p className="text-sm text-muted-foreground">Refiná los resultados aplicando múltiples criterios</p>
									</SheetHeader>
									<div className="mt-6 space-y-6 max-h-[90vh] overflow-y-auto">
										<div className="space-y-3 rounded-lg border p-4">
											<div className="text-sm font-semibold">Sup. de Obra (m²)</div>
											<div className="flex items-center gap-2">
												<Input type="number" placeholder="Mín" value={filters.supMin} onChange={(e) => setFilters((f) => ({ ...f, supMin: e.target.value }))} className="text-sm" />
												<span className="text-muted-foreground">a</span>
												<Input type="number" placeholder="Máx" value={filters.supMax} onChange={(e) => setFilters((f) => ({ ...f, supMax: e.target.value }))} className="text-sm" />
											</div>
										</div>

										<div className="space-y-3 rounded-lg border p-4">
											<div className="text-sm font-semibold">Entidad contratante</div>
											<div className="flex flex-wrap gap-2 max-h-32 overflow-auto pr-1">
												{allEntidades.length === 0 ? (
													<p className="text-xs text-muted-foreground py-2">No hay entidades disponibles</p>
												) : (
													allEntidades.map((ent) => {
														const active = filters.entidades.includes(ent);
														return (
															<button
																key={ent}
																type="button"
																onClick={() => setFilters((f) => ({ ...f, entidades: active ? f.entidades.filter((e) => e !== ent) : [...f.entidades, ent] }))}
																className={cn(
																	"inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-all",
																	active
																		? 'bg-primary text-primary-foreground border-primary shadow-sm'
																		: 'bg-background text-foreground hover:bg-muted border-border'
																)}
															>
																{ent}
															</button>
														);
													})
												)}
											</div>
										</div>

										<div className="space-y-3 rounded-lg border p-4">
											<div className="text-sm font-semibold">Fechas</div>
											<div className="space-y-4">
												<div className="space-y-2">
													<div className="text-xs font-medium text-muted-foreground">Mes básico de contrato</div>
													<div className="flex items-center gap-2">
														<Input placeholder="Año (ej: 2024)" value={filters.mesYear} onChange={(e) => setFilters((f) => ({ ...f, mesYear: e.target.value }))} className="text-sm" />
														<Input placeholder="Contiene..." value={filters.mesContains} onChange={(e) => setFilters((f) => ({ ...f, mesContains: e.target.value }))} className="text-sm" />
													</div>
												</div>
												<div className="space-y-2">
													<div className="text-xs font-medium text-muted-foreground">Iniciación</div>
													<div className="flex items-center gap-2">
														<Input placeholder="Año (ej: 2024)" value={filters.iniYear} onChange={(e) => setFilters((f) => ({ ...f, iniYear: e.target.value }))} className="text-sm" />
														<Input placeholder="Contiene..." value={filters.iniContains} onChange={(e) => setFilters((f) => ({ ...f, iniContains: e.target.value }))} className="text-sm" />
													</div>
												</div>
											</div>
										</div>

										<div className="space-y-3 rounded-lg border p-4">
											<div className="text-sm font-semibold">Importes (en pesos)</div>
											<div className="space-y-3">
												<div className="space-y-2">
													<div className="text-xs font-medium text-muted-foreground">Contrato + ampliaciones</div>
													<div className="flex items-center gap-2">
														<Input type="number" placeholder="Mín" value={filters.cmaMin} onChange={(e) => setFilters((f) => ({ ...f, cmaMin: e.target.value }))} className="text-sm" />
														<span className="text-muted-foreground">a</span>
														<Input type="number" placeholder="Máx" value={filters.cmaMax} onChange={(e) => setFilters((f) => ({ ...f, cmaMax: e.target.value }))} className="text-sm" />
													</div>
												</div>
												<div className="space-y-2">
													<div className="text-xs font-medium text-muted-foreground">Certificado a la fecha</div>
													<div className="flex items-center gap-2">
														<Input type="number" placeholder="Mín" value={filters.cafMin} onChange={(e) => setFilters((f) => ({ ...f, cafMin: e.target.value }))} className="text-sm" />
														<span className="text-muted-foreground">a</span>
														<Input type="number" placeholder="Máx" value={filters.cafMax} onChange={(e) => setFilters((f) => ({ ...f, cafMax: e.target.value }))} className="text-sm" />
													</div>
												</div>
												<div className="space-y-2">
													<div className="text-xs font-medium text-muted-foreground">Saldo a certificar</div>
													<div className="flex items-center gap-2">
														<Input type="number" placeholder="Mín" value={filters.sacMin} onChange={(e) => setFilters((f) => ({ ...f, sacMin: e.target.value }))} className="text-sm" />
														<span className="text-muted-foreground">a</span>
														<Input type="number" placeholder="Máx" value={filters.sacMax} onChange={(e) => setFilters((f) => ({ ...f, sacMax: e.target.value }))} className="text-sm" />
													</div>
												</div>
											</div>
										</div>

										<div className="space-y-3 rounded-lg border p-4">
											<div className="text-sm font-semibold">Plazos (en meses)</div>
											<div className="space-y-3">
												<div className="space-y-2">
													<div className="text-xs font-medium text-muted-foreground">Según contrato</div>
													<div className="flex items-center gap-2">
														<Input type="number" placeholder="Mín" value={filters.scMin} onChange={(e) => setFilters((f) => ({ ...f, scMin: e.target.value }))} className="text-sm" />
														<span className="text-muted-foreground">a</span>
														<Input type="number" placeholder="Máx" value={filters.scMax} onChange={(e) => setFilters((f) => ({ ...f, scMax: e.target.value }))} className="text-sm" />
													</div>
												</div>
												<div className="space-y-2">
													<div className="text-xs font-medium text-muted-foreground">Prórrogas acordadas</div>
													<div className="flex items-center gap-2">
														<Input type="number" placeholder="Mín" value={filters.paMin} onChange={(e) => setFilters((f) => ({ ...f, paMin: e.target.value }))} className="text-sm" />
														<span className="text-muted-foreground">a</span>
														<Input type="number" placeholder="Máx" value={filters.paMax} onChange={(e) => setFilters((f) => ({ ...f, paMax: e.target.value }))} className="text-sm" />
													</div>
												</div>
												<div className="space-y-2">
													<div className="text-xs font-medium text-muted-foreground">Plazo total</div>
													<div className="flex items-center gap-2">
														<Input type="number" placeholder="Mín" value={filters.ptMin} onChange={(e) => setFilters((f) => ({ ...f, ptMin: e.target.value }))} className="text-sm" />
														<span className="text-muted-foreground">a</span>
														<Input type="number" placeholder="Máx" value={filters.ptMax} onChange={(e) => setFilters((f) => ({ ...f, ptMax: e.target.value }))} className="text-sm" />
													</div>
												</div>
												<div className="space-y-2">
													<div className="text-xs font-medium text-muted-foreground">Transcurrido</div>
													<div className="flex items-center gap-2">
														<Input type="number" placeholder="Mín" value={filters.ptrMin} onChange={(e) => setFilters((f) => ({ ...f, ptrMin: e.target.value }))} className="text-sm" />
														<span className="text-muted-foreground">a</span>
														<Input type="number" placeholder="Máx" value={filters.ptrMax} onChange={(e) => setFilters((f) => ({ ...f, ptrMax: e.target.value }))} className="text-sm" />
													</div>
												</div>
											</div>
										</div>

									</div>
									<SheetFooter className="mt-6 gap-2">
										<Button type="button" variant="outline" className="flex-1 gap-2" onClick={() => {
											setFilters({
												supMin: "", supMax: "",
												entidades: [],
												mesYear: "", mesContains: "",
												iniYear: "", iniContains: "",
												cmaMin: "", cmaMax: "",
												cafMin: "", cafMax: "",
												sacMin: "", sacMax: "",
												scMin: "", scMax: "",
												paMin: "", paMax: "",
												ptMin: "", ptMax: "",
												ptrMin: "", ptrMax: "",
											});
											setFiltersVersion((v) => v + 1);
										}}>
											<X className="h-4 w-4" />
											Limpiar
										</Button>
										<Button type="button" className="flex-1 gap-2" onClick={() => { setFiltersVersion((v) => v + 1); setFiltersOpen(false); }}>
											<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
											Aplicar
										</Button>
									</SheetFooter>
								</SheetContent>
							</Sheet>
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									setShowCsvImport((prev) => {
										const next = !prev;
										if (next) {
											setCsvImportError(null);
										} else {
											setIsDraggingCsv(false);
										}
										return next;
									});
								}}
							>
								<FileSpreadsheet className="h-4 w-4 mr-2" />
								Importar CSV
							</Button>

							<ColumnsMenu
								allColumns={ALL_COLUMNS}
								hiddenCols={hiddenCols}
								setHiddenCols={setHiddenCols}
								pinnedColumns={pinnedColumns}
								togglePinColumn={togglePinColumn}
								resizeMode={resizeMode}
								setResizeMode={setResizeMode}
							/>
							<ViewsMenu
								views={views}
								saveCurrentAsView={saveCurrentAsView}
								applyView={applyView}
								deleteView={deleteView}
							/>
						</div>
					</div>

					<TabsContent value="in-process" asChild>
						<form.Field name="detalleObras" mode="array">
							{(field) => {
								const allRows = field.state.value.map((obra, index) => ({ obra, index }));
								const filtered = allRows.filter(({ obra }) =>
									activeTab === "in-process" ? obra.porcentaje !== 100 : obra.porcentaje === 100,
								);
								const totalCount = filtered.length;
								const currentLimit = activeTab === "in-process" ? inProcLimit : compLimit;
								const currentPage = activeTab === "in-process" ? inProcPage : compPage;
								const totalPages = Math.max(1, Math.ceil(totalCount / currentLimit));
								const safePage = Math.min(currentPage, totalPages);
								const start = (safePage - 1) * currentLimit;
								const visible = filtered.slice(start, start + currentLimit);

								return (
									<>
										<ObrasTable
											formApi={form}
											field={field}
											tableId="excel-table"
											visible={visible}
											isLoading={isLoading}
											tableError={tableError}
											onRetry={() => { setIsLoading(true); setFiltersVersion(v => v + 1); }}
											isHidden={isHidden}
											pinnedColumns={pinnedColumns}
											isPinned={isPinned}
											togglePinColumn={togglePinColumn}
											orderBy={orderBy}
											orderDir={orderDir}
											setOrderBy={setOrderBy}
											setOrderDir={setOrderDir}
											setSortByColumn={setSortByColumn}
											resizeMode={resizeMode}
											query={query}
											copyToClipboard={copyToClipboard}
											obraToCsv={obraToCsv}
											FIELD_BY_INDEX={FIELD_BY_INDEX as unknown as string[]}
											COLUMN_TO_DB={COLUMN_TO_DB}
											highlightText={highlightText}
											headerGroupBgClass="bg-sidebar"
											emptyText="No hay obras en proceso. Agregá una nueva fila para comenzar."
											onFilterByEntidad={(ent) => {
												setFilters((f) => ({ ...f, entidades: [ent] }));
												setFiltersVersion((v) => v + 1);
												setActiveTab("in-process");
											}}
										/>

										<div className="flex flex-wrap items-center justify-between gap-4 py-4 px-1">
											<div className="flex items-center gap-2">
												<span className="text-sm text-muted-foreground">Filas por página</span>
												<select
													className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring"
													value={activeTab === "in-process" ? inProcLimit : compLimit}
													onChange={(e) => {
														const v = Number(e.target.value);
														if (activeTab === "in-process") {
															setInProcLimit(v);
															setInProcPage(1);
														} else {
															setCompLimit(v);
															setCompPage(1);
														}
													}}
												>
													<option value={10}>10</option>
													<option value={25}>25</option>
													<option value={50}>50</option>
													<option value={100}>100</option>
												</select>
											</div>
											<div className="flex items-center gap-3">
												<span className="text-sm text-muted-foreground">
													Página <span className="font-medium text-foreground">{safePage}</span> de <span className="font-medium text-foreground">{totalPages}</span>
												</span>
												<div className="flex gap-1">
													<Button type="button" variant="outline" size="sm" onClick={() => (activeTab === "in-process" ? setInProcPage((p) => Math.max(1, p - 1)) : setCompPage((p) => Math.max(1, p - 1)))} disabled={safePage <= 1}>
														<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
													</Button>
													<Button type="button" variant="outline" size="sm" onClick={() => (activeTab === "in-process" ? setInProcPage((p) => Math.min(totalPages, p + 1)) : setCompPage((p) => Math.min(totalPages, p + 1)))} disabled={safePage >= totalPages}>
														<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
													</Button>
												</div>
											</div>
										</div>
									</>
								);
							}}
						</form.Field>
					</TabsContent>

					<TabsContent value="completed" asChild>
						<form.Field name="detalleObras" mode="array">
							{(field) => {
								const allRows = field.state.value.map((obra, index) => ({ obra, index }));
								const filtered = allRows.filter(({ obra }) => obra.porcentaje === 100);
								const totalCount = filtered.length;
								const totalPages = Math.max(1, Math.ceil(totalCount / compLimit));
								const safePage = Math.min(compPage, totalPages);
								const start = (safePage - 1) * compLimit;
								const visible = filtered.slice(start, start + compLimit);

								return (
									<>
										<ObrasTable
											formApi={form}
											field={field}
											tableId="excel-completed-table"
											visible={visible}
											isLoading={isLoading}
											tableError={tableError}
											onRetry={() => { setIsLoading(true); setFiltersVersion(v => v + 1); }}
											isHidden={isHidden}
											pinnedColumns={pinnedColumns}
											isPinned={isPinned}
											togglePinColumn={togglePinColumn}
											orderBy={orderBy}
											orderDir={orderDir}
											setOrderBy={setOrderBy}
											setOrderDir={setOrderDir}
											setSortByColumn={setSortByColumn}
											resizeMode={resizeMode}
											query={query}
											copyToClipboard={copyToClipboard}
											obraToCsv={obraToCsv}
											FIELD_BY_INDEX={FIELD_BY_INDEX as unknown as string[]}
											COLUMN_TO_DB={COLUMN_TO_DB}
											highlightText={highlightText}
											emptyText="No hay obras completadas todavía."
											onFilterByEntidad={(ent) => {
												setFilters((f) => ({ ...f, entidades: [ent] }));
												setFiltersVersion((v) => v + 1);
												setActiveTab("in-process");
											}}
										/>

										<div className="flex flex-wrap items-center justify-between gap-4 py-4 px-1">
											<div className="flex items-center gap-2">
												<span className="text-sm text-muted-foreground">Filas por página</span>
												<select className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring" value={compLimit} onChange={(e) => { setCompLimit(Number(e.target.value)); setCompPage(1); }}>
													<option value={10}>10</option>
													<option value={25}>25</option>
													<option value={50}>50</option>
													<option value={100}>100</option>
												</select>
											</div>
											<div className="flex items-center gap-3">
												<span className="text-sm text-muted-foreground">
													Página <span className="font-medium text-foreground">{safePage}</span> de <span className="font-medium text-foreground">{totalPages}</span>
												</span>
												<div className="flex gap-1">
													<Button type="button" variant="outline" size="sm" onClick={() => setCompPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>
														<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
													</Button>
													<Button type="button" variant="outline" size="sm" onClick={() => setCompPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
														<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
													</Button>
												</div>
											</div>
										</div>
									</>
								);
							}}
						</form.Field>

					</TabsContent>
				</Tabs>

				<div className="flex flex-wrap justify-between items-center gap-4 pt-4 border-t">
					<form.Field name="detalleObras" mode="array">
						{(field) => (
							<Button
								type="button"
								variant="outline"
								className="gap-2"
								onClick={() => {
									const nextN =
										field.state.value.reduce(
											(max, obra) => Math.max(max, obra.n),
											0,
										) + 1;
									field.pushValue({
										...defaultObra,
										n: nextN,
									});
								}}
							>
								<Plus className="h-4 w-4" />
								Agregar Fila
							</Button>
						)}
					</form.Field>

					<form.Subscribe
						selector={(state) => [state.canSubmit, state.isSubmitting]}
					>
						{([canSubmit, isSubmitting]) => (
							<Button
								type="submit"
								disabled={!canSubmit || isLoading}
								className="gap-2"
								size="default"
							>
								{isSubmitting ? (
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
										Guardar Cambios
									</>
								)}
							</Button>
						)}
					</form.Subscribe>
				</div>
			</form>
		</div>
	);
}

/* extracted subcomponents moved into app/excel/_components:
	 - SearchInput
	 - ColumnsMenu
	 - ViewsMenu
	 - InBodyStates
	 - CustomInput
	 - ObrasTable
*/
