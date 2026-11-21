# Lint evidence

Command/evidence: ESLint was invoked through the Node API with `ESLint.lintText(source, { filePath })` for the three target routes. The `tablas/route.ts` baseline was read from `git show HEAD:<path>`. Each OCR baseline was constructed only in memory from the current source, reverting the ten listed root substitutions; every replacement asserted exactly one match. No runtime, tests, `--fix`, rule disables, or baseline files under `app/` were used.

Results: current working tree = **38 errors, 4 warnings**. Baseline = **39 errors, 4 warnings**. Comparing the multiset `(ruleId, severity, message)` while ignoring line and column, there are **no current-only or increased findings**. The only difference is one fewer `@typescript-eslint/no-explicit-any` in the current `app/api/obras/[id]/tablas/route.ts`, caused by the HEAD aggregate-count expression being replaced with exact per-table counts. Both OCR routes have the same finding multiset as their virtual baselines; their line numbers shift because unrelated OCR changes remain preserved.

Full numeric evidence is in [lint-baseline.json](./lint-baseline.json).

The subsequently changed `app/api/obras/[id]/documents/list/route.ts` passes its focused ESLint invocation with no findings. The three-route debt comparison above remains scoped to its listed files.
