"use client";

import { useLayoutEffect, useMemo, useRef } from "react";

import { applyTemplateFormulaInputData, renderDocumentHtml } from "@/lib/document-generation";
import { buildSpecSampleInput, compileTemplateSpec, type TemplateSpec } from "@/lib/document-template-spec";

import type { CanvasChange } from "./builder-canvas";

/**
 * The printed document as the assistant edits it: the same HTML the PDF uses,
 * rendered in a shadow root so its styles stay isolated. Every part carries
 * data-k, so an edit animates as a layout transition: new parts fly in from
 * the nearest side, moved parts slide, removed parts fade, changed parts glow.
 */

const PREVIEW_STYLE = `
:host{display:block}
.dg-doc{position:relative}
.dg-ghosts{position:absolute;inset:0;pointer-events:none}
.dg-ghosts>*{position:absolute!important;margin:0!important}
.dg-flash{animation:dg-flash 1.9s ease-out;border-radius:4px}
@keyframes dg-flash{0%,30%{box-shadow:0 0 0 3px rgba(255,88,0,.45),0 0 0 8px rgba(255,88,0,.1);background-color:rgba(255,88,0,.06)}100%{box-shadow:0 0 0 0 transparent;background-color:transparent}}
`;

type Box = { element: HTMLElement; x: number; y: number; width: number; height: number };

function collect(root: ShadowRoot) {
  const boxes = new Map<string, Box>();
  const doc = root.querySelector<HTMLElement>(".dg-doc");
  if (!doc) return boxes;
  const origin = doc.getBoundingClientRect();
  root.querySelectorAll<HTMLElement>("[data-k]").forEach((element) => {
    const rect = element.getBoundingClientRect();
    boxes.set(element.dataset.k!, { element, x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width, height: rect.height });
  });
  return boxes;
}

/** Table cells repeat per row, so they get keys from their column header and row. */
function keyTableCells(root: ShadowRoot) {
  root.querySelectorAll("table").forEach((table) => {
    const keys = [...table.querySelectorAll<HTMLElement>("thead th")].map((th) => th.dataset.k ?? "");
    table.querySelectorAll("tbody tr").forEach((row, rowIndex) => {
      row.querySelectorAll<HTMLElement>("td").forEach((cell, cellIndex) => {
        if (keys[cellIndex]) cell.dataset.k = `${keys[cellIndex]}:${rowIndex}`;
      });
    });
  });
}

function keyedParent(element: HTMLElement) {
  let parent = element.parentElement;
  while (parent && !parent.dataset.k && !parent.classList.contains("dg-doc")) parent = parent.parentElement;
  return parent?.dataset.k ?? null;
}

/** Change ids use "s:" for sections; the layout uses the bare section id. */
const layoutKey = (id: string) => (id.startsWith("s:") ? id.slice(2) : id);

function previewHtml(spec: TemplateSpec) {
  try {
    const compiled = compileTemplateSpec(spec);
    const sample = applyTemplateFormulaInputData(compiled.schema, buildSpecSampleInput(spec));
    return renderDocumentHtml(compiled.contentHtml, sample, { workName: "Obra de ejemplo", templateName: spec.name });
  } catch {
    return "";
  }
}

