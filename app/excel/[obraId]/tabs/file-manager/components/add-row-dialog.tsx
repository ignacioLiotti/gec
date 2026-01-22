"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
          />
        );
      case "date":
        return (
          <Input
            id={column.fieldKey}
            type="date"
            value={String(value ?? "")}
            onChange={(e) => handleFieldChange(column.fieldKey, e.target.value)}
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
          />
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto px-4">
        <DialogHeader className="px-0">
          <DialogTitle>Agregar fila</DialogTitle>
          <DialogDescription>
            Completá los campos para agregar una nueva fila a la tabla.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {columns.map((column) => (
            <div key={column.id} className="space-y-2">
              <Label htmlFor={column.fieldKey} className="text-sm font-medium">
                {column.label}
                {column.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              {renderField(column)}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              "Agregar fila"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
