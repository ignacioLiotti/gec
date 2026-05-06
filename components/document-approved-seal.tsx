"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

type DocumentApprovedSealProps = {
  status?: string | null;
  size?: "sm" | "md";
  className?: string;
};

const SIZE_STYLES = {
  sm: {
    outer: "h-11 w-11",
    inset: "inset-[4px]",
    icon: "h-3.5 w-3.5",
    text: "text-[7px] tracking-[0.2em]",
  },
  md: {
    outer: "h-14 w-14",
    inset: "inset-[5px]",
    icon: "h-4 w-4",
    text: "text-[8px] tracking-[0.22em]",
  },
} as const;

export function DocumentApprovedSeal({
  status,
  size = "sm",
  className,
}: DocumentApprovedSealProps) {
  if (status !== "APPROVED") {
    return null;
  }

  const styles = SIZE_STYLES[size];

  return (
    <div
      aria-label="Documento aprobado"
      title="Documento aprobado"
      className={cn(
        "relative inline-flex items-center justify-center rounded-full border-[2.5px] border-emerald-600/80 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.98)_0%,rgba(236,253,245,0.96)_72%,rgba(209,250,229,0.92)_100%)] text-emerald-700 shadow-[0_8px_18px_-14px_rgba(5,150,105,0.9)] rotate-[-12deg]",
        styles.outer,
        className,
      )}
    >
      <div className={cn("absolute rounded-full border border-dashed border-emerald-500/70", styles.inset)} />
      <div className="relative flex flex-col items-center justify-center leading-none">
        <Check className={cn("mb-0.5", styles.icon)} strokeWidth={2.8} />
        <span className={cn("font-black uppercase", styles.text)}>Aprobado</span>
      </div>
    </div>
  );
}
