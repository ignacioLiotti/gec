"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, FileText, Paperclip, Sparkles, Upload } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { listSpecFields, type TemplateSpec } from "@/lib/document-template-spec";
import { cn } from "@/lib/utils";

import { sectionFieldList } from "./spec-editing";
import {
  ASSISTANT_FILE_ACCEPT,
  type AssistantAttachmentPreview,
  type AssistantChatMessage,
} from "./use-template-assistant";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

const WORKING_STEPS = ["Leyendo la plantilla…", "Aplicando los cambios…", "Revisando fórmulas y vínculos…"];
const READING_STEPS = ["Leyendo el documento…", "Identificando campos y tablas…", "Armando la plantilla…", "Revisando fórmulas y vínculos…"];

/** Requests that make sense for the current template; the model answers them for real. */
export function assistantSuggestions(spec: TemplateSpec, blank: boolean): string[] {
  if (blank) {
    return [
      "Armame una factura de compra con ítems, IVA 21% y total",
      "Armame un remito de entrega con firma de quien recibe",
      "Armame un acta de recepción de materiales vinculada a la orden de compra",
    ];
  }
  const suggestions: string[] = [];
  const tables = spec.sections.filter((section) => section.kind === "table");
  const table = tables[0];
  if (table && !table.columns.some((column) => column.type === "formula")) {
    suggestions.push("Agregá una columna Total que sea cantidad por precio unitario");
  }
  if (table && !spec.sections.some((section) => section.kind === "totals")) {
    suggestions.push("Abajo sumá los totales y agregá el IVA del 21%");
  }
  const person = listSpecFields(spec).find(
    (field) => (field.type === "text" || field.type === "select") && !field.includeUsers && /recib|responsable|gestor|solicit|retir|encargad/i.test(field.label),
  );
  if (person) suggestions.push(`Que «${person.label}» sea un usuario del equipo, buscado por nombre o mail`);
  if (!spec.sections.some((section) => section.kind === "signatures")) suggestions.push("Agregá un pie con lugar para dos firmas");
  if (!spec.style?.accent) suggestions.push("Usá el azul de la marca como color");
  const longText = spec.sections.flatMap(sectionFieldList).find((field) => field.type === "textarea" && field.width !== "full");
  if (longText) suggestions.push(`Poné «${longText.label}» a lo ancho`);
  suggestions.push("Ordená los campos para que sea más rápido de completar");
  return suggestions.slice(0, 4);
}

/** Progress line while a request runs; it mounts with the request, so it starts at the first step. */
function WorkingStatus({ steps }: { steps: string[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setIndex((current) => Math.min(current + 1, steps.length - 1)), 2600);
    return () => window.clearInterval(timer);
  }, [steps.length]);
  return <Shimmer>{steps[index]}</Shimmer>;
}

function Markdownish({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
        part.startsWith("**") && part.endsWith("**") ? <strong key={index} className="font-semibold text-content">{part.slice(2, -2)}</strong> : part,
      )}
    </>
  );
}

function Shimmer({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.span
      className="bg-[linear-gradient(90deg,var(--content-muted)_0%,var(--content-muted)_40%,var(--content)_50%,var(--content-muted)_60%,var(--content-muted)_100%)] bg-[length:220%_100%] bg-clip-text text-transparent"
      initial={{ backgroundPositionX: "120%" }}
      animate={reduceMotion ? undefined : { backgroundPositionX: "-120%" }}
      transition={{ duration: 1.4, ease: "linear", repeat: Infinity }}
    >
      {children}
    </motion.span>
  );
}

function SparkMark() {
  return (
    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg bg-orange-primary text-white">
      <Sparkles className="size-3.5" />
    </span>
  );
}

type DockProps = {
  messages: AssistantChatMessage[];
  pending: { attachment?: AssistantAttachmentPreview } | null;
  suggestions: string[];
  lastUndoableId: string | null;
  onSend: (text: string, file?: File | null) => void;
  onUndo: (messageId: string) => void;
};

