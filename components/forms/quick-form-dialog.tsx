"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type QuickFormField = {
  key: string;
  label: string;
  type: "text" | "number" | "textarea" | "date" | "email";
  required?: boolean;
  placeholder?: string;
};

type RenderFooterProps = {
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
};

type QuickFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  variant?: "default" | "dashboard";
  fields: QuickFormField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onSubmit: () => void | Promise<void>;
  isSubmitting?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  renderFooter?: (props: RenderFooterProps) => React.ReactNode;
};

export function QuickFormDialog({
  open,
  onOpenChange,
  title,
  description,
  variant = "default",
  fields,
  values,
  onChange,
  onSubmit,
  isSubmitting = false,
  submitLabel = "Guardar",
  cancelLabel = "Cancelar",
  renderFooter,
}: QuickFormDialogProps) {
  const handleSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit();
    },
    [onSubmit]
  );

  const handleClose = React.useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-[500px]",
          variant === "dashboard" && "sm:max-w-[550px]"
        )}
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>

          <div className="grid gap-4 py-4 px-4">
            {fields.map((field) => (
              <div key={field.key} className="grid gap-2">
                <Label htmlFor={field.key}>
                  {field.label}
                  {field.required && (
                    <span className="text-destructive ml-1">*</span>
                  )}
                </Label>
                {field.type === "textarea" ? (
                  <Textarea
                    id={field.key}
                    value={values[field.key] ?? ""}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    disabled={isSubmitting}
                    className="min-h-[80px]"
                  />
                ) : (
                  <Input
                    id={field.key}
                    type={field.type}
                    value={values[field.key] ?? ""}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    disabled={isSubmitting}
                  />
                )}
              </div>
            ))}
          </div>

          {renderFooter ? (
            <DialogFooter>
              {renderFooter({
                onClose: handleClose,
                onSubmit: () => { void onSubmit(); },
                isSubmitting,
              })}
            </DialogFooter>
          ) : (
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                {cancelLabel}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {submitLabel}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
