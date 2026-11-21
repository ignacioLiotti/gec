# Test surface inventory

Generated 2026-10-17T19:53:05.037Z. Static counts are approximate syntax evidence; they are not quality verdicts or runtime coverage.
The scanner excludes .codex-temp, .codex-tmp, .git, .next, coverage, generateddist, node_modules, storybook-static, test-results, .claude/worktrees/ and skips candidate files over 2,000,000 bytes.

## Summary by candidate kind

| Kind | Files | Approx literal test declarations | Suites | Skips | Todo | Focused | Mocks | Storybook play |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| playwright-auth-setup | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| playwright-spec | 7 | 18 | 6 | 0 | 0 | 0 | 0 | 0 |
| portfolio-check | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| script-check | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| storybook-story | 52 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| test-file | 39 | 202 | 50 | 0 | 0 | 0 | 36 | 0 |
| test-helper | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Discovered versus configured runners

| Runner | Configured pattern | Discovered kinds | Files |
| --- | --- | --- | ---: |
| vitest | `tests/**/*.test.ts` | test-file | 39 |
| playwright | `playwright.config.ts:testDir=./tests/e2e` | playwright-auth-setup, playwright-spec, test-helper | 12 |
| storybook | `.storybook/main.ts:../stories/**/*.stories.@(ts|tsx)` | storybook-story | 52 |
| portfolio-guide | `package.json:portfolio:check` | portfolio-check | 4 |
| sql | `none discovered/configured` | sql-test | 0 |

## Configured runner details

```json
[
  {
    "runner": "vitest",
    "config": "vitest.config.ts",
    "include": "\"tests/**/*.test.ts\"",
    "configured": true
  },
  {
    "runner": "playwright",
    "config": "playwright.config.ts",
    "testDir": "./tests/e2e",
    "authSetup": true,
    "configured": true
  },
  {
    "runner": "storybook",
    "config": ".storybook/main.ts",
    "stories": "\"../stories/**/*.stories.@(ts|tsx)\"",
    "configured": true
  },
  {
    "runner": "portfolio-guide",
    "config": "package.json:portfolio:check",
    "configured": true
  }
]
```

## Package test and check commands

```text
test: vitest run
test:watch: vitest
test:e2e: playwright test
test:e2e:ui: playwright test --ui
test:document-generation:runtime: node scripts/check-document-generation-state.mjs
verify:folder-move: node scripts/verify-folder-move.mjs
test:storybook: node scripts/check-storybook.mjs
typecheck:storybook: tsc --project .storybook/tsconfig.json
check:ui: node scripts/check-ui-contract.mjs
typecheck:ui: tsc --project tsconfig.ui.json
portfolio:dev: vite --config portfolio-guide/vite.config.ts
portfolio:build: vite build --config portfolio-guide/vite.config.ts
portfolio:preview: vite preview --config portfolio-guide/vite.config.ts
portfolio:typecheck: tsc --project portfolio-guide/tsconfig.json
portfolio:capture: node portfolio-guide/check.mjs
portfolio:check: node portfolio-guide/interactions.mjs && node portfolio-guide/journey.mjs && node portfolio-guide/operations-check.mjs
```

## CI workflows

- None discovered under `.github/workflows/`.

## Vitest baseline

- pass; files 38; suites 87/87; tests 233/233; failed 0; skipped 0 (pending 0, todo 0).
- Baseline file: `plans/2026-10-17-test-strategy/baseline-vitest.json`.

## Discovered files

