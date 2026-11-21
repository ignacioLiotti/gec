"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { Copy, Plus, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { PreviewDraftRow } from "../contracts";
import {
  formatAmount,
  getDraftTotals,
  type GenerationComposerProps,
} from "./generation-model";
import styles from "./generation-composer.module.css";

interface FieldProps {
  children: ReactNode;
  className?: string;
  error?: string;
  generationKey: string;
  hint?: string;
  id: string;
  label: string;
}

const getErrorId = (generationKey: string) =>
  `generation-error-${generationKey}`;

const getControlProps = (generationKey: string, error?: string) => ({
  "aria-describedby": error ? getErrorId(generationKey) : undefined,
  "aria-invalid": Boolean(error),
  "data-generation-key": generationKey,
});

const getRowFieldId = (rowId: string, field: keyof PreviewDraftRow) =>
  `generation-row-${rowId}-${field}`;

function Field({
  children,
  className,
  error,
  generationKey,
  hint,
  id,
  label,
}: FieldProps) {
  return (
    <div className={`${styles.field}${className ? ` ${className}` : ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className={styles.fieldError} id={getErrorId(generationKey)}>
          {error}
        </p>
      ) : hint ? (
        <p className={styles.fieldHint}>{hint}</p>
      ) : null}
    </div>
  );
}

const readNumber = (value: string) =>
  value === "" ? Number.NaN : Number(value);

const renderNumber = (value: number) =>
  Number.isFinite(value) ? value : "";

export function DocumentComposer({
  draft,
  errors,
  onFieldChange,
  onRowChange,
  onAddRow,
  onDuplicateRow,
  onRemoveRow,
  removedRow,
  onUndoRemove,
}: GenerationComposerProps) {
  const totals = getDraftTotals(draft);
  const rowsError = errors.rows;
  const itemCount = `${draft.rows.length} material${draft.rows.length === 1 ? "" : "es"}`;
  const discountHint =
    draft.discount > 0 && Number.isFinite(draft.discount)
      ? `Descuenta ${formatAmount(totals.discountAmount)} del subtotal.`
      : "Sin bonificación aplicada.";

  const addRowAndFocus = () => {
    const rowId = onAddRow();

    requestAnimationFrame(() => {
      document.getElementById(getRowFieldId(rowId, "description"))?.focus();
    });
  };

  const handleLastRowEnter = (
    event: KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
  ) => {
    if (
      event.key !== "Enter" ||
      event.nativeEvent.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      rowIndex !== draft.rows.length - 1
    ) {
      return;
    }

    event.preventDefault();
    addRowAndFocus();
  };

  return (
    <article className={styles.composer} aria-labelledby="generation-composer-title">
      <header className={styles.composerHeader}>
        <div>
          <h2 id="generation-composer-title">Contenido del documento</h2>
          <p>Completá los datos que aparecerán en el documento generado.</p>
        </div>
        <small>{itemCount}</small>
      </header>

      <section
        className={styles.section}
        id="gen-header"
        aria-labelledby="gen-header-heading"
      >
        <div className={styles.sectionHeading}>
          <span>01</span>
          <h3 id="gen-header-heading">Encabezado</h3>
        </div>
        <div className={styles.headerFields}>
          <Field
            id="generation-code"
            label="Número del documento"
            generationKey="code"
            error={errors.code}
          >
            <Input
              id="generation-code"
              value={draft.code}
              autoComplete="off"
              {...getControlProps("code", errors.code)}
              onChange={(event) => onFieldChange("code", event.target.value)}
            />
          </Field>
          <Field
            id="generation-date"
            label="Fecha"
            generationKey="date"
            error={errors.date}
          >
            <Input
              id="generation-date"
              type="date"
              value={draft.date}
              {...getControlProps("date", errors.date)}
              onChange={(event) => onFieldChange("date", event.target.value)}
            />
          </Field>
        </div>
      </section>

      <section
        className={styles.section}
        id="gen-supplier"
        aria-labelledby="gen-supplier-heading"
      >
        <div className={styles.sectionHeading}>
          <span>02</span>
          <h3 id="gen-supplier-heading">Proveedor</h3>
        </div>
        <div className={styles.supplierFields}>
          <Field
            id="generation-supplier"
            label="Proveedor"
            generationKey="supplier"
            error={errors.supplier}
          >
            <Input
              id="generation-supplier"
              value={draft.supplier}
              autoComplete="organization"
              {...getControlProps("supplier", errors.supplier)}
              onChange={(event) =>
                onFieldChange("supplier", event.target.value)
              }
            />
          </Field>
          <Field
            id="generation-tax-id"
            label="CUIT"
            generationKey="taxId"
            error={errors.taxId}
          >
            <Input
              id="generation-tax-id"
              value={draft.taxId}
              autoComplete="off"
              {...getControlProps("taxId", errors.taxId)}
              onChange={(event) => onFieldChange("taxId", event.target.value)}
            />
          </Field>
          <Field
            className={styles.fullWidthField}
            id="generation-address"
            label="Domicilio"
            generationKey="address"
            error={errors.address}
          >
            <Input
              id="generation-address"
              value={draft.address}
              autoComplete="street-address"
              {...getControlProps("address", errors.address)}
              onChange={(event) =>
                onFieldChange("address", event.target.value)
              }
            />
          </Field>
        </div>
      </section>

      <section
        className={styles.section}
        id="gen-items"
        aria-labelledby="gen-items-heading"
      >
        <div className={styles.itemsHeading}>
          <div className={styles.sectionHeading}>
            <span>03</span>
            <div>
              <h3 id="gen-items-heading">Materiales</h3>
              <small>{itemCount}</small>
            </div>
          </div>
          <Button
            className={styles.addButton}
            type="button"
            variant="outline"
            {...getControlProps("rows", rowsError)}
            onClick={addRowAndFocus}
          >
            <Plus aria-hidden="true" />
            Agregar material
          </Button>
        </div>

        {draft.rows.length > 0 ? (
          <div
            className={styles.materialsTable}
            role="table"
            aria-labelledby="gen-items-heading"
            aria-colcount={6}
            aria-rowcount={draft.rows.length + 1}
          >
            <div className={styles.tableHeader} role="row">
              <span role="columnheader">Descripción</span>
              <span role="columnheader">Cantidad</span>
              <span role="columnheader">Unidad</span>
              <span role="columnheader">Precio unitario</span>
              <span role="columnheader">Importe</span>
              <span role="columnheader" className={styles.actionsHeader}>
                Acciones
              </span>
            </div>
            <div className={styles.tableBody} role="rowgroup">
              {draft.rows.map((row, index) => {
                const descriptionKey = `row-${row.id}-description`;
                const quantityKey = `row-${row.id}-quantity`;
                const unitKey = `row-${row.id}-unit`;
                const priceKey = `row-${row.id}-price`;
                const rowName = row.description.trim() || "sin descripción";
                const rowAmount =
                  Number.isFinite(row.quantity) && Number.isFinite(row.price)
                    ? row.quantity * row.price
                    : 0;

                return (
                  <div className={styles.materialRow} role="row" key={row.id}>
                    <div
                      className={`${styles.tableCell} ${styles.descriptionCell}`}
                      role="cell"
                    >
                      <Field
                        className={styles.rowField}
                        id={getRowFieldId(row.id, "description")}
                        label="Descripción"
                        generationKey={descriptionKey}
                        error={errors[descriptionKey]}
                      >
                        <Input
                          id={getRowFieldId(row.id, "description")}
                          value={row.description}
                          {...getControlProps(
                            descriptionKey,
                            errors[descriptionKey],
                          )}
                          onChange={(event) =>
                            onRowChange(row.id, {
                              description: event.target.value,
                            })
                          }
                          onKeyDown={(event) =>
                            handleLastRowEnter(event, index)
                          }
                        />
                      </Field>
                    </div>
                    <div className={styles.tableCell} role="cell">
                      <Field
                        className={styles.rowField}
                        id={getRowFieldId(row.id, "quantity")}
                        label="Cantidad"
                        generationKey={quantityKey}
                        error={errors[quantityKey]}
                      >
                        <Input
                          id={getRowFieldId(row.id, "quantity")}
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={renderNumber(row.quantity)}
                          {...getControlProps(quantityKey, errors[quantityKey])}
                          onChange={(event) =>
                            onRowChange(row.id, {
                              quantity: readNumber(event.target.value),
                            })
                          }
                          onKeyDown={(event) =>
                            handleLastRowEnter(event, index)
                          }
                        />
                      </Field>
                    </div>
                    <div className={styles.tableCell} role="cell">
                      <Field
                        className={styles.rowField}
                        id={getRowFieldId(row.id, "unit")}
                        label="Unidad"
                        generationKey={unitKey}
                        error={errors[unitKey]}
                      >
                        <Input
                          id={getRowFieldId(row.id, "unit")}
                          value={row.unit}
                          autoComplete="off"
                          {...getControlProps(unitKey, errors[unitKey])}
                          onChange={(event) =>
                            onRowChange(row.id, { unit: event.target.value })
                          }
                          onKeyDown={(event) =>
                            handleLastRowEnter(event, index)
                          }
                        />
                      </Field>
                    </div>
                    <div className={styles.tableCell} role="cell">
                      <Field
                        className={styles.rowField}
                        id={getRowFieldId(row.id, "price")}
                        label="Precio unitario"
                        generationKey={priceKey}
                        error={errors[priceKey]}
                      >
                        <Input
                          id={getRowFieldId(row.id, "price")}
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={renderNumber(row.price)}
                          {...getControlProps(priceKey, errors[priceKey])}
                          onChange={(event) =>
                            onRowChange(row.id, {
                              price: readNumber(event.target.value),
                            })
                          }
                          onKeyDown={(event) =>
                            handleLastRowEnter(event, index)
                          }
                        />
                      </Field>
                    </div>
                    <div
                      className={`${styles.tableCell} ${styles.amountCell}`}
                      role="cell"
                    >
                      <span className={styles.mobileCellLabel}>Importe</span>
                      <output>{formatAmount(rowAmount)}</output>
                    </div>
                    <div
                      className={`${styles.tableCell} ${styles.actionsCell}`}
                      role="cell"
                    >
                      <span className={styles.mobileCellLabel}>Acciones</span>
                      <div className={styles.rowActions}>
                        <Button
                          className={styles.rowAction}
                          type="button"
                          variant="ghost"
                          aria-label={`Duplicar material ${index + 1}: ${rowName}`}
                          onClick={() => onDuplicateRow(row.id)}
                        >
                          <Copy aria-hidden="true" />
                          <span className={styles.actionText}>Duplicar</span>
                        </Button>
                        <Button
                          className={styles.rowAction}
                          type="button"
                          variant="destructiveSecondary"
                          aria-label={`Eliminar material ${index + 1}: ${rowName}`}
                          onClick={() => onRemoveRow(row.id)}
                        >
                          <Trash2 aria-hidden="true" />
                          <span className={styles.actionText}>Eliminar</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={styles.emptyRows}>
            <p>No hay materiales cargados.</p>
            <span>Agregá el primer material para completar el detalle.</span>
          </div>
        )}

        {rowsError ? (
          <p className={styles.sectionError} id={getErrorId("rows")}>
            {rowsError}
          </p>
        ) : null}

        {removedRow ? (
          <div className={styles.undoNotice} role="status" aria-live="polite">
            <span>
              Se eliminó <strong>{removedRow.row.description || "Material sin descripción"}</strong>.
            </span>
            <Button
              className={styles.undoButton}
              type="button"
              variant="ghost"
              onClick={onUndoRemove}
            >
              <RotateCcw aria-hidden="true" />
              Deshacer
            </Button>
          </div>
        ) : null}
      </section>

      <section
        className={styles.section}
        id="gen-conditions"
        aria-labelledby="gen-conditions-heading"
      >
        <div className={styles.sectionHeading}>
          <span>04</span>
          <h3 id="gen-conditions-heading">Condiciones</h3>
        </div>
        <div className={styles.conditionsFields}>
          <Field
            id="generation-notes"
            label="Notas"
            generationKey="notes"
            error={errors.notes}
          >
            <Textarea
              id="generation-notes"
              value={draft.notes}
              rows={3}
              {...getControlProps("notes", errors.notes)}
              onChange={(event) => onFieldChange("notes", event.target.value)}
            />
          </Field>
          <Field
            id="generation-discount"
            label="Bonificación (%)"
            generationKey="discount"
            error={errors.discount}
            hint={discountHint}
          >
            <Input
              id="generation-discount"
              type="number"
              min="0"
              max="100"
              step="0.01"
              inputMode="decimal"
              value={renderNumber(draft.discount)}
              {...getControlProps("discount", errors.discount)}
              onChange={(event) =>
                onFieldChange("discount", readNumber(event.target.value))
              }
            />
          </Field>
        </div>
      </section>
    </article>
  );
}
