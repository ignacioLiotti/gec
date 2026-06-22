"use client";

import { useEffect, useMemo, useState } from "react";

type Permission = { id: string; key: string; description: string | null };
type OverrideState = "inherit" | "grant" | "deny";

export default function UserOverrides({ userId, allPermissions }: { userId: string; allPermissions: Permission[] }) {
  const [overrides, setOverrides] = useState<{ permission_id: string; is_granted: boolean }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

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
  const sortedPermissions = useMemo(
    () => [...allPermissions].sort((left, right) => left.key.localeCompare(right.key)),
    [allPermissions],
  );

  async function setOverride(permissionId: string, state: OverrideState) {
    const mod = await import("../server-actions");
    setSaving(permissionId);
    try {
      if (state === "inherit") {
        await mod.removeUserOverride({ userId, permissionId });
        setOverrides((prev) => prev.filter((entry) => entry.permission_id !== permissionId));
        return;
      }

      const isGranted = state === "grant";
      await mod.setUserOverride({ userId, permissionId, isGranted });
      setOverrides((prev) => {
        const next = new Map(prev.map((p) => [p.permission_id, p.is_granted]));
        next.set(permissionId, isGranted);
        return Array.from(next, ([permission_id, is_granted]) => ({ permission_id, is_granted }));
      });
    } finally {
      setSaving(null);
    }
  }

  async function setAll(isGranted: boolean) {
    const mod = await import("../server-actions");
    setSaving(isGranted ? "all-grant" : "all-deny");
    try {
      await mod.setAllUserOverrides({ userId, isGranted });
      setOverrides(
        allPermissions.map((permission) => ({
          permission_id: permission.id,
          is_granted: isGranted,
        })),
      );
    } finally {
      setSaving(null);
    }
  }

  async function clearAll() {
    const mod = await import("../server-actions");
    setSaving("all-clear");
    try {
      await mod.clearUserOverrides({ userId });
      setOverrides([]);
    } finally {
      setSaving(null);
    }
  }

  function getState(permissionId: string): OverrideState {
    if (!map.has(permissionId)) return "inherit";
    return map.get(permissionId) ? "grant" : "deny";
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setAll(false)}
          disabled={Boolean(saving)}
          className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
        >
          Bloquear todos
        </button>
        <button
          type="button"
          onClick={() => setAll(true)}
          disabled={Boolean(saving)}
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
        >
          Permitir todos
        </button>
        <button
          type="button"
          onClick={clearAll}
          disabled={Boolean(saving)}
          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-foreground/5 disabled:opacity-60"
        >
          Heredar todos
        </button>
        {loading && <span className="text-xs text-foreground/60">Cargando...</span>}
      </div>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {sortedPermissions.map((permission) => {
          const state = getState(permission.id);
          const isSaving = saving === permission.id;
          return (
            <div key={permission.id} className="rounded-md border p-3 text-sm">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs font-medium">{permission.key}</div>
                  {permission.description ? (
                    <div className="mt-1 line-clamp-2 text-xs text-foreground/60">
                      {permission.description}
                    </div>
                  ) : null}
                </div>
                <div className="grid shrink-0 grid-cols-3 overflow-hidden rounded-md border text-xs">
                  {(["inherit", "grant", "deny"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setOverride(permission.id, option)}
                      disabled={isSaving || Boolean(saving && !isSaving)}
                      className={
                        "px-2 py-1 font-medium transition disabled:opacity-60 " +
                        (state === option
                          ? option === "grant"
                            ? "bg-emerald-600 text-white"
                            : option === "deny"
                              ? "bg-red-600 text-white"
                              : "bg-foreground text-background"
                          : "bg-background hover:bg-foreground/5")
                      }
                    >
                      {option === "inherit" ? "Heredar" : option === "grant" ? "Permitir" : "Bloquear"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


