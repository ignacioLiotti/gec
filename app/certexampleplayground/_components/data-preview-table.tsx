"use client";

import { Badge } from "@/components/ui/badge";
import type { ExtractedTable, DbTableDef } from "../_lib/types";

type DataPreviewTableProps = {
	extractedTable: ExtractedTable;
	tableDef: DbTableDef;
	maxRows?: number;
};

function formatValue(value: unknown, type: string): string {
	if (value === null || value === undefined) return "—";
	const str = String(value).trim();
	if (str === "") return "—";

	if (type === "numeric" && typeof value === "number") {
		return value.toLocaleString("es-AR", {
			minimumFractionDigits: 0,
			maximumFractionDigits: 2,
		});
	}

	return str;
}

export function DataPreviewTable({
	extractedTable,
	tableDef,
	maxRows = 25,
}: DataPreviewTableProps) {
	const activeMappings = extractedTable.mappings.filter(
		(m) => m.excelHeader !== null
	);
	const displayRows = extractedTable.rows.slice(0, maxRows);

	if (activeMappings.length === 0) {
		return (
			<p className="text-sm text-muted-foreground py-4 text-center">
				Sin columnas mapeadas. Configurá el mapeo para ver la vista previa.
			</p>
		);
	}

	return (
		<div className="space-y-2">
			<div className="flex items-center gap-2">
				<Badge variant="outline" className="text-xs">
					{extractedTable.rowCount} filas
				</Badge>
				<span className="text-xs text-muted-foreground">
					desde hoja "{extractedTable.sourceSheetName}"
				</span>
			</div>
			<div className="overflow-auto max-h-[400px] border rounded-md">
				<table className="w-full text-xs">
					<thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
						<tr>
							<th className="px-2 py-1.5 text-left font-medium border-b border-r w-8">
								#
							</th>
							{activeMappings.map((m) => {
								const col = tableDef.columns.find(
									(c) => c.key === m.dbColumn
								);
								return (
									<th
										key={m.dbColumn}
										className="px-2 py-1.5 text-left font-medium border-b border-r whitespace-nowrap"
									>
										{col?.label ?? m.dbColumn}
									</th>
								);
							})}
						</tr>
					</thead>
					<tbody>
						{displayRows.map((row, idx) => (
							<tr key={idx} className="border-b hover:bg-muted/30">
								<td className="px-2 py-1 text-muted-foreground border-r text-right">
									{idx + 1}
								</td>
								{activeMappings.map((m) => {
									const col = tableDef.columns.find(
										(c) => c.key === m.dbColumn
									);
									const val = row[m.dbColumn];
									const formatted = formatValue(val, col?.type ?? "text");
									return (
										<td
											key={m.dbColumn}
											className="px-2 py-1 border-r max-w-[200px] truncate whitespace-nowrap"
											title={String(val ?? "")}
										>
											{formatted === "—" ? (
												<span className="text-muted-foreground/40">—</span>
											) : (
												formatted
											)}
										</td>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{extractedTable.rowCount > maxRows && (
				<p className="text-xs text-muted-foreground">
					Mostrando primeras {maxRows} de {extractedTable.rowCount} filas
				</p>
			)}
		</div>
	);
}
