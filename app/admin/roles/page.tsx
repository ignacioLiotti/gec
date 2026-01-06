import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { resolveTenantMembership } from "@/lib/tenant-selection";
import { Suspense } from "react";
import { RolesPageClient } from "./_components/roles-page-client";
import {
  getRolesWithPermissions,
  getPermissionsByCategory,
  getRoleTemplates,
  getMacroTablePermissions,
  getMacroTablesForPermissions,
  type Role,
  type PermissionsByCategory,
  type RoleTemplate,
  type MacroTablePermission,
} from "./permissions-actions";

const SUPERADMIN_USER_ID = "77b936fb-3e92-4180-b601-15c31125811e";

export default async function RolesAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-sm">
          Por favor inicia sesion para acceder al panel de administracion.
        </p>
      </div>
    );
  }

  // Get memberships and check admin status
  const { data: memberships } = await supabase
    .from("memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("user_id", user.id)
    .maybeSingle();

  const isSuperAdmin =
    (profile?.is_superadmin ?? false) || user.id === SUPERADMIN_USER_ID;

  const { tenantId } = await resolveTenantMembership(
    (memberships ?? []) as { tenant_id: string | null; role: string | null }[],
    { isSuperAdmin }
  );

  if (!tenantId) {
    return (
      <div className="p-6">
        <p className="text-sm">
          No tenes una organizacion activa. Por favor selecciona una organizacion.
        </p>
      </div>
    );
  }

  // Check admin permission
  let canAdmin = isSuperAdmin;
  if (!isSuperAdmin) {
    const permResult = await supabase.rpc("has_permission", {
      tenant: tenantId,
      perm_key: "admin:roles",
    });
    canAdmin = permResult.data ?? false;
  }

  if (!canAdmin) {
    return (
      <div className="p-6">
        <p className="text-sm">No tenes permisos para gestionar roles.</p>
      </div>
    );
  }

  // Fetch all data in parallel
  const [
    roles,
    permissionsByCategory,
    templates,
    macroPermissions,
    macroTables,
    membersData,
  ] = await Promise.all([
    getRolesWithPermissions({ tenantId }),
    getPermissionsByCategory(),
    getRoleTemplates(),
    getMacroTablePermissions({ tenantId }),
    getMacroTablesForPermissions({ tenantId }),
    supabase.from("memberships").select("user_id").eq("tenant_id", tenantId),
  ]);

  // Get user data from auth.users
  const memberIds = (membersData.data ?? []).map((m) => m.user_id);
  const admin = createSupabaseAdminClient();

  const users = await Promise.all(
    memberIds.map(async (userId) => {
      try {
        const { data } = await admin.auth.admin.getUserById(userId);
        return {
          user_id: data.user?.id ?? userId,
          full_name: data.user?.user_metadata?.display_name ?? data.user?.user_metadata?.full_name ?? null,
          email: data.user?.email ?? null,
        };
      } catch (error) {
        console.error(`Failed to fetch user ${userId}:`, error);
        return {
          user_id: userId,
          full_name: null,
          email: null,
        };
      }
    })
  );

  return (
    <div className="p-6">
      <Suspense fallback={<RolesPageSkeleton />}>
        <RolesPageClient
          roles={roles}
          permissionsByCategory={permissionsByCategory}
          templates={templates}
          macroPermissions={macroPermissions}
          macroTables={macroTables}
          users={users}
          tenantId={tenantId}
        />
      </Suspense>
    </div>
  );
}

function RolesPageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  );
}
