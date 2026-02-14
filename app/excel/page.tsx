'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FileText, Upload } from "lucide-react";
import Papa from "papaparse";
import {
	FormTable,
	FormTableContent,
	FormTablePagination,
	FormTableTabs,
	FormTableToolbar,
} from "@/components/form-table/form-table";
import {
	createObrasDetalleConfig,
	obrasDetalleConfig,
	type MainTableColumnConfig,
} from "@/components/form-table/configs/obras-detalle";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

type CsvObra = {
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
};

type CsvRow = (string | null | undefined)[];
type CsvPreviewRow = CsvObra & { _rowIndex: number };
type ObraListItem = {
	id: string;
	n?: number | null;
	designacionYUbicacion?: string | null;
	entidadContratante?: string | null;
	porcentaje?: number | null;
};

const normalizeHeader = (value: string) => {
	const raw = value.trim();
	if (raw.includes("%")) return "porcentaje";
	let normalized = raw
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "");
	const prefixes = ["fechas", "importesenpesosavaloresbasicos", "plazosenmeses"];
	for (const prefix of prefixes) {
		if (normalized.startsWith(prefix)) {
			normalized = normalized.slice(prefix.length);
			break;
		}
	}
	return normalized;
};

const toNumber = (value: unknown) => {
	if (typeof value === "number") return Number.isFinite(value) ? value : 0;
	if (typeof value === "string") {
		const cleaned = value.replace(",", ".").replace(/[^0-9.-]/g, "");
		const parsed = Number(cleaned);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
};

const toText = (value: unknown) => (value ?? "").toString().trim();

const clampPercentage = (value: unknown) => {
	const pct = toNumber(value);
	return Math.max(0, Math.min(100, pct));
};

const combineHeaderCells = (rows: CsvRow[], colIndex: number) =>
	rows
		.map((row) => toText(row[colIndex]))
		.filter((value) => value.length > 0)
		.join(" ");

const isMultiRowHeader = (rows: CsvRow[]) => {
	if (rows.length < 3) return false;
	const top = rows[0].map((cell) => normalizeHeader(toText(cell))).join(" ");
	const second = rows[1].map((cell) => normalizeHeader(toText(cell))).join(" ");
	return top.includes("designacionyubicacion") && second.includes("mesbasico");
};

const buildHeaders = (rows: CsvRow[], headerRows: number) => {
	const maxCols = Math.max(...rows.slice(0, headerRows).map((row) => row.length));
	const headers: string[] = [];
	for (let i = 0; i < maxCols; i += 1) {
		headers.push(combineHeaderCells(rows.slice(0, headerRows), i));
	}
	return headers;
};

export default function ExcelPage() {
	const isMobile = useIsMobile();
	const [isImporting, setIsImporting] = useState(false);
	const [refreshKey, setRefreshKey] = useState(0);
	const [mainTableColumnsConfig, setMainTableColumnsConfig] = useState<
		MainTableColumnConfig[] | null
	>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const [isPreviewOpen, setIsPreviewOpen] = useState(false);
	const [previewRows, setPreviewRows] = useState<CsvPreviewRow[]>([]);
	const [pendingUpdates, setPendingUpdates] = useState<CsvObra[]>([]);
	const [pendingFileName, setPendingFileName] = useState<string>("");
	const [mobileObras, setMobileObras] = useState<ObraListItem[]>([]);
	const [isLoadingMobile, setIsLoadingMobile] = useState(false);
	const tableConfig = useMemo(
		() =>
			mainTableColumnsConfig == null
				? obrasDetalleConfig
				: createObrasDetalleConfig(mainTableColumnsConfig),
		[mainTableColumnsConfig]
	);

	useEffect(() => {
		let cancelled = false;
		const loadMainTableConfig = async () => {
			try {
				const response = await fetch("/api/main-table-config", { cache: "no-store" });
				if (!response.ok) return;
				const payload = (await response.json()) as { columns?: MainTableColumnConfig[] };
				if (cancelled) return;
				setMainTableColumnsConfig(
					Array.isArray(payload.columns) ? payload.columns : []
				);
				setRefreshKey((prev) => prev + 1);
			} catch {
				// fallback to default config
			}
		};
		void loadMainTableConfig();
		return () => {
			cancelled = true;
		};
	}, []);

	const headerAliases = useMemo(
		() => ({
			n: "n",
			numero: "n",
			nro: "n",
			nobra: "n",
			no: "n",
			designacionyubicacion: "designacionYUbicacion",
			designacionubicacion: "designacionYUbicacion",
			designacion: "designacionYUbicacion",
			ubicacion: "designacionYUbicacion",
			supdeobram2: "supDeObraM2",
			supdeobra: "supDeObraM2",
			superficiedeobra: "supDeObraM2",
			superficiedeobram2: "supDeObraM2",
			entidadcontratante: "entidadContratante",
			entidad: "entidadContratante",
			mesbasicodecontrato: "mesBasicoDeContrato",
			mesbasicocontrato: "mesBasicoDeContrato",
			mesbasico: "mesBasicoDeContrato",
			iniciacion: "iniciacion",
			inicio: "iniciacion",
			fechainiciacion: "iniciacion",
			contratomas: "contratoMasAmpliaciones",
			contratomasampliaciones: "contratoMasAmpliaciones",
			contratoampliaciones: "contratoMasAmpliaciones",
			certificadoalafecha: "certificadoALaFecha",
			certificado: "certificadoALaFecha",
			saldoacertificar: "saldoACertificar",
			seguncontrato: "segunContrato",
			prorrogasacordadas: "prorrogasAcordadas",
			plazototal: "plazoTotal",
			plazotransc: "plazoTransc",
			porcentaje: "porcentaje",
			"porc": "porcentaje",
		}),
		[]
	);

	const handleCsvImport = useCallback(
		(file: File) => {
			setIsImporting(true);
			const parseCsvText = (text: string) => {
				return Papa.parse<string[]>(text, {
					header: false,
					skipEmptyLines: true,
					delimiter: ";",
				});
			};

			const decodeWithFallback = async () => {
				const buffer = await file.arrayBuffer();
				const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
				const utf8ReplacementCount = (utf8.match(/\uFFFD/g) ?? []).length;
				if (utf8ReplacementCount === 0) return utf8;
				const win1252 = new TextDecoder("windows-1252", { fatal: false }).decode(buffer);
				const winReplacementCount = (win1252.match(/\uFFFD/g) ?? []).length;
				return winReplacementCount < utf8ReplacementCount ? win1252 : utf8;
			};

			void decodeWithFallback().then((csvText) => {
				const results = parseCsvText(csvText);
				(async () => {
					try {
						if (results.errors.length) {
							throw new Error(results.errors[0]?.message || "No se pudo leer el CSV");
						}
						const rows = results.data as CsvRow[];
						if (!rows.length) {
							throw new Error("El CSV está vacío");
						}

						const headerRows = isMultiRowHeader(rows) ? 3 : 1;
						const headers = buildHeaders(rows, headerRows);
						const mappedRows = rows
							.slice(headerRows)
							.map((row, rowIndex) => {
								const mapped: Record<string, string> = {};
								headers.forEach((header, index) => {
									if (!header) return;
									const normalized = normalizeHeader(header);
									const mappedKey =
										headerAliases[normalized as keyof typeof headerAliases] ?? normalized;
									mapped[mappedKey] = toText(row[index]);
								});
								return { ...(mapped as CsvObra), _sourceRow: rowIndex + headerRows + 1 };
							})
							.filter((row) => Object.values(row).some((value) => String(value ?? "").trim().length > 0));

						if (!mappedRows.length) {
							throw new Error("El CSV no contiene filas válidas");
						}

						const validRows = mappedRows.filter((row) =>
							toText(row.designacionYUbicacion) &&
							toText(row.entidadContratante) &&
							toText(row.mesBasicoDeContrato) &&
							toText(row.iniciacion)
						);

						if (!validRows.length) {
							throw new Error("No hay filas válidas con campos obligatorios");
						}

						const skippedCount = mappedRows.length - validRows.length;

						const usedNs = new Set<number>();
						let nextAuto = 1;
						let duplicateCount = 0;
						let missingCount = 0;

						const updates = validRows.map((row) => {
							const desired = Math.trunc(toNumber(row.n));
							let finalN = desired;

							if (!Number.isFinite(desired) || desired <= 0) {
								missingCount += 1;
								while (usedNs.has(nextAuto)) nextAuto += 1;
								finalN = nextAuto;
								nextAuto += 1;
							} else if (usedNs.has(desired)) {
								duplicateCount += 1;
								while (usedNs.has(nextAuto)) nextAuto += 1;
								finalN = nextAuto;
								nextAuto += 1;
							}

							usedNs.add(finalN);

							return {
								n: finalN,
								designacionYUbicacion: toText(row.designacionYUbicacion),
								supDeObraM2: toNumber(row.supDeObraM2),
								entidadContratante: toText(row.entidadContratante),
								mesBasicoDeContrato: toText(row.mesBasicoDeContrato),
								iniciacion: toText(row.iniciacion),
								contratoMasAmpliaciones: toNumber(row.contratoMasAmpliaciones),
								certificadoALaFecha: toNumber(row.certificadoALaFecha),
								saldoACertificar: toNumber(row.saldoACertificar),
								segunContrato: toNumber(row.segunContrato),
								prorrogasAcordadas: toNumber(row.prorrogasAcordadas),
								plazoTotal: toNumber(row.plazoTotal),
								plazoTransc: toNumber(row.plazoTransc),
								porcentaje: clampPercentage(row.porcentaje),
							};
						});

						if (duplicateCount > 0) {
							toast.message(`Se reasignaron ${duplicateCount} N° duplicados para evitar conflictos`);
						}
						if (missingCount > 0) {
							toast.message(`Se asignaron ${missingCount} N° faltantes de forma automática`);
						}

						if (skippedCount > 0) {
							toast.message(`Se omitieron ${skippedCount} filas sin campos obligatorios`);
						}

						setPendingUpdates(updates);
						setPreviewRows(
							updates.slice(0, 5).map((row, idx) => ({
								...row,
								_rowIndex: idx + 1,
							}))
						);
						setPendingFileName(file.name);
						setIsPreviewOpen(true);
					} catch (error) {
						const message = error instanceof Error ? error.message : "No se pudo importar el CSV";
						toast.error(message);
					} finally {
						setIsImporting(false);
						if (inputRef.current) inputRef.current.value = "";
					}
				})();
			}).catch((error) => {
				const message = error instanceof Error ? error.message : "No se pudo leer el CSV";
				toast.error(message);
				setIsImporting(false);
				if (inputRef.current) inputRef.current.value = "";
			});
		},
		[headerAliases]
	);

	useEffect(() => {
		if (!isMobile) return;
		let cancelled = false;
		const loadObras = async () => {
			try {
				setIsLoadingMobile(true);
				const response = await fetch("/api/obras", { cache: "no-store" });
				if (!response.ok) throw new Error("No se pudieron obtener las obras");
				const payload = await response.json();
				const obras = Array.isArray(payload.detalleObras) ? payload.detalleObras : [];
				if (!cancelled) {
					setMobileObras(obras);
				}
			} catch (error) {
				console.error(error);
				if (!cancelled) {
					toast.error("No se pudieron cargar las obras");
				}
			} finally {
				if (!cancelled) setIsLoadingMobile(false);
			}
		};
		void loadObras();
		return () => {
			cancelled = true;
		};
	}, [isMobile]);

	const handleImportClick = useCallback(() => {
		inputRef.current?.click();
	}, []);

	const handleConfirmImport = useCallback(async () => {
		if (!pendingUpdates.length) {
			setIsPreviewOpen(false);
			return;
		}
		setIsImporting(true);
		try {
			const response = await fetch("/api/obras/bulk", {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ updates: pendingUpdates }),
			});

			if (!response.ok) {
				const errorPayload = await response.json().catch(() => ({}));
				const message = errorPayload?.error || "No se pudieron importar las obras";
				throw new Error(message);
			}

			toast.success(`Importadas ${pendingUpdates.length} obras`);
			setRefreshKey((prev) => prev + 1);
			setIsPreviewOpen(false);
			setPendingUpdates([]);
			setPreviewRows([]);
			setPendingFileName("");
		} catch (error) {
			const message = error instanceof Error ? error.message : "No se pudo importar el CSV";
			toast.error(message);
		} finally {
			setIsImporting(false);
		}
	}, [pendingUpdates]);

	const handleCancelPreview = useCallback(() => {
		setIsPreviewOpen(false);
		setPendingUpdates([]);
		setPreviewRows([]);
		setPendingFileName("");
	}, []);

	if (isMobile) {
		return (
			<div className="flex-1 px-4 py-4 space-y-4">
				<div className="flex items-center justify-between gap-2">
					<h1 className="text-2xl font-bold text-foreground">Panel de obras</h1>
					<Button variant="outline" size="sm" asChild>
						<Link href="/excel/reporte" className="gap-2">
							<FileText className="h-4 w-4" />
							Reporte
						</Link>
					</Button>
				</div>
				{isLoadingMobile ? (
					<div className="text-sm text-muted-foreground">Cargando obras...</div>
				) : (
					<div className="grid grid-cols-1 gap-3">
						{mobileObras.map((obra) => (
							<Link
								key={obra.id}
								href={`/excel/${obra.id}`}
								className="rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40"
							>
								<div className="text-xs text-muted-foreground">
									#{obra.n ?? "-"}
								</div>
								<div className="text-base font-semibold text-foreground">
									{toText(obra.designacionYUbicacion) || "Obra"}
								</div>
								<div className="text-sm text-muted-foreground">
									{toText(obra.entidadContratante)}
								</div>
								<div className="mt-2 text-sm font-medium text-foreground">
									Avance: {clampPercentage(obra.porcentaje).toFixed(1)}%
								</div>
							</Link>
						))}
						{mobileObras.length === 0 && (
							<div className="text-sm text-muted-foreground">
								No hay obras para mostrar.
							</div>
						)}
					</div>
				)}
			</div>
		);
	}

	return (
		<div className="px-4 py-2">
			<Sheet open={isPreviewOpen} onOpenChange={(open) => !open && handleCancelPreview()}>
				<SheetContent side="right" className="sm:max-w-lg">
					<SheetHeader>
						<SheetTitle>Previsualización de importación</SheetTitle>
						<SheetDescription>
							{pendingFileName ? `Archivo: ${pendingFileName}` : "Revisá las primeras filas antes de importar."}
						</SheetDescription>
					</SheetHeader>
					<div className="px-4 pb-4">
						<div className="text-xs text-muted-foreground mb-2">
							Se importarán {pendingUpdates.length} obras. Mostrando las primeras {previewRows.length}.
						</div>
						<div className="border rounded-md overflow-hidden">
							<table className="w-full text-xs">
								<thead className="bg-muted/50 text-muted-foreground">
									<tr>
										<th className="px-3 py-2 text-left">#</th>
										<th className="px-3 py-2 text-left">Designación</th>
										<th className="px-3 py-2 text-left">Entidad</th>
										<th className="px-3 py-2 text-left">Mes básico</th>
										<th className="px-3 py-2 text-left">Inicio</th>
										<th className="px-3 py-2 text-right">%</th>
									</tr>
								</thead>
								<tbody>
									{previewRows.map((row) => (
										<tr key={row._rowIndex} className="border-t">
											<td className="px-3 py-2 text-muted-foreground">{row._rowIndex}</td>
											<td className="px-3 py-2">{toText(row.designacionYUbicacion)}</td>
											<td className="px-3 py-2">{toText(row.entidadContratante)}</td>
											<td className="px-3 py-2">{toText(row.mesBasicoDeContrato)}</td>
											<td className="px-3 py-2">{toText(row.iniciacion)}</td>
											<td className="px-3 py-2 text-right tabular-nums">{clampPercentage(row.porcentaje).toFixed(1)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
					<SheetFooter>
						<div className="flex w-full items-center justify-end gap-2">
							<Button type="button" variant="outline" onClick={handleCancelPreview} disabled={isImporting}>
								Cancelar
							</Button>
							<Button type="button" onClick={handleConfirmImport} disabled={isImporting}>
								{isImporting ? "Importando..." : "Confirmar importación"}
							</Button>
						</div>
					</SheetFooter>
				</SheetContent>
			</Sheet>

			<FormTable key={refreshKey} config={tableConfig}>
				<div className="space-y-1 relative">
					{/* <p className="text-sm uppercase tracking-wide text-orange-800/80 -mb-1">

					</p> */}
					<div className="w-full flex items-end justify-between gap-3 mb-2">
						<h1 className="text-5xl my-2 font-bold text-foreground">
							Panel de obras
						</h1>
						<FormTableTabs className="justify-start" />
					</div>
					{/* <p className="text-sm text-slate-600">
						Filtrá, buscá y actualizá tus obras directamente desde esta vista.
					</p> */}

					<div className="w-full flex items-center justify-between gap-2 relative">
						<FormTableToolbar />
						<div className="flex items-center gap-2">
							<input
								ref={inputRef}
								type="file"
								accept=".csv,text/csv"
								className="hidden"
								onChange={(event) => {
									const file = event.target.files?.[0];
									if (file) handleCsvImport(file);
								}}
							/>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={handleImportClick}
								disabled={isImporting}
								className="gap-2"
							>
								<Upload className="h-4 w-4" />
								{isImporting ? "Importando..." : "Importar CSV"}
							</Button>
							<Button variant="outline" size="sm" asChild>
								<Link href="/excel/reporte" className="gap-2">
									<FileText className="h-4 w-4" />
									Generar Reporte
								</Link>
							</Button>
						</div>
					</div>
					<FormTableContent className="md:max-w-[calc(98vw-var(--sidebar-current-width))] " />
					<FormTablePagination />
				</div>
			</FormTable>
		</div>
	);
}
