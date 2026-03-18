# Quick Actions (Acciones Rápidas)

tags: #quick-actions #workflow #ux #admin

## Purpose

Quick Actions let tenant admins configure **multi-step guided workflows** that appear as a floating panel on the Obra General tab. They accelerate common data-entry patterns (e.g., "Upload contract → Extract data → Fill in row").

---

## Configuration (Admin)

**Where:** `/admin/obra-defaults` → "Acciones rápidas" section

**Steps:**
1. Click "Nueva accion"
2. Enter name + description
3. Select folders in desired step order
4. Save → stored in `obra_default_quick_actions` table

**DB Schema:**
```
obra_default_quick_actions
  id, tenant_id
  name, description
  folder_paths[]      — ordered array of folder paths
  position            — display order
```

---

## Runtime Usage (Obra General Tab)

**Where:** `/excel/[obraId]` → General tab → floating panel (bottom-right)

**Steps:**
1. User clicks on an action in the floating panel
2. A stepper dialog opens: "Paso 1/3", "Paso 2/3"...
3. For each step, UI adapts to the folder's nature:

| Folder Type | Step UI |
|-------------|---------|
| Normal folder | Upload file button |
| OCR folder | Upload file → triggers AI extraction |
| Manual folder | Form to enter row data directly |
| OCR + Manual | Choice: "Subir archivo" or "Ingresar datos" |

4. After each step: `obra:documents-refresh` event fires → Documents tab refreshes
5. After all steps: action marked complete

---

## Data Flow

```
GET /api/obra-defaults → { folders, quickActions }
    ↓
QuickActionsPanel loads actions for tenant
    ↓
User picks action → stepper opens
    ↓ Per step:
    ↓ (OCR) POST /api/obras/[id]/tablas/[tablaId]/import/ocr
    ↓ (Manual) POST /api/obras/[id]/tablas/[tablaId]/rows
    ↓ (Upload) Supabase storage upload
    ↓
emit "obra:documents-refresh"
    ↓
FileManager re-fetches document tree
```

---

## Custom Step Renderers

Steps can have custom UI overrides by passing a `customStepRenderers` map:

```typescript
const customQuickActionSteps = useMemo(() => ({
  "certificados": ({ submit, isSubmitting, setValue }) => (
    // custom form for this folder step
  )
}), []);

<QuickActionsPanel customStepRenderers={customQuickActionSteps} />
```

---

## Component

`components/quick-actions/quick-actions-panel.tsx`

**Props:**
- `actions` — list of quick actions for tenant
- `obra` — current obra context
- `tablas` — obra tablas (for manual step data entry)
- `customStepRenderers` — optional per-folder-path override renderers

**Step renderer receives:**
- `stepId`, `folder`, `tabla`, `mode`
- `values`, `setValue(key, value)` — form state
- `submit()`, `isSubmitting`

---

## Related Notes

- [[04 - Obras (Construction Projects)]]
- [[06 - Excel View]]
- [[10 - Documents & File Manager]]
- [[05 - Tablas (Data Tables)]]
- [[19 - Admin Panel]]
