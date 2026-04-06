"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type WizardStepPlacement = "auto" | "top" | "bottom" | "left" | "right";
export type WizardStepRequiredAction = "click_target" | "condition";

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
  isComplete?: () => boolean;
  incompleteHint?: string;
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
  startAtStepId?: string | null;
  storageKey?: string;
  onComplete?: () => void;
  onSkip?: () => void;
  onStepChange?: (step: WizardStep, index: number) => void;
  showCloseButton?: boolean;
  showBackButton?: boolean;
  finishLabel?: string;
  nextLabel?: string;
};

const QUERY_ATTR = "data-wizard-target";
const ACTIVE_BODY_ATTR = "data-contextual-wizard-active";
const ACTIVE_OVERLAY_ATTR = "data-contextual-wizard-overlay";
const ACTIVE_TARGET_ATTR = "data-contextual-wizard-target-active";
const WIZARD_OVERLAY_Z_INDEX = 10000020;

function findTarget(targetId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${QUERY_ATTR}="${targetId}"]`);
}

async function waitForTarget(targetId: string, waitForMs: number): Promise<HTMLElement | null> {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= waitForMs) {
    const el = findTarget(targetId);
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
  startAtStepId,
  storageKey,
  onComplete,
  onSkip,
  onStepChange,
  showCloseButton = true,
  showBackButton = true,
  finishLabel = "Finalizar",
  nextLabel = "Siguiente",
}: ContextualWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [targetReady, setTargetReady] = useState(false);
  const [actionDone, setActionDone] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 16, left: 16 });
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const steps = useMemo(() => flow.steps.filter((s) => (s.when ? s.when() : true)), [flow]);
  const step = steps[stepIndex] ?? null;

  const toViewportRect = (el: HTMLElement, padding: number): Rect | null => {
    const r = el.getBoundingClientRect();
    return {
      top: r.top - padding,
      left: r.left - padding,
      width: r.width + padding * 2,
      height: r.height + padding * 2,
    };
  };

  useEffect(() => {
    if (!open) return;
    const startIndex =
      startAtStepId != null
        ? Math.max(
          0,
          steps.findIndex((candidate) => candidate.id === startAtStepId),
        )
        : 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStepIndex(startIndex);
    setActionDone(false);
  }, [open, flow.id, startAtStepId, steps]);

  useEffect(() => {
    if (!open || !step) return;
    onStepChange?.(step, stepIndex);
  }, [onStepChange, open, step, stepIndex]);

  useEffect(() => {
    if (!open || !step) return;
    let cancelled = false;

    const prepare = async () => {
      setTarget(null);
      setRect(null);
      setTargetReady(false);
      setActionDone(false);

      if (step.beforeShow) await step.beforeShow();
      const waitForMs = step.waitForMs ?? 2200;
      const el = await waitForTarget(step.targetId, waitForMs);
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
      const local = toViewportRect(el, step.padding ?? 8);
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
      const local = toViewportRect(target, step.padding ?? 8);
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
    if (!open) return;

    document.body.setAttribute(ACTIVE_BODY_ATTR, "true");
    return () => {
      document.body.removeAttribute(ACTIVE_BODY_ATTR);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !target) return;

    target.setAttribute(ACTIVE_TARGET_ATTR, "true");
    return () => {
      target.removeAttribute(ACTIVE_TARGET_ATTR);
    };
  }, [open, target]);

  useEffect(() => {
    if (!open || !step || !tooltipRef.current) return;
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    setTooltipPos(
      computeTooltipPosition(
        rect,
        step.placement ?? "auto",
        tooltipRect.width,
        tooltipRect.height,
        window.innerWidth,
        window.innerHeight,
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

  const conditionDone = step.requiredAction === "condition" ? Boolean(step.isComplete?.()) : true;
  const canContinueWithoutTarget =
    step.requiredAction === "click_target" &&
    !targetReady &&
    (step.fallback ?? "skip") === "continue";
  const canGoNext =
    !step.requiredAction ||
    (step.requiredAction === "click_target" ? actionDone || canContinueWithoutTarget : conditionDone);
  const spotlightRadius = step.radius ?? 10;

  const finishWizard = () => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify({ completedAt: Date.now(), flowId: flow.id }));
    }
    onComplete?.();
    onOpenChange(false);
  };

  return (
    <>
      <style jsx global>{`
        body[${ACTIVE_BODY_ATTR}="true"] * {
          pointer-events: none !important;
        }

        body[${ACTIVE_BODY_ATTR}="true"] [${ACTIVE_TARGET_ATTR}="true"],
        body[${ACTIVE_BODY_ATTR}="true"] [${ACTIVE_TARGET_ATTR}="true"] *,
        body[${ACTIVE_BODY_ATTR}="true"] [${ACTIVE_OVERLAY_ATTR}="true"],
        body[${ACTIVE_BODY_ATTR}="true"] [${ACTIVE_OVERLAY_ATTR}="true"] * {
          pointer-events: auto !important;
        }
      `}</style>

      <div className="pointer-events-none fixed inset-0" style={{ zIndex: WIZARD_OVERLAY_Z_INDEX }}>
        {rect && targetReady ? (
          <>
            <div
              className="fixed bg-black/45"
              style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top) }}
            />
            <div
              className="fixed bg-black/45"
              style={{ top: rect.top + rect.height, left: 0, right: 0, bottom: 0 }}
            />
            <div
              className="fixed bg-black/45"
              style={{ top: rect.top, left: 0, width: Math.max(0, rect.left), height: rect.height }}
            />
            <div
              className="fixed bg-black/45"
              style={{ top: rect.top, left: rect.left + rect.width, right: 0, height: rect.height }}
            />
          </>
        ) : (
          <div className="fixed inset-0 bg-black/45" />
        )}

        {rect && targetReady && (
          <div
            className="pointer-events-none fixed border-2 border-orange-400/90 bg-transparent transition-all duration-150"
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
          data-contextual-wizard-overlay="true"
          className={cn("pointer-events-auto fixed w-[360px] max-w-[calc(100%-24px)] rounded-lg border bg-background p-4 shadow-xl", className)}
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

          {step.requiredAction === "condition" && !conditionDone && step.incompleteHint ? (
            <p className="mt-2 text-xs text-blue-600">{step.incompleteHint}</p>
          ) : null}

          <div className="mt-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {showBackButton ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))} disabled={stepIndex === 0}>
                  Anterior
                </Button>
              ) : null}
              {showCloseButton ? (
                <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Cerrar
                </Button>
              ) : null}
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
                <Button type="button" size="sm" onClick={finishWizard} disabled={!canGoNext}>
                  {finishLabel}
                </Button>
              ) : (
                <Button type="button" size="sm" onClick={() => setStepIndex((prev) => Math.min(prev + 1, steps.length - 1))} disabled={!canGoNext}>
                  {nextLabel}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

