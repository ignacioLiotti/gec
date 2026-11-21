import { useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  FileText,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  money,
  number,
  percent,
  PREVIEW_TODAY,
  type PreviewObra,
  type PreviewScreenProps,
} from "../contracts";
import { Curve, EmptyState, PageHeading, Panel, Status } from "../shared";
import styles from "./dashboard.module.css";

function getScheduleProgress(obra: PreviewObra) {
  const totalMonths = obra.contractMonths + obra.extensionMonths;
  if (totalMonths <= 0) return null;
  return {
    totalMonths,
    elapsedPercent: (obra.elapsedMonths / totalMonths) * 100,
  };
}

export function DashboardPreview({ data, actions }: PreviewScreenProps) {
  const [tab, setTab] = useState("summary");
  const [selectedId, setSelectedId] = useState(data.obras[0]?.id);
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEntity, setNewEntity] = useState("");
  const [fileId, setFileId] = useState<string | null>(null);
  const newObraTriggerRef = useRef<HTMLButtonElement>(null);
  const fileTriggerRef = useRef<HTMLButtonElement>(null);
  const selected = data.obras.find((o) => o.id === selectedId) || data.obras[0];
  const active = data.obras.filter((o) => o.progress < 100);
  const completed = data.obras.length - active.length;
  const behind = active.flatMap((obra) => {
    const schedule = getScheduleProgress(obra);
    return schedule && schedule.elapsedPercent - obra.progress > 10
      ? [{ obra, schedule }]
      : [];
  });
  const file = data.globalFiles.find((f) => f.id === fileId);
  const selectedSchedule = selected ? getScheduleProgress(selected) : null;
  return (
    <div className={styles.root}>
      <PageHeading
        title="Panel de Control"
        description={`Resumen de ${data.obras.length} obras cargadas.`}
        actions={
          <div className={styles.headerCounts}>
            <Status tone="neutral">{active.length} activas</Status>
            <Status tone="success">{completed} completadas</Status>
          </div>
        }
      />
      <div className={styles.tabs} role="tablist" aria-label="Panel de control">
        {[
          { id: "summary", label: "Resumen" },
          { id: "files", label: "Archivos globales" },
          { id: "policies", label: "Pólizas de seguro" },
        ].map((t) => (
          <button
            type="button"
            role="tab"
            id={`dashboard-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`dashboard-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setSearch("");
            }}
            onKeyDown={(event) => {
              if (event.key !== "ArrowRight" && event.key !== "ArrowLeft")
                return;
              event.preventDefault();
              const ids = ["summary", "files", "policies"];
              const next =
                ids[
                  (ids.indexOf(tab) + (event.key === "ArrowRight" ? 1 : 2)) % 3
                ];
              setTab(next);
              setSearch("");
              document.getElementById(`dashboard-tab-${next}`)?.focus();
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "summary" && (
        <div
          className={styles.layout}
          role="tabpanel"
          id="dashboard-panel-summary"
          aria-labelledby="dashboard-tab-summary"
        >
          <Panel
            className={styles.overview}
            title="Obras y Vista Previa"
            description="Estado operativo y avance de tu cartera"
            actions={
              <div className={styles.actions}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => actions.onNavigate({ view: "obras" })}
                >
                  Ver todas
                  <ArrowUpRight />
                </Button>
                <Button
                  ref={newObraTriggerRef}
                  size="sm"
                  onClick={() => setNewOpen(true)}
                >
                  <Plus />
                  Nueva obra
                </Button>
              </div>
            }
          >
            <div className={styles.workspace}>
              <div className={styles.projects}>
                <p className={styles.smallLabel}>Obras recientes</p>
                {data.obras.slice(0, 5).map((obra) => (
                  <button
                    className={styles.project}
                    type="button"
                    key={obra.id}
                    aria-pressed={selected?.id === obra.id}
                    onClick={() => setSelectedId(obra.id)}
                  >
                    <span className={styles.projectNumber}>
                      {String(obra.number).padStart(2, "0")}
                    </span>
                    <span className={styles.projectInfo}>
                      <strong>{obra.name}</strong>
                      <span>{obra.entity}</span>
                      <span className={styles.progressTrack}>
                        <i style={{ width: `${obra.progress}%` }} />
                      </span>
                    </span>
                    <span className={styles.projectPercent}>
                      {percent(obra.progress)}
                    </span>
                  </button>
                ))}
              </div>
              {selected && (
                <div className={styles.selected}>
                  <div className={styles.selectedHeading}>
                    <div>
                      <p className={styles.smallLabel}>
                        Obra N° {selected.number}
                      </p>
                      <h3>{selected.name}</h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Abrir ${selected.name}`}
                      onClick={() =>
                        actions.onNavigate({
                          view: "general",
                          obraId: selected.id,
                        })
                      }
                    >
                      <ArrowUpRight />
                    </Button>
                  </div>
                  <div className={styles.metrics}>
                    <div>
                      <span>Saldo a certificar</span>
                      <strong>
                        {money(selected.contract - selected.certified)}
                      </strong>
                      <small>Contrato {money(selected.contract)}</small>
                    </div>
                    <div>
                      <span>Certificado / contrato</span>
                      <strong>
                        {selected.contract > 0
                          ? percent(
                              (selected.certified / selected.contract) * 100,
                            )
                          : "Sin contrato"}
                      </strong>
                      <small>{money(selected.certified)} certificados</small>
                    </div>
                  </div>
                  <div className={styles.selectedMeta}>
                    <span>
                      <Building2 />
                      {number(selected.area)} m²
                    </span>
                    <span>
                      {selectedSchedule
                        ? `${selected.elapsedMonths} de ${selectedSchedule.totalMonths} meses`
                        : "Plazo no disponible"}
                    </span>
                  </div>
                  <div className={styles.curveHeading}>
                    <h4>Curva de avance</h4>
                    <span>Acumulado · 2026</span>
                  </div>
                  <Curve points={selected.curve} />
                  <Button
                    variant="link"
                    className={styles.openLink}
                    onClick={() =>
                      actions.onNavigate({
                        view: "general",
                        obraId: selected.id,
                      })
                    }
                  >
                    Abrir detalle de la obra
                    <ArrowRight />
                  </Button>
                </div>
              )}
            </div>
          </Panel>
          <aside className={styles.side}>
            <Panel
              title="Requieren Atención"
              description={`${behind.length} obras con desvíos de avance`}
              actions={
                <span className={styles.attentionCount}>{behind.length}</span>
              }
            >
              <div className={styles.alerts}>
                {behind.length ? (
                  behind.map(({ obra, schedule }) => (
                    <button
                      type="button"
                      key={obra.id}
                      onClick={() =>
                        actions.onNavigate({ view: "general", obraId: obra.id })
                      }
                    >
                      <strong>{obra.name}</strong>
                      <span>
                        <Status tone="warning">
                          Desvío{" "}
                          {number(
                            schedule.elapsedPercent - obra.progress,
                            1,
                          )}{" "}
                          pp
                        </Status>
                        <ArrowUpRight />
                      </span>
                      <small>
                        Avance {percent(obra.progress)} · plazo{" "}
                        {percent(schedule.elapsedPercent)}
                      </small>
                    </button>
                  ))
                ) : (
                  <EmptyState title="Sin desvíos abiertos" />
                )}
              </div>
            </Panel>
            <Panel
              title="Distribución de Avance"
              description="Obras por rango de ejecución"
            >
              <div className={styles.distribution}>
                {[
                  { label: "0–25%", min: 0, max: 25 },
                  { label: "26–50%", min: 25, max: 50 },
                  { label: "51–75%", min: 50, max: 75 },
                  { label: "76–99%", min: 75, max: 99.99 },
                  { label: "Completadas", min: 99.99, max: 100 },
                ].map((range, i) => {
                  const count = data.obras.filter(
                    (o) =>
                      o.progress >= range.min &&
                      (i === 0
                        ? o.progress <= range.max
                        : o.progress > range.min && o.progress <= range.max),
                  ).length;
                  return (
                    <div key={range.label}>
                      <span>{range.label}</span>
                      <div>
                        <i
                          style={{
                            width: `${data.obras.length ? (count / data.obras.length) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <strong>{count}</strong>
                    </div>
                  );
                })}
              </div>
              <p className={styles.distributionTotal}>
                {data.obras.length} obras en total
              </p>
            </Panel>
          </aside>
        </div>
      )}
      {tab !== "summary" && (
        <div
          role="tabpanel"
          id={`dashboard-panel-${tab}`}
          aria-labelledby={`dashboard-tab-${tab}`}
        >
          <Panel
            title={tab === "files" ? "Archivos globales" : "Pólizas de seguro"}
            description={
              tab === "files"
                ? "Documentación compartida de la organización"
                : "Vigencia de las coberturas por obra"
            }
            actions={
              <div className={styles.search}>
                <Search />
                <Input
                  aria-label={
                    tab === "files"
                      ? "Buscar archivos globales"
                      : "Buscar pólizas"
                  }
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            }
          >
            <div
              className={styles.tableRegion}
              role="region"
              aria-label={
                tab === "files" ? "Archivos globales" : "Pólizas de seguro"
              }
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    {(tab === "files"
                      ? ["Archivo", "Categoría", "Actualizado", "Tamaño", ""]
                      : [
                          "Obra",
                          "Cobertura",
                          "Aseguradora",
                          "Vencimiento",
                          "Estado",
                        ]
                    ).map((label, i) => (
                      <th key={i}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tab === "files"
                    ? data.globalFiles
                        .filter((f) =>
                          `${f.name} ${f.category}`
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                        )
                        .map((f) => (
                          <tr key={f.id}>
                            <td>
                              <FileText />
                              {f.name}
                            </td>
                            <td>{f.category}</td>
                            <td>{f.date}</td>
                            <td>{f.size}</td>
                            <td>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(event) => {
                                  fileTriggerRef.current = event.currentTarget;
                                  setFileId(f.id);
                                }}
                              >
                                Ver archivo
                                <ArrowUpRight />
                              </Button>
                            </td>
                          </tr>
                        ))
                    : data.policies
                        .filter((p) =>
                          `${p.company} ${p.type} ${data.obras.find((o) => o.id === p.obraId)?.name}`
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                        )
                        .map((p) => (
                          <tr key={p.id}>
                            <td>
                              <Button
                                variant="link"
                                onClick={() =>
                                  actions.onNavigate({
                                    view: "general",
                                    obraId: p.obraId,
                                  })
                                }
                              >
                                {
                                  data.obras.find((o) => o.id === p.obraId)
                                    ?.name
                                }
                              </Button>
                            </td>
                            <td>
                              {p.type}
                              <small>{p.number}</small>
                            </td>
                            <td>{p.company}</td>
                            <td>{p.expires}</td>
                            <td>
                              <Status
                                tone={
                                  p.status === "expired"
                                    ? "danger"
                                    : p.status === "warning"
                                      ? "warning"
                                      : "success"
                                }
                              >
                                {p.status === "expired"
                                  ? "Vencida"
                                  : p.status === "warning"
                                    ? "Por vencer"
                                    : "Vigente"}
                              </Status>
                            </td>
                          </tr>
                        ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            newObraTriggerRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>Nueva obra</DialogTitle>
            <DialogDescription>
              Se agrega una obra ficticia a esta sesión de comparación.
            </DialogDescription>
          </DialogHeader>
          <form
            className="gp-dialog-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!newName.trim() || !newEntity.trim()) return;
              const id = `obra-${crypto.randomUUID()}`;
              actions.onAddObra({
                id,
                number: Math.max(0, ...data.obras.map((o) => o.number)) + 1,
                name: newName.trim(),
                entity: newEntity.trim(),
                area: 0,
                baseMonth: "2026-10",
                startDate: PREVIEW_TODAY,
                contract: 0,
                progress: 0,
                certified: 0,
                contractMonths: 12,
                extensionMonths: 0,
                elapsedMonths: 0,
                curve: [],
                certificates: [],
                customFields: {},
              });
              setSelectedId(id);
              setNewOpen(false);
              setNewName("");
              setNewEntity("");
            }}
          >
            <label>
              Designación y ubicación
              <Input
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>
            <label>
              Entidad contratante
              <Input
                required
                value={newEntity}
                onChange={(e) => setNewEntity(e.target.value)}
              />
            </label>
            <div className={styles.actions}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">Crear obra de ejemplo</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(file)}
        onOpenChange={(open) => !open && setFileId(null)}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            fileTriggerRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{file?.name}</DialogTitle>
            <DialogDescription>
              Archivo ficticio de {file?.category}. Actualizado el {file?.date}.
            </DialogDescription>
          </DialogHeader>
          <EmptyState
            title="Vista previa de ejemplo"
            description="Este registro representa un archivo compartido de la organización. No contiene documentación del tenant."
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
