/**
 * REFERENCE IMPLEMENTATION - Not yet wired into the FileManager
 * 
 * These hooks demonstrate the recommended pattern for refactoring the
 * existing useState calls in file-manager.tsx into useReducer-based state.
 * 
 * See docs/REACT_BEST_PRACTICES.md for the full migration guide.
 * 
 * To use: Import and replace the existing useState calls for dialogs/modals
 * with these hooks. For example:
 *   const [createFolderState, createFolderDispatch] = useCreateFolderDialog();
 */
"use client";

import { useReducer, useCallback } from "react";

// ============================================================================
// Types
// ============================================================================

export type DataInputMethod = "ocr" | "manual" | "both";
export type SpreadsheetTemplateId = string;

export type OcrDraftColumn = {
  id: string;
  label: string;
  fieldKey: string;
  dataType: "text" | "number" | "date" | "currency";
  required: boolean;
  scope: "item" | "header" | "summary";
};

export type TablaSchemaDraftColumn = {
  id: string;
  label: string;
  fieldKey: string;
  dataType: string;
  required: boolean;
};

// ============================================================================
// Create Folder Dialog State
// ============================================================================

type CreateFolderState = {
  isOpen: boolean;
  mode: "normal" | "data" | null;
  name: string;
  error: string | null;
  dataInputMethod: DataInputMethod;
  ocrTemplateId: string;
  spreadsheetTemplate: "" | SpreadsheetTemplateId;
  description: string;
  hasNested: boolean;
  columns: OcrDraftColumn[];
  isLoadingTemplates: boolean;
};

const defaultColumn: OcrDraftColumn = {
  id: "",
  label: "Columna 1",
  fieldKey: "columna_1",
  dataType: "text",
  required: false,
  scope: "item",
};

const initialCreateFolderState: CreateFolderState = {
  isOpen: false,
  mode: null,
  name: "",
  error: null,
  dataInputMethod: "both",
  ocrTemplateId: "",
  spreadsheetTemplate: "",
  description: "",
  hasNested: false,
  columns: [{ ...defaultColumn, id: crypto.randomUUID() }],
  isLoadingTemplates: false,
};

type CreateFolderAction =
  | { type: "OPEN"; mode?: "normal" | "data" }
  | { type: "CLOSE" }
  | { type: "SET_NAME"; name: string }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SET_DATA_INPUT_METHOD"; method: DataInputMethod }
  | { type: "SET_OCR_TEMPLATE_ID"; id: string }
  | { type: "SET_SPREADSHEET_TEMPLATE"; template: "" | SpreadsheetTemplateId }
  | { type: "SET_DESCRIPTION"; description: string }
  | { type: "SET_HAS_NESTED"; hasNested: boolean }
  | { type: "SET_COLUMNS"; columns: OcrDraftColumn[] }
  | { type: "SET_LOADING_TEMPLATES"; loading: boolean }
  | { type: "RESET" };

function createFolderReducer(
  state: CreateFolderState,
  action: CreateFolderAction
): CreateFolderState {
  switch (action.type) {
    case "OPEN":
      return { ...initialCreateFolderState, isOpen: true, mode: action.mode ?? null };
    case "CLOSE":
      return { ...state, isOpen: false };
    case "SET_NAME":
      return { ...state, name: action.name, error: null };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SET_DATA_INPUT_METHOD":
      return { ...state, dataInputMethod: action.method };
    case "SET_OCR_TEMPLATE_ID":
      return { ...state, ocrTemplateId: action.id };
    case "SET_SPREADSHEET_TEMPLATE":
      return { ...state, spreadsheetTemplate: action.template };
    case "SET_DESCRIPTION":
      return { ...state, description: action.description };
    case "SET_HAS_NESTED":
      return { ...state, hasNested: action.hasNested };
    case "SET_COLUMNS":
      return { ...state, columns: action.columns };
    case "SET_LOADING_TEMPLATES":
      return { ...state, isLoadingTemplates: action.loading };
    case "RESET":
      return initialCreateFolderState;
    default:
      return state;
  }
}

