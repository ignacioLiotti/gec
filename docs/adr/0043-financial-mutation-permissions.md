# ADR 0043: Enforce financial mutation permissions at routes and RLS

Status: Accepted and verified in disposable local stacks on 2026-10-20 after explicit user approval. Forward migration 0134 passed focused verification and the full 82-case regression. Not committed or deployed.

## Context

Owned run `2753c63a-850f-432f-866b-95e1d0730c64` proved that an authenticated tenant member with explicit financial permission denies could update both a certificate and an insurance policy directly through Supabase. Membership-only policies allowed those writes. Route guards alone cannot protect direct database access.

Obra editors have `obras:edit` without `insurance-policies:manage`. Completing or reopening an obra legitimately recalculates derived policy dates. Applying a manage-only policy without preserving this operation would break it.

## Decision

Certificate creation and editing require `certificados:edit`; deletion requires `certificados:admin`. Policy import, creation, editing and deletion require `insurance-policies:manage`. Routes use the authenticated actor client after tenant and permission checks. The proposed RLS policies repeat these requirements for direct mutations while preserving existing member reads.

All three server completion entry points require `obras:edit` before changing the obra. Only their derived insurance-date projection receives a server-created service client. The shared updater re-reads the active obra by tenant and id, checks that persisted completion matches the requested operation, scopes each policy write by tenant, obra and policy, and verifies the affected id. Its write allowlist is `obra_finished_at`, `calculated_cancellation_date`, `last_notified_at` and `updated_at`. Macro synchronization retains the initiating actor client.

Completion replay retains the policy's original provisional finish date and skips an unchanged derived projection, preserving `last_notified_at`. Clearing that marker on a no-op would make an already notified policy eligible again. Undo clears the provisional date; definitive reception still takes precedence in the existing date calculation. A later completion establishes a new provisional date.

## Consequences and validation

Migration 0134 replaces the membership-only mutation policies. It preserves the insurance policy's existing check that its optional obra belongs to the same tenant and is active. It does not change table structure, member reads or existing soft-delete behavior. The user approved creating the forward migration from `plans/2026-10-20-workflow-qa/financial-rls-proposal.sql` and applying it only to new disposable local verification stacks. Production application requires separate authority.

The direct-write test accepts only Postgres permission error `42501` or exactly zero affected rows, checks unchanged owner readback, and follows with authenticated owner positive writes. It also separates certificate edit and administration permissions. Completion coverage exercises an editor without policy-management authority, replay, undo and recompletion. Both cases passed under the new policies in focused run `91ca002a` and full run `a62e7a53`, which passed all 82 regression cases.

The obra write, policy projection and macro synchronization are separate operations. They are not one transaction; a concurrent completion/undo or downstream failure can still leave projections needing reconciliation. This decision does not claim atomicity. A new certificate parent invariant, permission-aware policy controls, live notification dispatch and superadmin bulk-delete coverage remain separately scoped work.

Any later deployment must include the authorized completion companion before tightening the policies with 0134. The older actor-client completion implementation cannot update policies for an editor once the manage-only mutation policies are active. Local verification does not authorize a production deployment or migration.

FigJam updates are pending because the workspace quota is exhausted. Product OS and the financial and document/automation journey boards need the changed permission and completion outcomes.
