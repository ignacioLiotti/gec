# Isolated local integration testing

Status: Implemented and verified locally on `codex/structure-improvements-2026-10-17`. The final full E2E run passed 34/34 cases with real Auth, Postgres, RLS and Storage. All 31 fixture scopes completed runtime cleanup and stack disposal. The approved `0123`/`0132` migration repair and two product UI repairs passed. The current shared checkout also passed 349 Vitest tests in 46 files. The complete 40-workflow strategy remains unfinished.

## Work list

- [x] Ground existing session, tenant, permissions, schema and test dependencies; identify a disposable runtime.
- [x] Compare two fixture ownership designs and select the smallest complete interface.
- [x] Implement scoped fixture provisioning, independent actor sessions and checked partial-failure cleanup.
- [x] Migrate existing browser/API callers and delete shared fixed-identity setup.
- [x] Add permission, cross-tenant and persisted obra journey specifications.
- [x] Verify public runtime, runner cancellation, test sources and closest unit checks.
- [x] Execute a fresh migration rebuild, permission SQL probe and focused authenticated suite with fixture and stack disposal checks.
- [x] Finish the full 34-case E2E run and independently verify all fixture manifests, stack resources and app disposal.
- [ ] Implement the remaining journeys from the 40-workflow strategy and provider/CI jobs.

## What changed

`scripts/test-integration.mjs` creates an owned temporary application and optional Supabase instance. It excludes `.env*`, ordinary seeds, existing data and external auth. It preserves the production proxy/instrumentation, shares installed dependencies through a link, and gives Next its own build cache. The Node HTTP boundary and browser fixtures reject external destinations. This is test transport control, not an OS sandbox.

The runner uses a unique Supabase project ID and local ports, the repository migration chain and local generated keys kept out of artifacts. Run reports are separate. The approved repair adds the nullable `tenant_id` prerequisite to historical migration `0123` and restores the complete permission function in new migration `0132`; `0125` and the pre-existing `0130` remain untouched. Normal teardown and interruption stop owned processes; the app snapshot and dependency link are removed after stopping. Supabase teardown targets only that run's project and volumes. A hard-killed process can still leave resources, so the secret-free manifest records ownership before startup.

