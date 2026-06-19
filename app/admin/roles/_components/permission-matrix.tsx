"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Home,
  Database,
  FileCheck,
  Layers,
  Settings,
  Shield,
  FileText,
  Eye,
  Pencil,
  Crown,
  Route,
  MousePointerClick,
  PanelLeft,
  LockKeyhole,
} from "lucide-react";

type Permission = {
  id: string;
  key: string;
  description: string | null;
  category: string;
  display_name: string | null;
  sort_order: number;
};

type PermissionsByCategory = {
  category: string;
  permissions: Permission[];
};

type PermissionMatrixProps = {
  permissionsByCategory: PermissionsByCategory[];
  selectedPermissions: string[];
  onChange: (permissions: string[]) => void;
  disabled?: boolean;
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  navigation: <Home className="size-4" />,
  obras: <Database className="size-4" />,
  certificados: <FileCheck className="size-4" />,
  macro: <Layers className="size-4" />,
  admin: <Settings className="size-4" />,
  documents: <FileText className="size-4" />,
  "data-flow": <Route className="size-4" />,
  general: <Shield className="size-4" />,
};

const CATEGORY_LABELS: Record<string, string> = {
  navigation: "Navegacion",
  obras: "Obras",
  certificados: "Certificados",
  macro: "Macro Tablas",
  documents: "Documentos",
  "data-flow": "Data-flow",
  admin: "Administracion",
  general: "General",
};

const LEVEL_ICONS: Record<string, React.ReactNode> = {
  read: <Eye className="size-3" />,
  edit: <Pencil className="size-3" />,
  admin: <Crown className="size-3" />,
};

type PermissionKind = "menu" | "page" | "action";
type EnforcementLevel = "ui" | "enforced";

const KIND_META: Record<
  PermissionKind,
  { label: string; icon: React.ReactNode; className: string }
