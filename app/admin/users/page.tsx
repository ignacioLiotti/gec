import { createClient } from "@/utils/supabase/server";
import UserRow from "./user-row";
import ImpersonateBanner from "./_components/impersonate-banner";
import { InviteUsersDialog } from "./_components/invite-users-dialog";
import { PendingInvitationsList } from "./_components/pending-invitations-list";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const SUPERADMIN_USER_ID = "77b936fb-3e92-4180-b601-15c31125811e";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  console.log("[admin/users] current user", user?.id);
  if (!user) return <div className="p-6 text-sm">Iniciá sesión primero.</div>;

  const { data: memberships, error: membershipsError } = await supabase
    .from("memberships")
    .select("tenant_id")
    .order("created_at", { ascending: true });
  console.log("[admin/users] memberships", memberships, membershipsError);
  let resolvedMemberships = memberships;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("user_id", user.id)
    .maybeSingle();
  console.log("[admin/users] profile lookup", profile, profileError);
  const isSuperAdmin = (profile?.is_superadmin ?? false) || user.id === SUPERADMIN_USER_ID;

  if ((!resolvedMemberships || resolvedMemberships.length === 0) && isSuperAdmin) {
    console.log("[admin/users] no memberships found; using default tenant for superadmin");
    resolvedMemberships = [{ tenant_id: DEFAULT_TENANT_ID }];
  }

  const tenantId = resolvedMemberships?.[0]?.tenant_id ?? DEFAULT_TENANT_ID;
  console.log("[admin/users] resolved tenantId", tenantId);
  if (!tenantId) return <div className="p-6 text-sm">No se encontró membresía de organización.</div>;

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
  console.log("[admin/users] has_permission admin:roles =", canAdmin, permError);
  const effectiveAdmin = (typeof canAdmin === "boolean" ? canAdmin : null) ?? isSuperAdmin;
  if (!effectiveAdmin) return <div className="p-6 text-sm">Sin permisos de administrador.</div>;

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
  console.log("[admin/users] fetched members", members);
  console.log("[admin/users] fetched roles", roles);
  console.log("[admin/users] fetched permissions", permissions);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", (members ?? []).map((m) => m.user_id));
  console.log("[admin/users] fetched profiles", profiles);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        <InviteUsersDialog tenantId={tenantId} />
      </div>
      <ImpersonateBanner />
      <PendingInvitationsList tenantId={tenantId} />
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
            <th className="px-3 py-2">Usuario</th>
            <th className="px-3 py-2">Rol de Org.</th>
            <th className="px-3 py-2">Roles Asignados</th>
            <th className="px-3 py-2">Modificaciones</th>
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
              <td className="px-3 py-6 text-foreground/60" colSpan={4}>Sin usuarios.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ImpersonateBanner moved to ./_components/impersonate-banner

// UserRow moved to ./user-row (client component)


