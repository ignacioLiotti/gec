"use client";

import {
  ArrowUpRight,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Eye,
  FileText,
  Save,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import { number } from "../contracts";
import { formatAmount } from "./generation-model";
import type {
  GenerationSectionStatus,
  ReadinessRailProps,
} from "./generation-review-contract";
import styles from "./generation-rail.module.css";

const plural = (count: number, singular: string, pluralForm: string) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

const formatDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-");
  return day && month && year ? `${day}/${month}/${year}` : isoDate;
};

function SectionState({
  section,
  attempted,
}: {
  section: GenerationSectionStatus;
  attempted: boolean;
}) {
  if (section.pending === 0) {
    return (
      <span className={styles.sectionState} data-tone="complete">
        <CircleCheck aria-hidden="true" />
        Completo
      </span>
    );
  }
  if (attempted) {
    return (
      <span className={styles.sectionState} data-tone="danger">
        <CircleAlert aria-hidden="true" />
        {section.pending} por corregir
      </span>
    );
  }
  return (
    <span className={styles.sectionState} data-tone="pending">
      <CircleDashed aria-hidden="true" />
      {plural(section.pending, "pendiente", "pendientes")}
    </span>
  );
}

export function ReadinessRail({
  sections,
  attempted,
  errorCount,
  totals,
  discount,
  destination,
  saveState,
  lastGenerated,
  onReview,
  onSave,
  onFocusSection,
  onFocusFirstError,
  onOpenGenerated,
}: ReadinessRailProps) {
  const completeCount = sections.filter((section) => section.pending === 0).length;

  return (
    <aside className={styles.rail} aria-label="Estado del documento">
      <section className={styles.totals} aria-labelledby="rail-total-label">
        <p id="rail-total-label" className={styles.eyebrow}>Total</p>
        <p className={styles.total}>{formatAmount(totals.total)}</p>
        <dl className={styles.breakdown}>
          <div>
            <dt>Subtotal</dt>
            <dd>{formatAmount(totals.subtotal)}</dd>
          </div>
          <div>
            <dt>Bonificación {number(discount, 2)}%</dt>
            <dd>−{formatAmount(totals.discountAmount)}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.block} aria-labelledby="rail-completeness">
        <div className={styles.blockHeader}>
          <h2 id="rail-completeness">Completitud</h2>
          <span>{completeCount} de {sections.length}</span>
        </div>
        <ol className={styles.sectionList}>
          {sections.map((section) => (
            <li key={section.id}>
              <Button
                type="button"
                variant="ghost"
                className={styles.sectionButton}
                onClick={() => onFocusSection(section.id)}
              >
                <span className={styles.sectionLabel}>{section.label}</span>
                <SectionState section={section} attempted={attempted} />
              </Button>
            </li>
          ))}
        </ol>
        {attempted && errorCount > 0 ? (
          <Button
            type="button"
            variant="link"
            size="sm"
            className={styles.firstError}
            onClick={onFocusFirstError}
          >
            Ir al primer campo con error ({errorCount})
          </Button>
        ) : null}
      </section>

      <section className={styles.block} aria-labelledby="rail-destination">
        <div className={styles.blockHeader}>
          <h2 id="rail-destination">Destino</h2>
        </div>
        <dl className={styles.destination}>
          <div>
            <dt>Obra</dt>
            <dd>{destination.obraName || "Sin obra"}</dd>
          </div>
          <div>
            <dt>Carpeta</dt>
            <dd>{destination.folderName || "Sin carpeta"}</dd>
          </div>
          <div>
            <dt>Archivo</dt>
            <dd className={styles.fileName}>{destination.fileName}</dd>
          </div>
        </dl>
      </section>

      <div className={styles.actions}>
        <Button type="button" size="lg" className={styles.action} onClick={onReview}>
          <Eye aria-hidden="true" />
          Revisar documento
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className={styles.action}
          onClick={onSave}
        >
          <Save aria-hidden="true" />
          Guardar borrador
        </Button>
      </div>
      <p role="status" className={styles.saveState} data-state={saveState}>
        <span aria-hidden="true" />
        {saveState === "saved" ? "Borrador guardado" : "Cambios sin guardar"}
      </p>

      {lastGenerated ? (
        <section className={styles.block} aria-labelledby="rail-last-generated">
          <div className={styles.blockHeader}>
            <h2 id="rail-last-generated">Último generado</h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            className={styles.generatedLink}
            onClick={onOpenGenerated}
          >
            <FileText aria-hidden="true" />
            <span className={styles.generatedText}>
              <strong>{lastGenerated.name}</strong>
              <small>{formatDate(lastGenerated.date)} · Pendiente de revisión</small>
            </span>
            <ArrowUpRight aria-hidden="true" />
          </Button>
        </section>
      ) : null}
    </aside>
  );
}

export function MobileReviewBar({
  total,
  pending,
  onReview,
  onSave,
}: {
  total: number;
  pending: number;
  onReview: () => void;
  onSave: () => void;
}) {
  return (
    <div className={styles.mobileBar} role="region" aria-label="Acciones del documento">
      <div className={styles.mobileSummary}>
        <strong>{formatAmount(total)}</strong>
        <span data-pending={pending > 0}>
          {pending > 0 ? plural(pending, "pendiente", "pendientes") : "Listo para revisar"}
        </span>
      </div>
      <div className={styles.mobileActions}>
        <Button type="button" variant="outline" className={styles.mobileAction} onClick={onSave}>
          <Save aria-hidden="true" />
          Guardar
        </Button>
        <Button type="button" className={styles.mobileAction} onClick={onReview}>
          <Eye aria-hidden="true" />
          Revisar
        </Button>
      </div>
    </div>
  );
}
