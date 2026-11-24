"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { TemplateField } from "@/lib/document-generation";
import { normalizeFieldKey } from "@/lib/tablas";
import {
  applyPurchaseOrderSettings,
  exportPurchaseOrderSettings,
  updatePurchaseOrderLogo,
} from "./purchase-order-recipe";

const SampleAnalysisCard = dynamic(
  () => import("../admin/obra-defaults/_components/SampleAnalysisCard").then((module) => module.SampleAnalysisCard),
);

type RecipeState = { fields: TemplateField[]; contentHtml: string };

export function PurchaseOrderRecipePanel({ template, onChange }: {
  template: RecipeState;
  onChange: (patch: Partial<RecipeState>) => void;
}) {
  const [json, setJson] = useState("");
  const [error, setError] = useState("");
  const [sampleNote, setSampleNote] = useState("");
  const [showSample, setShowSample] = useState(false);
  const surcharge = template.fields.find((field) => field.key === "recargo_porcentaje");

  function applySettings(settings: unknown) {
    try {
      onChange({ fields: applyPurchaseOrderSettings(template, settings) });
      setError("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Revisá los ajustes.");
    }
  }

  function applyJson() {
    try {
      applySettings(JSON.parse(json));
    } catch {
      setError("El JSON no tiene un formato válido.");
    }
  }

  function prepareSettingsFromSample(definitionJson: string) {
    const definition = JSON.parse(definitionJson) as { fields?: { field_key: string; label: string }[] };
    const available = new Map(template.fields.flatMap<[string, string]>((field) => [
      [normalizeFieldKey(field.label), field.key],
      [field.key, field.key],
    ]));
    const required: Record<string, boolean> = {};
    for (const field of definition.fields ?? []) {
      const key = available.get(field.field_key) ?? available.get(normalizeFieldKey(field.label));
      if (key) required[key] = true;
    }
    if (Object.keys(required).length === 0) {
      setError("No encontramos campos equivalentes. Revisá las etiquetas y los ajustes de la receta.");
      return;
    }
    setJson(JSON.stringify({ version: 1, camposObligatorios: required }, null, 2));
    setShowSample(false);
    setError("");
  }

  function readLogo(file: File) {
    if (file.size > 250 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Elegí un logo PNG, JPEG o WebP de hasta 250 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setError("No se pudo leer el logo.");
    reader.onload = () => {
      try {
        onChange({ contentHtml: updatePurchaseOrderLogo(template.contentHtml, String(reader.result)) });
        setError("");
      } catch (error) {
        setError(error instanceof Error ? error.message : "No se pudo aplicar el logo.");
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Conservá el diseño y los cálculos de esta plantilla. Ajustá el formulario y revisá el resultado antes de publicarlo.
      </p>
      <div className="space-y-2">
        <Label htmlFor="purchase-order-logo">Logo adicional</Label>
        <Input
          id="purchase-order-logo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) readLogo(file);
          }}
        />
        {template.contentHtml.includes("<!-- sintesis-oc-logo -->") ? (
          <Button variant="ghost" size="sm" type="button" onClick={() => onChange({ contentHtml: updatePurchaseOrderLogo(template.contentHtml, null) })}>
            Quitar logo adicional
          </Button>
        ) : null}
      </div>
      {surcharge ? (
        <div className="space-y-2">
          <Label htmlFor="purchase-order-surcharge">Recargo predeterminado (%)</Label>
          <Input
            id="purchase-order-surcharge"
            type="number"
            min={0}
            step="any"
            value={String(surcharge.defaultValue ?? 21)}
            onChange={(event) => {
              if (event.target.value === "") return;
              applySettings({ version: 1, recargoPredeterminadoPct: event.target.valueAsNumber });
            }}
          />
        </div>
      ) : null}
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium">Campos obligatorios</legend>
        {template.fields.map((field) => (
          <Label key={field.key} className="flex gap-2">
            <Checkbox
              checked={field.required}
              onCheckedChange={(checked) => applySettings({
                version: 1,
                camposObligatorios: { [field.key]: checked === true },
              })}
            />
            {field.label}
          </Label>
        ))}
      </fieldset>
      <Button type="button" variant="outline" onClick={() => setShowSample((value) => !value)}>
        {showSample ? "Cerrar análisis de muestra" : "Proponer ajustes desde un ejemplo"}
      </Button>
      {showSample ? (
        <div className="space-y-3 rounded-lg border p-4">
          <Label htmlFor="purchase-order-sample-note">Qué querés cambiar</Label>
          <Textarea
            id="purchase-order-sample-note"
            rows={2}
            maxLength={900}
            value={sampleNote}
            onChange={(event) => setSampleNote(event.target.value)}
            placeholder="Ej. Quiero pedir el proveedor y el nombre de quien retira"
          />
          <p className="text-sm text-muted-foreground">
            El análisis requiere permiso para configurar obras. Los campos elegidos que coincidan con la orden se proponen como obligatorios en el JSON de ajustes.
          </p>
          <SampleAnalysisCard onApply={prepareSettingsFromSample} sampleNote={sampleNote} />
        </div>
      ) : null}
      <details className="space-y-2" open={json ? true : undefined}>
        <summary className="cursor-pointer text-sm font-medium">Importar o exportar los ajustes como JSON</summary>
        <Textarea aria-label="Ajustes JSON de la orden de compra" value={json} onChange={(event) => setJson(event.target.value)} rows={8} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setJson(JSON.stringify(exportPurchaseOrderSettings(template), null, 2))}>
            Volcar ajustes actuales
          </Button>
          <Button type="button" variant="secondary" disabled={!json.trim()} onClick={applyJson}>Aplicar a la vista previa</Button>
        </div>
      </details>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
