# Verification and tooling findings

All checks used existing installed dependencies. No packages were added, removed, or upgraded. The primary package manager declared by `package.json` is npm 10.9.3, so npm scripts were used despite older context examples using pnpm.

## Observed checks

| Command | Result | Evidence |
| --- | --- | --- |
| `npm.cmd run check:ui` | Exit 0, 1,112 product controls | Retained `check-ui.log` |
| `npm.cmd run typecheck:ui` | Exit 0 | Retained `typecheck-ui.log` |
| `npm.cmd test -- --reporter=dot` | Exit 0, 37 files and 218 tests pass | Retained `vitest-dot.log` |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | Exit 2, one unresolved raw import | Retained `tsc-full.log` |
| `npm.cmd run typecheck:storybook` | Exit 0 | Retained `typecheck-storybook.log` |
| Initial `npm.cmd run lint` | Exit 1, 417 errors and 2,832 warnings | Includes four import-style errors from the new audit proof before its ESM conversion. Do not label all 417 as inherited. |
| Final `npm.cmd run lint` | Exit 1, 413 errors and 2,832 warnings | Retained `final-lint.log`; proof import-style errors resolved |
| Targeted ESLint on the audit's four `.mjs` files | Exit 0 after ESM conversion | Coordinator rerun |
| Three actual-source audit proof scripts | Exit 0 | Six reproduced scenarios, detailed in README |

Initial logs are in `%TEMP%/multi-tenant-baseline-697818e7ade74a91b540757da1b7d1cc/`. Final integrated lint and file-preservation evidence are retained in `%TEMP%/multi-tenant-audit-2026-10-17/`. No check was weakened or suppressed. A final lint rerun is recorded in the main report.

No production build, Storybook build/runtime, Playwright auth setup, external integration, or database test was run. Unit tests passing does not establish browser response ordering, delivered emails, deployed grants, or a safe schema migration.

## F16 Separate product and standalone preview type boundaries

`portfolio-guide/guide.tsx:18` imports `./sample-data.ts?raw`. Its own tsconfig includes `vite/client`, while root `tsconfig.json` includes every `.ts` and `.tsx` file with only Node types. Full tsc reports TS2307 for that import; the focused product config passes.

Give each build target an explicit typecheck and keep Vite-specific ambient types with its target. The portfolio already has a dedicated typecheck script. Avoid merely ignoring real product errors or applying Vite browser globals to all server code. Acceptance is product, portfolio, and Storybook checks all passing independently, with root/build behavior defined clearly.

## F17 Distinguish lint inputs from product lint debt

`eslint.config.mjs:15` excludes `.codex-tmp/**` but not actual `.codex-temp/**` or `tmp/**`. The initial log contains 55 errors from `.codex-temp` and four from `tmp`. Excluding intended generated scratch output would remove irrelevant diagnostics, but would not make the product clean.

The same log contains 182 errors in `app`, 55 in `lib`, 15 in `components`, and 70 in `stories`. Public JSX and Gloss preview artifacts contribute many warnings. These are counts parsed from that log, not a new linter configuration or a claim that every warning is a defect. Keep authored source and executable examples covered by an appropriate check; define output boundaries without hiding live code.

Fix scratch discovery separately from real rule violations. Start with active source errors that indicate behavior or ownership problems, then make a bounded plan for remaining debt. The audit's own CommonJS proofs initially added four forbidden-import errors; they were converted to ESM and now pass the existing rules.

## F18 Apply Sentry configuration once

`next.config.ts:130` nests two `withSentryConfig` calls with two option objects. Installed Sentry source at `node_modules/@sentry/nextjs/build/cjs/config/withSentryConfig.js:356` wraps webpack for each call; `config/webpack.js:348` can add the Sentry plugin. The configured nesting is confirmed. Its actual build-time cost and duplicate upload behavior were not measured, especially for the current Turbopack command.

Merge intentional options with explicit precedence and use one wrapper. Preserve the existing production-only enablement and workflow wrapper. Inspect a production-mode resolved config locally, then validate one instrumented build in an authorized environment without silently uploading artifacts or consuming credentials.

## F19 Remove the unused Google SDK before adding another integration layer

`@ai-sdk/google` is declared in `package.json` but has no observed source consumer in app, components, lib, scripts, tests, stories, Storybook, portfolio, or Remotion. ADR 0032 explicitly states that installed Google provider 3.x is incompatible with `ai` 3.4.x and is unused; the sample-analysis path uses REST.

This supports removal as an implementation candidate, followed by lockfile update, reference search, tests, and sample-analysis validation. It does not justify silently upgrading the whole AI SDK or replacing the existing REST path.

Both `motion` and `framer-motion` have consumers. Storybook's motion reference runtime uses `motion`; product components use `framer-motion`. Do not delete one merely because the names overlap. Likewise, icon packages and Three.js have actual domain consumers; their manifest size alone is not proof of shipped client cost.

Manifest and lockfile root dependency sets match: 77 dependencies and 26 dev dependencies. `npm ls --depth=0 --omit=optional` exits 0 but reports four extraneous installed packages under `@emnapi` and `@tybys/wasm-util`. That is local installation state, not a reason to edit the declared production graph without another check.
