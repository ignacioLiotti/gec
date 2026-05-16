import { NextResponse } from "next/server";
import {
	hasDemoCapability,
	resolveRequestAccessContext,
} from "@/lib/demo-session";

type SidebarMacroTableJoin = {
	macro_table_id: string;
	position: number | null;
	macro_tables?: { name?: string | null } | { name?: string | null }[] | null;
};

function getJoinedMacroTableName(row: SidebarMacroTableJoin) {
	const joined = Array.isArray(row.macro_tables)
		? row.macro_tables[0]
		: row.macro_tables;
	return joined?.name ?? "Unknown";
}

export async function GET() {
	const access = await resolveRequestAccessContext();

	if (access.actorType === "anonymous" || !access.tenantId) {
		return NextResponse.json({ tables: [] });
	}
	if (access.actorType === "demo" && !hasDemoCapability(access.demoSession, "macro")) {
		return NextResponse.json({ tables: [] });
	}
	const { supabase, tenantId } = access;

	try {
		if (access.actorType === "demo") {
			const { data: demoTables, error: demoTablesError } = await supabase
				.from("macro_tables")
				.select("id, name")
				.eq("tenant_id", tenantId)
				.order("name");

			if (demoTablesError) throw demoTablesError;

			return NextResponse.json({
				tables: (demoTables ?? []).map((table, index) => ({
					id: table.id as string,
					name: (table.name as string) ?? "Tabla",
					position: index,
				})),
			});
		}

		const user = access.user;
		if (!user) {
			return NextResponse.json({ tables: [] });
		}

		// Check if user is admin/superadmin
		const { data: membership, error: membershipError } = await supabase
			.from("memberships")
			.select("role")
			.eq("user_id", user.id)
			.eq("tenant_id", tenantId)
			.maybeSingle();

		if (membershipError) {
			console.warn("[sidebar-macro-tables] membership lookup failed", {
				code: membershipError.code,
				message: membershipError.message,
			});
		}

		const isAdmin = membership?.role === "admin" || membership?.role === "owner";
		const isSuperAdmin = access.isSuperAdmin;

		// If admin/superadmin, show all macro tables marked for sidebar
		if (isAdmin || isSuperAdmin) {
			// Get tables that have any sidebar assignment
			const { data: sidebarTables } = await supabase
				.from("sidebar_macro_tables")
				.select(`
					macro_table_id,
					position,
					macro_tables!inner(id, name, tenant_id)
				`)
				.eq("macro_tables.tenant_id", tenantId)
				.order("position");

			// Deduplicate by macro_table_id
			const seen = new Set<string>();
			const tables = ((sidebarTables ?? []) as SidebarMacroTableJoin[])
				.filter((t) => {
					const id = t.macro_table_id;
					if (seen.has(id)) return false;
					seen.add(id);
					return true;
				})
				.map((t) => ({
					id: t.macro_table_id,
					name: getJoinedMacroTableName(t),
					position: t.position,
				}));

			return NextResponse.json({ tables });
		}

		// For regular users, get tables based on their roles
		const { data: userRoles, error: userRolesError } = await supabase
			.from("user_roles")
			.select("role_id")
			.eq("user_id", user.id)
			.eq("tenant_id", tenantId);

		if (userRolesError) {
			console.warn("[sidebar-macro-tables] user role lookup failed", {
				code: userRolesError.code,
				message: userRolesError.message,
			});
			return NextResponse.json({ tables: [] });
		}

		if (!userRoles || userRoles.length === 0) {
			return NextResponse.json({ tables: [] });
		}

		const roleIds = userRoles.map((r) => r.role_id);

		const { data: sidebarTables } = await supabase
			.from("sidebar_macro_tables")
			.select(`
				macro_table_id,
				position,
				macro_tables!inner(id, name, tenant_id)
			`)
			.in("role_id", roleIds)
			.eq("macro_tables.tenant_id", tenantId)
			.order("position");

		// Deduplicate by macro_table_id
		const seen = new Set<string>();
		const tables = ((sidebarTables ?? []) as SidebarMacroTableJoin[])
			.filter((t) => {
				const id = t.macro_table_id;
				if (seen.has(id)) return false;
				seen.add(id);
				return true;
			})
			.map((t) => ({
				id: t.macro_table_id,
				name: getJoinedMacroTableName(t),
				position: t.position,
			}));

		return NextResponse.json({ tables });
	} catch (error) {
		console.warn("[sidebar-macro-tables] Error:", error);
		return NextResponse.json({ tables: [] });
	}
}
