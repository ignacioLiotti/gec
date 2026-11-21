"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, BookOpen, MessageSquareText, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { contractHtml, demoWork, invoiceHtml } from "./fixtures";
import { DocumentPreview } from "./document-preview";
import styles from "./demos.module.css";

type Answer = { question: string; text: string; source: "contract" | "invoice" | null };

export function AskDemo({ contextual }: { contextual: boolean }) {
  const [manualWork, setManualWork] = useState("");
  const [folder, setFolder] = useState("all");
  const [question, setQuestion] = useState("¿Cuál es el plazo de ejecución de la obra?");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const sourceTrigger = useRef<HTMLButtonElement>(null);
  const [testCase, setTestCase] = useState("normal");
  const [error, setError] = useState("");
  const scopeReady = contextual || Boolean(manualWork);
  const folderLabel = folder === "all" ? "Todas las carpetas accesibles" : folder;

  function ask(event: FormEvent) {
    event.preventDefault();
    if (!scopeReady || !question.trim() || testCase === "readonly") return;
    setSourceOpen(false);
    if (testCase === "error") { setAnswer(null); setError("No se pudo consultar esta obra. Conservamos la pregunta y el alcance. No se amplió la consulta a otras obras."); return; }
    setError("");
    const normalized = question.toLocaleLowerCase("es-AR");
    if (normalized.includes("plazo") && (folder === "all" || folder === "Contratos")) {
      setAnswer({ question, text: "El contrato establece 12 meses de ejecución desde la firma del acta de inicio. Ese plazo no determina por sí solo una fecha de finalización: hace falta la fecha del acta.", source: "contract" });
    } else if ((normalized.includes("factura") || normalized.includes("monto")) && (folder === "all" || folder === "Compras")) {
      setAnswer({ question, text: "La factura de Materiales del Litoral, del 7 de septiembre de 2026, tiene un total de $ 125.000,00. Es el importe del documento de ejemplo, no el total de compras de la obra.", source: "invoice" });
    } else {
      setAnswer({ question, text: "No hay evidencia para responder esa pregunta en los documentos de este alcance. Probá las preguntas de ejemplo o revisá las carpetas incluidas.", source: null });
    }
  }

  const sourceName = answer?.source === "invoice" ? "Factura 0001-00000042 · página 1" : "Contrato de obra · página 3";
  return (
    <section aria-label="Demo de consulta" className={styles.panel}>
      <div className={styles.demoControls}><label htmlFor="query-case">Caso de prueba</label><NativeSelect id="query-case" value={testCase} onChange={event => { setTestCase(event.target.value); setError(""); }}><option value="normal">Consulta disponible</option><option value="error">Error de consulta</option><option value="readonly">Sin permiso de consulta</option></NativeSelect><span>Respuestas preparadas para estos documentos ficticios.</span></div>
      <div className={styles.panelBody}>
        <div className={styles.sectionHeading}><div><h2>{contextual ? "Consultar esta obra" : "Consultar documentos"}</h2><p>Respuesta y documento de origen, en el mismo recorrido.</p></div><BookOpen className="size-5 text-content-muted" /></div>
        <div className={styles.scopeBar}>
          {contextual ? <div><span className={styles.muted}>Obra incluida</span><strong>{demoWork.label}</strong></div> : <label className={styles.field}><span>Obra incluida</span><NativeSelect value={manualWork} onChange={event => { setManualWork(event.target.value); setAnswer(null); setSourceOpen(false); }}><option value="">Seleccioná una obra</option><option value="demo-ribera">{demoWork.label}</option></NativeSelect></label>}
          <label className={styles.field}><span>Carpetas incluidas</span><NativeSelect value={folder} onChange={event => { setFolder(event.target.value); setAnswer(null); setSourceOpen(false); setError(""); }}><option value="all">Todas las carpetas accesibles</option><option value="Contratos">Contratos</option><option value="Compras">Compras</option><option value="Planos">Planos, sin documentos</option></NativeSelect></label>
        </div>
        {testCase === "readonly" ? <p className={styles.notice} role="status">Tu usuario no tiene permiso para consultar documentos. Cambiar de variante no cambia ese acceso.</p> : <>
          {folder === "Planos" ? <div className={styles.empty}><MessageSquareText className="size-8" /><h3>No hay documentos en Planos</h3><p>Elegí otra carpeta de esta obra. La consulta no se amplía automáticamente.</p></div> : <>
            <div className={styles.suggestions}><span>Preguntas de ejemplo</span><Button variant="outline" onClick={() => setQuestion("¿Cuál es el plazo de ejecución de la obra?")}>Plazo de ejecución</Button><Button variant="outline" onClick={() => setQuestion("¿Cuál es el monto de la factura cargada?")}>Monto de la factura</Button></div>
            {answer && scopeReady ? <div className={styles.conversation}><div className={styles.question}><MessageSquareText className="size-4" /><p>{answer.question}</p></div><div className={styles.answer}><Badge variant={answer.source ? "info" : "warning"}>{answer.source ? "Con documento de respaldo" : "Sin evidencia"}</Badge><p>{answer.text}</p>{answer.source ? <Button ref={sourceTrigger} variant="outline" onClick={() => setSourceOpen(true)}><span className="truncate">{sourceName}</span><ArrowUpRight className="size-3.5" /></Button> : null}</div></div> : <div className={styles.queryEmpty}><h3>Lo que necesitás saber de la obra</h3><p>El alcance queda visible antes de preguntar. Las fuentes abren el documento dentro de la demo.</p></div>}
            <form onSubmit={ask} className={styles.composer}><label className={styles.field}><span>Pregunta</span><Textarea value={question} onChange={event => setQuestion(event.target.value)} required placeholder="Preguntá sobre los documentos de ejemplo" /></label><div className={styles.actionBar}><p>{scopeReady ? `${demoWork.label} · ${folderLabel}` : "Seleccioná una obra antes de consultar"}</p><Button type="submit" disabled={!scopeReady || !question.trim()}><Send className="size-4" />Consultar</Button></div></form>
          </>}
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </>}
      </div>
      <Dialog open={sourceOpen} onOpenChange={setSourceOpen}><DialogContent className="sm:max-w-3xl" onCloseAutoFocus={event => { event.preventDefault(); sourceTrigger.current?.focus(); }}><DialogHeader><DialogTitle>{sourceName}</DialogTitle><DialogDescription>{demoWork.label} · fuente ficticia de la respuesta</DialogDescription></DialogHeader><DocumentPreview title={sourceName} html={answer?.source === "invoice" ? invoiceHtml : contractHtml} /></DialogContent></Dialog>
    </section>
  );
}