/** Chat bar centered at the bottom of the screen, over the template. */
export function AssistantDock({ messages, pending, suggestions, lastUndoableId, onSend, onUndo }: DockProps) {
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  // Keep the latest message in view as the thread grows.
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, pending]);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const submit = (text: string) => {
    if (pending || (!text.trim() && !file)) return;
    onSend(text, file);
    setDraft("");
    setFile(null);
  };

  return (
    <motion.div
      data-assistant-dock
      initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease: EASE_OUT, delay: 0.12 } }}
      exit={{ opacity: 0, y: 24, filter: "blur(6px)", transition: { duration: 0.22, ease: "easeIn" } }}
      className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4"
    >
      <div className="pointer-events-auto w-full max-w-[680px] rounded-2xl border border-stroke-soft bg-surface/90 p-1.5 shadow-2xl backdrop-blur-xl">
        {messages.length || pending ? (
          <div
            ref={threadRef}
            className="flex max-h-[min(30vh,260px)] flex-col gap-3 overflow-y-auto px-2 pb-2 pt-3 [mask-image:linear-gradient(to_bottom,transparent,black_20px)] [scrollbar-width:none]"
          >
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10, filter: "blur(3px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.35, ease: EASE_OUT } }}
                  className={cn("flex gap-2.5", message.role === "user" && "justify-end")}
                >
                  {message.role === "user" ? (
                    <div className="flex max-w-[80%] flex-col items-end gap-1.5">
                      {message.attachment ? <AttachmentChip attachment={message.attachment} /> : null}
                      <div className="rounded-2xl rounded-br-md bg-content px-3 py-2 text-sm text-surface">{message.text}</div>
                    </div>
                  ) : (
                    <>
                      <SparkMark />
                      <div className="min-w-0 max-w-[90%] text-sm leading-relaxed text-content-secondary">
                        <p className={cn(message.failed && "text-destructive")}>
                          <Markdownish text={message.text} />
                        </p>
                        {message.changes?.length ? (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {message.changes.map((change) => (
                              <span
                                key={change}
                                className={
                                  change.startsWith("fx")
                                    ? "rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-orange-primary"
                                    : "rounded-full bg-surface-recessed px-2 py-0.5 text-[11px] font-medium text-content-secondary"
                                }
                              >
                                {change}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {message.undone ? (
                          <span className="mt-1 inline-block text-xs text-content-muted">Deshecho</span>
                        ) : message.id === lastUndoableId ? (
                          <button
                            type="button"
                            onClick={() => onUndo(message.id)}
                            className="mt-1 text-xs text-content-muted underline underline-offset-2 hover:text-content"
                          >
                            Deshacer
                          </button>
                        ) : null}
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
              {pending ? (
                <motion.div key="pending" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex gap-2.5">
                  <SparkMark />
                  <p className="text-sm">
                    <WorkingStatus steps={pending.attachment ? READING_STEPS : WORKING_STEPS} />
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ) : null}

        {!pending && suggestions.length ? (
          <div className="flex gap-1.5 overflow-x-auto px-1 pb-2 pt-1 [mask-image:linear-gradient(to_right,black_85%,transparent)] [scrollbar-width:none]">
            {suggestions.map((suggestion, index) => (
              <motion.button
                key={suggestion}
                type="button"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0, transition: { delay: index * 0.04, duration: 0.3, ease: EASE_OUT } }}
                onClick={() => submit(suggestion)}
                className="shrink-0 whitespace-nowrap rounded-full border border-stroke-soft bg-surface px-3 py-1.5 text-[13px] text-content-secondary transition-colors hover:border-stroke-strong hover:text-content active:scale-[0.97]"
              >
                {suggestion}
              </motion.button>
            ))}
          </div>
        ) : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(draft);
          }}
          className="flex items-center gap-1 rounded-xl border border-stroke-soft bg-surface p-1"
        >
          <input
            ref={fileRef}
            type="file"
            accept={ASSISTANT_FILE_ACCEPT}
            hidden
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              event.target.value = "";
              inputRef.current?.focus();
            }}
          />
          <Button type="button" variant="ghost" size="icon" aria-label="Adjuntar PDF o imagen" onClick={() => fileRef.current?.click()} disabled={Boolean(pending)}>
            <Paperclip />
          </Button>
          {file ? (
            <button type="button" onClick={() => setFile(null)} className="shrink-0" aria-label={`Quitar ${file.name}`}>
              <AttachmentChip attachment={{ name: file.name, kind: file.type === "application/pdf" ? "pdf" : "image", url: null }} />
            </button>
          ) : null}
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
            placeholder={file ? "Contá qué documento es (opcional)…" : "Pedile un cambio a la plantilla…"}
            aria-label="Pedido al asistente"
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[15px] text-content outline-none placeholder:text-content-muted"
            disabled={Boolean(pending)}
          />
          <Button type="submit" size="icon" aria-label="Enviar" disabled={Boolean(pending) || (!draft.trim() && !file)}>
            <ArrowUp />
          </Button>
        </form>
      </div>
    </motion.div>
  );
}

function AttachmentChip({ attachment }: { attachment: AssistantAttachmentPreview }) {
  return (
    <span className="inline-flex max-w-[220px] items-center gap-1.5 rounded-lg border border-stroke-soft bg-surface-recessed px-2 py-1 text-xs text-content-secondary">
      {attachment.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
        <img src={attachment.url} alt="" className="size-5 rounded object-cover" />
      ) : (
        <FileText className="size-3.5 shrink-0" />
      )}
      <span className="truncate">{attachment.name}</span>
    </span>
  );
}

/** Starting point for an empty template: drop a photo or PDF of the real document. */
export function AssistantDropzone({ onFile }: { onFile: (file: File) => void }) {
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <motion.label
      initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.45, ease: EASE_OUT } }}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        const file = event.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
      className={cn(
        "mx-auto mt-[8vh] flex w-full max-w-[780px] cursor-pointer flex-col items-center rounded-3xl border-[1.5px] border-dashed border-stroke-strong bg-surface px-6 py-14 text-center transition-[border-color,background-color,transform] duration-200",
        over && "scale-[1.01] border-orange-primary bg-accent-soft",
      )}
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-content text-surface">
        <Upload className="size-5" />
      </span>
      <span className="mt-4 text-lg font-semibold text-content">Soltá una foto o PDF del documento</span>
      <span className="mt-1 text-sm text-content-muted">Armo la plantilla copiando sus campos, tabla y totales.</span>
      <span className="mt-5 flex flex-wrap justify-center gap-1.5">
        {["Factura", "Remito", "Orden de compra", "Recibo"].map((kind) => (
          <span key={kind} className="rounded-full border border-stroke-soft bg-surface-recessed px-2.5 py-0.5 text-xs text-content-secondary">
            {kind}
          </span>
        ))}
      </span>
      <span className="mt-5 rounded-lg border border-stroke bg-surface px-3.5 py-1.5 text-sm font-medium text-content">Elegir archivo</span>
      <input
        ref={fileRef}
        type="file"
        accept={ASSISTANT_FILE_ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
    </motion.label>
  );
}

