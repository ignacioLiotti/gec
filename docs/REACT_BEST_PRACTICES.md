# React Best Practices Guide

This document outlines React best practices based on anti-patterns identified in the codebase. Following these guidelines will improve performance, maintainability, and developer experience.

---

## Table of Contents

1. [State Management](#state-management)
2. [useEffect Anti-Patterns](#useeffect-anti-patterns)
3. [Data Fetching](#data-fetching)
4. [Component Structure](#component-structure)
5. [Performance Optimization](#performance-optimization)
6. [Code Organization](#code-organization)

---

## State Management

### Problem: Too Many Independent useState Calls

**Bad Pattern Found:**
```tsx
// obraid/page.tsx has 18+ useState calls for related state
const [isAddingCertificate, setIsAddingCertificate] = useState(false);
const [newCertificate, setNewCertificate] = useState<NewCertificateFormState>(() => ({ ...certificateFormDefault }));
const [createCertificateError, setCreateCertificateError] = useState<string | null>(null);
const [isCreatingCertificate, setIsCreatingCertificate] = useState(false);

const [isMemoriaOpen, setIsMemoriaOpen] = useState(false);
const [memoriaDraft, setMemoriaDraft] = useState("");

const [selectedRecipientUserId, setSelectedRecipientUserId] = useState<string>("");
const [selectedRecipientRoleId, setSelectedRecipientRoleId] = useState<string>("");

// ... 30+ more useState calls
```

**Why It's Bad:**
- Hard to track which states are related
- Risk of inconsistent state updates
- Component re-renders for every individual state change
- Difficult to reset multiple related states together

**Good Pattern - useReducer for Related State:**
```tsx
// Group related state into reducers
type CertificateState = {
  isAdding: boolean;
  isCreating: boolean;
  error: string | null;
  formData: NewCertificateFormState;
};

type CertificateAction =
  | { type: 'START_ADD' }
  | { type: 'CANCEL_ADD' }
  | { type: 'START_CREATE' }
  | { type: 'CREATE_SUCCESS' }
  | { type: 'CREATE_ERROR'; error: string }
  | { type: 'UPDATE_FORM'; payload: Partial<NewCertificateFormState> }
  | { type: 'RESET' };

function certificateReducer(state: CertificateState, action: CertificateAction): CertificateState {
  switch (action.type) {
    case 'START_ADD':
      return { ...state, isAdding: true, error: null };
    case 'CANCEL_ADD':
      return { ...state, isAdding: false, formData: certificateFormDefault };
    case 'START_CREATE':
      return { ...state, isCreating: true, error: null };
    case 'CREATE_SUCCESS':
      return { ...state, isCreating: false, isAdding: false, formData: certificateFormDefault };
    case 'CREATE_ERROR':
      return { ...state, isCreating: false, error: action.error };
    case 'UPDATE_FORM':
      return { ...state, formData: { ...state.formData, ...action.payload } };
    case 'RESET':
      return initialCertificateState;
    default:
      return state;
  }
}

// Usage
const [certState, certDispatch] = useReducer(certificateReducer, initialCertificateState);
```

**Good Pattern - Custom Hook for State Groups:**
```tsx
// hooks/useCertificateForm.ts
export function useCertificateForm() {
  const [state, dispatch] = useReducer(certificateReducer, initialState);
  
  const startAdd = useCallback(() => dispatch({ type: 'START_ADD' }), []);
  const cancelAdd = useCallback(() => dispatch({ type: 'CANCEL_ADD' }), []);
  const updateForm = useCallback(
    (data: Partial<NewCertificateFormState>) => dispatch({ type: 'UPDATE_FORM', payload: data }),
    []
  );
  
  return {
    ...state,
    startAdd,
    cancelAdd,
    updateForm,
  };
}
```

### Problem: Boolean State for Loading/Error/Success

**Bad Pattern Found:**
```tsx
const [isCreatingCertificate, setIsCreatingCertificate] = useState(false);
const [createCertificateError, setCreateCertificateError] = useState<string | null>(null);
const [isSavingObra, setIsSavingObra] = useState(false);
const [isDeletingObra, setIsDeletingObra] = useState(false);
```

**Good Pattern - Discriminated Union State:**
```tsx
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };

// Or use a custom hook
function useAsyncAction<T>() {
  const [state, setState] = useState<AsyncState<T>>({ status: 'idle' });
  
  const execute = useCallback(async (promise: Promise<T>) => {
    setState({ status: 'loading' });
    try {
      const data = await promise;
      setState({ status: 'success', data });
      return data;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      setState({ status: 'error', error });
      throw err;
    }
  }, []);
  
  const reset = useCallback(() => setState({ status: 'idle' }), []);
  
  return { state, execute, reset, isLoading: state.status === 'loading' };
}
```

---

## useEffect Anti-Patterns

### Problem: Data Fetching in useEffect

**Bad Pattern Found:**
```tsx
// obraid/page.tsx - fetching inside useEffect
useEffect(() => {
  let cancelled = false;
  void (async () => {
    try {
      const response = await fetch("/api/tenant-marker", { cache: "no-store" });
      if (!response.ok) {
        if (!cancelled) setIsIlagDemoTenant(false);
        return;
      }
      const payload = await response.json();
      if (!cancelled) setIsIlagDemoTenant(payload.isIlagDemoTenant === true);
    } catch (error) {
      if (!cancelled) setIsIlagDemoTenant(false);
    }
  })();
  return () => { cancelled = true; };
}, [activeTenantId]);
```

**Why It's Bad:**
- Manual cancellation handling is error-prone
- No caching, deduplication, or retry logic
- Race conditions between multiple effects
- No loading/error state management

**Good Pattern - Use React Query/SWR:**
```tsx
// Already have React Query in the project - use it consistently
const { data: tenantMarker } = useQuery({
  queryKey: ['tenant-marker', activeTenantId],
  queryFn: async () => {
    const response = await fetch("/api/tenant-marker", { cache: "no-store" });
    if (!response.ok) return { isIlagDemoTenant: false };
    return response.json();
  },
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const isIlagDemoTenant = tenantMarker?.isIlagDemoTenant ?? false;
```

### Problem: Chained useEffects

**Bad Pattern Found:**
```tsx
// Effect 1: fetch data
useEffect(() => {
  fetchData().then(setData);
}, []);

// Effect 2: react to data change
useEffect(() => {
  if (data) {
    processData(data);
  }
}, [data]);

// Effect 3: react to processed data
useEffect(() => {
  if (processedData) {
    updateUI(processedData);
  }
}, [processedData]);
```

**Good Pattern - Derive State or Use Single Effect:**
```tsx
// Option 1: Derive in useMemo
const processedData = useMemo(() => {
  if (!data) return null;
  return processData(data);
}, [data]);

// Option 2: Single effect with all logic
useEffect(() => {
  let cancelled = false;
  
  async function loadAndProcess() {
    const data = await fetchData();
    if (cancelled) return;
    
    const processed = processData(data);
    updateUI(processed);
  }
  
  loadAndProcess();
  return () => { cancelled = true; };
}, []);
```

### Problem: useEffect for Derived State

**Bad Pattern:**
```tsx
const [items, setItems] = useState([]);
const [filteredItems, setFilteredItems] = useState([]);
const [searchQuery, setSearchQuery] = useState('');

useEffect(() => {
  setFilteredItems(items.filter(item => item.name.includes(searchQuery)));
}, [items, searchQuery]);
```

**Good Pattern - useMemo:**
```tsx
const [items, setItems] = useState([]);
const [searchQuery, setSearchQuery] = useState('');

const filteredItems = useMemo(
  () => items.filter(item => item.name.includes(searchQuery)),
  [items, searchQuery]
);
```

---

## Data Fetching

### Problem: Multiple Independent Queries Without Coordination

**Bad Pattern Found:**
```tsx
// 17+ useQuery calls in obraid/page.tsx
const obraQuery = useQuery({ queryKey: ["obra", obraId], queryFn: () => fetchObraDetail(obraId) });
const tablasQuery = useQuery({ queryKey: ["obra", obraId, "tablas"], queryFn: () => fetchTablas(obraId) });
const defaultsQuery = useQuery({ queryKey: ["obra", obraId, "defaults"], queryFn: () => fetchDefaults(obraId) });
const recipientsQuery = useQuery({ queryKey: ["obra", obraId, "recipients"], queryFn: () => fetchRecipients(obraId) });
const materialsQuery = useQuery({ queryKey: ["obra", obraId, "materials"], queryFn: () => fetchMaterials(obraId) });
// ... 12 more queries
```

**Good Pattern - Grouped Custom Hook:**
```tsx
// hooks/useObraData.ts
export function useObraData(obraId: string) {
  // Core data - always needed
  const obraQuery = useQuery({
    queryKey: obraQueryKeys.detail(obraId),
    queryFn: () => fetchObraDetail(obraId),
  });

  // Dependent queries - only fetch when obra is loaded
  const tablasQuery = useQuery({
    queryKey: obraQueryKeys.tablas(obraId),
    queryFn: () => fetchTablas(obraId),
    enabled: !!obraQuery.data,
  });

  // Combine loading states
  const isLoading = obraQuery.isLoading || tablasQuery.isLoading;
  const error = obraQuery.error || tablasQuery.error;

  return {
    obra: obraQuery.data,
    tablas: tablasQuery.data,
    isLoading,
    error,
    refetch: () => Promise.all([obraQuery.refetch(), tablasQuery.refetch()]),
  };
}
```

**Good Pattern - Query Key Factory:**
```tsx
// Already implemented in lib/obra-queries.ts - use consistently
export const obraQueryKeys = {
  all: ['obra'] as const,
  detail: (obraId: string) => [...obraQueryKeys.all, obraId] as const,
  tablas: (obraId: string) => [...obraQueryKeys.detail(obraId), 'tablas'] as const,
  materials: (obraId: string) => [...obraQueryKeys.detail(obraId), 'materials'] as const,
  // etc.
};

// Benefits:
// - Consistent cache keys
// - Easy to invalidate related queries
// - Type-safe query keys
```

---

## Component Structure

### Problem: Giant Component Files

**Current State:**
- `obraid/page.tsx`: ~3,900 lines, 18 useState, 8 useEffect
- `file-manager.tsx`: ~8,000 lines, 34 useState, 19 useEffect

**Why It's Bad:**
- Hard to navigate and understand
- Difficult to test individual parts
- Poor code reuse
- Slower HMR during development

**Good Pattern - Split by Feature:**
```
app/excel/[obraId]/
├── page.tsx                    # Main page, minimal logic, composition only
├── components/
│   ├── general-tab/
│   │   ├── index.tsx
│   │   ├── obra-info-card.tsx
│   │   ├── obra-progress-chart.tsx
│   │   └── hooks/useObraForm.ts
│   ├── flujo-tab/
│   │   ├── index.tsx
│   │   └── ...
│   └── documents-tab/
│       ├── index.tsx
│       └── ...
├── hooks/
│   ├── useObraData.ts
│   ├── useCertificateForm.ts
│   └── useObraActions.ts
└── types.ts
```

### Problem: Inline Type Definitions

**Bad Pattern Found:**
```tsx
// Types defined in the middle of the component
type NewOrderItemForm = {
  cantidad: string;
  unidad: string;
  material: string;
  precioUnitario: string;
};

type NewOrderForm = {
  nroOrden: string;
  fecha: string;
  // ...
};
```

**Good Pattern - Separate Types File:**
```tsx
// types/obra.ts or near the component in types.ts
export type NewOrderItemForm = {
  cantidad: string;
  unidad: string;
  material: string;
  precioUnitario: string;
};

export type NewOrderForm = {
  nroOrden: string;
  fecha: string;
  solicitante: string;
  proveedor: string;
  items: NewOrderItemForm[];
};
```

---

## Performance Optimization

### Problem: Expensive Computations in Render

**Bad Pattern:**
```tsx
function Component({ items }) {
  // This runs on every render
  const processedItems = items
    .filter(expensiveFilter)
    .map(expensiveTransform)
    .sort(expensiveSort);
    
  return <List items={processedItems} />;
}
```

**Good Pattern - useMemo:**
```tsx
function Component({ items }) {
  const processedItems = useMemo(() => {
    return items
      .filter(expensiveFilter)
      .map(expensiveTransform)
      .sort(expensiveSort);
  }, [items]);
    
  return <List items={processedItems} />;
}
```

### Problem: New Object/Array References in Props

**Bad Pattern:**
```tsx
function Parent() {
  return (
    <Child
      options={{ enabled: true, maxItems: 10 }} // New object every render
      handlers={[handleA, handleB]}              // New array every render
      onSubmit={() => doSomething()}             // New function every render
    />
  );
}
```

**Good Pattern - Stable References:**
```tsx
function Parent() {
  const options = useMemo(() => ({ enabled: true, maxItems: 10 }), []);
  const handlers = useMemo(() => [handleA, handleB], [handleA, handleB]);
  const onSubmit = useCallback(() => doSomething(), []);
  
  return <Child options={options} handlers={handlers} onSubmit={onSubmit} />;
}
```

### Problem: Not Using React Compiler / memo

**Good Pattern - Let React Compiler Handle It:**
```tsx
// next.config.js - enable React Compiler
const nextConfig = {
  reactCompiler: true,
};

// For cases where you need manual control:
const ExpensiveComponent = memo(function ExpensiveComponent({ data }) {
  // Only re-renders when data changes
  return <ExpensiveVisualization data={data} />;
});
```

---

## Code Organization

### Problem: Utility Functions Inside Components

**Bad Pattern Found:**
```tsx
function ObraPage() {
  // ~300 lines of utility functions defined inside the component
  const normalizeForSearch = (v: string): string =>
    v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    
  async function fetchMaterialOrders(obraId: string) {
    // ... 30 lines
  }
  
  // Component logic starts here
}
```

**Good Pattern - Extract to Modules:**
```tsx
// lib/obra-queries.ts (already done!)
export const normalizeForSearch = (v: string): string =>
  v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export async function fetchMaterialOrders(obraId: string) {
  // ...
}

// Component imports and uses
import { normalizeForSearch, fetchMaterialOrders } from '@/lib/obra-queries';
```

### Problem: Callback Hell with Multiple setState

**Bad Pattern Found:**
```tsx
const resetNewFolderForm = useCallback(() => {
  setNewFolderName('');
  setCreateFolderError(null);
  setNewFolderDataInputMethod('both');
  setNewFolderOcrTemplateId('');
  setNewFolderSpreadsheetTemplate('');
  setNewFolderDescription('');
  setNewFolderHasNested(false);
  setNewFolderColumns([{ id: crypto.randomUUID(), label: 'Columna 1', ... }]);
  setCreateFolderMode(null);
  setCreateFolderParent(null);
  setConvertFolderTarget(null);
}, []);
```

**Good Pattern - useReducer with RESET action:**
```tsx
function folderFormReducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return initialFolderFormState;
    case 'UPDATE':
      return { ...state, ...action.payload };
    // ...
  }
}

const [formState, dispatch] = useReducer(folderFormReducer, initialFolderFormState);
const resetForm = useCallback(() => dispatch({ type: 'RESET' }), []);
```

---

## Summary of Issues Found

| File | useState Count | useEffect Count | Lines | Severity |
|------|---------------|-----------------|-------|----------|
| `obraid/page.tsx` | 18+ | 8 | ~3,900 | High |
| `file-manager.tsx` | 34+ | 19 | ~8,000 | Critical |
| `app-sidebar.tsx` | 0 | 1 | ~960 | Low |

### Priority Fixes

1. **High Priority**: Extract related states into useReducer hooks
2. **High Priority**: Replace fetch-in-useEffect with React Query
3. **Medium Priority**: Split large components into smaller files
4. **Medium Priority**: Extract utility functions to lib/
5. **Low Priority**: Add consistent query key factories

### Quick Wins

1. Use `useMemo` for derived state (stop using useEffect to sync state)
2. Use query key factories for cache invalidation
3. Enable React Compiler in next.config.js
4. Create custom hooks for repeated patterns
