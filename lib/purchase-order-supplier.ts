import type { TemplateField } from "@/lib/document-generation";

export const PURCHASE_ORDER_SUPPLIER_FIELDS = [
  { key: "proveedor_cuit", label: "CUIT del proveedor", type: "text", required: false },
  { key: "proveedor_contacto", label: "Contacto del proveedor", type: "text", required: false },
  { key: "proveedor_direccion", label: "Dirección del proveedor", type: "text", required: false },
  { key: "proveedor_cbu", label: "CBU del proveedor", type: "text", required: false },
] satisfies TemplateField[];

export function appendPurchaseOrderSupplier(
  html: string,
  input: Record<string, unknown>,
  escape: (value: unknown) => string,
) {
  const details = PURCHASE_ORDER_SUPPLIER_FIELDS.flatMap(({ key, label }) => {
    const value = input[key];
    if (typeof value !== "string" || !value.trim()) return [];
    return ['<div><strong>' + escape(label) + ':</strong> ' + escape(value) + '</div>'];
  });
  if (!details.length) return html;
  const block = '<section style="font:10px Arial,sans-serif;padding:8px 16px;break-inside:avoid">' + details.join("") + '</section>';
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, () => block + "</body>") : html + block;
}
