"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { RawSheet } from "../_lib/types";

type SheetRawPreviewProps = {
	sheet: RawSheet;
	maxRows?: number;
};

export function SheetRawPreview({ sheet, maxRows = 15 }: SheetRawPreviewProps) {
	const displayRows = sheet.rawRows.slice(0, maxRows);
	const maxCols = Math.min(
		displayRows.reduce((max, row) => Math.max(max, (row as unknown[]).length), 0),
		16
	);

	return (
		<div className="space-y-2">
			<div className="flex items-center gap-2">
				<Badge variant="outline">{sheet.name}</Badge>
				<span className="text-xs text-muted-foreground">
					{sheet.totalRows} filas · {sheet.headers.length} columnas detectadas
					· header en fila {sheet.headerRowIndex}
				</span>
			</div>
			<div className="overflow-auto max-h-[300px] border rounded-md">
				<table className="w-full text-xs">
					<tbody>
						{displayRows.map((row, rowIdx) => {
							const cells = row as unknown[];
							return (
								<tr
									key={rowIdx}
									className={cn(
										"border-b",
										rowIdx === sheet.headerRowIndex &&
											"bg-orange-50 font-medium"
									)}
								>
									<td className="px-2 py-1 text-muted-foreground border-r bg-muted/30 sticky left-0 w-8 text-right">
										{rowIdx}
									</td>
									{Array.from({ length: maxCols }).map((_, colIdx) => {
										const val = String(cells[colIdx] ?? "").trim();
										return (
											<td
												key={colIdx}
												className="px-2 py-1 border-r max-w-[180px] truncate whitespace-nowrap"
												title={val}
											>
												{val || <span className="text-muted-foreground/30">-</span>}
											</td>
										);
									})}
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
			{sheet.totalRows > maxRows && (
				<p className="text-xs text-muted-foreground">
					Mostrando primeras {maxRows} de {sheet.totalRows} filas
				</p>
			)}
		</div>
	);
}
