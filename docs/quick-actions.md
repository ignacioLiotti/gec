# Quick Actions (Acciones rapidas)

This feature lets tenants configure multi-step quick actions that appear as a floating panel on an Obra's General tab. Each action is a sequence of folder-based steps (upload file, OCR import, or manual data entry) that accelerates common workflows.

## User Flow

### Admin configuration (tenant-wide)
1) Go to `/admin/obra-defaults`.
2) In **Acciones rapidas**, click **Nueva accion**.
3) Enter a name and description.
4) Select folders in the desired order. The numbered bubble shows the step order.
5) Save.

### Obra usage (General tab)
1) Open an Obra and stay on the **General** tab.
2) Use the floating **Acciones rapidas** panel (bottom-right) and pick an action.
3) A stepper opens showing **Paso 1/2/3...** with folder details.
4) Complete each step:
   - Normal folder -> upload file.
   - OCR folder -> upload file to trigger OCR.
   - Manual folder -> enter a row and save.
   - OCR + Manual -> choose OCR or Manual for that step.
5) After each step, Documents are refreshed automatically.

## Data Flow

### Configuration model
- Table: `obra_default_quick_actions` (tenant-scoped).
  - `name`, `description`, `folder_paths[]`, `position`.
  - Step order is the order in `folder_paths`.
- API: `POST/DELETE /api/obra-defaults` with `type: "quick-action"`.

### Runtime data
- `/api/obra-defaults` returns `{ folders, quickActions }`.
- `/api/obras/:id/tablas` provides tabla metadata + columns for manual steps.
- File uploads:
  - Normal folders: Supabase storage `obra-documents`.
  - OCR folders: `/api/obras/:id/tablas/:tablaId/import/ocr`.
  - Manual rows: `/api/obras/:id/tablas/:tablaId/rows`.

### Refresh
After each step, a `obra:documents-refresh` event is emitted. The Documents tab listens and re-fetches file tree + OCR links.

## Components & Files

### UI
- `components/quick-actions/quick-actions-panel.tsx`
  - Floating panel + stepper dialog.
  - Handles step submission logic.
  - Supports custom per-step rendering.

- `app/excel/[obraId]/page.tsx`
  - Loads defaults + tablas.
  - Renders `QuickActionsPanel` in the General tab.

- `app/admin/obra-defaults/page.tsx`
  - Manage quick actions (create/delete, folder order).

### Data/API
- `app/api/obra-defaults/route.ts`
  - Returns `quickActions` in GET.
  - Handles create/delete with `type: "quick-action"`.

- `supabase/migrations/0070_obra_quick_actions.sql`
  - DB table + RLS policies.

- `app/excel/[obraId]/tabs/file-manager/file-manager.tsx`
  - Listens for `obra:documents-refresh`.

## Custom Step Layouts

To override the default step UI for a specific folder, pass a renderer in `customStepRenderers` keyed by the folder path.

Example (in `app/excel/[obraId]/page.tsx`):

```
const customQuickActionSteps = useMemo(() => ({
  "certificados": ({ submit, isSubmitting }) => (
    <div className="space-y-3">
      <p className="text-sm">Carga el certificado con este layout especial.</p>
      <Button onClick={submit} disabled={isSubmitting}>Guardar</Button>
    </div>
  ),
}), []);
```

Each renderer receives:
- `stepId`, `folder`, `tabla`, `mode`
- `values`, `setValue(key, value)` for manual inputs
- `submit()` and `isSubmitting`

## Notes
- Folder nature is derived from default folders:
  - `isOcr` and `dataInputMethod` (`ocr`, `manual`, `both`).
- Step order is the selection order in admin.
- Quick actions are tenant-wide and apply to all obras.
