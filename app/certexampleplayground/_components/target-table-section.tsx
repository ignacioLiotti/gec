"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
	DbTableDef,
	RawSheet,
	ColumnMapping,
	ExtractedTable,
	SheetAnalysis,
} from "../_lib/types";
import { ColumnMappingPanel } from "./column-mapping";
import { DataPreviewTable } from "./data-preview-table";

type TargetTableSectionProps = {
	tableDef: DbTableDef;
	analysis: SheetAnalysis | null;
	sheets: RawSheet[];
	assignedSheetName: string | null;
	mappings: ColumnMapping[];
	extractedTable: ExtractedTable | null;
	onSheetChange: (sheetName: string | null) => void;
	onMappingChange: (dbColumn: string, excelHeader: string | null) => void;
};

const UNASSIGNED = "__none__";

export function TargetTableSection({
	tableDef,
	analysis,
	sheets,
	assignedSheetName,
	mappings,
	extractedTable,
	onSheetChange,
	onMappingChange,
}: TargetTableSectionProps) {
	const [activeTab, setActiveTab] = useState<string>("mapping");
	const assignedSheet = sheets.find((s) => s.name === assignedSheetName);
	const confidence = analysis?.matchScore ?? 0;

	return (
		<div
			className={cn(
				"rounded-lg border bg-card shadow-sm overflow-hidden",
				!assignedSheetName && "opacity-70"
			)}
		>
			{/* Header */}
			<div className="flex items-center justify-between gap-4 px-4 py-3 bg-muted/40 border-b">
				<div className="flex items-center gap-3">
					<Badge
						className={cn(
							"text-xs font-mono",
							assignedSheetName
								? "bg-orange-100 text-orange-700 border-orange-200"
								: "bg-muted text-muted-foreground"
						)}
					>
						{tableDef.id}
					</Badge>
					<div>
						<p className="text-sm font-medium">{tableDef.label}</p>
						<p className="text-xs text-muted-foreground">
							{tableDef.description}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-3 shrink-0">
					{assignedSheetName && confidence > 0 && (
						<Badge
							className={cn(
								"text-[10px]",
								confidence >= 0.5
									? "bg-emerald-100 text-emerald-700 border-emerald-200"
									: confidence >= 0.3
										? "bg-amber-100 text-amber-700 border-amber-200"
										: "bg-red-100 text-red-700 border-red-200"
							)}
						>
							{Math.round(confidence * 100)}% confianza
						</Badge>
					)}
					<Select
						value={assignedSheetName ?? UNASSIGNED}
						onValueChange={(v) =>
							onSheetChange(v === UNASSIGNED ? null : v)
						}
					>
						<SelectTrigger className="h-8 w-[220px] text-xs">
							<SelectValue placeholder="Sin hoja asignada" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={UNASSIGNED}>
								— Sin hoja asignada —
							</SelectItem>
							{sheets.map((s) => (
								<SelectItem key={s.name} value={s.name}>
									{s.name} ({s.dataRows.length} filas)
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* Content */}
			{assignedSheet ? (
				<div className="p-4">
					{tableDef.extractionMode === "horizontal" ? (
						extractedTable ? (
							<DataPreviewTable
								extractedTable={extractedTable}
								tableDef={tableDef}
							/>
						) : (
							<p className="text-sm text-muted-foreground py-4 text-center">
								No se encontró la fila &quot;AVANCE MENSUAL&quot; en esta hoja.
							</p>
						)
					) : (
						<Tabs value={activeTab} onValueChange={setActiveTab}>
							<TabsList className="grid w-full grid-cols-2 max-w-xs">
								<TabsTrigger value="mapping">Mapeo de columnas</TabsTrigger>
								<TabsTrigger value="preview">Vista previa</TabsTrigger>
							</TabsList>
							<TabsContent value="mapping" className="mt-3">
								<ColumnMappingPanel
									targetTable={tableDef}
									excelHeaders={assignedSheet.headers}
									mappings={mappings}
									onMappingChange={onMappingChange}
								/>
							</TabsContent>
							<TabsContent value="preview" className="mt-3">
								{extractedTable ? (
									<DataPreviewTable
										extractedTable={extractedTable}
										tableDef={tableDef}
									/>
								) : (
									<p className="text-sm text-muted-foreground py-4 text-center">
										Sin datos extraídos. Verificá el mapeo de columnas.
									</p>
								)}
							</TabsContent>
						</Tabs>
					)}
				</div>
			) : (
				<div className="px-4 py-6 text-center">
					<p className="text-sm text-muted-foreground">
						No se detectó una hoja para esta tabla. Seleccioná una manualmente.
					</p>
				</div>
			)}
		</div>
	);
}
