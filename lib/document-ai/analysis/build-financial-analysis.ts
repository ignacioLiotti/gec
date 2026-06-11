import type { ChartDefinition, DocumentAiRow, TableDefinition } from "@/lib/document-ai/schemas/types";
import { normalizeCertificadoAvance } from "@/lib/document-ai/normalization/normalize-certificado-avance";
import {
  looksLikeOrdenCompra,
  normalizeOrdenCompra,
  type NormalizedOrdenCompra,
} from "@/lib/document-ai/normalization/normalize-orden-compra";
import { getByAliases, normalizeKey } from "@/lib/document-ai/normalization/shared";

function add(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) ?? 0) + value);
}

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value);
}

function formatMoney(value: number | null | undefined) {
  const formatted = formatNumber(value);
  return formatted ? `$${formatted}` : "-";
}

const MONTHS: Record<string, string> = {
  ene: "01",
  enero: "01",
  feb: "02",
  febrero: "02",
  mar: "03",
  marzo: "03",
  abr: "04",
  abril: "04",
  may: "05",
  mayo: "05",
  jun: "06",
  junio: "06",
  jul: "07",
  julio: "07",
  ago: "08",
  agosto: "08",
  sep: "09",
  septiembre: "09",
  oct: "10",
  octubre: "10",
  nov: "11",
  noviembre: "11",
  dic: "12",
  diciembre: "12",
};

