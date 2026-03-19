# 2026-03-19 - Excel route TBT and certificate period parsing

## Summary

- Reduced initial JavaScript work on `/excel` by splitting the route entry into a responsive shell plus separate mobile and desktop client components.
- Deferred `papaparse` loading so CSV import code is no longer part of the initial `/excel` bundle.
- Added shared route data types for the excel page payload.
- Expanded period parsing in the file manager certificate import flow to recognize full month names and more flexible header markers.

## Files

- `app/excel/page.tsx`
- `app/excel/excel-page-client.tsx`
- `app/excel/desktop-excel-page-client.tsx`
- `app/excel/mobile-excel-page-client.tsx`
- `lib/excel/page-data.ts`
- `lib/excel/types.ts`
- `app/excel/[obraId]/tabs/file-manager/components/add-row-dialog.tsx`

## Validation

- `npx tsc --noEmit`
- `npx eslint app\excel\page.tsx app\excel\excel-page-client.tsx app\excel\desktop-excel-page-client.tsx app\excel\mobile-excel-page-client.tsx lib\excel\page-data.ts lib\excel\types.ts app\excel\[obraId]\tabs\file-manager\components\add-row-dialog.tsx`
- `npm run build`

## Notes

- Build passed successfully.
- `next build` still reports two non-blocking pre-existing warnings:
  - `experimental.serverComponentsExternalPackages` should be replaced with `serverExternalPackages`.
  - Turbopack inferred the workspace root because multiple lockfiles are present.
