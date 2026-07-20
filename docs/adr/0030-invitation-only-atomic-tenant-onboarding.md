# Invitation-only, atomic tenant onboarding

Status: accepted

## Context

Tenant creation previously used separate service-role inserts for the tenant and owner membership, so failures could leave an orphan tenant. A membership RLS policy also allowed any authenticated user who knew a tenant UUID to insert their own member row. New tenants received no working configuration and landed in the product as an empty shell.

## Decision

- Joining an existing tenant is invitation-only. Direct self-join membership inserts are not allowed; `accept_tenant_invitation` validates the token and authenticated email, then creates the membership and consumes the invitation in one transaction.
- An invitation separates the coarse membership level (`member` or `admin`) from an optional tenant operational role. Acceptance assigns both atomically; a deleted promised role blocks acceptance instead of silently granting less access.
- Recipients decline and administrators cancel through explicit atomic RPC transitions. Direct invitation updates are not part of the application contract.
- Creating a tenant uses the authenticated `create_tenant_from_blueprint` RPC. The tenant, owner membership, and standard configuration are committed in one database transaction or rolled back together.
- The application sends a versioned `standard-construction` blueprint made only of symbolic keys and configuration. It never clones customer UUIDs, files, obras, or extracted rows.
- Blueprint version 1 provisions the main obras table, default document structure, extraction schemas, guided actions, working roles, data-flow defaults, and macro views. The first real obra and additional team members remain deliberate user actions.
- The first obra uses a create-only route that allocates its number server-side and retries uniqueness conflicts. It must never reuse the bulk upsert path, because a stale number could overwrite an existing obra.
- Applying folders and tables to the first obra is idempotent but crosses database and storage boundaries. Partial provisioning is reported honestly and exposes a retry instead of claiming that the obra is ready.
- New blueprint tenants persist blueprint provenance and the latest versioned obra-materialization attempt. A stale, running, partial, or missing attempt remains visible after reload and cannot count as ready until the attempt finishes successfully.
- Setup progress is derived from tenant configuration and memberships so onboarding can resume without a separate mutable wizard-state record. Inviting a team is recommended but does not block operational readiness for a solo owner.

## Consequences

The RPC migrations must be applied before the corresponding invitation-role and persisted-health UI is released. Future blueprint changes require a new version and an explicit upgrade path; silently changing version 1 is not allowed. Existing legacy tenants keep derived readiness unless provenance was recorded. Invitations remain the only supported path into an existing tenant.
