"use client";

import * as React from "react";
import { useForm } from "@tanstack/react-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ContextMenuItem } from "@/components/ui/context-menu";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { AdvancedDataTable } from "@/components/data-table/advanced-data-table";
import type {
  DataTableColumn,
  DataTableFeatures,
  DataTableHeaderGroup,
  DataTableQueryState,
  DataTableSortState,
} from "@/components/data-table/types";
import type { Obra } from "@/app/excel/schema";
import Papa from "papaparse";
import type { CheckedState } from "@radix-ui/react-checkbox";
import { toast } from "sonner";

type CertificadoRow = {
  id: string;
  obraName: string;
  ente: string;
  monto: number;
  concepto: string | null;
  facturado: boolean;
  cobrado: boolean;
  fechaFacturacion: string | null;
  fechaPago: string | null;
};

type MaterialOrderItem = {
  orderId: string;
  nroOrden: string;
  solicitante: string;
  gestor: string;
  proveedor: string;
  material: string;
  unidad: string;
  cantidad: number;
  precioUnitario: number;
};

type TeamMember = {
  id: string;
  name: string;
  role: string;
  seniority: "Junior" | "Semi Senior" | "Senior";
  location: string;
  availability: number;
  status: "active" | "pto";
};

type FinancialSnapshot = {
  id: string;
  quarter: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  newClients: number;
};

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 2,
});

const tabs = [
  { value: "obras", label: "Obras (API)" },
  { value: "certificados", label: "Certificados (API)" },
  { value: "materiales", label: "Materiales por obra" },
  { value: "team", label: "Equipo (demo)" },
  { value: "financial", label: "Finanzas (demo)" },
] as const;

const teamMembers: TeamMember[] = [
  { id: "1", name: "Lucía Romero", role: "Project Manager", seniority: "Senior", location: "Córdoba", availability: 1, status: "active" },
  { id: "2", name: "Sofía Pérez", role: "Arquitecta", seniority: "Senior", location: "Rosario", availability: 0.65, status: "active" },
  { id: "3", name: "Martín Guerra", role: "Planner", seniority: "Semi Senior", location: "Mendoza", availability: 0.5, status: "pto" },
  { id: "4", name: "Agustina Vila", role: "Coordinadora de Compras", seniority: "Senior", location: "Buenos Aires", availability: 1, status: "active" },
  { id: "5", name: "Matías Cornejo", role: "Document Control", seniority: "Junior", location: "La Plata", availability: 0.8, status: "active" },
];

const financialSnapshots: FinancialSnapshot[] = [
  { id: "FY23-Q3", quarter: "2023 Q3", revenue: 185_000_000, expenses: 141_500_000, profit: 43_500_000, margin: 0.235, newClients: 3 },
  { id: "FY23-Q4", quarter: "2023 Q4", revenue: 214_000_000, expenses: 160_800_000, profit: 53_200_000, margin: 0.249, newClients: 4 },
  { id: "FY24-Q1", quarter: "2024 Q1", revenue: 228_000_000, expenses: 171_200_000, profit: 56_800_000, margin: 0.249, newClients: 5 },
  { id: "FY24-Q2", quarter: "2024 Q2", revenue: 241_500_000, expenses: 180_400_000, profit: 61_100_000, margin: 0.253, newClients: 6 },
];

const EXCEL_FILTERS_INITIAL = {
  entidades: [] as string[],
  supMin: "",
  supMax: "",
  mesYear: "",
  mesContains: "",
  iniYear: "",
  iniContains: "",
  cmaMin: "",
  cmaMax: "",
  cafMin: "",
  cafMax: "",
  sacMin: "",
  sacMax: "",
  scMin: "",
  scMax: "",
  paMin: "",
  paMax: "",
  ptMin: "",
  ptMax: "",
  ptrMin: "",
  ptrMax: "",
};

const EXCEL_DEFAULT_SORT: DataTableSortState = { columnId: "n", direction: "asc" };
const EXCEL_INITIAL_PAGE = 1;
const EXCEL_INITIAL_PAGE_SIZE = 10;

const parseCsvNumber = (raw: string | null | undefined): number => {
  if (!raw) return 0;
  const cleaned = raw.replace(/\s+/g, "").replace(/[^\d,.\-]/g, "").replace(/\./g, "").replace(",", ".");
  const result = Number(cleaned);
  return Number.isFinite(result) ? result : 0;
};

const normalizeCsvString = (raw: string | null | undefined): string => (raw ? raw.trim() : "");

async function parseObrasCsvFile(file: File): Promise<Obra[]> {
  const text = await file.text();
  const parsed = Papa.parse<string[]>(text, {
    delimiter: ";",
    skipEmptyLines: true,
  });

  const normalizedRows = parsed.data
    .map((row) => (row ?? []).map((cell) => normalizeCsvString(cell)))
    .filter((row) => row.some((cell) => cell.length > 0));

  const dataRows = normalizedRows.filter((row) => {
    const firstCell = row[0] ?? "";
    const description = row[1] ?? "";
    return /^\d+/.test(firstCell) && description.trim().length > 0;
  });

  return dataRows.map((row, index) => {
    const padded = [...row];
    while (padded.length < 15) {
      padded.push("");
    }

    const rawNumber = (padded[0] ?? "").replace(/[^\d-]/g, "");
    const parsedN = Number.parseInt(rawNumber, 10);
    const originalN = Number.isFinite(parsedN) && parsedN > 0 ? parsedN : null;
    const n = index + 1;
    const porcentaje = parseCsvNumber(padded[14]);

    return {
      id: undefined,
      n,
      designacionYUbicacion:
        originalN && originalN !== n ? `[${originalN}] ${normalizeCsvString(padded[1])}` : normalizeCsvString(padded[1]),
      supDeObraM2: parseCsvNumber(padded[2]),
      entidadContratante: normalizeCsvString(padded[3]),
      mesBasicoDeContrato: normalizeCsvString(padded[4]),
      iniciacion: normalizeCsvString(padded[6]),
      contratoMasAmpliaciones: parseCsvNumber(padded[7]),
      certificadoALaFecha: parseCsvNumber(padded[8]),
      saldoACertificar: parseCsvNumber(padded[9]),
      segunContrato: parseCsvNumber(padded[10]),
      prorrogasAcordadas: parseCsvNumber(padded[11]),
      plazoTotal: parseCsvNumber(padded[12]),
      plazoTransc: parseCsvNumber(padded[13]),
      porcentaje: Math.max(0, Math.min(100, porcentaje)),
      onFinishFirstMessage: null,
      onFinishSecondMessage: null,
      onFinishSecondSendAt: null,
    } satisfies Obra;
  });
}

