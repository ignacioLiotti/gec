"use client";

import {
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Columns3,
  Download,
  Pencil,
  Plus,
  Search,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  money,
  number,
  percent,
  type PreviewObra,
  type PreviewObraPatch,
  type PreviewScreenProps,
} from "../contracts";
import { EmptyState, PageHeading, Panel, Status } from "../shared";
import styles from "./obras.module.css";

type StatusFilter = "all" | "in-progress" | "completed";
type SortDirection = "asc" | "desc";
type ColumnId =
  | "number"
  | "name"
  | "area"
  | "entity"
  | "baseMonth"
  | "startDate"
  | "progress"
  | "contract"
  | "certified"
  | "balance"
  | "contractMonths"
  | "extensionMonths"
  | "totalMonths"
  | "elapsedMonths";
type OptionalColumnId =
  | "area"
  | "baseMonth"
  | "startDate"
  | "contractMonths"
  | "extensionMonths"
  | "totalMonths"
  | "elapsedMonths";

interface TableColumn {
  id: ColumnId;
  label: string;
  optional?: true;
  numeric?: true;
  className?: string;
  sortValue: (obra: PreviewObra) => string | number;
  exportValue: (obra: PreviewObra) => string;
}

interface ObraFormValues {
  number: number;
  name: string;
  entity: string;
  area: number;
  baseMonth: string;
  startDate: string;
  contract: number;
  certified: number;
  progress: number;
  contractMonths: number;
  extensionMonths: number;
  elapsedMonths: number;
}

const OPTIONAL_COLUMNS: Record<OptionalColumnId, boolean> = {
  area: false,
  baseMonth: false,
  startDate: false,
  contractMonths: false,
  extensionMonths: false,
  totalMonths: false,
  elapsedMonths: false,
};

const TABLE_COLUMNS: TableColumn[] = [
  {
    id: "number",
    label: "N°",
    numeric: true,
    className: styles.numberColumn,
    sortValue: (obra) => obra.number,
    exportValue: (obra) => number(obra.number),
  },
  {
    id: "name",
    label: "Designación y Ubicación",
    className: styles.nameColumn,
    sortValue: (obra) => obra.name,
    exportValue: (obra) => obra.name,
  },
  {
    id: "area",
    label: "Sup. de Obra (m²)",
    optional: true,
    numeric: true,
    sortValue: (obra) => obra.area,
    exportValue: (obra) => number(obra.area, 1),
  },
  {
    id: "entity",
    label: "Entidad Contratante",
    className: styles.entityColumn,
    sortValue: (obra) => obra.entity,
    exportValue: (obra) => obra.entity,
  },
  {
    id: "baseMonth",
    label: "Mes Básico de Contrato",
    optional: true,
    sortValue: (obra) => obra.baseMonth,
    exportValue: (obra) => obra.baseMonth,
  },
  {
    id: "startDate",
    label: "Iniciación",
    optional: true,
    sortValue: (obra) => obra.startDate,
    exportValue: (obra) => obra.startDate,
  },
  {
    id: "progress",
    label: "% Avance",
    numeric: true,
    className: styles.progressColumn,
    sortValue: (obra) => obra.progress,
    exportValue: (obra) => percent(obra.progress),
  },
  {
    id: "contract",
    label: "Contrato + Ampliaciones",
    numeric: true,
    className: styles.moneyColumn,
    sortValue: (obra) => obra.contract,
    exportValue: (obra) => money(obra.contract),
  },
  {
    id: "certified",
    label: "Certificado a la Fecha",
    numeric: true,
    className: styles.moneyColumn,
    sortValue: (obra) => obra.certified,
    exportValue: (obra) => money(obra.certified),
  },
  {
    id: "balance",
    label: "Saldo a Certificar",
    numeric: true,
    className: styles.moneyColumn,
    sortValue: (obra) => obra.contract - obra.certified,
    exportValue: (obra) => money(obra.contract - obra.certified),
  },
  {
    id: "contractMonths",
    label: "Según Contrato",
    optional: true,
    numeric: true,
    sortValue: (obra) => obra.contractMonths,
    exportValue: (obra) => number(obra.contractMonths),
  },
  {
    id: "extensionMonths",
    label: "Prórrogas Acordadas",
    optional: true,
    numeric: true,
    sortValue: (obra) => obra.extensionMonths,
    exportValue: (obra) => number(obra.extensionMonths),
  },
  {
    id: "totalMonths",
    label: "Plazo Total",
    optional: true,
    numeric: true,
    sortValue: (obra) => obra.contractMonths + obra.extensionMonths,
    exportValue: (obra) => number(obra.contractMonths + obra.extensionMonths),
  },
  {
    id: "elapsedMonths",
    label: "Plazo Transcurrido",
    optional: true,
    numeric: true,
    sortValue: (obra) => obra.elapsedMonths,
    exportValue: (obra) => number(obra.elapsedMonths),
  },
];

