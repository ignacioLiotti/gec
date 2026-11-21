"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, FileText, RefreshCw, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { demoWork, formatAmount, invoiceFields, invoiceHtml } from "./fixtures";
import { DocumentPreview } from "./document-preview";
import styles from "./demos.module.css";

type CapturePhase = "empty" | "uploading" | "extracting" | "failed" | "review" | "saved";

export function CaptureDemo({ contextual }: { contextual: boolean }) {
  const [phase, setPhase] = useState<CapturePhase>("empty");
  const [testCase, setTestCase] = useState("normal");
  const [manualView, setManualView] = useState("documents");
  const [fields, setFields] = useState({ ...invoiceFields });
  const [savedFields, setSavedFields] = useState({ ...invoiceFields });
  const [originalOpen, setOriginalOpen] = useState(false);
  const originalTrigger = useRef<HTMLButtonElement>(null);
  const [saveError, setSaveError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const isDirty = Object.keys(fields).some(key => fields[key as keyof typeof fields] !== savedFields[key as keyof typeof fields]);
  const inProgress = phase === "uploading" || phase === "extracting";

  function extract(shouldFail: boolean) {
    setPhase("extracting");
    timer.current = setTimeout(() => {
      // The fixture has one deliberately wrong OCR amount to make correction testable.
      if (shouldFail) { setPhase("failed"); return; }
      const extracted = { ...invoiceFields, amount: "12500" };
      setFields(extracted);
      setSavedFields(extracted);
      setPhase("review");
    }, 850);
  }

  function uploadExample() {
    if (testCase === "readonly" || inProgress) return;
    setSaveError("");
    setPhase("uploading");
    timer.current = setTimeout(() => extract(testCase === "ocr-error"), 550);
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (testCase === "readonly") return;
    if (testCase === "save-error") { setSaveError("No se pudieron guardar los datos. Tus correcciones siguen en el formulario; reintentá cuando se recupere el servicio."); return; }
    setSavedFields({ ...fields });
    setSaveError("");
    setPhase("saved");
  }

  const reviewForm = <form onSubmit={save} className={styles.reviewForm}>
    <div className={styles.sectionHeading}><div><h3>Datos de la factura</h3><p>Compará los valores con el documento original.</p></div><Badge variant={phase === "saved" && !isDirty ? "success" : "outline"}>{phase === "saved" && !isDirty ? "Guardado" : "Datos extraídos"}</Badge></div>
    <label className={styles.field}><span>Proveedor</span><Input value={fields.supplier} onChange={event => setFields({ ...fields, supplier: event.target.value })} required readOnly={testCase === "readonly"} /></label>
    <label className={styles.field}><span>Fecha</span><Input type="date" value={fields.date} onChange={event => setFields({ ...fields, date: event.target.value })} required readOnly={testCase === "readonly"} /></label>
    <label className={styles.field}><span>Total (ARS)</span><Input aria-label="Total (ARS)" aria-describedby="capture-total-help" type="number" min="0.01" step="0.01" value={fields.amount} onChange={event => setFields({ ...fields, amount: event.target.value })} required readOnly={testCase === "readonly"} /><small id="capture-total-help">El ejemplo contiene un importe extraído incorrectamente. La factura original dice $ 125.000,00.</small></label>
    {saveError ? <p role="alert" className={styles.error}>{saveError}</p> : null}
    <div className={styles.actionBar}><p role="status">{isDirty ? "Tenés cambios sin guardar" : phase === "saved" ? "Cambios guardados en la demo" : "Podés corregir los datos"}</p><Button type="submit" disabled={testCase === "readonly"}>Guardar datos</Button></div>
  </form>;

  return (
    <section aria-label="Demo de carga y revisión" className={styles.panel}>
      <div className={styles.demoControls}><label htmlFor="capture-case">Caso de prueba</label><NativeSelect id="capture-case" value={testCase} disabled={inProgress} onChange={event => { setTestCase(event.target.value); setSaveError(""); }}><option value="normal">Carga disponible</option><option value="ocr-error">Falla de extracción</option><option value="save-error">Falla al guardar correcciones</option><option value="readonly">Solo consulta</option></NativeSelect><span>Se carga una factura ficticia. No se usa un proveedor OCR.</span></div>
      <div className={styles.panelBody}>
        <div className={styles.sectionHeading}><div><h2>Compras</h2><p>{demoWork.label} · documentos y datos</p></div>{phase === "empty" ? <Button onClick={uploadExample} disabled={testCase === "readonly"}><Upload className="size-4" />Cargar factura de ejemplo</Button> : <Button ref={originalTrigger} variant="outline" onClick={() => setOriginalOpen(true)} disabled={phase === "uploading"}><FileText className="size-4" />Ver original</Button>}</div>
        {testCase === "readonly" ? <p className={styles.notice} role="status">Solo consulta. Podés ver el original y los datos, pero no cargar ni guardar cambios.</p> : null}
        {phase === "empty" ? <div className={styles.empty}><Upload className="size-8" /><h3>Cargar en Compras de {demoWork.label}</h3><p>El archivo se guarda primero. Después se extraen sus datos.</p></div> : null}
        {inProgress ? <div className={styles.processing} role="status"><Badge variant="info">{phase === "uploading" ? "Subiendo archivo" : "Archivo guardado"}</Badge><h3>{phase === "uploading" ? "Guardando la factura en Compras…" : "Extrayendo los datos de la factura…"}</h3><p>{phase === "uploading" ? "Todavía no está disponible para consultar." : "El original ya está disponible. Los datos todavía no están listos."}</p><progress aria-label={phase === "uploading" ? "Carga del archivo" : "Extracción de datos"} /></div> : null}
        {phase === "failed" ? <div className={styles.error} role="alert"><h3>El archivo está guardado; la extracción falló</h3><p>No hace falta volver a cargarlo. Reintentá la extracción sobre el mismo archivo.</p><Button variant="outline" onClick={() => extract(false)} disabled={testCase === "readonly"}><RefreshCw className="size-4" />Reintentar extracción</Button></div> : null}
        {phase === "review" || phase === "saved" ? <>
          {phase === "saved" && !isDirty ? <div className={styles.saved} role="status"><Check className="size-4" />Datos guardados · {formatAmount(savedFields.amount)} · el original sigue disponible</div> : null}
          {contextual ? <div className={styles.split}><DocumentPreview title="Factura original · página 1" html={invoiceHtml} />{reviewForm}</div> : <><Tabs value={manualView} onValueChange={setManualView}><TabsList aria-label="Vistas de carpeta"><TabsTrigger value="documents">Archivos</TabsTrigger><TabsTrigger value="data">Tabla de datos</TabsTrigger></TabsList></Tabs><div className={styles.manualReview}>{manualView === "documents" ? <DocumentPreview title="Factura original · página 1" html={invoiceHtml} /> : reviewForm}</div></>}
        </> : null}
      </div>
      <Dialog open={originalOpen} onOpenChange={setOriginalOpen}><DialogContent className="sm:max-w-3xl" onCloseAutoFocus={event => { event.preventDefault(); originalTrigger.current?.focus(); }}><DialogHeader><DialogTitle>Factura 0001-00000042</DialogTitle><DialogDescription>{demoWork.label} / Compras · el original no se modifica al corregir datos</DialogDescription></DialogHeader><DocumentPreview title="Factura original de ejemplo" html={invoiceHtml} /></DialogContent></Dialog>
    </section>
  );
}
