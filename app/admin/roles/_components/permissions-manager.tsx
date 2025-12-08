"use client";

import { useRef } from "react";
import { toast } from "sonner";

export default function PermissionsManager({ permissions }: { permissions: { id: string; key: string; description: string | null }[] }) {
  const formRef = useRef<HTMLFormElement>(null);

  async function createPermission(formData: FormData) {
    const key = String(formData.get("key") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim() || null;

    if (!key) {
      toast.error("La clave del permiso es requerida");
      return;
    }

    const mod = await import("../server-actions");
    const result = await mod.createPermission({ key, description });

    if (result?.error) {
      toast.error(`Error al crear el permiso: ${result.error}`);
    } else {
      toast.success("Permiso creado exitosamente");
      formRef.current?.reset();
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Permisos</h2>
        <form ref={formRef} action={createPermission} className="flex items-center gap-2">
          <input name="key" placeholder="clave" className="w-48 rounded-md border bg-background px-2 py-1 text-sm" required />
          <input name="description" placeholder="descripción" className="w-64 rounded-md border bg-background px-2 py-1 text-sm" />
          <button type="submit" className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-black/90">Crear</button>
        </form>
      </div>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-foreground/5">
            <tr className="text-left">
              <th className="px-3 py-2">Clave</th>
              <th className="px-3 py-2">Descripción</th>
              <th className="px-3 py-2 w-24">Acciones</th>
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
                <td className="px-3 py-6 text-foreground/60" colSpan={3}>No hay permisos.</td>
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
    if (!confirm("¿Estás seguro de que querés eliminar este permiso?")) {
      return;
    }

    const mod = await import("../server-actions");
    const result = await mod.deletePermission({ permissionId });

    if (result?.error) {
      toast.error(`Error al eliminar el permiso: ${result.error}`);
    } else {
      toast.success("Permiso eliminado exitosamente");
    }
  }

  return (
    <form action={onDelete}>
      <button type="submit" className="rounded-md border px-2 py-1 text-xs hover:bg-foreground/10 hover:border-red-500 hover:text-red-600">
        Eliminar
      </button>
    </form>
  );
}


