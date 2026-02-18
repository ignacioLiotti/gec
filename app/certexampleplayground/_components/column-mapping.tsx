"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { DbTableDef, ColumnMapping } from "../_lib/types";

type ColumnMappingPanelProps = {
	targetTable: DbTableDef;
	excelHeaders: string[];
	mappings: ColumnMapping[];
	onMappingChange: (dbColumn: string, excelHeader: string | null) => void;
};

function confidenceBadge(confidence: number) {
	if (confidence >= 0.7) {
		return (
			<Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
				{Math.round(confidence * 100)}%
			</Badge>
		);
	}
	if (confidence >= 0.3) {
		return (
			<Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
				{Math.round(confidence * 100)}%
			</Badge>
		);
	}
	if (confidence > 0) {
		return (
			<Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">
				{Math.round(confidence * 100)}%
			</Badge>
		);
	}
	return (
		<Badge variant="outline" className="text-muted-foreground text-[10px]">
			-
		</Badge>
	);
}

const UNMAPPED = "__none__";

export function ColumnMappingPanel({
	targetTable,
	excelHeaders,
	mappings,
	onMappingChange,
}: ColumnMappingPanelProps) {
	return (
		<div className="space-y-2">
			{targetTable.columns.map((col) => {
				const mapping = mappings.find((m) => m.dbColumn === col.key);
				const currentHeader = mapping?.excelHeader ?? null;
				const confidence = mapping?.confidence ?? 0;

				return (
					<div
						key={col.key}
						className={cn(
							"flex items-center gap-3 rounded-md border px-3 py-2",
							currentHeader ? "bg-background" : "bg-muted/30"
						)}
					>
						<div className="w-[200px] shrink-0">
							<p className="text-sm font-medium">{col.label}</p>
							<p className="text-[10px] text-muted-foreground">{col.type}</p>
						</div>
						{confidenceBadge(confidence)}
						<span className="text-muted-foreground text-xs">→</span>
						<Select
							value={currentHeader ?? UNMAPPED}
							onValueChange={(v) =>
								onMappingChange(col.key, v === UNMAPPED ? null : v)
							}
						>
							<SelectTrigger className="h-8 text-xs flex-1">
								<SelectValue placeholder="Sin mapear" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={UNMAPPED}>— No mapear —</SelectItem>
								{excelHeaders
									.filter((h) => h.trim() !== "")
									.map((header) => (
										<SelectItem key={header} value={header}>
											{header}
										</SelectItem>
									))}
							</SelectContent>
						</Select>
					</div>
				);
			})}
		</div>
	);
}
