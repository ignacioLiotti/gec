import { createClient } from "@/utils/supabase/server";
import UserRow from "./user-row";
import ImpersonateBanner from "./_components/impersonate-banner";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <div className="p-6 text-sm">Sign in first.</div>;

  const { data: memberships } = await supabase
    .from("memberships")
    .select("tenant_id")
    .order("created_at", { ascending: true });
  const tenantId = memberships?.[0]?.tenant_id ?? null;
  if (!tenantId) return <div className="p-6 text-sm">No tenant membership found.</div>;

  const { data: canAdmin } = await supabase.rpc("has_permission", {
    tenant: tenantId,
    perm_key: "admin:roles",
  });
  if (!canAdmin) return <div className="p-6 text-sm">No admin permission.</div>;

  const [{ data: members }, { data: roles }, { data: permissions }] = await Promise.all([
    supabase
      .from("memberships")
      .select("user_id, role")
      .eq("tenant_id", tenantId),
    supabase
      .from("roles")
      .select("id, key, name")
      .eq("tenant_id", tenantId)
      .order("name"),
    supabase.from("permissions").select("id, key, description").order("key"),
  ]);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", (members ?? []).map((m) => m.user_id));

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Users</h1>
      <ImpersonateBanner />
      <UsersTable
        rows={(members ?? []).map((m) => ({
          user_id: m.user_id,
          full_name: profiles?.find((p) => p.user_id === m.user_id)?.full_name ?? m.user_id,
          membership_role: m.role,
        }))}
        tenantId={tenantId}
        allRoles={roles ?? []}
        allPermissions={permissions ?? []}
      />
    </div>
  );
}

function UsersTable({
  rows,
  tenantId,
  allRoles,
  allPermissions,
}: {
  rows: { user_id: string; full_name: string | null; membership_role: string }[];
  tenantId: string;
  allRoles: { id: string; key: string; name: string }[];
  allPermissions: { id: string; key: string; description: string | null }[];
}) {
  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-foreground/5">
          <tr className="text-left">
            <th className="px-3 py-2">User</th>
            <th className="px-3 py-2">Org Role</th>
            <th className="px-3 py-2">Assigned Roles</th>
            <th className="px-3 py-2">Overrides</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <UserRow
              key={r.user_id}
              row={r}
              tenantId={tenantId}
              allRoles={allRoles}
              allPermissions={allPermissions}
            />
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="px-3 py-6 text-foreground/60" colSpan={4}>No users.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ImpersonateBanner moved to ./_components/impersonate-banner

// UserRow moved to ./user-row (client component)


