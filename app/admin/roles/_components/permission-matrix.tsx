"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Ban,
  Check,
  Crown,
  Database,
  Eye,
  FileCheck,
  FileText,
  Home,
  Layers,
  LockKeyhole,
  MousePointerClick,
  PanelLeft,
  Pencil,
  Route,
  RotateCcw,
  Search,
  Settings,
  Shield,
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

type PermissionAssignmentState = "inherit" | "grant" | "deny";

type PermissionMatrixProps = {
  permissionsByCategory: PermissionsByCategory[];
  selectedPermissions: string[];
  onChange: (permissions: string[]) => void;
  deniedPermissions?: string[];
  onDeniedChange?: (permissions: string[]) => void;
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

function getPermissionLevel(key: string): string | null {
  const parts = key.split(":");
  if (parts.length === 2) {
    const level = parts[1];
    if (["read", "edit", "admin"].includes(level)) {
      return level;
    }
  }
  return null;
}

function matchesPermission(permission: Permission, query: string) {
  if (!query) return true;
  const haystack = [
    permission.key,
    permission.display_name,
    permission.description,
    PERMISSION_LABEL_OVERRIDES[permission.key],
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function stateButtonClass(
  currentState: PermissionAssignmentState,
  option: PermissionAssignmentState,
) {
  if (currentState !== option) {
    return "bg-background text-muted-foreground hover:bg-muted";
  }
  if (option === "grant") {
    return "bg-emerald-600 text-white hover:bg-emerald-600";
  }
  if (option === "deny") {
    return "bg-red-600 text-white hover:bg-red-600";
  }
  return "bg-foreground text-background hover:bg-foreground";
}

export function PermissionMatrix({
  permissionsByCategory,
  selectedPermissions,
  onChange,
  deniedPermissions = [],
  onDeniedChange,
  disabled = false,
}: PermissionMatrixProps) {
  const visiblePermissionsByCategory = useMemo(
    () =>
      permissionsByCategory
        .map((category) => ({
          ...category,
          permissions: category.permissions.filter(
            (permission) => !UNSUPPORTED_PERMISSION_KEYS.has(permission.key),
          ),
        }))
        .filter((category) => category.permissions.length > 0),
    [permissionsByCategory],
  );
  const [activeCategory, setActiveCategory] = useState(
    visiblePermissionsByCategory[0]?.category ?? "",
  );
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const selected = useMemo(() => new Set(selectedPermissions), [selectedPermissions]);
  const denied = useMemo(() => new Set(deniedPermissions), [deniedPermissions]);
  const allPermissionKeys = useMemo(
    () => visiblePermissionsByCategory.flatMap((category) => category.permissions.map((p) => p.key)),
    [visiblePermissionsByCategory],
  );
  const activeCategoryKey =
    visiblePermissionsByCategory.some((category) => category.category === activeCategory)
      ? activeCategory
      : (visiblePermissionsByCategory[0]?.category ?? "");
  const displayedCategories = useMemo(() => {
    const searchable = normalizedQuery
      ? visiblePermissionsByCategory
      : visiblePermissionsByCategory.filter(
        (category) => category.category === activeCategoryKey,
      );

    return searchable
      .map((category) => ({
        ...category,
        permissions: category.permissions.filter((permission) =>
          matchesPermission(permission, normalizedQuery),
        ),
      }))
      .filter((category) => category.permissions.length > 0);
  }, [activeCategoryKey, normalizedQuery, visiblePermissionsByCategory]);
  const displayedPermissions = displayedCategories.flatMap(
    (category) => category.permissions,
  );

  const orderPermissionKeys = (keys: Set<string>) => {
    const ordered = allPermissionKeys.filter((key) => keys.has(key));
    const unknown = Array.from(keys).filter((key) => !allPermissionKeys.includes(key));
    return [...ordered, ...unknown];
  };

  const setPermissionState = (
    key: string,
    nextState: PermissionAssignmentState,
  ) => {
    if (disabled) return;

    const nextSelected = new Set(selected);
    const nextDenied = new Set(denied);
    nextSelected.delete(key);
    nextDenied.delete(key);

    if (nextState === "grant") {
      nextSelected.add(key);
    }
    if (nextState === "deny") {
      nextDenied.add(key);
    }

    onChange(orderPermissionKeys(nextSelected));
    onDeniedChange?.(orderPermissionKeys(nextDenied));
  };

  const setPermissionsState = (
    permissions: Permission[],
    nextState: PermissionAssignmentState,
  ) => {
    if (disabled) return;

    const nextSelected = new Set(selected);
    const nextDenied = new Set(denied);
    for (const permission of permissions) {
      nextSelected.delete(permission.key);
      nextDenied.delete(permission.key);
      if (nextState === "grant") {
        nextSelected.add(permission.key);
      }
      if (nextState === "deny") {
        nextDenied.add(permission.key);
      }
    }

    onChange(orderPermissionKeys(nextSelected));
    onDeniedChange?.(orderPermissionKeys(nextDenied));
  };

  const getPermissionState = (key: string): PermissionAssignmentState => {
    if (denied.has(key)) return "deny";
    if (selected.has(key)) return "grant";
    return "inherit";
  };

  const getCategoryCounts = (category: PermissionsByCategory) => {
    const grantCount = category.permissions.filter((p) => selected.has(p.key)).length;
    const denyCount = category.permissions.filter((p) => denied.has(p.key)).length;
    return {
      grantCount,
      denyCount,
      inheritedCount: category.permissions.length - grantCount - denyCount,
    };
  };

  const totalVisiblePermissionCount = allPermissionKeys.length;
  const totalGrantCount = allPermissionKeys.filter((key) => selected.has(key)).length;
  const totalDenyCount = allPermissionKeys.filter((key) => denied.has(key)).length;
  const totalInheritedCount =
    totalVisiblePermissionCount - totalGrantCount - totalDenyCount;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border bg-card p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <Check className="size-4" />
            Permitidos
          </div>
          <div className="mt-1 text-2xl font-semibold">{totalGrantCount}</div>
        </div>
        <div className="rounded-md border bg-card p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
            <Ban className="size-4" />
            Bloqueados
          </div>
          <div className="mt-1 text-2xl font-semibold">{totalDenyCount}</div>
        </div>
        <div className="rounded-md border bg-card p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <RotateCcw className="size-4" />
            Heredados
          </div>
          <div className="mt-1 text-2xl font-semibold">{totalInheritedCount}</div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-md border bg-card p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar permiso, pantalla o clave"
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {visiblePermissionsByCategory.map((category) => {
            const counts = getCategoryCounts(category);
            const isActive = category.category === activeCategoryKey && !normalizedQuery;
            return (
              <button
                key={category.category}
                type="button"
                onClick={() => {
                  setActiveCategory(category.category);
                  setQuery("");
                }}
                className={`flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${isActive ? "border-primary bg-primary/5" : "bg-background hover:bg-muted"
                  }`}
              >
                <span className="text-muted-foreground">
                  {CATEGORY_ICONS[category.category] || <Shield className="size-4" />}
                </span>
                <span className="font-medium">
                  {CATEGORY_LABELS[category.category] || category.category}
                </span>
                <span className="text-xs text-muted-foreground">
                  {counts.grantCount}/{counts.denyCount}/{category.permissions.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {displayedPermissions.length} permisos visibles
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPermissionsState(displayedPermissions, "inherit")}
            disabled={disabled || displayedPermissions.length === 0}
          >
            <RotateCcw className="mr-1 size-4" />
            Heredar visibles
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPermissionsState(displayedPermissions, "grant")}
            disabled={disabled || displayedPermissions.length === 0}
          >
            <Check className="mr-1 size-4" />
            Permitir visibles
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPermissionsState(displayedPermissions, "deny")}
            disabled={disabled || displayedPermissions.length === 0}
          >
            <Ban className="mr-1 size-4" />
            Bloquear visibles
          </Button>
        </div>
      </div>

      <div className="max-h-[360px] space-y-4 overflow-y-auto pr-1">
        {displayedCategories.map((category) => (
          <section key={category.category} className="space-y-2">
            {normalizedQuery && (
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="text-muted-foreground">
                  {CATEGORY_ICONS[category.category] || <Shield className="size-4" />}
                </span>
                {CATEGORY_LABELS[category.category] || category.category}
              </div>
            )}
            {category.permissions.map((permission) => {
              const level = getPermissionLevel(permission.key);
              const kind = getPermissionKind(permission);
              const enforcement = getPermissionEnforcement(permission);
              const help = getPermissionHelp(permission);
              const state = getPermissionState(permission.key);
              return (
                <div
                  key={permission.id}
                  className={`rounded-md border bg-background p-3 transition ${state === "grant"
                    ? "border-emerald-200"
                    : state === "deny"
                      ? "border-red-200"
                      : ""
                    }`}
                >
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
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
                      {permission.description && permission.description !== help.summary && (
                        <p className="text-xs text-muted-foreground">
                          Descripcion tecnica: {permission.description}
                        </p>
                      )}
                    </div>
                    <div className="grid shrink-0 grid-cols-3 overflow-hidden rounded-md border text-xs xl:w-[270px]">
                      {(["inherit", "grant", "deny"] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setPermissionState(permission.key, option)}
                          disabled={disabled}
                          className={`flex min-h-9 items-center justify-center gap-1 px-2 font-medium transition disabled:opacity-60 ${stateButtonClass(state, option)}`}
                        >
                          {option === "inherit" ? (
                            <RotateCcw className="size-3" />
                          ) : option === "grant" ? (
                            <Check className="size-3" />
                          ) : (
                            <Ban className="size-3" />
                          )}
                          <span>
                            {option === "inherit"
                              ? "Heredar"
                              : option === "grant"
                                ? "Permitir"
                                : "Bloquear"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        ))}
        {displayedCategories.length === 0 && (
          <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
            No hay permisos que coincidan con la busqueda.
          </div>
        )}
      </div>
    </div>
  );
}

// Compact version for display only (e.g., in role cards)
export function PermissionSummary({
  permissionsByCategory,
  selectedPermissions,
  deniedPermissions = [],
}: {
  permissionsByCategory: PermissionsByCategory[];
  selectedPermissions: string[];
  deniedPermissions?: string[];
}) {
  const selected = new Set(selectedPermissions);
  const denied = new Set(deniedPermissions);
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
        const deniedCount = categoryKeys.filter((key) => denied.has(key)).length;

        if (selectedCount === 0 && deniedCount === 0) return null;

        return (
          <Badge
            key={category.category}
            variant={deniedCount > 0 ? "outline" : "secondary"}
            className={deniedCount > 0 ? "border-red-200 text-red-700" : "text-xs"}
          >
            {CATEGORY_ICONS[category.category]}
            <span className="ml-1">
              {CATEGORY_LABELS[category.category] || category.category}
            </span>
            <span className="ml-1 opacity-70">
              +{selectedCount}
              {deniedCount > 0 ? ` / -${deniedCount}` : ""}
            </span>
          </Badge>
        );
      })}
    </div>
  );
}
