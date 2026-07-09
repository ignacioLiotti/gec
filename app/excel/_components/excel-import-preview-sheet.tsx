"use client";

import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { ExcelInlineStatus } from "./excel-page-chrome";
import { clampPercentage, toText } from "./excel-page-format";

export type ExcelImportPreviewRow = {
	_rowIndex: number;
	designacionYUbicacion?: unknown;
	entidadContratante?: unknown;
	mesBasicoDeContrato?: unknown;
	iniciacion?: unknown;
	porcentaje?: unknown;
};

export function ExcelImportPreviewSheet({
	open,
	pendingFileName,
	pendingCount,
	previewRows,
	isImporting,
	onCancel,
	onConfirm,
}: {
	open: boolean;
	pendingFileName: string;
	pendingCount: number;
	previewRows: ExcelImportPreviewRow[];
	isImporting: boolean;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	return (
		<Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
			<SheetContent
				side="right"
				className="border-l-stroke-soft bg-canvas-muted p-2 shadow-modal sm:max-w-lg"
			>
				<div className="flex h-full flex-col rounded-lg border border-stroke-soft bg-surface text-content shadow-card">
					<SheetHeader>
						<SheetTitle className="text-content">Previsualizacion de importacion</SheetTitle>
						<SheetDescription className="text-content-muted">
							{pendingFileName
								? `Archivo: ${pendingFileName}`
								: "Revisa las primeras filas antes de importar."}
						</SheetDescription>
					</SheetHeader>
					<div className="px-4 pb-4">
						<ExcelInlineStatus className="mb-2 text-xs">
							Se importaran {pendingCount} obras. Mostrando las primeras {previewRows.length}.
						</ExcelInlineStatus>
						<div className="overflow-hidden rounded-lg border border-stroke-soft bg-surface">
							<table className="w-full text-xs">
								<thead className="bg-surface-recessed text-content-muted">
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
										<tr
											key={row._rowIndex}
											className="border-t border-stroke-soft hover:bg-table-row-hover"
										>
											<td className="px-3 py-2 text-content-muted">{row._rowIndex}</td>
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
								onClick={onCancel}
								disabled={isImporting}
							>
								Cancelar
							</Button>
							<Button type="button" onClick={onConfirm} disabled={isImporting}>
								{isImporting ? "Importando..." : "Confirmar importacion"}
							</Button>
						</div>
					</SheetFooter>
				</div>
			</SheetContent>
		</Sheet>
	);
}
