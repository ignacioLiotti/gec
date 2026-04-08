"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
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

const DeferredAppSidebar = dynamic(
	() => import("@/components/app-sidebar").then((mod) => mod.AppSidebar),
	{
		loading: () => (
			<div className="hidden w-[var(--sidebar-width,16rem)] shrink-0 border-r bg-[#fafafa] xl:block" />
		),
	},
);

const DeferredUserMenu = dynamic(() => import("@/components/auth/user-menu"), {
	loading: () => (
		<div className="inline-flex h-9 min-w-32 items-center gap-2 rounded-md border px-2 py-1 text-sm">
			<div className="size-6 rounded-full bg-orange-primary/40" />
			<div className="h-4 w-20 animate-pulse rounded bg-[#ece7df]" />
		</div>
	),
});

const DeferredImpersonateBanner = dynamic(
	() => import("@/app/admin/users/_components/impersonate-banner"),
	{
		loading: () => null,
	},
);

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
	const isStandaloneDemoRoute = pathname?.startsWith("/demo/") ?? false;
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
		if (isStandaloneDemoRoute) return;
		if (isDemoPathAllowed(pathname, demoCapabilities)) return;
		router.replace(getDefaultDemoAppPath(demoCapabilities));
	}, [demoCapabilities, isDemoMode, isStandaloneDemoRoute, pathname, router]);

	if (isMarketingRoot || isStandaloneDemoRoute) {
		if (isMarketingRoot && user?.email) {
			return null;
		}
		return <main>{children}</main>;
	}

	return (
		<SidebarProvider>
			<DeferredAppSidebar
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
						<DeferredImpersonateBanner />
						<DeferredUserMenu
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
