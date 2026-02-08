"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MeasurementTable, createEmptyRow, type MeasurementRow } from "./measurement-table";
import type { FlowStepData } from "../_hooks/use-flow-state";

interface MeasurementSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	measurementStep: FlowStepData | undefined;
	onSubmit: (rows: MeasurementRow[]) => void;
}

export function MeasurementSheet({
	open,
	onOpenChange,
	measurementStep,
	onSubmit,
}: MeasurementSheetProps) {
	const [rows, setRows] = useState<MeasurementRow[]>(() => {
		if (measurementStep?.outputs && Array.isArray((measurementStep.outputs as any)?.rows)) {
			return (measurementStep.outputs as any).rows;
		}
		return [];
	});

	function handleConfirm() {
		onSubmit(rows);
		onOpenChange(false);
	}

	const hasRows = rows.length > 0;
	const hasFilledRows = rows.some((r) => r.item.trim() !== "");

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="sm:max-w-2xl">
				<SheetHeader>
					<SheetTitle>Medicion del Periodo</SheetTitle>
					<SheetDescription>
						Agregue los items del presupuesto y registre las cantidades ejecutadas.
					</SheetDescription>
				</SheetHeader>
				<ScrollArea className="flex-1 px-4">
					<MeasurementTable rows={rows} onChange={setRows} />
				</ScrollArea>
				<SheetFooter className="flex-row justify-end gap-2">
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
					>
						Cancelar
					</Button>
					<Button variant="outline" onClick={() => {}} disabled={!hasRows}>
						Guardar borrador
					</Button>
					<Button onClick={handleConfirm} disabled={!hasFilledRows}>
						Confirmar medicion
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