export function useCreateFolderDialog() {
  const [state, dispatch] = useReducer(createFolderReducer, initialCreateFolderState);

  const open = useCallback((mode?: "normal" | "data") => dispatch({ type: "OPEN", mode }), []);
  const close = useCallback(() => dispatch({ type: "CLOSE" }), []);
  const setName = useCallback((name: string) => dispatch({ type: "SET_NAME", name }), []);
  const setError = useCallback(
    (error: string | null) => dispatch({ type: "SET_ERROR", error }),
    []
  );
  const setDataInputMethod = useCallback(
    (method: DataInputMethod) => dispatch({ type: "SET_DATA_INPUT_METHOD", method }),
    []
  );
  const setOcrTemplateId = useCallback(
    (id: string) => dispatch({ type: "SET_OCR_TEMPLATE_ID", id }),
    []
  );
  const setSpreadsheetTemplate = useCallback(
    (template: "" | SpreadsheetTemplateId) =>
      dispatch({ type: "SET_SPREADSHEET_TEMPLATE", template }),
    []
  );
  const setDescription = useCallback(
    (description: string) => dispatch({ type: "SET_DESCRIPTION", description }),
    []
  );
  const setHasNested = useCallback(
    (hasNested: boolean) => dispatch({ type: "SET_HAS_NESTED", hasNested }),
    []
  );
  const setColumns = useCallback(
    (columns: OcrDraftColumn[]) => dispatch({ type: "SET_COLUMNS", columns }),
    []
  );
  const setLoadingTemplates = useCallback(
    (loading: boolean) => dispatch({ type: "SET_LOADING_TEMPLATES", loading }),
    []
  );
  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return {
    ...state,
    open,
    close,
    setName,
    setError,
    setDataInputMethod,
    setOcrTemplateId,
    setSpreadsheetTemplate,
    setDescription,
    setHasNested,
    setColumns,
    setLoadingTemplates,
    reset,
  };
}

// ============================================================================
// Schema Dialog State
// ============================================================================

type SchemaDialogState = {
  isOpen: boolean;
  isSaving: boolean;
  columns: TablaSchemaDraftColumn[];
};

type SchemaDialogAction =
  | { type: "OPEN"; columns: TablaSchemaDraftColumn[] }
  | { type: "CLOSE" }
  | { type: "START_SAVE" }
  | { type: "SAVE_SUCCESS" }
  | { type: "SAVE_ERROR" }
  | { type: "SET_COLUMNS"; columns: TablaSchemaDraftColumn[] };

const initialSchemaDialogState: SchemaDialogState = {
  isOpen: false,
  isSaving: false,
  columns: [],
};

function schemaDialogReducer(
  state: SchemaDialogState,
  action: SchemaDialogAction
): SchemaDialogState {
  switch (action.type) {
    case "OPEN":
      return { isOpen: true, isSaving: false, columns: action.columns };
    case "CLOSE":
      return { ...state, isOpen: false };
    case "START_SAVE":
      return { ...state, isSaving: true };
    case "SAVE_SUCCESS":
      return { ...state, isSaving: false, isOpen: false };
    case "SAVE_ERROR":
      return { ...state, isSaving: false };
    case "SET_COLUMNS":
      return { ...state, columns: action.columns };
    default:
      return state;
  }
}

export function useSchemaDialog() {
  const [state, dispatch] = useReducer(schemaDialogReducer, initialSchemaDialogState);

  const open = useCallback(
    (columns: TablaSchemaDraftColumn[]) => dispatch({ type: "OPEN", columns }),
    []
  );
  const close = useCallback(() => dispatch({ type: "CLOSE" }), []);
  const startSave = useCallback(() => dispatch({ type: "START_SAVE" }), []);
  const saveSuccess = useCallback(() => dispatch({ type: "SAVE_SUCCESS" }), []);
  const saveError = useCallback(() => dispatch({ type: "SAVE_ERROR" }), []);
  const setColumns = useCallback(
    (columns: TablaSchemaDraftColumn[]) => dispatch({ type: "SET_COLUMNS", columns }),
    []
  );

  return {
    ...state,
    open,
    close,
    startSave,
    saveSuccess,
    saveError,
    setColumns,
  };
}

// ============================================================================
// Delete Dialog State
// ============================================================================

type FileSystemItem = {
  id: string;
  name: string;
  type: "file" | "folder";
  storagePath?: string;
  // Add other properties as needed
};

type DeleteDialogState = {
  isOpen: boolean;
  item: FileSystemItem | null;
};

type DeleteDialogAction =
  | { type: "OPEN"; item: FileSystemItem }
  | { type: "CLOSE" }
  | { type: "CONFIRM_DELETE" };

const initialDeleteDialogState: DeleteDialogState = {
  isOpen: false,
  item: null,
};

function deleteDialogReducer(
  state: DeleteDialogState,
  action: DeleteDialogAction
): DeleteDialogState {
  switch (action.type) {
    case "OPEN":
      return { isOpen: true, item: action.item };
    case "CLOSE":
      return { isOpen: false, item: null };
    case "CONFIRM_DELETE":
      return { isOpen: false, item: null };
    default:
      return state;
  }
}

