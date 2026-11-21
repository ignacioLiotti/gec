# Approved migration verification: final audit

The saved evidence supports **82 of 82 selected regression cases passing** in owned local run `a62e7a53-6453-4843-8375-d208e03c53dd`, including the two previously unresolved contracts. No false-green classification or source mismatch was found. This conclusion applies to the disposable local stack; production was not assessed.

This was a read-only audit of reports, logs, SQL and current source hashes. It did not run tests, query a live database, apply migrations, or change source. The earlier `final-review.md` remains unchanged as the record of the failed pre-approval run.

## Final run and source

- `approved-full-cases.json` contains 82 cases and exactly 82 attempts. Every case expects `passed`, every actual attempt is `passed`, every retry index is zero, and all attempt error arrays are empty. Statistics report zero skipped, unexpected or flaky results. `approved-full-run.json` records `passed` and exit code 0; `approved-full.log` independently reports 82 passed.
- The executed set includes `financial/financial-rls.spec.ts` and successful invitation acceptance with a fresh-session membership observation. The focused run `91ca002a-0e49-47e8-8cc0-299c799d7f94` also passed its three selected contracts: invitation acceptance, direct financial RLS, and editor completion/replay/undo under the tightened policies.
- Before/after full-run manifests each contain 1,070 inputs and have identical path/hash entries. Their shared aggregate is `1eb72f2922e07e475d0dc2ccc50df4aa7d9386e083cc59e2329bfec7330425f6`. Rehashing all recorded inputs during this audit found no missing or changed files.
- `approved-vitest.json` reports success: 373 passed tests across 49 file results, with zero failed or pending tests.

## Migration and authorization evidence

The SQL body of `0134_financial_mutation_permissions.sql`, starting at `begin;`, exactly equals the approved financial proposal. The body of `0135_fix_invitation_acceptance_conflict_target.sql`, starting at `CREATE OR REPLACE FUNCTION`, exactly equals the approved invitation proposal. Only their leading approval headers differ from the proposals.

The focused-stack catalog readback in `approved-schema-readback.json` records migration versions 0134 and 0135 and the named invitation conflict target. Its effective policies retain tenant-member SELECT access, enforce the registered financial mutation permissions, and preserve the insurance INSERT/UPDATE check allowing an unmatched row or an active obra in the same tenant. The full run used the unchanged migration inputs and passed both repaired contracts.

**Anonymous function EXECUTE was not revoked.** The catalog explicitly reports `anonCanAccept: true` and `authenticatedCanAccept: true`. Its original incorrect ACL expectation is disclosed in the observation note. Authorization instead relies on the unchanged function-body guard. In the full run, `approved-anonymous-rpc-denial.log` records an anonymous, read-only transaction with no authenticated subject failing at that guard with `42501: Authentication required`. The probe's exit code 1 is the expected denial, separate from the successful test-run exit code. Do not describe this evidence as an absent anonymous EXECUTE grant.

## Cleanup

The full run manifest reports all 77 fixture scopes verified, zero failed/pending scopes, stopped app/provider ports, no live app process, and a removed app snapshot. The independent cleanup record at `2026-10-20T20:24:37.931Z` confirms empty container/volume/network arrays, false app/OCR/billing listening flags, no live app process or snapshot, and no invalid fixture manifests.

Across all eight completed runtimes, cleanup records and corresponding run manifests agree on counts of 4, 22, 31, 27, 27, 76, 3 and 77: **267 cleaned fixture scopes**. Every record has zero remaining owned resources and zero pending/failed fixture cleanup. This number is not a count of passing cases; the earlier failing attempts remain in their original reports.

## Scope and remaining limits

The two former schema approval gates were satisfied for disposable-local verification, and their repaired contracts now pass. This does not authorize or establish production application. No live payment or externally delivered WhatsApp behavior was proved. Existing nontransactional concurrency limits and the pending FigJam updates remain documented in the slice reports.

The successful unit and regression results do not erase the earlier static-check limitations: the default TypeScript check had the separate raw-import error, and repository-wide lint was not clean. Those checks must retain their actual statuses in the aggregate report. No claim is made that every application workflow, browser/device combination, or provider integration has been verified.
