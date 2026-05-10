"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { DocumentGenerationPermissionMap } from "@/lib/document-generation-server";
import { cn } from "@/lib/utils";

type DocumentNavItem = {
  href: string;
  label: string;
  show: boolean;
};

export function DocumentGenerationNav({
  permissions,
  className,
}: {
  permissions?: DocumentGenerationPermissionMap | null;
  className?: string;
}) {
  const pathname = usePathname();

  if (!pathname?.startsWith("/document-generation")) return null;

  const items: DocumentNavItem[] = [
    {
      href: "/document-generation",
      label: "Generar",
      show: Boolean(permissions?.canCreate),
    },
    {
      href: "/document-generation/drafts",
      label: "Borradores",
      show: Boolean(permissions?.canCreate || permissions?.canViewAllDrafts),
    },
    {
      href: "/document-generation/review",
      label: "Revision",
      show: Boolean(permissions?.canReview),
    },
    {
      href: "/document-generation/config",
      label: "Configuracion",
      show: Boolean(permissions?.canManageTemplates),
    },
  ].filter((item) => item.show);

  if (items.length === 0) return null;

  return (
    <nav className={cn("flex min-w-0 flex-wrap items-center gap-2", className)} aria-label="Navegacion de documentos">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium transition",
              active
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