export function useDeleteDialog() {
  const [state, dispatch] = useReducer(deleteDialogReducer, initialDeleteDialogState);

  const open = useCallback(
    (item: FileSystemItem) => dispatch({ type: "OPEN", item }),
    []
  );
  const close = useCallback(() => dispatch({ type: "CLOSE" }), []);
  const confirmDelete = useCallback(() => dispatch({ type: "CONFIRM_DELETE" }), []);

  return {
    ...state,
    open,
    close,
    confirmDelete,
  };
}

// ============================================================================
// Recovery Dialog State
// ============================================================================

type DeletedDocumentEntry = {
  id: string;
  name: string;
  deletedAt: string;
  // Add other properties as needed
};

type RecoveryDialogState = {
  isOpen: boolean;
  entries: DeletedDocumentEntry[];
  isLoading: boolean;
  restoringId: string | null;
};

type RecoveryDialogAction =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "START_LOAD" }
  | { type: "LOAD_SUCCESS"; entries: DeletedDocumentEntry[] }
  | { type: "START_RESTORE"; id: string }
  | { type: "RESTORE_SUCCESS" }
  | { type: "RESTORE_ERROR" };

const initialRecoveryDialogState: RecoveryDialogState = {
  isOpen: false,
  entries: [],
  isLoading: false,
  restoringId: null,
};

function recoveryDialogReducer(
  state: RecoveryDialogState,
  action: RecoveryDialogAction
): RecoveryDialogState {
  switch (action.type) {
    case "OPEN":
      return { ...state, isOpen: true };
    case "CLOSE":
      return { ...state, isOpen: false };
    case "START_LOAD":
      return { ...state, isLoading: true };
    case "LOAD_SUCCESS":
      return { ...state, isLoading: false, entries: action.entries };
    case "START_RESTORE":
      return { ...state, restoringId: action.id };
    case "RESTORE_SUCCESS":
      return { ...state, restoringId: null };
    case "RESTORE_ERROR":
      return { ...state, restoringId: null };
    default:
      return state;
  }
}

export function useRecoveryDialog() {
  const [state, dispatch] = useReducer(recoveryDialogReducer, initialRecoveryDialogState);

  const open = useCallback(() => dispatch({ type: "OPEN" }), []);
  const close = useCallback(() => dispatch({ type: "CLOSE" }), []);
  const startLoad = useCallback(() => dispatch({ type: "START_LOAD" }), []);
  const loadSuccess = useCallback(
    (entries: DeletedDocumentEntry[]) => dispatch({ type: "LOAD_SUCCESS", entries }),
    []
  );
  const startRestore = useCallback(
    (id: string) => dispatch({ type: "START_RESTORE", id }),
    []
  );
  const restoreSuccess = useCallback(() => dispatch({ type: "RESTORE_SUCCESS" }), []);
  const restoreError = useCallback(() => dispatch({ type: "RESTORE_ERROR" }), []);

  return {
    ...state,
    open,
    close,
    startLoad,
    loadSuccess,
    startRestore,
    restoreSuccess,
    restoreError,
  };
}

// ============================================================================
// Spreadsheet Preview State
// ============================================================================

type SpreadsheetPreviewPayload = {
  tables: Array<{
    id: string;
    name: string;
    // Add other properties as needed
  }>;
  // Add other properties as needed
};

type SpreadsheetPreviewState = {
  isOpen: boolean;
  isWizardOpen: boolean;
  isMappingVisible: boolean;
  isLoading: boolean;
  isApplying: boolean;
  payload: SpreadsheetPreviewPayload | null;
  excludedTablaIds: string[];
  stepIndex: number;
  activeAdjustmentTablaId: string | null;
  activeMappingDbColumn: string | null;
};

type SpreadsheetPreviewAction =
  | { type: "OPEN_PREVIEW" }
  | { type: "CLOSE_PREVIEW" }
  | { type: "OPEN_WIZARD" }
  | { type: "CLOSE_WIZARD" }
  | { type: "SHOW_MAPPING" }
  | { type: "HIDE_MAPPING" }
  | { type: "START_LOAD" }
  | { type: "LOAD_SUCCESS"; payload: SpreadsheetPreviewPayload }
  | { type: "LOAD_ERROR" }
  | { type: "START_APPLY" }
  | { type: "APPLY_SUCCESS" }
  | { type: "APPLY_ERROR" }
  | { type: "SET_EXCLUDED_TABLA_IDS"; ids: string[] }
  | { type: "SET_STEP_INDEX"; index: number }
  | { type: "SET_ACTIVE_ADJUSTMENT_TABLA_ID"; id: string | null }
  | { type: "SET_ACTIVE_MAPPING_DB_COLUMN"; column: string | null }
  | { type: "RESET" };

