/**
 * REFERENCE IMPLEMENTATION - Not yet wired into the page
 * 
 * These hooks demonstrate the recommended pattern for refactoring the
 * existing useState calls in page.tsx into useReducer-based state management.
 * 
 * See docs/REACT_BEST_PRACTICES.md for the full migration guide.
 * 
 * To use: Import and replace the existing useState calls in page.tsx with
 * these hooks. For example, replace multiple certificate form useState calls
 * with: const [certState, certDispatch] = useCertificateForm();
 */
"use client";

import { useReducer, useCallback } from "react";
import type { Obra } from "@/types/types";

// ============================================================================
// Certificate Form State
// ============================================================================

export type NewCertificateFormState = {
  nombre: string;
  fechaEmision: string;
  montoBasico: string;
  // Add other certificate form fields as needed
};

export const certificateFormDefault: NewCertificateFormState = {
  nombre: "",
  fechaEmision: "",
  montoBasico: "",
};

type CertificateFormState = {
  isAdding: boolean;
  isCreating: boolean;
  error: string | null;
  formData: NewCertificateFormState;
};

type CertificateFormAction =
  | { type: "START_ADD" }
  | { type: "CANCEL_ADD" }
  | { type: "START_CREATE" }
  | { type: "CREATE_SUCCESS" }
  | { type: "CREATE_ERROR"; error: string }
  | { type: "UPDATE_FORM"; payload: Partial<NewCertificateFormState> }
  | { type: "SET_FORM"; payload: NewCertificateFormState }
  | { type: "RESET" };

const initialCertificateFormState: CertificateFormState = {
  isAdding: false,
  isCreating: false,
  error: null,
  formData: certificateFormDefault,
};

function certificateFormReducer(
  state: CertificateFormState,
  action: CertificateFormAction
): CertificateFormState {
  switch (action.type) {
    case "START_ADD":
      return { ...state, isAdding: true, error: null };
    case "CANCEL_ADD":
      return { ...state, isAdding: false, formData: certificateFormDefault, error: null };
    case "START_CREATE":
      return { ...state, isCreating: true, error: null };
    case "CREATE_SUCCESS":
      return {
        ...state,
        isCreating: false,
        isAdding: false,
        formData: certificateFormDefault,
        error: null,
      };
    case "CREATE_ERROR":
      return { ...state, isCreating: false, error: action.error };
    case "UPDATE_FORM":
      return { ...state, formData: { ...state.formData, ...action.payload } };
    case "SET_FORM":
      return { ...state, formData: action.payload };
    case "RESET":
      return initialCertificateFormState;
    default:
      return state;
  }
}

export function useCertificateForm() {
  const [state, dispatch] = useReducer(certificateFormReducer, initialCertificateFormState);

  const startAdd = useCallback(() => dispatch({ type: "START_ADD" }), []);
  const cancelAdd = useCallback(() => dispatch({ type: "CANCEL_ADD" }), []);
  const startCreate = useCallback(() => dispatch({ type: "START_CREATE" }), []);
  const createSuccess = useCallback(() => dispatch({ type: "CREATE_SUCCESS" }), []);
  const createError = useCallback(
    (error: string) => dispatch({ type: "CREATE_ERROR", error }),
    []
  );
  const updateForm = useCallback(
    (payload: Partial<NewCertificateFormState>) => dispatch({ type: "UPDATE_FORM", payload }),
    []
  );
  const setForm = useCallback(
    (payload: NewCertificateFormState) => dispatch({ type: "SET_FORM", payload }),
    []
  );
  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return {
    ...state,
    startAdd,
    cancelAdd,
    startCreate,
    createSuccess,
    createError,
    updateForm,
    setForm,
    reset,
  };
}

// ============================================================================
// Obra Edit State
// ============================================================================

type ObraEditState = {
  isEditMode: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  isResolvingDataFlow: boolean;
  initialFormValues: Obra;
};

