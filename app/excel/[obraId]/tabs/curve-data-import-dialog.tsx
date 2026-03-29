"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AlertCircle, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SpreadsheetImportSummaryModal } from "./file-manager/components/spreadsheet-import-summary-modal";
import type {
	SpreadsheetPreviewPayload,
	SpreadsheetPreviewTable,
} from "./file-manager/components/spreadsheet-preview-types";

type CurveDataImportDialogProps = {
	obraId: string;
	curvaPlanTableId: string | null;
	curvaPlanTableName: string;
	pmcResumenTableId: string | null;
	pmcResumenTableName: string;
	onImported?: () => Promise<void> | void;
};

type PreviewOverrides = Pick<
	SpreadsheetPreviewPayload,
	"sheetAssignments" | "columnMappings" | "manualValues"
>;

function buildPreviewPayload(
	rawPayload: {
		perTable?: SpreadsheetPreviewTable[];
		summary?: SpreadsheetPreviewPayload["summary"];
		sourceName?: string;
	},
	fileName: string,
	overrides?: Partial<PreviewOverrides>,
): SpreadsheetPreviewPayload {
	const previewTables = Array.isArray(rawPayload.perTable) ? rawPayload.perTable : [];
	const nextSheetAssignments: Record<string, string | null> = {};
	const nextColumnMappings: Record<string, Record<string, string | null>> = {};
	const nextManualValues: Record<string, Record<string, string>> = {};

	previewTables.forEach((table) => {
		nextSheetAssignments[table.tablaId] = table.sheetName ?? null;
		const tableMappings: Record<string, string | null> = {};
		const tableManualValues: Record<string, string> = {};
		(table.mappings ?? []).forEach((mapping) => {
			tableMappings[mapping.dbColumn] = mapping.excelHeader ?? null;
			tableManualValues[mapping.dbColumn] = mapping.manualValue ?? "";
		});
		nextColumnMappings[table.tablaId] = tableMappings;
		nextManualValues[table.tablaId] = tableManualValues;
	});

	return {
		perTable: previewTables,
		summary: rawPayload.summary,
		sheetAssignments: overrides?.sheetAssignments ?? nextSheetAssignments,
		columnMappings: overrides?.columnMappings ?? nextColumnMappings,
		manualValues: overrides?.manualValues ?? nextManualValues,
		existingFileName: rawPayload.sourceName ?? fileName,
		tablaIds: previewTables.map((table) => table.tablaId),
	};
}

