# Excel UI Refactor Notes

## Scope

This note documents the first pass on the `/excel` landing/list route family:

- `page.tsx`
- `excel-landing-server.tsx`
- `excel-page-client.tsx`
- `desktop-excel-page-full.tsx`
- `desktop-excel-page-preview.tsx`
- `mobile-excel-page-client.tsx`
- `loading.tsx`
- `_components/excel-page-*`

The goal is not to redesign the product surface. The goal is to make the existing UI structure easier to reason about and move hardcoded visual recipes out of page files.

## Previous Structure

The route entry itself was already small:

```txt
page.tsx
  -> landing-page.tsx
    -> excel-page-client.tsx
      -> desktop-excel-page-client.tsx
        -> desktop-excel-page-full.tsx
        -> desktop-excel-page-preview.tsx
      -> mobile-excel-page-client.tsx
```

Problems in that structure:

- `desktop-excel-page-client.tsx` only selected full vs preview, so it added a component layer without owning UI or behavior.
- `landing-page.tsx` was also ambiguous: it was not a route page, but a shared server helper used by `/excel`, `/excel/formtext`, and `/excel/listtest`.
- `excel-page-client.tsx` and `desktop-excel-page-client.tsx` both defined similar dynamic loading skeletons.
- Desktop full, desktop preview, and mobile each owned their own page background, panel, toolbar, card, status, and shadow recipes.
- Mobile had a local mini design system (`DS`, `Framed`, `toolButtonClass`) inside the route component.
- The CSV import preview sheet was embedded directly inside `desktop-excel-page-full.tsx`, mixing modal layout with table state, CSV parsing, route actions, guided tour state, and page composition.

## New Structure

The route now resolves desktop/mobile and load mode in one client boundary:

```txt
page.tsx
formtext/page.tsx
listtest/page.tsx
  -> excel-landing-server.tsx
    -> excel-page-client.tsx
      -> desktop-excel-page-full.tsx
      -> desktop-excel-page-preview.tsx
      -> mobile-excel-page-client.tsx
```

`excel-landing-server.tsx` remains as a shared server helper because three route files need the same data-loading and initial mobile hint. The change is naming and ownership: it is no longer presented as another page layer.

Shared local UI now lives in:

```txt
app/excel/_components/
  excel-page-chrome.tsx
    ExcelPageShell
    ExcelPageHeader
    ExcelToolbarFrame
    ExcelTableSurface
    ExcelPanel
    ExcelInlineStatus
    ExcelProgressBar
    ExcelPageSkeleton

  excel-import-preview-sheet.tsx
    ExcelImportPreviewSheet

  excel-page-format.ts
    toText
    toNumber
    clampPercentage

  obra-csv-import.ts
    prepareCsvObraImport
    buildCsvObraUpdates

  use-obra-csv-import.ts
    CSV preview and import state

  use-partial-obras-hydration.ts
    shared delayed hydration for partial obra lists
```

## Why This Shape

`ExcelPageShell`, `ExcelToolbarFrame`, `ExcelTableSurface`, and `ExcelPanel` are local to `app/excel` because they are page composition patterns, not yet design-system primitives. They encode Excel landing/list layout decisions while still consuming product tokens such as `bg-canvas`, `bg-card`, `bg-surface`, `border-stroke-soft`, `text-content`, `text-content-muted`, and `shadow-card`.

The pages should still own:

- data flow decisions
- route links
- table config
- guided-tour wiring
- import behavior
- responsive selection

The pages should not own:

- button colors or hover colors
- repeated panel shadows
- toolbar notch border/fill recipes
- repeated skeleton structure
- repeated list formatting helpers
- CSV parser details and import mutation state
- duplicated partial-row hydration effects

## Design-System Rules Applied

- App code continues importing primitives from `@/components/ui/*`.
- Page-level hardcoded neutrals moved to token classes.
- Button-specific color and hover overrides were removed from the Excel route buttons.
- The notch toolbar styling moved from each page into `ExcelToolbarFrame`.
- Mobile repeated obra cards now use token classes instead of local shadows and warm hardcoded fills.

## Follow-Up State

- CSV parsing and import state now live in `obra-csv-import.ts` and `use-obra-csv-import.ts`. Basic coverage for aliases, date normalization, multi-row headers, skipped rows, and percentage clamping lives in `tests/lib/excel/obra-csv-import.test.ts`; mixed success/error imports still need coverage.
- Preview and mobile now share `use-partial-obras-hydration.ts`. The preview route keeps idle hydration; the mobile route keeps its empty-list loading message only while it has no rows.
- Some Spanish text appears mojibake in the existing files (`rÃ¡pida`, `DesignaciÃ³n`, `NÂ°`). This pass documents it but does not mix encoding cleanup into structural UI work.
- `FormTable` internals were not touched. The local context says shared table behavior should be handled in `components/form-table`, not by one-off route edits.
- `app/excel/_components/CustomInput.tsx` and `app/excel/_components/ObrasTable.tsx` still contain hardcoded border, background, hover, and shadow recipes. They are not imported by the current `/excel/page.tsx` landing chain, but `app/system-design/audit/page.tsx` still references them as BaseDataTable migration debt, so they should be handled as a separate cleanup.

## Next Refactor Candidates

1. Broaden CSV tests for mixed success/error imports and Windows-1252 fallback decoding.
2. Decide whether `ExcelToolbarFrame` and `ExcelTableSurface` recur outside `/excel`. If yes, promote them intentionally through `components/ui` or document a broader app-workspace pattern.
3. Resolve the legacy `CustomInput`/`ObrasTable` debt in coordination with the system-design audit.
4. Run visual QA for desktop full, desktop preview, mobile, loading, and CSV preview states.
