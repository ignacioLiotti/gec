'use client';

import { useState } from "react";
import type { ReactNode } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type TextFilterCondition =
  | "contains"
  | "not_contains"
  | "equals"
  | "starts_with"
  | "ends_with"
  | "empty"
  | "not_empty";

export type NumberFilterCondition =
  | "equals"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "empty"
  | "not_empty";

export type DateFilterCondition =
  | "equals"
  | "before"
  | "after"
  | "between"
  | "from_until_today"
  | "until"
  | "today"
  | "this_week"
  | "this_month"
  | "this_year"
  | "last_7_days"
  | "last_30_days"
  | "next_7_days"
  | "next_30_days"
  | "overdue"
  | "not_overdue"
  | "empty"
  | "not_empty";

export type BooleanFilterCondition = "all" | "yes" | "no";
export type EnumFilterMode = "include" | "exclude";

export type TextFilterValue = {
  condition: TextFilterCondition;
  value: string;
};

export type NumberFilterValue = {
  condition: NumberFilterCondition;
  value: string;
  min: string;
  max: string;
};

export type DateFilterValue = {
  condition: DateFilterCondition;
  value: string;
  start: string;
  end: string;
};

export type EnumFilterOption = {
  value: string;
  label: string;
};

export type EnumFilterValue = {
  mode: EnumFilterMode;
  values: string[];
};

const textConditionLabels: Record<TextFilterCondition, string> = {
  contains: "Contiene",
  not_contains: "No contiene",
  equals: "Es exactamente",
  starts_with: "Empieza con",
  ends_with: "Termina con",
  empty: "Esta vacio",
  not_empty: "No esta vacio",
};

const numberConditionLabels: Record<NumberFilterCondition, string> = {
  equals: "Igual a",
  gt: "Mayor que",
  gte: "Mayor o igual que",
  lt: "Menor que",
  lte: "Menor o igual que",
  between: "Entre",
  empty: "Esta vacio",
  not_empty: "No esta vacio",
};

const dateConditionLabels: Record<DateFilterCondition, string> = {
  equals: "Es exactamente",
  before: "Antes de",
  after: "Despues de",
  between: "Entre fechas",
  from_until_today: "Desde una fecha hasta hoy",
  until: "Hasta una fecha",
  today: "Hoy",
  this_week: "Esta semana",
  this_month: "Este mes",
  this_year: "Este ano",
  last_7_days: "Ultimos 7 dias",
  last_30_days: "Ultimos 30 dias",
  next_7_days: "Proximos 7 dias",
  next_30_days: "Proximos 30 dias",
  overdue: "Esta vencido",
  not_overdue: "No esta vencido",
  empty: "Esta vacio",
  not_empty: "No esta vacio",
};

export const getTextConditionLabel = (condition: TextFilterCondition) =>
  textConditionLabels[condition];

export const getNumberConditionLabel = (condition: NumberFilterCondition) =>
  numberConditionLabels[condition];

export const getDateConditionLabel = (condition: DateFilterCondition) =>
  dateConditionLabels[condition];

export const createTextFilterValue = (
  condition: TextFilterCondition = "contains"
): TextFilterValue => ({ condition, value: "" });

export const createNumberFilterValue = (
  condition: NumberFilterCondition = "between"
): NumberFilterValue => ({ condition, value: "", min: "", max: "" });

export const createDateFilterValue = (
  condition: DateFilterCondition = "between"
): DateFilterValue => ({ condition, value: "", start: "", end: "" });

export const createEnumFilterValue = (
  mode: EnumFilterMode = "include"
): EnumFilterValue => ({ mode, values: [] });

const textConditions: TextFilterCondition[] = [
  "contains",
  "not_contains",
  "equals",
  "starts_with",
  "ends_with",
  "empty",
  "not_empty",
];

const numberConditions: NumberFilterCondition[] = [
  "equals",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "empty",
  "not_empty",
];

const dateConditions: DateFilterCondition[] = [
  "equals",
  "before",
  "after",
  "between",
  "from_until_today",
  "until",
  "today",
  "this_week",
  "this_month",
  "this_year",
  "last_7_days",
  "last_30_days",
  "next_7_days",
  "next_30_days",
  "overdue",
  "not_overdue",
  "empty",
  "not_empty",
];

