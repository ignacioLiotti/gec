"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ExcelObraName } from "./excel-obra-name";

// Map URL segments to human-friendly labels
const SEGMENT_LABELS: Record<string, string> = {
  "": "Inicio",
  admin: "Administración",
  users: "Usuarios",
  roles: "Roles",
  macro: "Macro Tablas",
  excel: "Excel",
  certificados: "Certificados",
  notifications: "Notificaciones",
  profile: "Perfil",
  viewer: "Visor",
  dev: "Desarrollo",
  "notifications-playground": "Prueba de Notificaciones",
  "permissions-demo": "Demo de Permisos",
  test: "Prueba 1",
  test2: "Prueba 2",
};

function getSegmentLabel(segment: string, isLast: boolean): string {
  if (SEGMENT_LABELS[segment] !== undefined) {
    return SEGMENT_LABELS[segment];
  }

  // For dynamic or unknown last segments, show a generic label
  if (isLast && segment !== "reporte") {
    return "Detalle";
  }

  if (isLast && segment === "reporte") {
    return "Reporte";
  }

  // Fallback: capitalize the raw segment
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function PageBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = [];

  // Root / dashboard link
  crumbs.push({
    href: "/",
    label: SEGMENT_LABELS[""],
  });

  let accumulatedPath = "";
  segments.forEach((segment, index) => {
    accumulatedPath += `/${segment}`;
    const isLast = index === segments.length - 1;

    crumbs.push({
      href: accumulatedPath,
      label: getSegmentLabel(segment, isLast),
    });
  });

  if (!crumbs.length) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="hidden md:flex items-center text-md text-muted-foreground"
    >
      <ol className="flex items-center gap-1">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <li key={crumb.href} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
              )}

              {isLast ? (
                <>
                  <span className="font-medium text-foreground line-clamp-1 max-w-[220px]">
                    {crumb.label}
                  </span>
                  :
                  <ExcelObraName />
                </>

              ) : (
                <Link
                  href={crumb.href}
                  className="hover:text-foreground transition-colors underline-offset-4 hover:underline"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}