const compareCellValues = (a: unknown, b: unknown) => {
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true });
};

const getObraIdentifier = (obra: Obra, fallbackIndex?: number) =>
  obra.id ?? `obra-${obra.n ?? fallbackIndex ?? 0}`;

const sortStatesEqual = (a: DataTableSortState | null, b: DataTableSortState | null) => {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.columnId === b.columnId && a.direction === b.direction;
};

const queryStatesEqual = (a: DataTableQueryState, b: DataTableQueryState) =>
  a.searchValue === b.searchValue &&
  a.activeTab === b.activeTab &&
  sortStatesEqual(a.sortState, b.sortState) &&
  a.page === b.page &&
  a.pageSize === b.pageSize;

const createEmptyObra = (n: number): Obra => ({
  id: undefined,
  n,
  designacionYUbicacion: "",
  supDeObraM2: 0,
  entidadContratante: "",
  mesBasicoDeContrato: "",
  iniciacion: "",
  contratoMasAmpliaciones: 0,
  certificadoALaFecha: 0,
  saldoACertificar: 0,
  segunContrato: 0,
  prorrogasAcordadas: 0,
  plazoTotal: 0,
  plazoTransc: 0,
  porcentaje: 0,
  onFinishFirstMessage: null,
  onFinishSecondMessage: null,
  onFinishSecondSendAt: null,
});

const isCompletedObra = (obra: Obra) => {
  console.log("obra", obra);
  console.log("isCompletedObra", Number(obra.porcentaje ?? 0) >= 100);
  return Number(obra.porcentaje ?? 0) >= 100;
};

const numberInRange = (value: number, min: string, max: string) => {
  if (min && value < Number(min)) return false;
  if (max && value > Number(max)) return false;
  return true;
};

const textMatches = (text: string | null | undefined, needle: string) => {
  if (!needle.trim()) return true;
  return text?.toLowerCase().includes(needle.trim().toLowerCase()) ?? false;
};

const rowsRefEqual = <T,>(a: T[], b: T[]) => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

