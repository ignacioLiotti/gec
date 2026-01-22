"use client";

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Layout, Save, X } from "lucide-react";
import { PermissionMatrix } from "./permission-matrix";
import { NavigationTree } from "./navigation-tree";
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
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Initialize form when role changes
  useEffect(() => {
    if (role) {
      setName(role.name);
      setDescription(role.description || "");
      setColor(role.color || "#6366f1");
      setSelectedPermissions(role.permissions || []);
    } else {
      setName("");
      setDescription("");
      setColor("#6366f1");
      setSelectedPermissions([]);
    }
    setError(null);
  }, [role, open]);

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
        });
      } else {
        // Create new
        result = await createRoleWithPermissions({
          tenantId,
          name: name.trim(),
          description: description.trim() || undefined,
          color,
          permissionKeys: selectedPermissions,
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full flex flex-col px-4">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {isNew ? "Crear Rol" : `Editar: ${role.name}`}
          </SheetTitle>
          <SheetDescription>
            {isNew
              ? "Crea un nuevo rol con permisos personalizados"
              : "Modifica los permisos y configuracion del rol"}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {error && (
              <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Basic Info */}
            <div className="space-y-4">
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

            {/* Permissions */}
            <div className="space-y-4 max-h-[45vh] overflow-y-auto">
              <Tabs defaultValue="matrix">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="matrix" className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Permisos
                  </TabsTrigger>
                  <TabsTrigger value="navigation" className="flex items-center gap-2">
                    <Layout className="h-4 w-4" />
                    Navegacion
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="matrix" className="mt-4 ">
                  <PermissionMatrix
                    permissionsByCategory={permissionsByCategory}
                    selectedPermissions={selectedPermissions}
                    onChange={setSelectedPermissions}
                  />
                </TabsContent>

                <TabsContent value="navigation" className="mt-4 ">
                  <NavigationTree
                    selectedPermissions={selectedPermissions}
                    onChange={setSelectedPermissions}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="pt-4 border-t">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              {selectedPermissions.length} permisos seleccionados
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={isPending}>
                <Save className="h-4 w-4 mr-1" />
                {isPending ? "Guardando..." : isNew ? "Crear" : "Guardar"}
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
