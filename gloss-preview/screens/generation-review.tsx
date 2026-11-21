"use client";

import { useEffect, useRef } from "react";
import { CircleAlert, FileCheck2, FolderOpen, PencilLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { PreviewDraft } from "../contracts";
import { number } from "../contracts";
import { formatAmount, getDraftTotals } from "./generation-model";
import type { ReviewSheetProps } from "./generation-review-contract";
import styles from "./generation-review.module.css";

const formatDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-");
  return day && month && year ? `${day}/${month}/${year}` : isoDate;
};

const amountOrDash = (value: number) => (Number.isFinite(value) ? formatAmount(value) : "—");

function PaperValue({ value }: { value: string }) {
  if (value.trim()) return <>{value}</>;
  return <span className={styles.paperMissing}>Sin completar</span>;
}

export function DocumentPaper({
  draft,
  obraName,
  templateName,
}: {
  draft: PreviewDraft;
  obraName: string;
  templateName: string;
}) {
  const totals = getDraftTotals(draft);

  return (
    <div className={styles.paperFrame}>
      <article className={styles.paper} aria-label={`${templateName || "Documento"} ${draft.code}`}>
        <header className={styles.paperHeader}>
          <div className={styles.paperIdentity}>
            <p className={styles.paperKicker}>Síntesis · Documento de obra</p>
            <h3>{templateName || "Documento comercial"}</h3>
            <p>{obraName || <span className={styles.paperMissing}>Obra sin seleccionar</span>}</p>
          </div>
          <dl className={styles.paperReference}>
            <div>
              <dt>N.º</dt>
              <dd><PaperValue value={draft.code} /></dd>
            </div>
            <div>
              <dt>Fecha</dt>
              <dd><PaperValue value={formatDate(draft.date)} /></dd>
            </div>
          </dl>
        </header>

        <section className={styles.paperParties} aria-label="Proveedor">
          <p className={styles.paperKicker}>Proveedor</p>
          <dl>
            <div className={styles.paperSupplier}>
              <dt>Razón social</dt>
              <dd><PaperValue value={draft.supplier} /></dd>
            </div>
            <div>
              <dt>CUIT</dt>
              <dd><PaperValue value={draft.taxId} /></dd>
            </div>
            <div>
              <dt>Domicilio</dt>
              <dd><PaperValue value={draft.address} /></dd>
            </div>
          </dl>
        </section>

        <div
          className={styles.paperItems}
          role="region"
          aria-label="Materiales del documento"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Descripción</th>
                <th scope="col">Cantidad</th>
                <th scope="col">Unidad</th>
                <th scope="col">Precio unitario</th>
                <th scope="col">Importe</th>
              </tr>
            </thead>
            <tbody>
              {draft.rows.map((row, index) => (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td><PaperValue value={row.description} /></td>
                  <td>{Number.isFinite(row.quantity) ? number(row.quantity, 2) : "—"}</td>
                  <td><PaperValue value={row.unit} /></td>
                  <td>{amountOrDash(row.price)}</td>
                  <td>{amountOrDash(row.quantity * row.price)}</td>
                </tr>
              ))}
              {draft.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.paperEmptyRows}>Sin materiales cargados.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <section className={styles.paperClosing}>
          <div className={styles.paperNotes}>
            <p className={styles.paperKicker}>Condiciones</p>
            <p>{draft.notes.trim() || "Sin condiciones adicionales."}</p>
          </div>
          <dl className={styles.paperTotals}>
            <div>
              <dt>Subtotal</dt>
              <dd>{formatAmount(totals.subtotal)}</dd>
            </div>
            <div>
              <dt>Bonificación {Number.isFinite(draft.discount) ? number(draft.discount, 2) : "—"}%</dt>
              <dd>−{formatAmount(totals.discountAmount)}</dd>
            </div>
            <div className={styles.paperTotal}>
              <dt>Total</dt>
              <dd>{formatAmount(totals.total)}</dd>
            </div>
          </dl>
        </section>

        <footer className={styles.paperSignature}>
          <span>Firma y aclaración</span>
          <span>Recibí conforme</span>
        </footer>
      </article>
    </div>
  );
}

