'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FileText, Search, Upload } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { NotchTail } from "./[obraId]/tabs/file-manager/file-manager";

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

const CSV_IMPORT_DEFAULT_YEAR = 2025;
const CSV_MONTH_MAP: Record<string, string> = {
	ene: "01",
	feb: "02",
	mar: "03",
	abr: "04",
	may: "05",
	jun: "06",
	jul: "07",
	ago: "08",
	sep: "09",
	set: "09",
	oct: "10",
	nov: "11",
	dic: "12",
};

const normalizeCsvDateValue = (value: unknown): string => {
	const raw = toText(value);
	if (!raw) return "";

	// Keep already-complete date values (e.g. 15/09/2022)
	const fullDate = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (fullDate) {
		const day = fullDate[1].padStart(2, "0");
		const month = fullDate[2].padStart(2, "0");
		return `${day}/${month}/${fullDate[3]}`;
	}

	// Support formats like "JUN.-16", "ENE-17", "feb. - 22"
	const monthDay = raw
		.toLowerCase()
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.match(/^([a-z]{3})\.?\s*-\s*(\d{1,2})$/);
	if (monthDay) {
		const month = CSV_MONTH_MAP[monthDay[1]];
		if (month) {
			const day = monthDay[2].padStart(2, "0");
			return `${day}/${month}/${CSV_IMPORT_DEFAULT_YEAR}`;
		}
	}

	return raw;
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

const DS = {
	page: "bg-[#fafafa]",
	frame: "rounded-[28px] border border-[#ece7df] bg-[#f6f2eb]/75 p-2 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_18px_45px_rgba(15,23,42,0.06)]",
	frameInner: "rounded-[24px] border border-[#f3eee7] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,250,250,0.96)_100%)] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset]",
	panel: "rounded-xl border border-[#ece7df] bg-[radial-gradient(100%_50%_at_50%_0,rgba(255,255,255,0.24)_0,rgba(255,255,255,0)_100%),rgba(250,250,250,0.8)] shadow-[0_0_0_1px_rgba(40,37,90,0.06),0_1px_0_rgba(255,255,255,0.75)_inset,0_0_0_1px_rgba(255,255,255,0.35)_inset,0_0_10px_rgba(79,56,146,0.06)_inset]",
	card: "overflow-hidden rounded-2xl border border-[#ece7df] bg-white/95 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_12px_32px_rgba(15,23,42,0.06)]",
};

const toolButtonClass =
	"gap-2 rounded-lg border-[#e8e1d8] bg-white px-3.5 text-[#5a5248] hover:bg-[#fcfaf7] hover:text-[#1f1a17]";

function Framed({
	className,
	innerClassName,
	children,
}: {
	className?: string;
	innerClassName?: string;
	children: ReactNode;
}) {
	return (
		<div className={cn(DS.frame, className)}>
			<div className={cn(DS.frameInner, innerClassName)}>{children}</div>
		</div>
	);
}

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
								mesBasicoDeContrato: normalizeCsvDateValue(row.mesBasicoDeContrato),
								iniciacion: normalizeCsvDateValue(row.iniciacion),
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
			<div className={cn("flex-1 px-4 py-4 space-y-4", DS.page)}>
				<Framed>
					<div className="space-y-4 p-4">
						<div className="flex items-center justify-between gap-2">
							<div>
								<h1 className="text-2xl font-semibold tracking-tight text-[#1a1a1a]">Panel de obras</h1>
								<p className="text-xs text-[#999]">Vista rápida y acceso a cada obra</p>
							</div>
							<Button variant="outline" size="sm" asChild className={toolButtonClass}>
								<Link href="/excel/reporte" className="gap-2">
									<FileText className="h-4 w-4" />
									Reporte
								</Link>
							</Button>
						</div>
						{isLoadingMobile ? (
							<div className="rounded-xl border border-[#ece7df] bg-[#fcfaf7] px-3 py-2 text-sm text-[#999]">Cargando obras...</div>
						) : (
							<div className="grid grid-cols-1 gap-3">
								{mobileObras.map((obra) => (
									<Link
										key={obra.id}
										href={`/excel/${obra.id}`}
										className="rounded-2xl border border-[#ece7df] bg-white p-4 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_10px_24px_rgba(15,23,42,0.05)] transition-colors hover:bg-[#fffaf5]"
									>
										<div className="text-xs text-[#999]">#{obra.n ?? "-"}</div>
										<div className="text-base font-semibold text-[#1a1a1a]">
											{toText(obra.designacionYUbicacion) || "Obra"}
										</div>
										<div className="text-sm text-[#777]">{toText(obra.entidadContratante)}</div>
										<div className="mt-3">
											<div className="mb-1 flex items-center justify-between text-xs">
												<span className="text-[#999]">Avance</span>
												<span className="font-medium tabular-nums text-[#555]">
													{clampPercentage(obra.porcentaje).toFixed(1)}%
												</span>
											</div>
											<div className="h-2 rounded-full bg-[#f3eee7]">
												<div
													className="h-2 rounded-full bg-orange-primary"
													style={{ width: `${clampPercentage(obra.porcentaje)}%` }}
												/>
											</div>
										</div>
									</Link>
								))}
								{mobileObras.length === 0 && (
									<div className="rounded-xl border border-[#ece7df] bg-[#fcfaf7] px-3 py-2 text-sm text-[#999]">
										No hay obras para mostrar.
									</div>
								)}
							</div>
						)}
					</div>
				</Framed>
			</div>
		);
	}

	return (
		<div className={cn("min-h-full px-4 py-4 md:px-8 md:py-8 max-w-[calc(100vw-var(--sidebar-current-width))]", DS.page)}>
			<Sheet open={isPreviewOpen} onOpenChange={(open) => !open && handleCancelPreview()}>
				<SheetContent side="right" className="sm:max-w-lg border-l-[#ece7df] bg-[#f6f2eb] p-2 shadow-[0_20px_60px_rgba(15,23,42,0.14)]">
					<div className="flex h-full flex-col rounded-[24px] border border-[#f3eee7] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,250,250,0.96)_100%)]">
						<SheetHeader>
							<SheetTitle className="text-[#1a1a1a]">Previsualización de importación</SheetTitle>
							<SheetDescription className="text-[#999]">
								{pendingFileName ? `Archivo: ${pendingFileName}` : "Revisá las primeras filas antes de importar."}
							</SheetDescription>
						</SheetHeader>
						<div className="px-4 pb-4">
							<div className="mb-2 rounded-xl border border-[#ece7df] bg-[#fcfaf7] px-3 py-2 text-xs text-[#777]">
								Se importarán {pendingUpdates.length} obras. Mostrando las primeras {previewRows.length}.
							</div>
							<div className="overflow-hidden rounded-xl border border-[#ece7df]">
								<table className="w-full text-xs">
									<thead className="bg-[#fcfaf7] text-[#777]">
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
											<tr key={row._rowIndex} className="border-t border-[#f0ebe5] hover:bg-[#fffaf5]">
												<td className="px-3 py-2 text-[#999]">{row._rowIndex}</td>
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
								<Button type="button" variant="outline" onClick={handleCancelPreview} disabled={isImporting} className={toolButtonClass}>
									Cancelar
								</Button>
								<Button type="button" onClick={handleConfirmImport} disabled={isImporting} className="rounded-lg bg-[#1f1a17] text-white hover:bg-[#2b241f]">
									{isImporting ? "Importando..." : "Confirmar importación"}
								</Button>
							</div>
						</SheetFooter>
					</div>
				</SheetContent>
			</Sheet>

			<FormTable key={refreshKey} config={tableConfig}>
				<div className="relative space-y-5 ">
					<div className="flex flex-col gap-4">
						<div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between w-full ">
							<div className="">
								<h1 className="text-3xl font-semibold tracking-tight text-[#1a1a1a] sm:text-4xl">
									Panel de obras
								</h1>
								<p className="mt-1 text-sm text-[#999]">
									Filtrá, buscá y actualizá tus obras desde una vista unificada.
								</p>
							</div>
							<FormTableTabs
								className={cn(
									"flex justify-start rounded-lg p-1 h-11",
								)}
							/>
						</div>

					</div>

					<div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:justify-between xl:-mb-0">
						<div className="flex items-center gap-2 relative rounded-xl xl:rounded-r-none xl:rounded-b-none border xl:border-r-0 xl:border-b-0 border-[#09090b1f] bg-card p-2 pb-0 -ml-[1px]" style={
							{
								"--notch-bg": "white",
								"--notch-stroke": "rgb(231 229 228)", // stone-200
							} as React.CSSProperties
						}>

							<FormTableToolbar />
							<NotchTail side="right" className=" mb-[1px] h-[45px] z-100 !hidden xl:!block" />

						</div>
						<div className="flex items-center gap-2 xl:justify-end relative rounded-xl xl:rounded-l-none xl:rounded-b-none border xl:border-l-0 xl:border-b-0 border-[#09090b1f] bg-card p-2 pb-0 -mr-[1px]"
							style={{
								"--notch-bg": "white",
								"--notch-stroke": "rgb(231 229 228)", // stone-200
							} as React.CSSProperties
							}>
							<NotchTail side="left" className=" mb-[1px] h-[45px] !hidden xl:!block" />
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
								onClick={handleImportClick}
								disabled={isImporting}
							>
								<Upload className="h-4 w-4" />
								{isImporting ? "Importando..." : "Importar CSV"}
							</Button>
							<Button variant="outline" asChild>
								<Link href="/excel/reporte" className="gap-2">
									<FileText className="h-4 w-4" />
									Generar Reporte
								</Link>
							</Button>
						</div>
					</div>
					<div className="shadow-card bg-card p-2.5 pt-3.5 rounded-xl xl:rounded-t-none gap-4 flex flex-col">
						<FormTableContent className="md:max-w-[calc(98vw-var(--sidebar-current-width))] my-0 shadow-card rounded-lg overflow-hidden " />
						<Separator className="bg-border" />
						<FormTablePagination />
					</div>
				</div>
			</FormTable >
		</div >
	);
}


type GlassyIconProps = {
	className?: string;
	title?: string;
	/** por default usa var(--primary) como en tu snippet */
	primaryVar?: string;
	children: React.ReactNode;
	size?: number;
	rounded?: string;
};

export function GlassyIcon({
	className = "",
	title = "Power Lightning",
	primaryVar = "var(--color-orange-primary)",
	children,
	size = 10,
	rounded = "lg",
}: GlassyIconProps) {
	return (
		<div
			className={[
				`relative flex h-${size} shrink-0 items-center justify-center rounded-${rounded}`,
				"transition-colors duration-300",
				"[&_*]:transition-colors [&_*]:duration-300",
				className,
			].join(" ")}
			style={
				{
					// Esto hace que .gradient-ring y .gradient-shadow usen tu color dinámico
					["--primary" as any]: primaryVar,
					// Esto hace que el SVG use ese mismo color (currentColor)
					color: "var(--primary)",
				} as React.CSSProperties
			}
		>
			{children}

			<div className={`gradient-ring absolute inset-0 rounded-${rounded}`} />
			<div className={`gradient-shadow absolute inset-0 rounded-${rounded} bg-[var(--primary)]/20`} />
		</div>
	);
}