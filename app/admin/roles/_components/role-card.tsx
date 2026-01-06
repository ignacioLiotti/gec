"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  MoreVertical,
  Pencil,
  Trash2,
  Users,
  Shield,
  ChevronRight,
} from "lucide-react";
import { deleteRole } from "../server-actions";
import { NavigationAccessBadges } from "./navigation-tree";
import type { Role } from "../permissions-actions";

type RoleCardProps = {
  role: Role;
  onEdit: (role: Role) => void;
  onViewUsers?: (role: Role) => void;
};

export function RoleCard({ role, onEdit, onViewUsers }: RoleCardProps) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      await deleteRole({ roleId: role.id });
      setIsDeleteOpen(false);
    });
  };

  return (
    <>
      <Card className="relative overflow-hidden group hover:shadow-md transition-shadow">
        {/* Color bar */}
        <div
          className="absolute top-0 left-0 w-1 h-full"
          style={{ backgroundColor: role.color || "#6366f1" }}
        />

        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{
                  backgroundColor: `${role.color || "#6366f1"}20`,
                }}
              >
                <Shield
                  className="h-5 w-5"
                  style={{ color: role.color || "#6366f1" }}
                />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  {role.name}
                  {role.is_default && (
                    <Badge variant="secondary" className="text-xs">
                      Default
                    </Badge>
                  )}
                </CardTitle>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(role)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                {onViewUsers && (
                  <DropdownMenuItem onClick={() => onViewUsers(role)}>
                    <Users className="h-4 w-4 mr-2" />
                    Ver Usuarios
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setIsDeleteOpen(true)}
                  className="text-red-600 dark:text-red-400"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {role.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {role.description}
            </p>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>{role.permission_count || 0} permisos</span>
            </div>
            <NavigationAccessBadges
              selectedPermissions={role.permissions || []}
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between"
            onClick={() => onEdit(role)}
          >
            Configurar permisos
            <ChevronRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Rol</AlertDialogTitle>
            <AlertDialogDescription>
              Estas seguro de que quieres eliminar el rol "{role.name}"? Esta
              accion no se puede deshacer y los usuarios asignados perderan
              estos permisos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={isPending}
            >
              {isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Compact list version
export function RoleListItem({
  role,
  onClick,
  selected,
}: {
  role: Role;
  onClick: () => void;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
        selected
          ? "border-primary bg-primary/5"
          : "border-transparent hover:bg-muted"
      }`}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: `${role.color || "#6366f1"}20`,
        }}
      >
        <Shield
          className="h-4 w-4"
          style={{ color: role.color || "#6366f1" }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{role.name}</div>
        <div className="text-xs text-muted-foreground">
          {role.permission_count || 0} permisos
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </button>
  );
}