export function ReviewSheet({
  open,
  onOpenChange,
  stage,
  draft,
  obraName,
  templateName,
  folderName,
  issues,
  generatedDocument,
  onGenerate,
  onFixPending,
  onOpenDocument,
  returnFocusRef,
}: ReviewSheetProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const isGenerated = stage === "generated";
  const pendingLabel = `${issues.length} pendiente${issues.length === 1 ? "" : "s"}`;
  const paperDraft = (isGenerated ? generatedDocument?.content : undefined) ?? draft;

  // The title names the stage; focusing it announces the switch from review to the generated result.
  useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [open, stage]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={styles.sheet}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          // A pending-field fix may already have focused its input; keep that focus.
          const focused = document.activeElement;
          const opener = returnFocusRef.current;
          if (focused && focused !== document.body) {
            event.preventDefault();
          } else if (opener?.isConnected && opener.checkVisibility()) {
            event.preventDefault();
            opener.focus();
          }
          // Otherwise Radix restores the element that was focused when the sheet opened.
        }}
      >
        <DialogHeader className={styles.sheetHeader}>
          <DialogTitle ref={titleRef} tabIndex={-1} className={styles.sheetTitle}>
            {isGenerated ? "Documento generado" : "Revisar documento"}
          </DialogTitle>
          <DialogDescription>
            {isGenerated
              ? "Representación HTML ficticia creada solo en esta vista previa local."
              : "Vista de solo lectura con los datos actuales del borrador."}
          </DialogDescription>
        </DialogHeader>

        <div className={styles.sheetBody}>
          {isGenerated ? (
            <section className={styles.result} aria-label="Resultado de la generación">
              <FileCheck2 aria-hidden="true" className={styles.resultIcon} />
              <div className={styles.resultText}>
                <span className="gp-status" data-tone="warning">
                  <span aria-hidden="true" />
                  Pendiente de revisión
                </span>
                <strong>{generatedDocument?.name ?? `${draft.code}.html`}</strong>
                <span>
                  {obraName} · Carpeta {folderName}
                </span>
                <small>
                  Es un documento HTML de ejemplo. Queda en Documentos esperando revisión; no se
                  envió ni se guardó fuera de esta sesión.
                </small>
              </div>
            </section>
          ) : issues.length > 0 ? (
            <section className={styles.issues} aria-labelledby="review-issues-title">
              <h3 id="review-issues-title">
                <CircleAlert aria-hidden="true" />
                {pendingLabel} antes de generar
              </h3>
              <ul>
                {issues.map((issue) => (
                  <li key={issue.key}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={styles.issueLink}
                      onClick={() => onFixPending(issue.key)}
                    >
                      {issue.message}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <DocumentPaper draft={paperDraft} obraName={obraName} templateName={templateName} />
        </div>

        <DialogFooter className={styles.sheetFooter}>
          {isGenerated ? (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                <PencilLine aria-hidden="true" />
                Seguir editando
              </Button>
              <Button type="button" onClick={onOpenDocument}>
                <FolderOpen aria-hidden="true" />
                Abrir en Documentos
              </Button>
            </>
          ) : (
            <>
              <p className={styles.footerNote} data-pending={issues.length > 0}>
                {issues.length > 0 ? pendingLabel : "Listo para generar"}
              </p>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Seguir editando
              </Button>
              {issues.length > 0 ? (
                <Button type="button" onClick={() => onFixPending(issues[0]?.key)}>
                  <PencilLine aria-hidden="true" />
                  Corregir {pendingLabel}
                </Button>
              ) : (
                <Button type="button" onClick={onGenerate}>
                  <FileCheck2 aria-hidden="true" />
                  Generar documento
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
