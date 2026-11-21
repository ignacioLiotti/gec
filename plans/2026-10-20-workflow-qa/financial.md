# Financial workflow QA — 2026-10-20

## Status

**All six financial cases pass under approved migration 0134.** Full run `a62e7a53-6453-4843-8375-d208e03c53dd` passed 82 of 82 cases with exit code 0. It had no skipped, flaky, or retried cases. Fresh cleanup passed all 77 scenario scopes.

## Runtime evidence

The disposed baseline run `f150bcbb...` ran the original four financial cases. Policy import/cancellation passed. Certificate UI failed with an empty table even though `GET /api/certificados` returned the two correct rows. Certificate permissions failed because foreign create and denied edit returned `200` and the edit changed SQL state. Policy permissions failed because the denied mutation returned `200` and changed SQL state.

The next owned checkpoint passed 23 of 31 selected cases, including these financial outcomes:

| Case | Result | Observable evidence |
| --- | --- | --- |
| Certificate invoice and collection UI | PASS | Both rows rendered; browser invoicing and collection survived reloads while the total remained `145,000.75`. |
| Certificate permission boundary | PASS | Viewer, foreign-parent, deleted-parent, edit, and delete denials held; owner recovery and delete succeeded. |
| Policy import and cancellation UI | PASS | Matched/unmatched import and the two-step cancellation flow survived reloads. |
| Policy route permission boundary | PASS | Tenant isolation and explicit import/patch manage denials held; owner recovery succeeded. |
| Direct financial RLS boundary | FAIL: confirmed defect | The denied viewer's authenticated database client updated both rows; owner readback observed the forbidden values. |

This is actual runtime evidence for the database-policy repair. The checkpoint predates the completion companion and the added policy create/delete checks, so it is not a final post-repair run.

Focused run `5209` later reached 25 of 27 selected non-RLS cases and disposed all 27 scenario scopes. Every selected financial case except the expanded completion case passed. The completion flow reached the correct derived dates, then its first preservation assertion failed because `/api/insurance-policies` does not project `notes`; the test had treated that missing API key as a changed stored value. The observer now performs fresh authenticated user-database reads of the exact persisted fields, while timestamp assertions compare instants to tolerate Postgres formatting. The corrected case subsequently passed in frozen run `4ca499a8`, together with the four other selected financial cases.

After the user approved the financial RLS change, migration `0134_financial_mutation_permissions.sql` was applied to a disposable verification stack. Focused run `91ca002a` passed all three selected cases and disposed all three scopes. The direct-RLS case covered certificate and policy insert, update, and delete. It also proved the separate `certificados:edit` and `certificados:admin` capabilities, explicit denials, unchanged-row readbacks, and positive owner controls. The editor-completion case passed under the same policies.

Full approved run `a62e7a53-6453-4843-8375-d208e03c53dd` then passed 82 of 82 cases with exit code 0. The run reported zero skipped, flaky, or retried cases. All six financial cases passed with migration 0134 active. A fresh cleanup pass disposed all 77 scenario scopes. The aggregate verification record contains eight runs and 267 cleaned fixture scopes, including earlier failed checkpoints.

## Current driver contract

### Certificates

- Create and list through authenticated `POST` and `GET /api/obras/{obraId}/certificates`.
- Invoice and collect through the visible `/certificados` table and its `PATCH /api/certificados/{certificateId}` save path.
- Keep the independent total `95,000.50 + 50,000.25 = 145,000.75` before and after invoicing and collection.
- Assert actual checkbox state before and after each browser click; invoice and collection state must survive reloads.
- Reject viewer create, edit, and delete attempts using the registered `certificados:edit` and `certificados:admin` permissions.
- Reject foreign and deleted parent obras with `404`, and hide cross-tenant certificate patches with `404`.
- Allow owner recovery, readback, delete, and an empty active list with total `0`.

Certificate creation has no reachable product control because the per-obra certificate tab remains disabled. Setup uses the authenticated product API; invoicing and collection stay browser-driven.

### Insurance policies

