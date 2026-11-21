import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { isolatedEnvironment } from "./test-integration.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function permissionMigrationSql() {
  const [a, b, user, orphan, grant, deny, capability, grantRole, denyRole, otherRole] = Array.from({ length: 10 }, () => randomUUID());
  const prefix = `migration-${randomUUID()}`;
  const migration125 = readFileSync(join(root, "supabase/migrations/0125_tenant_scoped_permission_denies.sql"), "utf8");
  const migration132 = readFileSync(join(root, "supabase/migrations/0136_restore_role_permission_denies.sql"), "utf8");
  const check = (condition, message) => `SELECT pg_temp.check_permission_migration((${condition}), '${message}');`;
  const permission = (tenant, key = "role") => `public.has_permission('${tenant}'::uuid, '${prefix}:${key}')`;
  return `\\set ON_ERROR_STOP on
SET lock_timeout = '5s';
SET statement_timeout = '20s';
SELECT md5(pg_get_functiondef('public.has_permission(uuid,text)'::regprocedure)) AS original_definition \\gset
BEGIN;
LOCK TABLE public.user_permission_overrides IN ACCESS EXCLUSIVE MODE;
CREATE FUNCTION pg_temp.check_permission_migration(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $assert$
BEGIN IF ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION '%', message; END IF; END;
$assert$;
${check("NOT EXISTS (SELECT 1 FROM public.user_permission_overrides)", "Owned stack must have no override rows before the legacy simulation")}
CREATE TEMP TABLE permission_function_before AS
SELECT pg_get_functiondef(oid) AS definition, proowner, proacl, prosecdef, provolatile, proconfig
FROM pg_proc WHERE oid = 'public.has_permission(uuid,text)'::regprocedure;
INSERT INTO public.tenants(id, name) VALUES ('${a}', '${prefix} A'), ('${b}', '${prefix} B');
INSERT INTO auth.users(id, email, aud, role, raw_app_meta_data, raw_user_meta_data)
VALUES ('${user}', '${prefix}@e2e.invalid', 'authenticated', 'authenticated', '{}', '{}'),
       ('${orphan}', '${prefix}-orphan@e2e.invalid', 'authenticated', 'authenticated', '{}', '{}');
INSERT INTO public.memberships(tenant_id, user_id, role)
VALUES ('${a}', '${user}', 'member'), ('${b}', '${user}', 'member');
INSERT INTO public.permissions(id, key) VALUES
('${grant}', '${prefix}:grant'), ('${deny}', '${prefix}:deny'), ('${capability}', '${prefix}:role');

-- Recreate the legacy override shape only inside this transaction.
ALTER TABLE public.user_permission_overrides DROP COLUMN tenant_id CASCADE;
ALTER TABLE public.user_permission_overrides ADD PRIMARY KEY (user_id, permission_id);
INSERT INTO public.user_permission_overrides(user_id, permission_id, is_granted)
VALUES ('${user}', '${grant}', true), ('${user}', '${deny}', false), ('${orphan}', '${grant}', true);

-- Execute the actual checked-in migration, including its legacy backfill.
${migration125}
${check(`(SELECT count(*) FROM public.user_permission_overrides) = 4`, "0125 must copy two overrides to two memberships and discard the unscoped orphan")}
${check(`NOT EXISTS (SELECT expected.tenant_id, expected.permission_id, expected.is_granted FROM (VALUES ('${a}'::uuid, '${grant}'::uuid, true), ('${b}'::uuid, '${grant}'::uuid, true), ('${a}'::uuid, '${deny}'::uuid, false), ('${b}'::uuid, '${deny}'::uuid, false)) AS expected(tenant_id, permission_id, is_granted) EXCEPT SELECT tenant_id, permission_id, is_granted FROM public.user_permission_overrides WHERE user_id = '${user}')`, "0125 must preserve literal grant and deny values for both tenants")}
${check(`(SELECT attnotnull FROM pg_attribute WHERE attrelid = 'public.user_permission_overrides'::regclass AND attname = 'tenant_id')`, "0125 tenant_id must be NOT NULL")}
${check(`EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.user_permission_overrides'::regclass AND contype = 'p' AND pg_get_constraintdef(oid) = 'PRIMARY KEY (user_id, tenant_id, permission_id)')`, "0125 must establish its composite primary key")}
${check(`EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.user_permission_overrides'::regclass AND contype = 'f' AND confrelid = 'public.tenants'::regclass AND confdeltype = 'c')`, "0125 must restore the tenant cascade foreign key")}
INSERT INTO public.roles(id, tenant_id, key, name) VALUES
('${grantRole}', '${a}', '${prefix}-grant', 'Synthetic grant'),
('${denyRole}', '${a}', '${prefix}-deny', 'Synthetic deny'),
('${otherRole}', '${b}', '${prefix}-other', 'Synthetic other tenant grant');
INSERT INTO public.user_roles(user_id, role_id) VALUES
('${user}', '${grantRole}'), ('${user}', '${denyRole}'), ('${user}', '${otherRole}');
INSERT INTO public.role_permissions(role_id, permission_id, is_granted) VALUES
('${grantRole}', '${capability}', true), ('${denyRole}', '${capability}', false), ('${otherRole}', '${capability}', true);
DO $identity$ BEGIN
  PERFORM set_config('request.jwt.claim.sub', '${user}', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"${user}","role":"authenticated"}', true);
END $identity$;
${check(permission(a), "The post-0131 function must reproduce the role-deny regression before 0132")}

