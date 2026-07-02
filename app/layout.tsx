import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import "@xyflow/react/dist/style.css";
import "react-grid-layout/css/styles.css";
import SupabaseAuthListener from "@/components/auth/auth-listener";
import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import AuthController from "@/components/auth/auth-controller";
import AuthGate from "@/components/auth/auth-gate";
import { QueryClientProvider } from "@/lib/query-client-provider";
import NotificationsListener from "@/components/notifications/notifications-listener";
import { Toaster } from "sonner";
import type { MembershipLike } from "@/lib/tenant-selection";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import DomainMigrationGuard from "@/components/domain-migration-guard";
import { LazyMotionProvider } from "@/components/motion/lazy-motion-provider";
import { PathnameLayoutShell } from "@/components/pathname-layout-shell";
import { resolveRequestAccessContext } from "@/lib/demo-session";
import {
	documentPermissionsFromPermissionSimulation,
	type PermissionOption,
	type PermissionSimulation,
} from "@/lib/permission-simulation";
import { isSuperAdminUser } from "@/lib/superadmin";
import type { Role } from "@/lib/route-access";
import {
	getUserDeniedPermissionKeys,
	getUserPermissionKeys,
} from "@/lib/route-guard";
import { loadDocumentGenerationPermissions } from "@/lib/document-generation-server";
import { ReactScanLoader } from "@/components/react-scan-loader";

const DEBUG_AUTH = process.env.DEBUG_AUTH === "true";
const ENABLE_REACT_SCAN =
	process.env.NODE_ENV === "development" &&
	process.env.NEXT_PUBLIC_ENABLE_REACT_SCAN !== "false";
const ENABLE_VERCEL_CLIENT_TELEMETRY = process.env.NODE_ENV === "production";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

