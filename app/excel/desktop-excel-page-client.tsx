'use client';

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FileText, Upload } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
	FormTable,
	FormTableContent,
	FormTablePagination,
	FormTableTabs,
	FormTableToolbar,
} from "@/components/form-table/form-table";
import {
	createObrasDetalleConfig,
	mapObraToDetailRow,
	obrasDetalleConfig,
	type MainTableColumnConfig,
	type ObrasDetalleRow,
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
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { NotchTail } from "@/components/ui/notch-tail";
import type { ExcelPageClientProps } from "@/lib/excel/types";
import { ContextualWizard, type WizardFlow } from "@/components/ui/contextual-wizard";
import {
	GUIDED_EXCEL_STAGES,
	getGuidedExcelStage,
	isGuidedExcelTour,
} from "@/lib/demo-tours/excel-guided-flow";

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

const normalizeCsvDateValue = (value: unknown): string => {
	const raw = toText(value);
	if (!raw) return "";

	const fullDate = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (fullDate) {
		const day = fullDate[1].padStart(2, "0");
		const month = fullDate[2].padStart(2, "0");
		return `${day}/${month}/${fullDate[3]}`;
	}

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

export default function DesktopExcelPageClient({
	initialMainTableColumnsConfig,
	initialObras,
}: ExcelPageClientProps) {
	const searchParams = useSearchParams();
	const [isImporting, setIsImporting] = useState(false);
	const [refreshKey, setRefreshKey] = useState(0);
	const [mainTableColumnsConfig] = useState<MainTableColumnConfig[] | null>(
		initialMainTableColumnsConfig as MainTableColumnConfig[] | null
	);
	const inputRef = useRef<HTMLInputElement>(null);
	const [isPreviewOpen, setIsPreviewOpen] = useState(false);
	const [previewRows, setPreviewRows] = useState<CsvPreviewRow[]>([]);
	const [pendingUpdates, setPendingUpdates] = useState<CsvObra[]>([]);
	const [pendingFileName, setPendingFileName] = useState("");
	const [hydratedRows, setHydratedRows] = useState<ObrasDetalleRow[] | null>(() =>
		initialObras.map(mapObraToDetailRow)
	);
	const guidedTourStage = getGuidedExcelStage(searchParams);
	const guidedExcelFlow = useMemo<WizardFlow | null>(() => {
		if (!isGuidedExcelTour(searchParams) || guidedTourStage !== GUIDED_EXCEL_STAGES.excelIntro) {
			return null;
		}

		return {
			id: "guided-excel-landing",
			title: "Recorrido guiado",
			steps: [
				{
					id: "header",
					targetId: "excel-page-header",
					title: "Tu cartera de obras",
					content:
						"Acá están todas las obras con sus datos actualizados. De un vistazo ya sabés cuántas tenés en ejecución, el avance y los importes más importantes.",
					placement: "bottom",
					skippable: false,
				},
				{
					id: "table",
					targetId: "excel-page-table",
					title: "Todo de un vistazo",
					content:
						"Cada fila es una obra activa. Las columnas muestran fechas, importes y avance para que en segundos conozcas el estado de tu cartera.",
					placement: "top",
					skippable: false,
				},
				{
					id: "open-obra",
					targetId: "excel-page-open-obra",
					title: "Entrá a ver el detalle",
					content:
						"Hacé clic en el nombre de la obra para ver todos sus datos: avance, importes, alertas y documentos.",
					placement: "right",
					allowClickThrough: true,
					requiredAction: "click_target",
					waitForMs: 2200,
					skippable: false,
				},
			],
		};
	}, [guidedTourStage, searchParams]);

	const tableConfig = useMemo(() => {
		const baseConfig =
			mainTableColumnsConfig == null
				? obrasDetalleConfig
				: createObrasDetalleConfig(mainTableColumnsConfig);
		return hydratedRows == null
			? baseConfig
			: {
				...baseConfig,
				defaultRows: hydratedRows,
			};
	}, [hydratedRows, mainTableColumnsConfig]);

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
			porc: "porcentaje",
		}),
		[]
	);

	const handleCsvImport = useCallback(
		(file: File) => {
			setIsImporting(true);

			const decodeWithFallback = async () => {
				const buffer = await file.arrayBuffer();
				const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
				const utf8ReplacementCount = (utf8.match(/\uFFFD/g) ?? []).length;
				if (utf8ReplacementCount === 0) return utf8;
				const win1252 = new TextDecoder("windows-1252", { fatal: false }).decode(buffer);
				const winReplacementCount = (win1252.match(/\uFFFD/g) ?? []).length;
				return winReplacementCount < utf8ReplacementCount ? win1252 : utf8;
			};

			void (async () => {
				try {
					const [{ default: Papa }, csvText] = await Promise.all([
						import("papaparse"),
						decodeWithFallback(),
					]);
					const results = Papa.parse<string[]>(csvText, {
						header: false,
						skipEmptyLines: true,
						delimiter: ";",
					});

					if (results.errors.length) {
						throw new Error(results.errors[0]?.message || "No se pudo leer el CSV");
					}

					const rows = results.data as CsvRow[];
					if (!rows.length) {
						throw new Error("El CSV esta vacio");
					}

					const headerRows = isMultiRowHeader(rows) ? 3 : 1;
					const headers = buildHeaders(rows, headerRows);
					const mappedRows = rows
						.slice(headerRows)
						.map((row) => {
							const mapped: Record<string, string> = {};
							headers.forEach((header, index) => {
								if (!header) return;
								const normalized = normalizeHeader(header);
								const mappedKey =
									headerAliases[normalized as keyof typeof headerAliases] ?? normalized;
								mapped[mappedKey] = toText(row[index]);
							});
							return mapped as CsvObra;
						})
						.filter((row) =>
							Object.values(row).some((value) => String(value ?? "").trim().length > 0)
						);

					if (!mappedRows.length) {
						throw new Error("El CSV no contiene filas validas");
					}

					const validRows = mappedRows.filter(
						(row) =>
							toText(row.designacionYUbicacion) &&
							toText(row.entidadContratante) &&
							toText(row.mesBasicoDeContrato) &&
							toText(row.iniciacion)
					);

					if (!validRows.length) {
						throw new Error("No hay filas validas con campos obligatorios");
					}

					const skippedCount = mappedRows.length - validRows.length;

					let currentMaxN = 0;
					try {
						const existingResponse = await fetch("/api/obras", { cache: "no-store" });
						if (existingResponse.ok) {
							const existingPayload = await existingResponse.json();
							const existingObras = Array.isArray(existingPayload.detalleObras)
								? (existingPayload.detalleObras as Array<{ n?: number | string | null }>)
								: [];
							currentMaxN = existingObras.reduce((max, obra) => {
								const obraN = Math.trunc(toNumber(obra.n));
								return Number.isFinite(obraN) && obraN > max ? obraN : max;
							}, 0);
						}
					} catch (existingError) {
						console.error(
							"No se pudieron cargar las obras existentes para calcular el N°",
							existingError
						);
					}

					let nextAuto = currentMaxN + 1;
					const updates = validRows.map((row) => {
						const finalN = nextAuto;
						nextAuto += 1;
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

					toast.message(
						`Se asignaron Nro consecutivos desde ${currentMaxN + 1} para agregar las obras al final`
					);
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
					if (inputRef.current) {
						inputRef.current.value = "";
					}
				}
			})();
		},
		[headerAliases]
	);

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
			setHydratedRows(null);
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

	return (
		<div className="relative min-h-full max-w-[calc(100vw-var(--sidebar-current-width))] bg-[#fafafa] px-4 py-4 md:px-8 md:py-8">
			<Sheet open={isPreviewOpen} onOpenChange={(open) => !open && handleCancelPreview()}>
				<SheetContent side="right" className="border-l-[#ece7df] bg-[#f6f2eb] p-2 shadow-[0_20px_60px_rgba(15,23,42,0.14)] sm:max-w-lg">
					<div className="flex h-full flex-col rounded-[24px] border border-[#f3eee7] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,250,250,0.96)_100%)]">
						<SheetHeader>
							<SheetTitle className="text-[#1a1a1a]">Previsualizacion de importacion</SheetTitle>
							<SheetDescription className="text-[#999]">
								{pendingFileName ? `Archivo: ${pendingFileName}` : "Revisa las primeras filas antes de importar."}
							</SheetDescription>
						</SheetHeader>
						<div className="px-4 pb-4">
							<div className="mb-2 rounded-xl border border-[#ece7df] bg-[#fcfaf7] px-3 py-2 text-xs text-[#777]">
								Se importaran {pendingUpdates.length} obras. Mostrando las primeras {previewRows.length}.
							</div>
							<div className="overflow-hidden rounded-xl border border-[#ece7df]">
								<table className="w-full text-xs">
									<thead className="bg-[#fcfaf7] text-[#777]">
										<tr>
											<th className="px-3 py-2 text-left">#</th>
											<th className="px-3 py-2 text-left">Designacion</th>
											<th className="px-3 py-2 text-left">Entidad</th>
											<th className="px-3 py-2 text-left">Mes basico</th>
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
												<td className="px-3 py-2 text-right tabular-nums">
													{clampPercentage(row.porcentaje).toFixed(1)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
						<SheetFooter>
							<div className="flex w-full items-center justify-end gap-2">
								<Button
									type="button"
									variant="outline"
									onClick={handleCancelPreview}
									disabled={isImporting}
									className="gap-2 rounded-lg border-[#e8e1d8] bg-white px-3.5 text-[#5a5248] hover:bg-[#fcfaf7] hover:text-[#1f1a17]"
								>
									Cancelar
								</Button>
								<Button
									type="button"
									onClick={handleConfirmImport}
									disabled={isImporting}
									className="rounded-lg bg-[#1f1a17] text-white hover:bg-[#2b241f]"
								>
									{isImporting ? "Importando..." : "Confirmar importacion"}
								</Button>
							</div>
						</SheetFooter>
					</div>
				</SheetContent>
			</Sheet>

			<FormTable key={refreshKey} config={tableConfig}>
				<div className="relative space-y-5">
					<div className="flex flex-col gap-4">
						<div className="flex w-full flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
							<div data-wizard-target="excel-page-header">
								<h1 className="text-3xl font-semibold tracking-tight text-[#1a1a1a] sm:text-4xl">
									Panel de obras
								</h1>
								<p className="mt-1 text-sm text-[#999]">
									Filtra, busca y actualiza tus obras desde una vista unificada.
								</p>
							</div>
							<div data-wizard-target="excel-page-tabs">
								<FormTableTabs className={cn("flex h-11 justify-start rounded-lg p-1")} />
							</div>
						</div>
					</div>

					<div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:justify-between xl:-mb-0">
						<div
							data-wizard-target="excel-page-toolbar"
							className="relative -ml-[1px] flex items-center gap-2 rounded-xl border border-[#09090b1f] bg-card p-2 pb-0 xl:rounded-r-none xl:rounded-b-none xl:border-r-0 xl:border-b-0"
							style={
								{
									"--notch-bg": "white",
									"--notch-stroke": "rgb(231 229 228)",
								} as React.CSSProperties
							}
						>
							<FormTableToolbar />
							<NotchTail side="right" className="z-100 mb-[1px] h-[45px] !hidden xl:!block" />
						</div>
						<div
							className="relative -mr-[1px] flex items-center gap-2 rounded-xl border border-[#09090b1f] bg-card p-2 pb-0 xl:justify-end xl:rounded-l-none xl:rounded-b-none xl:border-l-0 xl:border-b-0"
							style={
								{
									"--notch-bg": "white",
									"--notch-stroke": "rgb(231 229 228)",
								} as React.CSSProperties
							}
						>
							<NotchTail side="left" className="mb-[1px] h-[45px] !hidden xl:!block" />
							<input
								ref={inputRef}
								type="file"
								accept=".csv,text/csv"
								className="hidden"
								onChange={(event) => {
									const file = event.target.files?.[0];
									if (file) {
										handleCsvImport(file);
									}
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
								<Link href="/excel/reporte" prefetch={false} className="gap-2">
									<FileText className="h-4 w-4" />
									Generar Reporte
								</Link>
							</Button>
						</div>
					</div>
					<div
						data-wizard-target="excel-page-table"
						className="flex flex-col gap-4 rounded-xl bg-card p-2.5 pt-3.5 shadow-card xl:rounded-t-none "
					>
						<FormTableContent className="my-0 overflow-hidden rounded-lg shadow-card md:max-w-[calc(98vw-var(--sidebar-current-width))]" />
						<Separator className="bg-border" />
						<FormTablePagination />
					</div>
					{guidedExcelFlow ? (
						<ContextualWizard
							open
							onOpenChange={() => { }}
							flow={guidedExcelFlow}
							showCloseButton={false}
						/>
					) : null}
				</div>
			</FormTable>
		</div>
	);
}