function normalizePeriod(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const iso = raw.match(/\b(20\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const monthName = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .match(/\b([a-z]{3,10})\s*\/?\s*(\d{2,4})\b/);
  if (monthName) {
    const month = MONTHS[monthName[1].slice(0, 3)] ?? MONTHS[monthName[1]];
    const year = monthName[2].length === 2 ? `20${monthName[2]}` : monthName[2];
    if (month) return `${year}-${month}`;
  }
  return raw;
}

function periodLabel(period: string) {
  const match = period.match(/^(20\d{2})-(\d{2})$/);
  if (!match) return period;
  const labels = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${labels[Number(match[2]) - 1]}-${match[1].slice(2)}`;
}

function sortPeriods(periods: Iterable<string>) {
  return Array.from(periods).sort((left, right) => left.localeCompare(right));
}

function orderKey(order: NormalizedOrdenCompra) {
  return order.numeroOrden ?? order.documentoOrigen ?? order.source.rowId ?? order.source.lineageRowKey ?? "sin-identificador";
}

function hasOrderIdentity(row: DocumentAiRow) {
  const tableName = normalizeKey(row.tableName ?? "");
  if (/orden|compra|\boc\b|fecha.*oc|oc.*fecha/.test(tableName)) return true;
  const value = getByAliases(row.data, ["nro_orden", "nroOrden", "numero_orden", "nro oc", "orden"]);
  return value != null && String(value).trim() !== "";
}

function maxTotalOrden(entries: NormalizedOrdenCompra[]) {
  const totals = entries
    .map((entry) => entry.totalOrden)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return totals.length ? Math.max(...totals) : null;
}

function sumLineTotals(entries: NormalizedOrdenCompra[]) {
  return entries.reduce((total, entry) => total + (entry.precioTotal ?? 0), 0);
}

function pickOrderForMetadata(entries: NormalizedOrdenCompra[]) {
  return (
    entries.find((entry) => entry.totalOrden != null && (entry.proveedor || entry.documentoOrigen)) ??
    entries.find((entry) => entry.proveedor || entry.documentoOrigen) ??
    entries[0] ??
    null
  );
}

function pickOrderDate(entries: NormalizedOrdenCompra[]) {
  return entries.find((entry) => entry.fechaOrden || entry.periodo) ?? null;
}

export type FinancialAnalysis = {
  monthlyTable: TableDefinition | null;
  categoryTable: TableDefinition | null;
  categoryTotalsTable: TableDefinition | null;
  ordersWithDateTable: TableDefinition | null;
  ordersWithoutDateTable: TableDefinition | null;
  certificateDetailTable: TableDefinition | null;
  dataQualityTable: TableDefinition | null;
  monthlyChart: ChartDefinition | null;
  totals: {
    totalCertified: number;
    totalOrdersWithDate: number;
    totalOrdersWithoutDate: number;
    totalOrders: number;
    uniqueOrderCount: number;
    uniqueOrdersWithDate: number;
    uniqueOrdersWithoutDate: number;
  };
  warnings: string[];
};

export function buildFinancialAnalysis(rows: DocumentAiRow[]): FinancialAnalysis {
  const warnings: string[] = [];
  const certificados = rows
    .filter((row) => row.documentType === "certificado_avance" || /certificad/i.test(row.tableName ?? ""))
    .map(normalizeCertificadoAvance)
    .filter((row) => row.periodo || row.fechaCertificacion);
  const ordenes = rows
    .filter((row) => looksLikeOrdenCompra(row) || hasOrderIdentity(row))
    .map(normalizeOrdenCompra)
    .filter((orden) => orden.numeroOrden || orden.documentoOrigen);

  if (certificados.length === 0 && ordenes.length === 0) {
    return {
      monthlyTable: null,
      categoryTable: null,
      categoryTotalsTable: null,
      ordersWithDateTable: null,
      ordersWithoutDateTable: null,
      certificateDetailTable: null,
      dataQualityTable: null,
      monthlyChart: null,
      totals: {
        totalCertified: 0,
        totalOrdersWithDate: 0,
        totalOrdersWithoutDate: 0,
        totalOrders: 0,
        uniqueOrderCount: 0,
        uniqueOrdersWithDate: 0,
        uniqueOrdersWithoutDate: 0,
      },
      warnings,
    };
  }

  const ingresos = new Map<string, number>();
  const acumulados = new Map<string, number>();
  const avances = new Map<string, number>();
  const certificateNumbers = new Map<string, string>();
  const gastos = new Map<string, number>();
  const categorias = new Map<string, Map<string, number>>();
  const categoryTotals = new Map<string, number>();
  const ordersByKey = new Map<string, NormalizedOrdenCompra[]>();
  const ordersWithDate: Array<NormalizedOrdenCompra & { lineCount?: number; periodLabel?: string }> = [];
  const ordersWithoutDate: NormalizedOrdenCompra[] = [];
  let orderRowsWithoutAmount = 0;

  for (const certificado of certificados) {
    const periodo = normalizePeriod(certificado.periodo) ?? normalizePeriod(certificado.fechaCertificacion?.slice(0, 7));
    if (!periodo || certificado.montoCertificado == null) continue;
    add(ingresos, periodo, certificado.montoCertificado);
    if (certificado.montoAcumulado != null) acumulados.set(periodo, certificado.montoAcumulado);
    if (certificado.avanceFisicoAcumulado != null) avances.set(periodo, certificado.avanceFisicoAcumulado);
    if (certificado.numeroCertificado != null) certificateNumbers.set(periodo, String(certificado.numeroCertificado));
  }

  for (const orden of ordenes) {
    const key = orderKey(orden);
    ordersByKey.set(key, [...(ordersByKey.get(key) ?? []), orden]);
  }

  for (const entries of ordersByKey.values()) {
    const representative = pickOrderForMetadata(entries);
    const datedEntry = pickOrderDate(entries);
    if (!representative) continue;
    const officialTotal = maxTotalOrden(entries) ?? sumLineTotals(entries);
    if (!officialTotal) {
      orderRowsWithoutAmount += entries.length;
      continue;
    }
    const periodo = normalizePeriod(datedEntry?.periodo) ?? normalizePeriod(datedEntry?.fechaOrden?.slice(0, 7));
    if (!periodo) {
      ordersWithoutDate.push({ ...representative, totalOrden: officialTotal });
      continue;
    }
    ordersWithDate.push({
      ...representative,
      fechaOrden: datedEntry?.fechaOrden ?? representative.fechaOrden,
      periodo: datedEntry?.periodo ?? representative.periodo,
      totalOrden: officialTotal,
      lineCount: entries.length,
      periodLabel: periodLabel(periodo),
    });
    add(gastos, periodo, officialTotal);

    const lineTotal = entries.reduce((total, entry) => total + (entry.precioTotal ?? 0), 0);
    for (const entry of entries) {
      const categoryKey = entry.categoria ?? "Sin categoria";
      const rawAmount = entry.precioTotal ?? 0;
      const amount = lineTotal > 0 ? (rawAmount / lineTotal) * officialTotal : officialTotal / entries.length;
      const byCategory = categorias.get(periodo) ?? new Map<string, number>();
      add(byCategory, categoryKey, amount);
      add(categoryTotals, categoryKey, amount);
      categorias.set(periodo, byCategory);
    }
  }

  if (ordenes.length > 0 && gastos.size === 0 && ordersWithoutDate.length === 0) {
    warnings.push("Se encontraron ordenes de compra, pero no tienen campos de importe total o precio unitario suficientes para calcular gastos.");
  } else if (orderRowsWithoutAmount > 0) {
    warnings.push(`${orderRowsWithoutAmount} fila(s) de ordenes de compra no tienen importe calculable y quedaron fuera del total de gastos.`);
  }
  if (ordersWithoutDate.length > 0) {
    warnings.push(`${ordersWithoutDate.length} orden(es) de compra tienen total pero no fecha; quedan fuera del grafico mensual.`);
  }

  const periods = sortPeriods(new Set([...ingresos.keys(), ...gastos.keys()]));
  const chartData = periods.map((periodo) => ({
    periodo: periodLabel(periodo),
    ingreso_certificado: ingresos.get(periodo) ?? 0,
    gasto_total: gastos.get(periodo) ?? 0,
    resultado: (ingresos.get(periodo) ?? 0) - (gastos.get(periodo) ?? 0),
  }));
  const totalCertified = Array.from(ingresos.values()).reduce((total, value) => total + value, 0);
  const totalOrdersWithDate = Array.from(gastos.values()).reduce((total, value) => total + value, 0);
  const totalOrdersWithoutDate = ordersWithoutDate.reduce((total, order) => total + (order.totalOrden ?? 0), 0);

  const monthlyTable: TableDefinition = {
    title: "Tabla mensual conciliada",
    columns: [
      { key: "periodo", label: "Mes" },
      { key: "ingreso_certificado", label: "Certificado" },
      { key: "gasto_total", label: "Gastos OC fechados" },
      { key: "resultado", label: "Resultado mensual" },
      { key: "monto_acumulado", label: "Monto acumulado" },
      { key: "avance", label: "Avance acum." },
      { key: "certificado", label: "Cert. N" },
    ],
    rows: periods.map((periodo) => ({
      periodo: periodLabel(periodo),
      ingreso_certificado: formatMoney(ingresos.get(periodo) ?? 0),
      gasto_total: formatMoney(gastos.get(periodo) ?? 0),
      resultado: formatMoney((ingresos.get(periodo) ?? 0) - (gastos.get(periodo) ?? 0)),
      monto_acumulado: acumulados.has(periodo) ? formatMoney(acumulados.get(periodo)) : "-",
      avance: avances.has(periodo) ? `${formatNumber(avances.get(periodo))}%` : "-",
      certificado: certificateNumbers.get(periodo) ?? "-",
    })),
  };

  const categoryRows = Array.from(categorias.entries()).flatMap(([periodo, byCategory]) =>
    Array.from(byCategory.entries()).map(([categoria, monto]) => {
      const monthTotal = gastos.get(periodo) ?? 0;
      return {
        periodo: periodLabel(periodo),
        categoria,
        gasto_total: formatMoney(monto),
        participacion: monthTotal > 0 ? `${formatNumber((monto / monthTotal) * 100)}%` : "-",
      };
    }),
  );

  return {
    monthlyTable,
    categoryTable: categoryRows.length
      ? {
          title: "Gastos por categoria y mes",
          columns: [
            { key: "periodo", label: "Mes" },
            { key: "categoria", label: "Categoria" },
            { key: "gasto_total", label: "Gasto" },
            { key: "participacion", label: "Participacion" },
          ],
          rows: categoryRows,
        }
      : null,
    categoryTotalsTable: categoryTotals.size
      ? {
          title: "Totales por categoria - OC fechadas",
          columns: [
            { key: "categoria", label: "Categoria" },
            { key: "monto", label: "Monto OC fechadas" },
            { key: "participacion", label: "Participacion" },
          ],
          rows: Array.from(categoryTotals.entries())
            .sort((left, right) => right[1] - left[1])
            .map(([categoria, monto]) => ({
              categoria,
              monto: formatMoney(monto),
              participacion: totalOrdersWithDate > 0 ? `${formatNumber((monto / totalOrdersWithDate) * 100)}%` : "-",
            })),
        }
      : null,
    ordersWithDateTable: ordersWithDate.length
      ? {
          title: "Ordenes consolidadas con fecha",
          columns: [
            { key: "nro", label: "Nro" },
            { key: "fecha", label: "Fecha" },
            { key: "periodo", label: "Mes" },
            { key: "proveedor", label: "Proveedor" },
            { key: "documento", label: "Documento" },
            { key: "total", label: "Total Orden" },
            { key: "lineas", label: "Lineas" },
          ],
          rows: ordersWithDate
            .slice()
            .sort((left, right) => String(left.fechaOrden ?? left.periodo ?? "").localeCompare(String(right.fechaOrden ?? right.periodo ?? "")))
            .map((order) => ({
              nro: order.numeroOrden ?? "-",
              fecha: order.fechaOrden ?? order.periodo ?? "-",
              periodo: order.periodLabel ?? "-",
              proveedor: order.proveedor ?? "-",
              documento: order.documentoOrigen ?? "-",
              total: formatMoney(order.totalOrden),
              lineas: order.lineCount ?? "-",
            })),
        }
      : null,
    ordersWithoutDateTable: ordersWithoutDate.length
      ? {
          title: "Ordenes sin fecha",
          columns: [
            { key: "nro", label: "Nro" },
            { key: "proveedor", label: "Proveedor" },
            { key: "documento", label: "Documento" },
            { key: "total", label: "Total Orden" },
          ],
          rows: ordersWithoutDate.map((order) => ({
            nro: order.numeroOrden ?? "-",
            proveedor: order.proveedor ?? "-",
            documento: order.documentoOrigen ?? "-",
            total: formatMoney(order.totalOrden),
          })),
        }
      : null,
    certificateDetailTable: certificados.length
      ? {
          title: "Detalle de certificados",
          columns: [
            { key: "periodo", label: "Periodo" },
            { key: "numero", label: "N" },
            { key: "fecha", label: "Fecha" },
            { key: "monto", label: "Monto certificado" },
            { key: "acumulado", label: "Monto acumulado" },
            { key: "avance", label: "Avance fisico acum." },
          ],
          rows: certificados
            .slice()
            .sort((left, right) =>
              String(normalizePeriod(left.periodo) ?? left.fechaCertificacion ?? "").localeCompare(
                String(normalizePeriod(right.periodo) ?? right.fechaCertificacion ?? ""),
              ),
            )
            .map((certificado) => ({
              periodo: certificado.periodo ?? "-",
              numero: certificado.numeroCertificado ?? "-",
              fecha: certificado.fechaCertificacion ?? "-",
              monto: formatMoney(certificado.montoCertificado),
              acumulado: formatMoney(certificado.montoAcumulado),
              avance: certificado.avanceFisicoAcumulado != null ? `${formatNumber(certificado.avanceFisicoAcumulado)}%` : "-",
            })),
        }
      : null,
    dataQualityTable: {
      title: "Control de calidad de datos",
      columns: [
        { key: "control", label: "Control" },
        { key: "resultado", label: "Resultado" },
      ],
      rows: [
        {
          control: "Criterio de deduplicacion",
          resultado: "Se cuenta una unica vez cada Nro de OC, usando Total Orden como importe oficial.",
        },
        {
          control: "OC sin fecha",
          resultado: "No se imputan al grafico mensual; figuran separadas para completar el dato.",
        },
        {
          control: "Categorias",
          resultado: "Se asignan desde la descripcion de lineas OCR y se prorratean para coincidir con Total Orden.",
        },
      ],
    },
    monthlyChart: chartData.length
      ? {
          type: "bar",
          title: "Ingresos certificados vs gastos mensuales",
          xKey: "periodo",
          yKeys: ["ingreso_certificado", "gasto_total"],
          data: chartData,
        }
      : null,
    totals: {
      totalCertified,
      totalOrdersWithDate,
      totalOrdersWithoutDate,
      totalOrders: totalOrdersWithDate + totalOrdersWithoutDate,
      uniqueOrderCount: ordersByKey.size,
      uniqueOrdersWithDate: ordersByKey.size - ordersWithoutDate.length,
      uniqueOrdersWithoutDate: ordersWithoutDate.length,
    },
    warnings,
  };
}