- `portfolio-guide/check.mjs` — portfolio-check; decl~0, suite0, skip0, todo0, only0, mock0.
- `portfolio-guide/interactions.mjs` — portfolio-check; decl~0, suite0, skip0, todo0, only0, mock0.
- `portfolio-guide/journey.mjs` — portfolio-check; decl~0, suite0, skip0, todo0, only0, mock0.
- `portfolio-guide/operations-check.mjs` — portfolio-check; decl~0, suite0, skip0, todo0, only0, mock0.
- `scripts/check-document-generation-state.mjs` — script-check; decl~0, suite0, skip0, todo0, only0, mock0.
- `scripts/check-motion-screens.mjs` — script-check; decl~0, suite0, skip0, todo0, only0, mock0.
- `scripts/check-motion-storybook.mjs` — script-check; decl~0, suite0, skip0, todo0, only0, mock0.
- `scripts/check-paper-vibe.mjs` — script-check; decl~0, suite0, skip0, todo0, only0, mock0.
- `scripts/check-redesign.mjs` — script-check; decl~0, suite0, skip0, todo0, only0, mock0.
- `scripts/check-storybook.mjs` — script-check; decl~0, suite0, skip0, todo0, only0, mock0.
- `scripts/check-ui-contract.mjs` — script-check; decl~0, suite0, skip0, todo0, only0, mock0.
- `scripts/verify-folder-move.mjs` — script-check; decl~0, suite0, skip0, todo0, only0, mock0.
- `stories/app/accordion.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/alert-dialog.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/avatar.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/badge.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/button.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/calendar.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/card.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/checkbox.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/collapsible.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/column-resizer.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/command.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/context-menu.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/contextual-wizard.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/dialog.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/dropdown-menu.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/expandable-light-button.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/FolderFront.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/FolderFrontEmpty.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/glassy-icon.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/hover-card.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/hydrated-date-text.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/input.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/kbd.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/label.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/light-button.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/native-select.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/notch-tail.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/popover.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/radio-group.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/scroll-area.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/select.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/separator.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/sheet.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/sidebar.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/skeleton.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/sortable.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/switch.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/table.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/tabs.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/textarea.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/tooltip.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/app/tray.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/foundations.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/motion/comparison.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/motion/screens/screens.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/patterns/consistency.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/product/document-generation.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/redesign/review.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/redesign/screens.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/shared/alert.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/shared/toast.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `stories/vibe/paper.stories.tsx` — storybook-story; decl~0, suite0, skip0, todo0, only0, mock0, play0.
- `tests/app/api/tenant-usage-post.test.ts` — test-file; decl~1, suite1, skip0, todo0, only0, mock0.
- `tests/app/dashboard/insurance-policy-search.test.ts` — test-file; decl~6, suite1, skip0, todo0, only0, mock0.
- `tests/app/document-generation/editor-session.test.ts` — test-file; decl~15, suite1, skip0, todo0, only0, mock24.
- `tests/components/form-table/cell-suggestions.test.ts` — test-file; decl~2, suite1, skip0, todo0, only0, mock0.
- `tests/components/form-table/column-filters.test.ts` — test-file; decl~3, suite1, skip0, todo0, only0, mock0.
- `tests/components/report/macro-report-config.test.ts` — test-file; decl~1, suite1, skip0, todo0, only0, mock0.
- `tests/e2e/admin/obra-defaults.spec.ts` — playwright-spec; decl~1, suite1, skip0, todo0, only0, mock0.
- `tests/e2e/auth.setup.ts` — playwright-auth-setup; decl~0, suite0, skip0, todo0, only0, mock0.
- `tests/e2e/excel-navigation.spec.ts` — playwright-spec; decl~1, suite0, skip0, todo0, only0, mock0.
- `tests/e2e/excel/api/lineage-ticket-1-1.spec.ts` — playwright-spec; decl~4, suite1, skip0, todo0, only0, mock0.
- `tests/e2e/excel/api/lineage-ticket-1-2a.spec.ts` — playwright-spec; decl~4, suite1, skip0, todo0, only0, mock0.
- `tests/e2e/excel/api/obras-api.spec.ts` — playwright-spec; decl~5, suite1, skip0, todo0, only0, mock0.
- `tests/e2e/excel/ui/lineage-macro-conflict.spec.ts` — playwright-spec; decl~1, suite1, skip0, todo0, only0, mock0.
- `tests/e2e/excel/ui/page.spec.ts` — playwright-spec; decl~2, suite1, skip0, todo0, only0, mock0.
- `tests/e2e/helpers/auth.ts` — test-helper; decl~0, suite0, skip0, todo0, only0, mock0.
- `tests/e2e/helpers/lineage.ts` — test-helper; decl~0, suite0, skip0, todo0, only0, mock0.
- `tests/e2e/helpers/local-target.ts` — test-helper; decl~0, suite0, skip0, todo0, only0, mock0.
- `tests/e2e/helpers/obras.ts` — test-helper; decl~0, suite0, skip0, todo0, only0, mock0.
- `tests/lib/admin/tenant-limit-access.test.ts` — test-file; decl~2, suite1, skip0, todo0, only0, mock0.
- `tests/lib/billing/mercadopago.test.ts` — test-file; decl~18, suite6, skip0, todo0, only0, mock0.
- `tests/lib/billing/subscription-access.test.ts` — test-file; decl~13, suite3, skip0, todo0, only0, mock0.
- `tests/lib/data-flow-builder.test.ts` — test-file; decl~16, suite1, skip0, todo0, only0, mock0.
- `tests/lib/data-flow-writeback.test.ts` — test-file; decl~2, suite1, skip0, todo0, only0, mock0.
- `tests/lib/document-ai.test.ts` — test-file; decl~9, suite1, skip0, todo0, only0, mock0.
- `tests/lib/document-generation-server.test.ts` — test-file; decl~4, suite2, skip0, todo0, only0, mock2.
- `tests/lib/document-generation.test.ts` — test-file; decl~22, suite1, skip0, todo0, only0, mock0.
- `tests/lib/excel/obra-csv-import.test.ts` — test-file; decl~2, suite1, skip0, todo0, only0, mock0.
- `tests/lib/http/validation.test.ts` — test-file; decl~3, suite1, skip0, todo0, only0, mock0.
- `tests/lib/impersonation-access.test.ts` — test-file; decl~3, suite1, skip0, todo0, only0, mock0.
- `tests/lib/insurance-policies.test.ts` — test-file; decl~1, suite1, skip0, todo0, only0, mock0.
- `tests/lib/insurance-policy-status.test.ts` — test-file; decl~4, suite1, skip0, todo0, only0, mock0.
- `tests/lib/lineage.test.ts` — test-file; decl~3, suite1, skip0, todo0, only0, mock0.
- `tests/lib/locale-number.test.ts` — test-file; decl~0, suite1, skip0, todo0, only0, mock0.
- `tests/lib/macro-table-filters.test.ts` — test-file; decl~1, suite1, skip0, todo0, only0, mock0.
- `tests/lib/macro-table-source-selection.test.ts` — test-file; decl~4, suite1, skip0, todo0, only0, mock0.
- `tests/lib/obras/delete-lifecycle.test.ts` — test-file; decl~4, suite1, skip0, todo0, only0, mock0.
- `tests/lib/obras/permissions.test.ts` — test-file; decl~3, suite1, skip0, todo0, only0, mock3.
- `tests/lib/ocr-row-policy.test.ts` — test-file; decl~6, suite1, skip0, todo0, only0, mock0.
- `tests/lib/ocr-template-sync.test.ts` — test-file; decl~2, suite1, skip0, todo0, only0, mock0.
- `tests/lib/permission-simulation.test.ts` — test-file; decl~5, suite1, skip0, todo0, only0, mock0.
- `tests/lib/pre-tenant-routes.test.ts` — test-file; decl~0, suite1, skip0, todo0, only0, mock0.
- `tests/lib/sample-analysis.test.ts` — test-file; decl~5, suite2, skip0, todo0, only0, mock0.
- `tests/lib/security/rate-limit.test.ts` — test-file; decl~2, suite1, skip0, todo0, only0, mock0.
- `tests/lib/spreadsheet-preview-summary.test.ts` — test-file; decl~5, suite1, skip0, todo0, only0, mock0.
- `tests/lib/superadmin.test.ts` — test-file; decl~6, suite1, skip0, todo0, only0, mock7.
- `tests/lib/tablas.test.ts` — test-file; decl~14, suite3, skip0, todo0, only0, mock0.
- `tests/lib/tenant-blueprints/standard-construction.test.ts` — test-file; decl~2, suite1, skip0, todo0, only0, mock0.
- `tests/lib/tenant-setup-status.test.ts` — test-file; decl~6, suite1, skip0, todo0, only0, mock0.
- `tests/lib/tenant-switch-path.test.ts` — test-file; decl~4, suite1, skip0, todo0, only0, mock0.
- `tests/lib/tenant-switch-redirect.test.ts` — test-file; decl~1, suite1, skip0, todo0, only0, mock0.
- `tests/tooling/e2e-target.test.ts` — test-file; decl~2, suite1, skip0, todo0, only0, mock0.

The file list and tags above are generated from the repository state and contain no environment values.
