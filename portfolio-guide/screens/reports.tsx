import { ReportPage } from "@/components/report/report-page";
import type { ReportConfig } from "@/components/report/types";
import { z } from "zod";
import {
  readCertificates,
  isCertificateCorrected,
  type CertificateRow,
} from "../sample-data";
import { updateJourney } from "../runtime/journey";
const config: ReportConfig<CertificateRow, { concept: string }> = {
  id: "guide-certificates",
  title: "Certificados de avance",
  description: "Torre Madero · estado de certificación",
  currencyLocale: "es-AR",
  currencyCode: "ARS",
  getRowId: (row) => row.id,
  defaultFilters: () => ({ concept: "" }),
  filterFields: [{ id: "concept", label: "Concepto", type: "text" }],
  fetchData: async (filters) => {
    const rows = readCertificates().filter((row) =>
      row.concept.toLowerCase().includes(filters.concept.toLowerCase()),
    );
    updateJourney({ reportOpened: isCertificateCorrected(rows) });
    return rows;
  },
  columns: [
    {
      id: "concept",
      label: "Concepto",
      accessor: (row) => row.concept,
      type: "text",
      groupable: true,
    },
    {
      id: "period",
      label: "Período",
      accessor: (row) => row.period,
      type: "date",
      render: (value) => {
        const date = new Date(String(value));
        return Number.isNaN(date.getTime())
          ? "—"
          : new Intl.DateTimeFormat("es-AR", { timeZone: "UTC" }).format(date);
      },
    },
    {
      id: "amount",
      label: "Importe del mes",
      accessor: (row) => row.amount,
      type: "currency",
      defaultAggregation: "sum",
      align: "right",
    },
    {
      id: "accumulated",
      label: "Acumulado",
      accessor: (row) => row.accumulated,
      type: "currency",
      defaultAggregation: "max",
      align: "right",
    },
    {
      id: "progress",
      label: "Avance %",
      accessor: (row) => row.progress,
      type: "number",
      align: "right",
    },
    {
      id: "source",
      label: "Documento",
      accessor: (row) => row.source,
      type: "text",
    },
  ],
};
const sharedReportSchema = z.object({
  filters: z.object({ concept: z.string() }),
  expiresAt: z.string().datetime().nullable(),
  rows: z.array(
    z.object({
      id: z.string(),
      concept: z.string(),
      period: z.string(),
      amount: z.number(),
      accumulated: z.number(),
      progress: z.number(),
      source: z.string(),
    }),
  ),
  reportState: z.object({
    companyName: z.string(),
    description: z.string(),
    date: z.string(),
    viewMode: z.string(),
    hiddenColumnIds: z.array(z.string()),
    sortColumnId: z.string().nullable(),
    sortDirection: z.enum(["asc", "desc"]),
    groupSortColumnId: z.string().nullable(),
    groupSortDirection: z.enum(["asc", "desc"]),
    aggregations: z.record(
      z.enum([
        "none",
        "sum",
        "count",
        "count-checked",
        "average",
        "min",
        "max",
      ]),
    ),
    summaryDisplay: z.enum(["row", "card"]),
    showMiniCharts: z.boolean(),
    summaryChartType: z.enum(["bar", "line"]),
  }),
});
export default function Reports() {
  let shared: z.infer<typeof sharedReportSchema> | undefined;
  try {
    const encoded = new URLSearchParams(window.location.search).get("shared");
    if (encoded) {
      shared = sharedReportSchema.parse(
        JSON.parse(
          new TextDecoder().decode(
            Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)),
          ),
        ),
      );
      if (shared.expiresAt && Date.parse(shared.expiresAt) < Date.now())
        throw new Error("Expired link");
    }
  } catch {
    return (
      <p role="alert">
        El enlace es inválido o venció.{" "}
        <a href="./#reports">Abrir un nuevo reporte</a>
      </p>
    );
  }
  const reportConfig = shared
    ? {
        ...config,
        fetchData: async (filters: { concept: string }) =>
          shared.rows.filter((row) =>
            row.concept.toLowerCase().includes(filters.concept.toLowerCase()),
          ),
      }
    : config;
  return (
    <ReportPage
      compactControls
      viewportOffset="0px"
      onExport={
        shared
          ? undefined
          : (_format, rows) => {
              if (isCertificateCorrected(rows))
                updateJourney({ exported: true });
            }
      }
      config={reportConfig}
      backUrl="/excel/sample"
      initialFilters={shared?.filters}
      initialReportState={
        shared?.reportState ?? {
          companyName: "Constructora Horizonte · ejemplo",
          description: "Certificados de avance · Torre Madero",
          date: "2026-07-31",
        }
      }
      readOnly={Boolean(shared)}
    />
  );
}
