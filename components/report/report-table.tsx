'use client';

import { useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReportColumn, AggregationType } from "./types";

type ReportTableProps<Row> = {
	title: string;
	data: Row[];
	columns: ReportColumn<Row>[];
	hiddenColumnIds: string[];
	sortColumnId: string | null;
	sortDirection: "asc" | "desc";
	onSort: (columnId: string) => void;
	aggregations: Record<string, AggregationType>;
	getRowId: (row: Row) => string;
	currencyLocale?: string;
	currencyCode?: string;
};

function formatValue(
	value: unknown,
	type: ReportColumn<unknown>["type"],
	currencyLocale = "es-AR",
	currencyCode = "ARS"
): string {
	if (value == null) return "-";

	switch (type) {
		case "currency": {
			const num = typeof value === "number" ? value : Number(value) || 0;
			return new Intl.NumberFormat(currencyLocale, {
				style: "currency",
				currency: currencyCode,
			}).format(num);
		}
		case "number": {
			const num = typeof value === "number" ? value : Number(value) || 0;
			return num.toLocaleString(currencyLocale);
		}
		case "boolean":
			return value ? "Sí" : "No";
		case "date":
			if (!value) return "-";
			return String(value);
		default:
			return String(value ?? "-");
	}
}

function calculateAggregation<Row>(
	data: Row[],
	column: ReportColumn<Row>,
	aggType: AggregationType,
	currencyLocale = "es-AR",
	currencyCode = "ARS"
): string | number | null {
	if (aggType === "none") return null;

	const values = data.map((row) => column.accessor(row));

	switch (aggType) {
		case "sum": {
			const numValues = values.map((v) => (typeof v === "number" ? v : Number(v) || 0));
			const sum = numValues.reduce((a, b) => a + b, 0);
			if (column.type === "currency") {
				return new Intl.NumberFormat(currencyLocale, {
					style: "currency",
					currency: currencyCode,
				}).format(sum);
			}
			return sum.toLocaleString(currencyLocale);
		}
		case "count":
			return values.filter((v) => v != null && v !== "").length;
		case "count-checked":
			return values.filter((v) => v === true).length;
		case "average": {
			const nums = values
				.map((v) => (typeof v === "number" ? v : Number(v) || 0))
				.filter((n) => n !== 0);
			if (nums.length === 0) return 0;
			const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
			if (column.type === "currency") {
				return new Intl.NumberFormat(currencyLocale, {
					style: "currency",
					currency: currencyCode,
				}).format(avg);
			}
			return avg.toLocaleString(currencyLocale, { maximumFractionDigits: 2 });
		}
		default:
			return null;
	}
}

export function ReportTable<Row>({
	title,
	data,
	columns,
	hiddenColumnIds,
	sortColumnId,
	sortDirection,
	onSort,
	aggregations,
	getRowId,
	currencyLocale = "es-AR",
	currencyCode = "ARS",
}: ReportTableProps<Row>) {
	const visibleColumns = useMemo(
		() => columns.filter((col) => !hiddenColumnIds.includes(col.id)),
		[columns, hiddenColumnIds]
	);

	const sortedData = useMemo(() => {
		if (!sortColumnId) return data;

		const sortColumn = columns.find((col) => col.id === sortColumnId);
		if (!sortColumn) return data;

		const sorted = [...data];
		sorted.sort((a, b) => {
			const aVal = sortColumn.accessor(a);
			const bVal = sortColumn.accessor(b);

			if (aVal == null && bVal == null) return 0;
			if (aVal == null) return sortDirection === "asc" ? 1 : -1;
			if (bVal == null) return sortDirection === "asc" ? -1 : 1;

			if (typeof aVal === "string" && typeof bVal === "string") {
				return sortDirection === "asc"
					? aVal.localeCompare(bVal)
					: bVal.localeCompare(aVal);
			}

			const aNum = Number(aVal);
			const bNum = Number(bVal);
			if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
				return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
			}

			return sortDirection === "asc"
				? String(aVal).localeCompare(String(bVal))
				: String(bVal).localeCompare(String(aVal));
		});

		return sorted;
	}, [data, sortColumnId, sortDirection, columns]);

	const hasAggregations = Object.values(aggregations).some((agg) => agg !== "none");

	return (
		<div className="space-y-2 break-inside-avoid">
			<h3 className="text-lg font-semibold">{title}</h3>
			<div className="border rounded-lg overflow-hidden">
				<table className="w-full text-sm">
					<thead className="bg-muted">
						<tr>
							{visibleColumns.map((col) => (
								<th
									key={col.id}
									className={cn(
										"px-3 py-2 text-xs font-semibold uppercase cursor-pointer hover:bg-muted/80",
										col.align === "right" && "text-right",
										col.align === "center" && "text-center",
										!col.align && "text-left"
									)}
									style={{ width: col.width }}
									onClick={() => onSort(col.id)}
								>
									<div
										className={cn(
											"flex items-center gap-1",
											col.align === "right" && "justify-end",
											col.align === "center" && "justify-center"
										)}
									>
										{col.label}
										{sortColumnId === col.id &&
											(sortDirection === "asc" ? (
												<ChevronUp className="h-3 w-3" />
											) : (
												<ChevronDown className="h-3 w-3" />
											))}
									</div>
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{sortedData.map((row, idx) => (
							<tr
								key={getRowId(row)}
								className={cn(
									"border-t",
									idx % 2 === 0 ? "bg-background" : "bg-muted/20"
								)}
							>
								{visibleColumns.map((col) => {
									const value = col.accessor(row);
									const displayValue = col.render
										? col.render(value, row)
										: formatValue(value, col.type, currencyLocale, currencyCode);

									return (
										<td
											key={col.id}
											className={cn(
												"px-3 py-2",
												col.align === "right" && "text-right",
												col.align === "center" && "text-center",
												col.type === "currency" && "font-mono"
											)}
										>
											{displayValue}
										</td>
									);
								})}
							</tr>
						))}
						{hasAggregations && (
							<tr className="border-t-2 bg-muted/50 font-semibold">
								{visibleColumns.map((col) => {
									const aggType = aggregations[col.id] || "none";
									const aggValue = calculateAggregation(
										sortedData,
										col,
										aggType,
										currencyLocale,
										currencyCode
									);
									return (
										<td
											key={col.id}
											className={cn(
												"px-3 py-2",
												col.align === "right" && "text-right",
												col.align === "center" && "text-center"
											)}
										>
											{aggValue ?? ""}
										</td>
									);
								})}
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
