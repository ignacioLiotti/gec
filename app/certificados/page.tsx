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
import { certificatesFormSchema, type Certificate, type CertificatesForm } from "./schema";
import { toast } from "sonner";
import { FileSpreadsheet, Plus, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ColGroup, ColumnResizer } from "@/components/ui/column-resizer";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const defaultCertificate: Certificate = {
	id: undefined,
	obra_id: "",
	n_exp: "",
	n_certificado: 1,
	monto: 0,
	mes: "",
	estado: "CERTIFICADO",
};

const initialData: Certificate[] = [
	{
		...defaultCertificate,
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

type Obra = {
	id: string;
	n: number;
	designacionYUbicacion: string;
};

export default function CertificadosPage() {
	const [showJsonInput, setShowJsonInput] = useState(false);
	const [jsonInput, setJsonInput] = useState("");
	const [isLoading, setIsLoading] = useState(true);
	const [activeTab, setActiveTab] =
		useState<"certificado" | "pagado" | "all">("all");
	const [showCsvImport, setShowCsvImport] = useState(false);
	const [isDraggingCsv, setIsDraggingCsv] = useState(false);
	const [csvImportError, setCsvImportError] = useState<string | null>(null);
	const csvInputRef = useRef<HTMLInputElement | null>(null);
	const [obras, setObras] = useState<Obra[]>([]);

	// Column visibility state
	const ALL_COLUMNS: { index: number; label: string }[] = [
		{ index: 0, label: "Obra" },
		{ index: 1, label: "N° Exp" },
		{ index: 2, label: "N° Certificado" },
		{ index: 3, label: "Monto" },
		{ index: 4, label: "Mes" },
		{ index: 5, label: "Estado" },
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
		applyVisibilityToTable("cert-all-table");
		applyVisibilityToTable("cert-certificado-table");
		applyVisibilityToTable("cert-pagado-table");
	}, [hiddenCols]);

	// Pagination per tab
	const [allPage, setAllPage] = useState(1);
	const [allLimit, setAllLimit] = useState(10);
	const [certPage, setCertPage] = useState(1);
	const [certLimit, setCertLimit] = useState(10);
	const [pagadoPage, setPagadoPage] = useState(1);
	const [pagadoLimit, setPagadoLimit] = useState(10);

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
			detalleCertificados: initialData,
		} as CertificatesForm,
		validators: {
			onChange: certificatesFormSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				const response = await fetch("/api/certificados", {
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(value),
				});

				if (!response.ok) {
					const result = await response.json().catch(() => ({}));
					throw new Error(result.error ?? "Error al guardar los certificados");
				}

				toast.success("Certificados guardados exitosamente");

				try {
					const [rAll] = await Promise.all([
						fetch("/api/certificados"),
					]);
					if (rAll.ok) {
						const [dAll] = await Promise.all([rAll.json()]);
						const allCerts = Array.isArray(dAll?.detalleCertificados) ? dAll.detalleCertificados : [];
						form.setFieldValue("detalleCertificados", allCerts.sort((a: any, b: any) => (a?.n_certificado ?? 0) - (b?.n_certificado ?? 0)));
					}
				} catch (refreshError) {
					console.error("Error refrescando certificados", refreshError);
					toast.info(
						"Los certificados se guardaron, pero no se pudieron refrescar los datos.",
					);
				}
			} catch (error) {
				console.error(error);
				toast.error(
					error instanceof Error
						? error.message
						: "Ocurrió un error al guardar los certificados",
				);
			}
		},
	});

	useEffect(() => {
		let isMounted = true;

		async function loadData() {
			try {
				// Load obras for the dropdown
				const obrasResp = await fetch("/api/obras");
				if (obrasResp.ok) {
					const obrasData = await obrasResp.json();
					if (isMounted && Array.isArray(obrasData?.detalleObras)) {
						setObras(
							obrasData.detalleObras.map((o: any) => ({
								id: o.id,
								n: o.n,
								designacionYUbicacion: o.designacionYUbicacion,
							}))
						);
					}
				}

				// Load certificates
				const respCerts = await fetch("/api/certificados");
				if (!respCerts.ok) {
					throw new Error("No se pudieron cargar los certificados");
				}

				const dataCerts = await respCerts.json();
				const certs = Array.isArray(dataCerts?.detalleCertificados)
					? dataCerts.detalleCertificados
					: [];

				if (isMounted) {
					const sorted = certs.sort((a: any, b: any) =>
						(a?.n_certificado ?? 0) - (b?.n_certificado ?? 0),
					);
					form.setFieldValue("detalleCertificados", sorted);
				}
			} catch (error) {
				console.error(error);
				if (isMounted) {
					toast.error(
						error instanceof Error
							? error.message
							: "No se pudieron cargar los certificados",
					);
				}
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		}

		loadData();

		return () => {
			isMounted = false;
		};
	}, [form]);

	const handleImportJson = () => {
		try {
			const parsed = JSON.parse(jsonInput);
			if (Array.isArray(parsed)) {
				form.setFieldValue("detalleCertificados", parsed);
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
				const nExp = row[0] ?? "";
				const nCert = row[1] ?? "";
				return nExp.trim().length > 0 && /^\d+/.test(nCert);
			});

			if (dataRows.length === 0) {
				throw new Error("No se encontraron filas válidas en el CSV");
			}

			const certificates = dataRows.map((row, index) => {
				const padded = [...row];
				while (padded.length < 6) {
					padded.push("");
				}

				const cert: Certificate = {
					id: undefined,
					obra_id: normalizeCsvString(padded[0]) || "",
					n_exp: normalizeCsvString(padded[1]),
					n_certificado: Math.max(1, Number.parseInt(padded[2] ?? "1", 10) || index + 1),
					monto: parseCsvNumber(padded[3]),
					mes: normalizeCsvString(padded[4]),
					estado: normalizeCsvString(padded[5]) || "CERTIFICADO",
				};

				return cert;
			});

			form.setFieldValue("detalleCertificados", certificates);
			setCsvImportError(null);
			setShowCsvImport(false);
			setIsDraggingCsv(false);
			setShowJsonInput(false);
			setJsonInput("");

			toast.success(`Se importaron ${certificates.length} certificados desde CSV`);
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
					Gestión de certificados
				</p>
				<h1 className="text-4xl font-bold mb-2">
					Detalle de Certificados
				</h1>
			</div>
			{isLoading && (
				<p className="text-sm text-muted-foreground">Cargando certificados...</p>
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
						Formato CSV: obra_id, n_exp, n_certificado, monto, mes, estado
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
						placeholder='[{"obra_id": "...", "n_exp": "...", ...}]'
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
				<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">

					<div className="flex justify-between items-center mt-6">
						<TabsList className="mb-3" >
							<TabsTrigger value="all">Todos</TabsTrigger>
							<TabsTrigger value="certificado">Certificados</TabsTrigger>
							<TabsTrigger value="pagado">Pagados</TabsTrigger>
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

					<TabsContent value="all" asChild>
						<form.Field name="detalleCertificados" mode="array">
							{(field) => {
								const allRows = field.state.value.map((cert, index) => ({ cert, index }));
								const totalCount = allRows.length;
								const totalPages = Math.max(1, Math.ceil(totalCount / allLimit));
								const safePage = Math.min(allPage, totalPages);
								const start = (safePage - 1) * allLimit;
								const visible = allRows.slice(start, start + allLimit);

								return (
									<>
										<div className="border border-gray-300 rounded-lg overflow-x-auto mb-4 w-full max-h-[60vh] overflow-y-auto">
											<table className="text-sm table-fixed " data-table-id="cert-all-table">
												<ColGroup tableId="cert-all-table" columns={6} />
												<thead className="bg-gray-100">
													<tr className="bg-card">
														<th className="relative px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase border-r border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(0) ? "none" : undefined }}>OBRA
															<ColumnResizer tableId="cert-all-table" colIndex={0} />
														</th>
														<th className="relative px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase border-r border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(1) ? "none" : undefined }}>N° EXP
															<ColumnResizer tableId="cert-all-table" colIndex={1} />
														</th>
														<th className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-r border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(2) ? "none" : undefined }}>N° CERTIFICADO
															<ColumnResizer tableId="cert-all-table" colIndex={2} />
														</th>
														<th className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-r border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(3) ? "none" : undefined }}>MONTO
															<ColumnResizer tableId="cert-all-table" colIndex={3} />
														</th>
														<th className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-r border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(4) ? "none" : undefined }}>MES
															<ColumnResizer tableId="cert-all-table" colIndex={4} />
														</th>
														<th className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(5) ? "none" : undefined }}>ESTADO
															<ColumnResizer tableId="cert-all-table" colIndex={5} />
														</th>
													</tr>
												</thead>
												<tbody>
													{visible.length === 0 ? (
														<tr>
															<td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">No hay certificados. Agregá una nueva fila para comenzar.</td>
														</tr>
													) : (
														visible.map(({ index }, visualIndex) => (
															<tr key={index} className={visualIndex % 2 === 0 ? "bg-background" : "bg-card/40"}>
																<form.Field name={`detalleCertificados[${index}].obra_id`}>
																	{(subField) => (
																		<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(0) ? "none" : undefined }}>
																			<select
																				value={subField.state.value}
																				onChange={(e) => subField.handleChange(e.target.value)}
																				onBlur={subField.handleBlur}
																				className="absolute inset-0 px-2 py-2 text-sm border bg-transparent"
																			>
																				<option value="">Seleccionar obra...</option>
																				{obras.map((obra) => (
																					<option key={obra.id} value={obra.id}>
																						{obra.n} - {obra.designacionYUbicacion}
																					</option>
																				))}
																			</select>
																		</td>
																	)}
																</form.Field>

																<form.Field name={`detalleCertificados[${index}].n_exp`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(1) ? "none" : undefined }}><CustomInput type="text" value={subField.state.value ?? ""} onChange={(event) => subField.handleChange(event.target.value)} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border" /></td>)}
																</form.Field>

																<form.Field name={`detalleCertificados[${index}].n_certificado`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(2) ? "none" : undefined }}><CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border text-right" /></td>)}
																</form.Field>

																<form.Field name={`detalleCertificados[${index}].monto`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(3) ? "none" : undefined }}><CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border text-right font-mono" /></td>)}
																</form.Field>

																<form.Field name={`detalleCertificados[${index}].mes`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(4) ? "none" : undefined }}><CustomInput type="text" value={subField.state.value ?? ""} onChange={(event) => subField.handleChange(event.target.value)} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border" /></td>)}
																</form.Field>

																<form.Field name={`detalleCertificados[${index}].estado`}>
																	{(subField) => (
																		<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(5) ? "none" : undefined }}>
																			<select
																				value={subField.state.value}
																				onChange={(e) => subField.handleChange(e.target.value)}
																				onBlur={subField.handleBlur}
																				className="absolute inset-0 px-2 py-2 text-sm border bg-transparent"
																			>
																				<option value="CERTIFICADO">CERTIFICADO</option>
																				<option value="PAGADO">PAGADO</option>
																				<option value="PENDIENTE">PENDIENTE</option>
																			</select>
																		</td>
																	)}
																</form.Field>
															</tr>
														))
													)}
												</tbody>
											</table>
										</div >

										<div className="flex items-center justify-between mb-4">
											<div className="flex items-center gap-2 text-sm">
												<span>Filas por página</span>
												<select className="border rounded-md px-2 py-1 bg-background" value={allLimit} onChange={(e) => { setAllLimit(Number(e.target.value)); setAllPage(1); }}>
													<option value={10}>10</option>
													<option value={25}>25</option>
													<option value={50}>50</option>
													<option value={100}>100</option>
												</select>
											</div>
											<div className="flex items-center gap-2 text-sm">
												<span>Página {safePage} de {totalPages}</span>
												<Button type="button" variant="outline" size="sm" onClick={() => setAllPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>Anterior</Button>
												<Button type="button" variant="outline" size="sm" onClick={() => setAllPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>Siguiente</Button>
											</div>
										</div>
									</>
								);
							}}
						</form.Field>
					</TabsContent>

					{/* Similar structure for certificado and pagado tabs */}
					<TabsContent value="certificado" asChild>
						<form.Field name="detalleCertificados" mode="array">
							{(field) => {
								const allRows = field.state.value.map((cert, index) => ({ cert, index }));
								const filtered = allRows.filter(({ cert }) => cert.estado === "CERTIFICADO");
								const totalCount = filtered.length;
								const totalPages = Math.max(1, Math.ceil(totalCount / certLimit));
								const safePage = Math.min(certPage, totalPages);
								const start = (safePage - 1) * certLimit;
								const visible = filtered.slice(start, start + certLimit);

								return (
									<>
										<div className="border border-gray-300 rounded-lg overflow-x-auto mb-4 w-full max-h-[60vh] overflow-y-auto">
											<table className="text-sm table-fixed " data-table-id="cert-certificado-table">
												<ColGroup tableId="cert-certificado-table" columns={6} />
												<thead className="bg-gray-100">
													<tr className="bg-card">
														<th className="relative px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase border-r border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(0) ? "none" : undefined }}>OBRA
															<ColumnResizer tableId="cert-certificado-table" colIndex={0} />
														</th>
														<th className="relative px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase border-r border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(1) ? "none" : undefined }}>N° EXP
															<ColumnResizer tableId="cert-certificado-table" colIndex={1} />
														</th>
														<th className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-r border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(2) ? "none" : undefined }}>N° CERTIFICADO
															<ColumnResizer tableId="cert-certificado-table" colIndex={2} />
														</th>
														<th className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-r border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(3) ? "none" : undefined }}>MONTO
															<ColumnResizer tableId="cert-certificado-table" colIndex={3} />
														</th>
														<th className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-r border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(4) ? "none" : undefined }}>MES
															<ColumnResizer tableId="cert-certificado-table" colIndex={4} />
														</th>
														<th className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(5) ? "none" : undefined }}>ESTADO
															<ColumnResizer tableId="cert-certificado-table" colIndex={5} />
														</th>
													</tr>
												</thead>
												<tbody>
													{visible.length === 0 ? (
														<tr>
															<td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">No hay certificados con estado CERTIFICADO.</td>
														</tr>
													) : (
														visible.map(({ index }, visualIndex) => (
															<tr key={index} className={visualIndex % 2 === 0 ? "bg-background" : "bg-card/40"}>
																<form.Field name={`detalleCertificados[${index}].obra_id`}>
																	{(subField) => (
																		<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(0) ? "none" : undefined }}>
																			<select
																				value={subField.state.value}
																				onChange={(e) => subField.handleChange(e.target.value)}
																				onBlur={subField.handleBlur}
																				className="absolute inset-0 px-2 py-2 text-sm border bg-transparent"
																			>
																				<option value="">Seleccionar obra...</option>
																				{obras.map((obra) => (
																					<option key={obra.id} value={obra.id}>
																						{obra.n} - {obra.designacionYUbicacion}
																					</option>
																				))}
																			</select>
																		</td>
																	)}
																</form.Field>
																<form.Field name={`detalleCertificados[${index}].n_exp`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(1) ? "none" : undefined }}><CustomInput type="text" value={subField.state.value ?? ""} onChange={(event) => subField.handleChange(event.target.value)} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border" /></td>)}
																</form.Field>
																<form.Field name={`detalleCertificados[${index}].n_certificado`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(2) ? "none" : undefined }}><CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border text-right" /></td>)}
																</form.Field>
																<form.Field name={`detalleCertificados[${index}].monto`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(3) ? "none" : undefined }}><CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border text-right font-mono" /></td>)}
																</form.Field>
																<form.Field name={`detalleCertificados[${index}].mes`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(4) ? "none" : undefined }}><CustomInput type="text" value={subField.state.value ?? ""} onChange={(event) => subField.handleChange(event.target.value)} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border" /></td>)}
																</form.Field>
																<form.Field name={`detalleCertificados[${index}].estado`}>
																	{(subField) => (
																		<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(5) ? "none" : undefined }}>
																			<select
																				value={subField.state.value}
																				onChange={(e) => subField.handleChange(e.target.value)}
																				onBlur={subField.handleBlur}
																				className="absolute inset-0 px-2 py-2 text-sm border bg-transparent"
																			>
																				<option value="CERTIFICADO">CERTIFICADO</option>
																				<option value="PAGADO">PAGADO</option>
																				<option value="PENDIENTE">PENDIENTE</option>
																			</select>
																		</td>
																	)}
																</form.Field>
															</tr>
														))
													)}
												</tbody>
											</table>
										</div>
										<div className="flex items-center justify-between mb-4">
											<div className="flex items-center gap-2 text-sm">
												<span>Filas por página</span>
												<select className="border rounded-md px-2 py-1 bg-background" value={certLimit} onChange={(e) => { setCertLimit(Number(e.target.value)); setCertPage(1); }}>
													<option value={10}>10</option>
													<option value={25}>25</option>
													<option value={50}>50</option>
													<option value={100}>100</option>
												</select>
											</div>
											<div className="flex items-center gap-2 text-sm">
												<span>Página {safePage} de {totalPages}</span>
												<Button type="button" variant="outline" size="sm" onClick={() => setCertPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>Anterior</Button>
												<Button type="button" variant="outline" size="sm" onClick={() => setCertPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>Siguiente</Button>
											</div>
										</div>
									</>
								);
							}}
						</form.Field>
					</TabsContent>

					<TabsContent value="pagado" asChild>
						<form.Field name="detalleCertificados" mode="array">
							{(field) => {
								const allRows = field.state.value.map((cert, index) => ({ cert, index }));
								const filtered = allRows.filter(({ cert }) => cert.estado === "PAGADO");
								const totalCount = filtered.length;
								const totalPages = Math.max(1, Math.ceil(totalCount / pagadoLimit));
								const safePage = Math.min(pagadoPage, totalPages);
								const start = (safePage - 1) * pagadoLimit;
								const visible = filtered.slice(start, start + pagadoLimit);

								return (
									<>
										<div className="border border-gray-300 rounded-lg overflow-x-auto mb-4 w-full max-h-[60vh] overflow-y-auto">
											<table className="text-sm table-fixed " data-table-id="cert-pagado-table">
												<ColGroup tableId="cert-pagado-table" columns={6} />
												<thead className="bg-gray-100">
													<tr className="bg-card">
														<th className="relative px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase border-r border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(0) ? "none" : undefined }}>OBRA
															<ColumnResizer tableId="cert-pagado-table" colIndex={0} />
														</th>
														<th className="relative px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase border-r border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(1) ? "none" : undefined }}>N° EXP
															<ColumnResizer tableId="cert-pagado-table" colIndex={1} />
														</th>
														<th className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-r border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(2) ? "none" : undefined }}>N° CERTIFICADO
															<ColumnResizer tableId="cert-pagado-table" colIndex={2} />
														</th>
														<th className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-r border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(3) ? "none" : undefined }}>MONTO
															<ColumnResizer tableId="cert-pagado-table" colIndex={3} />
														</th>
														<th className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-r border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(4) ? "none" : undefined }}>MES
															<ColumnResizer tableId="cert-pagado-table" colIndex={4} />
														</th>
														<th className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-gray-300 whitespace-normal break-words align-center" style={{ display: isHidden(5) ? "none" : undefined }}>ESTADO
															<ColumnResizer tableId="cert-pagado-table" colIndex={5} />
														</th>
													</tr>
												</thead>
												<tbody>
													{visible.length === 0 ? (
														<tr>
															<td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">No hay certificados con estado PAGADO.</td>
														</tr>
													) : (
														visible.map(({ index }, visualIndex) => (
															<tr key={index} className={visualIndex % 2 === 0 ? "bg-background" : "bg-card/40"}>
																<form.Field name={`detalleCertificados[${index}].obra_id`}>
																	{(subField) => (
																		<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(0) ? "none" : undefined }}>
																			<select
																				value={subField.state.value}
																				onChange={(e) => subField.handleChange(e.target.value)}
																				onBlur={subField.handleBlur}
																				className="absolute inset-0 px-2 py-2 text-sm border bg-transparent"
																			>
																				<option value="">Seleccionar obra...</option>
																				{obras.map((obra) => (
																					<option key={obra.id} value={obra.id}>
																						{obra.n} - {obra.designacionYUbicacion}
																					</option>
																				))}
																			</select>
																		</td>
																	)}
																</form.Field>
																<form.Field name={`detalleCertificados[${index}].n_exp`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(1) ? "none" : undefined }}><CustomInput type="text" value={subField.state.value ?? ""} onChange={(event) => subField.handleChange(event.target.value)} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border" /></td>)}
																</form.Field>
																<form.Field name={`detalleCertificados[${index}].n_certificado`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(2) ? "none" : undefined }}><CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border text-right" /></td>)}
																</form.Field>
																<form.Field name={`detalleCertificados[${index}].monto`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(3) ? "none" : undefined }}><CustomInput type="number" value={subField.state.value} onChange={(event) => subField.handleChange(Number(event.target.value))} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border text-right font-mono" /></td>)}
																</form.Field>
																<form.Field name={`detalleCertificados[${index}].mes`}>
																	{(subField) => (<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(4) ? "none" : undefined }}><CustomInput type="text" value={subField.state.value ?? ""} onChange={(event) => subField.handleChange(event.target.value)} onBlur={subField.handleBlur} className="absolute inset-0 px-2 py-2 text-sm border" /></td>)}
																</form.Field>
																<form.Field name={`detalleCertificados[${index}].estado`}>
																	{(subField) => (
																		<td className="border-t border-r border-gray-200 p-0 relative table-cell" style={{ display: isHidden(5) ? "none" : undefined }}>
																			<select
																				value={subField.state.value}
																				onChange={(e) => subField.handleChange(e.target.value)}
																				onBlur={subField.handleBlur}
																				className="absolute inset-0 px-2 py-2 text-sm border bg-transparent"
																			>
																				<option value="CERTIFICADO">CERTIFICADO</option>
																				<option value="PAGADO">PAGADO</option>
																				<option value="PENDIENTE">PENDIENTE</option>
																			</select>
																		</td>
																	)}
																</form.Field>
															</tr>
														))
													)}
												</tbody>
											</table>
										</div>
										<div className="flex items-center justify-between mb-4">
											<div className="flex items-center gap-2 text-sm">
												<span>Filas por página</span>
												<select className="border rounded-md px-2 py-1 bg-background" value={pagadoLimit} onChange={(e) => { setPagadoLimit(Number(e.target.value)); setPagadoPage(1); }}>
													<option value={10}>10</option>
													<option value={25}>25</option>
													<option value={50}>50</option>
													<option value={100}>100</option>
												</select>
											</div>
											<div className="flex items-center gap-2 text-sm">
												<span>Página {safePage} de {totalPages}</span>
												<Button type="button" variant="outline" size="sm" onClick={() => setPagadoPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>Anterior</Button>
												<Button type="button" variant="outline" size="sm" onClick={() => setPagadoPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>Siguiente</Button>
											</div>
										</div>
									</>
								);
							}}
						</form.Field>
					</TabsContent>
				</Tabs>

				<div className="flex justify-between items-center">
					<form.Field name="detalleCertificados" mode="array">
						{(field) => (
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									const nextNCert =
										field.state.value.reduce(
											(max, cert) => Math.max(max, cert.n_certificado),
											0,
										) + 1;
									field.pushValue({
										...defaultCertificate,
										n_certificado: nextNCert,
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
