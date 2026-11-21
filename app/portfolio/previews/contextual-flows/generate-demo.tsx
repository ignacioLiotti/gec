"use client";

import { useRef, useState, type FormEvent } from "react";
import { Check, ChevronRight, Download, FilePlus2, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { renderDocumentHtml, validateTemplateInput } from "@/lib/document-generation";
import { DocumentPreview } from "./document-preview";
import { demoWork, formatAmount, purchaseSchema, purchaseTemplate } from "./fixtures";
import styles from "./demos.module.css";

type TemplateCase = "one" | "multiple" | "none" | "error" | "readonly";
const standardTemplate = { id: "oc-standard", label: "Orden de compra estándar" };

export function GenerateDemo({ contextual }: { contextual: boolean }) {
  const [step, setStep] = useState<"folder" | "form" | "preview">("folder");
  const [templateCase, setTemplateCase] = useState<TemplateCase>("one");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [manualContext, setManualContext] = useState({ work: "", folder: "", type: "" });
  const [draft, setDraft] = useState({ supplier: "Materiales del Litoral", subject: "Materiales para la etapa 2 de Obra Ribera", amount: "125000" });
  const [savedDraft, setSavedDraft] = useState<typeof draft | null>(null);
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState<{ html: string; template: string } | null>(null);
  const [documentOpen, setDocumentOpen] = useState(false);
  const documentTrigger = useRef<HTMLButtonElement>(null);

  const templates = templateCase === "none" ? [] : [standardTemplate, ...(templateCase === "multiple" ? [{ id: "oc-materials", label: "Orden de compra de materiales" }] : [])];
  const templateId = contextual && templates.length === 1 ? templates[0].id : selectedTemplate;
  const template = templates.find(item => item.id === templateId);
  const contextReady = contextual || Object.values(manualContext).every(Boolean);
  const html = renderDocumentHtml(purchaseTemplate, { ...draft, template: template?.label ?? "Sin seleccionar", formattedAmount: formatAmount(draft.amount || 0) });
  const isSaved = savedDraft !== null && Object.keys(draft).every(key => draft[key as keyof typeof draft] === savedDraft[key as keyof typeof draft]);

  function preview(event: FormEvent) {
    event.preventDefault();
    const issues = validateTemplateInput(purchaseSchema, draft);
    if (!contextReady) { setError("Elegí la obra, el tipo de documento y la carpeta destino."); return; }
    if (!template) { setError("Elegí una plantilla compatible para continuar."); return; }
    if (issues.length) { setError(issues[0].message); return; }
    setError("");
    setStep("preview");
  }

  function generate() {
    if (!template || !contextReady || validateTemplateInput(purchaseSchema, draft).length) return;
    if (templateCase === "error") { setError("No se pudo generar el archivo. Tu borrador sigue disponible. Cambiá el caso de prueba para reintentar."); return; }
    if (templateCase === "readonly") return;
    setGenerated({ html, template: template.label });
    setSavedDraft({ ...draft });
    setStep("folder");
  }

  function download() {
    if (!generated) return;
    const url = URL.createObjectURL(new Blob([generated.html], { type: "text/html;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "OC-0042-ejemplo.html"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section aria-label="Demo de generación" className={styles.panel}>
      <div className={styles.demoControls}><label htmlFor="generation-case">Caso de prueba</label><NativeSelect id="generation-case" value={templateCase} onChange={event => { setTemplateCase(event.target.value as TemplateCase); setSelectedTemplate(""); setError(""); }}><option value="one">Una plantilla compatible</option><option value="multiple">Varias plantillas</option><option value="none">Sin plantillas</option><option value="error">Error al generar</option><option value="readonly">Sin permiso de creación</option></NativeSelect><span>Simulación de generación, sin guardar en la empresa.</span></div>
      <div className={styles.panelBody}>
        {step === "folder" ? <>
          <div className={styles.sectionHeading}><div><h2>Compras</h2><p>Archivos y documentos de {demoWork.label}</p></div><Button onClick={() => { setStep("form"); setError(""); }} disabled={templateCase === "readonly"}><FilePlus2 className="size-4" />{contextual ? "Generar documento aquí" : "Abrir Generar documentos"}</Button></div>
          {templateCase === "readonly" ? <p role="status" className={styles.notice}>Tu acceso permite consultar archivos, pero no generar documentos.</p> : null}
          {generated ? <div className={styles.resultRow}><FileText className="size-5" /><div><strong>OC-0042 · Orden de compra</strong><p>{generated.template} · guardado en esta demo</p></div><Badge variant="warning">En revisión</Badge><Button ref={documentTrigger} variant="outline" onClick={() => setDocumentOpen(true)}>Abrir documento</Button></div> : <div className={styles.empty}><FilePlus2 className="size-8" /><h3>Prepará el próximo documento de la obra</h3><p>{contextual ? "La obra y la carpeta ya están elegidas. Solo falta completar el pedido." : "El acceso global pide seleccionar la obra, el tipo, la carpeta y la plantilla."}</p></div>}
          {isSaved ? <p className={styles.saved} role="status"><Check className="size-4" />{generated ? "Documento de ejemplo generado. La aprobación es un paso separado." : "Borrador privado guardado en esta sesión."}</p> : null}
          {savedDraft && !generated ? <Button variant="outline" onClick={() => setStep("form")}>Continuar borrador</Button> : null}
        </> : <>
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Orden de compra</p><h2>{step === "preview" ? "Revisar antes de generar" : "Completar el documento"}</h2></div><Button variant="outline" onClick={() => setStep("folder")}>Volver a Compras</Button></div>
          <ol className={styles.steps}><li>1. Destino</li><li aria-current={step === "form" ? "step" : undefined}>2. Completar</li><li aria-current={step === "preview" ? "step" : undefined}>3. Revisar</li></ol>
          {error ? <p role="alert" className={styles.error}>{error}</p> : null}
          {templateCase === "none" ? <div className={styles.empty}><h3>No hay plantillas para esta carpeta</h3><p>Un administrador puede configurar qué documentos se generan en Compras. Se conserva lo que ya escribiste.</p></div> : templateCase === "readonly" ? <p role="status" className={styles.notice}>No tenés permiso para generar. Los datos del borrador se conservan.</p> : step === "form" ? <form onSubmit={preview}>
            {contextual ? <div className={styles.contextSummary}><span>Destino</span><strong>{demoWork.label} / Compras</strong><Badge variant="outline">Orden de compra</Badge></div> : <div className={styles.formGrid}>
              <label className={styles.field}><span>Obra</span><NativeSelect value={manualContext.work} onChange={event => setManualContext({ ...manualContext, work: event.target.value })} required><option value="">Seleccionar obra</option><option value="demo-ribera">{demoWork.label}</option></NativeSelect></label>
              <label className={styles.field}><span>Tipo de documento</span><NativeSelect value={manualContext.type} onChange={event => setManualContext({ ...manualContext, type: event.target.value })} required><option value="">Seleccionar tipo</option><option value="PURCHASE_ORDER">Orden de compra</option></NativeSelect></label>
              <label className={styles.field}><span>Carpeta destino</span><NativeSelect value={manualContext.folder} onChange={event => setManualContext({ ...manualContext, folder: event.target.value })} required><option value="">Seleccionar carpeta</option><option value="Compras">Compras</option></NativeSelect></label>
            </div>}
            {contextual && templates.length === 1 ? <p className={styles.templateLabel}>Plantilla: <strong>{template?.label}</strong> · única opción compatible</p> : <label className={styles.field}><span>Plantilla</span><NativeSelect value={selectedTemplate} onChange={event => setSelectedTemplate(event.target.value)} required><option value="">Elegí una plantilla</option>{templates.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</NativeSelect></label>}
            <div className={styles.formGrid}>
              <label className={styles.field}><span>Proveedor</span><Input value={draft.supplier} onChange={event => setDraft({ ...draft, supplier: event.target.value })} required /></label>
              <label className={styles.field}><span>Importe (ARS)</span><Input type="number" min="0.01" step="0.01" value={draft.amount} onChange={event => setDraft({ ...draft, amount: event.target.value })} required /></label>
            </div>
            <label className={styles.field}><span>Detalle del pedido</span><Textarea value={draft.subject} onChange={event => setDraft({ ...draft, subject: event.target.value })} required /></label>
            <div className={styles.actionBar}><p role="status">{isSaved ? "Borrador guardado en la demo" : "Los datos todavía no se guardaron como borrador"}</p><Button type="button" variant="outline" onClick={() => setSavedDraft({ ...draft })}>Guardar borrador</Button><Button type="submit">Revisar documento<ChevronRight className="size-4" /></Button></div>
          </form> : <div className={styles.split}><DocumentPreview title="Vista previa de la orden de compra" html={html} /><div><h3>Destino del documento</h3><p>{demoWork.label} / Compras</p><div className={styles.notice}><strong>Se generará en revisión</strong><p>El borrador es privado. El documento generado sigue el circuito de revisión de la obra.</p></div><div className={styles.actions}><Button onClick={generate} disabled={!template || !contextReady}>Generar y volver a Compras</Button><Button variant="outline" onClick={() => setStep("form")}>Editar datos</Button></div>{!template || !contextReady ? <p role="status" className={styles.muted}>Volvé a editar para completar el destino y la plantilla de esta variante.</p> : null}</div></div>}
        </>}
      </div>
      <Dialog open={documentOpen} onOpenChange={setDocumentOpen}><DialogContent className="sm:max-w-3xl" onCloseAutoFocus={event => { event.preventDefault(); documentTrigger.current?.focus(); }}><DialogHeader><DialogTitle>OC-0042 · Orden de compra</DialogTitle><DialogDescription>{demoWork.label} / Compras · documento de ejemplo en revisión</DialogDescription></DialogHeader>{generated ? <DocumentPreview title="Orden de compra generada" html={generated.html} /> : null}<Button variant="outline" onClick={download}><Download className="size-4" />Descargar HTML de ejemplo</Button></DialogContent></Dialog>
    </section>
  );
}
