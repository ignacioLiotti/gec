"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  FileArchive,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  Grid2X2,
  List,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Table2,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type {
  OcrStatus,
  PreviewDocument,
  PreviewExtractedRow,
  PreviewScreenProps,
} from "../contracts";
import { money, number } from "../contracts";
import { EmptyState, ObraHeader, Panel, Status } from "../shared";
import styles from "./documents.module.css";

export interface DocumentsPreviewProps extends PreviewScreenProps {
  obraId: string;
  folderPath?: string;
  documentId?: string;
  mode?: "files" | "table";
}

type FileLayout = "grid" | "list";
type ReprocessTarget = { kind: "one"; documentId: string } | { kind: "all" } | null;
type OcrJob = {
  timerIds: Set<number>;
  finalPatch: Partial<PreviewDocument>;
};

const STATUS_COPY: Record<
  OcrStatus,
  { label: string; detail: string; tone: "success" | "warning" | "danger" | "neutral" | "info" }
> = {
  pending: {
    label: "Pendiente",
    detail: "El documento espera procesamiento OCR.",
    tone: "neutral",
  },
  processing: {
    label: "Procesando",
    detail: "La extracción de ejemplo está en curso.",
    tone: "info",
  },
  extracted: {
    label: "Extraído",
    detail: "La extracción terminó y encontró datos.",
    tone: "success",
  },
  empty: {
    label: "Sin datos",
    detail: "La extracción terminó sin filas detectadas.",
    tone: "warning",
  },
  conflict: {
    label: "Conflicto de continuidad",
    detail: "La identidad estable no se pudo reconciliar. Requiere revisión manual.",
    tone: "danger",
  },
  failed: {
    label: "Error de OCR",
    detail: "La extracción no pudo completarse.",
    tone: "danger",
  },
};

function normalizePath(path: string | undefined) {
  return (path ?? "")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");
}

function getParentPath(path: string) {
  const segments = normalizePath(path).split("/").filter(Boolean);
  segments.pop();
  return segments.join("/");
}

function getEffectiveStatus(document: PreviewDocument): OcrStatus {
  if (document.status === "extracted" && document.rows.length === 0) return "empty";
  return document.status;
}

function formatRowsLabel(document: PreviewDocument) {
  const status = getEffectiveStatus(document);
  if (status !== "extracted") return STATUS_COPY[status].label;
  return `${document.rows.length} dato${document.rows.length === 1 ? "" : "s"}`;
}

function DocumentKindIcon({ kind }: { kind: PreviewDocument["kind"] }) {
  if (kind === "xlsx") return <FileSpreadsheet aria-hidden="true" />;
  if (kind === "docx") return <FileText aria-hidden="true" />;
  if (kind === "html") return <FileCode2 aria-hidden="true" />;
  return <FileArchive aria-hidden="true" />;
}

function DocumentStatus({ document, compact = false }: { document: PreviewDocument; compact?: boolean }) {
  if (document.generated) return <Status tone="warning">Esperando revisión</Status>;
  const status = getEffectiveStatus(document);
  const copy = STATUS_COPY[status];
  return <Status tone={copy.tone}>{compact ? formatRowsLabel(document) : copy.label}</Status>;
}

