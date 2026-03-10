"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type WizardStepPlacement = "auto" | "top" | "bottom" | "left" | "right";
export type WizardStepRequiredAction = "click_target";

export type WizardStep = {
  id: string;
  targetId: string;
  title: string;
  content: string;
  placement?: WizardStepPlacement;
  allowClickThrough?: boolean;
  skippable?: boolean;
  requiredAction?: WizardStepRequiredAction;
  fallback?: "skip" | "continue";
  waitForMs?: number;
  padding?: number;
  radius?: number;
  beforeShow?: () => void | Promise<void>;
  when?: () => boolean;
};

export type WizardFlow = {
  id: string;
  title: string;
  description?: string;
  steps: WizardStep[];
};

type Rect = { top: number; left: number; width: number; height: number };

type ContextualWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flow: WizardFlow;
  className?: string;
  storageKey?: string;
  onComplete?: () => void;
  onSkip?: () => void;
};

const QUERY_ATTR = "data-wizard-target";

function findTarget(scope: ParentNode, targetId: string): HTMLElement | null {
  return scope.querySelector<HTMLElement>(`[${QUERY_ATTR}="${targetId}"]`);
}

async function waitForTarget(scope: ParentNode, targetId: string, waitForMs: number): Promise<HTMLElement | null> {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= waitForMs) {
    const el = findTarget(scope, targetId);
    if (el) return el;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  return null;
}

function computeTooltipPosition(
  rect: Rect | null,
  placement: WizardStepPlacement,
  tooltipW: number,
  tooltipH: number,
  containerW: number,
  containerH: number,
): { top: number; left: number } {
  if (!rect) {
    return {
      top: Math.max(16, containerH / 2 - tooltipH / 2),
      left: Math.max(16, containerW / 2 - tooltipW / 2),
    };
  }

  const gap = 14;
  const topPos = rect.top - tooltipH - gap;
  const bottomPos = rect.top + rect.height + gap;
  const leftPos = rect.left - tooltipW - gap;
  const rightPos = rect.left + rect.width + gap;
  const centerX = rect.left + rect.width / 2 - tooltipW / 2;
  const centerY = rect.top + rect.height / 2 - tooltipH / 2;

  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  const placeTop = () => ({ top: clamp(topPos, 12, containerH - tooltipH - 12), left: clamp(centerX, 12, containerW - tooltipW - 12) });
  const placeBottom = () => ({ top: clamp(bottomPos, 12, containerH - tooltipH - 12), left: clamp(centerX, 12, containerW - tooltipW - 12) });
  const placeLeft = () => ({ top: clamp(centerY, 12, containerH - tooltipH - 12), left: clamp(leftPos, 12, containerW - tooltipW - 12) });
  const placeRight = () => ({ top: clamp(centerY, 12, containerH - tooltipH - 12), left: clamp(rightPos, 12, containerW - tooltipW - 12) });

  if (placement === "top") return placeTop();
  if (placement === "bottom") return placeBottom();
  if (placement === "left") return placeLeft();
  if (placement === "right") return placeRight();

  if (bottomPos + tooltipH < containerH - 12) return placeBottom();
  if (topPos > 12) return placeTop();
  if (rightPos + tooltipW < containerW - 12) return placeRight();
  return placeLeft();
}

