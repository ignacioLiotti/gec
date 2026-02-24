"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import ImpersonateBanner from "@/app/admin/users/_components/impersonate-banner";
import { AppSidebar } from "@/components/app-sidebar";
import UserMenu from "@/components/auth/user-menu";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import type { Role } from "@/lib/route-access";

type SidebarMacroTable = {
  id: string;
  name: string;
  position: number;
};

type UserRolesShape = {
  roles: Role[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
  tenantId: string | null;
  roleIds?: string[];
} | null;

export function PathnameLayoutShell({
  children,
  user,
  userRoles,
  tenants,
  sidebarMacroTables,
}: {
  children: React.ReactNode;
  user?: { email?: string | null } | null;
  userRoles?: UserRolesShape;
  tenants?: { id: string; name: string | null }[];
  sidebarMacroTables?: SidebarMacroTable[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isMarketingRoot = pathname === "/";
  const normalizedUser = user ? { ...user, email: user.email ?? undefined } : null;

  useEffect(() => {
    if (isMarketingRoot && user?.email) {
      router.replace("/dashboard");
    }
  }, [isMarketingRoot, user?.email, router]);

  if (isMarketingRoot) {
    if (user?.email) {
      return null;
    }
    return <main>{children}</main>;
  }

  return (
    <SidebarProvider>
      <AppSidebar
        user={normalizedUser}
        userRoles={userRoles as any}
        tenants={tenants}
        sidebarMacroTables={sidebarMacroTables}
      />
      <SidebarInset>
        <header className="flex min-h-12 max-w-full shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <SidebarTrigger className="-ml-1" />
            <PageBreadcrumb />
          </div>
          <div className="flex w-full items-center justify-end gap-2 sm:ml-auto sm:w-auto">
            <ImpersonateBanner />
            <UserMenu email={normalizedUser?.email} userRoles={userRoles as any} />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
