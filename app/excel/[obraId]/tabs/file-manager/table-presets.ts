/**
 * Spreadsheet-import table presets for data folders.
 *
 * Each preset declares the target table schema (columns + `excelKeywords`
 * used to match spreadsheet headers) that the import pipeline materializes
 * for a template. Field keys here feed lineage/schema identity — renaming a
 * `fieldKey` re-identifies the column for every obra that uses the preset,
 * so treat keys as frozen once shipped.
 */
import type { TablaColumnDataType } from '@/lib/tablas';

export const DATA_TYPE_LABELS: Record<TablaColumnDataType, string> = {
  text: 'Texto',
  number: 'Número',
  currency: 'Moneda',
  boolean: 'Booleano',
  date: 'Fecha',
};

export type DataFolderColumnPayload = {
  label: string;
  fieldKey: string;
  dataType: TablaColumnDataType;
  required: boolean;
  position: number;
  config?: Record<string, unknown>;
};

export type DataFolderTablePreset = {
  name: string;
  description: string;
  columns: DataFolderColumnPayload[];
};

export type SpreadsheetTemplateId = 'auto' | 'certificado' | 'presupuesto_estudio_tv';

export const CERTIFICADO_SPREADSHEET_TABLE_PRESETS: DataFolderTablePreset[] = [
  {
    name: 'PMC Resumen',
    description: 'Resumen mensual del certificado: período, monto, avance acumulado.',
    columns: [
      { label: 'Período', fieldKey: 'periodo', dataType: 'text', required: false, position: 0, config: { excelKeywords: ['periodo', 'mes', 'month', 'correspondiente'] } },
      { label: 'N° Certificado', fieldKey: 'nro_certificado', dataType: 'text', required: false, position: 1, config: { excelKeywords: ['nro', 'numero', 'certificado', 'cert', 'n°'] } },
      { label: 'Fecha Certificación', fieldKey: 'fecha_certificacion', dataType: 'text', required: false, position: 2, config: { excelKeywords: ['fecha', 'certificacion', 'date'] } },
      { label: 'Monto Certificado', fieldKey: 'monto_certificado', dataType: 'currency', required: false, position: 3, config: { excelKeywords: ['monto', 'importe', 'certificado'] } },
      { label: 'Avance Físico Acum. %', fieldKey: 'avance_fisico_acumulado_pct', dataType: 'number', required: false, position: 4, config: { excelKeywords: ['avance', 'fisico', 'acumulado', '%'] } },
      { label: 'Monto Acumulado', fieldKey: 'monto_acumulado', dataType: 'currency', required: false, position: 5, config: { excelKeywords: ['monto', 'acumulado', 'total'] } },
      { label: 'N° Expediente', fieldKey: 'n_expediente', dataType: 'text', required: false, position: 6, config: { excelKeywords: ['expediente', 'exp', 'nro', 'numero', 'n°'] } },
    ],
  },
  {
    name: 'PMC Items',
    description: 'Desglose por rubro/item del certificado con avances e importes.',
    columns: [
      { label: 'Código Item', fieldKey: 'item_code', dataType: 'text', required: false, position: 0, config: { excelKeywords: ['item', 'codigo', 'cod', 'rubro'] } },
      { label: 'Descripción', fieldKey: 'descripcion', dataType: 'text', required: false, position: 1, config: { excelKeywords: ['descripcion', 'rubro', 'concepto', 'detalle'] } },
      { label: 'Incidencia %', fieldKey: 'incidencia_pct', dataType: 'number', required: false, position: 2, config: { excelKeywords: ['incidencia', '%'] } },
      { label: 'Monto Rubro', fieldKey: 'monto_rubro', dataType: 'currency', required: false, position: 3, config: { excelKeywords: ['total', 'rubro', 'monto'] } },
      { label: 'Avance Anterior %', fieldKey: 'avance_anterior_pct', dataType: 'number', required: false, position: 4, config: { excelKeywords: ['anterior', 'avance', '%'] } },
      { label: 'Avance Período %', fieldKey: 'avance_periodo_pct', dataType: 'number', required: false, position: 5, config: { excelKeywords: ['presente', 'periodo', 'avance', '%'] } },
      { label: 'Avance Acumulado %', fieldKey: 'avance_acumulado_pct', dataType: 'number', required: false, position: 6, config: { excelKeywords: ['acumulado', 'avance', '%'] } },
      { label: 'Monto Anterior $', fieldKey: 'monto_anterior', dataType: 'currency', required: false, position: 7, config: { excelKeywords: ['anterior', 'cert', 'importe'] } },
      { label: 'Monto Presente $', fieldKey: 'monto_presente', dataType: 'currency', required: false, position: 8, config: { excelKeywords: ['presente', 'cert', 'importe'] } },
      { label: 'Monto Acumulado $', fieldKey: 'monto_acumulado', dataType: 'currency', required: false, position: 9, config: { excelKeywords: ['total', 'acumulado', 'cert', 'importe'] } },
    ],
  },
  {
    name: 'Curva Plan',
    description: 'Curva de inversiones con avance mensual y acumulado.',
    columns: [
      { label: 'Período', fieldKey: 'periodo', dataType: 'text', required: false, position: 0, config: { excelKeywords: ['mes', 'periodo', 'month'] } },
      { label: 'Avance Mensual %', fieldKey: 'avance_mensual_pct', dataType: 'number', required: false, position: 1, config: { excelKeywords: ['avance', 'mensual', '%'] } },
      { label: 'Avance Acumulado %', fieldKey: 'avance_acumulado_pct', dataType: 'number', required: false, position: 2, config: { excelKeywords: ['acumulado', 'financiero', '%'] } },
    ],
  },
];

