'use client';

import { useState } from "react";
import type { ReactNode } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function FilterSection({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  activeCount = 0,
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  defaultOpen?: boolean;
  activeCount?: number;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted/50 data-[state=open]:rounded-b-none data-[state=open]:border-b-0">
        <div className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span>{title}</span>
          {activeCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="rounded-b-lg border border-t-0 bg-background px-3 py-3 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function RangeInputGroup({
  label,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  minPlaceholder = "Min",
  maxPlaceholder = "Max",
}: {
  label: string;
  minValue: string;
  maxValue: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
  minPlaceholder?: string;
  maxPlaceholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          value={minValue}
          onChange={(e) => onMinChange(e.target.value)}
          placeholder={minPlaceholder}
          className="h-8 text-sm"
        />
        <span className="text-xs text-muted-foreground">a</span>
        <Input
          value={maxValue}
          onChange={(e) => onMaxChange(e.target.value)}
          placeholder={maxPlaceholder}
          className="h-8 text-sm"
        />
      </div>
    </div>
  );
}

export function TextFilterInput({
  label,
  value,
  onChange,
  placeholder = "Filtrar...",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 text-sm"
      />
    </div>
  );
}