type ObraEditAction =
  | { type: "START_EDIT" }
  | { type: "CANCEL_EDIT" }
  | { type: "START_SAVE" }
  | { type: "SAVE_SUCCESS" }
  | { type: "SAVE_ERROR" }
  | { type: "START_DELETE" }
  | { type: "DELETE_SUCCESS" }
  | { type: "DELETE_ERROR" }
  | { type: "START_RESOLVE_DATA_FLOW" }
  | { type: "RESOLVE_DATA_FLOW_COMPLETE" }
  | { type: "SET_INITIAL_VALUES"; payload: Obra };

const emptyObra: Obra = {
  id: "",
  nombre: "",
  porcentaje: 0,
  plazoTotal: 0,
  plazoTransc: 0,
  presupuesto: 0,
  comitente: "",
  ubicacion: "",
  responsables: "",
  estado: "en_curso",
  tenant_id: "",
  // Add other required Obra fields with defaults
} as Obra;

const initialObraEditState: ObraEditState = {
  isEditMode: false,
  isSaving: false,
  isDeleting: false,
  isResolvingDataFlow: false,
  initialFormValues: emptyObra,
};

function obraEditReducer(state: ObraEditState, action: ObraEditAction): ObraEditState {
  switch (action.type) {
    case "START_EDIT":
      return { ...state, isEditMode: true };
    case "CANCEL_EDIT":
      return { ...state, isEditMode: false };
    case "START_SAVE":
      return { ...state, isSaving: true };
    case "SAVE_SUCCESS":
      return { ...state, isSaving: false, isEditMode: false };
    case "SAVE_ERROR":
      return { ...state, isSaving: false };
    case "START_DELETE":
      return { ...state, isDeleting: true };
    case "DELETE_SUCCESS":
      return { ...state, isDeleting: false };
    case "DELETE_ERROR":
      return { ...state, isDeleting: false };
    case "START_RESOLVE_DATA_FLOW":
      return { ...state, isResolvingDataFlow: true };
    case "RESOLVE_DATA_FLOW_COMPLETE":
      return { ...state, isResolvingDataFlow: false };
    case "SET_INITIAL_VALUES":
      return { ...state, initialFormValues: action.payload };
    default:
      return state;
  }
}

export function useObraEdit() {
  const [state, dispatch] = useReducer(obraEditReducer, initialObraEditState);

  const startEdit = useCallback(() => dispatch({ type: "START_EDIT" }), []);
  const cancelEdit = useCallback(() => dispatch({ type: "CANCEL_EDIT" }), []);
  const startSave = useCallback(() => dispatch({ type: "START_SAVE" }), []);
  const saveSuccess = useCallback(() => dispatch({ type: "SAVE_SUCCESS" }), []);
  const saveError = useCallback(() => dispatch({ type: "SAVE_ERROR" }), []);
  const startDelete = useCallback(() => dispatch({ type: "START_DELETE" }), []);
  const deleteSuccess = useCallback(() => dispatch({ type: "DELETE_SUCCESS" }), []);
  const deleteError = useCallback(() => dispatch({ type: "DELETE_ERROR" }), []);
  const startResolveDataFlow = useCallback(() => dispatch({ type: "START_RESOLVE_DATA_FLOW" }), []);
  const resolveDataFlowComplete = useCallback(
    () => dispatch({ type: "RESOLVE_DATA_FLOW_COMPLETE" }),
    []
  );
  const setInitialValues = useCallback(
    (values: Obra) => dispatch({ type: "SET_INITIAL_VALUES", payload: values }),
    []
  );

  return {
    ...state,
    startEdit,
    cancelEdit,
    startSave,
    saveSuccess,
    saveError,
    startDelete,
    deleteSuccess,
    deleteError,
    startResolveDataFlow,
    resolveDataFlowComplete,
    setInitialValues,
  };
}

// ============================================================================
// Flujo Action Form State
// ============================================================================

