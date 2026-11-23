"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toNumericValue } from "@/lib/tablas";
import type { MacroTable, MacroTableRow } from "@/lib/macro-tables";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

type InvoiceRow = {
  obra_id: string;
  n_certificado: number;
  monto: number;
  fecha_facturacion: string;
  obras: { n: number | null; designacion_y_ubicacion: string | null } | null;
};

async function readExportResponse<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("No se pudieron cargar los datos de facturación.");
  return response.json();
}

export function FacturacionExport() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [exporting, setExporting] = useState(false);

  async function exportWorkbook() {
    if (!/^(19|20)\d{2}$/.test(year)) return;
    setExporting(true);
    try {
      const [{ rows }, macroResponse, xlsx] = await Promise.all([
        readExportResponse<{ rows: InvoiceRow[] }>("/api/certificados/facturacion?year=" + year),
        fetch("/api/macro-tables", { cache: "no-store" }),
        import("xlsx"),
      ]);
      if (!macroResponse.ok && macroResponse.status !== 403) throw new Error("No se pudieron cargar las Macrotablas.");
      const macros: { macroTables: MacroTable[] } = macroResponse.ok ? await macroResponse.json() : { macroTables: [] };
      const historical = macros.macroTables.find((table) => table.name === "Certificados - Contable");
      const certified = new Set(rows.map((row) => row.obra_id + ":" + row.n_certificado));
      const works = new Map<string, { label: string; months: number[] }>();
      const evidence: Array<Array<string | number>> = [];
      let undated = 0;
      function add(obraId: string, label: string, reference: unknown, date: string, amount: unknown, source: string) {
        const isoDate = date.trim().replace(/^(\d{2})[/-](\d{2})[/-](\d{4})$/, "$3-$2-$1");
        const match = /^(\d{4})-(0[1-9]|1[0-2])(?:-|$)/.exec(isoDate);
        const value = toNumericValue(amount);
        if (!obraId || !match) { undated++; return; }
        if (match[1] !== year || value === null) return;
        const month = Number(match[2]) - 1;
        const work = works.get(obraId) ?? { label, months: MONTHS.map(() => 0) };
        work.months[month] += Math.round(value * 100);
        works.set(obraId, work);
        evidence.push([label, String(reference ?? ""), match[1] + "-" + match[2], value, source]);
      }
      for (const row of rows) {
        const label = [row.obras?.n, row.obras?.designacion_y_ubicacion].filter((value) => value != null && value !== "").join(" · ");
        add(row.obra_id, label, row.n_certificado, row.fecha_facturacion, row.monto, "Fecha de factura");
      }
      if (historical) {
        const billed = historical.columns?.find((column) => column.label === "Facturado" && column.dataType === "boolean");
        const amount = historical.columns?.find((column) => column.sourceFieldKey === "monto_certificado");
        const date = historical.columns?.find((column) => column.sourceFieldKey === "fecha_certificacion");
        const certificate = historical.columns?.find((column) => column.sourceFieldKey === "nro_certificado");
        if (!billed || !amount || !date || !certificate) throw new Error("Faltan columnas en Certificados - Contable.");
        for (let page = 1; ; page++) {
          const payload = await readExportResponse<{ rows: MacroTableRow[]; pagination: { hasNextPage: boolean } }>(
            "/api/macro-tables/" + encodeURIComponent(historical.id) + "/rows?limit=200&page=" + page,
          );
          for (const row of payload.rows) {
            if (row[billed.id] !== true || certified.has(row._obraId + ":" + String(row[certificate.id]))) continue;
            add(row._obraId, row._obraName, row[certificate.id], String(row[date.id] ?? ""), row[amount.id], "Histórico · fecha de certificación");
          }
          if (!payload.pagination.hasNextPage) break;
        }
      }
      const table = Array.from(works.values())
        .sort((left, right) => left.label.localeCompare(right.label, "es", { numeric: true }))
        .map((work) => [work.label, ...work.months.map((cents) => cents / 100), work.months.reduce((sum, cents) => sum + cents, 0) / 100]);
      const book = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet([["Obra", ...MONTHS, "Total"], ...table]), "Por obra y mes");
      xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet([
        ["Obra", "Certificado", "Mes", "Monto", "Origen del mes"],
        ...evidence,
      ]), "Detalle");
      xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet([
        ["Año", Number(year)],
        ["Registros históricos sin fecha válida", undated],
        ["Criterio histórico", "Facturado en Certificados - Contable. Se usa la fecha de certificación."],
      ]), "Criterios");
      xlsx.writeFile(book, "certificados-facturados-" + year + ".xlsx");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo exportar el Excel.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input type="number" aria-label="Año de facturación" value={year} onChange={(event) => setYear(event.target.value)} className="w-24" />
      <Button variant="outline" type="button" disabled={exporting || !/^(19|20)\d{2}$/.test(year)} onClick={() => void exportWorkbook()}>
        {exporting ? "Exportando…" : "Exportar facturación mensual"}
      </Button>
    </div>
  );
}