export function DocumentPreview({ spec, change }: { spec: TemplateSpec; change: CanvasChange | null }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const html = useMemo(() => previewHtml(spec), [spec]);

  // Rendering into the shadow root is DOM synchronization; measuring before
  // and after the swap must happen before paint, hence a layout effect.
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    const before = collect(root);
    root.innerHTML = `<style>${PREVIEW_STYLE}</style>${html}`;
    keyTableCells(root);
    const doc = root.querySelector<HTMLElement>(".dg-doc");
    if (!doc) return;
    const ghosts = document.createElement("div");
    ghosts.className = "dg-ghosts";
    doc.appendChild(ghosts);
    const after = collect(root);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !change) return;

    const added = new Set([...change.added.keys()].map(layoutKey));
    const changed = new Set([...change.changed].map(layoutKey));
    const firstPaint = before.size === 0;
    const width = doc.getBoundingClientRect().width;

    // Moves, relative to a parent that may itself have moved.
    for (const [key, next] of after) {
      const previous = before.get(key);
      if (!previous) continue;
      const parent = keyedParent(next.element);
      const parentBefore = parent ? before.get(parent) : undefined;
      const parentAfter = parent ? after.get(parent) : undefined;
      const dx = previous.x - next.x - (parentBefore && parentAfter ? parentBefore.x - parentAfter.x : 0);
      const dy = previous.y - next.y - (parentBefore && parentAfter ? parentBefore.y - parentAfter.y : 0);
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        next.element.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 520, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
      }
    }

    // Entrances from the nearest side of the page, staggered in document order.
    let order = 0;
    for (const [key, next] of after) {
      if (before.has(key)) continue;
      const parent = keyedParent(next.element);
      const parentIsNew = Boolean(parent && !before.has(parent));
      if (parentIsNew && !firstPaint) continue;
      const isSection = next.element.tagName === "SECTION" || next.element.tagName === "HEADER";
      if (firstPaint && isSection) {
        next.element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: "backwards", delay: order * 25 });
        continue;
      }
      const center = next.x + next.width / 2;
      const side = center < width / 2 - 8 ? -1 : center > width / 2 + 8 ? 1 : order % 2 ? 1 : -1;
      next.element.animate(
        [
          { transform: `translateX(${side * 320}px)`, opacity: 0, filter: "blur(8px)" },
          { transform: "none", opacity: 1, filter: "blur(0px)" },
        ],
        { duration: 680, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "backwards", delay: Math.min(order * (firstPaint ? 40 : 60), 1400) },
      );
      if (!firstPaint && added.has(key)) next.element.classList.add("dg-flash");
      order += 1;
    }

    // Exits: the old node fades out where it was.
    for (const [key, previous] of before) {
      if (after.has(key)) continue;
      let ancestor = previous.element.parentElement;
      let ancestorRemoved = false;
      while (ancestor) {
        if (ancestor.dataset.k && !after.has(ancestor.dataset.k)) {
          ancestorRemoved = true;
          break;
        }
        ancestor = ancestor.parentElement;
      }
      if (ancestorRemoved) continue;
      const ghost = previous.element;
      ghost.classList.remove("dg-flash");
      Object.assign(ghost.style, { left: `${previous.x}px`, top: `${previous.y}px`, width: `${previous.width}px`, height: `${previous.height}px` });
      ghosts.appendChild(ghost);
      ghost
        .animate(
          [
            { opacity: 1, transform: "none", filter: "blur(0px)" },
            { opacity: 0, transform: "scale(0.96) translateY(-6px)", filter: "blur(6px)" },
          ],
          { duration: 320, easing: "ease-in", fill: "forwards" },
        )
        .addEventListener("finish", () => ghost.remove());
    }

    // Glow on what the edit modified.
    for (const key of changed) after.get(key)?.element.classList.add("dg-flash");

    // Bring the first change into view, above the chat.
    const target = [...added, ...changed].map((key) => after.get(key)?.element).find(Boolean);
    if (target && !firstPaint) {
      window.setTimeout(() => {
        const rect = target.getBoundingClientRect();
        const dock = document.querySelector("[data-assistant-dock] > div");
        const limit = (dock?.getBoundingClientRect().top ?? window.innerHeight) - 24;
        if (rect.bottom > limit) window.scrollBy({ top: rect.bottom - limit, behavior: "smooth" });
        else if (rect.top < 80) window.scrollBy({ top: rect.top - 96, behavior: "smooth" });
      }, 120);
    }
  }, [html, change]);

  return <div ref={hostRef} className="mx-auto w-full max-w-[820px] rounded-sm border border-stroke-soft bg-white shadow-lg" />;
}
