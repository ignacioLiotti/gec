"use client";

import { useState } from "react";
import type { ComponentProps, FormEvent } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Eye,
  FileClock,
  Hash,
  History,
  MapPin,
  Pencil,
  Ruler,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  PREVIEW_TODAY,
  money,
  number,
  percent,
  type PreviewObra,
  type PreviewScreenProps,
} from "../contracts";
import { Curve, EmptyState, ObraHeader, Panel, Status } from "../shared";
import styles from "./general.module.css";

type GeneralPreviewProps = PreviewScreenProps & { obraId: string };
type ViewMode = "preview" | "edit" | "memory";

type EditDraft = {
  number: string;
  name: string;
  entity: string;
  area: string;
  baseMonth: string;
  startDate: string;
  contract: string;
  certified: string;
  progress: string;
  contractMonths: string;
  extensionMonths: string;
  elapsedMonths: string;
};

type EditFieldName = keyof EditDraft;
type EditErrors = Partial<Record<EditFieldName, string>>;

const MODE_OPTIONS: Array<{ value: ViewMode; label: string; icon: LucideIcon }> = [
  { value: "preview", label: "Vista previa", icon: Eye },
  { value: "edit", label: "Edición", icon: Pencil },
  { value: "memory", label: "Memoria", icon: History },
];

function createEditDraft(obra: PreviewObra): EditDraft {
  return {
    number: String(obra.number),
    name: obra.name,
    entity: obra.entity,
    area: String(obra.area),
    baseMonth: obra.baseMonth,
    startDate: obra.startDate,
    contract: String(obra.contract),
    certified: String(obra.certified),
    progress: String(obra.progress),
    contractMonths: String(obra.contractMonths),
    extensionMonths: String(obra.extensionMonths),
    elapsedMonths: String(obra.elapsedMonths),
  };
}

function parseDraftNumber(value: string) {
  if (value.trim() === "") return Number.NaN;
  return Number(value);
}

function nonNegativeError(value: string, label: string) {
  const parsed = parseDraftNumber(value);
  if (!Number.isFinite(parsed)) return `Ingresá un valor válido para ${label}.`;
  if (parsed < 0) return `${label} no puede ser negativo.`;
  return null;
}

function validateDraft(draft: EditDraft) {
  const errors: EditErrors = {};
  const contract = parseDraftNumber(draft.contract);
  const certified = parseDraftNumber(draft.certified);
  const progress = parseDraftNumber(draft.progress);

  if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
    errors.progress = "El avance debe estar entre 0 y 100.";
  }

  const fields: Array<[EditFieldName, string]> = [
    ["number", "el número de obra"],
    ["contract", "el contrato"],
    ["certified", "el certificado a la fecha"],
    ["area", "la superficie"],
    ["contractMonths", "el plazo de contrato"],
    ["extensionMonths", "las prórrogas"],
    ["elapsedMonths", "los meses transcurridos"],
  ];

  for (const [field, label] of fields) {
    const error = nonNegativeError(draft[field], label);
    if (error) errors[field] = error;
  }

  if (
    Number.isFinite(contract) &&
    Number.isFinite(certified) &&
    contract >= 0 &&
    certified > contract
  ) {
    errors.certified = "El certificado a la fecha no puede superar el contrato.";
  }

  if (!draft.name.trim()) errors.name = "Ingresá la designación de la obra.";
  if (!draft.entity.trim()) errors.entity = "Ingresá la entidad contratante.";
  if (!draft.baseMonth) errors.baseMonth = "Elegí el mes básico.";
  if (!draft.startDate) errors.startDate = "Elegí la fecha de inicio.";

  return errors;
}

