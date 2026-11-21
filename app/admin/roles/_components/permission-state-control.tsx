"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PermissionState = "inherit" | "grant" | "deny";
const options = [
  { value: "inherit", label: "Heredar", variant: "dark" },
  { value: "grant", label: "Permitir", variant: "success" },
  { value: "deny", label: "Bloquear", variant: "destructive" },
] as const;

export function PermissionStateControl({ value, onChange, disabled, label, className }: {
  value: PermissionState;
  onChange: (value: PermissionState) => void;
  disabled?: boolean;
  label: string;
  className?: string;
}) {
  return <div role="group" aria-label={label} className={cn("grid shrink-0 grid-cols-3 gap-1", className)}>
    {options.map(option => <Button key={option.value} type="button" size="sm" variant={value === option.value ? option.variant : "ghost"} aria-pressed={value === option.value} disabled={disabled} onClick={() => onChange(option.value)}>{option.label}</Button>)}
  </div>;
}
