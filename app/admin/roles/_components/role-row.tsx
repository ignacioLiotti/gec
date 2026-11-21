"use client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";


import { useState } from "react";

export default function RoleRow({ role }: { role: { id: string; name: string } }) {
  const [name, setName] = useState(role.name);

  async function onSave() {
    const mod = await import("../server-actions");
    await mod.updateRole({ roleId: role.id, name });
  }

  return (
    <tr className="border-t">
      <td className="px-3 py-2"><Input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-2 py-1 text-sm" /></td>
      <td className="px-3 py-2">
        <form action={onSave}>
          <Button variant="outline" className="px-2 py-1 text-xs">Save</Button>
        </form>
      </td>
    </tr>
  );
}
