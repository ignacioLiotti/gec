tags: #excel #navigation #performance #ux #prefetch

# 44 - Excel Navigation Prefetch & Obra Selector

## Summary

This change improves obra-to-obra navigation in the Excel workspace and reduces perceived latency when moving between nearby obras.

Implemented items:

- Previous/next obra navigation now prefetches both adjacent obras as soon as the current obra header finishes resolving them.
- Previous/next buttons still keep hover/focus prefetch as a fallback path.
- Added a searchable "Ir a obra" selector in the obra header to jump directly to any obra by number or name.
- Sidebar links now use controlled prefetch on hover/focus/touch instead of relying on automatic viewport prefetch.

## Why

Two navigation problems were being addressed:

1. Moving between adjacent obras should feel immediate.
2. Jumping from one obra to a distant obra should not require repeated next/previous clicks.

For adjacent obras, eager page-load prefetch is acceptable because the cost is capped to two targets.
For sidebar navigation, controlled prefetch is preferable to avoid preloading too many sections just because they are visible.

## Files Changed

- `components/excel-obra-name.tsx`
- `components/app-sidebar.tsx`

## Implementation Notes

### `components/excel-obra-name.tsx`

- Fetches the obra list ordered by `n` to compute:
  - current obra label
  - previous obra
  - next obra
  - searchable selector dataset
- Uses `router.prefetch()` plus `usePrefetchObra()` for obra detail targets.
- Prefetches previous and next obras immediately on page load once they are known.
- Exposes a searchable popover with obra number and name.

### `components/app-sidebar.tsx`

- Introduced `SidebarPrefetchLink`.
- Disables default `next/link` auto-prefetch for sidebar entries.
- Runs route prefetch on:
  - mouse enter
  - focus
  - touch start
- If the target is `/excel/[obraId]`, it also prefetches critical obra data via `usePrefetchObra()`.

## Validation

Validated with:

- `npm run lint -- components/app-sidebar.tsx components/excel-obra-name.tsx`

Not yet validated with:

- browser-level timing comparison
- LCP or internal navigation profiling
- e2e flow covering the new obra selector

## Follow-up Ideas

- Add telemetry for obra-to-obra navigation latency before/after prefetch.
- Add an e2e test that selects an obra from the new header selector.
- Consider virtualizing the obra selector if tenant obra volume grows significantly.