- Import through `/dashboard` → `Polizas de seguro` → file input → preview dialog → confirm.
- Persist a matched row against the exact synthetic obra and an unmatched row with `obra_id = null`; keep the unmatched row out of the per-obra endpoint.
- Request and confirm cancellation in the visible policy dialog, with both states surviving full reloads.
- Hide tenant A policies from tenant B and reject a foreign patch.
- Reject explicitly denied import, patch, per-obra create, and policy delete attempts with `403`; prove owner recovery, create, and delete controls.
- Complete an obra through the real API as an editor with `obras:edit` and without `insurance-policies:manage`. Cover a configured relative rule, definitive-reception precedence, and an unconfigured rule while preserving unrelated cancellation fields.
- Prove both same-tenant policies on another obra and foreign-tenant policies remain unchanged across completion and undo.
- Reject viewer, foreign-tenant, and deleted-obra completion attempts. Preserve the first provisional completion date and notification marker on replay, clear them on undo, and assign a new date after re-completion.
- Exercise completion and undo through the dedicated endpoint, single-obra PATCH, and destructive full-sync PUT; the full-sync driver resubmits every active obra so it does not remove unrelated records.

The per-obra policy tab still exposes create, edit, move, and delete controls without permission gating. The APIs now return `403`, but the UI should eventually hide or disable controls for actors who lack `insurance-policies:manage`.

### Direct database authorization

The expanded RLS case uses the denied viewer's authenticated Supabase client, not an API route or service role. It attempts direct insert, update, and delete on `certificates` and `insurance_policies`. A Postgres error is accepted only when its code is `42501`; otherwise a filtered mutation must return exactly `[]`. Authenticated owner observations check absent inserts and unchanged active rows. Positive direct insert, update, and delete controls prevent a deny-all policy from making the case pass. Separate certificate edit and admin grants exercise their different mutation capabilities. Run `91ca002a` passed this contract against migration 0134.

The historical policies granted mutations through tenant membership alone:

- `certificates insert/update/delete in tenant` in `supabase/migrations/0044_audit_log.sql`.
- `manage insurance policies in tenant FOR ALL` in `supabase/migrations/0112_unmatched_insurance_policy_imports.sql`.

Diagnostic run `2753` proved that these policies allowed the explicitly denied actor to change both rows. Migration 0134 replaces the mutation policies with permission-aware rules while leaving the existing read policies unchanged. No other certificate or insurance-policy `ALL`, `INSERT`, `UPDATE`, or `DELETE` policy independently grants writes.

## Current six cases

| Spec | Case | Current status |
| --- | --- | --- |
| `certificates.spec.ts` | creates certificates and carries invoicing through collection without changing the certified total | PASS IN FULL RUN `a62e7a53` |
| `certificates.spec.ts` | enforces certificate create, edit, and delete boundaries while allowing owner recovery | PASS IN FULL RUN `a62e7a53` |
| `insurance-policies.spec.ts` | keeps completion-derived policy dates correct for an editor across denial, replay, and undo | PASS IN FULL RUN `a62e7a53` |
| `insurance-policies.spec.ts` | imports matched and unmatched policies, then requests and confirms cancellation across reloads | PASS IN FULL RUN `a62e7a53` |
| `insurance-policies.spec.ts` | enforces tenant and `insurance-policies:manage` denials while preserving owner recovery | PASS IN FULL RUN `a62e7a53` |
| `financial-rls.spec.ts` | financial permissions govern direct insert/update/delete with positive and edit/admin controls | PASS IN FULL RUN `a62e7a53` |

## Repairs in the shared tree

- The certificate table's inactive date filter accepts null dates, fixing the empty view seen while the API returned two rows.
- Certificate create, patch, and delete enforce registered permissions, tenant scope, active-parent scope, and hidden-record `404` behavior.
- Policy import, patch, per-obra create, and delete enforce `insurance-policies:manage`.
- Every obra-completion route checks `obras:edit` before the obra mutation. The three server callers pass a server-created service client only to the derived policy updater; macro synchronization keeps the actor client.
- The derived updater re-reads the active obra and requires persisted completion state to match completion or undo. It filters writes by policy, tenant, and obra, updates only `obra_finished_at`, `calculated_cancellation_date`, `last_notified_at`, and `updated_at`, and verifies the affected id.
- Replaying completion performs no policy write when both derived dates already match, preserving the existing provisional date and `last_notified_at` marker. Undo or a real derived-date change resets the marker. Undo clears the provisional base and recalculates from definitive reception when present; re-completion after undo records a new base.

The route guards and certificate-table fix are owned by the root task. This slice owns the scoped completion companion, its E2E driver, and the financial evidence/design documentation.

## Approved RLS repair and blast radius