const playfairDisplay = Playfair_Display({
	variable: "--font-geist-serif",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: {
		default: "Sintesis | Digitalizacion y Control de Obras",
		template: "%s | Sintesis",
	},
	description:
		"Centraliza documentos, automatiza extraccion de datos y monitorea el avance de tus obras en una sola plataforma.",
	icons: {
		icon: process.env.NODE_ENV === "development" ? "/icon" : "/favicon.ico",
	},
};

type LayoutUserRoles = {
	roles: Role[];
	roleIds: string[];
	isAdmin: boolean;
	isSuperAdmin: boolean;
	tenantId: string | null;
	actorType?: "user" | "demo";
	permissionKeys: string[];
	actualIsSuperAdmin?: boolean;
	permissionSimulation?: PermissionSimulation | null;
	deniedPermissionKeys: string[];
};

const EMPTY_DOCUMENT_PERMISSIONS = {
	canSeeNavigation: false,
	canCreate: false,
	canReview: false,
	canManageTemplates: false,
	canViewAllDrafts: false,
};
const FULL_DOCUMENT_PERMISSIONS = {
	canSeeNavigation: true,
	canCreate: true,
	canReview: true,
	canManageTemplates: true,
	canViewAllDrafts: false,
};

function warnSupabaseError(
	context: string,
	error: { code?: string; message?: string } | unknown,
) {
	if (error && typeof error === "object" && ("code" in error || "message" in error)) {
		const typedError = error as { code?: string; message?: string };
		console.warn(context, {
			code: typedError.code,
			message: typedError.message,
		});
		return;
	}
	console.warn(context, error);
}

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	if (DEBUG_AUTH) {
		console.log("[LAYOUT] RootLayout rendering...");
	}

	const supabase = await createClient();
	const access = await resolveRequestAccessContext();
	const user = access.user;

	if (DEBUG_AUTH) {
		console.log("[LAYOUT] access result:", {
			actorType: access.actorType,
			hasUser: !!user,
			email: user?.email,
			tenantId: access.tenantId,
		});
	}

	let userRoles: LayoutUserRoles = {
		roles: [],
		roleIds: [],
		isAdmin: false,
		isSuperAdmin: false,
		tenantId: null,
		permissionKeys: [],
		deniedPermissionKeys: [],
	};
	let tenants: { id: string; name: string }[] = [];
	let documentPermissions = EMPTY_DOCUMENT_PERMISSIONS;
	let permissionOptions: PermissionOption[] = [];

	if (user) {
		type MembershipRow = MembershipLike & {
			tenants?: { name: string | null } | { name: string | null }[] | null;
		};
		const getTenantName = (membership: MembershipRow) =>
			Array.isArray(membership.tenants)
				? (membership.tenants[0]?.name ?? null)
				: (membership.tenants?.name ?? null);

		const memberships = access.memberships as MembershipRow[];
		const actualIsSuperAdmin =
			access.actualIsSuperAdmin || isSuperAdminUser(user.id, null, user.email);
		const permissionSimulation = access.permissionSimulation;
		const isSimulatingPermissions = Boolean(permissionSimulation);
		const isSuperAdmin = isSimulatingPermissions
			? false
			: (access.isSuperAdmin || actualIsSuperAdmin);
		const tenantId = access.tenantId;
		const membershipRole = access.membershipRole;
		const isAdmin =
			membershipRole === "owner" || membershipRole === "admin" || isSuperAdmin;
		const roles: Role[] = [];
		const roleIds: string[] = [];

		if (isAdmin || isSuperAdmin) {
			roles.push("admin");
		}

		if (tenantId && !isAdmin && !isSuperAdmin && !isSimulatingPermissions) {
			try {
				const { data: userRoleIds, error: userRoleIdsError } = await supabase
					.from("user_roles")
					.select("role_id")
					.eq("user_id", user.id);

				if (userRoleIdsError?.code === "54001") {
					console.warn(
						"Stack depth limit exceeded in layout user_roles query; skipping custom roles",
					);
				} else if (userRoleIdsError) {
					warnSupabaseError(
						"[layout] could not fetch user role IDs; continuing without custom roles",
						userRoleIdsError,
					);
				} else if (userRoleIds && userRoleIds.length > 0) {
					const fetchedRoleIds = userRoleIds.map(
						(row: { role_id: string }) => row.role_id,
					);
					const { data: roleDetails, error: roleDetailsError } =
						await supabase
							.from("roles")
							.select("id, name, tenant_id")
							.in("id", fetchedRoleIds)
							.eq("tenant_id", tenantId);

					if (roleDetailsError) {
						warnSupabaseError(
							"[layout] could not fetch role details; continuing without custom roles",
							roleDetailsError,
						);
					} else if (roleDetails) {
						for (const role of roleDetails as {
							id: string;
							name: string;
						}[]) {
							if (role.id && !roleIds.includes(role.id)) {
								roleIds.push(role.id);
							}
							if (role.name && !roles.includes(role.name)) {
								roles.push(role.name);
							}
						}
					}
				}
			} catch (error) {
				warnSupabaseError(
					"[layout] unexpected error fetching user roles; continuing without custom roles",
					error,
				);
			}
		}

		if (actualIsSuperAdmin) {
			const { data: permissions } = await supabase
				.from("permissions")
				.select("key, display_name, category")
				.order("category", { ascending: true })
				.order("sort_order", { ascending: true });
			permissionOptions = (permissions ?? []).map((permission) => ({
				key: permission.key,
				displayName: permission.display_name ?? permission.key,
				category: permission.category ?? null,
			}));
		}

		const [permissionKeys, deniedPermissionKeys] = permissionSimulation
			? [permissionSimulation.permissionKeys, []]
			: tenantId
				? await Promise.all([
						getUserPermissionKeys(),
						getUserDeniedPermissionKeys(),
					])
				: [[], []];

		userRoles = {
			roles,
			roleIds,
			isAdmin,
			isSuperAdmin,
			tenantId,
			actorType: "user",
			permissionKeys,
			deniedPermissionKeys,
			actualIsSuperAdmin,
			permissionSimulation,
		};

		if (tenantId && user.id) {
			documentPermissions = permissionSimulation
				? documentPermissionsFromPermissionSimulation(permissionSimulation)
				: isAdmin || isSuperAdmin
					? FULL_DOCUMENT_PERMISSIONS
					: await loadDocumentGenerationPermissions({
							supabase,
							tenantId,
							userId: user.id,
						});
		}

		const showAllOrgs = isSuperAdmin;

		if (showAllOrgs) {
			const admin = createSupabaseAdminClient();
			const { data: allTenants } = await admin
				.from("tenants")
				.select("id, name")
				.order("name");

			tenants = (allTenants ?? []).map((tenant) => ({
				id: tenant.id,
				name: tenant.name ?? "Organizacion",
			}));

			if (DEBUG_AUTH) {
				console.log("[LAYOUT] allTenants", allTenants);
			}
		} else {
			tenants = memberships
				.map((membership) => ({
					id: membership.tenant_id ?? "",
					name: getTenantName(membership) ?? "Organizacion",
				}))
				.filter((tenant) => tenant.id.length > 0);
		}
	} else if (access.actorType === "demo" && access.tenantId) {
		userRoles = {
			roles: [],
			roleIds: [],
			isAdmin: false,
			isSuperAdmin: false,
			tenantId: access.tenantId,
			actorType: "demo",
			permissionKeys: [],
			deniedPermissionKeys: [],
		};
		documentPermissions = EMPTY_DOCUMENT_PERMISSIONS;
	}

	if (DEBUG_AUTH) {
		console.log("[LAYOUT] userRoles:", userRoles);
	}

	return (
		<html lang="en">
			<body
				className={`${geistSans.variable} ${geistMono.variable} ${playfairDisplay.variable} antialiased`}
			>
				{ENABLE_REACT_SCAN && <ReactScanLoader />}
				{ENABLE_VERCEL_CLIENT_TELEMETRY && <SpeedInsights />}
				<QueryClientProvider>
					<LazyMotionProvider>
						<DomainMigrationGuard />
						<SupabaseAuthListener />
						<AuthController />
						<AuthGate allowAnonymous={access.actorType === "demo"} />
						<Toaster position="bottom-right" richColors />
						<NotificationsListener />
						<PathnameLayoutShell
							user={user}
							userRoles={userRoles}
							documentPermissions={documentPermissions}
							permissionOptions={permissionOptions}
							tenants={tenants}
							demoSession={access.demoSession}
							demoCapabilities={access.demoSession?.allowedCapabilities}
						>
							{children}
						</PathnameLayoutShell>
					</LazyMotionProvider>
				</QueryClientProvider>
				{ENABLE_VERCEL_CLIENT_TELEMETRY && <Analytics />}
			</body>
		</html>
	);
}
