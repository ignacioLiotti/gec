import type { TemplateField } from "@/lib/document-generation";

const RECIPE_LOGO = /<!-- sintesis-oc-logo -->[\s\S]*?<!-- \/sintesis-oc-logo -->/;

type PurchaseOrderTemplate = {
  contentHtml: string;
  fields: TemplateField[];
};

export function exportPurchaseOrderSettings(template: PurchaseOrderTemplate) {
  const surcharge = template.fields.find((field) => field.key === "recargo_porcentaje");
  return {
    version: 1,
    camposObligatorios: Object.fromEntries(template.fields.map((field) => [field.key, field.required])),
    ...(surcharge ? { recargoPredeterminadoPct: surcharge.defaultValue ?? 21 } : {}),
  };
}

export function applyPurchaseOrderSettings(template: PurchaseOrderTemplate, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Los ajustes deben ser un objeto JSON.");
  }
  const settings = input as Record<string, unknown>;
  const keys = new Set(["version", "camposObligatorios", "recargoPredeterminadoPct"]);
  if (settings.version !== 1 || Object.keys(settings).some((key) => !keys.has(key))) {
    throw new Error("Usá la versión 1 y los ajustes de la receta exportada.");
  }
  const required = settings.camposObligatorios ?? {};
  if (typeof required !== "object" || Array.isArray(required)) {
    throw new Error("Los campos obligatorios se indican con true o false.");
  }
  const requiredByKey = new Map(Object.entries(required));
  const availableKeys = new Set(template.fields.map((field) => field.key));
  for (const [key, value] of requiredByKey) {
    if (!availableKeys.has(key) || typeof value !== "boolean") {
      throw new Error(`Revisá el ajuste del campo "${key}".`);
    }
  }
  const surcharge = settings.recargoPredeterminadoPct;
  if (surcharge !== undefined && (
    typeof surcharge !== "number" || !Number.isFinite(surcharge) || surcharge < 0 ||
    !availableKeys.has("recargo_porcentaje")
  )) {
    throw new Error("El recargo debe ser un número positivo o cero y existir en la plantilla.");
  }
  return template.fields.map((field) => ({
    ...field,
    required: requiredByKey.has(field.key) ? requiredByKey.get(field.key) === true : field.required,
    ...(field.key === "recargo_porcentaje" && surcharge !== undefined ? { defaultValue: surcharge } : {}),
  }));
}

export function updatePurchaseOrderLogo(contentHtml: string, dataUrl: string | null) {
  const html = contentHtml.replace(RECIPE_LOGO, "");
  if (!dataUrl) return html;
  if (!/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(dataUrl) || dataUrl.length > 350_000) {
    throw new Error("Elegí un logo PNG, JPEG o WebP de hasta 250 KB.");
  }
  const markup = `<!-- sintesis-oc-logo --><img src="${dataUrl}" alt="" style="max-width:144px;max-height:64px;object-fit:contain"><!-- /sintesis-oc-logo -->`;
  const body = /<body\b[^>]*>/i;
  return body.test(html) ? html.replace(body, (tag) => tag + markup) : markup + html;
}