function clampProgress(value: number) {
  return Math.min(100, Math.max(0, value));
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value || "Sin dato";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function customFieldLabel(value: string) {
  const withSpaces = value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function Fact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className={styles.fact}>
      <dt className={styles.factLabel}>
        <Icon aria-hidden="true" />
        {label}
      </dt>
      <dd className={styles.factValue}>{value}</dd>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metric}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ProgressOverview({ obra }: { obra: PreviewObra }) {
  const totalMonths = obra.contractMonths + obra.extensionMonths;
  const timeRatio = totalMonths > 0 ? (obra.elapsedMonths / totalMonths) * 100 : null;
  const lag = timeRatio == null ? null : timeRatio - obra.progress;

  return (
    <Panel
      title="Avance"
      actions={<Status tone="info">Progreso físico</Status>}
      className={styles.fillPanel}
    >
      <div className={styles.progressSummary}>
        <strong>{percent(obra.progress)}</strong>
        <span>de avance acumulado</span>
      </div>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-label="Avance físico de la obra"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clampProgress(obra.progress)}
      >
        <span style={{ width: `${clampProgress(obra.progress)}%` }} />
      </div>

      <div className={styles.alerts} aria-label="Alertas de avance">
        <span className={styles.sectionLabel}>Alertas detectadas</span>
        {timeRatio != null && lag != null && lag > 0.05 ? (
          <div className={styles.alertRow}>
            <AlertTriangle aria-hidden="true" />
            <p>
              El avance físico está {number(lag, 1)} puntos porcentuales por detrás del tiempo
              transcurrido ({percent(timeRatio)} del plazo).
            </p>
          </div>
        ) : timeRatio == null ? (
          <p className={styles.mutedCopy}>No hay plazo contractual suficiente para comparar el avance.</p>
        ) : (
          <p className={styles.mutedCopy}>No hay alertas abiertas para esta obra.</p>
        )}
      </div>
    </Panel>
  );
}

function CurvePanel({ obra }: { obra: PreviewObra }) {
  return (
    <Panel
      title="Curva de avance"
      description="Curva Plan vs. avance certificado"
      className={styles.fillPanel}
    >
      {obra.curve.length > 0 ? (
        <Curve points={obra.curve} />
      ) : (
        <EmptyState
          title="Sin curva de avance"
          description="No se detectaron datos suficientes de Curva Plan y certificados para construir la comparación."
        />
      )}
    </Panel>
  );
}

