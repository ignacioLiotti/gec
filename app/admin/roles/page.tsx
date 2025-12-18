import { createClient } from "@/utils/supabase/server";
import CreateRoleForm from "./_components/create-role-form";
import DeleteRoleButton from "./_components/delete-role-button";
import UserAssignments from "./_components/user-assignments";
import RolePermissions from "./_components/role-permissions";
import UserOverrides from "./_components/user-overrides";
import PermissionsManager from "./_components/permissions-manager";
import RoleRow from "./_components/role-row";
import { ColGroup, ColumnResizer } from "@/components/ui/column-resizer";
import { resolveTenantMembership } from "@/lib/tenant-selection";

const SUPERADMIN_USER_ID = "77b936fb-3e92-4180-b601-15c31125811e";

type Role = {
  id: string;
  tenant_id: string | null;
  key: string;
  name: string;
};

type Permission = {
  id: string;
  key: string;
  description: string | null;
};

export default async function RolesAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  console.log("[admin/roles] current user", user?.id);

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-sm">Por favor iniciá sesión para acceder al panel de administración.</p>
      </div>
    );
  }

  // For demo we will scope to the first tenant the user belongs to
  const { data: memberships, error: membershipsError } = await supabase
    .from("memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  console.log("[admin/roles] memberships", memberships, membershipsError);
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("user_id", user.id)
    .maybeSingle();
  console.log("[admin/roles] profile lookup", profile, profileError);
  const isSuperAdmin = (profile?.is_superadmin ?? false) || user.id === SUPERADMIN_USER_ID;

  const { tenantId } = await resolveTenantMembership(
    (memberships ?? []) as { tenant_id: string | null; role: string | null }[],
    { isSuperAdmin }
  );
  console.log("[admin/roles] resolved tenantId", tenantId);

  // Ensure user has the admin permission (admin:roles) within this tenant
  let canAdmin: boolean | null = null;
  let permError: any = null;
  if (!isSuperAdmin) {
    const permResult = await supabase.rpc("has_permission", {
      tenant: tenantId,
      perm_key: "admin:roles",
    });
    canAdmin = permResult.data;
    permError = permResult.error;
  } else {
    canAdmin = true;
  }
  console.log("[admin/roles] has_permission admin:roles =", canAdmin, permError);
  const effectiveAdmin = (typeof canAdmin === "boolean" ? canAdmin : null) ?? isSuperAdmin;

  if (!effectiveAdmin) {
    return (
      <div className="p-6">
        <p className="text-sm">No tenés permisos para gestionar roles.</p>
      </div>
    );
  }

  const [{ data: roles }, { data: permissions }, { data: members }] = await Promise.all([
    supabase.from("roles").select("id, tenant_id, key, name").eq("tenant_id", tenantId).order("name"),
    supabase.from("permissions").select("id, key, description").order("key"),
    supabase.from("memberships").select("user_id").eq("tenant_id", tenantId)
  ]);
  console.log("[admin/roles] fetched roles", roles);
  console.log("[admin/roles] fetched permissions", permissions);
  console.log("[admin/roles] fetched members", members);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", (members ?? []).map((m) => m.user_id));
  console.log("[admin/roles] fetched profiles", profiles);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Roles y Permisos</h1>
      <RolesPanel roles={(roles ?? []) as Role[]} tenantId={tenantId} />
      <PermissionsManager permissions={(permissions ?? []) as Permission[]} />
      <AssignmentsPanel users={profiles ?? []} tenantId={tenantId} />
      <RolePermissionsSection roles={(roles ?? []) as Role[]} permissions={(permissions ?? []) as Permission[]} />
    </div>
  );
}

async function createRoleAction(tenantId: string, formData: FormData) {
  "use server";
  const key = String(formData.get("key") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!key || !name) return;
  const supabase = await createClient();
  await supabase.from("roles").insert({ tenant_id: tenantId, key, name });
}

async function deleteRoleAction(roleId: string) {
  "use server";
  const supabase = await createClient();
  await supabase.from("roles").delete().eq("id", roleId);
}

function RolesPanel({ roles, tenantId }: { roles: Role[]; tenantId: string }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Roles</h2>
        <CreateRoleForm onCreate={createRoleAction.bind(null, tenantId)} />
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="text-sm table-fixed" data-table-id="roles-table">
          <ColGroup tableId="roles-table" columns={3} />
          <thead className="bg-foreground/5">
            <tr className="text-left">
              <th className="relative px-3 py-2 whitespace-normal break-words align-top">Clave
                <ColumnResizer tableId="roles-table" colIndex={0} />
              </th>
              <th className="relative px-3 py-2 whitespace-normal break-words align-top">Nombre
                <ColumnResizer tableId="roles-table" colIndex={1} />
              </th>
              <th className="relative px-3 py-2 w-32 whitespace-normal break-words align-top">Acciones
                <ColumnResizer tableId="roles-table" colIndex={2} />
              </th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <RoleRow key={r.id} role={{ id: r.id, key: r.key, name: r.name }} />
            ))}
            {roles.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-foreground/60 whitespace-normal break-words align-top" colSpan={3}>Todavía no hay roles.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PermissionsPanel({ permissions }: { permissions: Permission[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Permisos</h2>
      <div className="overflow-x-auto rounded-md border">
        <table className="text-sm table-fixed" data-table-id="permissions-table">
          <ColGroup tableId="permissions-table" columns={2} />
          <thead className="bg-foreground/5">
            <tr className="text-left">
              <th className="relative px-3 py-2 whitespace-normal break-words align-top">Clave
                <ColumnResizer tableId="permissions-table" colIndex={0} />
              </th>
              <th className="relative px-3 py-2 whitespace-normal break-words align-top">Descripción
                <ColumnResizer tableId="permissions-table" colIndex={1} />
              </th>
            </tr>
          </thead>
          <tbody>
            {permissions.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2 font-mono whitespace-normal break-words align-top">{p.key}</td>
                <td className="px-3 py-2 whitespace-normal break-words align-top">{p.description}</td>
              </tr>
            ))}
            {permissions.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-foreground/60 whitespace-normal break-words align-top" colSpan={2}>No hay permisos.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AssignmentsPanel({ users, tenantId }: { users: { user_id: string; full_name: string | null }[]; tenantId: string }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Asignaciones</h2>
      <UserAssignments users={users} tenantId={tenantId} />
    </section>
  );
}

function RolePermissionsSection({ roles, permissions }: { roles: Role[]; permissions: Permission[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Permisos de Roles</h2>
      <div className="space-y-4">
        {roles.map((r) => (
          <div key={r.id} className="rounded-md border p-3">
            <div className="mb-2 text-sm font-medium">{r.name} <span className="font-mono text-foreground/60">({r.key})</span></div>
            <RolePermissions roleId={r.id} allPermissions={permissions} />
          </div>
        ))}
        {roles.length === 0 && (
          <div className="rounded-md border p-3 text-sm text-foreground/60">Todavía no hay roles.</div>
        )}
      </div>
    </section>
  );
}

// Client islands
// Client components moved to ./_components