> = {
  menu: {
    label: "Menu",
    icon: <PanelLeft className="size-3" />,
    className: "border-sky-200 bg-sky-50 text-sky-700",
  },
  page: {
    label: "Pantalla",
    icon: <Eye className="size-3" />,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  action: {
    label: "Accion/API",
    icon: <MousePointerClick className="size-3" />,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
};

const ENFORCEMENT_META: Record<
  EnforcementLevel,
  { label: string; className: string; description: string }
> = {
  ui: {
    label: "Solo UI",
    className: "border-sky-200 bg-sky-50 text-sky-700",
    description: "Cambia visibilidad en la interfaz. No protege endpoints por si solo.",
  },
  enforced: {
    label: "Validado",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    description: "La UI y/o el backend consultan este permiso antes de permitir la accion.",
  },
};

const ACTION_WORDS = new Set([
  "admin",
  "apply-suggestion",
  "auto-write",
  "create",
  "delete",
  "edit",
  "folder",
  "review",
  "templates",
  "tenant-edit",
]);

const PERMISSION_LABEL_OVERRIDES: Record<string, string> = {
  "admin:roles": "Administrar roles y permisos",
  "admin:users": "Administrar usuarios e invitaciones",
  "admin:audit": "Ver auditoria",
  "admin:obra-defaults": "Administrar configuracion de obras",
  "admin:main-table-config": "Administrar tabla principal",
  "data-flow:read": "Ver data-flow",
  "data-flow:edit": "Editar data-flow de obra",
  "data-flow:tenant-edit": "Editar defaults tenant de data-flow",
  "data-flow:apply-suggestion": "Aplicar sugerencias de data-flow",
  "data-flow:auto-write": "Permitir escritura automatica de data-flow",
  "documents:review": "Revisar documentos",
  "documents:templates": "Administrar plantillas documentales",
  "obras:read": "Ver obras",
  "obras:edit": "Editar datos de obras",
  "obras:admin": "Administrar obras",
  "obras:delete": "Borrar obras",
  "documents:delete:file": "Borrar archivos",
  "documents:delete:folder": "Borrar carpetas",
};

const UNSUPPORTED_PERMISSION_KEYS = new Set([
  "admin:settings",
  "obras:read",
  "obras:edit",
  "obras:admin",
  "certificados:read",
  "certificados:edit",
  "certificados:admin",
  "macro:read",
  "macro:edit",
  "macro:admin",
]);

function getPermissionKind(permission: Permission): PermissionKind {
  if (permission.key.startsWith("nav:")) return "menu";
  if (
    permission.category === "admin" ||
    permission.key.endsWith(":read") ||
    permission.key === "data-flow:read"
  ) {
    return "page";
  }
  return "action";
}

function getPermissionEnforcement(permission: Permission): EnforcementLevel {
  if (permission.key.startsWith("nav:")) return "ui";
  return "enforced";
}

function getPermissionHelp(permission: Permission) {
  if (permission.key.startsWith("nav:")) {
    return {
      summary: "Muestra esta entrada en la navegacion principal/sidebar.",
      boundary: "No autoriza por si solo acciones ni endpoints internos.",
    };
  }

  if (permission.key === "admin:roles") {
    return {
      summary: "Permite entrar y administrar la pantalla de Roles, Permisos y Usuarios.",
      boundary: "No convierte al usuario en owner/admin de la organizacion.",
    };
  }

  if (permission.key === "admin:users") {
    return {
      summary: "Permite entrar a gestion de usuarios e invitaciones.",
      boundary: "No otorga permisos sobre obras, documentos o datos.",
    };
  }

  if (permission.key === "admin:obra-defaults") {
    return {
      summary: "Permite ver y editar la configuracion tenant de obras.",
      boundary: "No convierte al usuario en admin global del tenant.",
    };
  }

  if (permission.key === "admin:main-table-config") {
    return {
      summary: "Permite ver y editar columnas/opciones de la tabla principal.",
      boundary: "No otorga acceso a gestionar roles, usuarios ni otros ajustes admin.",
    };
  }

  if (permission.key.includes(":delete")) {
    return {
      summary: "Autoriza una accion destructiva en API y UI.",
      boundary: "No otorga restauracion, purga permanente ni administracion completa.",
    };
  }

  const [, capability = ""] = permission.key.split(":");
  if (ACTION_WORDS.has(capability)) {
    return {
      summary: "Autoriza una accion concreta. La UI puede mostrar botones y el endpoint la valida.",
      boundary: "No implica visibilidad en el menu si falta el permiso nav correspondiente.",
    };
  }

  if (permission.key.endsWith(":read")) {
    return {
      summary: "Permite ver datos o entrar a una pantalla de esta funcionalidad.",
      boundary: "No permite crear, editar, borrar ni ejecutar acciones sensibles.",
    };
  }

  return {
    summary: permission.description || "Permiso funcional usado por esta seccion.",
    boundary: "Revisar junto con permisos de navegacion y acciones relacionadas.",
  };
}

function getPermissionDisplayName(permission: Permission) {
  const label = PERMISSION_LABEL_OVERRIDES[permission.key] || permission.display_name;
  if (permission.key.startsWith("nav:")) {
    return `Mostrar en menu: ${label || permission.key.replace("nav:", "")}`;
  }
  return label || permission.key;
}

export function PermissionMatrix({
  permissionsByCategory,
  selectedPermissions,
  onChange,
  disabled = false,
}: PermissionMatrixProps) {
  const selected = new Set(selectedPermissions);
  const visiblePermissionsByCategory = permissionsByCategory
    .map((category) => ({
      ...category,
      permissions: category.permissions.filter(
        (permission) => !UNSUPPORTED_PERMISSION_KEYS.has(permission.key),
      ),
    }))
    .filter((category) => category.permissions.length > 0);

  const togglePermission = (key: string) => {
    if (disabled) return;

    const newSelected = new Set(selected);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    onChange(Array.from(newSelected));
  };

  const toggleCategory = (category: PermissionsByCategory) => {
    if (disabled) return;

    const categoryKeys = category.permissions.map((p) => p.key);
    const allSelected = categoryKeys.every((key) => selected.has(key));

    const newSelected = new Set(selected);
    if (allSelected) {
      // Deselect all
      categoryKeys.forEach((key) => newSelected.delete(key));
    } else {
      // Select all
      categoryKeys.forEach((key) => newSelected.add(key));
    }
    onChange(Array.from(newSelected));
  };

  const getCategoryStatus = (category: PermissionsByCategory) => {
    const categoryKeys = category.permissions.map((p) => p.key);
    const selectedCount = categoryKeys.filter((key) => selected.has(key)).length;

    if (selectedCount === 0) return "none";
    if (selectedCount === categoryKeys.length) return "all";
    return "partial";
  };

  // Extract permission level from key (e.g., "obras:read" -> "read")
  const getPermissionLevel = (key: string): string | null => {
    const parts = key.split(":");
    if (parts.length === 2) {
      const level = parts[1];
      if (["read", "edit", "admin"].includes(level)) {
        return level;
      }
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {(["menu", "page", "action"] as PermissionKind[]).map((kind) => (
          <div key={kind} className="rounded-md border bg-card p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${KIND_META[kind].className}`}>
                {KIND_META[kind].icon}
                {KIND_META[kind].label}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {kind === "menu"
                ? "Solo decide si aparece en la navegacion/sidebar."
                : kind === "page"
                  ? "Permite ver una pantalla o leer datos."
                  : "Permite ejecutar botones o endpoints sensibles."}
            </p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {(["ui", "enforced"] as EnforcementLevel[]).map((level) => (
          <div key={level} className="rounded-md border bg-card p-3">
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${ENFORCEMENT_META[level].className}`}>
              {ENFORCEMENT_META[level].label}
            </span>
            <p className="mt-2 text-xs text-muted-foreground">
              {ENFORCEMENT_META[level].description}
            </p>
          </div>
        ))}
      </div>
      <Accordion type="multiple" className="w-full max-h-[700px] overflow-y-auto" defaultValue={visiblePermissionsByCategory.map(c => c.category)}>
        {visiblePermissionsByCategory.map((category) => {
          const status = getCategoryStatus(category);
          const selectedCount = category.permissions.filter((p) =>
            selected.has(p.key)
          ).length;

          return (
            <AccordionItem key={category.category} value={category.category}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCategory(category);
                    }}
                  >
                    <Checkbox
                      checked={status === "all"}
                      className={status === "partial" ? "opacity-50" : ""}
                      disabled={disabled}
                    />
                  </div>
                  <span className="text-muted-foreground">
                    {CATEGORY_ICONS[category.category] || <Shield className="size-4" />}
                  </span>
                  <span className="font-medium">
                    {CATEGORY_LABELS[category.category] || category.category}
                  </span>
                  <Badge variant="secondary" className="ml-auto mr-2">
                    {selectedCount}/{category.permissions.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pt-2">
                  {category.permissions.map((permission) => {
                    const level = getPermissionLevel(permission.key);
                    const kind = getPermissionKind(permission);
                    const enforcement = getPermissionEnforcement(permission);
                    const help = getPermissionHelp(permission);
                    return (
                      <div
                        key={permission.id}
                        className="rounded-md border bg-background p-3"
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id={permission.key}
                            checked={selected.has(permission.key)}
                            onCheckedChange={() => togglePermission(permission.key)}
                            disabled={disabled}
                            className="mt-1"
                          />
                          <Label
                            htmlFor={permission.key}
                            className="min-w-0 flex-1 cursor-pointer space-y-2"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              {level && (
                                <span className="text-muted-foreground">
                                  {LEVEL_ICONS[level]}
                                </span>
                              )}
                              <span className="font-medium">
                                {getPermissionDisplayName(permission)}
                              </span>
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${KIND_META[kind].className}`}>
                                {KIND_META[kind].icon}
                                {KIND_META[kind].label}
                              </span>
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${ENFORCEMENT_META[enforcement].className}`}>
                                {ENFORCEMENT_META[enforcement].label}
                              </span>
                              <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                {permission.key}
                              </code>
                            </div>
                            <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                              <div className="rounded bg-muted/50 p-2">
                                <span className="font-medium text-foreground">Habilita: </span>
                                {help.summary}
                              </div>
                              <div className="rounded bg-muted/50 p-2">
                                <LockKeyhole className="mr-1 inline size-3" />
                                <span className="font-medium text-foreground">No implica: </span>
                                {help.boundary}
                              </div>
                            </div>
                          </Label>
                        </div>
                        {permission.description && permission.description !== help.summary && (
                          <p className="mt-2 pl-8 text-xs text-muted-foreground">
                            Descripcion tecnica: {permission.description}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

// Compact version for display only (e.g., in role cards)
export function PermissionSummary({
  permissionsByCategory,
  selectedPermissions,
}: {
  permissionsByCategory: PermissionsByCategory[];
  selectedPermissions: string[];
}) {
  const selected = new Set(selectedPermissions);
  const visiblePermissionsByCategory = permissionsByCategory
    .map((category) => ({
      ...category,
      permissions: category.permissions.filter(
        (permission) => !UNSUPPORTED_PERMISSION_KEYS.has(permission.key),
      ),
    }))
    .filter((category) => category.permissions.length > 0);

  return (
    <div className="flex flex-wrap gap-1">
      {visiblePermissionsByCategory.map((category) => {
        const categoryKeys = category.permissions.map((p) => p.key);
        const selectedCount = categoryKeys.filter((key) => selected.has(key)).length;

        if (selectedCount === 0) return null;

        const status =
          selectedCount === categoryKeys.length ? "full" : "partial";

        return (
          <Badge
            key={category.category}
            variant={status === "full" ? "default" : "secondary"}
            className="text-xs"
          >
            {CATEGORY_ICONS[category.category]}
            <span className="ml-1">
              {CATEGORY_LABELS[category.category] || category.category}
            </span>
            {status === "partial" && (
              <span className="ml-1 opacity-60">
                ({selectedCount}/{categoryKeys.length})
              </span>
            )}
          </Badge>
        );
      })}
    </div>
  );
}
