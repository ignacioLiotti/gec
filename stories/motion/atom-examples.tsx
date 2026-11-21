import React, { useState } from "react";
import { Button } from "./vendor/beautiful/components/atoms/Button";
import { Switch } from "./vendor/beautiful/components/atoms/Switch";
import { SegmentedControl } from "./vendor/beautiful/components/atoms/SegmentedControl";
import { ProgressRing } from "./vendor/beautiful/components/atoms/ProgressRing";
import { useAsyncAction } from "./vendor/interior/components/interior/loading-button";
import { motion, useReducedMotion } from "./reference-runtime";
import { Button as SintesisButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function ButtonExample({ variant = "secondary" }: { variant?: string }) {
  const [count, setCount] = useState(0);
  const tone = variant as "primary" | "secondary" | "ghost" | "accent" | "success" | "quiet";
  return <div className="flex flex-wrap items-center gap-3">
    {(["xs", "sm", "md"] as const).map(size => <Button key={size} variant={tone} size={size} onClick={() => setCount(count + 1)}>Guardar · {size}</Button>)}
    <Button variant={tone} disabled>Deshabilitado</Button><span role="status">{count} acciones</span>
  </div>;
}

export function SwitchExample() {
  const [checked, setChecked] = useState(false);
  return <div className="flex items-center gap-3"><Switch label="Actualización automática" checked={checked} onChange={setChecked} /><span>Actualización automática</span></div>;
}

export function SegmentedExample() {
  const [value, setValue] = useState("Todos");
  return <SegmentedControl options={["Todos", "OCR", "Manual"]} value={value} onChange={setValue} />;
}

export function ProgressExample({ variant = "orange" }: { variant?: string }) {
  const [progress, setProgress] = useState(0.25);
  return <div className="flex flex-wrap items-center gap-3">
    <ProgressRing progress={progress} tone={variant as "orange" | "green" | "red" | "accent"}>{Math.round(progress * 100)}</ProgressRing>
    <Badge variant="secondary">{Math.round(progress * 100)}% verificado</Badge>
    <SintesisButton variant="outline" onClick={() => setProgress(progress >= 1 ? 0 : progress + 0.25)}>Avanzar</SintesisButton>
  </div>;
}

export function LoadingExample({ variant = "Éxito" }: { variant?: string }) {
  const reduced = useReducedMotion();
  const disabled = variant === "Deshabilitado";
  const { status, run, pending } = useAsyncAction({ action: () => new Promise((resolve, reject) => {
    setTimeout(() => variant === "Error" ? reject(new Error("Error simulado")) : resolve(undefined), 900);
  }) });
  const label = loadingFaces.find(face => face.key === status)!.text;
  return <>
    <MotionSintesisButton className="motion-sintesis-loading" disabled={disabled} aria-label={label} aria-busy={pending || undefined} aria-disabled={pending || undefined}
      whileTap={disabled || pending || reduced ? undefined : { y: 1 }} transition={CELL}
      onClick={event => { if (pending) { event.preventDefault(); return; } run(); }}>
      <span aria-hidden className="relative grid place-items-center">
        {loadingFaces.map(face => <motion.span key={face.key} initial={false}
          animate={face.key === status ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: 3, filter: "blur(3px)" }}
          transition={reduced ? { duration: 0 } : CROSSFADE}
          className="col-start-1 row-start-1 flex items-center justify-center gap-1.5 whitespace-nowrap">
          {face.key === "pending" && <motion.svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="size-3"
            animate={reduced ? undefined : { rotate: 360 }} transition={reduced ? undefined : { duration: 0.85, repeat: Infinity, ease: "linear" }}>
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.22" /><path d="M10.5 6A4.5 4.5 0 0 0 6 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </motion.svg>}
          {face.key === "success" && <svg viewBox="0 0 12 12" fill="none" className="size-3"><path d="M2.6 6.3 4.9 8.6 9.4 3.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          {face.key === "error" && <svg viewBox="0 0 12 12" fill="none" className="size-3"><path d="M6 2.9v3.5M6 9.05h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>}
          {face.text}
        </motion.span>)}
      </span>
    </MotionSintesisButton>
    <span role="status" aria-live="polite" className="sr-only">{status === "success" || status === "error" ? label : ""}</span>
  </>;
}

// Interior MIT, loading-button.tsx at the pinned manifest commit. These are its
// original motion constants and face choreography, rendered inside Sintesis's
// canonical Button. The async state machine is imported unchanged above.
const MotionSintesisButton = motion.create(SintesisButton);
const CELL = { type: "spring", stiffness: 520, damping: 34, mass: 0.45 } as const;
const CROSSFADE = { type: "spring", stiffness: 260, damping: 34, mass: 0.8 } as const;
const loadingFaces = [
  { key: "idle", text: "Guardar cambios" }, { key: "pending", text: "Guardando" },
  { key: "success", text: "Guardado" }, { key: "error", text: "Reintentar" },
];
