"use client";

import { useState } from "react";

export default function RoleRow({ role }: { role: { id: string; name: string } }) {
  const [name, setName] = useState(role.name);

  async function onSave() {
    const mod = await import("../server-actions");
    await mod.updateRole({ roleId: role.id, name });
  }

  return (
    <tr className="border-t">
      <td className="px-3 py-2"><input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1 text-sm" /></td>
      <td className="px-3 py-2">
        <form action={onSave}>
          <button className="rounded-md border px-2 py-1 text-xs hover:bg-foreground/10">Save</button>
        </form>
      </td>
    </tr>
  );
}
