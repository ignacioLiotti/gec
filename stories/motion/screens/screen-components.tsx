import React, { useState, type ReactNode } from "react";
import {
  FileText,
  FolderOpen,
  ArrowUpRight,
  Upload,
  Plus,
  Search,
  Pencil,
  ArrowLeft,
} from "lucide-react";
import { Button, ExpandableLightButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ExcelPageHeader,
  ExcelTableSurface,
} from "@/app/excel/_components/excel-page-chrome";
import { AdvanceCurveChart } from "@/components/advance-curve-chart-client";
import {
  SortableTable,
  type SortableColumn,
} from "../vendor/interior/components/interior/sortable-table";
import { Drawer } from "../vendor/interior/components/interior/drawer";
import { ScreenLoadingButton as LoadingButton } from "./app-chrome";
import { InlineValidation } from "../vendor/interior/components/interior/inline-validation";
import { Dropdown } from "../vendor/interior/components/interior/dropdown";
import { ProgressBar } from "../vendor/interior/components/interior/progress-bar";
import { ValueFlash } from "../vendor/interior/components/interior/value-flash";
import { Accordion } from "../vendor/interior/components/interior/accordion";
import { TreeView } from "../vendor/interior/components/interior/tree-view";
import { SegmentedControl } from "../vendor/beautiful/components/atoms/SegmentedControl";
import ToolChips, {
  type ToolStep,
} from "../vendor/beautiful/components/primitives/ToolChips";
import LoadingState from "../vendor/beautiful/components/primitives/LoadingState";
import { ReferenceSurface } from "../reference-runtime";
import {
  currency,
  compact,
  curve,
  folders,
  folderNames,
  type ObraExample,
  type DocumentExample,
} from "./fixtures";

const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 800));
const required = (value: string) =>
  value.trim().length < 3 ? "Ingresá al menos 3 caracteres." : null;

