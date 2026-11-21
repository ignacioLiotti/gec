import * as XLSX from "xlsx";
export async function generateXlsxFile({
  data,
}: {
  data: Record<string, unknown>[];
  fileName?: string;
  meta?: unknown;
}) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(data), "Reporte");
  return {
    base64: XLSX.write(book, { type: "base64", bookType: "xlsx" }) as string,
  };
}
