"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { DocumentGenerationPermissionMap } from "@/lib/document-generation-server";
import { cn } from "@/lib/utils";
import { ExcelObraName } from "./excel-obra-name";

type Props = {
  documentPermissions?: DocumentGenerationPermissionMap | null;
};

type NavItem = {
  href: string;
  label: string;
  show: boolean;
};

export function AppHeaderTitle({ documentPermissions }: Props) {
  const pathname = usePathname();

  if (!pathname.startsWith("/document-generation")) {
    return <ExcelObraName />;
  }

  const permissions = documentPermissions;
  const items: NavItem[] = [
    { href: "/document-generation", label: "Generar", show: Boolean(permissions?.canCreate) },
    {
      href: "/document-generation/drafts",
      label: "Historial",
      show: Boolean(permissions?.canCreate),
    },
    { href: "/document-generation/review", label: "Revision", show: Boolean(permissions?.canReview) },
    {
      href: "/document-generation/config",
      label: "Configuracion",
      show: Boolean(permissions?.canManageTemplates),
    },
  ];

  const visibleItems = items.filter((item) => item.show);

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
      <span className="shrink-0 text-lg font-semibold text-stone-950 sm:text-xl">
        Documentos
      </span>
      {visibleItems.length > 0 ? (
        <nav className="flex min-w-0 flex-wrap items-center gap-2">
          {visibleItems.map((item) => {
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
      ) : null}
    </div>
  );
}
