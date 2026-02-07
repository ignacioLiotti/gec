'use client';

import { memo, useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReportColumn, AggregationType } from "./types";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Formatter cache                                                    */
/* ------------------------------------------------------------------ */

const formatterCache = new Map<string, Intl.NumberFormat>();

function getNumberFormatter(locale: string, currency?: string): Intl.NumberFormat {
	const key = currency ? `${locale}:currency:${currency}` : `${locale}:number`;
	let fmt = formatterCache.get(key);
	if (!fmt) {
		fmt = currency
			? new Intl.NumberFormat(locale, { style: "currency", currency })
			: new Intl.NumberFormat(locale);
		formatterCache.set(key, fmt);
	}
	return fmt;
}

function getDecimalFormatter(locale: string): Intl.NumberFormat {
	const key = `${locale}:decimal:2`;
	let fmt = formatterCache.get(key);
	if (!fmt) {
		fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
		formatterCache.set(key, fmt);
	}
	return fmt;
}

/* ------------------------------------------------------------------ */
/*  Value formatting                                                   */
/* ------------------------------------------------------------------ */

function formatValue(
	value: unknown,
	type: ReportColumn<unknown>["type"],
	currencyLocale: string,
	currencyCode: string
): string {
	if (value == null) return "-";

	switch (type) {
		case "currency": {
			const num = typeof value === "number" ? value : Number(value) || 0;
			return getNumberFormatter(currencyLocale, currencyCode).format(num);
		}
		case "number": {
			const num = typeof value === "number" ? value : Number(value) || 0;
			return getNumberFormatter(currencyLocale).format(num);
		}
		case "boolean":
			return value ? "Si" : "No";
		case "date":
			if (!value) return "-";
			return String(value);
		default:
			return String(value ?? "-");
	}
}

/* ------------------------------------------------------------------ */
/*  Aggregation calculation                                            */
/* ------------------------------------------------------------------ */

function calculateAggregation<Row>(
	data: Row[],
	column: ReportColumn<Row>,
	aggType: AggregationType,
	currencyLocale: string,
	currencyCode: string
): string | number | null {
	if (aggType === "none") return null;

	const values = data.map((row) => column.accessor(row));

	switch (aggType) {
		case "sum": {
			let sum = 0;
			for (const v of values) {
				sum += typeof v === "number" ? v : Number(v) || 0;
			}
			return column.type === "currency"
				? getNumberFormatter(currencyLocale, currencyCode).format(sum)
				: getNumberFormatter(currencyLocale).format(sum);
		}
		case "count":
			return values.filter((v) => v != null && v !== "").length;
		case "count-checked":
			return values.filter((v) => v === true).length;
		case "average": {
			const nums: number[] = [];
			for (const v of values) {
				const n = typeof v === "number" ? v : Number(v) || 0;
				if (n !== 0) nums.push(n);
			}
			if (nums.length === 0) return 0;
			let total = 0;
			for (const n of nums) total += n;
			const avg = total / nums.length;
			return column.type === "currency"
				? getNumberFormatter(currencyLocale, currencyCode).format(avg)
				: getDecimalFormatter(currencyLocale).format(avg);
		}
		default:
			return null;
	}
}

/* ------------------------------------------------------------------ */
/*  Sorting                                                            */
/* ------------------------------------------------------------------ */

function sortData<Row>(
	data: Row[],
	sortColumnId: string | null,
	sortDirection: "asc" | "desc",
	columns: ReportColumn<Row>[]
): Row[] {
	if (!sortColumnId) return data;

	const sortColumn = columns.find((col) => col.id === sortColumnId);
	if (!sortColumn) return data;

	const sorted = [...data];
	const dir = sortDirection === "asc" ? 1 : -1;

	sorted.sort((a, b) => {
		const aVal = sortColumn.accessor(a);
		const bVal = sortColumn.accessor(b);

		if (aVal == null && bVal == null) return 0;
		if (aVal == null) return dir;
		if (bVal == null) return -dir;

		if (typeof aVal === "string" && typeof bVal === "string") {
			return dir * aVal.localeCompare(bVal);
		}

		const aNum = Number(aVal);
		const bNum = Number(bVal);
		if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
			return dir * (aNum - bNum);
		}

		return dir * String(aVal).localeCompare(String(bVal));
	});

	return sorted;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function ReportTableInner<Row>({
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

	const sortedData = useMemo(
		() => sortData(data, sortColumnId, sortDirection, columns),
		[data, sortColumnId, sortDirection, columns]
	);

	const hasAggregations = useMemo(
		() => Object.values(aggregations).some((agg) => agg !== "none"),
		[aggregations]
	);

	return (
		<div className="report-table-section">
			<h3 className="report-group-title font-serif">{title}</h3>
			<table className="report-table">
				<thead>
					<tr>
						{visibleColumns.map((col) => (
							<th
								key={col.id}
								className={cn(
									"report-th cursor-pointer",
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
									<span>{col.label}</span>
									{sortColumnId === col.id && (
										sortDirection === "asc" ? (
											<ChevronUp className="h-3 w-3 opacity-60" />
										) : (
											<ChevronDown className="h-3 w-3 opacity-60" />
										)
									)}
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
								"report-tr",
								idx % 2 === 1 && "report-tr-alt"
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
											"report-td",
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
						<tr className="report-totals-row">
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
											"report-td",
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
	);
}

export const ReportTable = memo(ReportTableInner) as typeof ReportTableInner;
