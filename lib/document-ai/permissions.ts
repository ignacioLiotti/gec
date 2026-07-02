import type { resolveRequestAccessContext } from "@/lib/demo-session";
import { permissionSimulationHas } from "@/lib/permission-simulation";

type AccessContext = Awaited<ReturnType<typeof resolveRequestAccessContext>>;

/**
 * Single source of truth for the Document AI permission check. Demo sessions
 * are always rejected: Document AI reads tenant documents and calls paid
 * models, neither of which a demo actor should reach.
 */
export async function hasDocumentAiPermission(access: AccessContext) {
  if (access.actorType === "demo") return false;
  if (!access.tenantId || !access.user?.id) return false;
  if (access.permissionSimulation) {
    return permissionSimulationHas(access.permissionSimulation, "document-ai:run");
  }
  if (access.isSuperAdmin || ["owner", "admin"].includes(access.membershipRole ?? "")) {
    return true;
  }
  const { data, error } = await access.supabase.rpc("has_permission", {
    tenant: access.tenantId,
    perm_key: "document-ai:run",
  });
  if (error) return false;
  return data === true;
}