-- 0126 through 0131 do not redefine has_permission. Restore its final contract.
${migration132}
${check(`NOT ${permission(a)}`, "0132 role deny must beat a simultaneous role grant")}
${check(permission(b), "Tenant A role deny must not block tenant B role grant")}
${check(permission(a, "grant"), "Backfilled user grant must remain effective")}
${check(`NOT ${permission(a, "deny")}`, "Backfilled user deny must remain effective")}
INSERT INTO public.user_permission_overrides(user_id, tenant_id, permission_id, is_granted)
VALUES ('${user}', '${a}', '${capability}', true);
${check(permission(a), "Per-user grant must override role deny")}
UPDATE public.user_permission_overrides SET is_granted = false
WHERE user_id = '${user}' AND tenant_id = '${a}' AND permission_id = '${capability}';
${check(`NOT ${permission(a)}`, "Per-user deny must override all role grants")}
${check(permission(b), "Tenant A user deny must not block tenant B")}
UPDATE public.memberships SET role = 'owner' WHERE tenant_id = '${a}' AND user_id = '${user}';
${check(permission(a), "Owner bypass must survive explicit denies")}
UPDATE public.memberships SET role = 'member' WHERE tenant_id = '${a}' AND user_id = '${user}';
DELETE FROM public.user_permission_overrides WHERE user_id = '${user}' AND tenant_id = '${a}' AND permission_id = '${capability}';
DELETE FROM public.role_permissions WHERE role_id = '${denyRole}' AND permission_id = '${capability}';
${check(permission(a), "Removing the deny must reveal the remaining grant")}
DELETE FROM public.role_permissions WHERE role_id = '${grantRole}' AND permission_id = '${capability}';
${check(`NOT ${permission(a)}`, "Revoking the last grant must remove the permission")}
${check(`(SELECT p.prosecdef AND p.provolatile = 's' AND p.proconfig @> ARRAY['search_path=public, pg_temp'] AND pg_get_functiondef(p.oid) = expected.definition AND p.proowner = expected.proowner AND p.proacl IS NOT DISTINCT FROM expected.proacl FROM pg_proc p CROSS JOIN permission_function_before expected WHERE p.oid = 'public.has_permission(uuid,text)'::regprocedure)`, "0132 upgrade must converge to the clean function without changing owner or EXECUTE grants")}
ROLLBACK;
-- The failed or successful transaction never commits synthetic data or schema.
SELECT CASE WHEN
  md5(pg_get_functiondef('public.has_permission(uuid,text)'::regprocedure)) = :'original_definition'
  AND NOT EXISTS (SELECT 1 FROM public.tenants WHERE id IN ('${a}', '${b}'))
  AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id IN ('${user}', '${orphan}'))
  AND NOT EXISTS (SELECT 1 FROM public.permissions WHERE id IN ('${grant}', '${deny}', '${capability}'))
THEN 'permission-migration: backfill, precedence, convergence and rollback passed'
ELSE 'permission-migration: rollback verification FAILED' END;
`;
}

export function checkPermissionMigration({ manifestPath, runId }) {
  if (!manifestPath || !runId) throw new Error("An owned running integration manifest and run ID are required.");
  const path = realpathSync(manifestPath);
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  const projectId = `e2e_${runId.replaceAll("-", "")}`;
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(runId)
    || manifest.kind !== "owned-local-integration" || manifest.mode !== "authenticated"
    || manifest.status !== "running" || manifest.runId !== runId || manifest.projectId !== projectId
    || dirname(path) !== realpathSync(manifest.workspace)) {
    throw new Error("Permission migration check refused an unowned integration runtime.");
  }
  const dockerEnvironment = { ...isolatedEnvironment(process.env), DOCKER_CONFIG: join(manifest.workspace, "docker") };
  if (process.platform === "win32") dockerEnvironment.DOCKER_HOST = "npipe:////./pipe/dockerDesktopLinuxEngine";
  const name = `supabase_db_${projectId}`;
  const inspected = spawnSync("docker", ["inspect", name], { env: dockerEnvironment, encoding: "utf8", windowsHide: true, timeout: 10_000 });
  if (inspected.error || inspected.status !== 0) throw new Error("Cannot inspect the owned integration database container.");
  const [container] = JSON.parse(inspected.stdout);
  if (container?.Name !== `/${name}` || container.State?.Running !== true
    || container.Config?.Labels?.["com.supabase.cli.project"] !== projectId
    || !/^[0-9a-f]{64}$/i.test(container.Id)
    || !(Date.parse(container.Created) >= Date.parse(manifest.startedAt))) {
    throw new Error("Database container ownership does not match the running integration manifest.");
  }
  const sql = permissionMigrationSql();
  const result = spawnSync("docker", ["exec", "-i", container.Id, "psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], {
    env: dockerEnvironment, input: sql, encoding: "utf8", windowsHide: true, timeout: 45_000, maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error(`Owned permission migration check failed: ${(result.error?.message ?? result.stderr ?? "psql failed").slice(-5000)}`);
  const success = "permission-migration: backfill, precedence, convergence and rollback passed";
  if (!result.stdout.split(/\r?\n/).includes(success)) throw new Error("Permission migration rollback verification did not pass.");
  return { result: success, runId, projectId };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length === 3 && process.argv[2] === "--emit") {
    process.stdout.write(permissionMigrationSql());
  } else if (process.argv.length === 3 && process.argv[2] === "--check-owned") {
    process.stdout.write(JSON.stringify(checkPermissionMigration({
      manifestPath: process.env.E2E_INSTANCE_MANIFEST,
      runId: process.env.E2E_RUN_ID,
    })));
  } else {
    throw new Error("Use --emit to inspect SQL; --check-owned requires a running owned integration manifest.");
  }
}