function CertificatesPanel({ obra }: { obra: PreviewObra }) {
  return (
    <Panel
      title="Certificados"
      actions={
        <Status tone="neutral">
          {obra.certificates.length} {obra.certificates.length === 1 ? "registro" : "registros"}
        </Status>
      }
      className={styles.fillPanel}
    >
      <div
        className={styles.tableRegion}
        role="region"
        aria-label="Certificados de la obra; desplazamiento horizontal disponible"
        tabIndex={0}
      >
        <Table className={styles.table}>
          <TableCaption>Certificados detectados para {obra.name}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>N° certificado</TableHead>
              <TableHead>N° expediente</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {obra.certificates.map((certificate) => (
              <TableRow key={certificate.id}>
                <TableCell className={styles.primaryCell}>{certificate.number || "Sin dato"}</TableCell>
                <TableCell>{certificate.expediente || "Sin dato"}</TableCell>
                <TableCell>{certificate.location || "Sin dato"}</TableCell>
                <TableCell>{certificate.period || "Sin dato"}</TableCell>
                <TableCell className={styles.numeric}>{money(certificate.amount)}</TableCell>
                <TableCell>
                  {certificate.pending ? (
                    <Status tone="warning">Pendiente de revisión</Status>
                  ) : certificate.paid ? (
                    <Status tone="success">Cobrado</Status>
                  ) : (
                    <Status tone="neutral">Pendiente de cobro</Status>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}

function FinancialPanel({ obra }: { obra: PreviewObra }) {
  const balance = obra.contract - obra.certified;
  const totalMonths = obra.contractMonths + obra.extensionMonths;
  const timeProgress = totalMonths > 0 ? (obra.elapsedMonths / totalMonths) * 100 : 0;

  return (
    <Panel title="Datos financieros" className={styles.fillPanel}>
      <dl className={styles.financeGrid}>
        <Metric label="Contrato + ampliaciones" value={money(obra.contract)} />
        <Metric label="Certificado a la fecha" value={money(obra.certified)} />
        <Metric label="Saldo a certificar" value={money(balance)} />
      </dl>
      <div className={styles.periodBlock}>
        <dl className={styles.periodGrid}>
          <Metric label="Según contrato" value={`${number(obra.contractMonths)} meses`} />
          <Metric label="Prórrogas" value={`${number(obra.extensionMonths)} meses`} />
          <Metric label="Transcurridos" value={`${number(obra.elapsedMonths)} meses`} />
        </dl>
        <div
          className={styles.timeTrack}
          role="progressbar"
          aria-label="Tiempo transcurrido del plazo contractual"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={clampProgress(timeProgress)}
        >
          <span style={{ width: `${clampProgress(timeProgress)}%` }} />
        </div>
        <p className={styles.periodNote}>
          {number(obra.elapsedMonths)} de {number(totalMonths)} meses transcurridos
        </p>
      </div>
    </Panel>
  );
}

function GeneralInformationPanel({ obra }: { obra: PreviewObra }) {
  return (
    <Panel title="Información general">
      <dl className={styles.infoGrid}>
        <Fact icon={MapPin} label="Designación y ubicación" value={obra.name || "No especificado"} />
        <Fact icon={Building2} label="Entidad contratante" value={obra.entity || "No especificado"} />
        <Fact icon={CalendarDays} label="Mes básico" value={obra.baseMonth || "No especificado"} />
        <Fact icon={CalendarDays} label="Iniciación" value={formatDate(obra.startDate)} />
        <Fact icon={Hash} label="N° de obra" value={`#${number(obra.number)}`} />
        <Fact icon={Ruler} label="Superficie" value={`${number(obra.area, 1)} m²`} />
      </dl>
    </Panel>
  );
}

function CustomFieldsPanel({ obra }: { obra: PreviewObra }) {
  const fields = Object.entries(obra.customFields);
  if (fields.length === 0) return null;

  return (
    <Panel title="Campos configurados">
      <dl className={styles.customGrid}>
        {fields.map(([key, value]) => (
          <div className={styles.customField} key={key}>
            <dt>{customFieldLabel(key)}</dt>
            <dd>{value || "Sin dato"}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function PreviewContent({ obra }: { obra: PreviewObra }) {
  const hasCertificates = obra.certificates.length > 0;

  return (
    <div className={styles.content}>
      <div className={styles.progressGrid}>
        <ProgressOverview obra={obra} />
        <CurvePanel obra={obra} />
      </div>

      <div className={hasCertificates ? styles.splitGrid : styles.stackGrid}>
        {hasCertificates ? <CertificatesPanel obra={obra} /> : null}
        <FinancialPanel obra={obra} />
        {!hasCertificates ? <GeneralInformationPanel obra={obra} /> : null}
      </div>

      {hasCertificates ? <GeneralInformationPanel obra={obra} /> : null}
      <CustomFieldsPanel obra={obra} />
    </div>
  );
}

type EditFieldProps = {
  name: EditFieldName;
  label: string;
  value: string;
  error?: string;
  onChange: (name: EditFieldName, value: string) => void;
  inputProps?: Omit<ComponentProps<typeof Input>, "id" | "name" | "value" | "onChange">;
};

function EditField({ name, label, value, error, onChange, inputProps }: EditFieldProps) {
  const errorId = `${name}-error`;

  return (
    <div className={styles.field}>
      <Label htmlFor={name}>{label}</Label>
      <Input
        {...inputProps}
        id={name}
        name={name}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={styles.control}
      />
      {error ? (
        <p className={styles.fieldError} id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function EditContent({
  obra,
  actions,
  onDone,
}: {
  obra: PreviewObra;
  actions: PreviewScreenProps["actions"];
  onDone: () => void;
}) {
  const [draft, setDraft] = useState(() => createEditDraft(obra));
  const [errors, setErrors] = useState<EditErrors>({});
  const initialDraft = createEditDraft(obra);
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(initialDraft);

  const updateDraft = (field: EditFieldName, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const cancel = () => {
    setDraft(initialDraft);
    setErrors({});
    onDone();
  };

  const save = () => {
    const nextErrors = validateDraft(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const contract = parseDraftNumber(draft.contract);
    const progress = parseDraftNumber(draft.progress);
    const certified = parseDraftNumber(draft.certified);

    actions.onSaveObra(obra.id, {
      number: parseDraftNumber(draft.number),
      name: draft.name.trim(),
      entity: draft.entity.trim(),
      area: parseDraftNumber(draft.area),
      baseMonth: draft.baseMonth,
      startDate: draft.startDate,
      contract,
      progress,
      certified,
      contractMonths: parseDraftNumber(draft.contractMonths),
      extensionMonths: parseDraftNumber(draft.extensionMonths),
      elapsedMonths: parseDraftNumber(draft.elapsedMonths),
    });
    onDone();
  };

  const preventSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const liveContract = parseDraftNumber(draft.contract);
  const liveCertified = parseDraftNumber(draft.certified);
  const displayedCertified = Number.isFinite(liveCertified) ? liveCertified : 0;
  const liveBalance =
    Number.isFinite(liveContract) && Number.isFinite(liveCertified)
      ? liveContract - liveCertified
      : 0;

  return (
    <form className={styles.editForm} onSubmit={preventSubmit} noValidate>
      <Panel
        title="Información general"
        description="Los cambios quedan en esta vista hasta que elijas Guardar cambios."
      >
        <div className={styles.formGrid}>
          <EditField name="name" label="Designación y ubicación" value={draft.name} error={errors.name} onChange={updateDraft} inputProps={{ required: true }} />
          <EditField name="entity" label="Entidad contratante" value={draft.entity} error={errors.entity} onChange={updateDraft} inputProps={{ required: true }} />
          <EditField name="number" label="N° de obra" value={draft.number} error={errors.number} onChange={updateDraft} inputProps={{ type: "number", min: 0, step: 1, inputMode: "numeric", required: true }} />
          <EditField name="area" label="Superficie (m²)" value={draft.area} error={errors.area} onChange={updateDraft} inputProps={{ type: "number", min: 0, step: "0.1", inputMode: "decimal", required: true }} />
          <EditField name="baseMonth" label="Mes básico" value={draft.baseMonth} error={errors.baseMonth} onChange={updateDraft} inputProps={{ type: "month", required: true }} />
          <EditField name="startDate" label="Fecha de inicio" value={draft.startDate} error={errors.startDate} onChange={updateDraft} inputProps={{ type: "date", required: true }} />
        </div>
      </Panel>

      <Panel title="Contrato y avance">
        <div className={styles.formGrid}>
          <EditField name="contract" label="Contrato + ampliaciones" value={draft.contract} error={errors.contract} onChange={updateDraft} inputProps={{ type: "number", min: 0, step: "0.01", inputMode: "decimal", required: true }} />
          <EditField name="certified" label="Certificado a la fecha" value={draft.certified} error={errors.certified} onChange={updateDraft} inputProps={{ type: "number", min: 0, max: draft.contract || undefined, step: "0.01", inputMode: "decimal", required: true }} />
          <EditField name="progress" label="Avance (%)" value={draft.progress} error={errors.progress} onChange={updateDraft} inputProps={{ type: "number", min: 0, max: 100, step: "0.1", inputMode: "decimal", required: true }} />
          <EditField name="contractMonths" label="Según contrato (meses)" value={draft.contractMonths} error={errors.contractMonths} onChange={updateDraft} inputProps={{ type: "number", min: 0, step: 1, inputMode: "numeric", required: true }} />
          <EditField name="extensionMonths" label="Prórrogas (meses)" value={draft.extensionMonths} error={errors.extensionMonths} onChange={updateDraft} inputProps={{ type: "number", min: 0, step: 1, inputMode: "numeric", required: true }} />
          <EditField name="elapsedMonths" label="Transcurridos (meses)" value={draft.elapsedMonths} error={errors.elapsedMonths} onChange={updateDraft} inputProps={{ type: "number", min: 0, step: 1, inputMode: "numeric", required: true }} />
        </div>
        <dl className={styles.derivedSummary} aria-label="Resumen financiero">
          <Metric label="Certificado a la fecha" value={money(displayedCertified)} />
          <Metric label="Saldo a certificar" value={money(liveBalance)} />
        </dl>
      </Panel>

      {Object.keys(errors).length > 0 ? (
        <div className={styles.formAlert} role="alert">
          <AlertTriangle aria-hidden="true" />
          Revisá los campos marcados antes de guardar.
        </div>
      ) : null}

      <div className={styles.formActions}>
        <Button type="button" variant="outline" size="lg" onClick={cancel}>
          Cancelar
        </Button>
        <Button type="button" size="lg" onClick={save} disabled={!hasChanges}>
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}

function MemoryContent({ obra }: { obra: PreviewObra }) {
  const firstCertificate = obra.certificates[0];
  const events = [
    {
      id: "progress",
      date: formatDate(PREVIEW_TODAY),
      title: "Avance actualizado",
      summary: `El avance acumulado quedó en ${percent(obra.progress)}.`,
      detail: `Con un contrato de ${money(obra.contract)}, el certificado a la fecha es ${money(obra.certified)} y el saldo pendiente es ${money(obra.contract - obra.certified)}.`,
    },
    firstCertificate
      ? {
          id: "certificate",
          date: firstCertificate.period || "Período sin dato",
          title: `Certificado ${firstCertificate.number}`,
          summary: firstCertificate.pending ? "Quedó pendiente de revisión." : "Se incorporó a la memoria de la obra.",
          detail: `Expediente ${firstCertificate.expediente || "sin dato"}, ${firstCertificate.location || "ubicación sin dato"}, por ${money(firstCertificate.amount)}.`,
        }
      : {
          id: "terms",
          date: formatDate(obra.startDate),
          title: "Condiciones contractuales",
          summary: "Se registraron el monto y el plazo de la obra.",
          detail: `${number(obra.contractMonths)} meses de contrato y ${number(obra.extensionMonths)} meses de prórroga.`,
        },
    {
      id: "start",
      date: formatDate(obra.startDate),
      title: "Inicio de obra",
      summary: `${obra.entity} registró el inicio del contrato.`,
      detail: `La obra #${number(obra.number)} inició con una superficie declarada de ${number(obra.area, 1)} m².`,
    },
  ];
  const [selectedId, setSelectedId] = useState(events[0].id);
  const selected = events.find((event) => event.id === selectedId) ?? events[0];

  return (
    <Panel
      title="Memoria de la obra"
      description="Historial local de ejemplo para revisar cómo se leerían los cambios relevantes."
      actions={<Status tone="info">Datos de ejemplo</Status>}
    >
      <div className={styles.memoryGrid}>
        <div className={styles.memoryList} role="list" aria-label="Eventos de la memoria">
          {events.map((event) => (
            <Button
              key={event.id}
              type="button"
              variant="ghost"
              className={styles.memoryItem}
              data-selected={event.id === selected.id}
              aria-pressed={event.id === selected.id}
              onClick={() => setSelectedId(event.id)}
            >
              <span>{event.date}</span>
              <strong>{event.title}</strong>
              <small>{event.summary}</small>
            </Button>
          ))}
        </div>
        <section className={styles.memoryDetail} aria-live="polite" aria-labelledby="memory-detail-title">
          <FileClock aria-hidden="true" />
          <span>{selected.date}</span>
          <h3 id="memory-detail-title">{selected.title}</h3>
          <p>{selected.detail}</p>
        </section>
      </div>
    </Panel>
  );
}

export function GeneralPreview({ data, actions, obraId }: GeneralPreviewProps) {
  const obra = data.obras.find((item) => item.id === obraId);
  const [mode, setMode] = useState<ViewMode>("preview");

  if (!obra) {
    return (
      <EmptyState
        title="Obra no disponible"
        description="La obra seleccionada no forma parte de los datos de esta vista previa."
        action={
          <Button type="button" size="lg" onClick={() => actions.onNavigate({ view: "obras" })}>
            Volver a Obras
          </Button>
        }
      />
    );
  }

  const chooseMode = (nextMode: ViewMode) => {
    setMode(nextMode);
  };

  return (
    <section className={styles.screen} aria-label="General de la obra">
      <ObraHeader obra={obra} view="general" actions={actions} />

      <div className={styles.modeBar} role="toolbar" aria-label="Modo de la vista General">
        {MODE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = mode === option.value;
          return (
            <Button
              key={option.value}
              type="button"
              variant={selected ? "default" : "ghost"}
              size="lg"
              aria-pressed={selected}
              aria-controls="general-mode-content"
              onClick={() => chooseMode(option.value)}
              className={styles.modeButton}
            >
              <Icon aria-hidden="true" />
              {option.label}
            </Button>
          );
        })}
      </div>

      <section id="general-mode-content" className={styles.modeContent}>
        {mode === "preview" ? <PreviewContent obra={obra} /> : null}
        {mode === "edit" ? (
          <EditContent key={obra.id} obra={obra} actions={actions} onDone={() => setMode("preview")} />
        ) : null}
        {mode === "memory" ? <MemoryContent obra={obra} /> : null}
      </section>
    </section>
  );
}
