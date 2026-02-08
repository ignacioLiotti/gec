"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type MeasurementRow = {
	item: string;
	unidad: string;
	cantPresup: number;
	ejePeriodo: number;
	acumulado: number;
	obs: string;
};

export function createEmptyRow(): MeasurementRow {
	return { item: "", unidad: "", cantPresup: 0, ejePeriodo: 0, acumulado: 0, obs: "" };
}

interface MeasurementTableProps {
	rows: MeasurementRow[];
	onChange: (rows: MeasurementRow[]) => void;
}

export function MeasurementTable({ rows, onChange }: MeasurementTableProps) {
	function updateRow(index: number, field: keyof MeasurementRow, value: string) {
		const next = rows.map((row, i) => {
			if (i !== index) return row;
			if (field === "ejePeriodo") {
				const ejePeriodo = Number(value) || 0;
				return { ...row, ejePeriodo, acumulado: ejePeriodo };
			}
			if (field === "cantPresup") {
				return { ...row, cantPresup: Number(value) || 0 };
			}
			return { ...row, [field]: value };
		});
		onChange(next);
	}

	function addRow() {
		onChange([...rows, createEmptyRow()]);
	}

	function removeRow(index: number) {
		onChange(rows.filter((_, i) => i !== index));
	}

	return (
		<div className="space-y-3">
			{rows.length === 0 ? (
				<div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
					<p className="mb-3">No hay items de presupuesto cargados.</p>
					<Button variant="outline" size="sm" onClick={addRow}>
						<Plus className="mr-2 h-4 w-4" />
						Agregar item
					</Button>
				</div>
			) : (
				<>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Item</TableHead>
								<TableHead className="w-20">Unidad</TableHead>
								<TableHead className="w-28 text-right">Cant. Presup.</TableHead>
								<TableHead className="w-28 text-right">Ejec. Periodo</TableHead>
								<TableHead className="w-24 text-right">Acumulado</TableHead>
								<TableHead className="w-24 text-right">Pendiente</TableHead>
								<TableHead className="w-20 text-right">%</TableHead>
								<TableHead className="w-28">Obs</TableHead>
								<TableHead className="w-10" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((row, index) => {
								const pct = row.cantPresup > 0 ? (row.acumulado / row.cantPresup) * 100 : 0;
								const pendiente = row.cantPresup - row.acumulado;
								const overBudget = pct > 100;

								return (
									<TableRow
										key={index}
										className={cn(overBudget && "bg-amber-50")}
									>
										<TableCell>
											<Input
												className="h-7 text-sm"
												value={row.item}
												onChange={(e) => updateRow(index, "item", e.target.value)}
												placeholder="Descripcion del item"
											/>
										</TableCell>
										<TableCell>
											<Input
												className="h-7 text-sm"
												value={row.unidad}
												onChange={(e) => updateRow(index, "unidad", e.target.value)}
												placeholder="m2"
											/>
										</TableCell>
										<TableCell>
											<Input
												type="number"
												className="h-7 text-right text-sm tabular-nums"
												value={row.cantPresup || ""}
												onChange={(e) => updateRow(index, "cantPresup", e.target.value)}
											/>
										</TableCell>
										<TableCell>
											<Input
												type="number"
												className="h-7 text-right text-sm tabular-nums"
												value={row.ejePeriodo || ""}
												onChange={(e) => updateRow(index, "ejePeriodo", e.target.value)}
											/>
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{row.acumulado.toLocaleString()}
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{pendiente.toLocaleString()}
										</TableCell>
										<TableCell className={cn("text-right tabular-nums", overBudget && "text-amber-600 font-medium")}>
											{pct.toFixed(1)}%
										</TableCell>
										<TableCell>
											<Input
												className="h-7 text-sm"
												value={row.obs}
												onChange={(e) => updateRow(index, "obs", e.target.value)}
												placeholder="—"
											/>
										</TableCell>
										<TableCell>
											<Button
												variant="ghost"
												size="icon-sm"
												onClick={() => removeRow(index)}
												className="text-muted-foreground hover:text-destructive"
											>
												<Trash2 className="h-3.5 w-3.5" />
											</Button>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
					<Button variant="outline" size="sm" onClick={addRow}>
						<Plus className="mr-2 h-4 w-4" />
						Agregar item
					</Button>
				</>
			)}
		</div>
	);
}
