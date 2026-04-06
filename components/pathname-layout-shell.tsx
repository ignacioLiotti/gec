"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import ImpersonateBanner from "@/app/admin/users/_components/impersonate-banner";
import { AppSidebar } from "@/components/app-sidebar";
import UserMenu from "@/components/auth/user-menu";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import {
	getDefaultDemoAppPath,
	isDemoPathAllowed,
	type DemoCapability,
} from "@/lib/demo-capabilities";
import type { Role } from "@/lib/route-access";
import { track } from "@vercel/analytics";
import { ExcelObraName } from "./excel-obra-name";

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
	actorType?: "user" | "demo";
} | null;

export function PathnameLayoutShell({
	children,
	user,
	userRoles,
	tenants,
	sidebarMacroTables,
	demoSession,
	demoCapabilities,
}: {
	children: React.ReactNode;
	user?: { email?: string | null } | null;
	userRoles?: UserRolesShape;
	tenants?: { id: string; name: string | null }[];
	sidebarMacroTables?: SidebarMacroTable[];
	demoSession?: { label?: string | null; tenantName?: string | null } | null;
	demoCapabilities?: DemoCapability[];
}) {
	const pathname = usePathname();
	const router = useRouter();
	const isMarketingRoot = pathname === "/";
	const isDemoMode = userRoles?.actorType === "demo";
	const normalizedUser = user
		? { ...user, email: user.email ?? undefined }
		: null;

	useEffect(() => {
		if (isMarketingRoot && user?.email) {
			router.replace("/dashboard");
		}
	}, [isMarketingRoot, user?.email, router]);

	useEffect(() => {
		if (!pathname || pathname === "/") return;
		track("app_page_view", {
			path: pathname,
			section: "app",
		});
	}, [pathname]);

	useEffect(() => {
		if (!isDemoMode || !pathname) return;
		if (isDemoPathAllowed(pathname, demoCapabilities)) return;
		router.replace(getDefaultDemoAppPath(demoCapabilities));
	}, [demoCapabilities, isDemoMode, pathname, router]);

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
					userRoles={userRoles}
					tenants={tenants}
					sidebarMacroTables={sidebarMacroTables}
					demoMode={isDemoMode}
					demoLabel={demoSession?.label ?? demoSession?.tenantName ?? null}
					demoCapabilities={demoCapabilities}
				/>
			<SidebarInset>
				<header className="flex min-h-12 max-w-full shrink-0 flex-wrap items-center gap-2 border-b bg-[#fafafa] px-3 py-2 sm:px-4">
					<div className="flex min-w-0 flex-1 items-center gap-3">
						<SidebarTrigger className="-ml-1 block sm:hidden" />
						<ExcelObraName />
					</div>
					<div className="flex w-full items-center justify-end gap-2 sm:ml-auto sm:w-auto">
						<ImpersonateBanner />
						<UserMenu
							email={normalizedUser?.email}
							demoMode={isDemoMode}
							demoLabel={demoSession?.label ?? demoSession?.tenantName ?? null}
							userRoles={userRoles ?? undefined}
						/>
					</div>
				</header>
				<main className="flex flex-1 flex-col gap-4 bg-[#fafafa]">
					{children}
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
