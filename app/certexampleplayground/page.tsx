"use client";

import { useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

import type {
	ParseResult,
	ColumnMapping,
	DbTableId,
	ExtractedTable,
} from "./_lib/types";
import { parseExcelFile } from "./_lib/excel-parser";
import {
	DB_TABLE_DEFS,
	buildMappings,
	applyMappings,
} from "./_lib/column-matcher";

import { Dropzone } from "./_components/dropzone";
import { TargetTableSection } from "./_components/target-table-section";
import { SheetRawPreview } from "./_components/sheet-raw-preview";

export default function CertExamplePlaygroundPage() {
	const [isLoading, setIsLoading] = useState(false);
	const [parseResult, setParseResult] = useState<ParseResult | null>(null);
	const [showDebug, setShowDebug] = useState(false);

	// User overrides for sheet assignments per target table
	const [sheetAssignments, setSheetAssignments] = useState<
		Record<DbTableId, string | null>
	>({ pmc_resumen: null, pmc_items: null, curva_plan: null });

	// User overrides for column mappings per target table
	const [columnMappings, setColumnMappings] = useState<
		Record<DbTableId, ColumnMapping[]>
	>({ pmc_resumen: [], pmc_items: [], curva_plan: [] });

	const handleFile = useCallback(async (file: File) => {
		setIsLoading(true);
		try {
			const result = await parseExcelFile(file);
			setParseResult(result);

			// Initialize sheet assignments from auto-detection
			// For each target table, pick the best-scoring sheet
			const assignments: Record<DbTableId, string | null> = {
				pmc_resumen: null,
				pmc_items: null,
				curva_plan: null,
			};
			const mappingsInit: Record<DbTableId, ColumnMapping[]> = {
				pmc_resumen: [],
				pmc_items: [],
				curva_plan: [],
			};

			for (const tableId of ["pmc_resumen", "pmc_items", "curva_plan"] as DbTableId[]) {
				// Find best sheet for this table (highest scoring, not yet assigned)
				const assignedSheets = new Set(Object.values(assignments).filter(Boolean));
				let bestSheet: string | null = null;
				let bestScore = 0;

				for (const analysis of result.analyses) {
					if (analysis.targetTable === tableId && analysis.matchScore > bestScore) {
						if (!assignedSheets.has(analysis.sheetName)) {
							bestScore = analysis.matchScore;
							bestSheet = analysis.sheetName;
						}
					}
				}

				assignments[tableId] = bestSheet;

				if (bestSheet) {
					const sheet = result.sheets.find((s) => s.name === bestSheet);
					const tableDef = DB_TABLE_DEFS.find((t) => t.id === tableId)!;
					if (sheet) {
						mappingsInit[tableId] = buildMappings(sheet, tableDef);
					}
				}
			}

			setSheetAssignments(assignments);
			setColumnMappings(mappingsInit);
			toast.success(
				`Archivo analizado: ${result.sheets.length} hojas encontradas`
			);
		} catch (err) {
			console.error("Error parsing Excel:", err);
			toast.error("Error al analizar el archivo Excel");
		} finally {
			setIsLoading(false);
		}
	}, []);

	const handleSheetChange = useCallback(
		(tableId: DbTableId, sheetName: string | null) => {
			setSheetAssignments((prev) => ({ ...prev, [tableId]: sheetName }));

			// Rebuild mappings for this table with the new sheet
			if (sheetName && parseResult) {
				const sheet = parseResult.sheets.find((s) => s.name === sheetName);
				const tableDef = DB_TABLE_DEFS.find((t) => t.id === tableId)!;
				if (sheet) {
					setColumnMappings((prev) => ({
						...prev,
						[tableId]: buildMappings(sheet, tableDef),
					}));
				}
			} else {
				setColumnMappings((prev) => ({ ...prev, [tableId]: [] }));
			}
		},
		[parseResult]
	);

	const handleMappingChange = useCallback(
		(tableId: DbTableId, dbColumn: string, excelHeader: string | null) => {
			setColumnMappings((prev) => ({
				...prev,
				[tableId]: prev[tableId].map((m) =>
					m.dbColumn === dbColumn
						? { ...m, excelHeader, confidence: excelHeader ? 1 : 0 }
						: m
				),
			}));
		},
		[]
	);

	// Compute extracted tables from current assignments + mappings
	const extractedTables = useMemo(() => {
		if (!parseResult) return {} as Record<DbTableId, ExtractedTable | null>;

		const result: Record<DbTableId, ExtractedTable | null> = {
			pmc_resumen: null,
			pmc_items: null,
			curva_plan: null,
		};

		for (const tableId of ["pmc_resumen", "pmc_items", "curva_plan"] as DbTableId[]) {
			const sheetName = sheetAssignments[tableId];
			const mappings = columnMappings[tableId];
			const tableDef = DB_TABLE_DEFS.find((t) => t.id === tableId)!;
			if (!sheetName) continue;
			// For vertical extraction, need mappings; horizontal handles it internally
			if (tableDef.extractionMode !== "horizontal" && mappings.length === 0) continue;

			const sheet = parseResult.sheets.find((s) => s.name === sheetName);
			if (!sheet) continue;

			result[tableId] = applyMappings(sheet, mappings, tableDef);
		}

		return result;
	}, [parseResult, sheetAssignments, columnMappings]);

	// Stats
	const sheetsFound = parseResult?.sheets.length ?? 0;
	const tablesDetected = Object.values(sheetAssignments).filter(Boolean).length;
	const totalMapped = Object.values(columnMappings)
		.flat()
		.filter((m) => m.excelHeader !== null).length;
	const totalColumns = Object.values(columnMappings)
		.flat().length;

	return (
		<div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
			{/* Header */}
			<div>
				<div className="flex items-center gap-3">
					<FileSpreadsheet className="h-7 w-7 text-orange-500" />
					<h1 className="text-2xl font-bold">
						Playground: Parsing de Certificados Excel
					</h1>
				</div>
				<p className="text-sm text-muted-foreground mt-1">
					Herramienta de exploración para mapear columnas Excel a tablas PMC.
					Sin escritura a base de datos — solo visualización.
				</p>
			</div>

			{/* Dropzone */}
			<Dropzone onFile={handleFile} isLoading={isLoading} />

			{/* Results */}
			{parseResult && (
				<>
					{/* Stats */}
					<div className="grid grid-cols-3 gap-4">
						<div className="rounded-lg border bg-card p-4 text-center">
							<p className="text-2xl font-bold">{sheetsFound}</p>
							<p className="text-xs text-muted-foreground">
								hojas encontradas
							</p>
						</div>
						<div className="rounded-lg border bg-card p-4 text-center">
							<p className="text-2xl font-bold">{tablesDetected}/3</p>
							<p className="text-xs text-muted-foreground">
								tablas detectadas
							</p>
						</div>
						<div className="rounded-lg border bg-card p-4 text-center">
							<p className="text-2xl font-bold">
								{totalMapped}/{totalColumns}
							</p>
							<p className="text-xs text-muted-foreground">
								columnas mapeadas
							</p>
						</div>
					</div>

					{/* Target table sections */}
					<div className="space-y-4">
						{DB_TABLE_DEFS.map((tableDef) => {
							const analysis =
								parseResult.analyses.find(
									(a) =>
										a.sheetName === sheetAssignments[tableDef.id] &&
										a.targetTable === tableDef.id
								) ?? null;

							return (
								<TargetTableSection
									key={tableDef.id}
									tableDef={tableDef}
									analysis={analysis}
									sheets={parseResult.sheets}
									assignedSheetName={sheetAssignments[tableDef.id]}
									mappings={columnMappings[tableDef.id]}
									extractedTable={extractedTables[tableDef.id]}
									onSheetChange={(name) =>
										handleSheetChange(tableDef.id, name)
									}
									onMappingChange={(dbCol, header) =>
										handleMappingChange(tableDef.id, dbCol, header)
									}
								/>
							);
						})}
					</div>

					{/* Debug: raw sheets */}
					<div className="border rounded-lg overflow-hidden">
						<Button
							variant="ghost"
							className="w-full flex items-center justify-between px-4 py-3 h-auto"
							onClick={() => setShowDebug(!showDebug)}
						>
							<span className="text-sm font-medium">
								Ver hojas crudas ({parseResult.sheets.length})
							</span>
							{showDebug ? (
								<ChevronDown className="h-4 w-4" />
							) : (
								<ChevronRight className="h-4 w-4" />
							)}
						</Button>
						{showDebug && (
							<div className="p-4 space-y-6 border-t">
								{parseResult.sheets.map((sheet) => (
									<SheetRawPreview key={sheet.name} sheet={sheet} />
								))}
							</div>
						)}
					</div>

					{/* All sheet analyses debug */}
					<div className="border rounded-lg p-4">
						<p className="text-sm font-medium mb-3">
							Análisis de hojas (score por tabla)
						</p>
						<div className="overflow-auto">
							<table className="w-full text-xs">
								<thead>
									<tr className="border-b">
										<th className="px-2 py-1 text-left">Hoja</th>
										<th className="px-2 py-1 text-left">Tabla detectada</th>
										<th className="px-2 py-1 text-right">Score</th>
										<th className="px-2 py-1 text-right">Filas</th>
										<th className="px-2 py-1 text-right">Headers</th>
									</tr>
								</thead>
								<tbody>
									{parseResult.analyses.map((a) => (
										<tr key={a.sheetName} className="border-b">
											<td className="px-2 py-1 font-mono">{a.sheetName}</td>
											<td className="px-2 py-1">
												{a.targetTable ? (
													<Badge variant="outline" className="text-[10px]">
														{a.targetTable}
													</Badge>
												) : (
													<span className="text-muted-foreground">—</span>
												)}
											</td>
											<td className="px-2 py-1 text-right">
												{Math.round(a.matchScore * 100)}%
											</td>
											<td className="px-2 py-1 text-right">
												{parseResult.sheets.find(
													(s) => s.name === a.sheetName
												)?.dataRows.length ?? 0}
											</td>
											<td className="px-2 py-1 text-right">
												{parseResult.sheets.find(
													(s) => s.name === a.sheetName
												)?.headers.length ?? 0}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				</>
			)}
		</div>
	);
}
