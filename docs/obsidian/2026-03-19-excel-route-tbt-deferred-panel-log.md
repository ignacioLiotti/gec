# 2026-03-19 - Excel route deferred desktop panel follow-up

## Summary

- Deferred the heavy desktop `/excel` panel behind an explicit user action so the `FormTable` stack no longer hydrates during the initial desktop render.
- Reduced desktop route payload by sending only preview rows and aggregate stats to the initial shell, while the full table fetches its dataset when opened.
- Moved the `/excel` desktop overview to the lighter route-local config file instead of the original shared `obras-detalle` config.
- Fixed a preview metrics regression found during review so totals still reflect the full dataset instead of the sampled rows.

## Files

- `app/excel/page.tsx`
- `app/excel/excel-page-client.tsx`
- `app/excel/desktop-excel-page-client.tsx`
- `app/excel/obras-table-config.tsx`
- `lib/excel/types.ts`

## Review

- Reviewed the full diff for the `/excel` TBT follow-up before push.
- Found and fixed one issue during review: the desktop preview counters were initially calculated from the 8-row sample instead of the full obras dataset.
- No remaining blocking findings after the fix.

## Validation

- `npx tsc --noEmit`
- `npx eslint app\excel\page.tsx app\excel\excel-page-client.tsx app\excel\desktop-excel-page-client.tsx app\excel\obras-table-config.tsx lib\excel\types.ts`
- `npm run build`

## Notes

- Build passed successfully.
- Initial Lighthouse/TBT for `/excel` should improve only after deploying this commit to production.
- The heavy desktop table cost is now deferred to the moment the user opens the interactive panel; it is not eliminated entirely.
- `next build` still reports two non-blocking pre-existing warnings:
  - `experimental.serverComponentsExternalPackages` should be replaced with `serverExternalPackages`.
  - Turbopack inferred the workspace root because multiple lockfiles are present.
