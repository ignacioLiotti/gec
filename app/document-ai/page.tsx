import { redirect } from "next/navigation";
import { resolveRequestAccessContext } from "@/lib/demo-session";
import { permissionSimulationHas } from "@/lib/permission-simulation";
import { DocumentAiPageClient } from "./page-client";

export default async function DocumentAiPage() {
  const access = await resolveRequestAccessContext();
  if (!access.user) {
    return <div className="p-6 text-sm">Inicia sesion para usar Document AI.</div>;
  }
  if (!access.tenantId) {
    return <div className="p-6 text-sm">No hay una organizacion activa seleccionada.</div>;
  }
  if (access.actorType === "demo") redirect("/excel");

  const [{ data: realAllowed }, { data: obras }] = await Promise.all([
    access.permissionSimulation
      ? Promise.resolve({ data: false })
      : access.supabase.rpc("has_permission", {
          tenant: access.tenantId,
          perm_key: "document-ai:run",
        }),
    access.supabase
      .from("obras")
      .select("id, n, designacion_y_ubicacion")
      .eq("tenant_id", access.tenantId)
      .is("deleted_at", null)
      .order("n", { ascending: true }),
  ]);
  const allowed = access.permissionSimulation
    ? permissionSimulationHas(access.permissionSimulation, "document-ai:run")
    : realAllowed;

  if (!allowed && !access.isSuperAdmin && !["owner", "admin"].includes(access.membershipRole ?? "")) {
    return <div className="p-6 text-sm">No tenes permisos para usar Document AI.</div>;
  }

  return (
    <DocumentAiPageClient
      works={(obras ?? []).map((obra) => ({
        id: String(obra.id),
        label: [obra.n != null ? String(obra.n) : "", obra.designacion_y_ubicacion ?? ""]
          .filter(Boolean)
          .join(" ")
          .trim(),
      }))}
    />
  );
}
