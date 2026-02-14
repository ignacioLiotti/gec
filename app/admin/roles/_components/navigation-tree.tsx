"use client";

import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Home,
  Database,
  FileCheck,
  Layers,
  Bell,
  Settings,
  Users,
  Shield,
  FileText,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

type NavigationItem = {
  path: string;
  label: string;
  permission: string;
  icon?: string;
  children?: NavigationItem[];
};

// Navigation structure matching the sidebar
const NAVIGATION_STRUCTURE: NavigationItem[] = [
  { path: "/", label: "Dashboard", permission: "nav:dashboard", icon: "Home" },
  { path: "/excel", label: "Excel/Obras", permission: "nav:excel", icon: "Database" },
  { path: "/certificados", label: "Certificados", permission: "nav:certificados", icon: "FileCheck" },
  { path: "/macro", label: "Macro Tablas", permission: "nav:macro", icon: "Layers" },
  { path: "/notifications", label: "Notificaciones", permission: "nav:notifications", icon: "Bell" },
  {
    path: "/admin",
    label: "Administracion",
    permission: "nav:admin",
    icon: "Settings",
    children: [
      { path: "/admin/users", label: "Usuarios", permission: "admin:users" },
      { path: "/admin/roles", label: "Roles y Permisos", permission: "admin:roles" },
      { path: "/admin/main-table-config", label: "Tabla Principal", permission: "admin:roles" },
      { path: "/admin/audit-log", label: "Auditoria", permission: "admin:audit" },
    ],
  },
];

const ICONS: Record<string, React.ReactNode> = {
  Home: <Home className="h-4 w-4" />,
  Database: <Database className="h-4 w-4" />,
  FileCheck: <FileCheck className="h-4 w-4" />,
  Layers: <Layers className="h-4 w-4" />,
  Bell: <Bell className="h-4 w-4" />,
  Settings: <Settings className="h-4 w-4" />,
  Users: <Users className="h-4 w-4" />,
  Shield: <Shield className="h-4 w-4" />,
  FileText: <FileText className="h-4 w-4" />,
};

type NavigationTreeProps = {
  selectedPermissions: string[];
  onChange?: (permissions: string[]) => void;
  readOnly?: boolean;
};

export function NavigationTree({
  selectedPermissions,
  onChange,
  readOnly = false,
}: NavigationTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["/admin"]));
  const [selected, setSelected] = useState<Set<string>>(
    new Set(selectedPermissions)
  );

  useEffect(() => {
    setSelected(new Set(selectedPermissions));
  }, [selectedPermissions]);

  const toggleExpanded = (path: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpanded(newExpanded);
  };

  const togglePermission = (permission: string, item: NavigationItem) => {
    if (readOnly || !onChange) return;

    const newSelected = new Set(selected);

    if (newSelected.has(permission)) {
      // Deselect this and all children
      newSelected.delete(permission);
      if (item.children) {
        item.children.forEach((child) => {
          newSelected.delete(child.permission);
        });
      }
    } else {
      // Select this
      newSelected.add(permission);
    }

    setSelected(newSelected);
    onChange(Array.from(newSelected));
  };

  const renderItem = (item: NavigationItem, depth: number = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expanded.has(item.path);
    const hasAccess = selected.has(item.permission);

    // Check if all children have access (for parent display)
    const childrenWithAccess = hasChildren
      ? item.children!.filter((c) => selected.has(c.permission)).length
      : 0;
    const allChildrenHaveAccess =
      hasChildren && childrenWithAccess === item.children!.length;

    return (
      <div key={item.path}>
        <div
          className={cn(
            "flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors",
            hasAccess
              ? "bg-primary/10 text-foreground"
              : "text-muted-foreground",
            !readOnly && "hover:bg-muted cursor-pointer"
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(item.path);
              }}
              className="p-0.5 hover:bg-muted-foreground/20 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          ) : (
            <div className="w-4" />
          )}

          <Checkbox
            checked={hasAccess}
            onCheckedChange={() => togglePermission(item.permission, item)}
            disabled={readOnly}
            className={cn(!hasAccess && "opacity-50")}
          />

          <div
            className="flex items-center gap-2 flex-1"
            onClick={() => {
              if (!readOnly) {
                togglePermission(item.permission, item);
              }
            }}
          >
            {item.icon && ICONS[item.icon] && (
              <span className={cn(!hasAccess && "opacity-50")}>
                {ICONS[item.icon]}
              </span>
            )}
            <span className={cn("text-sm", !hasAccess && "opacity-50")}>
              {item.label}
            </span>
          </div>

          {hasChildren && hasAccess && (
            <span className="text-xs text-muted-foreground">
              {childrenWithAccess}/{item.children!.length}
            </span>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-0.5">
            {item.children!.map((child) => renderItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="border rounded-lg p-3 bg-card">
      <div className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
        <Shield className="h-3 w-3" />
        Vista previa de navegacion
      </div>
      <div className="space-y-0.5">
        {NAVIGATION_STRUCTURE.map((item) => renderItem(item))}
      </div>
    </div>
  );
}

// Compact badge version showing accessible navigation
export function NavigationAccessBadges({
  selectedPermissions,
}: {
  selectedPermissions: string[];
}) {
  const selected = new Set(selectedPermissions);

  const getAccessibleItems = (items: NavigationItem[]): string[] => {
    const accessible: string[] = [];
    for (const item of items) {
      if (selected.has(item.permission)) {
        accessible.push(item.label);
      }
    }
    return accessible;
  };

  const accessibleItems = getAccessibleItems(NAVIGATION_STRUCTURE);

  if (accessibleItems.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        Sin acceso a navegacion
      </span>
    );
  }

  if (accessibleItems.length === NAVIGATION_STRUCTURE.length) {
    return (
      <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
        <Shield className="h-3 w-3" />
        Acceso completo
      </span>
    );
  }

  return (
    <span className="text-xs text-muted-foreground">
      {accessibleItems.slice(0, 3).join(", ")}
      {accessibleItems.length > 3 && ` +${accessibleItems.length - 3} mas`}
    </span>
  );
}
