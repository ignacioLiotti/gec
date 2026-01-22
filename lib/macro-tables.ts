// Macro Tables - Shared utilities and types

export type MacroTableColumnType = 'source' | 'custom' | 'computed';

export type MacroTableDataType = 'text' | 'number' | 'currency' | 'boolean' | 'date';

export type MacroTableColumn = {
  id: string;
  macroTableId: string;
  columnType: MacroTableColumnType;
  sourceFieldKey: string | null;
  label: string;
  dataType: MacroTableDataType;
  position: number;
  config: Record<string, unknown>;
};

export type MacroTableSource = {
  id: string;
  macroTableId: string;
  obraTablaId: string;
  position: number;
  // Joined data
  obraTabla?: {
    id: string;
    name: string;
    obraId: string;
    obraName: string;
  };
};

export type MacroTable = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  sources?: MacroTableSource[];
  columns?: MacroTableColumn[];
};

export type MacroTableRow = {
  id: string; // source_row_id
  _sourceTablaId: string;
  _sourceTablaName: string;
  _obraId: string;
  _obraName: string;
  [key: string]: unknown;
};

export type MacroTableCustomValue = {
  id: string;
  macroTableId: string;
  sourceRowId: string;
  columnId: string;
  value: unknown;
};

// Valid data types for macro table columns
const VALID_DATA_TYPES = new Set<MacroTableDataType>([
  'text',
  'number', 
  'currency',
  'boolean',
  'date',
]);

export function ensureMacroDataType(value: string | undefined): MacroTableDataType {
  if (value && VALID_DATA_TYPES.has(value as MacroTableDataType)) {
    return value as MacroTableDataType;
  }
  return 'text';
}

// Map database column record to API response format
export function mapColumnToResponse(record: any): MacroTableColumn {
  return {
    id: record.id as string,
    macroTableId: record.macro_table_id as string,
    columnType: record.column_type as MacroTableColumnType,
    sourceFieldKey: record.source_field_key as string | null,
    label: record.label as string,
    dataType: ensureMacroDataType(record.data_type),
    position: record.position ?? 0,
    config: record.config ?? {},
  };
}

// Map database source record to API response format
export function mapSourceToResponse(record: any): MacroTableSource {
  return {
    id: record.id as string,
    macroTableId: record.macro_table_id as string,
    obraTablaId: record.obra_tabla_id as string,
    position: record.position ?? 0,
  };
}

// Map database macro table record to API response format
export function mapMacroTableToResponse(record: any): MacroTable {
  return {
    id: record.id as string,
    tenantId: record.tenant_id as string,
    name: record.name as string,
    description: record.description as string | null,
    settings: record.settings ?? {},
    createdAt: record.created_at as string,
    updatedAt: record.updated_at as string,
  };
}

// Normalize field key for consistency
export function normalizeFieldKey(key: string): string {
  return key
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}







