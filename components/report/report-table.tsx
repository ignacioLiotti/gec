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
	compareData?: Row[] | null;
	showCompare?: boolean;
	columns: ReportColumn<Row>[];
	hiddenColumnIds: string[];
	sortColumnId: string | null;
	sortDirection: "asc" | "desc";
	onSort: (columnId: string) => void;
	aggregations: Record<string, AggregationType>;
	summaryDisplay?: "row" | "card";
	showMiniCharts?: boolean;
	summaryChartType?: "bar" | "line";
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

function parseNumericValue(value: unknown): number | null {
	if (value == null) return null;
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "boolean") return value ? 1 : 0;
	if (typeof value !== "string") {
		const num = Number(value);
		return Number.isFinite(num) ? num : null;
	}

	let str = value.trim();
	if (!str) return null;

	let isNegative = false;
	if (str.startsWith("(") && str.endsWith(")")) {
		isNegative = true;
		str = str.slice(1, -1).trim();
	}

	// Remove currency symbols and spaces
	str = str.replace(/[^\d,.-]/g, "");

	const hasComma = str.includes(",");
	const hasDot = str.includes(".");

	if (hasComma && hasDot) {
		// Assume dot is thousands separator, comma is decimal
		str = str.replace(/\./g, "").replace(",", ".");
	} else if (hasComma && !hasDot) {
		// Assume comma is decimal
		str = str.replace(",", ".");
	} else {
		// Only dot or only digits: keep as-is
	}

	const num = Number(str);
	if (!Number.isFinite(num)) return null;
	return isNegative ? -num : num;
}

function parseDateValue(value: unknown): number | null {
	if (value == null) return null;
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value.getTime();
	}
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value !== "string") return null;
	const raw = value.trim();
	if (!raw) return null;

	const native = Date.parse(raw);
	if (!Number.isNaN(native)) return native;

	const match = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:\s+.*)?$/);
	if (match) {
		const day = Number(match[1]);
		const month = Number(match[2]) - 1;
		const year = Number(match[3]);
		const date = new Date(year, month, day);
		const ts = date.getTime();
		return Number.isNaN(ts) ? null : ts;
	}

	return null;
}

function formatDateValue(value: unknown, locale: string): string {
	const ts = parseDateValue(value);
	if (ts == null) return String(value ?? "-");
	return new Intl.DateTimeFormat(locale).format(new Date(ts));
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
			const num = parseNumericValue(value) ?? 0;
			return getNumberFormatter(currencyLocale, currencyCode).format(num);
		}
		case "number": {
			const num = parseNumericValue(value) ?? 0;
			return getNumberFormatter(currencyLocale).format(num);
		}
		case "boolean":
			return value ? "Si" : "No";
		case "date":
			if (!value) return "-";
			return formatDateValue(value, currencyLocale);
		default:
			return String(value ?? "-");
	}
}


/* ------------------------------------------------------------------ */
/*  Aggregation calculation                                            */
/* ------------------------------------------------------------------ */

function calculateAggregationRaw<Row>(
	data: Row[],
	column: ReportColumn<Row>,
	aggType: AggregationType,
): number | null {
	if (aggType === "none") return null;

	const values = data.map((row) => column.accessor(row));

	if (column.type === "date") {
		if (aggType === "count" || aggType === "count-checked") {
			return aggType === "count"
				? values.filter((v) => v != null && v !== "").length
				: values.filter((v) => v === true).length;
		}
		const timestamps = values
			.map((v) => parseDateValue(v))
			.filter((v): v is number => v != null && Number.isFinite(v));
		if (timestamps.length === 0) return 0;
		switch (aggType) {
			case "min":
				return Math.min(...timestamps);
			case "max":
				return Math.max(...timestamps);
			case "average":
			case "sum": {
				let total = 0;
				for (const ts of timestamps) total += ts;
				return total / timestamps.length;
			}
			default:
				return null;
		}
	}

	switch (aggType) {
		case "sum": {
			let sum = 0;
			for (const v of values) {
				const num = parseNumericValue(v);
				if (num != null) sum += num;
			}
			return sum;
		}
		case "count":
			return values.filter((v) => v != null && v !== "").length;
		case "count-checked":
			return values.filter((v) => v === true).length;
		case "average": {
			const nums: number[] = [];
			for (const v of values) {
				const n = parseNumericValue(v);
				if (n != null) nums.push(n);
			}
			if (nums.length === 0) return 0;
			let total = 0;
			for (const n of nums) total += n;
			return total / nums.length;
		}
		case "min": {
			const nums = values
				.map((v) => parseNumericValue(v))
				.filter((v): v is number => v != null && Number.isFinite(v));
			if (nums.length === 0) return 0;
			return Math.min(...nums);
		}
		case "max": {
			const nums = values
				.map((v) => parseNumericValue(v))
				.filter((v): v is number => v != null && Number.isFinite(v));
			if (nums.length === 0) return 0;
			return Math.max(...nums);
		}
		default:
			return null;
	}
}

function formatAggregationValue<Row>(
	value: number | null,
	column: ReportColumn<Row>,
	aggType: AggregationType,
	currencyLocale: string,
	currencyCode: string
): string {
	if (value == null || aggType === "none") return "";
	if (aggType === "count" || aggType === "count-checked") {
		return String(value);
	}
	if (column.type === "date") {
		return formatDateValue(value, currencyLocale);
	}
	if (column.type === "currency") {
		return getNumberFormatter(currencyLocale, currencyCode).format(value);
	}
	if (column.type === "number") {
		return getNumberFormatter(currencyLocale).format(value);
	}
	return getDecimalFormatter(currencyLocale).format(value);
}

