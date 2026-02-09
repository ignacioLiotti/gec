import type { ReportColumn } from "@/components/report/types";

export type ReportExportMeta = {
	title?: string;
	companyName?: string;
	date?: string;
	generatedAt?: string;
	viewMode?: string;
	filters?: Record<string, unknown>;
};

function sanitizeFileName(name: string) {
	return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").slice(0, 120);
}

function formatCsvValue(value: unknown): string {
	if (value == null) return "";
	const text = String(value);
	const escaped = text.replace(/"/g, '""');
	return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function formatFilters(filters?: Record<string, unknown>) {
	if (!filters) return "";
	return Object.entries(filters)
		.filter(([, value]) => value != null && value !== "")
		.map(([key, value]) => {
			if (Array.isArray(value)) {
				return `${key}=${value.join("; ")}`;
			}
			return `${key}=${String(value)}`;
		})
		.join(" | ");
}

export function exportToCsv<Row>(
	rows: Row[],
	columns: ReportColumn<Row>[],
	fileName: string,
	meta?: ReportExportMeta,
) {
	const header = columns.map((c) => formatCsvValue(c.label)).join(",");
	const body = rows
		.map((row) => columns.map((c) => formatCsvValue(c.accessor(row))).join(","))
		.join("\n");
	const metaLines: string[] = [];
	if (meta?.title) metaLines.push(`Reporte,${formatCsvValue(meta.title)}`);
	if (meta?.companyName)
		metaLines.push(`Empresa,${formatCsvValue(meta.companyName)}`);
	if (meta?.date) metaLines.push(`Fecha,${formatCsvValue(meta.date)}`);
	if (meta?.generatedAt)
		metaLines.push(`Generado,${formatCsvValue(meta.generatedAt)}`);
	if (meta?.viewMode) metaLines.push(`Vista,${formatCsvValue(meta.viewMode)}`);
	const filtersText = formatFilters(meta?.filters);
	if (filtersText) metaLines.push(`Filtros,${formatCsvValue(filtersText)}`);

	const metaBlock = metaLines.length ? `${metaLines.join("\n")}\n\n` : "";
	const csv = `${metaBlock}${header}\n${body}`;
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `${sanitizeFileName(fileName)}.csv`;
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
}

export async function exportToXlsx<Row>(
	rows: Row[],
	columns: ReportColumn<Row>[],
	fileName: string,
	meta?: ReportExportMeta,
) {
	const { generateXlsxFile } = await import("./export-xlsx-server");
	const data = rows.map((row) => {
		const record: Record<string, unknown> = {};
		columns.forEach((col) => {
			record[col.label] = col.accessor(row);
		});
		return record;
	});
	const { base64 } = await generateXlsxFile({ data, fileName, meta });
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	const blob = new Blob([bytes], {
		type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	});
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `${sanitizeFileName(fileName)}.xlsx`;
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
}