const initialSpreadsheetPreviewState: SpreadsheetPreviewState = {
  isOpen: false,
  isWizardOpen: false,
  isMappingVisible: false,
  isLoading: false,
  isApplying: false,
  payload: null,
  excludedTablaIds: [],
  stepIndex: 0,
  activeAdjustmentTablaId: null,
  activeMappingDbColumn: null,
};

function spreadsheetPreviewReducer(
  state: SpreadsheetPreviewState,
  action: SpreadsheetPreviewAction
): SpreadsheetPreviewState {
  switch (action.type) {
    case "OPEN_PREVIEW":
      return { ...state, isOpen: true };
    case "CLOSE_PREVIEW":
      return { ...state, isOpen: false };
    case "OPEN_WIZARD":
      return { ...state, isWizardOpen: true };
    case "CLOSE_WIZARD":
      return { ...state, isWizardOpen: false };
    case "SHOW_MAPPING":
      return { ...state, isMappingVisible: true };
    case "HIDE_MAPPING":
      return { ...state, isMappingVisible: false };
    case "START_LOAD":
      return { ...state, isLoading: true };
    case "LOAD_SUCCESS":
      return { ...state, isLoading: false, payload: action.payload };
    case "LOAD_ERROR":
      return { ...state, isLoading: false };
    case "START_APPLY":
      return { ...state, isApplying: true };
    case "APPLY_SUCCESS":
      return { ...state, isApplying: false, isOpen: false };
    case "APPLY_ERROR":
      return { ...state, isApplying: false };
    case "SET_EXCLUDED_TABLA_IDS":
      return { ...state, excludedTablaIds: action.ids };
    case "SET_STEP_INDEX":
      return { ...state, stepIndex: action.index };
    case "SET_ACTIVE_ADJUSTMENT_TABLA_ID":
      return { ...state, activeAdjustmentTablaId: action.id };
    case "SET_ACTIVE_MAPPING_DB_COLUMN":
      return { ...state, activeMappingDbColumn: action.column };
    case "RESET":
      return initialSpreadsheetPreviewState;
    default:
      return state;
  }
}

export function useSpreadsheetPreview() {
  const [state, dispatch] = useReducer(
    spreadsheetPreviewReducer,
    initialSpreadsheetPreviewState
  );

  const openPreview = useCallback(() => dispatch({ type: "OPEN_PREVIEW" }), []);
  const closePreview = useCallback(() => dispatch({ type: "CLOSE_PREVIEW" }), []);
  const openWizard = useCallback(() => dispatch({ type: "OPEN_WIZARD" }), []);
  const closeWizard = useCallback(() => dispatch({ type: "CLOSE_WIZARD" }), []);
  const showMapping = useCallback(() => dispatch({ type: "SHOW_MAPPING" }), []);
  const hideMapping = useCallback(() => dispatch({ type: "HIDE_MAPPING" }), []);
  const startLoad = useCallback(() => dispatch({ type: "START_LOAD" }), []);
  const loadSuccess = useCallback(
    (payload: SpreadsheetPreviewPayload) => dispatch({ type: "LOAD_SUCCESS", payload }),
    []
  );
  const loadError = useCallback(() => dispatch({ type: "LOAD_ERROR" }), []);
  const startApply = useCallback(() => dispatch({ type: "START_APPLY" }), []);
  const applySuccess = useCallback(() => dispatch({ type: "APPLY_SUCCESS" }), []);
  const applyError = useCallback(() => dispatch({ type: "APPLY_ERROR" }), []);
  const setExcludedTablaIds = useCallback(
    (ids: string[]) => dispatch({ type: "SET_EXCLUDED_TABLA_IDS", ids }),
    []
  );
  const setStepIndex = useCallback(
    (index: number) => dispatch({ type: "SET_STEP_INDEX", index }),
    []
  );
  const setActiveAdjustmentTablaId = useCallback(
    (id: string | null) => dispatch({ type: "SET_ACTIVE_ADJUSTMENT_TABLA_ID", id }),
    []
  );
  const setActiveMappingDbColumn = useCallback(
    (column: string | null) => dispatch({ type: "SET_ACTIVE_MAPPING_DB_COLUMN", column }),
    []
  );
  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return {
    ...state,
    openPreview,
    closePreview,
    openWizard,
    closeWizard,
    showMapping,
    hideMapping,
    startLoad,
    loadSuccess,
    loadError,
    startApply,
    applySuccess,
    applyError,
    setExcludedTablaIds,
    setStepIndex,
    setActiveAdjustmentTablaId,
    setActiveMappingDbColumn,
    reset,
  };
}

