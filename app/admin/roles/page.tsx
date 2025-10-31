import { createClient } from "@/utils/supabase/server";
import CreateRoleForm from "./_components/create-role-form";
import DeleteRoleButton from "./_components/delete-role-button";
import UserAssignments from "./_components/user-assignments";
import RolePermissions from "./_components/role-permissions";
import UserOverrides from "./_components/user-overrides";
import PermissionsManager from "./_components/permissions-manager";
import RoleRow from "./_components/role-row";
import { ColGroup, ColumnResizer } from "@/components/ui/column-resizer";

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

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-sm">Please sign in to access admin.</p>
      </div>
    );
  }

  // For demo we will scope to the first tenant the user belongs to
  const { data: memberships } = await supabase
    .from("memberships")
    .select("tenant_id, role")
    .order("created_at", { ascending: true });

  const tenantId = memberships?.[0]?.tenant_id ?? null;

  if (!tenantId) {
    return (
      <div className="p-6">
        <p className="text-sm">No tenant membership found.</p>
      </div>
    );
  }

  // Ensure user has the admin permission (admin:roles) within this tenant
  const { data: canAdmin } = await supabase.rpc("has_permission", {
    tenant: tenantId,
    perm_key: "admin:roles",
  });

  if (!canAdmin) {
    return (
      <div className="p-6">
        <p className="text-sm">You do not have permission to manage roles.</p>
      </div>
    );
  }

  const [{ data: roles }, { data: permissions }, { data: members }] = await Promise.all([
    supabase.from("roles").select("id, tenant_id, key, name").eq("tenant_id", tenantId).order("name"),
    supabase.from("permissions").select("id, key, description").order("key"),
    supabase.from("memberships").select("user_id").eq("tenant_id", tenantId)
  ]);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", (members ?? []).map((m) => m.user_id));

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Roles & Permissions</h1>
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
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm table-fixed" data-table-id="roles-table">
          <ColGroup tableId="roles-table" columns={3} />
          <thead className="bg-foreground/5">
            <tr className="text-left">
              <th className="relative px-3 py-2 whitespace-normal break-words align-top">Key
                <ColumnResizer tableId="roles-table" colIndex={0} />
              </th>
              <th className="relative px-3 py-2 whitespace-normal break-words align-top">Name
                <ColumnResizer tableId="roles-table" colIndex={1} />
              </th>
              <th className="relative px-3 py-2 w-32 whitespace-normal break-words align-top">Actions
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
                <td className="px-3 py-6 text-foreground/60 whitespace-normal break-words align-top" colSpan={3}>No roles yet.</td>
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
      <h2 className="text-lg font-medium">Permissions</h2>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm table-fixed" data-table-id="permissions-table">
          <ColGroup tableId="permissions-table" columns={2} />
          <thead className="bg-foreground/5">
            <tr className="text-left">
              <th className="relative px-3 py-2 whitespace-normal break-words align-top">Key
                <ColumnResizer tableId="permissions-table" colIndex={0} />
              </th>
              <th className="relative px-3 py-2 whitespace-normal break-words align-top">Description
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
                <td className="px-3 py-6 text-foreground/60 whitespace-normal break-words align-top" colSpan={2}>No permissions.</td>
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
      <h2 className="text-lg font-medium">Assignments</h2>
      <UserAssignments users={users} tenantId={tenantId} />
    </section>
  );
}

function RolePermissionsSection({ roles, permissions }: { roles: Role[]; permissions: Permission[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Role Permissions</h2>
      <div className="space-y-4">
        {roles.map((r) => (
          <div key={r.id} className="rounded-md border p-3">
            <div className="mb-2 text-sm font-medium">{r.name} <span className="font-mono text-foreground/60">({r.key})</span></div>
            <RolePermissions roleId={r.id} allPermissions={permissions} />
          </div>
        ))}
        {roles.length === 0 && (
          <div className="rounded-md border p-3 text-sm text-foreground/60">No roles yet.</div>
        )}
      </div>
    </section>
  );
}

// Client islands
// Client components moved to ./_components


