import type { DocumentAiRow, DocumentAiSourceRef } from "@/lib/document-ai/schemas/types";
import { getByAliases, parseDate, parseNumber, periodFromDate } from "./shared";

export type NormalizedOrdenCompra = {
  obraId: string | null;
  documentoOrigen: string | null;
  numeroOrden: string | null;
  periodo: string | null;
  fechaOrden: string | null;
  proveedor: string | null;
  categoria: string | null;
  descripcion: string | null;
  cantidad: number | null;
  precioUnitario: number | null;
  precioTotal: number | null;
  totalOrden: number | null;
  source: DocumentAiSourceRef;
  confidence: number;
};

function firstText(data: Record<string, unknown>, aliases: string[]) {
  const value = getByAliases(data, aliases);
  return String(value ?? "").trim() || null;
}

function classifyCategory(description: string | null, provider: string | null) {
  const text = `${description ?? ""} ${provider ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/flete|envio|traslado/.test(text)) return "Flete / logistica";
  if (/hierro|malla|alambre|armadura|barra|barras|disco de corte|diamantado/.test(text)) return "Hierros y armaduras";
  if (/cemento|arena|piedra|hormigon|film|poliestileno|base/.test(text)) return "Materiales de base / hormigon";
  if (/cano|caño|codo|curva|ramal|awaduct|pileta|sifon|camara|cupla|duratop|sanicor/.test(text)) return "Sanitarios / desagues";
  if (/perfil|chapa|tornillo|galv|sosten|cubierta/.test(text)) return "Estructuras metalicas / cubierta";
  if (/jamba|cabezal|contravidrio|marco|zocalo|umbral|dintel|parante|revestimiento|carpinteria|eseica/.test(text)) {
    return "Aberturas / carpinteria";
  }
  if (/disco|herramienta|consumible/.test(text)) return "Herramientas y consumibles";
  return "Sin categoria";
}

export function normalizeOrdenCompra(row: DocumentAiRow): NormalizedOrdenCompra {
  const data = row.data;
  const fechaOrden = parseDate(
    getByAliases(data, [
      "fecha_orden",
      "fecha orden",
      "fecha_oc",
      "fecha oc",
      "fecha_compra",
      "fecha compra",
      "fecha_documento",
      "fecha documento",
      "fecha_emision",
      "fecha_de_emision",
      "fecha",
    ]),
  );
  const cantidad = parseNumber(getByAliases(data, ["cantidad", "qty"]));
  const precioUnitario = parseNumber(
    getByAliases(data, ["precio_unitario", "precio", "valor_unitario", "unitario"]),
  );
  const precioTotal = parseNumber(
    getByAliases(data, [
      "monto_total",
      "importe_total",
      "subtotal",
      "importe",
      "monto",
      "total_neto",
      "precio_total",
      "valor_total",
      "precio total",
    ]),
  );
  const totalOrden = parseNumber(getByAliases(data, ["total_orden", "total orden", "total_oc", "total"]));
  const proveedor = firstText(data, ["proveedor", "contratista", "empresa", "supplier"]);
  const descripcion = firstText(data, [
    "descripcion",
    "detalle",
    "detalle_descriptivo",
    "detalle descriptivo",
    "producto",
    "material",
    "insumo",
    "concepto",
  ]);

  return {
    obraId: row.obraId,
    documentoOrigen: firstText(data, ["documento_origen", "documento origen"]) ?? row.source.documentFileName ?? null,
    numeroOrden: firstText(data, ["nro_orden", "nroOrden", "numero_orden", "orden", "nro", "numero", "nro oc"]),
    periodo: firstText(data, ["periodo", "mes"]) ?? periodFromDate(fechaOrden),
    fechaOrden,
    proveedor,
    categoria: firstText(data, ["categoria", "rubro", "familia", "tipo"]) ?? classifyCategory(descripcion, proveedor),
    descripcion,
    cantidad,
    precioUnitario,
    precioTotal: precioTotal ?? (cantidad != null && precioUnitario != null ? cantidad * precioUnitario : null),
    totalOrden,
    source: row.source,
    confidence: row.source.confidence ?? 0.75,
  };
}

export function looksLikeOrdenCompra(row: DocumentAiRow) {
  if (row.documentType === "orden_compra") return true;
  const text = `${row.tableName ?? ""} ${row.source.documentFileName ?? ""} ${Object.keys(row.data).join(" ")}`;
  return /orden(?:es)?\s+de\s+compra|\boc\b|compra|nroOrden|nro_orden|numero_orden|fecha_oc|fecha orden|total_orden|total orden/i.test(text);
}