const OPTIONAL_COLUMN_LABELS: Record<OptionalColumnId, string> = {
  area: "Superficie de obra",
  baseMonth: "Mes básico de contrato",
  startDate: "Iniciación",
  contractMonths: "Según contrato",
  extensionMonths: "Prórrogas acordadas",
  totalMonths: "Plazo total",
  elapsedMonths: "Plazo transcurrido",
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

function formatMonth(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value || "—";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return new Intl.DateTimeFormat("es-AR", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value || "—";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function downloadCsv(rows: PreviewObra[], columns: TableColumn[], selected: boolean) {
  const lines = [
    columns.map((column) => csvCell(column.label)).join(","),
    ...rows.map((obra) =>
      columns.map((column) => csvCell(column.exportValue(obra))).join(","),
    ),
  ];
  const blob = new Blob(["\uFEFF", lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = selected ? "obras-seleccionadas.csv" : "obras-filtradas.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function createBlankObra(obras: PreviewObra[]): PreviewObra {
  return {
    id: `obra-local-${Date.now()}`,
    number: Math.max(0, ...obras.map((obra) => obra.number)) + 1,
    name: "",
    entity: "",
    area: 0,
    baseMonth: "2026-10",
    startDate: "2026-10-14",
    contract: 0,
    certified: 0,
    progress: 0,
    contractMonths: 12,
    extensionMonths: 0,
    elapsedMonths: 0,
    curve: [],
    certificates: [],
    customFields: {},
  };
}

function createImportedObra(obras: PreviewObra[]): PreviewObra {
  const nextNumber = Math.max(0, ...obras.map((obra) => obra.number)) + 1;
  return {
    id: `obra-csv-${nextNumber}`,
    number: nextNumber,
    name: "Centro de Atención Barrial · Rosario",
    entity: "Municipalidad de Rosario",
    area: 2450,
    baseMonth: "2026-09",
    startDate: "2026-10-01",
    contract: 685000000,
    certified: 82200000,
    progress: 18.5,
    contractMonths: 10,
    extensionMonths: 0,
    elapsedMonths: 1,
    curve: [],
    certificates: [],
    customFields: { Origen: "CSV ficticio de esta vista" },
  };
}

function toFormValues(obra: PreviewObra): ObraFormValues {
  return {
    number: obra.number,
    name: obra.name,
    entity: obra.entity,
    area: obra.area,
    baseMonth: obra.baseMonth,
    startDate: obra.startDate,
    contract: obra.contract,
    certified: obra.certified,
    progress: obra.progress,
    contractMonths: obra.contractMonths,
    extensionMonths: obra.extensionMonths,
    elapsedMonths: obra.elapsedMonths,
  };
}

function formValuesToPatch(values: ObraFormValues): PreviewObraPatch {
  return {
    ...values,
    progress: Math.min(100, Math.max(0, values.progress)),
  };
}

function progressTone(progress: number) {
  if (progress >= 100) return "success" as const;
  if (progress >= 75) return "info" as const;
  return "warning" as const;
}

function ProgressValue({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  const progressStyle = { "--progress": `${clamped}%` } as CSSProperties;

  return (
    <div className={styles.progressCell}>
      <div className={styles.progressTrack} aria-hidden="true">
        <span className={styles.progressFill} style={progressStyle} />
      </div>
      <Status tone={progressTone(clamped)}>{percent(clamped)}</Status>
    </div>
  );
}

function renderCell(columnId: ColumnId, obra: PreviewObra) {
  switch (columnId) {
    case "number":
      return number(obra.number);
    case "name":
      return <span className={styles.obraName}>{obra.name}</span>;
    case "area":
      return `${number(obra.area, 1)} m²`;
    case "entity":
      return obra.entity;
    case "baseMonth":
      return formatMonth(obra.baseMonth);
    case "startDate":
      return formatDate(obra.startDate);
    case "progress":
      return <ProgressValue value={obra.progress} />;
    case "contract":
      return money(obra.contract);
    case "certified":
      return money(obra.certified);
    case "balance":
      return money(obra.contract - obra.certified);
    case "contractMonths":
      return number(obra.contractMonths);
    case "extensionMonths":
      return number(obra.extensionMonths);
    case "totalMonths":
      return number(obra.contractMonths + obra.extensionMonths);
    case "elapsedMonths":
      return number(obra.elapsedMonths);
  }
}

function ObraFormDialog({
  obra,
  mode,
  onCancel,
  onCloseAutoFocus,
  onSubmit,
}: {
  obra: PreviewObra;
  mode: "create" | "edit";
  onCancel: () => void;
  onCloseAutoFocus: ComponentProps<typeof DialogContent>["onCloseAutoFocus"];
  onSubmit: (patch: PreviewObraPatch) => void;
}) {
  const formId = useId();
  const [values, setValues] = useState<ObraFormValues>(() => toFormValues(obra));

  function updateField<K extends keyof ObraFormValues>(
    field: K,
    value: ObraFormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(formValuesToPatch(values));
  }

  const title = mode === "create" ? "Nueva obra" : `Editar obra N° ${obra.number}`;
  const description =
    mode === "create"
      ? "Completá los datos principales para agregarla a la cartera local."
      : "Los cambios se guardan en los datos compartidos de esta vista previa.";

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent
        className={styles.dialogContent}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <form className={styles.dialogForm} onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <Label htmlFor={`${formId}-number`}>Número</Label>
              <Input
                id={`${formId}-number`}
                type="number"
                min={1}
                required
                value={values.number}
                onChange={(event) => updateField("number", Number(event.target.value))}
              />
            </div>
            <div className={`${styles.formField} ${styles.formFieldWide}`}>
              <Label htmlFor={`${formId}-name`}>Designación y ubicación</Label>
              <Input
                id={`${formId}-name`}
                required
                value={values.name}
                onChange={(event) => updateField("name", event.target.value)}
              />
            </div>
            <div className={`${styles.formField} ${styles.formFieldWide}`}>
              <Label htmlFor={`${formId}-entity`}>Entidad contratante</Label>
              <Input
                id={`${formId}-entity`}
                required
                value={values.entity}
                onChange={(event) => updateField("entity", event.target.value)}
              />
            </div>
            <div className={styles.formField}>
              <Label htmlFor={`${formId}-area`}>Superficie de obra (m²)</Label>
              <Input
                id={`${formId}-area`}
                type="number"
                min={0}
                step="0.1"
                value={values.area}
                onChange={(event) => updateField("area", Number(event.target.value))}
              />
            </div>
            <div className={styles.formField}>
              <Label htmlFor={`${formId}-base-month`}>Mes básico de contrato</Label>
              <Input
                id={`${formId}-base-month`}
                type="month"
                required
                value={values.baseMonth}
                onChange={(event) => updateField("baseMonth", event.target.value)}
              />
            </div>
            <div className={styles.formField}>
              <Label htmlFor={`${formId}-start-date`}>Iniciación</Label>
              <Input
                id={`${formId}-start-date`}
                type="date"
                required
                value={values.startDate}
                onChange={(event) => updateField("startDate", event.target.value)}
              />
            </div>
            <div className={styles.formField}>
              <Label htmlFor={`${formId}-contract`}>Contrato + ampliaciones</Label>
              <Input
                id={`${formId}-contract`}
                type="number"
                min={0}
                step="0.01"
                required
                value={values.contract}
                onChange={(event) => updateField("contract", Number(event.target.value))}
              />
            </div>
            <div className={styles.formField}>
              <Label htmlFor={`${formId}-progress`}>Avance (%)</Label>
              <Input
                id={`${formId}-progress`}
                type="number"
                min={0}
                max={100}
                step="0.1"
                required
                value={values.progress}
                onChange={(event) => updateField("progress", Number(event.target.value))}
              />
            </div>
            <div className={styles.formField}>
              <Label htmlFor={`${formId}-certified`}>Certificado a la fecha</Label>
              <Input
                id={`${formId}-certified`}
                type="number"
                min={0}
                max={values.contract}
                step="0.01"
                required
                value={values.certified}
                onChange={(event) => updateField("certified", Number(event.target.value))}
              />
            </div>
            <div className={styles.formField}>
              <Label htmlFor={`${formId}-contract-months`}>Según contrato (meses)</Label>
              <Input
                id={`${formId}-contract-months`}
                type="number"
                min={0}
                required
                value={values.contractMonths}
                onChange={(event) => updateField("contractMonths", Number(event.target.value))}
              />
            </div>
            <div className={styles.formField}>
              <Label htmlFor={`${formId}-extension-months`}>Prórrogas acordadas</Label>
              <Input
                id={`${formId}-extension-months`}
                type="number"
                min={0}
                required
                value={values.extensionMonths}
                onChange={(event) => updateField("extensionMonths", Number(event.target.value))}
              />
            </div>
            <div className={styles.formField}>
              <Label htmlFor={`${formId}-elapsed-months`}>Plazo transcurrido</Label>
              <Input
                id={`${formId}-elapsed-months`}
                type="number"
                min={0}
                required
                value={values.elapsedMonths}
                onChange={(event) => updateField("elapsedMonths", Number(event.target.value))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit">
              {mode === "create" ? "Agregar obra" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImportCsvDialog({
  open,
  preview,
  onCancel,
  onCloseAutoFocus,
  onConfirm,
}: {
  open: boolean;
  preview: PreviewObra;
  onCancel: () => void;
  onCloseAutoFocus: ComponentProps<typeof DialogContent>["onCloseAutoFocus"];
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent
        className={styles.importDialog}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader>
          <DialogTitle>Confirmar importación CSV</DialogTitle>
          <DialogDescription>
            Esta acción agrega una obra ficticia a los datos locales de la vista previa.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.importBody}>
          <Status tone="info">Archivo de ejemplo · obras_octubre.csv</Status>
          <dl className={styles.importPreview}>
            <div>
              <dt>Designación</dt>
              <dd>{preview.name}</dd>
            </div>
            <div>
              <dt>Entidad</dt>
              <dd>{preview.entity}</dd>
            </div>
            <div>
              <dt>Contrato</dt>
              <dd>{money(preview.contract)}</dd>
            </div>
            <div>
              <dt>Avance</dt>
              <dd>{percent(preview.progress)}</dd>
            </div>
          </dl>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" onClick={onConfirm}>
            Importar 1 obra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ObrasPreview({ data, actions }: PreviewScreenProps) {
  const searchId = useId();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("in-progress");
  const [entity, setEntity] = useState("all");
  const [optionalColumns, setOptionalColumns] =
    useState<Record<OptionalColumnId, boolean>>(OPTIONAL_COLUMNS);
  const [sort, setSort] = useState<{ columnId: ColumnId; direction: SortDirection }>({
    columnId: "number",
    direction: "asc",
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [editingObra, setEditingObra] = useState<PreviewObra | null>(null);
  const [creatingObra, setCreatingObra] = useState<PreviewObra | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const dialogOpenerRef = useRef<HTMLElement | null>(null);
  const dialogFallbackRef = useRef<HTMLButtonElement | null>(null);

  const entities = useMemo(
    () =>
      [...new Set(data.obras.map((obra) => obra.entity).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "es", { sensitivity: "base" }),
      ),
    [data.obras],
  );

  const counts = useMemo(
    () => ({
      all: data.obras.length,
      inProgress: data.obras.filter((obra) => obra.progress < 100).length,
      completed: data.obras.filter((obra) => obra.progress >= 100).length,
    }),
    [data.obras],
  );

  const visibleColumns = useMemo(
    () =>
      TABLE_COLUMNS.filter(
        (column) => !column.optional || optionalColumns[column.id as OptionalColumnId],
      ),
    [optionalColumns],
  );

  const filteredRows = useMemo(() => {
    const query = normalizeSearch(search);
    return data.obras.filter((obra) => {
      if (status === "in-progress" && obra.progress >= 100) return false;
      if (status === "completed" && obra.progress < 100) return false;
      if (entity !== "all" && obra.entity !== entity) return false;
      if (!query) return true;

      const searchable = [
        obra.number,
        obra.name,
        obra.entity,
        obra.baseMonth,
        obra.startDate,
        obra.contract,
        obra.certified,
        obra.progress,
      ]
        .join(" ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("es");
      return searchable.includes(query);
    });
  }, [data.obras, entity, search, status]);

  const sortedRows = useMemo(() => {
    const column = TABLE_COLUMNS.find((candidate) => candidate.id === sort.columnId);
    if (!column) return filteredRows;
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...filteredRows].sort((left, right) => {
      const leftValue = column.sortValue(left);
      const rightValue = column.sortValue(right);
      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return (leftValue - rightValue) * direction;
      }
      return String(leftValue).localeCompare(String(rightValue), "es", {
        numeric: true,
        sensitivity: "base",
      }) * direction;
    });
  }, [filteredRows, sort]);

  const selectedRows = useMemo(
    () => data.obras.filter((obra) => selectedIds.has(obra.id)),
    [data.obras, selectedIds],
  );
  const allVisibleSelected =
    sortedRows.length > 0 && sortedRows.every((obra) => selectedIds.has(obra.id));
  const someVisibleSelected = sortedRows.some((obra) => selectedIds.has(obra.id));
  const exportRows = selectedRows.length > 0 ? selectedRows : sortedRows;
  const importPreview = useMemo(() => createImportedObra(data.obras), [data.obras]);

  function changeStatus(value: string) {
    if (value === "all" || value === "in-progress" || value === "completed") {
      setStatus(value);
    }
  }

  function clearFilters() {
    setSearch("");
    setStatus("all");
    setEntity("all");
  }

  function toggleSort(columnId: ColumnId) {
    setSort((current) =>
      current.columnId === columnId
        ? {
            columnId,
            direction: current.direction === "asc" ? "desc" : "asc",
          }
        : { columnId, direction: "asc" },
    );
  }

  function toggleVisibleSelection() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        sortedRows.forEach((obra) => next.delete(obra.id));
      } else {
        sortedRows.forEach((obra) => next.add(obra.id));
      }
      return next;
    });
  }

  function toggleRowSelection(obraId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(obraId)) next.delete(obraId);
      else next.add(obraId);
      return next;
    });
  }

  function openObra(obraId: string) {
    actions.onNavigate({ view: "general", obraId });
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, obraId: string) {
    if (event.target !== event.currentTarget || event.key !== "Enter") return;
    event.preventDefault();
    openObra(obraId);
  }

  function stopRowNavigation(event: MouseEvent) {
    event.stopPropagation();
  }

  function rememberDialogOpener(element: HTMLElement) {
    dialogOpenerRef.current = element;
  }

  const restoreDialogFocus: ComponentProps<typeof DialogContent>["onCloseAutoFocus"] = (
    event,
  ) => {
    event.preventDefault();
    const opener = dialogOpenerRef.current;
    const target = opener?.isConnected ? opener : dialogFallbackRef.current;
    target?.focus();
    dialogOpenerRef.current = null;
  };

  function saveEdit(patch: PreviewObraPatch) {
    if (!editingObra) return;
    actions.onSaveObra(editingObra.id, patch);
    setEditingObra(null);
  }

  function addObra(patch: PreviewObraPatch) {
    if (!creatingObra) return;
    const nextObra = { ...creatingObra, ...patch };
    actions.onAddObra(nextObra);
    setCreatingObra(null);
    setSearch("");
    setEntity("all");
    setStatus(nextObra.progress >= 100 ? "completed" : "in-progress");
  }

  function confirmImport() {
    actions.onAddObra(importPreview);
    setImportOpen(false);
    setSearch("");
    setEntity("all");
    setStatus("in-progress");
  }

  const headingActions = (
    <div className={styles.headingActions}>
      <Button
        type="button"
        variant="outline"
        onClick={(event) => {
          rememberDialogOpener(event.currentTarget);
          setImportOpen(true);
        }}
      >
        <Upload aria-hidden="true" />
        Importar CSV
      </Button>
      <Button
        ref={dialogFallbackRef}
        type="button"
        onClick={(event) => {
          rememberDialogOpener(event.currentTarget);
          setCreatingObra(createBlankObra(data.obras));
        }}
      >
        <Plus aria-hidden="true" />
        Nueva obra
      </Button>
    </div>
  );

  return (
    <div className={styles.screen}>
      <PageHeading
        eyebrow="Obras"
        title="Tus Obras"
        description="Filtrá, buscá y actualizá tu cartera desde una vista unificada."
        actions={headingActions}
      />

      <div className={styles.tabsRow}>
        <Tabs value={status} onValueChange={changeStatus}>
          <TabsList className={styles.tabsList} aria-label="Estado de las obras">
            <TabsTrigger value="all">Todas · {number(counts.all)}</TabsTrigger>
            <TabsTrigger value="in-progress">
              En proceso · {number(counts.inProgress)}
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completadas · {number(counts.completed)}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <p className={styles.selectionSummary} aria-live="polite">
          {selectedRows.length > 0
            ? `${number(selectedRows.length)} seleccionada${selectedRows.length === 1 ? "" : "s"}`
            : `${number(sortedRows.length)} obra${sortedRows.length === 1 ? "" : "s"}`}
        </p>
      </div>

      <Panel
        title="Cartera de obras"
        description="Importes en pesos a valores básicos. Los plazos se expresan en meses."
        className={styles.tablePanel}
        actions={
          <Button
            type="button"
            variant="outline"
            disabled={exportRows.length === 0}
            onClick={() => downloadCsv(exportRows, visibleColumns, selectedRows.length > 0)}
          >
            <Download aria-hidden="true" />
            {selectedRows.length > 0
              ? `Exportar ${number(selectedRows.length)} seleccionada${selectedRows.length === 1 ? "" : "s"}`
              : "Exportar CSV"}
          </Button>
        }
      >
        <div className={styles.toolbar}>
          <div className={styles.searchField}>
            <Label className={styles.srOnly} htmlFor={searchId}>
              Buscar en obras
            </Label>
            <Search className={styles.searchIcon} aria-hidden="true" />
            <Input
              id={searchId}
              className={styles.searchInput}
              type="search"
              placeholder="Buscar en columnas de obras"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <Select value={status} onValueChange={changeStatus}>
            <SelectTrigger className={styles.filterControl} aria-label="Filtrar por estado">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent heading="Estado">
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="in-progress">En proceso</SelectItem>
              <SelectItem value="completed">Completadas</SelectItem>
            </SelectContent>
          </Select>

          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger className={styles.entityFilter} aria-label="Filtrar por entidad">
              <SelectValue placeholder="Entidad contratante" />
            </SelectTrigger>
            <SelectContent heading="Entidad contratante">
              <SelectItem value="all">Todas las entidades</SelectItem>
              {entities.map((entityName) => (
                <SelectItem key={entityName} value={entityName}>
                  {entityName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline">
                <Columns3 aria-hidden="true" />
                Columnas
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={styles.columnsMenu}>
              <DropdownMenuLabel>Columnas opcionales</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(Object.keys(OPTIONAL_COLUMNS) as OptionalColumnId[]).map((columnId) => (
                <DropdownMenuCheckboxItem
                  key={columnId}
                  checked={optionalColumns[columnId]}
                  onCheckedChange={(checked) =>
                    setOptionalColumns((current) => ({
                      ...current,
                      [columnId]: Boolean(checked),
                    }))
                  }
                  onSelect={(event) => event.preventDefault()}
                >
                  {OPTIONAL_COLUMN_LABELS[columnId]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {sortedRows.length === 0 ? (
          <EmptyState
            title={data.obras.length === 0 ? "Todavía no hay obras" : "No encontramos obras"}
            description={
              data.obras.length === 0
                ? "Agregá la primera obra o importá el CSV ficticio de esta vista."
                : "Probá con otra búsqueda, estado o entidad contratante."
            }
            action={
              data.obras.length === 0 ? (
                <Button
                  type="button"
                  onClick={(event) => {
                    rememberDialogOpener(event.currentTarget);
                    setCreatingObra(createBlankObra(data.obras));
                  }}
                >
                  <Plus aria-hidden="true" />
                  Nueva obra
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              )
            }
          />
        ) : (
          <>
            <div
              className={styles.tableRegion}
              role="region"
              aria-label="Tabla de obras"
              tabIndex={0}
            >
              <Table className={styles.table}>
                <TableHeader>
                  <TableRow>
                    <TableHead className={styles.selectionColumn}>
                      <Checkbox
                        checked={
                          allVisibleSelected
                            ? true
                            : someVisibleSelected
                              ? "indeterminate"
                              : false
                        }
                        aria-label={
                          allVisibleSelected
                            ? "Quitar selección de las obras visibles"
                            : "Seleccionar todas las obras visibles"
                        }
                        onCheckedChange={toggleVisibleSelection}
                      />
                    </TableHead>
                    {visibleColumns.map((column) => {
                      const isActiveSort = sort.columnId === column.id;
                      const SortIcon = !isActiveSort
                        ? ArrowUpDown
                        : sort.direction === "asc"
                          ? ArrowUp
                          : ArrowDown;
                      return (
                        <TableHead
                          key={column.id}
                          className={`${styles.tableHead} ${column.className ?? ""} ${column.numeric ? styles.numericCell : ""}`}
                          aria-sort={
                            isActiveSort
                              ? sort.direction === "asc"
                                ? "ascending"
                                : "descending"
                              : "none"
                          }
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            className={`${styles.sortButton} ${column.numeric ? styles.sortButtonNumeric : ""}`}
                            onClick={() => toggleSort(column.id)}
                            aria-label={`Ordenar por ${column.label}${isActiveSort ? (sort.direction === "asc" ? ", ascendente" : ", descendente") : ""}`}
                          >
                            <span>{column.label}</span>
                            <SortIcon aria-hidden="true" />
                          </Button>
                        </TableHead>
                      );
                    })}
                    <TableHead className={styles.actionsColumn}>
                      <span className={styles.srOnly}>Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.map((obra) => (
                    <TableRow
                      key={obra.id}
                      className={styles.tableRow}
                      data-state={selectedIds.has(obra.id) ? "selected" : undefined}
                      tabIndex={0}
                      aria-label={`Abrir General de ${obra.name}`}
                      onClick={() => openObra(obra.id)}
                      onKeyDown={(event) => handleRowKeyDown(event, obra.id)}
                    >
                      <TableCell
                        className={styles.selectionColumn}
                        onClick={stopRowNavigation}
                      >
                        <Checkbox
                          checked={selectedIds.has(obra.id)}
                          aria-label={`Seleccionar ${obra.name}`}
                          onCheckedChange={() => toggleRowSelection(obra.id)}
                        />
                      </TableCell>
                      {visibleColumns.map((column) => (
                        <TableCell
                          key={column.id}
                          className={`${styles.tableCell} ${column.className ?? ""} ${column.numeric ? styles.numericCell : ""}`}
                        >
                          {renderCell(column.id, obra)}
                        </TableCell>
                      ))}
                      <TableCell className={styles.actionsColumn} onClick={stopRowNavigation}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Editar ${obra.name}`}
                          onClick={(event) => {
                            rememberDialogOpener(event.currentTarget);
                            setEditingObra(obra);
                          }}
                        >
                          <Pencil aria-hidden="true" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className={styles.tableFooter}>
              <span>
                Mostrando {number(sortedRows.length)} de {number(data.obras.length)} obras
              </span>
            </div>
          </>
        )}
      </Panel>

      {editingObra ? (
        <ObraFormDialog
          key={editingObra.id}
          obra={editingObra}
          mode="edit"
          onCancel={() => setEditingObra(null)}
          onCloseAutoFocus={restoreDialogFocus}
          onSubmit={saveEdit}
        />
      ) : null}

      {creatingObra ? (
        <ObraFormDialog
          key={creatingObra.id}
          obra={creatingObra}
          mode="create"
          onCancel={() => setCreatingObra(null)}
          onCloseAutoFocus={restoreDialogFocus}
          onSubmit={addObra}
        />
      ) : null}

      <ImportCsvDialog
        open={importOpen}
        preview={importPreview}
        onCancel={() => setImportOpen(false)}
        onCloseAutoFocus={restoreDialogFocus}
        onConfirm={confirmImport}
      />
    </div>
  );
}