export type FlujoActionFormData = {
  action_type: "email" | "notification" | "webhook";
  timing_mode: "immediate" | "scheduled" | "recurring";
  offset_value: number;
  offset_unit: "hours" | "days" | "weeks";
  title: string;
  message: string;
  recipient_user_ids: string[];
  notification_types: ("in_app" | "email" | "sms")[];
  enabled: boolean;
};

const defaultFlujoActionForm: FlujoActionFormData = {
  action_type: "email",
  timing_mode: "immediate",
  offset_value: 1,
  offset_unit: "days",
  title: "",
  message: "",
  recipient_user_ids: [],
  notification_types: ["in_app", "email"],
  enabled: true,
};

type FlujoActionFormState = {
  isAdding: boolean;
  isSaving: boolean;
  formData: FlujoActionFormData;
  selectedUserId: string;
  selectedRoleId: string;
};

type FlujoActionFormAction =
  | { type: "START_ADD" }
  | { type: "CANCEL_ADD" }
  | { type: "START_SAVE" }
  | { type: "SAVE_SUCCESS" }
  | { type: "SAVE_ERROR" }
  | { type: "UPDATE_FORM"; payload: Partial<FlujoActionFormData> }
  | { type: "SET_SELECTED_USER"; userId: string }
  | { type: "SET_SELECTED_ROLE"; roleId: string }
  | { type: "RESET" };

const initialFlujoActionFormState: FlujoActionFormState = {
  isAdding: false,
  isSaving: false,
  formData: defaultFlujoActionForm,
  selectedUserId: "",
  selectedRoleId: "",
};

function flujoActionFormReducer(
  state: FlujoActionFormState,
  action: FlujoActionFormAction
): FlujoActionFormState {
  switch (action.type) {
    case "START_ADD":
      return { ...state, isAdding: true };
    case "CANCEL_ADD":
      return { ...state, isAdding: false, formData: defaultFlujoActionForm };
    case "START_SAVE":
      return { ...state, isSaving: true };
    case "SAVE_SUCCESS":
      return {
        ...state,
        isSaving: false,
        isAdding: false,
        formData: defaultFlujoActionForm,
      };
    case "SAVE_ERROR":
      return { ...state, isSaving: false };
    case "UPDATE_FORM":
      return { ...state, formData: { ...state.formData, ...action.payload } };
    case "SET_SELECTED_USER":
      return { ...state, selectedUserId: action.userId };
    case "SET_SELECTED_ROLE":
      return { ...state, selectedRoleId: action.roleId };
    case "RESET":
      return initialFlujoActionFormState;
    default:
      return state;
  }
}

export function useFlujoActionForm() {
  const [state, dispatch] = useReducer(flujoActionFormReducer, initialFlujoActionFormState);

  const startAdd = useCallback(() => dispatch({ type: "START_ADD" }), []);
  const cancelAdd = useCallback(() => dispatch({ type: "CANCEL_ADD" }), []);
  const startSave = useCallback(() => dispatch({ type: "START_SAVE" }), []);
  const saveSuccess = useCallback(() => dispatch({ type: "SAVE_SUCCESS" }), []);
  const saveError = useCallback(() => dispatch({ type: "SAVE_ERROR" }), []);
  const updateForm = useCallback(
    (payload: Partial<FlujoActionFormData>) => dispatch({ type: "UPDATE_FORM", payload }),
    []
  );
  const setSelectedUser = useCallback(
    (userId: string) => dispatch({ type: "SET_SELECTED_USER", userId }),
    []
  );
  const setSelectedRole = useCallback(
    (roleId: string) => dispatch({ type: "SET_SELECTED_ROLE", roleId }),
    []
  );
  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return {
    ...state,
    startAdd,
    cancelAdd,
    startSave,
    saveSuccess,
    saveError,
    updateForm,
    setSelectedUser,
    setSelectedRole,
    reset,
  };
}

// ============================================================================
// Materials Filter State
// ============================================================================

type MaterialsFilterState = {
  globalFilter: string;
  expandedOrders: Set<string>;
  orderFilters: Record<string, string>;
};

