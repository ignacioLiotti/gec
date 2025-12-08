"use client";

import { useEffect, useMemo, useState } from "react";

type Permission = { id: string; key: string; description: string | null };

export default function RolePermissions({ roleId, allPermissions }: { roleId: string; allPermissions: Permission[] }) {
  const [assigned, setAssigned] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const mod = await import("../server-actions");
      const rps = await mod.listRolePermissions({ roleId });
      setAssigned(rps.map((rp: any) => rp.permission_id));
      setLoading(false);
    })();
  }, [roleId]);

  const assignedSet = useMemo(() => new Set(assigned), [assigned]);

  async function toggle(permissionId: string) {
    const mod = await import("../server-actions");
    if (assignedSet.has(permissionId)) {
      await mod.revokePermissionFromRole({ roleId, permissionId });
      setAssigned((prev) => prev.filter((id) => id !== permissionId));
    } else {
      await mod.grantPermissionToRole({ roleId, permissionId });
      setAssigned((prev) => [...prev, permissionId]);
    }
  }

  return (
    <div className="space-y-2">
      {loading && <div className="text-xs text-foreground/60">Loading permissions...</div>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {allPermissions.map((p) => (
          <label key={p.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={assignedSet.has(p.id)}
              onChange={() => toggle(p.id)}
            />
            <span className="font-mono">{p.key}</span>
            <span className="text-foreground/60">{p.description}</span>
          </label>
        ))}
      </div>
    </div>
  );
}


