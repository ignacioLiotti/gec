"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Table2, ChevronRight, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

// If you already have cn(), keep using yours. Otherwise, remove cn() and inline classes.
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";

import type { OcrTablaColumn } from "../types";

type AddRowDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: OcrTablaColumn[];
  tablaId: string;
  obraId: string;
  onRowAdded: () => void;
};

export function AddRowDialog({
  open,
  onOpenChange,
  columns,
  tablaId,
  obraId,
  onRowAdded,
}: AddRowDialogProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      const initialData: Record<string, unknown> = {};
      columns.forEach((col) => {
        switch (col.dataType) {
          case "number":
          case "currency":
            initialData[col.fieldKey] = "";
            break;
          case "boolean":
            initialData[col.fieldKey] = false;
            break;
          case "date":
            initialData[col.fieldKey] = "";
            break;
          default:
            initialData[col.fieldKey] = "";
        }
      });
      setFormData(initialData);
    }
  }, [open, columns]);

  const handleFieldChange = useCallback((fieldKey: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [fieldKey]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    // Validate required fields
    for (const col of columns) {
      if (col.required) {
        const value = formData[col.fieldKey];
        if (value === "" || value === null || value === undefined) {
          toast.error(`El campo "${col.label}" es requerido`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const newRowId = crypto.randomUUID();

      // Prepare data with proper types
      const rowData: Record<string, unknown> = {};
      columns.forEach((col) => {
        const value = formData[col.fieldKey];
        switch (col.dataType) {
          case "number":
          case "currency":
            rowData[col.fieldKey] = value === "" ? null : Number(value);
            break;
          case "boolean":
            rowData[col.fieldKey] = Boolean(value);
            break;
          default:
            rowData[col.fieldKey] = value;
        }
      });

      const res = await fetch(`/api/obras/${obraId}/tablas/${tablaId}/rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dirtyRows: [{ id: newRowId, source: "manual", ...rowData }],
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "No se pudo agregar la fila");
      }

      toast.success("Fila agregada exitosamente");
      onRowAdded();
      onOpenChange(false);
    } catch (error) {
      console.error("Error adding row:", error);
      toast.error(error instanceof Error ? error.message : "Error agregando fila");
    } finally {
      setIsSubmitting(false);
    }
  }, [columns, formData, obraId, onOpenChange, onRowAdded, tablaId]);

  const renderField = (column: OcrTablaColumn) => {
    const value = formData[column.fieldKey];

    switch (column.dataType) {
      case "boolean":
        return (
          <div className="flex items-center gap-3">
            <Switch
              id={column.fieldKey}
              checked={Boolean(value)}
              onCheckedChange={(checked) => handleFieldChange(column.fieldKey, checked)}
            />
            <Label htmlFor={column.fieldKey} className="text-sm cursor-pointer">
              {value ? "Sí" : "No"}
            </Label>
          </div>
        );
      case "number":
      case "currency":
        return (
          <Input
            id={column.fieldKey}
            type="number"
            step={column.dataType === "currency" ? "0.01" : "any"}
            value={String(value ?? "")}
            onChange={(e) => handleFieldChange(column.fieldKey, e.target.value)}
            placeholder={column.dataType === "currency" ? "0.00" : "0"}
            className={cn(
              "w-full rounded-md border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900",
              "placeholder:text-stone-400",
              "focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20",
              "transition-all duration-200"
            )}
          />
        );
      case "date":
        return (
          <Input
            id={column.fieldKey}
            type="date"
            value={String(value ?? "")}
            onChange={(e) => handleFieldChange(column.fieldKey, e.target.value)}
            className={cn(
              "w-full rounded-md border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900",
              "focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20",
              "transition-all duration-200"
            )}
          />
        );
      default:
        return (
          <Input
            id={column.fieldKey}
            type="text"
            value={String(value ?? "")}
            onChange={(e) => handleFieldChange(column.fieldKey, e.target.value)}
            placeholder={`Ingresá ${column.label.toLowerCase()}`}
            className={cn(
              "w-full rounded-md border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900",
              "placeholder:text-stone-400",
              "focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20",
              "transition-all duration-200"
            )}
          />
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "rounded-none border-none bg-transparent shadow-none p-0 max-w-2xl w-full"
        )}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          {/* Main container with paper hole punches */}
          <div className="relative flex min-h-[800px]">
            {/* Main modal body */}
            <div
              className={cn(
                "relative flex flex-col justify-start flex-1 ml-4 pl-4 overflow-hidden rounded-none",
                "bg-white border border-stone-200",
                "shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)]"
              )}
            >
              {/* Paper holes */}
              <div className="absolute left-3 -top-12 bottom-0 flex flex-col justify-around py-8 z-10">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-5 h-5 rounded-full bg-stone-200 border border-stone-300 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)]"
                  />
                ))}
              </div>
              <div className="absolute left-11 top-0 bottom-0 w-px h-full bg-stone-200" />

              {/* Close button */}
              <DialogClose className="absolute right-4 top-4 rounded-full p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors z-10">
                <X className="h-4 w-4" />
              </DialogClose>

              {/* Header */}
              <div className="px-12 pt-6 pb-5">
                <div className="flex flex-col items-start justify-start relative">
                  <DialogTitle className="text-2xl font-semibold text-stone-900">Agregar fila</DialogTitle>
                  <DialogDescription className="mt-1 text-sm text-stone-500">
                    Completá los campos para agregar una nueva fila a la tabla.
                  </DialogDescription>

                  <div className="w-[130%] h-px bg-stone-200 mt-5 -ml-16 absolute -bottom-3 left-0" />

                  <div className="mt-3 flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] font-medium">
                      Nueva fila
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Content area */}
              <div className="px-5 mx-12 pb-6 max-h-[calc(90vh-250px)] overflow-y-auto bg-sidebar/50 pt-4">
                <div className="space-y-5">
                  {columns.map((column) => (
                    <div key={column.id}>
                      <Label className="block text-xs font-medium uppercase tracking-wider text-stone-500 mb-1.5">
                        {column.label}
                        {column.required && <span className="text-red-500 ml-1">*</span>}
                      </Label>
                      {renderField(column)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="px-8 py-5 -ml-4 mt-auto border-t border-stone-100 bg-sidebar max-h-16">
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      "rounded-md px-4 py-2 text-sm font-medium transition-all duration-200",
                      "text-stone-600 hover:text-stone-900",
                      "hover:bg-stone-100"
                    )}
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-5 py-2 text-sm font-medium transition-all duration-200",
                      "bg-stone-800 text-white",
                      "hover:bg-stone-700",
                      "active:bg-stone-900",
                      isSubmitting && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Table2 className="h-4 w-4" />
                        Agregar fila
                        <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