export function CurveDataImportDialog({
	obraId,
	curvaPlanTableId,
	curvaPlanTableName,
	pmcResumenTableId,
	pmcResumenTableName,
	onImported,
}: CurveDataImportDialogProps) {
	const [open, setOpen] = useState(false);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [previewPayload, setPreviewPayload] = useState<SpreadsheetPreviewPayload | null>(null);
	const [excludedTablaIds, setExcludedTablaIds] = useState<string[]>([]);
	const [isLoadingPreview, setIsLoadingPreview] = useState(false);
	const [isApplying, setIsApplying] = useState(false);
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const targetTables = useMemo(
		() =>
			[
				pmcResumenTableId
					? { id: pmcResumenTableId, name: pmcResumenTableName, kind: "PMC Resumen" }
					: null,
				curvaPlanTableId
					? { id: curvaPlanTableId, name: curvaPlanTableName, kind: "Curva Plan" }
					: null,
			].filter((value): value is { id: string; name: string; kind: string } => value !== null),
		[curvaPlanTableId, curvaPlanTableName, pmcResumenTableId, pmcResumenTableName],
	);

	const resetState = useCallback(() => {
		setSelectedFile(null);
		setPreviewPayload(null);
		setExcludedTablaIds([]);
		setIsLoadingPreview(false);
		setIsApplying(false);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	}, []);

	const fetchPreview = useCallback(
		async (file: File, overrides?: Partial<PreviewOverrides>) => {
			const formData = new FormData();
			formData.append("file", file);
			formData.append(
				"tablaIds",
				JSON.stringify(targetTables.map((table) => table.id)),
			);
			if (overrides?.sheetAssignments) {
				formData.append("sheetAssignments", JSON.stringify(overrides.sheetAssignments));
			}
			if (overrides?.columnMappings) {
				formData.append("columnMappings", JSON.stringify(overrides.columnMappings));
			}
			if (overrides?.manualValues) {
				formData.append("manualValues", JSON.stringify(overrides.manualValues));
			}

			const response = await fetch(
				`/api/obras/${obraId}/tablas/import/spreadsheet-multi?preview=1&skipStorage=1`,
				{
					method: "POST",
					body: formData,
				},
			);
			const payload = await response.json().catch(() => ({} as Record<string, unknown>));
			if (!response.ok) {
				throw new Error(
					typeof payload.error === "string"
						? payload.error
						: "No se pudo generar la vista previa del archivo.",
				);
			}
			return buildPreviewPayload(
				{
					perTable: Array.isArray(payload.perTable)
						? (payload.perTable as SpreadsheetPreviewTable[])
						: [],
					summary: payload.summary as SpreadsheetPreviewPayload["summary"],
					sourceName:
						typeof payload.sourceName === "string" ? payload.sourceName : file.name,
				},
				file.name,
				overrides,
			);
		},
		[obraId, targetTables],
	);

	const handleAnalyzeFile = useCallback(
		async (file: File) => {
			if (targetTables.length === 0) {
				toast.error("No hay tablas de Curva Plan o PMC Resumen configuradas para esta obra.");
				return;
			}

			try {
				setIsLoadingPreview(true);
				const nextPayload = await fetchPreview(file);
				setSelectedFile(file);
				setPreviewPayload(nextPayload);
				setExcludedTablaIds(
					nextPayload.perTable
						.filter((table) => table.includedByDefault === false)
						.map((table) => table.tablaId),
				);
			} catch (error) {
				console.error(error);
				toast.error(
					error instanceof Error
						? error.message
						: "No se pudo analizar el archivo.",
				);
			} finally {
				setIsLoadingPreview(false);
			}
		},
		[fetchPreview, targetTables.length],
	);

	const handleManualValueChange = useCallback(
		async (tablaId: string, dbColumn: string, value: string) => {
			if (!selectedFile || !previewPayload) return;
			const nextManualValues = {
				...previewPayload.manualValues,
				[tablaId]: {
					...(previewPayload.manualValues[tablaId] ?? {}),
					[dbColumn]: value,
				},
			};

			try {
				setIsLoadingPreview(true);
				const nextPayload = await fetchPreview(selectedFile, {
					sheetAssignments: previewPayload.sheetAssignments,
					columnMappings: previewPayload.columnMappings,
					manualValues: nextManualValues,
				});
				setPreviewPayload(nextPayload);
			} catch (error) {
				console.error(error);
				toast.error(
					error instanceof Error
						? error.message
						: "No se pudo actualizar la vista previa.",
				);
			} finally {
				setIsLoadingPreview(false);
			}
		},
		[fetchPreview, previewPayload, selectedFile],
	);

	const handleImport = useCallback(async () => {
		if (!selectedFile || !previewPayload) return;
		const selectedTablaIds = previewPayload.tablaIds.filter(
			(tablaId) => !excludedTablaIds.includes(tablaId),
		);
		if (selectedTablaIds.length === 0) {
			toast.error("Selecciona al menos una seccion para importar.");
			return;
		}

		try {
			setIsApplying(true);
			const formData = new FormData();
			formData.append("file", selectedFile);
			formData.append("tablaIds", JSON.stringify(selectedTablaIds));
			formData.append("replaceExisting", "true");
			formData.append(
				"sheetAssignments",
				JSON.stringify(previewPayload.sheetAssignments),
			);
			formData.append(
				"columnMappings",
				JSON.stringify(previewPayload.columnMappings),
			);
			formData.append("manualValues", JSON.stringify(previewPayload.manualValues));

			const response = await fetch(
				`/api/obras/${obraId}/tablas/import/spreadsheet-multi?skipStorage=1`,
				{
					method: "POST",
					body: formData,
				},
			);
			const payload = await response.json().catch(() => ({} as Record<string, unknown>));
			if (!response.ok) {
				throw new Error(
					typeof payload.error === "string"
						? payload.error
						: "No se pudo importar el archivo.",
				);
			}

			const perTableResults = Array.isArray(payload.perTable)
				? (payload.perTable as Array<{ inserted?: number }>)
				: [];
			if (perTableResults.length > 0) {
				const importedSections = perTableResults.filter(
					(result) => (result.inserted ?? 0) > 0,
				).length;
				const totalRows = perTableResults.reduce(
					(sum, result) => sum + (result.inserted ?? 0),
					0,
				);
				toast.success(
					`Importacion completada: ${totalRows} filas en ${importedSections} secciones.`,
				);
			} else {
				toast.success("Importacion completada.");
			}

			await onImported?.();
			setOpen(false);
			resetState();
		} catch (error) {
			console.error(error);
			toast.error(
				error instanceof Error ? error.message : "No se pudo importar el archivo.",
			);
		} finally {
			setIsApplying(false);
		}
	}, [excludedTablaIds, obraId, onImported, previewPayload, resetState, selectedFile]);

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (!nextOpen && !isApplying) {
				resetState();
			}
			setOpen(nextOpen);
		},
		[isApplying, resetState],
	);

	return (
		<>
			<Button
				type="button"
				size="sm"
				variant="outline"
				className="gap-2"
				onClick={() => setOpen(true)}
			>
				<Upload className="size-4" />
				Actualizar datos
			</Button>

			<Dialog open={open} onOpenChange={handleOpenChange}>
				<DialogContent className="max-w-5xl overflow-hidden p-0" showCloseButton={!isApplying}>
					{previewPayload ? (
						<SpreadsheetImportSummaryModal
							payload={previewPayload}
							excludedTablaIds={excludedTablaIds}
							isLoading={isLoadingPreview}
							isApplying={isApplying}
							allowAdjust={false}
							onCancel={() => handleOpenChange(false)}
							onConfirm={handleImport}
							onAdjust={() => undefined}
							onToggleTablaIncluded={(tablaId) =>
								setExcludedTablaIds((current) =>
									current.includes(tablaId)
										? current.filter((id) => id !== tablaId)
										: [...current, tablaId],
								)
							}
							onManualValueChange={handleManualValueChange}
						/>
					) : (
						<div className="flex flex-col">
							<DialogHeader>
								<DialogTitle>Actualizar curva de avance</DialogTitle>
								<DialogDescription>
									Carga un Excel o CSV para actualizar las tablas que alimentan
									la curva desde General.
								</DialogDescription>
							</DialogHeader>

							<div className="space-y-5 p-5">
								<div className="flex flex-wrap gap-2">
									{targetTables.length > 0 ? (
										targetTables.map((table) => (
											<span
												key={table.id}
												className="inline-flex items-center rounded-full border border-[#e8e8e8] bg-[#fafafa] px-3 py-1 text-xs font-medium text-[#666]"
											>
												{table.kind}: {table.name}
											</span>
										))
									) : (
										<div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
											<AlertCircle className="mt-0.5 size-4 shrink-0" />
											<span>
												No encontramos tablas destino para <strong>PMC Resumen</strong> o
												<strong> Curva Plan</strong> en esta obra.
											</span>
										</div>
									)}
								</div>

								<label
									className={cn(
										"block rounded-xl border border-dashed border-[#d9d9d9] bg-stone-50 p-6 text-center transition-colors",
										isLoadingPreview && "pointer-events-none opacity-70",
									)}
								>
									<input
										ref={fileInputRef}
										type="file"
										accept=".csv,.xls,.xlsx"
										className="hidden"
										disabled={isLoadingPreview || targetTables.length === 0}
										onChange={(event) => {
											const file = event.target.files?.[0] ?? null;
											if (!file) return;
											void handleAnalyzeFile(file);
										}}
									/>
									<div className="mx-auto flex max-w-md flex-col items-center gap-3">
										<div className="flex size-12 items-center justify-center rounded-full bg-white shadow-sm">
											<FileSpreadsheet className="size-5 text-orange-500" />
										</div>
								<div className="space-y-1">
									<p className="text-sm font-semibold text-[#1a1a1a]">
										Selecciona un archivo Excel o CSV
									</p>
									<p className="text-sm text-[#777]">
										Buscaremos automaticamente el resumen de certificados y la
										curva mensual.
									</p>
									<p className="text-xs text-[#999]">
										Al confirmar, esta carga reemplaza los datos actuales de las
										tablas destino.
									</p>
								</div>
										<div className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm font-medium text-[#333] shadow-sm">
											{isLoadingPreview ? (
												<>
													<Loader2 className="size-4 animate-spin" />
													Analizando archivo...
												</>
											) : (
												<>
													<Upload className="size-4" />
													Elegir archivo
												</>
											)}
										</div>
									</div>
								</label>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