export const PRESUPUESTO_ESTUDIO_TV_SPREADSHEET_TABLE_PRESETS: DataFolderTablePreset[] = [
  {
    name: 'Materiales',
    description: 'Detalle de materiales/mano de obra/equipos detectado en bloques desde columna P.',
    columns: [
      { label: 'Rubro', fieldKey: 'rubro', dataType: 'text', required: false, position: 0, config: { excelKeywords: ['rubro'] } },
      { label: 'Item', fieldKey: 'item', dataType: 'text', required: false, position: 1, config: { excelKeywords: ['item', 'titulo'] } },
      { label: 'Item Unidad', fieldKey: 'item_unidad', dataType: 'text', required: false, position: 2, config: { excelKeywords: ['item unidad', 'unidad item'] } },
      { label: 'Item Cantidad', fieldKey: 'item_cantidad', dataType: 'number', required: false, position: 3, config: { excelKeywords: ['item cantidad', 'cantidad item'] } },
      { label: 'Seccion', fieldKey: 'seccion', dataType: 'text', required: false, position: 4, config: { excelKeywords: ['seccion', 'materiales', 'mano de obra', 'equipos'] } },
      { label: 'Descripcion', fieldKey: 'descripcion', dataType: 'text', required: false, position: 5, config: { excelKeywords: ['descripcion', 'detalle'] } },
      { label: 'Unidad', fieldKey: 'unidad', dataType: 'text', required: false, position: 6, config: { excelKeywords: ['unidad', 'und', 'u'] } },
      { label: 'Cantidad', fieldKey: 'cantidad', dataType: 'number', required: false, position: 7, config: { excelKeywords: ['cantidad', 'cant'] } },
      { label: 'Precio', fieldKey: 'precio', dataType: 'currency', required: false, position: 8, config: { excelKeywords: ['precio', 'unitario'] } },
      { label: 'Subtotal', fieldKey: 'subtotal', dataType: 'currency', required: false, position: 9, config: { excelKeywords: ['subtotal', 'total'] } },
    ],
  },
  {
    name: 'Presupuesto',
    description: 'Tabla principal del presupuesto detectada desde columnas E:M.',
    columns: [
      { label: 'Rubro', fieldKey: 'rubro', dataType: 'text', required: false, position: 0, config: { excelKeywords: ['rubro'] } },
      { label: 'Descripcion', fieldKey: 'descripcion', dataType: 'text', required: false, position: 1, config: { excelKeywords: ['descripcion', 'detalle'] } },
      { label: 'Unidad', fieldKey: 'unidad', dataType: 'text', required: false, position: 2, config: { excelKeywords: ['unidad', 'und', 'u'] } },
      { label: 'Cantidad', fieldKey: 'cantidad', dataType: 'number', required: false, position: 3, config: { excelKeywords: ['cantidad', 'cant'] } },
      { label: 'Precio', fieldKey: 'precio', dataType: 'currency', required: false, position: 4, config: { excelKeywords: ['precio', 'unitario'] } },
      { label: 'Subtotal', fieldKey: 'subtotal', dataType: 'currency', required: false, position: 5, config: { excelKeywords: ['subtotal', 'total'] } },
    ],
  },
];