function formatDelta<Row>(
	value: number,
	column: ReportColumn<Row>,
	currencyLocale: string,
	currencyCode: string
): string {
	if (column.type === "currency") {
		return getNumberFormatter(currencyLocale, currencyCode).format(value);
	}
	return getDecimalFormatter(currencyLocale).format(value);
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
	compareData = null,
	showCompare = false,
	columns,
	hiddenColumnIds,
	sortColumnId,
	sortDirection,
	onSort,
	aggregations,
	summaryDisplay = "row",
	showMiniCharts = true,
	summaryChartType = "bar",
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

	const summaryItems = useMemo(() => {
		const items = visibleColumns
			.map((col) => {
				const aggType = aggregations[col.id] || "none";
				if (aggType === "none") return null;
				const raw = calculateAggregationRaw(sortedData, col, aggType);
				const series = sortedData
					.map((row) => {
						const value = col.accessor(row);
						const num = typeof value === "number" ? value : Number(value);
						return Number.isFinite(num) ? num : null;
					})
					.filter((value): value is number => value !== null);
				const sampled =
					series.length > 24
						? series.filter((_, idx) => idx % Math.ceil(series.length / 24) === 0)
						: series;
				return {
					id: col.id,
					label: col.label,
					type: col.type,
					align: col.align,
					aggType,
					raw,
					value: formatAggregationValue(
						raw,
						col,
						aggType,
						currencyLocale,
						currencyCode
					),
					series: sampled,
				};
			})
			.filter(Boolean) as Array<{
				id: string;
				label: string;
				type: ReportColumn<Row>["type"];
				align?: ReportColumn<Row>["align"];
				aggType: AggregationType;
				raw: number | null;
				value: string;
				series: number[];
			}>;

		return { items };
	}, [aggregations, currencyCode, currencyLocale, sortedData, visibleColumns]);

	function getSparklinePoints(series: number[]) {
		if (!series.length) return "";
		const min = Math.min(...series);
		const max = Math.max(...series);
		const range = max - min || 1;
		return series
			.map((value, index) => {
				const x = series.length === 1 ? 50 : (index / (series.length - 1)) * 100;
				const y = 100 - ((value - min) / range) * 100;
				return `${x},${y}`;
			})
			.join(" ");
	}

	function getBarHeights(series: number[]) {
		if (!series.length) return [];
		const min = Math.min(...series);
		const max = Math.max(...series);
		const range = max - min || 1;
		return series.map((value) => ((value - min) / range) * 100);
	}

	return (
		<div className="report-table-section">
			<h3 className="report-group-title font-serif">{title}</h3>
			<div className="report-table-scroll">
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
						{hasAggregations && summaryDisplay === "row" && (
							<tr className="report-totals-row">
								{visibleColumns.map((col) => {
									const aggType = aggregations[col.id] || "none";
									const aggRaw = calculateAggregationRaw(sortedData, col, aggType);
									const aggValue = formatAggregationValue(
										aggRaw,
										col,
										aggType,
										currencyLocale,
										currencyCode
									);
									const compareRaw = showCompare && compareData
										? calculateAggregationRaw(compareData, col, aggType)
										: null;
									const delta =
										compareRaw != null && aggRaw != null
											? aggRaw - compareRaw
											: null;
									const deltaPct =
										compareRaw && compareRaw !== 0 && delta != null
											? (delta / compareRaw) * 100
											: null;
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
											{showCompare && delta != null && aggType !== "none" && (
												<div
													className={cn(
														"mt-1 text-[10px] font-semibold",
														delta > 0 && "text-emerald-600",
														delta < 0 && "text-red-600",
														delta === 0 && "text-muted-foreground"
													)}
												>
													{delta > 0 ? "+" : ""}
														{formatDelta<Row>(delta, col, currencyLocale, currencyCode)}
													{deltaPct != null && Number.isFinite(deltaPct) && (
														<span className="ml-1">
															({deltaPct > 0 ? "+" : ""}
															{deltaPct.toFixed(1)}%)
														</span>
													)}
												</div>
											)}
										</td>
									);
								})}
							</tr>
						)}
					</tbody>
				</table>
			</div>

			{hasAggregations && summaryDisplay === "card" && (
				<div className="report-summary-card bg-primary">
					<div className="report-summary-title">Resumen</div>
					<div className="report-summary-grid">
						{summaryItems.items.map((item) => {
							const value = item.value || "-";
							return (
								<div key={item.id} className="report-summary-item">
									<div className="report-summary-label">{item.label}</div>
									<div className="report-summary-value">{value}</div>
									{showMiniCharts && summaryChartType === "bar" && (
										<div className="report-summary-chart">
											<svg viewBox="0 0 100 100" preserveAspectRatio="none">
												{getBarHeights(item.series).map((height, idx) => {
													const barWidth = 100 / Math.max(item.series.length, 1);
													return (
														<rect
															key={`${item.id}-bar-${idx}`}
															x={idx * barWidth + 1}
															y={100 - height}
															width={Math.max(barWidth - 2, 1)}
															height={height}
														/>
													);
												})}
											</svg>
										</div>
									)}
									{showMiniCharts && summaryChartType === "line" && item.series.length > 1 && (
										<div className="report-summary-chart">
											<svg viewBox="0 0 100 100" preserveAspectRatio="none">
												<polyline points={getSparklinePoints(item.series)} />
											</svg>
										</div>
									)}
								</div>
							);
						})}
					</div>
				</div>
			)}

			<div className="report-section-separator" />
		</div>
	);
}

export const ReportTable = memo(ReportTableInner) as typeof ReportTableInner;
