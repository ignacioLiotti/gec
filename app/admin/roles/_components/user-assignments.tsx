"use client";

import { useEffect, useState } from "react";

export default function UserAssignments({ users, tenantId }: { users: { user_id: string; full_name: string | null }[]; tenantId: string }) {
  const [selectedUser, setSelectedUser] = useState<string | null>(users[0]?.user_id ?? null);
  const [roles, setRoles] = useState<any[]>([]);
  const [userRoles, setUserRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const mod = await import("../server-actions");
      const [r, ur] = await Promise.all([
        mod.listRoles({ tenantId }),
        selectedUser ? mod.listUserRoles({ userId: selectedUser }) : Promise.resolve([]),
      ]);
      setRoles(r);
      setUserRoles(ur);
      setLoading(false);
    })();
  }, [tenantId, selectedUser]);

  async function assign(roleId: string) {
    const mod = await import("../server-actions");
    await mod.assignUserRole({ userId: selectedUser!, roleId });
    setUserRoles(await mod.listUserRoles({ userId: selectedUser! }));
  }

  async function revoke(roleId: string) {
    const mod = await import("../server-actions");
    await mod.revokeUserRole({ userId: selectedUser!, roleId });
    setUserRoles(await mod.listUserRoles({ userId: selectedUser! }));
  }

  const assignedIds = new Set(userRoles.map((r) => r.role_id));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select value={selectedUser ?? ""} onChange={(e) => setSelectedUser(e.target.value)} className="rounded-md border bg-background px-2 py-1 text-sm">
          {users.map((u) => (
            <option key={u.user_id} value={u.user_id}>{u.full_name ?? u.user_id}</option>
          ))}
        </select>
        {loading && <span className="text-xs text-foreground/60">Loading...</span>}
      </div>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-foreground/5">
            <tr className="text-left">
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2 w-40">Action</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{r.name} <span className="font-mono text-xs text-foreground/60">({r.key})</span></td>
                <td className="px-3 py-2">
                  {assignedIds.has(r.id) ? (
                    <button onClick={() => revoke(r.id)} className="rounded-md border px-2 py-1 text-xs hover:bg-foreground/10">Revoke</button>
                  ) : (
                    <button onClick={() => assign(r.id)} className="rounded-md bg-black px-2 py-1 text-xs text-white hover:bg-black/90">Assign</button>
                  )}
                </td>
              </tr>
            ))}
            {roles.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-foreground/60" colSpan={2}>No roles found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


