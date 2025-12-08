"use client";

import { useEffect, useState } from "react";

export default function UserRow({
  row,
  tenantId,
  allRoles,
  allPermissions,
}: {
  row: { user_id: string; full_name: string | null; membership_role: string };
  tenantId: string;
  allRoles: { id: string; key: string; name: string }[];
  allPermissions: { id: string; key: string; description: string | null }[];
}) {
  const [assignedRoles, setAssignedRoles] = useState<any[]>([]);
  const [sources, setSources] = useState<{ roleGrants: { roleId: string; permissionId: string }[]; overrideIds: string[]; isAdmin: boolean } | null>(null);
  const [selectedOrgRole, setSelectedOrgRole] = useState<string>(row.membership_role);
  const [newRoleId, setNewRoleId] = useState<string>("");
  const [newPermissionId, setNewPermissionId] = useState<string>("");

  useEffect(() => {
    (async () => {
      const mod = await import("../roles/server-actions");
      const [ur, src] = await Promise.all([
        mod.listUserRoles({ userId: row.user_id }),
        mod.userPermissionSources({ tenantId, userId: row.user_id }),
      ]);
      setAssignedRoles(ur);
      setSources(src);
    })();
  }, [row.user_id, tenantId]);

  async function assign(roleId: string) {
    const mod = await import("../roles/server-actions");
    await mod.assignUserRole({ userId: row.user_id, roleId });
    setAssignedRoles(await mod.listUserRoles({ userId: row.user_id }));
    setSources(await mod.userPermissionSources({ tenantId, userId: row.user_id }));
  }

  async function revoke(roleId: string) {
    const mod = await import("../roles/server-actions");
    await mod.revokeUserRole({ userId: row.user_id, roleId });
    setAssignedRoles(await mod.listUserRoles({ userId: row.user_id }));
    setSources(await mod.userPermissionSources({ tenantId, userId: row.user_id }));
  }

  async function togglePermission(permissionId: string, next: boolean) {
    const mod = await import("../roles/server-actions");
    await mod.setUserOverride({ userId: row.user_id, permissionId, isGranted: next });
    setSources(await mod.userPermissionSources({ tenantId, userId: row.user_id }));
  }

  async function updateOrgRole() {
    const mod = await import("../roles/server-actions");
    await mod.updateMembershipRole({ tenantId, userId: row.user_id, role: selectedOrgRole as any });
  }

  const assignedRoleIds = new Set(assignedRoles.map((r: any) => r.role_id));
  const roleGrantSet = new Set((sources?.roleGrants ?? []).map((g) => g.permissionId));
  const overrideSet = new Set(sources?.overrideIds ?? []);

  return (
    <tr className="border-t align-top">
      <td className="px-3 py-2">
        <div className="text-sm font-medium">{row.full_name ?? row.user_id}</div>
        <div className="text-xs text-foreground/60 font-mono">{row.user_id}</div>
        <form
          action={async () => {
            const fd = new FormData();
            fd.set("user_id", row.user_id);
            await fetch("/api/impersonate/start", { method: "POST", body: fd });
            location.reload();
          }}
        >
          <button className="mt-2 rounded-md border px-2 py-1 text-xs hover:bg-foreground/10">Suplantar</button>
        </form>
      </td>
      <td className="px-3 py-2">
        <form action={updateOrgRole} className="flex items-center gap-2">
          <select
            value={selectedOrgRole}
            onChange={(e) => setSelectedOrgRole(e.currentTarget.value)}
            className="rounded-md border bg-background px-2 py-1 text-xs"
          >
            <option value="owner">propietario</option>
            <option value="admin">admin</option>
            <option value="member">miembro</option>
          </select>
          <button className="rounded-md border px-2 py-1 text-xs hover:bg-foreground/10">Actualizar</button>
        </form>
      </td>
      <td className="px-3 py-2 space-y-2">
        <div className="flex items-center gap-2">
          <select
            value={newRoleId}
            onChange={(e) => setNewRoleId(e.currentTarget.value)}
            className="rounded-md border bg-background px-2 py-1 text-xs"
          >
            <option value="">Agregar rol...</option>
            {allRoles
              .filter((r) => !assignedRoleIds.has(r.id))
              .map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
          </select>
          <form
            action={async () => {
              if (!newRoleId) return;
              await assign(newRoleId);
              setNewRoleId("");
            }}
          >
            <button className="rounded-md bg-black px-2 py-1 text-xs text-white hover:bg-black/90">Agregar</button>
          </form>
        </div>
        <div className="flex flex-wrap gap-2">
          {allRoles.map((r) => (
            <button
              key={r.id}
              onClick={() => (assignedRoleIds.has(r.id) ? revoke(r.id) : assign(r.id))}
              className={
                "rounded-md border px-2 py-1 text-xs " +
                (assignedRoleIds.has(r.id) ? "bg-foreground/10" : "hover:bg-foreground/10")
              }
            >
              {r.name}
            </button>
          ))}
        </div>
      </td>
      <td className="px-3 py-2 space-y-2">
        <div className="flex items-center gap-2">
          <select
            value={newPermissionId}
            onChange={(e) => setNewPermissionId(e.currentTarget.value)}
            className="rounded-md border bg-background px-2 py-1 text-xs"
          >
            <option value="">Agregar permiso...</option>
            {allPermissions
              .filter((p) => {
                const fromAdmin = sources?.isAdmin ?? false;
                const fromRole = roleGrantSet.has(p.id);
                const fromOverride = overrideSet.has(p.id);
                return !(fromAdmin || fromRole || fromOverride);
              })
              .map((p) => (
                <option key={p.id} value={p.id}>{p.key}</option>
              ))}
          </select>
          <form
            action={async () => {
              if (!newPermissionId) return;
              await togglePermission(newPermissionId, true);
              setNewPermissionId("");
            }}
          >
            <button className="rounded-md bg-black px-2 py-1 text-xs text-white hover:bg-black/90">Agregar</button>
          </form>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {allPermissions.map((p) => {
            const fromAdmin = sources?.isAdmin ?? false;
            const fromRole = roleGrantSet.has(p.id);
            const fromOverride = overrideSet.has(p.id);
            const hasPerm = fromAdmin || fromOverride || fromRole;
            const hint = fromAdmin
              ? "vía admin de org."
              : fromOverride
                ? "directo"
                : fromRole
                  ? "vía rol"
                  : "no otorgado";
            return (
              <label key={p.id} className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs" title={hint}>
                <input
                  type="checkbox"
                  checked={hasPerm}
                  onChange={(e) => togglePermission(p.id, e.currentTarget.checked)}
                />
                <span className="font-mono">{p.key}</span>
              </label>
            );
          })}
        </div>
      </td>
    </tr>
  );
}


