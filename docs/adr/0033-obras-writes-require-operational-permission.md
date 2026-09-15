# ADR-0033: Tenant members may create and prepare obras

## Status

Accepted. Amended 2026-09-15 at the product owner's request.

## Context

Commit e5ce172 (2026-08-27, fix(obras): prevent incomplete default provisioning) required obras:edit for creation so every creator could also prepare folders and extraction tables. Commit 3c3432d (2026-09-08, fix(obras): allow tenant members to edit existing obras) made existing-obra edits baseline member access. Creation remained blocked for ordinary members, returning HTTP 403 from the dashboard. The product rule now permits every authenticated member to create obras in their own organization.

## Decision

- Bulk creation/upsert and first-obra creation verify is_member_of for the active tenant. Ignore tenant identifiers supplied in request bodies.
- Migration 0132 replaces the insert policy with tenant membership and updates begin/finish_obra_setup_provisioning to require authentication and membership in the active obra's tenant.
- Keep the setup RPCs SECURITY DEFINER to write provisioning health; preserve active-obra checks, payload validation, and the current attempt token. Superadmins without membership do not gain cross-tenant setup access through these RPCs.
- Materialize defaults with the requesting user's Supabase client and existing tenant-scoped table/storage policies. Do not grant configuration permissions or use a service-role bypass.
- Return HTTP 503 when setup is partial. A saved row alone is not a successfully prepared obra. Document generation still requires a materialized extraction table with columns.
- Full synchronization retains obras:edit because it deletes omitted obras. Delete/restore, tenant default editing, and administrative setup controls retain their existing checks.

## Consequences and rollout

Read-only production inspection on 2026-09-15 confirmed both insert policies still use is_member_of, while begin/finish setup retain the operational permission gate. Migration 0131 is therefore not reflected in the inspected insert policies. Apply migration 0132 before deploying the API change. Deploying only the API would turn the current 403 into an insert/setup failure. This migration changes authorization only; it does not change stored business data, grant roles, or alter table schemas. Configuration access stays restricted. Existing incomplete obras still require an additive setup retry.

## Alternatives

Grant obras:edit to every role: rejected because creation is baseline membership and should not grant full synchronization access. Bypass RLS using a service client: rejected because membership and tenant isolation can be enforced in both the API and database.

## Verification

34 focused Vitest tests cover creation, existing edits, permission checks, anonymous/non-member denial, membership lookup failures, active tenant selection, and partial setup responses. The actual provisioning orchestrator and default materializer are exercised with mocked Supabase responses for successful folder/table/column creation and failed storage, columns, begin, or finish; document-generation tests retain rejection of virtual folders without materialized columns. A disposable PostgreSQL 18 database executes the actual migration with minimal auth/schema fixtures and checks member insert/setup, cross-tenant insert/begin/finish denial, deleted/anonymous denial, and stale attempt-token rejection. This is not a production Supabase integration test.

## Visual documentation

Product OS (NDzN30GN3koTteiTdkgV3P), node 48:173, records the change as locally verified with migration and deployment pending. Figma MCP Starter quota blocked the remaining writes. Journeys 01 / Inicio y Obras (W6SZcSjlbhn1XdFLSktU03), creation/default-materialization flow near node 1:166, and Journeys 04 / Plataforma y Acceso (ySjUIomuoMG00LNK0sKajF), tenant permission flow, still need the same member-create, non-member denial, partial-setup, and pending-deployment annotation. No screenshot change is needed because the form layout is unchanged.

Lint: changed TypeScript files pass ESLint. Repository-wide lint reports 272 errors in unchanged files, including moment-cell.tsx, public assets, and vitest.setup.ts. The repository requires npm, so pnpm refused execution and the equivalent npm scripts were used.
