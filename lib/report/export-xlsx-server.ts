"use server";

import type { ReportExportMeta } from "./export";

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

export type ExportXlsxPayload = {
	data: Record<string, unknown>[];
	fileName: string;
	meta?: ReportExportMeta;
};

/** Server-only: generates XLSX file. Requires `xlsx` in node_modules. */
export async function generateXlsxFile(
	payload: ExportXlsxPayload,
): Promise<{ base64: string }> {
	const { data, meta } = payload;
	const xlsx = await import("xlsx");
	const worksheet = xlsx.utils.json_to_sheet(data);
	const workbook = xlsx.utils.book_new();
	xlsx.utils.book_append_sheet(workbook, worksheet, "Reporte");
	if (meta) {
		const filtersText = formatFilters(meta.filters);
		const metaRows = [
			["Reporte", meta.title ?? ""],
			["Empresa", meta.companyName ?? ""],
			["Fecha", meta.date ?? ""],
			["Generado", meta.generatedAt ?? ""],
			["Vista", meta.viewMode ?? ""],
			["Filtros", filtersText],
		].filter((row) => row[1] !== "");
		if (metaRows.length) {
			const metaSheet = xlsx.utils.aoa_to_sheet(metaRows);
			xlsx.utils.book_append_sheet(workbook, metaSheet, "Metadata");
		}
	}
	const output = xlsx.write(workbook, {
		type: "array",
		bookType: "xlsx",
	}) as number[];
	const base64 = Buffer.from(output).toString("base64");
	return { base64 };
}