// ============================================================================
// Reprocess All State
// ============================================================================

type ReprocessAllState = {
  isProcessing: boolean;
  isConfirmOpen: boolean;
  progress: { done: number; total: number; errors: number } | null;
};

type ReprocessAllAction =
  | { type: "OPEN_CONFIRM" }
  | { type: "CLOSE_CONFIRM" }
  | { type: "START_PROCESS" }
  | { type: "UPDATE_PROGRESS"; done: number; total: number; errors: number }
  | { type: "COMPLETE" };

const initialReprocessAllState: ReprocessAllState = {
  isProcessing: false,
  isConfirmOpen: false,
  progress: null,
};

function reprocessAllReducer(
  state: ReprocessAllState,
  action: ReprocessAllAction
): ReprocessAllState {
  switch (action.type) {
    case "OPEN_CONFIRM":
      return { ...state, isConfirmOpen: true };
    case "CLOSE_CONFIRM":
      return { ...state, isConfirmOpen: false };
    case "START_PROCESS":
      return { ...state, isProcessing: true, isConfirmOpen: false, progress: { done: 0, total: 0, errors: 0 } };
    case "UPDATE_PROGRESS":
      return {
        ...state,
        progress: { done: action.done, total: action.total, errors: action.errors },
      };
    case "COMPLETE":
      return { ...state, isProcessing: false };
    default:
      return state;
  }
}

export function useReprocessAll() {
  const [state, dispatch] = useReducer(reprocessAllReducer, initialReprocessAllState);

  const openConfirm = useCallback(() => dispatch({ type: "OPEN_CONFIRM" }), []);
  const closeConfirm = useCallback(() => dispatch({ type: "CLOSE_CONFIRM" }), []);
  const startProcess = useCallback(() => dispatch({ type: "START_PROCESS" }), []);
  const updateProgress = useCallback(
    (done: number, total: number, errors: number) =>
      dispatch({ type: "UPDATE_PROGRESS", done, total, errors }),
    []
  );
  const complete = useCallback(() => dispatch({ type: "COMPLETE" }), []);

  return {
    ...state,
    openConfirm,
    closeConfirm,
    startProcess,
    updateProgress,
    complete,
  };
}

// ============================================================================
// View Mode State
// ============================================================================

type ViewModeState = {
  documentViewMode: "cards" | "table";
  ocrDataViewMode: "cards" | "table";
  ocrViewMode: "table" | "documents";
};

type ViewModeAction =
  | { type: "SET_DOCUMENT_VIEW_MODE"; mode: "cards" | "table" }
  | { type: "SET_OCR_DATA_VIEW_MODE"; mode: "cards" | "table" }
  | { type: "SET_OCR_VIEW_MODE"; mode: "table" | "documents" };

const initialViewModeState: ViewModeState = {
  documentViewMode: "cards",
  ocrDataViewMode: "cards",
  ocrViewMode: "table",
};

function viewModeReducer(state: ViewModeState, action: ViewModeAction): ViewModeState {
  switch (action.type) {
    case "SET_DOCUMENT_VIEW_MODE":
      return { ...state, documentViewMode: action.mode };
    case "SET_OCR_DATA_VIEW_MODE":
      return { ...state, ocrDataViewMode: action.mode };
    case "SET_OCR_VIEW_MODE":
      return { ...state, ocrViewMode: action.mode };
    default:
      return state;
  }
}

export function useViewModes() {
  const [state, dispatch] = useReducer(viewModeReducer, initialViewModeState);

  const setDocumentViewMode = useCallback(
    (mode: "cards" | "table") => dispatch({ type: "SET_DOCUMENT_VIEW_MODE", mode }),
    []
  );
  const setOcrDataViewMode = useCallback(
    (mode: "cards" | "table") => dispatch({ type: "SET_OCR_DATA_VIEW_MODE", mode }),
    []
  );
  const setOcrViewMode = useCallback(
    (mode: "table" | "documents") => dispatch({ type: "SET_OCR_VIEW_MODE", mode }),
    []
  );

  return {
    ...state,
    setDocumentViewMode,
    setOcrDataViewMode,
    setOcrViewMode,
  };
}
