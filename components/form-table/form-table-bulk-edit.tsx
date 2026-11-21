"use client";

import { LightButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { useFormTable } from "./context";
import type { ColumnDef, FormTableRow } from "./types";

function coerceBulkEditValue<Row extends FormTableRow>(column: ColumnDef<Row>, rawValue: string) {
	const cellType = column.cellType ?? "text";
	if (cellType === "number" || cellType === "currency") {
		if (rawValue.trim() === "") return null;
		const normalized = rawValue.replace(/\./g, "").replace(",", ".");
		const parsed = Number(normalized);
		return Number.isFinite(parsed) ? parsed : rawValue;
	}
	if (cellType === "boolean" || cellType === "checkbox" || cellType === "toggle") {
		return rawValue === "true";
	}
	return rawValue;
}

export function FormTableBulkEditBar() {
	const { config, bulkSelection } = useFormTable<FormTableRow, unknown>();
	const [draft, setDraft] = useState({ selectionKey: "", value: "" });
	const selectedColumn = bulkSelection.selectedColumn;
	const isReadOnly = config.readOnly === true;

	if (isReadOnly || !selectedColumn || bulkSelection.count < 2) {
		return null;
	}

	const cellType = selectedColumn.cellType ?? "text";
	const selectOptions = selectedColumn.cellConfig?.selectOptions ?? [];
	const canUseSelect = cellType === "select" && selectOptions.length > 0;
	const isBoolean = cellType === "boolean" || cellType === "checkbox" || cellType === "toggle";
	const selectionKey = `${selectedColumn.id}:${bulkSelection.selectedRowIds.join(",")}`;
	const value = draft.selectionKey === selectionKey ? draft.value : "";
	const setValue = (nextValue: string) => setDraft({ selectionKey, value: nextValue });

	const apply = () => {
		bulkSelection.applyValue(coerceBulkEditValue(selectedColumn, value));
		setDraft({ selectionKey: "", value: "" });
	};

	return (
		<div className="flex flex-wrap items-center gap-2 rounded-md border border-accent-border bg-accent-soft px-3 py-2 text-sm text-orange-primary shadow-card">
			<span className="font-medium">
				{bulkSelection.count} celdas seleccionadas en {selectedColumn.label}
			</span>
			{canUseSelect ? (
				<Select value={value} onValueChange={setValue}>
					<SelectTrigger size="sm" className="w-[220px]">
						<SelectValue placeholder="Elegir valor" />
					</SelectTrigger>
					<SelectContent>
						{selectOptions.map((option) => (
							<SelectItem key={option.text} value={option.text}>
								{option.text}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			) : isBoolean ? (
				<Select value={value} onValueChange={setValue}>
					<SelectTrigger size="sm" className="w-[160px]">
						<SelectValue placeholder="Elegir valor" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="true">Si</SelectItem>
						<SelectItem value="false">No</SelectItem>
					</SelectContent>
				</Select>
			) : (
				<Input
					value={value}
					onChange={(event) => setValue(event.target.value)}
					placeholder="Valor para aplicar"
					type={cellType === "date" ? "date" : "text"}
					className="h-8 w-[220px]"
				/>
			)}
			<LightButton
				type="button"
				size="sm"
				variant="primarySolid"
				onClick={apply}
				disabled={value === ""}
				className="h-8 gap-1 px-2"
			>
				<Check className="size-3.5" />
				Aplicar
			</LightButton>
			<LightButton
				type="button"
				size="sm"
				variant="default"
				onClick={bulkSelection.clear}
				className="h-8 min-w-8 px-2"
				aria-label="Limpiar seleccion"
			>
				<X className="size-4" />
			</LightButton>
		</div>
	);
}