export function ContextualWizard({
  open,
  onOpenChange,
  flow,
  className,
  storageKey,
  onComplete,
  onSkip,
}: ContextualWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [targetReady, setTargetReady] = useState(false);
  const [actionDone, setActionDone] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 16, left: 16 });
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const steps = useMemo(() => flow.steps.filter((s) => (s.when ? s.when() : true)), [flow]);
  const step = steps[stepIndex] ?? null;

  const toLocalRect = (el: HTMLElement, padding: number): Rect | null => {
    const container = rootRef.current?.parentElement;
    if (!container) return null;
    const r = el.getBoundingClientRect();
    const base = container.getBoundingClientRect();
    return {
      top: r.top - base.top - padding,
      left: r.left - base.left - padding,
      width: r.width + padding * 2,
      height: r.height + padding * 2,
    };
  };

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStepIndex(0);
    setActionDone(false);
  }, [open, flow.id]);

  useEffect(() => {
    if (!open || !step) return;
    let cancelled = false;

    const prepare = async () => {
      setTarget(null);
      setRect(null);
      setTargetReady(false);
      setActionDone(false);

      const scope = rootRef.current?.parentElement;
      if (!scope) return;

      if (step.beforeShow) await step.beforeShow();
      const waitForMs = step.waitForMs ?? 2200;
      const el = await waitForTarget(scope, step.targetId, waitForMs);
      if (cancelled) return;

      if (!el) {
        if ((step.fallback ?? "skip") === "skip") {
          setStepIndex((prev) => Math.min(prev + 1, Math.max(steps.length - 1, 0)));
        }
        return;
      }

      setTarget(el);
      setTargetReady(true);
      el.scrollIntoView({ block: "center", behavior: "smooth", inline: "center" });
      const local = toLocalRect(el, step.padding ?? 8);
      if (local) setRect(local);
    };

    void prepare();

    return () => {
      cancelled = true;
    };
  }, [open, step, steps.length]);

  useEffect(() => {
    if (!open || !target || !step) return;

    const update = () => {
      const local = toLocalRect(target, step.padding ?? 8);
      if (local) setRect(local);
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, target, step]);

  useEffect(() => {
    if (!open || !step || !tooltipRef.current) return;
    const container = rootRef.current?.parentElement;
    if (!container) return;
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const rootRect = container.getBoundingClientRect();
    setTooltipPos(
      computeTooltipPosition(
        rect,
        step.placement ?? "auto",
        tooltipRect.width,
        tooltipRect.height,
        rootRect.width,
        rootRect.height,
      ),
    );
  }, [open, rect, step]);

  useEffect(() => {
    if (!open || !step || step.requiredAction !== "click_target" || !target) return;
    const handler = () => setActionDone(true);
    target.addEventListener("click", handler, { once: true });
    return () => target.removeEventListener("click", handler);
  }, [open, step, target]);

  if (!open || !step || typeof window === "undefined") return null;

  const canGoNext = !step.requiredAction || actionDone;
  const allowClickThrough = Boolean(step.allowClickThrough);
  const spotlightRadius = step.radius ?? 10;

  const finishWizard = () => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify({ completedAt: Date.now(), flowId: flow.id }));
    }
    onComplete?.();
    onOpenChange(false);
  };

  return (
    <div ref={rootRef} className="absolute inset-0 z-[120]">
      {rect && targetReady ? (
        <>
          <div
            className={cn("absolute bg-black/45", allowClickThrough ? "pointer-events-none" : "pointer-events-auto")}
            style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top) }}
          />
          <div
            className={cn("absolute bg-black/45", allowClickThrough ? "pointer-events-none" : "pointer-events-auto")}
            style={{ top: rect.top + rect.height, left: 0, right: 0, bottom: 0 }}
          />
          <div
            className={cn("absolute bg-black/45", allowClickThrough ? "pointer-events-none" : "pointer-events-auto")}
            style={{ top: rect.top, left: 0, width: Math.max(0, rect.left), height: rect.height }}
          />
          <div
            className={cn("absolute bg-black/45", allowClickThrough ? "pointer-events-none" : "pointer-events-auto")}
            style={{ top: rect.top, left: rect.left + rect.width, right: 0, height: rect.height }}
          />
        </>
      ) : (
        <div
          className={cn("absolute inset-0 bg-black/45", allowClickThrough ? "pointer-events-none" : "pointer-events-auto")}
          onClick={(e) => {
            if (!allowClickThrough) e.stopPropagation();
          }}
        />
      )}

      {rect && targetReady && (
        <div
          className="pointer-events-none absolute border-2 border-orange-400/90 bg-transparent transition-all duration-150"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            borderRadius: spotlightRadius,
          }}
        />
      )}

      <div
        ref={tooltipRef}
        className={cn("absolute w-[360px] max-w-[calc(100%-24px)] rounded-lg border bg-background p-4 shadow-xl", className)}
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
      >
        <div className="mb-1 text-xs font-medium text-muted-foreground">
          {flow.title} - Paso {Math.min(stepIndex + 1, steps.length)} de {steps.length}
        </div>
        <h4 className="text-sm font-semibold text-foreground">{step.title}</h4>
        <p className="mt-1 text-xs text-muted-foreground">{step.content}</p>

        {!targetReady && <p className="mt-2 text-xs text-amber-600">Esperando el elemento objetivo en pantalla...</p>}

        {step.requiredAction === "click_target" && !actionDone && (
          <p className="mt-2 text-xs text-blue-600">Para continuar, hace clic en el elemento resaltado.</p>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))} disabled={stepIndex === 0}>
              Anterior
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {step.skippable !== false && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onSkip?.();
                  finishWizard();
                }}
              >
                Saltar guia
              </Button>
            )}
            {stepIndex >= steps.length - 1 ? (
              <Button type="button" size="sm" onClick={finishWizard}>
                Finalizar
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={() => setStepIndex((prev) => Math.min(prev + 1, steps.length - 1))} disabled={!canGoNext}>
                Siguiente
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

