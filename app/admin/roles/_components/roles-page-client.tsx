"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagementNav } from "../../_components/user-management-nav";
import { Plus, Shield, Users } from "lucide-react";
import { RoleCard } from "./role-card";
import { RoleEditor } from "./role-editor";
import UserAssignments from "./user-assignments";
import type {
  Role,
  PermissionsByCategory,
  RoleTemplate,
  MacroTablePermission,
} from "../permissions-actions";

type RolesPageClientProps = {
  roles: Role[];
  permissionsByCategory: PermissionsByCategory[];
  templates: RoleTemplate[];
  macroPermissions: MacroTablePermission[];
  macroTables: { id: string; name: string }[];
  users: { user_id: string; full_name: string | null; email: string | null }[];
  tenantId: string;
};

export function RolesPageClient({
  roles,
  permissionsByCategory,
  users,
  tenantId,
}: RolesPageClientProps) {
  const router = useRouter();
  const { refresh } = router;
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const allPermissions = useMemo(
    () => permissionsByCategory.flatMap((category) => category.permissions),
    [permissionsByCategory],
  );

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setIsCreating(false);
    setIsEditorOpen(true);
  };

  const handleCreateRole = () => {
    setEditingRole(null);
    setIsCreating(true);
    setIsEditorOpen(true);
  };

  const handleSaved = () => {
    refresh();
  };

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Shield className="size-6" />
              Roles y Permisos
            </h1>
            <p className="text-muted-foreground mt-1">
              Gestiona los roles y permisos de tu organizacion
            </p>
          </div>
          <Button onClick={handleCreateRole}>
            <Plus className="size-4 mr-1" />
            Crear Rol
          </Button>
        </div>
        <UserManagementNav active="roles" />
      </header>

      {/* Main Content */}
      <Tabs defaultValue="roles" className="space-y-6">
        <TabsList>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Shield className="size-4" />
            Roles ({roles.length})
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="size-4" />
            Asignaciones
          </TabsTrigger>
        </TabsList>

        {/* Roles Tab */}
        <TabsContent value="roles">
          {roles.length === 0 ? (
            <div className="border rounded-lg p-12 text-center">
              <Shield className="size-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No hay roles configurados</h3>
              <p className="text-muted-foreground mb-4">
                Crea tu primer rol para comenzar a asignar permisos a los usuarios.
              </p>
              <div className="flex justify-center gap-2">
                <Button onClick={handleCreateRole}>
                  <Plus className="size-4 mr-1" />
                  Crear Rol
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {roles.map((role) => (
                <RoleCard
                  key={role.id}
                  role={role}
                  onEdit={handleEditRole}
                />
              ))}
            </div>
          )}
        </TabsContent>





        {/* User Assignments Tab */}
        <TabsContent value="users">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Asignaciones de Roles</h3>
              <p className="text-sm text-muted-foreground">
                Asigna roles a los usuarios de tu organizacion
              </p>
            </div>
            <UserAssignments
              users={users}
              tenantId={tenantId}
              allPermissions={allPermissions}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Role Editor Modal */}
      <RoleEditor
        key={isCreating ? "new-role" : editingRole?.id ?? "closed"}
        role={isCreating ? null : editingRole}
        permissionsByCategory={permissionsByCategory}
        tenantId={tenantId}
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        onSaved={handleSaved}
      />
    </div>
  );
}