type MaterialsFilterAction =
  | { type: "SET_GLOBAL_FILTER"; filter: string }
  | { type: "TOGGLE_ORDER"; orderId: string }
  | { type: "EXPAND_ALL"; orderIds: string[] }
  | { type: "COLLAPSE_ALL" }
  | { type: "SET_ORDER_FILTER"; orderId: string; filter: string }
  | { type: "RESET" };

const initialMaterialsFilterState: MaterialsFilterState = {
  globalFilter: "",
  expandedOrders: new Set(),
  orderFilters: {},
};

function materialsFilterReducer(
  state: MaterialsFilterState,
  action: MaterialsFilterAction
): MaterialsFilterState {
  switch (action.type) {
    case "SET_GLOBAL_FILTER":
      return { ...state, globalFilter: action.filter };
    case "TOGGLE_ORDER": {
      const next = new Set(state.expandedOrders);
      if (next.has(action.orderId)) {
        next.delete(action.orderId);
      } else {
        next.add(action.orderId);
      }
      return { ...state, expandedOrders: next };
    }
    case "EXPAND_ALL":
      return { ...state, expandedOrders: new Set(action.orderIds) };
    case "COLLAPSE_ALL":
      return { ...state, expandedOrders: new Set() };
    case "SET_ORDER_FILTER":
      return {
        ...state,
        orderFilters: { ...state.orderFilters, [action.orderId]: action.filter },
      };
    case "RESET":
      return initialMaterialsFilterState;
    default:
      return state;
  }
}

export function useMaterialsFilter() {
  const [state, dispatch] = useReducer(materialsFilterReducer, initialMaterialsFilterState);

  const setGlobalFilter = useCallback(
    (filter: string) => dispatch({ type: "SET_GLOBAL_FILTER", filter }),
    []
  );
  const toggleOrder = useCallback(
    (orderId: string) => dispatch({ type: "TOGGLE_ORDER", orderId }),
    []
  );
  const expandAll = useCallback(
    (orderIds: string[]) => dispatch({ type: "EXPAND_ALL", orderIds }),
    []
  );
  const collapseAll = useCallback(() => dispatch({ type: "COLLAPSE_ALL" }), []);
  const setOrderFilter = useCallback(
    (orderId: string, filter: string) =>
      dispatch({ type: "SET_ORDER_FILTER", orderId, filter }),
    []
  );
  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return {
    ...state,
    setGlobalFilter,
    toggleOrder,
    expandAll,
    collapseAll,
    setOrderFilter,
    reset,
  };
}

// ============================================================================
// Memoria (Notes) State
// ============================================================================

type MemoriaState = {
  isOpen: boolean;
  draft: string;
};

type MemoriaAction =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "SET_DRAFT"; draft: string }
  | { type: "CLEAR_DRAFT" };

const initialMemoriaState: MemoriaState = {
  isOpen: false,
  draft: "",
};

function memoriaReducer(state: MemoriaState, action: MemoriaAction): MemoriaState {
  switch (action.type) {
    case "OPEN":
      return { ...state, isOpen: true };
    case "CLOSE":
      return { ...state, isOpen: false };
    case "SET_DRAFT":
      return { ...state, draft: action.draft };
    case "CLEAR_DRAFT":
      return { ...state, draft: "" };
    default:
      return state;
  }
}

export function useMemoria() {
  const [state, dispatch] = useReducer(memoriaReducer, initialMemoriaState);

  const open = useCallback(() => dispatch({ type: "OPEN" }), []);
  const close = useCallback(() => dispatch({ type: "CLOSE" }), []);
  const setDraft = useCallback((draft: string) => dispatch({ type: "SET_DRAFT", draft }), []);
  const clearDraft = useCallback(() => dispatch({ type: "CLEAR_DRAFT" }), []);

  return {
    ...state,
    open,
    close,
    setDraft,
    clearDraft,
  };
}
