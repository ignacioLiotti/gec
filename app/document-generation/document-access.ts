import { createClient } from "@/utils/supabase/server";
import { resolveRequestAccessContext } from "@/lib/demo-session";
import {
  type DocumentGenerationPermissionMap,
  loadDocumentGenerationPermissions,
} from "@/lib/document-generation-server";
import { documentPermissionsFromPermissionSimulation } from "@/lib/permission-simulation";

export type DocumentAccessResult = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: Awaited<ReturnType<typeof resolveRequestAccessContext>>["user"];
  tenantId: string | null;
  actorType: Awaited<ReturnType<typeof resolveRequestAccessContext>>["actorType"];
  permissions: DocumentGenerationPermissionMap;
};

export async function resolveDocumentAccess(): Promise<DocumentAccessResult> {
  const supabase = await createClient();
  const access = await resolveRequestAccessContext();

  const permissions = access.permissionSimulation
    ? documentPermissionsFromPermissionSimulation(access.permissionSimulation)
    : access.tenantId && access.user?.id
      ? await loadDocumentGenerationPermissions({
          supabase,
          tenantId: access.tenantId,
          userId: access.user.id,
        })
      : {
          canSeeNavigation: false,
          canCreate: false,
          canReview: false,
          canManageTemplates: false,
          canViewAllDrafts: false,
        };

  return {
    supabase,
    user: access.user,
    tenantId: access.tenantId,
    actorType: access.actorType,
    permissions,
  };
}
