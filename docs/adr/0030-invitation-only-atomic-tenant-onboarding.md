# Invitation-only, atomic tenant onboarding

Status: accepted

## Context

Tenant creation previously used separate service-role inserts for the tenant and owner membership, so failures could leave an orphan tenant. A membership RLS policy also allowed any authenticated user who knew a tenant UUID to insert their own member row. New tenants received no working configuration and landed in the product as an empty shell.

## Decision

- Joining an existing tenant is invitation-only. Direct self-join membership inserts are not allowed; `accept_tenant_invitation` validates the token and authenticated email, then creates the membership and consumes the invitation in one transaction.
- An invitation separates the coarse membership level (`member` or `admin`) from an optional tenant operational role. Acceptance assigns both atomically; a deleted promised role blocks acceptance instead of silently granting less access.
- Recipients decline and administrators cancel through explicit atomic RPC transitions. Direct invitation updates are not part of the application contract.
- Creating a tenant uses the authenticated `create_tenant_from_blueprint` RPC. The tenant, owner membership, and standard configuration are committed in one database transaction or rolled back together.
- After that RPC succeeds, its Server Action selects the new tenant with the existing active-tenant cookie and redirects directly to `/setup`. It does not navigate through the tenant-switch HTTP route. The cookie is a selection hint; membership checks and RLS remain authoritative.
- The application sends a versioned `standard-construction` blueprint made only of symbolic keys and configuration. It never clones customer UUIDs, files, obras, or extracted rows.
- Blueprint version 1 provisions the main obras table, default document structure, extraction schemas, guided actions, working roles, data-flow defaults, and macro views. The first real obra and additional team members remain deliberate user actions.
- The first obra uses a create-only route that allocates its number server-side and retries uniqueness conflicts. It must never reuse the bulk upsert path, because a stale number could overwrite an existing obra.
- Applying folders and tables to the first obra is idempotent but crosses database and storage boundaries. Partial provisioning is reported honestly and exposes a retry instead of claiming that the obra is ready.
- New blueprint tenants persist blueprint provenance and the latest versioned obra-materialization attempt. A stale, running, partial, or missing attempt remains visible after reload and cannot count as ready until the attempt finishes successfully.
- Setup progress is derived from tenant configuration and memberships so onboarding can resume without a separate mutable wizard-state record. Inviting a team is recommended but does not block operational readiness for a solo owner.

## Consequences

The RPC migrations must be applied before the corresponding invitation-role and persisted-health UI is released. Future blueprint changes require a new version and an explicit upgrade path; silently changing version 1 is not allowed. Existing legacy tenants keep derived readiness unless provenance was recorded. Invitations remain the only supported path into an existing tenant.

## Fingerprint resolution repair, 2026-10-19

First-time-user browser QA reproduced organization creation failing with SQLSTATE42883. Migration0128's wrapper called unqualified pgcrypto `digest`, while its restricted search path omitted the extension's installed schema. Additive migration0133 computes the same SHA256 over UTF8 JSON text with PostgreSQL built-ins. It preserves the wrapper signature, security-definer authority, search path, execution ACL and atomic configuration/provenance transaction. Historical0128 and blueprint version1 remain unchanged. Verification uses a disposable local instance and independently compares known and Unicode hash inputs, owner membership, defaults, provenance and rollback. No existing database is migrated by local QA.

## Activate the created organization in the action, 2026-10-19

Browser reruns showed the creation action committing successfully but redirecting through the tenant-switch GET route to a dashboard with no active organization. Reloading recovered the membership. After the authenticated atomic RPC returns its new tenant ID, the creation action now writes the existing active-tenant cookie and redirects directly to setup. This also invalidates the server-rendered layout's cookie-dependent context. The cookie keeps the switch route's path, lifetime and SameSite policy. Authority still comes from the RPC that commits the owner's membership; the action never accepts an arbitrary target tenant ID. Existing organization switching keeps its membership check and route.

## Invitation acceptance conflict target repair, 2026-10-20

Owned browser regression reached `accept_tenant_invitation` and PostgreSQL rejected its membership insert because the unqualified `tenant_id` conflict target is ambiguous with the function's `RETURNS TABLE` output variable. The database log records the failure at the insert before the invitation can be consumed.

The approved forward repair in migration 0135 names the existing composite primary-key constraint with `ON CONFLICT ON CONSTRAINT memberships_pkey DO NOTHING`. This preserves idempotent membership creation without changing authentication, recipient-email matching, expiry validation, invitation row locking, operational-role validation and assignment, invitation consumption or the returned tenant. Historical migrations remain unchanged.

Focused owned run `91ca002a-0e49-47e8-8cc0-299c799d7f94` passed fresh-session acceptance, durable membership readback, reload and denial when the recipient revisited the consumed invitation. Its complete focused selection passed 3/3 and disposed all 3 fixture scopes. Full owned run `a62e7a53-6453-4843-8375-d208e03c53dd` then passed 82/82 cases with zero skips, flaky results or retries and verified cleanup of all 77 fixture scopes. All seven invitation and notification cases passed against the approved migrations.

Schema metadata readback confirms migration 0135 and the named conflict target. It also shows that `anon` retains function `EXECUTE` in the owned database. A direct anonymous call in the owned full-run database failed with `42501: Authentication required` in a read-only transaction, before reading or changing invitation state. The repair preserves this authentication gate and does not revoke the anonymous execution ACL.
