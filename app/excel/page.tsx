'use client';

import Link from "next/link";
import {
	forwardRef,
	InputHTMLAttributes,
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
import { FileSpreadsheet, Plus, Trash2, Upload } from "lucide-react";
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
	const [showJsonInput, setShowJsonInput] = useState(false);
	const [jsonInput, setJsonInput] = useState("");
	const [isLoading, setIsLoading] = useState(true);
	const [activeTab, setActiveTab] =
		useState<"in-process" | "completed">("in-process");
	const [showCsvImport, setShowCsvImport] = useState(false);
	const [isDraggingCsv, setIsDraggingCsv] = useState(false);
	const [csvImportError, setCsvImportError] = useState<string | null>(null);
	const csvInputRef = useRef<HTMLInputElement | null>(null);

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

			if (visibleIndexes.length > 0) {
				const percentage = 100 / visibleIndexes.length;
				visibleIndexes.forEach((idx) => {
					const col = cols[idx] as HTMLTableColElement;
					col.style.width = `${percentage}%`;
				});
			}
		};
		applyVisibilityToTable("excel-inproc-table");
		applyVisibilityToTable("excel-completed-table");
	}, [hiddenCols]);

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
					const [rIn, rCo] = await Promise.all([
						fetch("/api/obras?status=in-process"),
						fetch("/api/obras?status=completed"),
					]);
					if (rIn.ok && rCo.ok) {
						const [dIn, dCo] = await Promise.all([rIn.json(), rCo.json()]);
						const inProc = Array.isArray(dIn?.detalleObras) ? dIn.detalleObras : [];
						const completed = Array.isArray(dCo?.detalleObras) ? dCo.detalleObras : [];
						form.setFieldValue(
							"detalleObras",
							[...inProc, ...completed].sort((a: any, b: any) => (a?.n ?? 0) - (b?.n ?? 0)),
						);
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
				const [respInProc, respCompleted] = await Promise.all([
					fetch("/api/obras?status=in-process"),
					fetch("/api/obras?status=completed"),
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
					const merged = [...inProc, ...completed].sort((a: any, b: any) =>
						(a?.n ?? 0) - (b?.n ?? 0),
					);
					form.setFieldValue("detalleObras", merged);
				}
			} catch (error) {
				console.error(error);
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
	}, [form]);

	const handleImportJson = () => {
		try {
			const parsed = JSON.parse(jsonInput);
			if (Array.isArray(parsed)) {
				form.setFieldValue("detalleObras", parsed);
				toast.success("Datos importados correctamente");
				setShowJsonInput(false);
				setJsonInput("");
			} else {
				toast.error("El JSON debe ser un array");
			}
		} catch {
			toast.error("JSON inválido");
		}
	};

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
			setShowJsonInput(false);
			setJsonInput("");

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

	return (
		<div className="w-full mx-auto p-6">
			<div>
				<p className="text-muted-foreground pb-2">
					Gestión de obras
				</p>
				<h1 className="text-4xl font-bold mb-2">
					Detalle de las Obras en Ejecución
				</h1>
			</div>
			{isLoading && (
				<p className="text-sm text-muted-foreground">Cargando obras...</p>
			)}


			{showCsvImport && (
				<div
					className={cn(
						"mb-6 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors",
						isDraggingCsv
							? "border-primary bg-primary/5"
							: "border-muted-foreground/30 bg-muted/40",
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
					<p className="text-sm font-medium">
						Arrastrá y soltá un archivo CSV o hacé clic para seleccionarlo.
					</p>
					<p className="mt-1 text-xs text-muted-foreground">
						Usá el formato del archivo de ejemplo ubicado en{" "}
						<code>app/excel/Libro1.csv</code>.
					</p>
					{csvImportError && (
						<p className="mt-3 text-sm text-red-500">{csvImportError}</p>
					)}
				</div>
			)}

			{showJsonInput && (
				<div className="mb-6 p-4 border rounded-lg bg-muted/50">
					<label className="block text-sm font-medium mb-2">
						Pegar JSON de base de datos:
					</label>
					<textarea
						className="w-full p-2 border rounded-md font-mono text-sm min-h-[150px]"
						value={jsonInput}
						onChange={(e) => setJsonInput(e.target.value)}
						placeholder='[{"n": 1, "designacionYUbicacion": "...", ...}]'
					/>
					<div className="flex gap-2 mt-2">
						<Button size="sm" onClick={handleImportJson}>
							Importar
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={() => {
								setShowJsonInput(false);
								setJsonInput("");
							}}
						>
							Cancelar
						</Button>
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

					<div className="flex justify-between items-center mt-6">
						<TabsList className="mb-3" >
							<TabsTrigger value="in-process">En proceso</TabsTrigger>
							<TabsTrigger value="completed">Completadas</TabsTrigger>
						</TabsList>

						<div className="flex gap-2 items-center">
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									setShowCsvImport((prev) => {
										const next = !prev;
										if (next) {
											setShowJsonInput(false);
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
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									setShowJsonInput((prev) => {
										const next = !prev;
										if (next) {
											setShowCsvImport(false);
											setIsDraggingCsv(false);
											setCsvImportError(null);
										}
										return next;
									});
								}}
							>
								<Upload className="h-4 w-4 mr-2" />
								Importar JSON
							</Button>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="outline" size="sm">Columnas</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-72">
									<DropdownMenuItem onClick={() => setHiddenCols([])}>Mostrar todo</DropdownMenuItem>
									<DropdownMenuItem onClick={() => setHiddenCols(ALL_COLUMNS.map(c => c.index))}>Ocultar todo</DropdownMenuItem>
									<DropdownMenuSeparator />
									{ALL_COLUMNS.map((col) => {
										const checked = !hiddenCols.includes(col.index);
										return (
											<DropdownMenuCheckboxItem
												key={col.index}
												checked={checked}
												onCheckedChange={(next: boolean | 'indeterminate') => {
													setHiddenCols((prev) => {
														const set = new Set(prev);
														if (next === false) set.add(col.index); else set.delete(col.index);
														return Array.from(set).sort((a, b) => a - b);
													});
												}}
											>
												{col.label}
											</DropdownMenuCheckboxItem>
										);
									})}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>

					<TabsContent value="in-process" asChild>
						<form.Field name="detalleObras" mode="array">
							{(field) => {
								const allRows = field.state.value.map((obra, index) => ({ obra, index }));
								const filtered = allRows.filter(({ obra }) => obra.porcentaje !== 100);
								const totalCount = filtered.length;
								const totalPages = Math.max(1, Math.ceil(totalCount / inProcLimit));
								const safePage = Math.min(inProcPage, totalPages);
								const start = (safePage - 1) * inProcLimit;
								const visible = filtered.slice(start, start + inProcLimit);

								return (
									<>
										<div className="border border-gray-300 rounded-lg overflow-x-auto mb-4 w-full max-h-[60vh] overflow-y-auto">
											<table className="text-sm table-fixed " data-table-id="excel-inproc-table">
												<ColGroup tableId="excel-inproc-table" columns={14} />
												<thead className="bg-gray-100">
													<tr className="bg-card">
														<th rowSpan={2} className="relative px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase border-r border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(0) ? "none" : undefined }}>N°
															<ColumnResizer tableId="excel-inproc-table" colIndex={0} />
														</th>
														<th rowSpan={2} className="relative px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase border-x border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(1) ? "none" : undefined }}>DESIGNACIÓN Y UBICACIÓN
															<ColumnResizer tableId="excel-inproc-table" colIndex={1} />
														</th>
														<th rowSpan={2} className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-x border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(2) ? "none" : undefined }}>SUP. DE OBRA (M2)
															<ColumnResizer tableId="excel-inproc-table" colIndex={2} />
														</th>
														<th rowSpan={2} className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-x border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(3) ? "none" : undefined }}>ENTIDAD CONTRATANTE
															<ColumnResizer tableId="excel-inproc-table" colIndex={3} />
														</th>
														{(() => {
															const count = [4, 5].filter(i => !isHidden(i)).length;
															return (
																<th colSpan={count || 1} style={{ display: count === 0 ? "none" : undefined }} className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-x border-gray-300">FECHAS</th>
															);
														})()}
														{(() => {
															const count = [6, 7, 8].filter(i => !isHidden(i)).length;
															return (
																<th colSpan={count || 1} style={{ display: count === 0 ? "none" : undefined }} className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-x border-gray-300">IMPORTES (EN PESOS) A VALORES BÁSICOS</th>
															);
														})()}
														{(() => {
															const count = [9, 10, 11, 12].filter(i => !isHidden(i)).length;
															return (
																<th colSpan={count || 1} style={{ display: count === 0 ? "none" : undefined }} className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-x border-gray-300">PLAZOS (EN MESES)</th>
															);
														})()}
														<th rowSpan={2} className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(13) ? "none" : undefined }}>%
															<ColumnResizer tableId="excel-inproc-table" colIndex={13} />
														</th>
														{/* <th rowSpan={2} className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-x border-t border-gray-300 whitespace-normal break-words align-center">DETALLE
															<ColumnResizer tableId="excel-inproc-table" colIndex={14} />
														</th>
														<th rowSpan={2} className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase whitespace-normal break-words align-top">ACCIONES
															<ColumnResizer tableId="excel-inproc-table" colIndex={15} />
														</th> */}
													</tr>
													<tr className="bg-card ">
														<th className="relative px-4 py-2 text-xs font-medium text-gray-600 border-x border-t border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(4) ? "none" : undefined }}>MES BÁSICO DE CONTRATO
															<ColumnResizer tableId="excel-inproc-table" colIndex={4} />
														</th>
														<th className="relative px-4 py-2 text-xs font-medium text-gray-600 border-x border-t border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(5) ? "none" : undefined }}>INICIACIÓN
															<ColumnResizer tableId="excel-inproc-table" colIndex={5} />
														</th>
														<th className="relative px-4 py-2 text-xs font-medium text-gray-600 border-x border-t border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(6) ? "none" : undefined }}>CONTRATO MÁS AMPLIACIONES
															<ColumnResizer tableId="excel-inproc-table" colIndex={6} />
														</th>
														<th className="relative px-4 py-2 text-xs font-medium text-gray-600 border-x border-t border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(7) ? "none" : undefined }}>CERTIFICADO A LA FECHA
															<ColumnResizer tableId="excel-inproc-table" colIndex={7} />
														</th>
														<th className="relative px-4 py-2 text-xs font-medium text-gray-600 border-x border-t border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(8) ? "none" : undefined }}>SALDO A CERTIFICAR
															<ColumnResizer tableId="excel-inproc-table" colIndex={8} />
														</th>
														<th className="relative px-4 py-2 text-xs font-medium text-gray-600 border-x border-t border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(9) ? "none" : undefined }}>SEGÚN CONTRATO
															<ColumnResizer tableId="excel-inproc-table" colIndex={9} />
														</th>
														<th className="relative px-4 py-2 text-xs font-medium text-gray-600 border-x border-t border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(10) ? "none" : undefined }}>PRORROGAS ACORDADAS
															<ColumnResizer tableId="excel-inproc-table" colIndex={10} />
														</th>
														<th className="relative px-4 py-2 text-xs font-medium text-gray-600 border-x border-t border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(11) ? "none" : undefined }}>PLAZO TOTAL
															<ColumnResizer tableId="excel-inproc-table" colIndex={11} />
														</th>
														<th className="relative px-4 py-2 text-xs font-medium text-gray-600 border-r border-t border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(12) ? "none" : undefined }}>PLAZO TOTAL TRANSCURRIDO
															<ColumnResizer tableId="excel-inproc-table" colIndex={12} />
														</th>
													</tr>
												</thead>
												<tbody>
													{visible.length === 0 ? (
														<tr>
															<td colSpan={16} className="px-4 py-6 text-center text-sm text-muted-foreground">No hay obras en proceso. Agregá una nueva fila para comenzar.</td>
														</tr>
													) : (
														visible.map(({ index }, visualIndex) => (
															<tr key={index} className={visualIndex % 2 === 0 ? "bg-background" : "bg-card/40"}>
																<form.Field name={`detalleObras[${index}].n`}>
																	{(subField) => (<td className="px-2 pl-4 py-2 border-t border-r border-gray-200 relative" style={{ display: isHidden(0) ? "none" : undefined }}>{subField.state.value}</td>)}
																</form.Field>
																<form.Field name={`detalleObras[${index}].designacionYUbicacion`}>
																	{(subField) => (
																		<td className="border-t border-r border-gray-200 p-0 align-center px-2 py-2 " style={{ display: isHidden(1) ? "none" : undefined }}>
																			<Link href={`/excel/${field.state.value[index]?.id}`} className="cursor-pointer">{subField.state.value}</Link>
																		</td>
																	)}
																</form.Field>

																<form.Field name={`detalleObras[${index}].supDeObraM2`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(2) ? "none" : undefined }}><CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border text-right" /></td>)}
																</form.Field>

																<form.Field name={`detalleObras[${index}].entidadContratante`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(3) ? "none" : undefined }}><CustomInput type="text" value={subField.state.value ?? ""} onChange={(event) => subField.handleChange(event.target.value)} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border" /></td>)}
																</form.Field>

																<form.Field name={`detalleObras[${index}].mesBasicoDeContrato`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(4) ? "none" : undefined }}><CustomInput type="text" value={subField.state.value ?? ""} onChange={(event) => subField.handleChange(event.target.value)} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border" /></td>)}
																</form.Field>

																<form.Field name={`detalleObras[${index}].iniciacion`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(5) ? "none" : undefined }}><CustomInput type="text" value={subField.state.value ?? ""} onChange={(event) => subField.handleChange(event.target.value)} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border" /></td>)}
																</form.Field>

																<form.Field name={`detalleObras[${index}].contratoMasAmpliaciones`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(6) ? "none" : undefined }}><CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border text-right font-mono" /></td>)}
																</form.Field>

																<form.Field name={`detalleObras[${index}].certificadoALaFecha`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(7) ? "none" : undefined }}><CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border text-right font-mono" /></td>)}
																</form.Field>

																<form.Field name={`detalleObras[${index}].saldoACertificar`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(8) ? "none" : undefined }}><CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border text-right font-mono" /></td>)}
																</form.Field>

																<form.Field name={`detalleObras[${index}].segunContrato`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(9) ? "none" : undefined }}><CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border text-right" /></td>)}
																</form.Field>

																<form.Field name={`detalleObras[${index}].prorrogasAcordadas`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(10) ? "none" : undefined }}><CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border text-right" /></td>)}
																</form.Field>

																<form.Field name={`detalleObras[${index}].plazoTotal`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(11) ? "none" : undefined }}><CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm\tborder text-right" /></td>)}
																</form.Field>

																<form.Field name={`detalleObras[${index}].plazoTransc`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(12) ? "none" : undefined }}><CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border text-right" /></td>)}
																</form.Field>

																<form.Field name={`detalleObras[${index}].porcentaje`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(13) ? "none" : undefined }}><CustomInput type="number" step="0.01" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border text-right" /></td>)}
																</form.Field>

																{/* <form.Field name={`detalleObras[${index}].id`}>
																	{(subField) => (
																		<td className="border-t border-r border-gray-200 text-center">{subField.state.value ? (<Button asChild variant="link" size="sm"><Link href={`/excel/${subField.state.value}`}>Ver detalle</Link></Button>) : (<span className="text-xs text-muted-foreground">Guardar para configurar</span>)}</td>
																	)}
																</form.Field>

																<td className="px-2 py-2 border-t text-center"><Button type="button" variant="ghost" size="sm" onClick={() => field.removeValue(index)} disabled={field.state.value.length <= 1}><Trash2 className="h-4 w-4 text-destructive" /></Button></td> */}
															</tr>
														))
													)}
												</tbody>
											</table>
										</div >

										<div className="flex items-center justify-between mb-4">
											<div className="flex items-center gap-2 text-sm">
												<span>Filas por página</span>
												<select className="border rounded-md px-2 py-1 bg-background" value={inProcLimit} onChange={(e) => { setInProcLimit(Number(e.target.value)); setInProcPage(1); }}>
													<option value={10}>10</option>
													<option value={25}>25</option>
													<option value={50}>50</option>
													<option value={100}>100</option>
												</select>
											</div>
											<div className="flex items-center gap-2 text-sm">
												<span>Página {safePage} de {totalPages}</span>
												<Button type="button" variant="outline" size="sm" onClick={() => setInProcPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>Anterior</Button>
												<Button type="button" variant="outline" size="sm" onClick={() => setInProcPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>Siguiente</Button>
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
										<div className="border border-gray-300 rounded-lg overflow-x-auto mb-4 w-full max-h-[60vh] overflow-y-auto">
											<table className="text-sm table-fixed" data-table-id="excel-completed-table">
												<ColGroup tableId="excel-completed-table" columns={14} />
												<thead className="bg-gray-100">
													<tr className="bg-card">
														<th rowSpan={2} className="relative px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase border-r border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(0) ? "none" : undefined }}>N°
															<ColumnResizer tableId="excel-completed-table" colIndex={0} />
														</th>
														<th rowSpan={2} className="relative px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase border-x border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(1) ? "none" : undefined }}>DESIGNACIÓN Y UBICACIÓN
															<ColumnResizer tableId="excel-completed-table" colIndex={1} />
														</th>
														<th rowSpan={2} className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-x border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(2) ? "none" : undefined }}>SUP. DE OBRA (M2)
															<ColumnResizer tableId="excel-completed-table" colIndex={2} />
														</th>
														<th rowSpan={2} className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-x border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(3) ? "none" : undefined }}>ENTIDAD CONTRATANTE
															<ColumnResizer tableId="excel-completed-table" colIndex={3} />
														</th>
														{(() => {
															const count = [4, 5].filter(i => !isHidden(i)).length;
															return (
																<th colSpan={count || 1} style={{ display: count === 0 ? "none" : undefined }} className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-x border-gray-300">FECHAS</th>
															);
														})()}
														{(() => {
															const count = [6, 7, 8].filter(i => !isHidden(i)).length;
															return (
																<th colSpan={count || 1} style={{ display: count === 0 ? "none" : undefined }} className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-x border-gray-300">IMPORTES (EN PESOS) A VALORES BÁSICOS</th>
															);
														})()}
														{(() => {
															const count = [9, 10, 11, 12].filter(i => !isHidden(i)).length;
															return (
																<th colSpan={count || 1} style={{ display: count === 0 ? "none" : undefined }} className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-x border-gray-300">PLAZOS (EN MESES)</th>
															);
														})()}
														<th rowSpan={2} className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(13) ? "none" : undefined }}>%
															<ColumnResizer tableId="excel-completed-table" colIndex={13} />
														</th>
														{/* <th rowSpan={2} className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-x border-t border-gray-300 whitespace-normal break-words align-center">DETALLE
															<ColumnResizer tableId="excel-completed-table" colIndex={14} />
														</th>
														<th rowSpan={2} className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase whitespace-normal break-words align-top">ACCIONES
															<ColumnResizer tableId="excel-completed-table" colIndex={15} />
														</th> */}
													</tr>
													<tr className="bg-card ">
														<th className="relative px-4 py-2 text-xs font-medium text-gray-600 border-x border-t border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(4) ? "none" : undefined }}>MES BÁSICO DE CONTRATO
															<ColumnResizer tableId="excel-completed-table" colIndex={4} />
														</th>
														<th className="relative px-4 py-2 text-xs font-medium text-gray-600 border-x border-t border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(5) ? "none" : undefined }}>INICIACIÓN
															<ColumnResizer tableId="excel-completed-table" colIndex={5} />
														</th>
														<th className="relative px-4 py-2 text-xs font-medium text-gray-600 border-x border-t border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(6) ? "none" : undefined }}>CONTRATO MÁS AMPLIACIONES
															<ColumnResizer tableId="excel-completed-table" colIndex={6} />
														</th>
														<th className="relative px-4 py-2 text-xs font-medium text-gray-600 border-x border-t border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(7) ? "none" : undefined }}>CERTIFICADO A LA FECHA
															<ColumnResizer tableId="excel-completed-table" colIndex={7} />
														</th>
														<th className="relative px-4 py-2 text-xs font-medium text-gray-600 border-x border-t border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(8) ? "none" : undefined }}>SALDO A CERTIFICAR
															<ColumnResizer tableId="excel-completed-table" colIndex={8} />
														</th>
														<th className="relative px-4 py-2 text-xs font-medium text-gray-600 border-x border-t border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(9) ? "none" : undefined }}>SEGÚN CONTRATO
															<ColumnResizer tableId="excel-completed-table" colIndex={9} />
														</th>
														<th className="relative px-4 py-2 text-xs font-medium text-gray-600 border-x border-t border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(10) ? "none" : undefined }}>PRORROGAS ACORDADAS
															<ColumnResizer tableId="excel-completed-table" colIndex={10} />
														</th>
														<th className="relative px-4 py-2 text-xs font-medium text-gray-600 border-x border-t border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(11) ? "none" : undefined }}>PLAZO TOTAL
															<ColumnResizer tableId="excel-completed-table" colIndex={11} />
														</th>
														<th className="relative px-4 py-2 text-xs font-medium text-gray-600 border-r border-t border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(12) ? "none" : undefined }}>PLAZO TOTAL TRANSCURRIDO
															<ColumnResizer tableId="excel-completed-table" colIndex={12} />
														</th>
													</tr>
												</thead>
												<tbody>
													{visible.length === 0 ? (
														<tr>
															<td colSpan={16} className="px-4 py-6 text-center text-sm text-muted-foreground">No hay obras completadas todavía.</td>
														</tr>
													) : (
														visible.map(({ index }, visualIndex) => (
															<tr key={index} className={visualIndex % 2 === 0 ? "bg-background" : "bg-card/40"}>
																<form.Field name={`detalleObras[${index}].n`}>
																	{(subField) => (<td className="px-2 pl-4 py-2 border-t border-r border-gray-200 relative" style={{ display: isHidden(0) ? "none" : undefined }}>{subField.state.value}</td>)}
																</form.Field>
																<form.Field name={`detalleObras[${index}].designacionYUbicacion`}>
																	{(subField) => (
																		<td className="border-t border-r border-gray-200 p-0 align-center px-2 py-2 " style={{ display: isHidden(1) ? "none" : undefined }}>
																			<Link href={`/excel/${field.state.value[index]?.id}`} className="cursor-pointer">{subField.state.value}</Link>
																		</td>
																	)}
																</form.Field>
																<form.Field name={`detalleObras[${index}].supDeObraM2`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(2) ? "none" : undefined }}><CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border text-right" /></td>)}
																</form.Field>
																<form.Field name={`detalleObras[${index}].entidadContratante`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(3) ? "none" : undefined }}><CustomInput type="text" value={subField.state.value ?? ""} onChange={(event) => subField.handleChange(event.target.value)} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border" /></td>)}
																</form.Field>
																<form.Field name={`detalleObras[${index}].mesBasicoDeContrato`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(4) ? "none" : undefined }}><CustomInput type="text" value={subField.state.value ?? ""} onChange={(event) => subField.handleChange(event.target.value)} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border" /></td>)}
																</form.Field>
																<form.Field name={`detalleObras[${index}].iniciacion`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(5) ? "none" : undefined }}><CustomInput type="text" value={subField.state.value ?? ""} onChange={(event) => subField.handleChange(event.target.value)} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border" /></td>)}
																</form.Field>
																<form.Field name={`detalleObras[${index}].contratoMasAmpliaciones`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(6) ? "none" : undefined }}><CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border text-right font-mono" /></td>)}
																</form.Field>
																<form.Field name={`detalleObras[${index}].certificadoALaFecha`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(7) ? "none" : undefined }}><CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border text-right font-mono" /></td>)}
																</form.Field>
																<form.Field name={`detalleObras[${index}].saldoACertificar`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(8) ? "none" : undefined }}><CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border text-right font-mono" /></td>)}
																</form.Field>
																<form.Field name={`detalleObras[${index}].segunContrato`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(9) ? "none" : undefined }}><CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border text-right" /></td>)}
																</form.Field>
																<form.Field name={`detalleObras[${index}].prorrogasAcordadas`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(10) ? "none" : undefined }}><CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border text-right" /></td>)}
																</form.Field>
																<form.Field name={`detalleObras[${index}].plazoTotal`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(11) ? "none" : undefined }}><CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm\tborder text-right" /></td>)}
																</form.Field>
																<form.Field name={`detalleObras[${index}].plazoTransc`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(12) ? "none" : undefined }}><CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border text-right" /></td>)}
																</form.Field>
																<form.Field name={`detalleObras[${index}].porcentaje`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(13) ? "none" : undefined }}><CustomInput type="number" step="0.01" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border text-right" /></td>)}
																</form.Field>
																{/* <form.Field name={`detalleObras[${index}].id`}>
																	{(subField) => (
																		<td className="border-t border-r border-gray-200 text-center">{subField.state.value ? (<Button asChild variant="link" size="sm"><Link href={`/excel/${subField.state.value}`}>Ver detalle</Link></Button>) : (<span className="text-xs text-muted-foreground">Guardar para configurar</span>)}</td>
																	)}
																</form.Field> */}

																{/* <td className="px-2 py-2 border-t text-center"><Button type="button" variant="ghost" size="sm" onClick={() => field.removeValue(index)} disabled={field.state.value.length <= 1}><Trash2 className="h-4 w-4 text-destructive" /></Button></td> */}
															</tr>
														))
													)}
												</tbody>
											</table>
										</div>

										<div className="flex items-center justify-between mb-4">
											<div className="flex items-center gap-2 text-sm">
												<span>Filas por página</span>
												<select className="border rounded-md px-2 py-1 bg-background" value={compLimit} onChange={(e) => { setCompLimit(Number(e.target.value)); setCompPage(1); }}>
													<option value={10}>10</option>
													<option value={25}>25</option>
													<option value={50}>50</option>
													<option value={100}>100</option>
												</select>
											</div>
											<div className="flex items-center gap-2 text-sm">
												<span>Página {safePage} de {totalPages}</span>
												<Button type="button" variant="outline" size="sm" onClick={() => setCompPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>Anterior</Button>
												<Button type="button" variant="outline" size="sm" onClick={() => setCompPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>Siguiente</Button>
											</div>
										</div>
									</>
								);
							}}
						</form.Field>
					</TabsContent>
				</Tabs>

				<div className="flex justify-between items-center">
					<form.Field name="detalleObras" mode="array">
						{(field) => (
							<Button
								type="button"
								variant="outline"
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
								<Plus className="h-4 w-4 mr-2" />
								Agregar Fila
							</Button>
						)}
					</form.Field>

					<div className="flex gap-2">
						<form.Subscribe
							selector={(state) => [state.canSubmit, state.isSubmitting]}
						>
							{([canSubmit, isSubmitting]) => (
								<Button type="submit" disabled={!canSubmit || isLoading}>
									{isSubmitting ? "Guardando..." : "Guardar"}
								</Button>
							)}
						</form.Subscribe>
					</div>
				</div>
			</form>
		</div >
	);
}

interface CustomInputProps extends InputHTMLAttributes<HTMLInputElement> {
	variant?: "default" | "cammo" | "show-empty";
}

const CustomInput = forwardRef<HTMLInputElement, CustomInputProps>(
	({ className, type, variant = "default", ...props }, ref) => {
		const baseStyles =
			"w-full font-mono text-base bg-transparent border-none outline-none px-0 focus:ring-0 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-primary";

		const variantStyles: Record<NonNullable<CustomInputProps["variant"]>, string> =
		{
			default: "border-b border-[#e5e7eb] focus:border-black transition-colors",
			cammo: "bg-transparent border-none outline-none shadow-none",
			"show-empty": cn(
				"border-b border-[#e5e7eb] focus:border-black transition-colors",
				!props.value && "bg-dashedInput",
			),
		};

		return (
			<input
				type={type}
				ref={ref}
				className={cn(baseStyles, variantStyles[variant], className)}
				{...props}
			/>
		);
	},
);
CustomInput.displayName = "CustomInput";

export { CustomInput };