/** Shown while the model reads an attached document for a new template. */
export function AssistantReading({ attachment }: { attachment: AssistantAttachmentPreview }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.45, ease: EASE_OUT } }}
      exit={{ opacity: 0, filter: "blur(4px)", transition: { duration: 0.2 } }}
      className="mx-auto mt-[8vh] grid w-full max-w-[780px] items-center gap-7 rounded-3xl border border-stroke-soft bg-surface p-7 sm:grid-cols-[200px_1fr]"
    >
      <div className="relative mx-auto aspect-[3/4] w-40 overflow-hidden rounded-xl border border-stroke-soft bg-white shadow-lg sm:w-full">
        {attachment.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
          <img src={attachment.url} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex flex-col gap-2 p-4">
            <span className="h-2.5 w-1/2 rounded bg-surface-recessed" />
            {Array.from({ length: 9 }, (_, index) => (
              <span key={index} className="h-1.5 rounded bg-surface-recessed" style={{ width: `${55 + ((index * 37) % 45)}%` }} />
            ))}
          </div>
        )}
        {reduceMotion ? null : (
          <motion.span
            aria-hidden
            className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-orange-primary/20 to-orange-primary/60"
            initial={{ top: "-4rem" }}
            animate={{ top: "100%" }}
            transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1], repeat: Infinity }}
          />
        )}
      </div>
      <div>
        <div className="font-mono text-xs text-content-muted">{attachment.name}</div>
        <div className="mt-1 text-lg font-semibold text-content">
          <WorkingStatus steps={READING_STEPS} />
        </div>
      </div>
    </motion.div>
  );
}
