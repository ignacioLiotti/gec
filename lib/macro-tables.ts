// Macro Tables - Shared utilities and types

export type MacroTableColumnType = 'source' | 'custom' | 'computed';

export type MacroTableDataType = 'text' | 'number' | 'currency' | 'boolean' | 'date' | 'select';

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
  id: string; // source_row_id (technical, mutable)
  _sourceTablaId: string;
  _sourceTablaName: string;
  _obraId: string;
  _obraName: string;
  _businessIdentity?: string | null;
  _lineageRowKey?: string | null;
  _extractionId?: string | null;
  _materializationVersion?: number | null;
  _docPath?: string | null;
  _docFileName?: string | null;
  _overrideBindingStatus?: MacroTableOverrideBindingStatus | null;
  _overrideConflictCount?: number;
  [key: string]: unknown;
};

export type MacroTableOverrideBindingStatus = 'legacy' | 'stable' | 'conflict';

export type MacroTableCustomValue = {
  id: string;
  macroTableId: string;
  sourceRowId: string;
  sourceTablaId?: string | null;
  lineageRowKey?: string | null;
  columnId: string;
  value: unknown;
  bindingStatus?: MacroTableOverrideBindingStatus | null;
  bindingError?: Record<string, unknown> | null;
};

export type MacroTableOverrideConflict = {
  code: 'LINEAGE_OVERRIDE_REATTACH_CONFLICT';
  macroTableId: string;
  rowId: string;
  sourceTablaId: string | null;
  lineageRowKey: string | null;
  columnId: string;
  candidateOverrideIds: string[];
  candidateSourceRowIds: string[];
  detail: string;
};

export type MacroTableOverrideSummary = {
  totalRecords: number;
  appliedStable: number;
  appliedLegacy: number;
  conflicts: number;
  rowsWithOverrides: number;
  rowsWithConflicts: number;
};

// Valid data types for macro table columns
const VALID_DATA_TYPES = new Set<MacroTableDataType>([
  'text',
  'number', 
  'currency',
  'boolean',
  'date',
  'select',
]);

export function ensureMacroDataType(value: string | undefined): MacroTableDataType {
  if (value && VALID_DATA_TYPES.has(value as MacroTableDataType)) {
    return value as MacroTableDataType;
  }
  return 'text';
}

// Map database column record to API response format
export function mapColumnToResponse(record: Record<string, unknown>): MacroTableColumn {
  return {
    id: record.id as string,
    macroTableId: record.macro_table_id as string,
    columnType: record.column_type as MacroTableColumnType,
    sourceFieldKey: record.source_field_key as string | null,
    label: record.label as string,
    dataType: ensureMacroDataType(
      typeof record.data_type === "string" ? record.data_type : undefined,
    ),
    position: typeof record.position === "number" ? record.position : 0,
    config:
      record.config && typeof record.config === "object" && !Array.isArray(record.config)
        ? (record.config as Record<string, unknown>)
        : {},
  };
}

// Map database source record to API response format
export function mapSourceToResponse(record: Record<string, unknown>): MacroTableSource {
  return {
    id: record.id as string,
    macroTableId: record.macro_table_id as string,
    obraTablaId: record.obra_tabla_id as string,
    position: typeof record.position === "number" ? record.position : 0,
  };
}

// Map database macro table record to API response format
export function mapMacroTableToResponse(record: Record<string, unknown>): MacroTable {
  return {
    id: record.id as string,
    tenantId: record.tenant_id as string,
    name: record.name as string,
    description: record.description as string | null,
    settings:
      record.settings && typeof record.settings === "object" && !Array.isArray(record.settings)
        ? (record.settings as Record<string, unknown>)
        : {},
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