export function Panel({
  title,
  detail,
  children,
  action,
}: {
  title: string;
  detail?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="screen-panel">
      <header>
        <div>
          <h2>{title}</h2>
          {detail && <p>{detail}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function ExtractionTrace({
  complete = false,
  fileName = "Certificado 08 · Agosto.pdf",
}: {
  complete?: boolean;
  fileName?: string;
}) {
  const steps: ToolStep[] = [
    {
      icon: "read",
      label: "Leer documento",
      chip: fileName,
      mono: false,
      detailMono: false,
      detail: [{ text: "Documento de ejemplo" }],
    },
    {
      icon: "think",
      label: "Extraer campos",
      chip: "Campos identificados",
      mono: false,
      detailMono: false,
      detail: [
        { text: "Campos definidos en la carpeta de extracción." },
        { text: "El importe requiere revisión antes de confirmar." },
      ],
    },
    {
      icon: "write",
      label: complete ? "Revisión confirmada" : "Preparar revisión",
      chip: complete ? "Verificado" : "1 campo por revisar",
      mono: false,
      detailMono: false,
      detail: [
        {
          text: complete
            ? "Confirmación local del ejemplo; no se guardaron datos reales."
            : "Los datos permanecen pendientes de confirmación.",
        },
      ],
    },
  ];
  return (
    <ReferenceSurface library="beautiful" reduced={false}>
      <ToolChips
        key={String(complete)}
        steps={steps}
        diffs={[]}
        labels={{
          header: "Extracción de datos · 3 pasos",
          more: "Fin del ejemplo",
        }}
        className="screen-trace"
      />
    </ReferenceSurface>
  );
}

export function ExcelScreen({
  rows,
  onOpen,
  onCreate,
  fail,
}: {
  rows: ObraExample[];
  onOpen: (row: ObraExample) => void;
  onCreate: (name: string) => void;
  fail: boolean;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Todas");
  const [drawer, setDrawer] = useState<"new" | "import" | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const filtered = rows.filter(
    (row) =>
      row.name.toLowerCase().includes(search.toLowerCase()) &&
      (status === "Todas" || row.status === status),
  );
  const columns: SortableColumn<ObraExample>[] = [
    {
      id: "n",
      header: "N.º",
      width: "64px",
      numeric: true,
      value: (row) => row.n,
    },
    {
      id: "name",
      header: "Designación y ubicación",
      width: "30%",
      value: (row) => row.name,
      cell: (row) => (
        <Button variant="link" onClick={() => onOpen(row)}>
          {row.name}
          <ArrowUpRight size={13} />
        </Button>
      ),
    },
    { id: "client", header: "Entidad contratante", value: (row) => row.client },
    {
      id: "contract",
      header: "Contrato + ampliaciones",
      numeric: true,
      align: "end",
      value: (row) => row.contract,
      cell: (row) => compact(row.contract),
    },
    {
      id: "progress",
      header: "Avance",
      width: "100px",
      numeric: true,
      value: (row) => row.progress,
      cell: (row) => (
        <span className="screen-percent">
          {row.progress.toLocaleString("es-AR")}%
          <span style={{ width: `${row.progress}%` }} />
        </span>
      ),
    },
    {
      id: "status",
      header: "Estado",
      value: (row) => row.status,
      cell: (row) => (
        <Badge
          variant={
            row.status === "Finalizada"
              ? "success"
              : row.status === "En revisión"
                ? "warning"
                : "secondary"
          }
        >
          {row.status}
        </Badge>
      ),
    },
  ];
  async function create() {
    setError("");
    await pause();
    if (fail) throw new Error("No se pudo guardar la obra. Podés reintentar.");
    onCreate(drawer === "import" ? "Edificio Alameda · Etapa I" : name.trim());
    setDrawer(null);
    setName("");
  }
  return (
    <>
      <ExcelPageHeader
        title="Tus Obras"
        description="Seguimiento de contratos, certificaciones y avance de tus obras."
      />
      <div className="screen-metrics">
        <div>
          <span>Obras</span>
          <strong>{rows.length}</strong>
        </div>
        <div>
          <span>En ejecución</span>
          <strong>
            {rows.filter((row) => row.status === "En ejecución").length}
          </strong>
        </div>
        <div>
          <span>Contratado</span>
          <strong>
            {compact(rows.reduce((total, row) => total + row.contract, 0))}
          </strong>
        </div>
        <div>
          <span>Por revisar</span>
          <strong>
            {rows.filter((row) => row.status === "En revisión").length}
          </strong>
        </div>
      </div>
      <div className="screen-toolbar">
        <label className="screen-search">
          <Search size={15} />
          <Input
            aria-label="Buscar obras"
            placeholder="Buscar por designación o ubicación…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <Dropdown
          label="Estado de obra"
          value={status}
          onChange={setStatus}
          items={["Todas", "En ejecución", "En revisión", "Finalizada"].map(
            (value) => ({ value, label: value }),
          )}
        />
        <span className="screen-spacer" />
        <ExpandableLightButton
          label="Importar CSV"
          variant="default"
          onClick={() => {
            setDrawer("import");
            setError("");
          }}
        >
          <Upload />
        </ExpandableLightButton>
        <Button
          onClick={() => {
            setDrawer("new");
            setError("");
          }}
        >
          <Plus /> Nueva obra
        </Button>
      </div>
      <ExcelTableSurface>
        <div className="screen-table-scroll">
          {filtered.length ? (
            <SortableTable
              rows={filtered}
              columns={columns}
              getRowId={(row) => row.id}
              label="Tabla de obras"
              rowHeight={58}
            />
          ) : (
            <div className="screen-empty">
              <Search />
              <h2>Sin obras con estos filtros</h2>
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setStatus("Todas");
                }}
              >
                Limpiar filtros
              </Button>
            </div>
          )}
        </div>
        <p className="screen-caption">
          {filtered.length} de {rows.length} obras · Hacé clic en una cabecera
          para ordenar o en una obra para abrirla.
        </p>
      </ExcelTableSurface>
      <Drawer
        open={drawer !== null}
        onOpenChange={(open) => {
          if (!open) setDrawer(null);
        }}
        title={drawer === "import" ? "Revisar importación CSV" : "Nueva obra"}
        description="Datos locales del ejemplo de Storybook."
        closeLabel="Cerrar panel"
        width={420}
        footer={
          <LoadingButton
            disabled={drawer === "new" && !!required(name)}
            onAction={create}
            onError={(reason) => setError((reason as Error).message)}
            pendingLabel="Guardando…"
            successLabel="Guardado"
            errorLabel="Reintentar"
          >
            {drawer === "import" ? "Confirmar importación" : "Crear obra"}
          </LoadingButton>
        }
      >
        {drawer === "new" ? (
          <InlineValidation
            label="Designación y ubicación"
            value={name}
            onChange={setName}
            validate={required}
            placeholder="Ej. Edificio Alameda · Etapa I"
            required
          />
        ) : (
          <>
            <Badge variant="success">1 fila válida</Badge>
            <h3 className="mt-5 font-semibold">Edificio Alameda · Etapa I</h3>
            <p className="mt-2">
              La confirmación agrega una obra ficticia a esta tabla.
            </p>
            <ProgressBar
              value={100}
              label="Validación de filas"
              completeLabel="Lista para importar"
            />
          </>
        )}
        {error && (
          <p role="alert" className="screen-error">
            {error}
          </p>
        )}
      </Drawer>
    </>
  );
}

export function GeneralScreen({
  obra,
  onSave,
  fail,
}: {
  obra: ObraExample;
  onSave: (next: ObraExample) => void;
  fail: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(obra);
  const [error, setError] = useState("");
  const invalid =
    !!required(draft.name) ||
    !!required(draft.client) ||
    !Number.isFinite(draft.certified) ||
    draft.certified < 0 ||
    draft.certified > draft.contract;
  async function save() {
    setError("");
    await pause();
    if (fail)
      throw new Error(
        "No se pudieron guardar los cambios. El borrador sigue disponible.",
      );
    onSave(draft);
    setEditing(false);
  }
  return (
    <div className="screen-general">
      <Panel
        title="Información general"
        detail="Datos de obra y entidad contratante"
        action={
          <Button
            variant="outline"
            onClick={() => {
              setDraft(obra);
              setEditing(!editing);
              setError("");
            }}
          >
            {editing ? <ArrowLeft /> : <Pencil />}
            {editing ? "Cancelar edición" : "Editar datos"}
          </Button>
        }
      >
        {editing ? (
          <div className="screen-form">
            <InlineValidation
              label="Designación y ubicación"
              value={draft.name}
              onChange={(name) => setDraft({ ...draft, name })}
              validate={required}
              required
            />
            <InlineValidation
              label="Entidad contratante"
              value={draft.client}
              onChange={(client) => setDraft({ ...draft, client })}
              validate={required}
              required
            />
            <label className="screen-numeric-field">
              Certificado a la fecha (ARS)
              <Input
                type="number"
                min={0}
                max={draft.contract}
                value={draft.certified}
                onChange={(event) =>
                  setDraft({ ...draft, certified: Number(event.target.value) })
                }
              />
            </label>
            <LoadingButton
              disabled={invalid}
              onAction={save}
              onError={(reason) => setError((reason as Error).message)}
              pendingLabel="Guardando…"
              successLabel="Guardado"
              errorLabel="Reintentar"
            >
              Guardar cambios
            </LoadingButton>
            {error && (
              <p role="alert" className="screen-error">
                {error}
              </p>
            )}
          </div>
        ) : (
          <dl className="screen-fields">
            <div>
              <dt>Designación y ubicación</dt>
              <dd>{obra.name}</dd>
            </div>
            <div>
              <dt>Entidad contratante</dt>
              <dd>{obra.client}</dd>
            </div>
            <div>
              <dt>Superficie de obra</dt>
              <dd>{obra.area.toLocaleString("es-AR")} m²</dd>
            </div>
            <div>
              <dt>Mes básico de contrato</dt>
              <dd>Enero 2025</dd>
            </div>
          </dl>
        )}
      </Panel>
      <Panel
        title="Datos financieros"
        detail="Contrato y certificación acumulada"
      >
        <div className="screen-finance">
          <div>
            <span>Contrato + ampliaciones</span>
            <ValueFlash
              value={obra.contract}
              format={compact}
              label="Contrato + ampliaciones"
            />
          </div>
          <div>
            <span>Certificado a la fecha</span>
            <ValueFlash
              value={obra.certified}
              format={compact}
              label="Certificado a la fecha"
            />
          </div>
          <div>
            <span>Saldo a certificar</span>
            <ValueFlash
              value={obra.contract - obra.certified}
              format={compact}
              label="Saldo a certificar"
            />
          </div>
        </div>
      </Panel>
      <Panel title="Avance" detail="Seguimiento físico de la obra">
        <div className="screen-progress-value">
          {obra.progress.toLocaleString("es-AR")}%{" "}
          <Badge variant="secondary">{obra.status}</Badge>
        </div>
        <ProgressBar
          value={obra.progress}
          label="Avance físico"
          completeLabel="Obra finalizada"
        />
        <Accordion
          items={[
            {
              id: "plazo",
              title: "Plazos de obra",
              meta: "328 / 564 días",
              content: (
                <dl className="screen-fields">
                  <div>
                    <dt>Según contrato</dt>
                    <dd>540 días</dd>
                  </div>
                  <div>
                    <dt>Prórrogas acordadas</dt>
                    <dd>24 días</dd>
                  </div>
                  <div>
                    <dt>Plazo total</dt>
                    <dd>564 días</dd>
                  </div>
                </dl>
              ),
            },
          ]}
        />
      </Panel>
      <Panel
        title="Curva de avance"
        detail="Planificado y real · datos de ejemplo"
      >
        <AdvanceCurveChart
          points={curve.map((point, index) =>
            index === curve.length - 1
              ? { ...point, realPct: obra.progress }
              : point,
          )}
        />
      </Panel>
    </div>
  );
}

export function DocumentsScreen({
  docs,
  onVerify,
  fail,
}: {
  docs: DocumentExample[];
  onVerify: (id: string) => void;
  fail: boolean;
}) {
  const [folder, setFolder] = useState("certificados");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Todos");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const document = docs.find((doc) => doc.id === selected);
  const filtered = docs.filter(
    (doc) =>
      (folder === "all" || doc.folder === folder) &&
      doc.name.toLowerCase().includes(search.toLowerCase()) &&
      (status === "Todos" ||
        (status === "Por revisar"
          ? doc.status !== "Verificado"
          : doc.status === "Verificado")),
  );
  const columns: SortableColumn<DocumentExample>[] = [
    {
      id: "name",
      header: "Documento",
      width: "43%",
      value: (doc) => doc.name,
      cell: (doc) => (
        <Button
          variant="link"
          onClick={() => {
            setSelected(doc.id);
            setError("");
          }}
        >
          <FileText size={15} />
          {doc.name}
        </Button>
      ),
    },
    {
      id: "date",
      header: "Modificado",
      value: (doc) => doc.date.split("/").reverse().join("-"),
      cell: (doc) => doc.date,
    },
    { id: "size", header: "Tamaño", sortable: false, cell: (doc) => doc.size },
    {
      id: "status",
      header: "Extracción",
      value: (doc) => doc.status,
      cell: (doc) => (
        <Badge
          variant={
            doc.status === "Verificado"
              ? "success"
              : doc.status === "Revisar"
                ? "warning"
                : "secondary"
          }
        >
          {doc.status}
        </Badge>
      ),
    },
  ];
  async function verify() {
    if (!document) return;
    setBusy(true);
    setError("");
    try {
      await pause();
      if (fail)
        throw new Error("No se pudo confirmar la revisión. Volvé a intentar.");
      onVerify(document.id);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="screen-documents">
        <aside className="screen-folder-tree">
          <h2>Carpetas de obra</h2>
          <TreeView
            nodes={folders}
            label="Carpetas de documentos"
            defaultExpanded={["all"]}
            selected={folder}
            onSelectedChange={setFolder}
          />
          <p className="screen-caption">
            Las carpetas de extracción vinculan documentos y datos.
          </p>
        </aside>
        <div className="screen-document-content">
          <div className="screen-heading">
            <div>
              <p className="screen-caption">
                Documentos / {folderNames[folder]}
              </p>
              <h2>
                <FolderOpen size={21} />
                {folderNames[folder]}
              </h2>
            </div>
            <Badge variant="outline">{filtered.length} documentos</Badge>
          </div>
          <div className="screen-toolbar">
            <label className="screen-search">
              <Search size={15} />
              <Input
                aria-label="Buscar documentos"
                placeholder="Buscar documento…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <ReferenceSurface library="beautiful" reduced={false}>
              <SegmentedControl
                options={["Todos", "Por revisar", "Verificados"]}
                value={status}
                onChange={setStatus}
              />
            </ReferenceSurface>
          </div>
          <div className="screen-table-scroll">
            {filtered.length ? (
              <SortableTable
                rows={filtered}
                columns={columns}
                getRowId={(doc) => doc.id}
                label="Documentos de la carpeta"
                rowHeight={60}
              />
            ) : (
              <div className="screen-empty">
                <FileText />
                <h3>No hay documentos con estos filtros</h3>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setStatus("Todos");
                  }}
                >
                  Limpiar filtros
                </Button>
              </div>
            )}
          </div>
          <p className="screen-caption">
            Abrí un documento para revisar su extracción y confirmar los campos.
          </p>
        </div>
      </div>
      <Drawer
        open={!!document}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={document?.name ?? "Documento"}
        description="Vista de documento y datos extraídos · ejemplo local"
        closeLabel="Cerrar documento"
        width={540}
        footer={
          document && (
            <LoadingButton
              onAction={
                document.status === "Verificado"
                  ? () => setSelected(null)
                  : verify
              }
              onError={(reason) => setError((reason as Error).message)}
              pendingLabel="Confirmando…"
              successLabel="Verificado"
              errorLabel="Reintentar"
            >
              {document.status === "Verificado"
                ? "Volver a documentos"
                : "Confirmar revisión"}
            </LoadingButton>
          )
        }
      >
        {document && (
          <>
            <div className="screen-document-preview">
              <FileText size={28} />
              <strong>{document.name}</strong>
              <span>VISTA DE EJEMPLO · SIN ARCHIVO REAL</span>
              <div className="screen-paper-lines" />
            </div>
            <h3 className="mt-5 font-semibold">Datos extraídos</h3>
            <dl className="screen-fields">
              <div>
                <dt>Archivo</dt>
                <dd>{document.size}</dd>
              </div>
              <div>
                <dt>Importe detectado</dt>
                <dd>
                  {document.amount
                    ? currency(document.amount)
                    : "No corresponde"}
                </dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>
                  <Badge
                    variant={
                      document.status === "Verificado" ? "success" : "warning"
                    }
                  >
                    {document.status}
                  </Badge>
                </dd>
              </div>
            </dl>
            {busy ? (
              <ReferenceSurface library="beautiful" reduced={false}>
                <LoadingState label="Confirmando datos" variant="Dots" />
              </ReferenceSurface>
            ) : (
              <ExtractionTrace
                fileName={document.name}
                complete={document.status === "Verificado"}
              />
            )}
            {error && (
              <p role="alert" className="screen-error">
                {error}
              </p>
            )}
          </>
        )}
      </Drawer>
    </>
  );
}
