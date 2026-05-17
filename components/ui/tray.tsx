"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Sintesis DS — Tray + Chip
// Tray: contenedor de chips (filtros / acciones) con border 1px, radius 12px, p-1
// Chip: pill interno h-8, px-3, rounded-full, hover fill

interface TrayProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

function Tray({ children, className, ...props }: TrayProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-xl border border-stone-200 bg-white p-1",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  dot?: "extraction" | "manual" | "mixed";
  asChild?: boolean;
}

const DOT_COLORS = {
  extraction: "bg-[var(--src-extraction,#16a34a)]",
  manual:     "bg-[var(--src-manual,#2563eb)]",
  mixed:      "bg-[var(--src-mixed,#9333ea)]",
};

function Chip({ active, dot, children, className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
        active
          ? "bg-stone-900 text-white"
          : "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
        className,
      )}
      {...props}
    >
      {dot && (
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", DOT_COLORS[dot])} />
      )}
      {children}
    </button>
  );
}

export { Tray, Chip };