function FilterFieldShell({
  label,
  description,
  onClear,
  children,
}: {
  label: string;
  description: string;
  onClear: () => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-md border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Label className="text-xs font-semibold text-foreground">{label}</Label>
          <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
            {description}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="size-7 shrink-0 p-0 text-muted-foreground hover:text-foreground"
          aria-label={`Limpiar filtro ${label}`}
        >
          <X className="size-3.5" />
        </Button>
      </div>
      {children}
    </div>
  );
}

function ConditionSelect<TValue extends string>({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: TValue;
  options: TValue[];
  labels: Record<TValue, string>;
  onChange: (value: TValue) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={(next) => onChange(next as TValue)}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {labels[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function TextConditionFilter({
  label,
  value,
  onChange,
  onClear,
  placeholder = "Valor...",
}: {
  label: string;
  value: TextFilterValue;
  onChange: (value: TextFilterValue) => void;
  onClear: () => void;
  placeholder?: string;
}) {
  const needsValue = value.condition !== "empty" && value.condition !== "not_empty";
  const description = needsValue
    ? `${label} - ${textConditionLabels[value.condition].toLowerCase()} "${value.value || "..."}"`
    : `${label} - ${textConditionLabels[value.condition].toLowerCase()}`;

  return (
    <FilterFieldShell label={label} description={description} onClear={onClear}>
      <div className="space-y-2">
        <ConditionSelect
          label="Condicion"
          value={value.condition}
          options={textConditions}
          labels={textConditionLabels}
          onChange={(condition) => onChange({ ...value, condition })}
        />
        {needsValue && (
          <Input
            value={value.value}
            onChange={(event) => onChange({ ...value, value: event.target.value })}
            placeholder={placeholder}
            className="h-8 text-sm"
          />
        )}
      </div>
    </FilterFieldShell>
  );
}

export function NumberConditionFilter({
  label,
  value,
  onChange,
  onClear,
  placeholder = "Valor",
}: {
  label: string;
  value: NumberFilterValue;
  onChange: (value: NumberFilterValue) => void;
  onClear: () => void;
  placeholder?: string;
}) {
  const needsSingleValue =
    value.condition !== "between" &&
    value.condition !== "empty" &&
    value.condition !== "not_empty";
  const needsRange = value.condition === "between";
  const description = needsRange
    ? `${label} - entre ${value.min || "..."} y ${value.max || "..."}`
    : needsSingleValue
      ? `${label} - ${numberConditionLabels[value.condition].toLowerCase()} ${value.value || "..."}`
      : `${label} - ${numberConditionLabels[value.condition].toLowerCase()}`;

  return (
    <FilterFieldShell label={label} description={description} onClear={onClear}>
      <div className="space-y-2">
        <ConditionSelect
          label="Condicion"
          value={value.condition}
          options={numberConditions}
          labels={numberConditionLabels}
          onChange={(condition) => onChange({ ...value, condition })}
        />
        {needsSingleValue && (
          <Input
            inputMode="decimal"
            value={value.value}
            onChange={(event) => onChange({ ...value, value: event.target.value })}
            placeholder={placeholder}
            className="h-8 text-sm"
          />
        )}
        {needsRange && (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <Input
              inputMode="decimal"
              value={value.min}
              onChange={(event) => onChange({ ...value, min: event.target.value })}
              placeholder="Minimo"
              className="h-8 text-sm"
            />
            <span className="text-xs text-muted-foreground">a</span>
            <Input
              inputMode="decimal"
              value={value.max}
              onChange={(event) => onChange({ ...value, max: event.target.value })}
              placeholder="Maximo"
              className="h-8 text-sm"
            />
          </div>
        )}
      </div>
    </FilterFieldShell>
  );
}

export function DateConditionFilter({
  label,
  value,
  onChange,
  onClear,
}: {
  label: string;
  value: DateFilterValue;
  onChange: (value: DateFilterValue) => void;
  onClear: () => void;
}) {
  const needsSingleValue = ["equals", "before", "after", "from_until_today", "until"].includes(value.condition);
  const needsRange = value.condition === "between";
  const description = needsRange
    ? `${label} - entre ${value.start || "..."} y ${value.end || "..."}`
    : needsSingleValue
      ? `${label} - ${dateConditionLabels[value.condition].toLowerCase()} ${value.value || "..."}`
      : `${label} - ${dateConditionLabels[value.condition].toLowerCase()}`;

  return (
    <FilterFieldShell label={label} description={description} onClear={onClear}>
      <div className="space-y-2">
        <ConditionSelect
          label="Condicion"
          value={value.condition}
          options={dateConditions}
          labels={dateConditionLabels}
          onChange={(condition) => onChange({ ...value, condition })}
        />
        {needsSingleValue && (
          <Input
            type="date"
            value={value.value}
            onChange={(event) => onChange({ ...value, value: event.target.value })}
            className="h-8 text-sm"
          />
        )}
        {needsRange && (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <Input
              type="date"
              value={value.start}
              onChange={(event) => onChange({ ...value, start: event.target.value })}
              className="h-8 text-sm"
            />
            <span className="text-xs text-muted-foreground">a</span>
            <Input
              type="date"
              value={value.end}
              onChange={(event) => onChange({ ...value, end: event.target.value })}
              className="h-8 text-sm"
            />
          </div>
        )}
      </div>
    </FilterFieldShell>
  );
}

export function BooleanConditionFilter({
  label,
  value,
  onChange,
  onClear,
}: {
  label: string;
  value: BooleanFilterCondition;
  onChange: (value: BooleanFilterCondition) => void;
  onClear: () => void;
}) {
  const description =
    value === "all"
      ? `${label} - cualquiera`
      : `${label} - ${value === "yes" ? "si" : "no"}`;

  return (
    <FilterFieldShell label={label} description={description} onClear={onClear}>
      <div className="grid grid-cols-3 gap-2">
        {([
          ["all", "Cualquiera"],
          ["yes", "Si"],
          ["no", "No"],
        ] as Array<[BooleanFilterCondition, string]>).map(([option, optionLabel]) => (
          <Button
            key={option}
            type="button"
            variant={value === option ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(option)}
            className="min-w-0 px-2"
          >
            {optionLabel}
          </Button>
        ))}
      </div>
    </FilterFieldShell>
  );
}

export function EnumConditionFilter({
  label,
  value,
  options,
  onChange,
  onClear,
}: {
  label: string;
  value: EnumFilterValue;
  options: EnumFilterOption[];
  onChange: (value: EnumFilterValue) => void;
  onClear: () => void;
}) {
  const selectedLabels = options
    .filter((option) => value.values.includes(option.value))
    .map((option) => option.label);
  const description =
    selectedLabels.length > 0
      ? `${label} - ${value.mode === "include" ? "es uno de" : "excluye"} ${selectedLabels.join(", ")}`
      : `${label} - ${value.mode === "include" ? "incluye valores" : "excluye valores"}`;

  const toggleValue = (optionValue: string) => {
    const nextValues = value.values.includes(optionValue)
      ? value.values.filter((current) => current !== optionValue)
      : [...value.values, optionValue];
    onChange({ ...value, values: nextValues });
  };

  return (
    <FilterFieldShell label={label} description={description} onClear={onClear}>
      <div className="space-y-2">
        <ConditionSelect
          label="Condicion"
          value={value.mode}
          options={["include", "exclude"]}
          labels={{ include: "Es uno de", exclude: "No es uno de" }}
          onChange={(mode) => onChange({ ...value, mode })}
        />
        <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border bg-muted/20 p-2">
          {options.length > 0 ? (
            options.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-background"
              >
                <input
                  type="checkbox"
                  checked={value.values.includes(option.value)}
                  onChange={() => toggleValue(option.value)}
                  className="size-3.5 rounded border-border"
                />
                <span className="min-w-0 truncate">{option.label}</span>
              </label>
            ))
          ) : (
            <p className="px-2 py-1 text-xs text-muted-foreground">
              No hay valores configurados.
            </p>
          )}
        </div>
      </div>
    </FilterFieldShell>
  );
}

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
          <Icon className="size-4 text-muted-foreground" />
          <span>{title}</span>
          {activeCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="rounded-b-lg border border-t-0 bg-background p-3 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
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
