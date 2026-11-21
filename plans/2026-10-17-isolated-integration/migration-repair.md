# Approved repair for the fresh-stack migration failure

Status: Approved, implemented and verified in disposable local stacks. The user authorized the historical `0123` exception, additive `0132`, documentation and local verification. The SQL probe, focused authenticated run and final 34-case E2E run passed. No commit or deployment was performed, and the broader 40-workflow strategy remains incomplete.

## Reproduced failure

After recovering Docker Desktop, the owned local runner reached migration `0123_role_permission_denies.sql` and stopped with `column upo.tenant_id does not exist`, SQLSTATE `42703`. Migration `0125_tenant_scoped_permission_denies.sql` introduced that column later. No authenticated cases executed in that failed run, and the runner removed its own containers, volumes and network. See [startup evidence](authenticated-migration-failure.json) and [teardown verification](docker-recovery.json).

## Implemented changes

1. `0123_role_permission_denies.sql` now adds `ALTER TABLE public.user_permission_overrides ADD COLUMN IF NOT EXISTS tenant_id UUID` immediately before `has_permission`. The prerequisite stays nullable and has no default. Migration `0125` retains its existing backfill, cleanup, NOT NULL, foreign key, primary key, index and RLS operations.
2. `0132_restore_role_permission_denies.sql` restores the complete function and comment from `0123`. Migration `0125` replaces that function with one that treats every role-permission row as a grant, including explicit denies. The additive migration repairs the final function for databases that already passed `0125`.

The final function preserves the ADR 0029 precedence: superadmin/owner/admin bypass, user deny, user grant, role deny, role grant, then false. Its signature, SQL/STABLE/SECURITY DEFINER properties, search path and existing execution privileges remain intact. The repair does not alter `0125`, the pre-existing `0130`, or fixture-side migration behavior.

A migration appended at the end cannot alone fix fresh startup: PostgreSQL stops at `0123` before reaching it. Editing only historical SQL would also leave already-migrated environments with the incorrect final function. The two changes address those separate cases.

## Approved exception and scope

The user approved the historical edit to `0123`, new migration `0132`, corresponding migration/ADR documentation and verification only in newly created disposable local stacks. No existing development, remote or production database was changed. No commit or deployment was performed.

The exception was necessary because [migration instructions](../../supabase/migrations/AGENT_CONTEXT.md#local-rules) state: "Create a new numbered migration for schema changes. Do not edit existing applied migrations." The [parent instructions](../../supabase/AGENT_CONTEXT.md#local-rules) also require append-only migrations. An additive migration alone could not repair fresh startup because PostgreSQL stopped at `0123`; changing only `0123` could not repair databases that had already passed `0125`.

## Verification

- SQL probe run prefix `769a14f4` passed legacy override backfill, grant/deny preservation, final precedence, `0132` convergence and rollback cleanup.
- Focused integration run `7a394164-e222-4f0b-b308-4fc3e8d1ccef` passed 16/16 cases through real authenticated sessions. It covered user and role denies, owner/admin bypass, cross-tenant overrides and the tenant-isolation cases.
- All 14 fixture scopes reported verified runtime cleanup before their manifests moved from `awaiting-stack-disposal` to `disposed`. Stack teardown left zero owned containers, volumes and networks. The app PID and port were closed, and the temporary app snapshot was removed.
- Final Vitest passed 349/349 tests in 46 files. Test/UI type checks, focused ESLint and `check:ui` with 1,163 controls passed. See [vitest-final.json](vitest-final.json) and [final-static-checks.json](final-static-checks.json).
- Public cancellation run `4021767d-4cdf-42a1-9a54-1a7661e842fa` passed its teardown contract: the interrupted app stopped, its port closed and its snapshot was removed. See [interrupted-after-repair.json](interrupted-after-repair.json).
- Final E2E run `cf2a3a85-33a9-4a38-bacc-9d134c3c6000` exited `0` with 34/34 cases passed. All 31 fixture scopes reported verified runtime cleanup and moved to `disposed`. Final teardown left zero owned containers, volumes and networks; the app process was not alive, the app port was closed, the snapshot was removed and `failures` was empty. See [full-final-run.json](full-final-run.json) and [full-final-results.json](full-final-results.json).
- The final run includes the real API lineage and obra cases, the macro conflict regression, the five controlled wizard selectors, and the Excel create/edit/Tab/save/reload flow.

The intermediate function installed by `0125` remains incorrect until `0132` runs. This repair does not authorize serving traffic while a migration run is stopped between those versions. The SQL probe verified the existing `0125` backfill with synthetic disposable data and confirmed convergence after `0132`.
