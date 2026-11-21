import type { TemplateSchema } from "@/lib/document-generation";

export type DemoFlow = "generate" | "ask" | "capture";
export type DemoFlags = Record<DemoFlow, boolean>;
export const demoFlows: { id: DemoFlow; label: string; description: string }[] = [
  { id: "generate", label: "Generar un documento", description: "Desde la carpeta de destino" },
  { id: "ask", label: "Consultar documentos", description: "Con la obra ya seleccionada" },
  { id: "capture", label: "Cargar y revisar", description: "El archivo y sus datos juntos" },
];

export const demoWork = { id: "demo-ribera", label: "Obra Ribera", folder: "Compras", company: "Constructora de ejemplo" };

export const purchaseSchema: TemplateSchema = {
  fields: [
    { key: "supplier", label: "Proveedor", type: "text", required: true },
    { key: "subject", label: "Detalle del pedido", type: "textarea", required: true },
    { key: "amount", label: "Importe", type: "money", required: true },
  ],
};

// These templates and facts are authored fixtures. User values are escaped by
// renderDocumentHtml, the same renderer used by the document generator.
const documentStyles = `<style>body{font:14px/1.65 Georgia,serif;color:#1c1917;padding:32px;margin:0;background:#fff}h1{font-size:25px;margin:12px 0 20px}header{border-bottom:2px solid #292524;padding-bottom:16px}small{font:11px/1.5 Arial,sans-serif;color:#57534e}table{width:100%;border-collapse:collapse;margin:24px 0}td,th{padding:12px 0;text-align:left;border-bottom:1px solid #d6d3d1}td:last-child,th:last-child{text-align:right}.total{font-size:24px;font-weight:bold}.stamp{border:1px solid #a8a29e;padding:12px;font:12px Arial,sans-serif;margin-top:32px}@media(max-width:400px){body{padding:18px}h1{font-size:22px}}</style>`;
export const purchaseTemplate = `<!doctype html><html lang="es"><head><meta charset="utf-8">${documentStyles}</head><body><header><small>CONSTRUCTORA DE EJEMPLO · OBRA RIBERA</small><h1>Orden de compra · OC-0042</h1><p>Plantilla: {{template}}</p></header><p><strong>Proveedor</strong><br>{{supplier}}</p><p><strong>Detalle del pedido</strong><br>{{subject}}</p><table><tr><td>Total del pedido</td><td class="total">{{formattedAmount}}</td></tr></table><p>Destino: Obra Ribera / Compras</p><div class="stamp">DOCUMENTO DE DEMOSTRACIÓN · SIN VALIDEZ COMERCIAL</div></body></html>`;

export const invoiceHtml = `<!doctype html><html lang="es"><head><meta charset="utf-8">${documentStyles}</head><body><header><small>DOCUMENTO FICTICIO · PÁGINA 1 DE 1</small><h1>Factura A</h1><p>Materiales del Litoral<br>N.º 0001-00000042 · 07/09/2026</p></header><p>Cliente: Constructora de ejemplo<br>Obra: Ribera</p><table><tr><th>Detalle</th><th>Importe</th></tr><tr><td>Materiales para etapa 2</td><td>$ 125.000,00</td></tr><tr><th>Total</th><th class="total">$ 125.000,00</th></tr></table><div class="stamp">FACTURA DE EJEMPLO · DATOS PREPARADOS PARA LA DEMO</div></body></html>`;

export const contractHtml = `<!doctype html><html lang="es"><head><meta charset="utf-8">${documentStyles}</head><body><header><small>OBRA RIBERA · CONTRATO DE EJEMPLO · PÁGINA 3</small><h1>Condiciones de ejecución</h1></header><h2>4. Plazo de ejecución</h2><p>El plazo de ejecución de la obra es de <strong>12 meses</strong>, contados a partir de la firma del acta de inicio.</p><h2>5. Certificaciones</h2><p>Las mediciones y certificaciones se presentan mensualmente.</p><div class="stamp">FUENTE FICTICIA PARA PRUEBAS DE NAVEGACIÓN</div></body></html>`;

export const invoiceFields = { supplier: "Materiales del Litoral", date: "2026-09-07", amount: "125000" };
export const formatAmount = (amount: string | number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(amount));
