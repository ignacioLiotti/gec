# React Best Practices Guide

This document outlines React best practices based on anti-patterns identified in this codebase. It serves as a guide for future refactoring and new feature development.

**Current State**: This codebase has accumulated technical debt in state management and component structure. The patterns below describe *recommended* practices—most are not yet adopted. Use this as a reference when touching these files.

---

## Table of Contents

1. [State Management](#state-management)
2. [useEffect Guidelines](#useeffect-guidelines)
3. [Data Fetching](#data-fetching)
4. [Component Structure](#component-structure)
5. [Performance](#performance)
6. [Migration Examples](#migration-examples)

---

## State Management

### When to Use useState vs useReducer

**Use useState when:**
- State is primitive (string, number, boolean)
- State changes are independent
- You have 1-3 related pieces of state max

**Use useReducer when:**
- Multiple state values change together in response to the same event
- State transitions have business logic (e.g., "can only submit if form is valid")
- You need a "reset all" capability
- The next state depends on the previous state in complex ways

### Current Problem Areas

**`app/excel/[obraId]/page.tsx`** has 18+ useState calls, many of which are related:
```tsx
// These 4 states always change together during certificate creation
const [isAddingCertificate, setIsAddingCertificate] = useState(false);
const [newCertificate, setNewCertificate] = useState<...>(() => ({ ...default }));
const [createCertificateError, setCreateCertificateError] = useState<string | null>(null);
const [isCreatingCertificate, setIsCreatingCertificate] = useState(false);
```

**`file-manager.tsx`** has 34+ useState calls, including dialog states that should be unified:
```tsx
// Each dialog has open state + form state + error state
const [createFolderMode, setCreateFolderMode] = useState(null);
const [newFolderName, setNewFolderName] = useState('');
const [createFolderError, setCreateFolderError] = useState(null);
// ... 8 more states just for folder creation
```

### Recommended Pattern

Group related states, but don't over-engineer. A reducer is overkill for a simple toggle:

```tsx
// FINE - single independent boolean
const [isOpen, setIsOpen] = useState(false);

// CONSIDER REDUCER - multiple related states with shared transitions
type DialogState = {
  isOpen: boolean;
  mode: 'create' | 'edit' | null;
  name: string;
  error: string | null;
  isSubmitting: boolean;
};

type DialogAction =
  | { type: 'OPEN_CREATE' }
  | { type: 'OPEN_EDIT'; name: string }
  | { type: 'UPDATE_NAME'; name: string }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_ERROR'; error: string }
  | { type: 'CLOSE' }; // resets everything

function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case 'OPEN_CREATE':
      return { isOpen: true, mode: 'create', name: '', error: null, isSubmitting: false };
    case 'CLOSE':
      return { isOpen: false, mode: null, name: '', error: null, isSubmitting: false };
    // ...
  }
}
```

---

## useEffect Guidelines

### Legitimate useEffect Uses

1. **Syncing with external systems** (DOM APIs, third-party libraries, subscriptions)
2. **One-time setup on mount** (analytics, focus management)
3. **Reacting to route/param changes** when you need side effects

### Anti-Patterns Found in This Codebase

#### 1. Fetching in useEffect

**Current code (`page.tsx`):**
```tsx
useEffect(() => {
  let cancelled = false;
  void (async () => {
    const response = await fetch("/api/tenant-marker");
    if (!cancelled) setIsIlagDemoTenant(response.ok ? (await response.json()).isIlagDemoTenant : false);
  })();
  return () => { cancelled = true; };
}, [activeTenantId]);
```

**Problem**: Manual cancellation, no caching, no loading state, race conditions.

**Fix**: This codebase already uses React Query. Use it consistently:
```tsx
const { data: tenantMarker } = useQuery({
  queryKey: ['tenant-marker', activeTenantId],
  queryFn: () => fetch("/api/tenant-marker").then(r => r.json()),
  staleTime: 5 * 60 * 1000,
});
const isIlagDemoTenant = tenantMarker?.isIlagDemoTenant ?? false;
```

#### 2. useEffect to Compute Derived State

**Anti-pattern:**
```tsx
const [items, setItems] = useState([]);
const [filtered, setFiltered] = useState([]);
const [search, setSearch] = useState('');

useEffect(() => {
  setFiltered(items.filter(i => i.name.includes(search)));
}, [items, search]);
```

**Fix**: Just compute it:
```tsx
const filtered = useMemo(
  () => items.filter(i => i.name.includes(search)),
  [items, search]
);
```

#### 3. Chained useEffects

If you have `useEffect A → sets state → triggers useEffect B → sets state → triggers useEffect C`, you likely have a data flow problem. Consider:
- Computing derived values with `useMemo`
- Combining into a single effect with clear phases
- Using React Query's `enabled` option for dependent fetches

---

## Data Fetching

### Current State

The codebase uses React Query, which is good. However:
- Query keys are inconsistent (some use arrays, some use strings)
- No query key factory despite one being exported in `lib/obra-queries.ts`
- 17+ independent queries in `page.tsx` without grouping

### Recommended Pattern

**Query Key Factory (already in `lib/obra-queries.ts` but not used):**
```tsx
export const obraQueryKeys = {
  all: ['obra'] as const,
  detail: (obraId: string) => [...obraQueryKeys.all, obraId] as const,
  tablas: (obraId: string) => [...obraQueryKeys.detail(obraId), 'tablas'] as const,
  materials: (obraId: string) => [...obraQueryKeys.detail(obraId), 'materials'] as const,
};

// Usage
useQuery({ queryKey: obraQueryKeys.materials(obraId), ... });

// Invalidation becomes easy
queryClient.invalidateQueries({ queryKey: obraQueryKeys.detail(obraId) }); // invalidates all obra-related
```

**Consider Grouping Related Queries:**
```tsx
// hooks/useObraData.ts
export function useObraData(obraId: string) {
  const obra = useQuery({ queryKey: obraQueryKeys.detail(obraId), ... });
  const tablas = useQuery({
    queryKey: obraQueryKeys.tablas(obraId),
    enabled: !!obra.data, // wait for obra
    ...
  });
  
  return {
    obra: obra.data,
    tablas: tablas.data,
    isLoading: obra.isLoading || tablas.isLoading,
  };
}
```

---

## Component Structure

### Current Problem: Giant Files

| File | Lines | useState | useEffect |
|------|-------|----------|-----------|
| `app/excel/[obraId]/page.tsx` | ~3,900 | 18+ | 8 |
| `file-manager/file-manager.tsx` | ~8,000 | 34+ | 19 |

These files are difficult to:
- Navigate and understand
- Test in isolation
- Hot-reload during development (slow HMR)

### Recommended Structure

Split by feature, not by type:

```
app/excel/[obraId]/
├── page.tsx                    # Thin: imports tabs, handles routing
├── components/
│   ├── general-tab/
│   │   ├── index.tsx
│   │   ├── obra-info-card.tsx
│   │   └── progress-chart.tsx
│   ├── flujo-tab/
│   └── documents-tab/
├── hooks/
│   ├── useObraData.ts          # Grouped React Query calls
│   └── useCertificateForm.ts   # Reducer + actions
└── types.ts
```

### Extract Utilities

Functions like `normalizeForSearch`, `fetchMaterialOrders`, etc. have already been moved to `lib/obra-queries.ts`. Continue this pattern—component files should focus on rendering logic.

---

## Performance

### useMemo for Expensive Computations

The codebase already does this in some places. Continue the pattern:

```tsx
// Good - memoized search/filter
const filteredItems = useMemo(() => {
  return items.filter(item => 
    normalizeForSearch(item.name).includes(normalizeForSearch(query))
  );
}, [items, query]);
```

### Stable References for Callbacks

When passing callbacks to child components or dependencies:

```tsx
// Creates new function every render - can cause child re-renders
<Button onClick={() => handleSubmit(id)} />

// Stable reference
const handleClick = useCallback(() => handleSubmit(id), [id]);
<Button onClick={handleClick} />
```

### React Compiler

Next.js supports the React Compiler (`reactCompiler: true` in next.config.js). However:
- This codebase has not been tested with it
- Some patterns (impure renders, external mutations) may not work correctly
- **Do not enable without thorough testing across all major flows**

---

## Migration Examples

Below are concrete examples of how to refactor specific patterns in this codebase.

### Example 1: Certificate Form State

**Before (page.tsx):**
```tsx
const [isAddingCertificate, setIsAddingCertificate] = useState(false);
const [newCertificate, setNewCertificate] = useState(() => ({ ...default }));
const [createCertificateError, setCreateCertificateError] = useState<string | null>(null);
const [isCreatingCertificate, setIsCreatingCertificate] = useState(false);

// Scattered through the component:
const handleStartAdd = () => setIsAddingCertificate(true);
const handleCancel = () => {
  setIsAddingCertificate(false);
  setNewCertificate({ ...default });
  setCreateCertificateError(null);
};
```

**After:**
```tsx
// hooks/useCertificateForm.ts
type CertificateFormState = {
  isOpen: boolean;
  formData: NewCertificateFormState;
  error: string | null;
  isSubmitting: boolean;
};

type CertificateFormAction =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'UPDATE'; payload: Partial<NewCertificateFormState> }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS' }
  | { type: 'SUBMIT_ERROR'; error: string };

const initialState: CertificateFormState = {
  isOpen: false,
  formData: certificateFormDefault,
  error: null,
  isSubmitting: false,
};

function reducer(state: CertificateFormState, action: CertificateFormAction): CertificateFormState {
  switch (action.type) {
    case 'OPEN':
      return { ...initialState, isOpen: true };
    case 'CLOSE':
      return initialState;
    case 'UPDATE':
      return { ...state, formData: { ...state.formData, ...action.payload }, error: null };
    case 'SUBMIT_START':
      return { ...state, isSubmitting: true, error: null };
    case 'SUBMIT_SUCCESS':
      return initialState;
    case 'SUBMIT_ERROR':
      return { ...state, isSubmitting: false, error: action.error };
    default:
      return state;
  }
}

export function useCertificateForm() {
  const [state, dispatch] = useReducer(reducer, initialState);
  
  return {
    ...state,
    open: useCallback(() => dispatch({ type: 'OPEN' }), []),
    close: useCallback(() => dispatch({ type: 'CLOSE' }), []),
    update: useCallback((data: Partial<NewCertificateFormState>) => 
      dispatch({ type: 'UPDATE', payload: data }), []),
    submitStart: useCallback(() => dispatch({ type: 'SUBMIT_START' }), []),
    submitSuccess: useCallback(() => dispatch({ type: 'SUBMIT_SUCCESS' }), []),
    submitError: useCallback((error: string) => 
      dispatch({ type: 'SUBMIT_ERROR', error }), []),
  };
}

// In page.tsx:
const certForm = useCertificateForm();
// certForm.isOpen, certForm.formData, certForm.open(), certForm.close(), etc.
```

### Example 2: Dialog State Pattern

**Before (file-manager.tsx):**
```tsx
const [createFolderMode, setCreateFolderMode] = useState<'subfolder' | 'root' | null>(null);
const [createFolderParent, setCreateFolderParent] = useState<DocNode | null>(null);
const [newFolderName, setNewFolderName] = useState('');
const [newFolderDescription, setNewFolderDescription] = useState('');
const [newFolderDataInputMethod, setNewFolderDataInputMethod] = useState<...>('both');
const [newFolderOcrTemplateId, setNewFolderOcrTemplateId] = useState('');
const [createFolderError, setCreateFolderError] = useState<string | null>(null);
// ... 5 more states

const resetNewFolderForm = useCallback(() => {
  setNewFolderName('');
  setNewFolderDescription('');
  setCreateFolderError(null);
  // ... reset 8 more states
}, []);
```

**After:**
```tsx
// hooks/useCreateFolderDialog.ts
type CreateFolderState = {
  mode: 'subfolder' | 'root' | null;
  parent: DocNode | null;
  name: string;
  description: string;
  dataInputMethod: DataInputMethod;
  ocrTemplateId: string;
  error: string | null;
  isSubmitting: boolean;
};

const initialState: CreateFolderState = {
  mode: null,
  parent: null,
  name: '',
  description: '',
  dataInputMethod: 'both',
  ocrTemplateId: '',
  error: null,
  isSubmitting: false,
};

type CreateFolderAction =
  | { type: 'OPEN_ROOT' }
  | { type: 'OPEN_SUBFOLDER'; parent: DocNode }
  | { type: 'UPDATE'; payload: Partial<CreateFolderState> }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SUBMIT_START' }
  | { type: 'CLOSE' };

function reducer(state: CreateFolderState, action: CreateFolderAction): CreateFolderState {
  switch (action.type) {
    case 'OPEN_ROOT':
      return { ...initialState, mode: 'root' };
    case 'OPEN_SUBFOLDER':
      return { ...initialState, mode: 'subfolder', parent: action.parent };
    case 'UPDATE':
      return { ...state, ...action.payload, error: null };
    case 'SET_ERROR':
      return { ...state, error: action.error, isSubmitting: false };
    case 'SUBMIT_START':
      return { ...state, isSubmitting: true, error: null };
    case 'CLOSE':
      return initialState;
    default:
      return state;
  }
}

export function useCreateFolderDialog() {
  const [state, dispatch] = useReducer(reducer, initialState);
  
  return {
    ...state,
    isOpen: state.mode !== null,
    openRoot: useCallback(() => dispatch({ type: 'OPEN_ROOT' }), []),
    openSubfolder: useCallback((parent: DocNode) => 
      dispatch({ type: 'OPEN_SUBFOLDER', parent }), []),
    update: useCallback((data: Partial<CreateFolderState>) => 
      dispatch({ type: 'UPDATE', payload: data }), []),
    setError: useCallback((error: string) => 
      dispatch({ type: 'SET_ERROR', error }), []),
    close: useCallback(() => dispatch({ type: 'CLOSE' }), []),
  };
}
```

### Example 3: Replace Fetch-in-useEffect

**Before:**
```tsx
const [tenantMarker, setTenantMarker] = useState<TenantMarker | null>(null);

useEffect(() => {
  let cancelled = false;
  fetch("/api/tenant-marker")
    .then(r => r.json())
    .then(data => { if (!cancelled) setTenantMarker(data); })
    .catch(() => { if (!cancelled) setTenantMarker(null); });
  return () => { cancelled = true; };
}, [activeTenantId]);
```

**After:**
```tsx
const { data: tenantMarker } = useQuery({
  queryKey: ['tenant-marker', activeTenantId],
  queryFn: async () => {
    const response = await fetch("/api/tenant-marker");
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  },
  staleTime: 5 * 60 * 1000,
  retry: 1,
});
```

---

## Summary

| Issue | Where | Recommendation |
|-------|-------|----------------|
| Too many related useState | page.tsx, file-manager.tsx | Group with useReducer when states change together |
| Fetch in useEffect | page.tsx | Use React Query (already in deps) |
| Derived state in useEffect | scattered | Replace with useMemo |
| Giant component files | page.tsx (~4k), file-manager (~8k) | Split by feature into smaller files |
| Inconsistent query keys | page.tsx | Use obraQueryKeys factory from lib/obra-queries.ts |
| Utilities in components | was in page.tsx | Already extracted to lib/obra-queries.ts |

When touching these files, prefer incremental improvement over big-bang rewrites. Extract one reducer at a time, replace one useEffect with React Query at a time.
