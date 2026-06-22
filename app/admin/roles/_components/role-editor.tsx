"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Save, X } from "lucide-react";
import { PermissionMatrix } from "./permission-matrix";
import {
  createRoleWithPermissions,
  updateRoleWithPermissions,
  type Role,
  type PermissionsByCategory,
} from "../permissions-actions";

type RoleEditorProps = {
  role: Role | null; // null = create new
  permissionsByCategory: PermissionsByCategory[];
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};

export function RoleEditor({
  role,
  permissionsByCategory,
  tenantId,
  open,
  onOpenChange,
  onSaved,
}: RoleEditorProps) {
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [color, setColor] = useState(role?.color ?? "#6366f1");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
    role?.permissions ?? [],
  );
  const [deniedPermissions, setDeniedPermissions] = useState<string[]>(
    role?.denied_permissions ?? [],
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!name.trim()) {
      setError("Nombre es requerido");
      return;
    }

    startTransition(async () => {
      let result;

      if (role) {
        // Update existing
        result = await updateRoleWithPermissions({
          roleId: role.id,
          name: name.trim(),
          description: description.trim() || undefined,
          color,
          permissionKeys: selectedPermissions,
          deniedPermissionKeys: deniedPermissions,
        });
      } else {
        // Create new
        result = await createRoleWithPermissions({
          tenantId,
          name: name.trim(),
          description: description.trim() || undefined,
          color,
          permissionKeys: selectedPermissions,
          deniedPermissionKeys: deniedPermissions,
        });
      }

      if (result.error) {
        setError(result.error);
      } else {
        onOpenChange(false);
        onSaved?.();
      }
    });
  };

  const isNew = !role;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-6xl flex-col overflow-hidden p-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            {isNew ? "Crear Rol" : `Editar: ${role.name}`}
          </DialogTitle>
          <DialogDescription>
            {isNew
              ? "Crea un rol definiendo que ve en la navegacion, a que pantallas entra y que acciones puede ejecutar. Los permisos no soportados como candados reales no se muestran."
              : "Modifica la navegacion, pantallas y acciones/API habilitadas para este rol. Los permisos no soportados como candados reales no se muestran."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="grid gap-6 p-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-500 dark:bg-red-950 lg:col-span-2">
                {error}
              </div>
            )}

            <div className="space-y-4 rounded-md border bg-card p-4">
              <div>
                <h3 className="text-sm font-semibold">Identidad del rol</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Esto solo describe el rol. No cambia permisos hasta que marques capacidades a la derecha.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Rol</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Editor de Obras"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripcion (opcional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe el proposito de este rol..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Color del Rol</Label>
                <div className="flex gap-2">
                  {[
                    "#6366f1",
                    "#22c55e",
                    "#f97316",
                    "#8b5cf6",
                    "#06b6d4",
                    "#ec4899",
                    "#eab308",
                    "#ef4444",
                  ].map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 transition-all ${color === c
                        ? "border-foreground scale-110 ring-2 ring-offset-2 ring-offset-background"
                        : "border-transparent hover:scale-105"
                        }`}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="min-w-0">
              <PermissionMatrix
                permissionsByCategory={permissionsByCategory}
                selectedPermissions={selectedPermissions}
                onChange={setSelectedPermissions}
                deniedPermissions={deniedPermissions}
                onDeniedChange={setDeniedPermissions}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              {selectedPermissions.length} permitidos / {deniedPermissions.length} bloqueados
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                <X className="size-4 mr-1" />
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={isPending}>
                <Save className="size-4 mr-1" />
                {isPending ? "Guardando..." : isNew ? "Crear" : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