export default function TablePlaygroundPage() {
  const excelForm = useForm({
    defaultValues: {
      detalleObras: [] as Obra[],
    },
  });
  const [excelLoading, setExcelLoading] = React.useState(true);
  const [excelError, setExcelError] = React.useState<string | null>(null);
  const [excelPersistedRows, setExcelPersistedRows] = React.useState<Obra[]>([]);
  const [excelDraftRows, setExcelDraftRows] = React.useState<Obra[]>([]);
  const [excelFilters, setExcelFilters] = React.useState(() => ({ ...EXCEL_FILTERS_INITIAL }));
  const [excelPageRows, setExcelPageRows] = React.useState<Obra[]>([]);
  const [excelTotalRows, setExcelTotalRows] = React.useState(0);
  const [excelQueryState, setExcelQueryState] = React.useState<DataTableQueryState>({
    searchValue: "",
    activeTab: undefined,
    sortState: EXCEL_DEFAULT_SORT,
    page: EXCEL_INITIAL_PAGE,
    pageSize: EXCEL_INITIAL_PAGE_SIZE,
  });
  const [isExcelSaving, setIsExcelSaving] = React.useState(false);
  const syncExcelPageToFirst = React.useCallback(() => {
    setExcelQueryState((prev) => ({ ...prev, page: EXCEL_INITIAL_PAGE }));
  }, []);
  const resetExcelFilters = React.useCallback(() => {
    setExcelFilters({ ...EXCEL_FILTERS_INITIAL });
    syncExcelPageToFirst();
  }, [syncExcelPageToFirst]);
  const handleExcelQueryChange = React.useCallback((next: DataTableQueryState) => {
    setExcelQueryState((prev) => (queryStatesEqual(prev, next) ? prev : next));
  }, []);
  const handleExcelRowsChange = React.useCallback((updatedRows: Obra[]) => {
    if (updatedRows.length === 0) return;
    setExcelDraftRows((prev) => {
      const lookup = new Map(updatedRows.map((row) => [getObraIdentifier(row), row]));
      let changed = false;
      const next = prev.map((row, idx) => {
        const key = getObraIdentifier(row, idx);
        const replacement = lookup.get(key);
        if (replacement && replacement !== row) {
          changed = true;
          return replacement;
        }
        return row;
      });
      return changed ? next : prev;
    });
  }, []);
  const getExcelRowId = React.useCallback(
    (row: Obra, index: number) => getObraIdentifier(row, index),
    [],
  );
  const excelHasUnsavedChanges = React.useMemo(
    () => !rowsRefEqual(excelDraftRows, excelPersistedRows),
    [excelDraftRows, excelPersistedRows],
  );
  const nextExcelRowNumber = React.useCallback(
    () => excelDraftRows.reduce((max, obra) => Math.max(max, Number(obra.n ?? 0)), 0) + 1,
    [excelDraftRows],
  );
  const handleExcelDiscard = React.useCallback(() => {
    setExcelDraftRows(excelPersistedRows);
    syncExcelPageToFirst();
  }, [excelPersistedRows, syncExcelPageToFirst]);
  const handleExcelSave = React.useCallback(async () => {
    if (!excelHasUnsavedChanges) return;
    setIsExcelSaving(true);
    try {
      excelForm.setFieldValue("detalleObras", () => excelDraftRows);
      setExcelPersistedRows(excelDraftRows);
      toast.success("Cambios guardados (demo)");
    } catch (error) {
      console.error(error);
      toast.error("No se pudo guardar los cambios");
    } finally {
      setIsExcelSaving(false);
    }
  }, [excelHasUnsavedChanges, excelDraftRows, excelForm]);

  const [certData, setCertData] = React.useState<CertificadoRow[]>([]);
  const [certLoading, setCertLoading] = React.useState(true);
  const [certError, setCertError] = React.useState<string | null>(null);

  const [selectedObraId, setSelectedObraId] = React.useState<string>("");
  const [materialsData, setMaterialsData] = React.useState<MaterialOrderItem[]>([]);
  const [materialsLoading, setMaterialsLoading] = React.useState(false);
  const [materialsError, setMaterialsError] = React.useState<string | null>(null);

  const excelEntities = React.useMemo(() => {
    const set = new Set<string>();
    for (const obra of excelDraftRows) {
      const ent = obra.entidadContratante?.trim();
      if (ent) set.add(ent);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [excelDraftRows]);

  React.useEffect(() => {
    const passesFilters = (obra: Obra) => {
      if (
        excelFilters.entidades.length > 0 &&
        (!obra.entidadContratante || !excelFilters.entidades.includes(obra.entidadContratante))
      ) {
        return false;
      }

      if (
        !numberInRange(Number(obra.supDeObraM2 ?? 0), excelFilters.supMin, excelFilters.supMax)
      ) {
        return false;
      }

      const mesBasico = obra.mesBasicoDeContrato ?? "";
      if (!textMatches(mesBasico, excelFilters.mesYear)) return false;
      if (!textMatches(mesBasico, excelFilters.mesContains)) return false;

      const iniciacion = obra.iniciacion ?? "";
      if (!textMatches(iniciacion, excelFilters.iniYear)) return false;
      if (!textMatches(iniciacion, excelFilters.iniContains)) return false;

      if (
        !numberInRange(
          Number(obra.contratoMasAmpliaciones ?? 0),
          excelFilters.cmaMin,
          excelFilters.cmaMax,
        ) ||
        !numberInRange(
          Number(obra.certificadoALaFecha ?? 0),
          excelFilters.cafMin,
          excelFilters.cafMax,
        ) ||
        !numberInRange(
          Number(obra.saldoACertificar ?? 0),
          excelFilters.sacMin,
          excelFilters.sacMax,
        )
      ) {
        return false;
      }

      if (
        !numberInRange(Number(obra.segunContrato ?? 0), excelFilters.scMin, excelFilters.scMax) ||
        !numberInRange(
          Number(obra.prorrogasAcordadas ?? 0),
          excelFilters.paMin,
          excelFilters.paMax,
        ) ||
        !numberInRange(Number(obra.plazoTotal ?? 0), excelFilters.ptMin, excelFilters.ptMax) ||
        !numberInRange(Number(obra.plazoTransc ?? 0), excelFilters.ptrMin, excelFilters.ptrMax)
      ) {
        return false;
      }

      return true;
    };

    const searchTerm = excelQueryState.searchValue.trim().toLowerCase();
    const matchesSearch = (obra: Obra) => {
      if (!searchTerm) return true;
      return Object.values(obra ?? {}).some((value) =>
        String(value ?? "").toLowerCase().includes(searchTerm),
      );
    };

    const filtered = excelDraftRows.filter(passesFilters).filter(matchesSearch);

    const sortState = excelQueryState.sortState;
    const sorted = sortState
      ? [...filtered].sort((a, b) => {
        const valueA = (a as Record<string, unknown>)[sortState.columnId];
        const valueB = (b as Record<string, unknown>)[sortState.columnId];
        const result = compareCellValues(valueA, valueB);
        return sortState.direction === "asc" ? result : -result;
      })
      : filtered;

    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / excelQueryState.pageSize));
    const safePage = Math.min(Math.max(excelQueryState.page, 1), totalPages);
    if (safePage !== excelQueryState.page) {
      setExcelQueryState((prev) =>
        prev.page === safePage ? prev : { ...prev, page: safePage },
      );
      return;
    }

    const start = (safePage - 1) * excelQueryState.pageSize;
    const visible = sorted.slice(start, start + excelQueryState.pageSize);
    setExcelTotalRows((prev) => (prev === total ? prev : total));
    setExcelPageRows((prev) => {
      if (prev.length === visible.length && prev.every((row, idx) => row === visible[idx])) {
        return prev;
      }
      return visible;
    });
  }, [excelDraftRows, excelFilters, excelQueryState]);

  const fetchObras = React.useCallback(async () => {
    setExcelLoading(true);
    setExcelError(null);
    try {
      const params = new URLSearchParams({
        orderBy: "n",
        orderDir: "asc",
      });
      const [inProcessRes, completedRes] = await Promise.all([
        fetch(`/api/obras?status=in-process&${params.toString()}`),
        fetch(`/api/obras?status=completed&${params.toString()}`),
      ]);
      if (!inProcessRes.ok || !completedRes.ok) {
        throw new Error("No se pudieron cargar las obras");
      }
      const [inProcessJson, completedJson] = await Promise.all([
        inProcessRes.json(),
        completedRes.json(),
      ]);
      const inProcessRows: Obra[] = Array.isArray(inProcessJson?.detalleObras)
        ? inProcessJson.detalleObras
        : [];
      const completedRows: Obra[] = Array.isArray(completedJson?.detalleObras)
        ? completedJson.detalleObras
        : [];
      const merged = [...inProcessRows, ...completedRows];
      excelForm.setFieldValue("detalleObras", () => merged);
      setExcelPersistedRows(merged);
      setExcelDraftRows(merged);
      syncExcelPageToFirst();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido obteniendo obras";
      setExcelError(message);
    } finally {
      setExcelLoading(false);
    }
  }, [excelForm, syncExcelPageToFirst]);

  const fetchCertificados = React.useCallback(async () => {
    setCertLoading(true);
    setCertError(null);
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "200",
        orderBy: "obra",
        orderDir: "asc",
      });
      const res = await fetch(`/api/certificados?${params.toString()}`);
      if (!res.ok) throw new Error("No se pudieron cargar los certificados");
      const json = await res.json();
      const rows: CertificadoRow[] = Array.isArray(json?.certificados)
        ? json.certificados.map((row: any) => ({
          id: String(row.id),
          obraName: row.obraName ?? "Sin obra",
          ente: row.ente ?? "—",
          monto: Number(row.monto ?? 0),
          concepto: row.concepto ?? null,
          facturado: Boolean(row.facturado),
          cobrado: Boolean(row.cobrado),
          fechaFacturacion: row.fecha_facturacion ?? null,
          fechaPago: row.fecha_pago ?? null,
        }))
        : [];
      setCertData(rows);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido obteniendo certificados";
      setCertError(message);
    } finally {
      setCertLoading(false);
    }
  }, []);

  const fetchMaterials = React.useCallback(
    async (obraId: string) => {
      if (!obraId) return;
      setMaterialsLoading(true);
      setMaterialsError(null);
      try {
        const res = await fetch(`/api/obras/${obraId}/materials`);
        if (!res.ok) throw new Error("No se pudieron cargar los materiales");
        const json = await res.json();
        const rows: MaterialOrderItem[] = Array.isArray(json?.orders)
          ? json.orders.flatMap((order: any) =>
            Array.isArray(order.items) && order.items.length > 0
              ? order.items.map((item: any, index: number) => ({
                orderId: `${order.id}-${index}`,
                nroOrden: order.nroOrden ?? `#${order.id.slice(0, 4)}`,
                solicitante: order.solicitante ?? "Sin solicitante",
                gestor: order.gestor ?? "Sin gestor",
                proveedor: order.proveedor ?? "Sin proveedor",
                material: item.material ?? "Material sin nombre",
                unidad: item.unidad ?? "un",
                cantidad: Number(item.cantidad ?? 0),
                precioUnitario: Number(item.precioUnitario ?? 0),
              }))
              : [
                {
                  orderId: `${order.id}-empty`,
                  nroOrden: order.nroOrden ?? `#${order.id.slice(0, 4)}`,
                  solicitante: order.solicitante ?? "Sin solicitante",
                  gestor: order.gestor ?? "Sin gestor",
                  proveedor: order.proveedor ?? "Sin proveedor",
                  material: "Sin items registrados",
                  unidad: "—",
                  cantidad: 0,
                  precioUnitario: 0,
                },
              ],
          )
          : [];
        setMaterialsData(rows);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error desconocido obteniendo materiales";
        setMaterialsError(message);
      } finally {
        setMaterialsLoading(false);
      }
    },
    [],
  );

  React.useEffect(() => {
    void fetchObras();
    void fetchCertificados();
  }, [fetchObras, fetchCertificados]);

  React.useEffect(() => {
    if (selectedObraId) {
      void fetchMaterials(selectedObraId);
      return;
    }
    const firstWithId = excelDraftRows.find((obra) => obra.id != null);
    if (firstWithId?.id) {
      setSelectedObraId(String(firstWithId.id));
    }
  }, [excelDraftRows, selectedObraId, fetchMaterials]);

  const excelColumns = React.useMemo<DataTableColumn<Obra>[]>(() => {
    return [
      { id: "n", header: "N°", accessorKey: "n", align: "center", enableHide: false, enablePin: true },
      {
        id: "designacionYUbicacion",
        header: "DESIGNACIÓN Y UBICACIÓN",
        accessorKey: "designacionYUbicacion",
        enableHide: false,
        href: (obra) => (obra.id ? `/excel/${obra.id}` : undefined),
        target: "_blank",
        renderCell: ({ value }) => <span className="font-medium">{(value as string) ?? "—"}</span>,
      },
      {
        id: "supDeObraM2",
        header: "SUP. DE OBRA (M2)",
        accessorKey: "supDeObraM2",
        align: "right",
        renderCell: ({ value }) => <span className="font-mono">{numberFormatter.format(Number(value ?? 0))}</span>,
      },
      {
        id: "entidadContratante",
        header: "ENTIDAD CONTRATANTE",
        accessorKey: "entidadContratante",
        renderCell: ({ value }) => (value as string) ?? "—",
        contextMenuItems: ({ value }) =>
          typeof value === "string" && value.length > 0 ? (
            <ContextMenuItem
              onClick={() => {
                setExcelFilters((prev) => ({
                  ...prev,
                  entidades: Array.from(new Set([value])),
                }));
                syncExcelPageToFirst();
              }}
            >
              Filtrar por “{value}”
            </ContextMenuItem>
          ) : null,
      },
      {
        id: "mesBasicoDeContrato",
        header: "MES BÁSICO DE CONTRATO",
        accessorKey: "mesBasicoDeContrato",
      },
      {
        id: "iniciacion",
        header: "INICIACIÓN",
        accessorKey: "iniciacion",
      },
      {
        id: "contratoMasAmpliaciones",
        header: "CONTRATO + AMPLIACIONES",
        accessorKey: "contratoMasAmpliaciones",
        align: "right",
        renderCell: ({ value }) => currencyFormatter.format(Number(value ?? 0)),
      },
      {
        id: "certificadoALaFecha",
        header: "CERTIFICADO A LA FECHA",
        accessorKey: "certificadoALaFecha",
        align: "right",
        renderCell: ({ value }) => currencyFormatter.format(Number(value ?? 0)),
      },
      {
        id: "saldoACertificar",
        header: "SALDO A CERTIFICAR",
        accessorKey: "saldoACertificar",
        align: "right",
        renderCell: ({ value }) => currencyFormatter.format(Number(value ?? 0)),
      },
      {
        id: "segunContrato",
        header: "SEGÚN CONTRATO",
        accessorKey: "segunContrato",
        align: "right",
        renderCell: ({ value }) => numberFormatter.format(Number(value ?? 0)),
      },
      {
        id: "prorrogasAcordadas",
        header: "PRÓRROGAS ACORDADAS",
        accessorKey: "prorrogasAcordadas",
        align: "right",
        renderCell: ({ value }) => numberFormatter.format(Number(value ?? 0)),
      },
      {
        id: "plazoTotal",
        header: "PLAZO TOTAL",
        accessorKey: "plazoTotal",
        align: "right",
        renderCell: ({ value }) => numberFormatter.format(Number(value ?? 0)),
      },
      {
        id: "plazoTransc",
        header: "PLAZO TOTAL TRANSCURRIDO",
        accessorKey: "plazoTransc",
        align: "right",
        renderCell: ({ value }) => numberFormatter.format(Number(value ?? 0)),
      },
      {
        id: "porcentaje",
        header: "%",
        accessorKey: "porcentaje",
        align: "center",
        renderCell: ({ value }) => (
          <span className="font-semibold text-primary">{numberFormatter.format(Number(value ?? 0))}%</span>
        ),
      },
    ];
  }, [setExcelFilters, syncExcelPageToFirst]);

  const excelGroups = React.useMemo<DataTableHeaderGroup[]>(() => {
    return [
      {
        id: "fechas",
        label: "FECHAS",
        columns: ["mesBasicoDeContrato", "iniciacion"],
      },
      {
        id: "importes",
        label: "IMPORTES (EN PESOS) A VALORES BÁSICOS",
        columns: ["contratoMasAmpliaciones", "certificadoALaFecha", "saldoACertificar"],
      },
      {
        id: "plazos",
        label: "PLAZOS (EN MESES)",
        columns: ["segunContrato", "prorrogasAcordadas", "plazoTotal", "plazoTransc"],
      },
    ];
  }, []);

  const certColumns = React.useMemo<DataTableColumn<CertificadoRow>[]>(() => {
    return [
      { id: "obraName", header: "Obra", accessorKey: "obraName", enableHide: false },
      { id: "ente", header: "Ente", accessorKey: "ente" },
      {
        id: "monto",
        header: "Monto",
        accessorKey: "monto",
        align: "right",
        renderCell: ({ value }) => currencyFormatter.format(Number(value ?? 0)),
      },
      {
        id: "concepto",
        header: "Concepto",
        accessorKey: "concepto",
        renderCell: ({ value }) => (value as string) ?? "—",
      },
      {
        id: "facturado",
        header: "Facturado",
        accessorKey: "facturado",
        align: "center",
        renderCell: ({ value }) => (
          <Badge variant={value ? "default" : "secondary"}>{value ? "Sí" : "No"}</Badge>
        ),
      },
      {
        id: "cobrado",
        header: "Cobrado",
        accessorKey: "cobrado",
        align: "center",
        renderCell: ({ value }) => (
          <Badge
            variant={value ? "default" : "outline"}
            className={value ? "bg-emerald-600 hover:bg-emerald-600 text-white" : ""}
          >
            {value ? "Sí" : "Pendiente"}
          </Badge>
        ),
      },
      {
        id: "fechaFacturacion",
        header: "Fecha facturación",
        accessorKey: "fechaFacturacion",
        renderCell: ({ value }) => (value ? new Date(value as string).toLocaleDateString() : "—"),
      },
      {
        id: "fechaPago",
        header: "Fecha pago",
        accessorKey: "fechaPago",
        renderCell: ({ value }) => (value ? new Date(value as string).toLocaleDateString() : "—"),
      },
    ];
  }, []);

  const certGroups = React.useMemo<DataTableHeaderGroup[]>(() => {
    return [
      { id: "estado", label: "Estado", columns: ["facturado", "cobrado"] },
      { id: "fechas", label: "Fechas", columns: ["fechaFacturacion", "fechaPago"] },
    ];
  }, []);

  const materialsColumns = React.useMemo<DataTableColumn<MaterialOrderItem>[]>(() => {
    return [
      { id: "nroOrden", header: "Orden", accessorKey: "nroOrden", enablePin: true },
      { id: "solicitante", header: "Solicitante", accessorKey: "solicitante" },
      { id: "gestor", header: "Gestor", accessorKey: "gestor" },
      { id: "proveedor", header: "Proveedor", accessorKey: "proveedor" },
      { id: "material", header: "Material", accessorKey: "material", enablePin: true },
      {
        id: "unidad",
        header: "Unidad",
        accessorKey: "unidad",
        align: "center",
      },
      {
        id: "cantidad",
        header: "Cantidad",
        accessorKey: "cantidad",
        align: "right",
        renderCell: ({ value }) => numberFormatter.format(Number(value ?? 0)),
      },
      {
        id: "precioUnitario",
        header: "Precio unitario",
        accessorKey: "precioUnitario",
        align: "right",
        renderCell: ({ value }) => currencyFormatter.format(Number(value ?? 0)),
      },
    ];
  }, []);

  const materialsGroups = React.useMemo<DataTableHeaderGroup[]>(() => {
    return [
      { id: "pedido", label: "Pedido", columns: ["nroOrden", "solicitante", "gestor", "proveedor"] },
      { id: "item", label: "Detalle de material", columns: ["material", "unidad", "cantidad", "precioUnitario"] },
    ];
  }, []);

  const teamColumns = React.useMemo<DataTableColumn<TeamMember>[]>(() => {
    return [
      { id: "name", header: "Nombre", accessorKey: "name", enableHide: false },
      { id: "role", header: "Rol", accessorKey: "role" },
      { id: "seniority", header: "Seniority", accessorKey: "seniority" },
      { id: "location", header: "Ubicación", accessorKey: "location" },
      {
        id: "availability",
        header: "Disponibilidad",
        accessorKey: "availability",
        align: "center",
        renderCell: ({ value }) => `${Math.round(Number(value ?? 0) * 100)}%`,
      },
    ];
  }, []);

  const financialColumns = React.useMemo<DataTableColumn<FinancialSnapshot>[]>(() => {
    return [
      { id: "quarter", header: "Periodo", accessorKey: "quarter", enableHide: false },
      {
        id: "revenue",
        header: "Ingresos",
        accessorKey: "revenue",
        align: "right",
        renderCell: ({ value }) => currencyFormatter.format(Number(value ?? 0)),
      },
      {
        id: "expenses",
        header: "Egresos",
        accessorKey: "expenses",
        align: "right",
        renderCell: ({ value }) => currencyFormatter.format(Number(value ?? 0)),
      },
      {
        id: "profit",
        header: "Ganancia",
        accessorKey: "profit",
        align: "right",
        renderCell: ({ value }) => currencyFormatter.format(Number(value ?? 0)),
      },
      {
        id: "margin",
        header: "Margen",
        accessorKey: "margin",
        align: "center",
        renderCell: ({ value }) => `${numberFormatter.format(Number(value ?? 0) * 100)}%`,
      },
      {
        id: "newClients",
        header: "Nuevos clientes",
        accessorKey: "newClients",
        align: "center",
      },
    ];
  }, []);

  const excelFeatures = React.useMemo<DataTableFeatures<Obra>>(
    () => ({
      toolbar: { enabled: true },
      search: { enabled: true, placeholder: "Buscar por obra, entidad, etc." },
      columnVisibility: { enabled: true, persistKey: "playground:excel:hidden" },
      columnPinning: { enabled: true, persistKey: "playground:excel:pinned" },
      columnResizing: { mode: "fixed" },
      columnBalance: { enabled: true, minVisibleWidth: 120 },
      sorting: { enabled: true, defaultSort: EXCEL_DEFAULT_SORT },
      pagination: {
        enabled: true,
        initialPageSize: EXCEL_INITIAL_PAGE_SIZE,
        pageSizeOptions: [10, 25, 50, 100],
      },
      tabs: {
        enabled: true,
        defaultValue: "in-process",
        options: [
          { value: "in-process", label: "En proceso", predicate: (row) => !isCompletedObra(row) },
          { value: "completed", label: "Completadas", predicate: (row) => isCompletedObra(row) },
        ],
      },
      contextMenu: { enabled: true },
      filters: {
        enabled: true,
        onReset: () => resetExcelFilters(),
        render: () => (
          <div className="space-y-6">
            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm font-semibold">Sup. de Obra (m²)</p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Mín"
                  value={excelFilters.supMin}
                  onChange={(event) => {
                    setExcelFilters((prev) => ({ ...prev, supMin: event.target.value }));
                    syncExcelPageToFirst();
                  }}
                />
                <span className="text-xs text-muted-foreground">a</span>
                <Input
                  type="number"
                  placeholder="Máx"
                  value={excelFilters.supMax}
                  onChange={(event) => {
                    setExcelFilters((prev) => ({ ...prev, supMax: event.target.value }));
                    syncExcelPageToFirst();
                  }}
                />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm font-semibold">Entidad contratante</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {excelEntities.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aún no hay entidades cargadas.</p>
                ) : (
                  excelEntities.map((entidad) => {
                    const checked = excelFilters.entidades.includes(entidad);
                    return (
                      <label
                        key={entidad}
                        className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs sm:text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value: CheckedState) => {
                            const next = value === true || value === "indeterminate";
                            setExcelFilters((prev) => ({
                              ...prev,
                              entidades: next
                                ? Array.from(new Set([...prev.entidades, entidad]))
                                : prev.entidades.filter((ent) => ent !== entidad),
                            }));
                            syncExcelPageToFirst();
                          }}
                        />
                        <span>{entidad}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm font-semibold">Fechas</p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Mes básico de contrato</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      placeholder="Año (ej: 2024)"
                      value={excelFilters.mesYear}
                      onChange={(event) => {
                        setExcelFilters((prev) => ({ ...prev, mesYear: event.target.value }));
                        syncExcelPageToFirst();
                      }}
                    />
                    <Input
                      placeholder="Contiene..."
                      value={excelFilters.mesContains}
                      onChange={(event) => {
                        setExcelFilters((prev) => ({ ...prev, mesContains: event.target.value }));
                        syncExcelPageToFirst();
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Iniciación</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      placeholder="Año (ej: 2024)"
                      value={excelFilters.iniYear}
                      onChange={(event) => {
                        setExcelFilters((prev) => ({ ...prev, iniYear: event.target.value }));
                        syncExcelPageToFirst();
                      }}
                    />
                    <Input
                      placeholder="Contiene..."
                      value={excelFilters.iniContains}
                      onChange={(event) => {
                        setExcelFilters((prev) => ({ ...prev, iniContains: event.target.value }));
                        syncExcelPageToFirst();
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm font-semibold">Importes (en pesos)</p>
              {[
                {
                  label: "Contrato + ampliaciones",
                  minKey: "cmaMin" as const,
                  maxKey: "cmaMax" as const,
                },
                {
                  label: "Certificado a la fecha",
                  minKey: "cafMin" as const,
                  maxKey: "cafMax" as const,
                },
                {
                  label: "Saldo a certificar",
                  minKey: "sacMin" as const,
                  maxKey: "sacMax" as const,
                },
              ].map(({ label, minKey, maxKey }) => (
                <div key={label} className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Mín"
                      value={excelFilters[minKey]}
                      onChange={(event) => {
                        setExcelFilters((prev) => ({ ...prev, [minKey]: event.target.value }));
                        syncExcelPageToFirst();
                      }}
                    />
                    <span className="text-xs text-muted-foreground">a</span>
                    <Input
                      type="number"
                      placeholder="Máx"
                      value={excelFilters[maxKey]}
                      onChange={(event) => {
                        setExcelFilters((prev) => ({ ...prev, [maxKey]: event.target.value }));
                        syncExcelPageToFirst();
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm font-semibold">Plazos (en meses)</p>
              {[
                { label: "Según contrato", minKey: "scMin" as const, maxKey: "scMax" as const },
                { label: "Prórrogas acordadas", minKey: "paMin" as const, maxKey: "paMax" as const },
                { label: "Plazo total", minKey: "ptMin" as const, maxKey: "ptMax" as const },
                {
                  label: "Plazo total transcurrido",
                  minKey: "ptrMin" as const,
                  maxKey: "ptrMax" as const,
                },
              ].map(({ label, minKey, maxKey }) => (
                <div key={label} className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Mín"
                      value={excelFilters[minKey]}
                      onChange={(event) => {
                        setExcelFilters((prev) => ({ ...prev, [minKey]: event.target.value }));
                        syncExcelPageToFirst();
                      }}
                    />
                    <span className="text-xs text-muted-foreground">a</span>
                    <Input
                      type="number"
                      placeholder="Máx"
                      value={excelFilters[maxKey]}
                      onChange={(event) => {
                        setExcelFilters((prev) => ({ ...prev, [maxKey]: event.target.value }));
                        syncExcelPageToFirst();
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      csvImport: {
        enabled: true,
        label: "Importar CSV",
        parseFile: parseObrasCsvFile,
        onSuccess: (rows) => {
          excelForm.setFieldValue("detalleObras", () => rows);
          setExcelPersistedRows(rows);
          setExcelDraftRows(rows);
          resetExcelFilters();
        },
        onError: (error) => setExcelError(error.message),
      },
      editable: {
        enabled: true,
        onRowUpdate: (row, index) => {
          console.log("Obra updated:", row, index);
          toast.info(`Obra #${row.n} actualizada. Recordá guardar los cambios.`);
        },
      },
      rowActions: {
        enabled: true,
        renderMenu: ({ duplicateRow, deleteRow }) => (
          <>
            <DropdownMenuItem
              onClick={() => {
                duplicateRow();
                toast.success("Fila duplicada. Guardá para confirmar.");
              }}
            >
              Duplicar fila
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                deleteRow();
                toast.info("Fila eliminada. Guardá para confirmar.");
              }}
            >
              Eliminar fila
            </DropdownMenuItem>
          </>
        ),
      },
      addRow: {
        enabled: true,
        label: "Agregar fila",
        createRow: () => createEmptyObra(nextExcelRowNumber()),
      },
    }),
    [
      excelEntities,
      excelFilters,
      resetExcelFilters,
      excelForm,
      syncExcelPageToFirst,
      nextExcelRowNumber,
    ],
  );

  const certFeatures = React.useMemo<DataTableFeatures<CertificadoRow>>(
    () => ({
      toolbar: { enabled: true },
      search: { enabled: true, placeholder: "Buscá por obra o concepto" },
      columnVisibility: { enabled: true, persistKey: "playground:cert:hidden" },
      columnResizing: { mode: "fixed" },
      sorting: { enabled: true, defaultSort: { columnId: "monto", direction: "desc" } },
      pagination: { enabled: true, initialPageSize: 15 },
      rowActions: { enabled: false },
      contextMenu: { enabled: true },
      editable: {
        enabled: true,
        columns: ["ente", "concepto", "cobrado", "fechaPago"],
        onRowUpdate: (row, index) => {
          console.log("Certificado updated:", row, index);
          toast.success(`Certificado de ${row.obraName} actualizado`);
        },
      },
    }),
    [],
  );

  const materialsFeatures = React.useMemo<DataTableFeatures<MaterialOrderItem>>(
    () => ({
      toolbar: { enabled: true },
      search: { enabled: true, placeholder: "Filtrar materiales, proveedores, etc." },
      columnVisibility: { enabled: true, persistKey: "playground:materials:hidden" },
      columnPinning: { enabled: true, persistKey: "playground:materials:pinned" },
      columnResizing: { mode: "fixed" },
      sorting: { enabled: true, defaultSort: { columnId: "material", direction: "asc" } },
      pagination: { enabled: true, initialPageSize: 20, pageSizeOptions: [20, 50, 100] },
      rowActions: { enabled: false },
      contextMenu: { enabled: true },
    }),
    [],
  );

  const teamFeatures = React.useMemo<DataTableFeatures<TeamMember>>(
    () => ({
      toolbar: { enabled: true },
      search: { enabled: true, placeholder: "Filtrar por rol o nombre" },
      tabs: {
        enabled: true,
        defaultValue: "active",
        options: [
          { value: "active", label: "Activos", predicate: (row) => row.status === "active" },
          { value: "pto", label: "En PTO", predicate: (row) => row.status === "pto" },
        ],
      },
      columnVisibility: { enabled: false },
      columnResizing: { mode: "balanced" },
      sorting: { enabled: true, defaultSort: { columnId: "availability", direction: "desc" } },
      pagination: { enabled: false },
      rowActions: { enabled: false },
      contextMenu: { enabled: false },
    }),
    [],
  );

  const financialFeatures = React.useMemo<DataTableFeatures<FinancialSnapshot>>(
    () => ({
      toolbar: { enabled: false },
      columnVisibility: { enabled: false },
      columnResizing: { mode: "balanced" },
      columnBalance: { enabled: true },
      sorting: { enabled: true, defaultSort: { columnId: "quarter", direction: "asc" } },
      pagination: { enabled: false },
      rowActions: { enabled: false },
      contextMenu: { enabled: false },
    }),
    [],
  );

  return (
    <div className="space-y-6 px-4 py-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Explorá configuraciones dinámicas</p>
        <h1 className="text-3xl font-semibold tracking-tight">Data Table Playground</h1>
        <p className="text-sm text-muted-foreground">
          Cada pestaña reutiliza el mismo componente pero con columnas, agrupaciones y features distintos.
        </p>
      </div>

      <Tabs defaultValue={tabs[0].value} className="space-y-4">
        <TabsList className="flex flex-wrap">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="capitalize">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="obras">
          <Card className="bg-white">
            <CardHeader className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle>Obras en ejecución</CardTitle>
                <CardDescription>
                  Datos reales del módulo Excel con columnas agrupadas y todas las funcionalidades habilitadas.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => void fetchObras()} disabled={excelLoading || isExcelSaving}>
                  Recargar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExcelDiscard}
                  disabled={!excelHasUnsavedChanges || isExcelSaving}
                >
                  Descartar cambios
                </Button>
                <Button
                  size="sm"
                  onClick={() => void handleExcelSave()}
                  disabled={!excelHasUnsavedChanges || isExcelSaving}
                >
                  {isExcelSaving ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {excelError && (
                <p className="mb-4 text-sm text-destructive">Error: {excelError}</p>
              )}
              <AdvancedDataTable
                id="playground-excel"
                data={excelPageRows}
                columns={excelColumns}
                headerGroups={excelGroups}
                headerGroupBgClassName="bg-sidebar"
                features={excelFeatures}
                getRowId={getExcelRowId}
                rowStateMode="controlled"
                onRowsChange={handleExcelRowsChange}
                serverState={{
                  enabled: true,
                  totalRows: excelTotalRows,
                  applyClientSideFiltering: false,
                  onQueryChange: handleExcelQueryChange,
                }}
                isLoading={excelLoading}
                emptyText="No hay obras para mostrar por ahora."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="certificados">
          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle>Certificados emitidos</CardTitle>
                <CardDescription>
                  Tabla adaptable con totales en pesos, estados y fechas. Ideal para seguimiento financiero.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => void fetchCertificados()} disabled={certLoading}>
                Actualizar
              </Button>
            </CardHeader>
            <CardContent>
              {certError && (
                <p className="mb-4 text-sm text-destructive">Error: {certError}</p>
              )}
              <AdvancedDataTable
                id="playground-certificados"
                data={certData}
                columns={certColumns}
                headerGroups={certGroups}
                features={certFeatures}
                isLoading={certLoading}
                emptyText="Todavía no hay certificados."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="materiales">
          <Card>
            <CardHeader className="space-y-4">
              <div>
                <CardTitle>Materiales por obra</CardTitle>
                <CardDescription>
                  Seleccioná una obra y visualizá automáticamente sus órdenes de materiales.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Select
                  value={selectedObraId}
                  onValueChange={(value) => {
                    setSelectedObraId(value);
                    void fetchMaterials(value);
                  }}
                >
                  <SelectTrigger className="w-[320px]">
                    <SelectValue placeholder="Elegí una obra" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[360px]">
                    {excelDraftRows
                      .filter((obra) => obra.id != null)
                      .map((obra) => (
                        <SelectItem key={obra.id} value={String(obra.id)}>
                          {obra.designacionYUbicacion ?? `Obra #${obra.id}`}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedObraId && fetchMaterials(selectedObraId)}
                  disabled={!selectedObraId || materialsLoading}
                >
                  Actualizar
                </Button>
                {materialsError && (
                  <p className="text-sm text-destructive">{materialsError}</p>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <AdvancedDataTable
                id="playground-materials"
                data={materialsData}
                columns={materialsColumns}
                headerGroups={materialsGroups}
                features={materialsFeatures}
                isLoading={materialsLoading}
                emptyText={
                  selectedObraId
                    ? "La obra seleccionada todavía no tiene órdenes de materiales."
                    : "Elegí una obra para ver sus materiales."
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <Card>
            <CardHeader>
              <CardTitle>Equipo interno</CardTitle>
              <CardDescription>
                Datos ficticios para mostrar filtros por pestañas y búsqueda combinada.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdvancedDataTable
                id="playground-team"
                data={teamMembers}
                columns={teamColumns}
                features={teamFeatures}
                emptyText="Sin integrantes registrados."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial">
          <Card>
            <CardHeader>
              <CardTitle>Indicadores financieros</CardTitle>
              <CardDescription>
                Demostración estática sin toolbar ni acciones adicionales.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdvancedDataTable
                id="playground-financial"
                data={financialSnapshots}
                columns={financialColumns}
                features={financialFeatures}
                headerGroups={[
                  { id: "dinero", label: "Montos", columns: ["revenue", "expenses", "profit"] },
                  { id: "kpi", label: "KPI", columns: ["margin", "newClients"] },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