function FileCard({
  document,
  showOcrStatus,
  onOpen,
  onDelete,
}: {
  document: PreviewDocument;
  showOcrStatus: boolean;
  onOpen: () => void;
  onDelete: (opener: HTMLButtonElement) => void;
}) {
  return (
    <article className={styles.fileCard}>
      <button type="button" className={styles.fileCardMain} onClick={onOpen}>
        <span className={styles.fileIcon} data-kind={document.kind}>
          <DocumentKindIcon kind={document.kind} />
        </span>
        <span className={styles.fileCardCopy}>
          <strong title={document.name}>{document.name}</strong>
          <span>{document.size} · {document.date}</span>
        </span>
        {document.generated || showOcrStatus ? <DocumentStatus document={document} compact /> : null}
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Eliminar ${document.name}`}
        onClick={(event) => onDelete(event.currentTarget)}
        className={styles.fileDelete}
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </article>
  );
}

function ExtractedRows({ rows }: { rows: PreviewExtractedRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No se detectaron datos"
        description="El OCR terminó correctamente, pero este archivo no produjo filas extraídas."
      />
    );
  }

  return (
    <div className={styles.dialogTable} tabIndex={0} aria-label="Datos del documento, desplazamiento horizontal disponible">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Descripción</TableHead>
            <TableHead className={styles.numeric}>Cantidad</TableHead>
            <TableHead>Unidad</TableHead>
            <TableHead className={styles.numeric}>Precio</TableHead>
            <TableHead>Fecha</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.description}</TableCell>
              <TableCell className={styles.numeric}>{number(row.quantity, 2)}</TableCell>
              <TableCell>{row.unit}</TableCell>
              <TableCell className={styles.numeric}>{money(row.price)}</TableCell>
              <TableCell>{row.date}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function GeneratedContent({ document }: { document: PreviewDocument }) {
  const draft = document.content;
  if (!draft) return null;
  const subtotal = draft.rows.reduce((sum, row) => sum + row.quantity * row.price, 0);
  const total = subtotal * (1 - draft.discount / 100);

  return (
    <section className={styles.generatedDocument} aria-label="Representación HTML del documento de ejemplo">
      <p className={styles.generatedFormat}>Representación HTML · sesión local ficticia</p>
      <div className={styles.generatedLetterhead}>
        <div>
          <span>Documento de obra</span>
          <strong>{draft.code}</strong>
        </div>
        <time>{draft.date}</time>
      </div>
      <dl className={styles.generatedMeta}>
        <div><dt>Proveedor</dt><dd>{draft.supplier}</dd></div>
        <div><dt>CUIT</dt><dd>{draft.taxId}</dd></div>
        <div><dt>Domicilio</dt><dd>{draft.address}</dd></div>
      </dl>
      <table className={styles.generatedRows}>
        <thead><tr><th>Detalle</th><th>Cant.</th><th>Unidad</th><th>Importe</th></tr></thead>
        <tbody>
          {draft.rows.map((row) => (
            <tr key={row.id}>
              <td>{row.description}</td>
              <td>{number(row.quantity, 2)}</td>
              <td>{row.unit}</td>
              <td>{money(row.quantity * row.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.generatedTotal}><span>Total</span><strong>{money(total)}</strong></div>
      {draft.notes ? <p className={styles.generatedNotes}>{draft.notes}</p> : null}
    </section>
  );
}

export function DocumentsPreview({
  data,
  actions,
  obraId,
  folderPath,
  documentId,
  mode = "files",
}: DocumentsPreviewProps) {
  const currentPath = normalizePath(folderPath);
  const obra = data.obras.find((candidate) => candidate.id === obraId);
  const currentFolder = data.folders.find((folder) => normalizePath(folder.path) === currentPath);
  const isOcrFolder = Boolean(currentFolder?.ocr);
  const activeMode = mode === "table" && isOcrFolder ? "table" : "files";
  const [search, setSearch] = useState("");
  const [fileLayout, setFileLayout] = useState<FileLayout>("grid");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [reprocessTarget, setReprocessTarget] = useState<ReprocessTarget>(null);
  const [deleteDocumentId, setDeleteDocumentId] = useState<string | null>(null);
  const ocrJobsRef = useRef<Map<string, OcrJob>>(new Map());
  const documentsRef = useRef(data.documents);
  const updateDocumentRef = useRef(actions.onUpdateDocument);
  const documentOpenerRef = useRef<HTMLElement | null>(null);
  const addOpenerRef = useRef<HTMLElement | null>(null);
  const reprocessOpenerRef = useRef<HTMLElement | null>(null);
  const deleteOpenerRef = useRef<HTMLElement | null>(null);
  const generateButtonRef = useRef<HTMLButtonElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const folders = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    return data.folders
      .filter((folder) => normalizePath(folder.parentPath) === currentPath)
      .filter((folder) => !query || folder.name.toLocaleLowerCase("es").includes(query));
  }, [currentPath, data.folders, search]);

  const folderDocuments = useMemo(
    () => data.documents.filter(
      (document) => document.obraId === obraId && normalizePath(document.folderPath) === currentPath,
    ),
    [currentPath, data.documents, obraId],
  );

  const visibleDocuments = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    return folderDocuments.filter((document) => !query || document.name.toLocaleLowerCase("es").includes(query));
  }, [folderDocuments, search]);

  const extractedRows = useMemo(
    () => visibleDocuments.flatMap((document) => document.rows.map((row) => ({ document, row }))),
    [visibleDocuments],
  );

  const selectedDocument = data.documents.find(
    (document) => document.id === documentId
      && document.obraId === obraId
      && normalizePath(document.folderPath) === currentPath,
  );
  const deleteDocument = data.documents.find((document) => document.id === deleteDocumentId);
  const selectedStatus = selectedDocument ? getEffectiveStatus(selectedDocument) : null;
  const reprocessableDocuments = folderDocuments.filter((document) => {
    const status = getEffectiveStatus(document);
    return !document.generated && status !== "conflict" && status !== "pending" && status !== "processing";
  });

  useEffect(() => {
    documentsRef.current = data.documents;
    updateDocumentRef.current = actions.onUpdateDocument;
  }, [actions.onUpdateDocument, data.documents]);

  useEffect(() => {
    const activeJobs = ocrJobsRef.current;
    return () => {
      for (const [pendingDocumentId, job] of activeJobs) {
        for (const timerId of job.timerIds) window.clearTimeout(timerId);
        const document = documentsRef.current.find((candidate) => candidate.id === pendingDocumentId);
        if (document?.status !== "conflict") {
          updateDocumentRef.current(pendingDocumentId, job.finalPatch);
        }
      }
      activeJobs.clear();
    };
  }, []);

  if (!obra) {
    return (
      <EmptyState
        title="Obra no encontrada"
        description="La vista previa no tiene una obra ficticia con este identificador."
        action={<Button onClick={() => actions.onNavigate({ view: "obras" })}>Volver a obras</Button>}
      />
    );
  }

  const navigateToFolder = (path: string) => {
    setSearch("");
    actions.onNavigate({ view: "documents", obraId, folderPath: normalizePath(path), mode: "files" });
  };

  const openDocument = (document: PreviewDocument) => {
    documentOpenerRef.current = window.document.activeElement instanceof HTMLElement
      ? window.document.activeElement
      : null;
    actions.onNavigate({
      view: "documents",
      obraId,
      folderPath: document.folderPath,
      documentId: document.id,
      mode: activeMode,
    });
  };

  const closeDocument = () => {
    actions.onNavigate({ view: "documents", obraId, folderPath: currentPath, mode: activeMode });
  };

  const openAddDialog = () => {
    addOpenerRef.current = window.document.activeElement instanceof HTMLElement
      ? window.document.activeElement
      : null;
    setAddDialogOpen(true);
  };

  const openReprocessDialog = (target: Exclude<ReprocessTarget, null>) => {
    reprocessOpenerRef.current = window.document.activeElement instanceof HTMLElement
      ? window.document.activeElement
      : null;
    setReprocessTarget(target);
  };

  const openDeleteDialog = (id: string, opener?: HTMLElement) => {
    deleteOpenerRef.current = opener
      ?? (window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null);
    setDeleteDocumentId(id);
  };

  const startOcrJob = (
    documentIdToUpdate: string,
    processingDelay: number,
    finalDelay: number,
    finalPatch: Partial<PreviewDocument>,
  ) => {
    const currentJob = ocrJobsRef.current.get(documentIdToUpdate);
    if (currentJob) {
      for (const timerId of currentJob.timerIds) window.clearTimeout(timerId);
    }

    const job: OcrJob = { timerIds: new Set(), finalPatch };
    const processingTimer = window.setTimeout(() => {
      job.timerIds.delete(processingTimer);
      const document = documentsRef.current.find((candidate) => candidate.id === documentIdToUpdate);
      if (document?.status === "conflict") {
        for (const timerId of job.timerIds) window.clearTimeout(timerId);
        ocrJobsRef.current.delete(documentIdToUpdate);
        return;
      }
      updateDocumentRef.current(documentIdToUpdate, { status: "processing" });
    }, processingDelay);
    const finalTimer = window.setTimeout(() => {
      job.timerIds.delete(finalTimer);
      const document = documentsRef.current.find((candidate) => candidate.id === documentIdToUpdate);
      if (document?.status !== "conflict") {
        updateDocumentRef.current(documentIdToUpdate, finalPatch);
      }
      ocrJobsRef.current.delete(documentIdToUpdate);
    }, finalDelay);
    job.timerIds.add(processingTimer);
    job.timerIds.add(finalTimer);
    ocrJobsRef.current.set(documentIdToUpdate, job);
  };

  const handleAddDocument = () => {
    const id = `demo-document-${Date.now()}`;
    const document: PreviewDocument = {
      id,
      obraId,
      folderPath: currentPath,
      name: isOcrFolder ? "Remito de ejemplo.pdf" : "Nota de obra de ejemplo.pdf",
      size: "184 KB",
      date: "14 oct 2026",
      status: isOcrFolder ? "pending" : "empty",
      rows: [],
      kind: "pdf",
    };
    actions.onAddDocument(document);
    setAddDialogOpen(false);

    if (isOcrFolder) {
      startOcrJob(id, 650, 1_900, {
        status: "extracted",
        rows: [{
          id: `${id}-row-1`,
          description: "Hormigón elaborado H30",
          quantity: 8,
          unit: "m³",
          price: 126_400,
          date: "2026-10-14",
        }],
      });
    }
  };

  const beginReprocess = (document: PreviewDocument) => {
    if (getEffectiveStatus(document) === "conflict") return;
    actions.onUpdateDocument(document.id, { status: "pending" });
    startOcrJob(document.id, 500, 1_650, {
      status: document.rows.length > 0 ? "extracted" : "empty",
      rows: document.rows,
    });
  };

  const confirmReprocess = () => {
    if (reprocessTarget?.kind === "one") {
      const document = data.documents.find((candidate) => candidate.id === reprocessTarget.documentId);
      if (document && getEffectiveStatus(document) !== "conflict") beginReprocess(document);
    }
    if (reprocessTarget?.kind === "all") {
      for (const document of reprocessableDocuments) beginReprocess(document);
    }
    setReprocessTarget(null);
  };

  const confirmDelete = () => {
    if (!deleteDocumentId) return;
    actions.onDeleteDocument(deleteDocumentId);
    if (documentId === deleteDocumentId) closeDocument();
    setDeleteDocumentId(null);
  };

  const currentTitle = currentFolder?.name ?? "Documentos";
  const currentDescription = currentPath
    ? `${folderDocuments.length} archivo${folderDocuments.length === 1 ? "" : "s"}${isOcrFolder ? " · extracción OCR habilitada" : ""}`
    : "Carpetas, archivos y datos extraídos de la obra.";

  return (
    <div className={styles.screen}>
      <ObraHeader obra={obra} view="documents" actions={actions} />

      <Panel className={styles.workspace}>
        <div className={styles.toolbar}>
          <div className={styles.location}>
            {currentPath ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Volver a la carpeta anterior"
                onClick={() => navigateToFolder(currentFolder?.parentPath ?? getParentPath(currentPath))}
              >
                <ArrowLeft aria-hidden="true" />
              </Button>
            ) : null}
            <div>
              <div className={styles.breadcrumb}>
                <button type="button" onClick={() => navigateToFolder("")}>Documentos</button>
                {currentPath.split("/").filter(Boolean).map((segment, index, segments) => {
                  const path = segments.slice(0, index + 1).join("/");
                  return (
                    <span key={path}>
                      <span aria-hidden="true">/</span>
                      <button type="button" onClick={() => navigateToFolder(path)}>{segment}</button>
                    </span>
                  );
                })}
              </div>
              <strong>{currentTitle}</strong>
              <small className={styles.locationMeta}>{currentDescription}</small>
            </div>
          </div>

          <div className={styles.toolbarControls}>
            <div className={styles.workspaceActions}>
              <Button
                ref={generateButtonRef}
                type="button"
                variant="secondary"
                onClick={() => actions.onNavigate({ view: "generation", obraId })}
              >
                <Sparkles aria-hidden="true" />
                Generar documento
              </Button>
              <Button ref={addButtonRef} type="button" onClick={openAddDialog}>
                <Plus aria-hidden="true" />
                Agregar documento
              </Button>
            </div>
            <label className={styles.searchField}>
              <Search aria-hidden="true" />
              <span className={styles.srOnly}>Buscar en esta carpeta</span>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar archivo o carpeta"
              />
            </label>
            {isOcrFolder ? (
              <div className={styles.segmented} aria-label="Vista de carpeta">
                <Button
                  type="button"
                  size="sm"
                  variant={activeMode === "files" ? "dark" : "ghost"}
                  aria-pressed={activeMode === "files"}
                  onClick={() => actions.onNavigate({ view: "documents", obraId, folderPath: currentPath, mode: "files" })}
                >
                  <FolderOpen aria-hidden="true" /> Archivos
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={activeMode === "table" ? "dark" : "ghost"}
                  aria-pressed={activeMode === "table"}
                  onClick={() => actions.onNavigate({ view: "documents", obraId, folderPath: currentPath, mode: "table" })}
                >
                  <Table2 aria-hidden="true" /> Tabla
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        {activeMode === "table" ? (
          <section className={styles.tableSection}>
            <div className={styles.sectionBar}>
              <div>
                <span>Datos extraídos</span>
                <strong>{currentFolder?.tableName ?? "Tabla OCR"}</strong>
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={reprocessableDocuments.length === 0}
                onClick={() => openReprocessDialog({ kind: "all" })}
              >
                <RefreshCw aria-hidden="true" />
                Reprocesar todos
              </Button>
            </div>
            {extractedRows.length === 0 ? (
              <EmptyState
                title="No hay filas extraídas"
                description="Los documentos de esta carpeta todavía no aportaron datos a la tabla."
                action={<Button variant="secondary" onClick={() => actions.onNavigate({ view: "documents", obraId, folderPath: currentPath, mode: "files" })}>Ver archivos</Button>}
              />
            ) : (
              <div className={styles.tableScroll} tabIndex={0} aria-label="Tabla de datos extraídos, desplazamiento horizontal disponible">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento fuente</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className={styles.numeric}>Cantidad</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead className={styles.numeric}>Precio</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extractedRows.map(({ document, row }) => (
                    <TableRow key={`${document.id}-${row.id}`}>
                      <TableCell>
                        <div className={styles.sourceDocument}>
                          <button type="button" className={styles.sourceLink} onClick={() => openDocument(document)}>
                            <DocumentKindIcon kind={document.kind} /> {document.name}
                          </button>
                          {document.generated ? <Status tone="warning">Esperando revisión</Status> : null}
                        </div>
                      </TableCell>
                      <TableCell>{row.description}</TableCell>
                      <TableCell className={styles.numeric}>{number(row.quantity, 2)}</TableCell>
                      <TableCell>{row.unit}</TableCell>
                      <TableCell className={styles.numeric}>{money(row.price)}</TableCell>
                      <TableCell>{row.date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </section>
        ) : (
          <div className={styles.filesView}>
            {folders.length > 0 ? (
              <section className={styles.folderSection}>
                <div className={styles.sectionLabel}><span>Carpetas</span><small>{folders.length}</small></div>
                <div className={styles.folderGrid}>
                  {folders.map((folder) => {
                    const documentCount = data.documents.filter(
                      (document) => document.obraId === obraId && normalizePath(document.folderPath) === normalizePath(folder.path),
                    ).length;
                    return (
                      <button key={folder.path} type="button" className={styles.folderCard} onClick={() => navigateToFolder(folder.path)}>
                        <span className={styles.folderGlyph}><Folder aria-hidden="true" /></span>
                        <span>
                          <strong>{folder.name}</strong>
                          <small>{documentCount} archivo{documentCount === 1 ? "" : "s"}</small>
                        </span>
                        {folder.ocr ? <Status tone="info">OCR</Status> : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section className={styles.documentsSection}>
              <div className={styles.sectionBar}>
                <div className={styles.sectionLabel}>
                  <span>Archivos</span><small>{visibleDocuments.length}</small>
                </div>
                <div className={styles.fileActions}>
                  {isOcrFolder ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={reprocessableDocuments.length === 0}
                      onClick={() => openReprocessDialog({ kind: "all" })}
                    >
                      <RefreshCw aria-hidden="true" /> Reprocesar todos
                    </Button>
                  ) : null}
                  <div className={styles.iconSegmented} aria-label="Disposición de archivos">
                    <Button type="button" variant={fileLayout === "grid" ? "dark" : "ghost"} size="icon-sm" aria-label="Vista en grilla" aria-pressed={fileLayout === "grid"} onClick={() => setFileLayout("grid")}><Grid2X2 /></Button>
                    <Button type="button" variant={fileLayout === "list" ? "dark" : "ghost"} size="icon-sm" aria-label="Vista en lista" aria-pressed={fileLayout === "list"} onClick={() => setFileLayout("list")}><List /></Button>
                  </div>
                </div>
              </div>
              {visibleDocuments.length === 0 ? (
                <EmptyState
                  title={search ? "No hay coincidencias" : "Esta carpeta está vacía"}
                  description={search ? "Probá con otro término de búsqueda." : "Agregá un documento ficticio para recorrer el flujo local."}
                  action={!search ? <Button onClick={openAddDialog}><Plus /> Agregar documento</Button> : undefined}
                />
              ) : (
                <div className={fileLayout === "grid" ? styles.fileGrid : styles.fileList}>
                  {visibleDocuments.map((document) => (
                    <FileCard
                      key={document.id}
                      document={document}
                      showOcrStatus={isOcrFolder}
                      onOpen={() => openDocument(document)}
                      onDelete={(opener) => openDeleteDialog(document.id, opener)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </Panel>

      <Dialog open={Boolean(selectedDocument)} onOpenChange={(open) => { if (!open) closeDocument(); }}>
        <DialogContent
          className={styles.documentDialog}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const target = documentOpenerRef.current?.isConnected
              ? documentOpenerRef.current
              : generateButtonRef.current;
            target?.focus();
            documentOpenerRef.current = null;
          }}
        >
          {selectedDocument ? (
            <>
              <DialogHeader>
                <div className={styles.dialogTitleRow}>
                  <span className={styles.dialogFileIcon}><DocumentKindIcon kind={selectedDocument.kind} /></span>
                  <div>
                    <DialogTitle>{selectedDocument.name}</DialogTitle>
                    <DialogDescription>{selectedDocument.folderPath || "Documentos"} · {selectedDocument.size} · {selectedDocument.date}</DialogDescription>
                  </div>
                  {selectedDocument.generated || isOcrFolder ? <DocumentStatus document={selectedDocument} /> : null}
                </div>
              </DialogHeader>
              <div className={styles.dialogBody}>
                {selectedDocument.generated ? (
                  <GeneratedContent document={selectedDocument} />
                ) : (
                  <div className={styles.filePreviewPlaceholder} data-kind={selectedDocument.kind}>
                    <DocumentKindIcon kind={selectedDocument.kind} />
                    <span>Vista ficticia del archivo</span>
                    <small>No se leen archivos privados ni cargas reales.</small>
                  </div>
                )}

                {isOcrFolder || selectedDocument.rows.length > 0 ? (
                  <section className={styles.extractedSection}>
                    <div className={styles.extractedHeading}>
                      <div>
                        <span>{selectedDocument.generated ? "Datos del ejemplo HTML" : "Datos extraídos"}</span>
                        <strong>{selectedDocument.generated ? `${selectedDocument.rows.length} fila${selectedDocument.rows.length === 1 ? "" : "s"}` : formatRowsLabel(selectedDocument)}</strong>
                      </div>
                      {selectedDocument.generated
                        ? <p>Contenido estructurado de esta sesión ficticia. El documento todavía espera revisión.</p>
                        : selectedStatus ? <p>{STATUS_COPY[selectedStatus].detail}</p> : null}
                    </div>
                    {selectedDocument.generated ? (
                      <ExtractedRows rows={selectedDocument.rows} />
                    ) : selectedStatus === "conflict" ? (
                      <div className={styles.conflictNotice}>
                        <AlertTriangle aria-hidden="true" />
                        <div><strong>No se resolvió automáticamente</strong><p>La vista conserva el conflicto para que se revise fuera de esta simulación.</p></div>
                      </div>
                    ) : selectedStatus === "processing" || selectedStatus === "pending" ? (
                      <div className={styles.processingState} aria-live="polite"><RefreshCw aria-hidden="true" /> {STATUS_COPY[selectedStatus].detail}</div>
                    ) : selectedStatus === "failed" ? (
                      <EmptyState title="La extracción falló" description={STATUS_COPY.failed.detail} />
                    ) : (
                      <ExtractedRows rows={selectedDocument.rows} />
                    )}
                  </section>
                ) : null}
              </div>
              <DialogFooter>
                {isOcrFolder && !selectedDocument.generated ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={selectedStatus === "conflict" || selectedStatus === "processing" || selectedStatus === "pending"}
                    title={selectedStatus === "conflict" ? "Los conflictos requieren revisión manual" : undefined}
                    onClick={() => openReprocessDialog({ kind: "one", documentId: selectedDocument.id })}
                  >
                    <RefreshCw aria-hidden="true" /> Reprocesar
                  </Button>
                ) : null}
                <Button type="button" variant="destructiveSecondary" onClick={(event) => openDeleteDialog(selectedDocument.id, event.currentTarget)}>
                  <Trash2 aria-hidden="true" /> Eliminar
                </Button>
                <Button type="button" onClick={closeDocument}>Cerrar</Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent
          className={styles.compactDialog}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const target = addOpenerRef.current?.isConnected ? addOpenerRef.current : addButtonRef.current;
            target?.focus();
            addOpenerRef.current = null;
          }}
        >
          <DialogHeader>
            <DialogTitle>Agregar documento ficticio</DialogTitle>
            <DialogDescription>
              Esta acción agrega un archivo de demostración al estado local compartido. No sube ni lee archivos reales.
            </DialogDescription>
          </DialogHeader>
          <div className={styles.simulationNotice}>
            <Sparkles aria-hidden="true" />
            <div><strong>Simulación local</strong><p>{isOcrFolder ? "El documento pasará por estados OCR de ejemplo." : "El documento aparecerá en esta carpeta sin acceder al almacenamiento."}</p></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setAddDialogOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={handleAddDocument}>Agregar ejemplo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reprocessTarget)} onOpenChange={(open) => { if (!open) setReprocessTarget(null); }}>
        <DialogContent
          className={styles.compactDialog}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const target = reprocessOpenerRef.current?.isConnected ? reprocessOpenerRef.current : addButtonRef.current;
            target?.focus();
            reprocessOpenerRef.current = null;
          }}
        >
          <DialogHeader>
            <DialogTitle>{reprocessTarget?.kind === "all" ? "Reprocesar documentos" : "Reprocesar documento"}</DialogTitle>
            <DialogDescription>
              {reprocessTarget?.kind === "all"
                ? `Se simulará el OCR de ${reprocessableDocuments.length} documento${reprocessableDocuments.length === 1 ? "" : "s"}. Los conflictos se conservarán sin cambios.`
                : "Se simulará una nueva extracción OCR. Esta vista no resuelve conflictos de continuidad."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setReprocessTarget(null)}>Cancelar</Button>
            <Button type="button" onClick={confirmReprocess}><RefreshCw /> Reprocesar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteDocument)} onOpenChange={(open) => { if (!open) setDeleteDocumentId(null); }}>
        <DialogContent
          className={styles.compactDialog}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const target = deleteOpenerRef.current?.isConnected ? deleteOpenerRef.current : addButtonRef.current;
            target?.focus();
            deleteOpenerRef.current = null;
          }}
        >
          <DialogHeader>
            <DialogTitle>Eliminar documento</DialogTitle>
            <DialogDescription>
              Se quitará “{deleteDocument?.name}” del conjunto ficticio compartido. Esta acción no toca archivos reales.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setDeleteDocumentId(null)}>Cancelar</Button>
            <Button type="button" variant="destructive" onClick={confirmDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
