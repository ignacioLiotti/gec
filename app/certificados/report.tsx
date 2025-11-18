import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo } from "react";

type CertRow = {
  id: string;
  obraId: string;
  obraName: string;
  ente: string;
  n_exp: string;
  n_certificado: number;
  monto: number;
  mes: string;
  estado: string;
  facturado: boolean;
  fecha_facturacion: string | null;
  nro_factura: string | null;
  concepto: string | null;
  cobrado: boolean;
  observaciones: string | null;
  vencimiento: string | null;
  fecha_pago: string | null;
};

// Report Table Component
function ReportTable({
  title,
  data,
  hiddenCols,
  sortBy,
  sortDir,
  onSort,
  aggregations,
  allColumns,
  isPrint,
}: {
  title: string;
  data: CertRow[];
  hiddenCols: number[];
  sortBy: number;
  sortDir: "asc" | "desc";
  onSort: (colIndex: number) => void;
  aggregations: Record<number, "none" | "sum" | "count" | "count-checked" | "average">;
  allColumns: { index: number; label: string }[];
  isPrint: boolean;
}) {
  const sortedData = useMemo(() => {
    const sorted = [...data];
    sorted.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortBy) {
        case 0: aVal = a.obraName; bVal = b.obraName; break;
        case 1: aVal = a.ente; bVal = b.ente; break;
        case 2: aVal = a.facturado; bVal = b.facturado; break;
        case 3: aVal = a.fecha_facturacion ?? ""; bVal = b.fecha_facturacion ?? ""; break;
        case 4: aVal = a.nro_factura ?? ""; bVal = b.nro_factura ?? ""; break;
        case 5: aVal = a.monto; bVal = b.monto; break;
        case 6: aVal = a.concepto ?? ""; bVal = b.concepto ?? ""; break;
        case 7: aVal = a.cobrado; bVal = b.cobrado; break;
        case 8: aVal = a.n_exp; bVal = b.n_exp; break;
        case 9: aVal = a.observaciones ?? ""; bVal = b.observaciones ?? ""; break;
        case 10: aVal = a.vencimiento ?? ""; bVal = b.vencimiento ?? ""; break;
        case 11: aVal = a.fecha_pago ?? ""; bVal = b.fecha_pago ?? ""; break;
        default: return 0;
      }
      if (typeof aVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === "asc" ? (aVal < bVal ? -1 : 1) : (bVal < aVal ? -1 : 1);
    });
    return sorted;
  }, [data, sortBy, sortDir]);

  const calculateAggregation = (colIndex: number, data: CertRow[], aggType: string) => {
    if (aggType === "none") return null;

    let values: any[] = [];
    data.forEach((row) => {
      switch (colIndex) {
        case 0: values.push(row.obraName); break;
        case 1: values.push(row.ente); break;
        case 2: values.push(row.facturado); break;
        case 3: values.push(row.fecha_facturacion); break;
        case 4: values.push(row.nro_factura); break;
        case 5: values.push(row.monto); break;
        case 6: values.push(row.concepto); break;
        case 7: values.push(row.cobrado); break;
        case 8: values.push(row.n_exp); break;
        case 9: values.push(row.observaciones); break;
        case 10: values.push(row.vencimiento); break;
        case 11: values.push(row.fecha_pago); break;
      }
    });

    switch (aggType) {
      case "sum":
        const numValues = values.map(v => Number(v) || 0);
        return `$ ${numValues.reduce((a, b) => a + b, 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case "count":
        return values.filter(v => v != null && v !== "").length;
      case "count-checked":
        return values.filter(v => v === true).length;
      case "average":
        const nums = values.map(v => Number(v) || 0).filter(n => n !== 0);
        if (nums.length === 0) return 0;
        return `$ ${(nums.reduce((a, b) => a + b, 0) / nums.length).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="border rounded-lg overflow-hidden">
        <table className={`w-full ${isPrint ? 'text-[10px]' : 'text-sm'}`}>
          <thead className="bg-muted">
            <tr>
              {!hiddenCols.includes(0) && (
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase cursor-pointer hover:bg-muted/80" onClick={() => onSort(0)}>
                  <div className="flex items-center gap-1">
                    OBRA
                    {sortBy === 0 && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                </th>
              )}
              {!hiddenCols.includes(1) && (
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase cursor-pointer hover:bg-muted/80" onClick={() => onSort(1)}>
                  <div className="flex items-center gap-1">
                    ENTE
                    {sortBy === 1 && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                </th>
              )}
              {!hiddenCols.includes(2) && (
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase cursor-pointer hover:bg-muted/80" onClick={() => onSort(2)}>
                  <div className="flex items-center justify-center gap-1">
                    FACTURADO
                    {sortBy === 2 && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                </th>
              )}
              {!hiddenCols.includes(3) && (
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase cursor-pointer hover:bg-muted/80" onClick={() => onSort(3)}>
                  <div className="flex items-center justify-center gap-1">
                    F. FACTURACIÓN
                    {sortBy === 3 && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                </th>
              )}
              {!hiddenCols.includes(4) && (
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase cursor-pointer hover:bg-muted/80" onClick={() => onSort(4)}>
                  <div className="flex items-center justify-center gap-1">
                    N° FACTURA
                    {sortBy === 4 && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                </th>
              )}
              {!hiddenCols.includes(5) && (
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase cursor-pointer hover:bg-muted/80" onClick={() => onSort(5)}>
                  <div className="flex items-center justify-end gap-1">
                    MONTO
                    {sortBy === 5 && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                </th>
              )}
              {!hiddenCols.includes(6) && (
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase cursor-pointer hover:bg-muted/80" onClick={() => onSort(6)}>
                  <div className="flex items-center gap-1">
                    CONCEPTO
                    {sortBy === 6 && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                </th>
              )}
              {!hiddenCols.includes(7) && (
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase cursor-pointer hover:bg-muted/80" onClick={() => onSort(7)}>
                  <div className="flex items-center justify-center gap-1">
                    COBRADO
                    {sortBy === 7 && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                </th>
              )}
              {!hiddenCols.includes(8) && (
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase cursor-pointer hover:bg-muted/80" onClick={() => onSort(8)}>
                  <div className="flex items-center gap-1">
                    N° EXP
                    {sortBy === 8 && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                </th>
              )}
              {!hiddenCols.includes(9) && (
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase cursor-pointer hover:bg-muted/80" onClick={() => onSort(9)}>
                  <div className="flex items-center gap-1">
                    OBSERVACIONES
                    {sortBy === 9 && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                </th>
              )}
              {!hiddenCols.includes(10) && (
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase cursor-pointer hover:bg-muted/80" onClick={() => onSort(10)}>
                  <div className="flex items-center justify-center gap-1">
                    VENCIMIENTO
                    {sortBy === 10 && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                </th>
              )}
              {!hiddenCols.includes(11) && (
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase cursor-pointer hover:bg-muted/80" onClick={() => onSort(11)}>
                  <div className="flex items-center justify-center gap-1">
                    F. PAGO
                    {sortBy === 11 && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, idx) => (
              <tr key={row.id} className={cn("border-t", idx % 2 === 0 ? "bg-background" : "bg-muted/20")}>
                {!hiddenCols.includes(0) && <td className="px-3 py-2">{row.obraName}</td>}
                {!hiddenCols.includes(1) && <td className="px-3 py-2">{row.ente}</td>}
                {!hiddenCols.includes(2) && <td className="px-3 py-2 text-center">{row.facturado ? "Sí" : "No"}</td>}
                {!hiddenCols.includes(3) && <td className="px-3 py-2 text-center">{row.fecha_facturacion || "-"}</td>}
                {!hiddenCols.includes(4) && <td className="px-3 py-2 text-center">{row.nro_factura || "-"}</td>}
                {!hiddenCols.includes(5) && <td className="px-3 py-2 text-right font-mono">$ {Number(row.monto).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>}
                {!hiddenCols.includes(6) && <td className="px-3 py-2">{row.concepto || "-"}</td>}
                {!hiddenCols.includes(7) && <td className="px-3 py-2 text-center">{row.cobrado ? "Sí" : "No"}</td>}
                {!hiddenCols.includes(8) && <td className="px-3 py-2">{row.n_exp}</td>}
                {!hiddenCols.includes(9) && <td className="px-3 py-2">{row.observaciones || "-"}</td>}
                {!hiddenCols.includes(10) && <td className="px-3 py-2 text-center">{row.vencimiento || "-"}</td>}
                {!hiddenCols.includes(11) && <td className="px-3 py-2 text-center">{row.fecha_pago || "-"}</td>}
              </tr>
            ))}
            {/* Aggregation row */}
            {Object.values(aggregations).some(agg => agg !== "none") && (
              <tr className="border-t-2 bg-muted/50 font-semibold">
                {!hiddenCols.includes(0) && <td className="px-3 py-2">{aggregations[0] !== "none" ? calculateAggregation(0, sortedData, aggregations[0]) : ""}</td>}
                {!hiddenCols.includes(1) && <td className="px-3 py-2">{aggregations[1] !== "none" ? calculateAggregation(1, sortedData, aggregations[1]) : ""}</td>}
                {!hiddenCols.includes(2) && <td className="px-3 py-2 text-center">{aggregations[2] !== "none" ? calculateAggregation(2, sortedData, aggregations[2]) : ""}</td>}
                {!hiddenCols.includes(3) && <td className="px-3 py-2 text-center">{aggregations[3] !== "none" ? calculateAggregation(3, sortedData, aggregations[3]) : ""}</td>}
                {!hiddenCols.includes(4) && <td className="px-3 py-2 text-center">{aggregations[4] !== "none" ? calculateAggregation(4, sortedData, aggregations[4]) : ""}</td>}
                {!hiddenCols.includes(5) && <td className="px-3 py-2 text-right">{aggregations[5] !== "none" ? calculateAggregation(5, sortedData, aggregations[5]) : ""}</td>}
                {!hiddenCols.includes(6) && <td className="px-3 py-2">{aggregations[6] !== "none" ? calculateAggregation(6, sortedData, aggregations[6]) : ""}</td>}
                {!hiddenCols.includes(7) && <td className="px-3 py-2 text-center">{aggregations[7] !== "none" ? calculateAggregation(7, sortedData, aggregations[7]) : ""}</td>}
                {!hiddenCols.includes(8) && <td className="px-3 py-2">{aggregations[8] !== "none" ? calculateAggregation(8, sortedData, aggregations[8]) : ""}</td>}
                {!hiddenCols.includes(9) && <td className="px-3 py-2">{aggregations[9] !== "none" ? calculateAggregation(9, sortedData, aggregations[9]) : ""}</td>}
                {!hiddenCols.includes(10) && <td className="px-3 py-2 text-center">{aggregations[10] !== "none" ? calculateAggregation(10, sortedData, aggregations[10]) : ""}</td>}
                {!hiddenCols.includes(11) && <td className="px-3 py-2 text-center">{aggregations[11] !== "none" ? calculateAggregation(11, sortedData, aggregations[11]) : ""}</td>}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ReportTable;