The user approved the reviewed SQL in `plans/2026-10-20-workflow-qa/financial-rls-proposal.sql`. Migration `supabase/migrations/0134_financial_mutation_permissions.sql` records that change. It preserves existing member reads and narrows direct mutation authorization. Certificate insert and update require `certificados:edit`. Certificate delete requires `certificados:admin`. Policy insert, update, and delete require `insurance-policies:manage`.

The certificate half is bounded by existing product contracts. Certificate routes use the actor client after permission checks. `set_certificates_tenant_id` is a regular trigger. `record_audit_log` is `SECURITY DEFINER` but only writes audit data. `soft_delete_row` runs after the proposed DELETE authorization gate and converts the authorized delete to the existing soft-delete update. Service-role-only `cleanup_orphan_records` intentionally bypasses RLS for tenant-scoped maintenance.

The insurance half now has a companion for its legitimate non-manager write. Obra completion is available to editors with `obras:edit`, while the default editor lacks `insurance-policies:manage`. The three authorized server paths use a service client only for the allowlisted derived projection and prove the active obra, persisted completion state, scope, and affected row. Import, patch, create, and delete remain actor-client mutations governed by `insurance-policies:manage`. Notification dispatch remains an intentional service-role job for `last_notified_at`. The superadmin bulk-delete route remains actor-scoped and depends on the existing superadmin permission and membership behavior.

Migration 0134 preserves the existing insurance `WITH CHECK` invariant from migration 0112: an optional obra must belong to the same tenant and be active. Review caught and removed an earlier draft that would have lost this condition; that draft was never applied. The migration adds no new certificate parent invariant. The certificate API fixes the reproduced foreign and deleted-parent create path. A new database-wide certificate parent rule needs its own direct test and downstream audit.

The focused and full verification runs provide this evidence:

1. Direct certificate edit and admin positive controls and explicit-deny negative writes passed.
2. Direct policy manage positive controls and explicit-deny negative writes passed. The test accepts only `42501` or exactly zero affected rows.
3. Owner direct insert, update, and delete controls passed after denied readbacks.
4. Real-editor completion, replay, undo, re-completion, and full-sync transitions passed. Owner readbacks covered configured, definitive, unconfigured, unrelated-obra, foreign-tenant, and notification-marker witnesses.
5. Policy create and delete route denials and owner controls passed in the earlier frozen financial regression.

Migration 0134 drops the former insurance `FOR ALL` policy and the replacement names before it creates the split policies. The migration therefore converges when a disposable stack applies it more than once. The focused stack applied the approved migration. No deployment or publication occurred. Service-role dispatch tenant scope and the retained superadmin bulk-delete route remain separate follow-up coverage.

## Static validation

- PASS — `npm run typecheck:tests`.
- PASS — `npm run typecheck:ui` after the completion companion changes.
- PASS — focused ESLint over the completion files, helper, and financial driver; three pre-existing warnings remain in `app/api/obras/route.ts`, with zero errors. The final observer-only edit has zero focused lint findings.
- PASS — Playwright discovery lists exactly six authenticated tests in three spec files.
- PASS — all five selected financial browser/API cases in root-owned frozen run `4ca499a8` before the migration.
- PASS — all three selected cases in focused run `91ca002a` under migration 0134, including the expanded direct-RLS case and editor completion. Cleanup disposed all three scopes.
- PASS — full approved run `a62e7a53-6453-4843-8375-d208e03c53dd` passed 82 of 82 cases under migration 0134 with exit code 0 and no skipped, flaky, or retried cases.
- PASS — fresh cleanup disposed all 77 scenario scopes.

## Files

- `tests/e2e/financial/financial-workflows.ts`
- `tests/e2e/financial/certificates.spec.ts`
- `tests/e2e/financial/insurance-policies.spec.ts`
- `tests/e2e/financial/financial-rls.spec.ts`
- `plans/2026-10-20-workflow-qa/financial.md`
- `plans/2026-10-20-workflow-qa/financial-rls-proposal.sql`
- `supabase/migrations/0134_financial_mutation_permissions.sql`
- `lib/insurance-policies.ts`
- `app/api/obras/route.ts`
- `app/api/obras/[id]/route.ts`
- `app/api/obras/[id]/complete/route.ts`
- `docs/domain/insurance-policies.md`
- `docs/adr/0011-insurance-policies-owned-by-obras.md`

Migration 0134 was added after explicit user approval and applied only to disposable verification stacks. This documentation update changes no source, test, SQL, runtime configuration, ordinary data, dependency, or credential. No deployment occurred.
