# Data-flow and dashboard use explicit capability permissions

Status: accepted

Dashboard access and data-flow access are no longer treated as route visibility only. We decided to gate dashboard with `nav:dashboard` and data-flow with explicit capability keys:

- `data-flow:read` for tenant/obra graph and config reads.
- `data-flow:edit` for obra-level data-flow overrides.
- `data-flow:tenant-edit` for tenant-level inherited defaults.

Admins, owners and superadmins continue to bypass these checks through the existing `has_permission(...)` contract. Demo sessions keep their capability-based read access through the existing demo `excel` capability.

Consequences:

- Sidebar visibility, proxy route access and API handlers must agree on the same keys.
- `/excel/data-flow` and `/excel/:obraId/data-flow` require `data-flow:read`.
- Tenant-level PATCH requires `data-flow:tenant-edit`; obra-level PATCH requires `data-flow:edit`.
- Future data-flow surfaces should add explicit permission keys instead of piggybacking on broad Excel access.
