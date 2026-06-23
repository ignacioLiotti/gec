"use client";

import { useEffect, useState, type FormEvent } from "react";

type MembershipRole = "owner" | "admin" | "member";
type UserRoleAssignment = { role_id: string };

function toMembershipRole(value: string): MembershipRole {
  return value === "owner" || value === "admin" || value === "member"
    ? value
    : "member";
}

export default function UserRow({
  row,
  tenantId,
  allRoles,
  allPermissions,
}: {
  row: { user_id: string; full_name: string | null; email: string | null; membership_role: string };
  tenantId: string;
  allRoles: { id: string; name: string }[];
  allPermissions: { id: string; key: string; description: string | null }[];
}) {
  const [assignedRoles, setAssignedRoles] = useState<UserRoleAssignment[]>([]);
  const [sources, setSources] = useState<{
    roleGrants: { roleId: string; permissionId: string }[];
    roleDenials: { roleId: string; permissionId: string }[];
    overrideIds: string[];
    deniedOverrideIds: string[];
    isAdmin: boolean;
  } | null>(null);
  const [selectedOrgRole, setSelectedOrgRole] = useState<MembershipRole>(
    toMembershipRole(row.membership_role),
  );
  const [newRoleId, setNewRoleId] = useState<string>("");
  const [newPermissionId, setNewPermissionId] = useState<string>("");
  const [impersonateError, setImpersonateError] = useState<string | null>(null);

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
    await mod.updateMembershipRole({ tenantId, userId: row.user_id, role: selectedOrgRole });
  }

  async function startImpersonation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setImpersonateError(null);

    const fd = new FormData();
    fd.set("user_id", row.user_id);
    const response = await fetch(new URL("/api/impersonate/start", window.location.origin), {
      method: "POST",
      body: fd,
      credentials: "same-origin",
      cache: "no-store",
    });

    if (!response.ok) {
      const payload = await response.json().catch(async () => ({
        error: await response.text().catch(() => ""),
      }));
      const message =
        typeof payload.error === "string" && payload.error.trim()
          ? payload.error
          : `No se pudo suplantar usuario (${response.status})`;
      setImpersonateError(message);
      console.error("[impersonate:start]", response.status, message);
      return;
    }

    location.reload();
  }

  const assignedRoleIds = new Set(assignedRoles.map((r) => r.role_id));
  const roleGrantSet = new Set((sources?.roleGrants ?? []).map((g) => g.permissionId));
  const roleDenySet = new Set((sources?.roleDenials ?? []).map((g) => g.permissionId));
  const overrideSet = new Set(sources?.overrideIds ?? []);
  const deniedOverrideSet = new Set(sources?.deniedOverrideIds ?? []);

  return (
    <tr className="border-t align-top">
      <td className="px-3 py-2">
        <div className="text-sm font-medium">{row.full_name ?? row.email ?? row.user_id}</div>
        <div className="text-xs text-foreground/60 font-mono">{row.email ?? row.user_id}</div>
        <form onSubmit={startImpersonation}>
          <button className="mt-2 rounded-md border px-2 py-1 text-xs hover:bg-foreground/10">Suplantar</button>
        </form>
        {impersonateError ? (
          <div className="mt-1 text-xs text-red-600">{impersonateError}</div>
        ) : null}
      </td>
      <td className="px-3 py-2">
        <form action={updateOrgRole} className="flex items-center gap-2">
          <select
            value={selectedOrgRole}
            onChange={(e) => setSelectedOrgRole(toMembershipRole(e.currentTarget.value))}
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
            <option value="">Agregar rol?</option>
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
            <option value="">Agregar permiso?</option>
            {allPermissions
              .filter((p) => {
                const fromAdmin = sources?.isAdmin ?? false;
                const fromRole = roleGrantSet.has(p.id) && !roleDenySet.has(p.id);
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
            const fromRoleDeny = roleDenySet.has(p.id);
            const fromOverride = overrideSet.has(p.id);
            const deniedOverride = deniedOverrideSet.has(p.id);
            const hasPerm =
              fromAdmin ||
              (!deniedOverride && (fromOverride || (fromRole && !fromRoleDeny)));
            const hint = deniedOverride && !fromAdmin
              ? "bloqueado directo"
              : fromAdmin
              ? "vía admin de org."
              : fromOverride
                ? "directo"
                : fromRoleDeny
                  ? "bloqueado via rol"
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


