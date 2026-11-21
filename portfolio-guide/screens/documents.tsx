import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ArrowRight, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormTable } from "@/components/form-table/form-table";
import type { FormTableConfig } from "@/components/form-table/types";
import { DocumentSheet } from "@/app/excel/[obraId]/tabs/file-manager/components/document-sheet";
import { DocumentPreview } from "@/app/excel/[obraId]/tabs/file-manager/components/document-preview";
import type { FileSystemItem } from "@/app/excel/[obraId]/tabs/file-manager/types";
import {
  readCertificates,
  saveCertificates,
  isCertificateCorrected,
  type CertificateRow,
} from "../sample-data";
import { updateJourney, useJourney } from "../runtime/journey";
const source: FileSystemItem = {
  id: "sample-certificate",
  name: "Certificados de avance · Torre Madero.svg",
  type: "file",
  mimetype: "image/svg+xml",
  ocrDocumentStatus: "completed",
  ocrRowsExtracted: 3,
  uploadedAt: "2026-07-31T12:00:00Z",
  uploadedByLabel: "Equipo de ejemplo",
};
export default function Documents() {
  const [showConflict, setShowConflict] = useState(false);
  const [savedRows] = useState(readCertificates);
  const [sourceWidth, setSourceWidth] = useState(42);
  const [mobilePanel, setMobilePanel] = useState("source");
  const splitRef = useRef<HTMLDivElement>(null);
  const journey = useJourney();
  useEffect(() => {
    updateJourney({ sourceOpened: true });
  }, []);
  const downloadSource = () => {
    const link = window.document.createElement("a");
    link.href = "./certificate.svg";
    link.download = "certificados-ejemplo.svg";
    link.click();
  };
  const config = useMemo<
    FormTableConfig<CertificateRow, Record<string, never>>
  >(
    () => ({
      tableId: "guide-extracted",
      showToolbar: false,
      hideFooterPaginationSummary: true,
      disablePagination: true,
      showActionsColumn: false,
      defaultRows: savedRows,
      allowAddRows: false,
      columns: [
        {
          id: "concept",
          label: "Concepto",
          field: "concept",
          cellType: "text",
          editable: true,
          width: 170,
        },
        {
          id: "period",
          label: "Período",
          field: "period",
          cellType: "date",
          editable: true,
          width: 130,
        },
        {
          id: "amount",
          label: "Importe del mes",
          field: "amount",
          cellType: "currency",
          editable: true,
          width: 165,
        },
        {
          id: "accumulated",
          label: "Acumulado",
          field: "accumulated",
          cellType: "currency",
          editable: true,
          width: 165,
        },
        {
          id: "progress",
          label: "Avance %",
          field: "progress",
          cellType: "number",
          editable: true,
          width: 100,
        },
      ],
      onSave: async ({ rows }) => {
        saveCertificates(rows);
        updateJourney({
          rowsSaved: isCertificateCorrected(rows),
          reportOpened: false,
          exported: false,
        });
      },
    }),
    [savedRows],
  );
  const document: FileSystemItem = showConflict
    ? {
        ...source,
        ocrDocumentStatus: "failed",
        ocrErrorCode: "LINEAGE_RECONCILIATION_CONFLICT",
        ocrDocumentError:
          "Dos filas del ejemplo comparten la misma identidad. Revisá la correspondencia antes de aplicar la reimportación.",
      }
    : source;
  return (
    <div className="review-workspace">
      <div className="document-launcher">
        <div>
          <h1>Certificados · Torre Madero</h1>
          <p>Fuente y datos extraídos · 3 períodos · importes en ARS</p>
        </div>
        <div className="document-actions">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowConflict(true)}
          >
            Explorar conflicto
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="./#reports" target="_parent">
              Generar reporte <ArrowRight size={16} />
            </a>
          </Button>
        </div>
      </div>
      {journey.active && !journey.rowsSaved && window.parent === window && (
        <p className="review-instruction">
          Revisión de ejemplo: el importe de mayo figura como $ 17.000.000.
          Comparalo con el certificado, corregilo a $ 18.000.000 y guardá.
        </p>
      )}
      <div
        className="review-mobile-tabs"
        role="tablist"
        aria-label="Vista de revisión"
      >
        {[
          ["source", "Documento fuente"],
          ["data", "Datos extraídos"],
        ].map(([id, label]) => (
          <Button
            key={id}
            id={"tab-" + id}
            role="tab"
            aria-selected={mobilePanel === id}
            aria-controls={"review-" + id}
            variant={mobilePanel === id ? "secondary" : "ghost"}
            onClick={() => setMobilePanel(id)}
            onKeyDown={(event) => {
              if (
                ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              ) {
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? "source"
                    : event.key === "End"
                      ? "data"
                      : id === "source"
                        ? "data"
                        : "source";
                setMobilePanel(next);
                window.document.getElementById("tab-" + next)?.focus();
              }
            }}
            tabIndex={mobilePanel === id ? 0 : -1}
          >
            {label}
          </Button>
        ))}
      </div>
      <div
        className="review-split"
        ref={splitRef}
        data-panel={mobilePanel}
        style={{ "--source-width": `${sourceWidth}%` } as CSSProperties}
      >
        <section
          id="review-source"
          className="review-source"
          aria-label="Documento fuente"
        >
          <div className="review-panel-label">
            <span>01 / Documento fuente</span>
            <Badge variant="secondary">Ejemplo</Badge>
          </div>
          <div className="review-viewer">
            <DocumentPreview
              document={source}
              previewUrl="./certificate.svg"
              onDownload={downloadSource}
            />
          </div>
        </section>
        <div
          className="review-divider"
          role="separator"
          aria-label="Ancho del documento"
          aria-orientation="vertical"
          aria-valuemin={30}
          aria-valuemax={60}
          aria-valuenow={Math.round(sourceWidth)}
          tabIndex={0}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            setSourceWidth((width) =>
              event.key === "Home"
                ? 30
                : event.key === "End"
                  ? 60
                  : Math.min(
                      60,
                      Math.max(
                        30,
                        width + (event.key === "ArrowRight" ? 5 : -5),
                      ),
                    ),
            );
          }}
          onPointerDown={(event) =>
            event.currentTarget.setPointerCapture(event.pointerId)
          }
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            const bounds = splitRef.current!.getBoundingClientRect();
            setSourceWidth(
              Math.min(
                60,
                Math.max(
                  30,
                  ((event.clientX - bounds.left) / bounds.width) * 100,
                ),
              ),
            );
          }}
          onPointerUp={(event) =>
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
        >
          <GripVertical size={14} />
        </div>
        <section
          id="review-data"
          className="review-data"
          aria-label="Datos extraídos"
        >
          <div className="review-panel-label">
            <span>02 / Datos extraídos</span>
            <span>Editar → Guardar</span>
          </div>
          <div className="review-table">
            <FormTable config={config} variant="embedded" />
          </div>
          <p className="review-save-note" role="status">
            {journey.rowsSaved
              ? "Importe corregido y guardado. Ya está disponible en el reporte."
              : "Los cambios guardados se conservan en esta pestaña y alimentan el reporte."}
          </p>
        </section>
      </div>
      <DocumentSheet
        isOpen={showConflict}
        onOpenChange={setShowConflict}
        document={document}
        previewUrl="./certificate.svg"
        breadcrumb="Torre Madero / Certificados"
        onDownload={downloadSource}
        ocrStatusBadge={
          <Badge variant={showConflict ? "warning" : "success"}>
            {showConflict ? "Revisar continuidad" : "3 filas extraídas"}
          </Badge>
        }
      />
    </div>
  );
}
