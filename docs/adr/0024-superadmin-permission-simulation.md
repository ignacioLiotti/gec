# ADR-0024: Superadmin Permission Simulation

## Status

Accepted

## Date

2026-06-12

## Context

Superadmins bypass tenant roles, route permissions, RLS helper functions, and
many app-level checks. That makes support/debugging harder when the app owner
needs to see what a regular tenant user sees with no permissions or with a
specific permission set.

Full impersonation already exists for support, but it changes the authenticated
session to another user and is too heavy when the goal is only to inspect
permission-driven UI and route access.

## Decision

Add a superadmin-only permission simulation mode. The mode stores an effective
permission-key list in an HTTP-only cookie and is ignored unless the real actor
is resolved as superadmin.

When active, app-level access context exposes the actor as a regular member for
permission decisions: `isSuperAdmin` is false, `membershipRole` is `member`, and
permission checks use only the simulated permission keys. The UI still receives
the real `actualIsSuperAdmin` flag so the superadmin can open the user-menu
control and disable the simulation.

The simulation does not mutate roles, memberships, permissions, RLS policies, or
database data. It is a debugging viewport, not an authorization boundary.

## Consequences

Superadmins can quickly inspect the sidebar, route gating, Document AI, and
Document Generation behavior as a no-permission or selected-permission user.

Because the underlying Supabase session remains the real superadmin, database
RLS may still permit reads where application code does not enforce a simulated
permission. New permission-sensitive surfaces should use the centralized access
context or `route-guard` helpers to participate in simulation.

## Alternatives considered

- Full impersonation: kept for user-specific support, but rejected as the only
  mechanism because it requires switching sessions and a target user.
- Client-only sidebar filtering: rejected because refreshes and route access
  would not match the selected permission set.

## Related files

- `lib/permission-simulation.ts`
- `lib/demo-session.ts`
- `lib/route-guard.ts`
- `app/api/admin/permission-simulation/route.ts`
- `components/auth/user-menu.tsx`

## Related domain docs

- `docs/obsidian-brain/20 - Permissions System.md`
- `docs/obsidian-brain/33 - Superadmin Implementation.md`
