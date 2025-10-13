"use client";

import { useEffect, useMemo, useState } from "react";

type Permission = { id: string; key: string; description: string | null };

export default function UserOverrides({ userId, allPermissions }: { userId: string; allPermissions: Permission[] }) {
  const [overrides, setOverrides] = useState<{ permission_id: string; is_granted: boolean }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const mod = await import("../server-actions");
      const data = await mod.listUserOverrides({ userId });
      setOverrides(data);
      setLoading(false);
    })();
  }, [userId]);

  const map = useMemo(() => new Map(overrides.map((o) => [o.permission_id, o.is_granted])), [overrides]);

  async function toggle(permissionId: string) {
    const current = map.get(permissionId) ?? false;
    const mod = await import("../server-actions");
    await mod.setUserOverride({ userId, permissionId, isGranted: !current });
    setOverrides((prev) => {
      const next = new Map(prev.map((p) => [p.permission_id, p.is_granted]));
      next.set(permissionId, !current);
      return Array.from(next, ([permission_id, is_granted]) => ({ permission_id, is_granted }));
    });
  }

  return (
    <div className="space-y-2">
      {loading && <div className="text-xs text-foreground/60">Loading overrides...</div>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {allPermissions.map((p) => (
          <label key={p.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(map.get(p.id))}
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


