# Invitation-only, atomic tenant onboarding

Status: accepted

## Context

Tenant creation previously used separate service-role inserts for the tenant and owner membership, so failures could leave an orphan tenant. A membership RLS policy also allowed any authenticated user who knew a tenant UUID to insert their own member row. New tenants received no working configuration and landed in the product as an empty shell.

## Decision

- Joining an existing tenant is invitation-only. Direct self-join membership inserts are not allowed; `accept_tenant_invitation` validates the token and authenticated email, then creates the membership and consumes the invitation in one transaction.
- Creating a tenant uses the authenticated `create_tenant_from_blueprint` RPC. The tenant, owner membership, and standard configuration are committed in one database transaction or rolled back together.
- The application sends a versioned `standard-construction` blueprint made only of symbolic keys and configuration. It never clones customer UUIDs, files, obras, or extracted rows.
- Blueprint version 1 provisions the main obras table, default document structure, extraction schemas, guided actions, working roles, data-flow defaults, and macro views. The first real obra and additional team members remain deliberate user actions.
- Setup progress is derived from tenant configuration and memberships so onboarding can resume without a separate mutable wizard-state record.

## Consequences

The RPC migration must be applied before the new tenant form is released. Future blueprint changes require a new version and an explicit upgrade path; silently changing version 1 is not allowed. Invitations remain the only supported path into an existing tenant.
