"use client";

import { useState, useEffect } from "react";
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
  Bell,
  Settings,
  Users,
  Shield,
  FileText,
  Eye,
  Pencil,
  Crown,
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
  navigation: <Home className="h-4 w-4" />,
  obras: <Database className="h-4 w-4" />,
  certificados: <FileCheck className="h-4 w-4" />,
  macro: <Layers className="h-4 w-4" />,
  admin: <Settings className="h-4 w-4" />,
  general: <Shield className="h-4 w-4" />,
};

const CATEGORY_LABELS: Record<string, string> = {
  navigation: "Navegacion",
  obras: "Obras",
  certificados: "Certificados",
  macro: "Macro Tablas",
  admin: "Administracion",
  general: "General",
};

const LEVEL_ICONS: Record<string, React.ReactNode> = {
  read: <Eye className="h-3 w-3" />,
  edit: <Pencil className="h-3 w-3" />,
  admin: <Crown className="h-3 w-3" />,
};

export function PermissionMatrix({
  permissionsByCategory,
  selectedPermissions,
  onChange,
  disabled = false,
}: PermissionMatrixProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(selectedPermissions)
  );

  useEffect(() => {
    setSelected(new Set(selectedPermissions));
  }, [selectedPermissions]);

  const togglePermission = (key: string) => {
    if (disabled) return;

    const newSelected = new Set(selected);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelected(newSelected);
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
    setSelected(newSelected);
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
    <div className="space-y-2">
      <Accordion type="multiple" className="w-full" defaultValue={permissionsByCategory.map(c => c.category)}>
        {permissionsByCategory.map((category) => {
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
                    {CATEGORY_ICONS[category.category] || <Shield className="h-4 w-4" />}
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
                <div className="pl-10 space-y-2 pt-2">
                  {category.permissions.map((permission) => {
                    const level = getPermissionLevel(permission.key);
                    return (
                      <div
                        key={permission.id}
                        className="flex items-center gap-3"
                      >
                        <Checkbox
                          id={permission.key}
                          checked={selected.has(permission.key)}
                          onCheckedChange={() => togglePermission(permission.key)}
                          disabled={disabled}
                        />
                        <Label
                          htmlFor={permission.key}
                          className="flex items-center gap-2 cursor-pointer flex-1"
                        >
                          {level && (
                            <span className="text-muted-foreground">
                              {LEVEL_ICONS[level]}
                            </span>
                          )}
                          <span>
                            {permission.display_name || permission.key}
                          </span>
                          {permission.description && (
                            <span className="text-xs text-muted-foreground ml-2">
                              {permission.description}
                            </span>
                          )}
                        </Label>
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

  return (
    <div className="flex flex-wrap gap-1">
      {permissionsByCategory.map((category) => {
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