The generated local auth configuration keeps global signup disabled while enabling the email provider: `auth.enable_signup = false` and `auth.email.enable_signup = true`. Supabase CLI v2.98.2 maps these independently to `GOTRUE_DISABLE_SIGNUP` and `GOTRUE_EXTERNAL_EMAIL_ENABLED` in its [official startup source](https://raw.githubusercontent.com/supabase/cli/v2.98.2/internal/start/start.go). The focused run proved this configuration with real password authentication. Actor creation normalizes each synthetic email to lowercase before calling the admin API.

Authenticated Playwright scenarios own two tenants per attempt. Actors are lazy owner/editor/viewer/otherOwner identities with actual password authentication and SSR cookies. Editor/viewer have member memberships and their respective operational roles. Business assertions use actor requests or anon-key authenticated Supabase clients. The administrator client is private to fixture preparation and cleanup.

Setup seeds minimally valid folder/OCR defaults; the actual create operation must still materialize its own obra. Durable resource intentions support reconciliation after an ambiguous creation response. Cleanup drains actor setup, removes Storage objects and restrictive/audited children before auth users, then verifies auth-user, profile and Storage residuals. Migration `0046_soft_delete_and_cleanup.sql` converts deletes on five business tables into soft deletes, so fixture cleanup deliberately leaves those SQL rows for disposal with the owned stack instead of dropping or disabling the production triggers. A fixture manifest moves from `awaiting-stack-disposal` to `disposed` only after stack teardown; the transition retains any recorded cleanup errors.

Final full run `cf2a3a85-33a9-4a38-bacc-9d134c3c6000` passed 34/34 cases, with no skips, flaky results or retries. All 31 fixture manifests record verified runtime cleanup and disposal with no errors. An independent post-run read checked every manifest, zero owned containers/volumes/networks, the stopped app process, closed app port and removed app snapshot. See [run](full-final-run.json), [results](full-final-results.json), [fixture manifests](full-final-fixtures.json) and [independent cleanup evidence](full-final-cleanup.json).

All seven legacy specs migrated together. The global auth setup, shared storage file, default-tenant helpers, name-based cleanup arrays and service-role reads in specs were removed. The public GET authorization case has no auth dependency. Existing lineage cases preserve real route/persistence behavior while explicitly replacing OCR extraction/storage.

## Fixture design and synthesis

Candidate A used complete test-owned scenarios; candidate B reused worker actors with per-test resource scopes and an owned stack runner. An independent cross-review chose A's API and B's runtime ownership. Worker reuse was rejected because tests can indirectly change tenant defaults, permissions, subscriptions and preferences.

| Criterion | Chosen mechanism |
| --- | --- |
| Independence and retry safety | Unique tenants/users for every test attempt |
| Small caller interface | `test`, `scenario.actor`, `scenario.newContext` and purpose-named seed operations |
| Real auth and RLS | SSR session cookies and anon-key actor clients |
| Partial failure | Durable intent records, reconciliation and explicit cleanup failures |
| Public tests without provisioning | Separate public project and fixture |
| Owned environment | Temporary app/stack workdirs and run-specific process/project identities |

The implemented types are in `tests/e2e/fixtures/types.ts`. Architecture and tradeoffs are recorded in [ADR 0039](../../docs/adr/0039-owned-local-integration-fixtures.md).

## New business checks

`tests/e2e/integration/tenant-isolation.spec.ts` adds seven executions:

- Owner and editor each create, save and read an obra through a fresh browser context.
- Viewer reads within its tenant, receives write denials, and leaves stored fields unchanged.
- Owner A cannot read/update a known obra from B; owner B independently confirms its contents.
- Direct authenticated RLS hides foreign reads, affects zero rows on foreign update/delete and rejects a foreign insert. Owner B's successful update/read is the positive control.
- Tampering with `active_tenant_id` does not grant membership.
- A member with a grant and a role deny must remain denied, as required by ADR 0029.

ADR 0033 intentionally keeps same-tenant UPDATE RLS broader than the API's operational permission check. The tests preserve that contract rather than invent a viewer RLS guarantee.

Nine additional executions cover five permission-precedence cases, two fixture lifecycle cases, disabled public signup and the migration backfill/convergence probe. Permission cases include user deny over role grant, role deny over grant, a user grant overriding role denies, owner/admin bypass and the same user's independent overrides in two tenants. Lifecycle cases exercise a failed setup boundary, actual Storage cleanup and the observed soft-delete behavior before stack disposal.

The initial full run exposed two product bugs. Macro tables discarded conflict metadata, leaving unexplained empty cells. The client now shows affected business rows and columns while leaving conflicting values unapplied; navigation to a healthy macro clears the notice. The default-folder wizard switched selectors from controlled to uncontrolled, so a previously displayed template could leave the current dataset empty. Five selector values now remain controlled. Browser tests verify both repairs. The obra flow activates table cells, edits and commits values, saves the exact amount, then reloads and confirms persistence. See [product regressions](product-regressions.md) and the [macro warning screenshot](macro-conflict-notice.png).

## Verification and current status

| Check | Result | Scope |
| --- | --- | --- |
| Current Vitest suite | 349 passed, 46 files | Recorded in [vitest-final.json](vitest-final.json); includes concurrent shared-checkout tasks |
| `npm run typecheck:tests` | Passed | All test sources plus Playwright/Vitest configuration |
| `npm run typecheck:ui` | Passed | Product UI sources |
| Targeted ESLint | Passed | E2E fixtures/specs, runner, migration checker, tooling tests and the two repaired UI files |
| `npm run check:ui` | Passed | 1163 product controls satisfy the UI contract |
| Runner-boundary cases | 2 passed | Temporary snapshot/env filtering and loopback transport checks |
| Permission migration SQL probe | Passed, run prefix `769a14f4` | Legacy override backfill, grant/deny preservation, final precedence, `0132` convergence and rollback cleanup |
| Focused authenticated integration | 16/16 passed | Run `7a394164-e222-4f0b-b308-4fc3e8d1ccef`; real user/role denies, owner/admin bypass and cross-tenant overrides |
| Final fixture cleanup | 31/31 scopes verified and disposed | Auth users, profiles and Storage checked before owned stack disposal; independent manifest readback |
| Final stack disposal | Passed | Zero containers, volumes and networks; app PID and port closed; snapshot removed |
| Public cancellation | Passed | Run `4021767d-4cdf-42a1-9a54-1a7661e842fa`; interrupted app stopped, port closed and snapshot removed |
| Authenticated CLI-start cancellation | Passed | Run `5d42a729-b46c-4ecc-b320-250e712ea9b9`; zero owned Docker resources after interrupting startup |
| Full E2E | 34/34 passed | Run `cf2a3a85-33a9-4a38-bacc-9d134c3c6000`; no skipped or flaky cases |

Final static evidence is in [final-static-checks.json](final-static-checks.json). Cancellation evidence is in [interrupted-after-repair.json](interrupted-after-repair.json) and [interrupted-stack-start-after-repair.json](interrupted-stack-start-after-repair.json). The global default TypeScript configuration still has the separately observed `portfolio-guide/guide.tsx` raw-import declaration error; focused test/UI checks do not claim to resolve that debt. Earlier failures remain in [authenticated-migration-failure.json](authenticated-migration-failure.json), [full-initial-results.json](full-initial-results.json) and [docker-recovery.json](docker-recovery.json).

Docker Desktop initially crashed while opening its stale `dockerInference` IPC endpoint. Computer use confirmed that the application was not reaching a running engine. With Docker processes stopped, its ordinary `run` directory was renamed to `run.stale-20261017-210040` and a new empty `run` directory created. Computer use then reopened Docker Desktop and observed Engine running. The CLI independently returned server version `28.3.0`. The preserved directory remains under `%LOCALAPPDATA%/Docker`; no container data or volumes were deleted to repair Docker.

The fresh stack first reproduced the migration-order defect: `0123_role_permission_denies.sql` referred to `user_permission_overrides.tenant_id` before `0125` added it, stopping startup with SQLSTATE `42703`. The user then approved the narrow historical exception. Migration `0123` now creates only the nullable prerequisite column, `0125` retains the backfill and tenant-scoping constraints, and `0132` restores role-deny handling after `0125` replaces `has_permission`.

The [migration repair record](migration-repair.md) explains why both changes are required. The SQL probe confirmed the `0125` legacy-row backfill, the ADR 0029 precedence order, convergence of an already-migrated database after `0132`, and rollback of synthetic probe data. The focused authenticated suite exercised the same permission behavior through real sessions.

## Commands and remaining coverage

```text
npm run typecheck:tests
npm run test:e2e -- --list
npm run test:e2e:public
npm run test:e2e -- tests/e2e/integration/tenant-isolation.spec.ts
npm run test:e2e
```

The first full run passed 30/34 cases. Its four failures led to the two product fixes and updates to browser tests that assumed stale labels, pre-hydration interactivity or always-mounted table inputs. The final full run passed every case. The tests retain independent API/persistence assertions; no failing contract was deleted to obtain this result.

Next priorities are storage/download authorization and generated-document review/approval with parsed PDF contents from the [whole-app strategy](../../docs/test-plan/testing-strategy.md). The remaining 40-workflow journeys and provider/CI jobs are not implemented by this unit. Lineage cases replace external OCR extraction/storage and do not prove provider compatibility. Separate follow-ups concern physical tenant purging and the route guard's fallback after a permission-query error, both recorded in [product-regressions.md](product-regressions.md).

Final FigJam annotations and the two repaired flows could not be written because Figma's MCP Starter call limit was reached. Earlier permission nodes were updated, but their last runtime note is stale. Exact board/node references and proposed replacement text are in [figjam-status.md](figjam-status.md) and [product-regressions.md](product-regressions.md). No completed visual update is claimed.

The working branch and HEAD were preserved. No commit was created, and no existing development, remote or production database was changed. The approved local migration source repair is limited to `0123` and `0132`; pre-existing migration `0130` was not changed. Other tasks changed files concurrently in the shared checkout; their edits were not reverted or incorporated as this unit's work.

## Design criteria

1. A test can run alone, after another test or on a retry without sharing mutated data or auth state.
2. All identities and tenants are unique to their owning scope. Existing users are never reset or upgraded.
3. Setup and cleanup alone use service-role access. Business assertions use actual authenticated sessions and RLS.
4. Partial setup and cleanup failures remain visible; scope disposal verifies no owned data remains.
5. Public/component tests have no authentication dependency. Existing callers migrate in the same change.
6. Local execution cannot select the ordinary development database, remote providers or arbitrary existing server.

The user approved implementing the testing strategy with "Go". This authorizes synthetic test data in an isolated local instance. It does not authorize using existing production/development data, remote credentials, production changes, commits or deployment. Baseline source hashes are saved under `%TEMP%/multi-tenant-integration-2026-10-17`.

Independent fixture designs and the migration repair were reviewed with the host's supported Astra model according to the user's routing table. The pstack defaults name unavailable model families, so native supported models took their roles.
