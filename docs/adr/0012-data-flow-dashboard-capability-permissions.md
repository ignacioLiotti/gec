# Data-flow uses explicit capability permissions

Status: accepted

Data-flow access is no longer treated as route visibility only. We decided to gate data-flow with explicit capability keys:

- `data-flow:read` for tenant/obra graph and config reads.
- `data-flow:edit` for obra-level data-flow overrides.
- `data-flow:tenant-edit` for tenant-level inherited defaults.

Dashboard access remains available to all authenticated users. Admins, owners and superadmins continue to bypass data-flow permission checks through the existing `has_permission(...)` contract. Demo sessions keep their capability-based read access through the existing demo `excel` capability.

Consequences:

- Sidebar visibility, proxy route access and API handlers must agree on data-flow keys.
- `/dashboard` appears in the sidebar for regular authenticated users.
- `/excel/data-flow` and `/excel/:obraId/data-flow` require `data-flow:read`.
- Tenant-level PATCH requires `data-flow:tenant-edit`; obra-level PATCH requires `data-flow:edit`.
- Future data-flow surfaces should add explicit permission keys instead of piggybacking on broad Excel access.
