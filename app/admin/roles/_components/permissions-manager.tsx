"use client";

export default function PermissionsManager({ permissions }: { permissions: { id: string; key: string; description: string | null }[] }) {
  async function createPermission(formData: FormData) {
    const key = String(formData.get("key") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim() || null;
    if (!key) return;
    const mod = await import("../server-actions");
    await mod.createPermission({ key, description });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Permissions</h2>
        <form action={createPermission} className="flex items-center gap-2">
          <input name="key" placeholder="key" className="w-48 rounded-md border bg-background px-2 py-1 text-sm" />
          <input name="description" placeholder="description" className="w-64 rounded-md border bg-background px-2 py-1 text-sm" />
          <button className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-black/90">Create</button>
        </form>
      </div>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-foreground/5">
            <tr className="text-left">
              <th className="px-3 py-2">Key</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2 w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {permissions.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2 font-mono">{p.key}</td>
                <td className="px-3 py-2">{p.description}</td>
                <td className="px-3 py-2">
                  <DeleteButton permissionId={p.id} />
                </td>
              </tr>
            ))}
            {permissions.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-foreground/60" colSpan={3}>No permissions.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DeleteButton({ permissionId }: { permissionId: string }) {
  async function onDelete() {
    const mod = await import("../server-actions");
    await mod.deletePermission({ permissionId });
  }
  return (
    <form action={onDelete}>
      <button className="rounded-md border px-2 py-1 text-xs hover:bg-foreground/10">Delete</button>
    </form>
  );
}


