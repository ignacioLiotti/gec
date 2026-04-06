import { NextResponse } from "next/server";
import {
	hasDemoCapability,
	resolveRequestAccessContext,
} from "@/lib/demo-session";

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
		const { data: membership } = await supabase
			.from("memberships")
			.select("role")
			.eq("user_id", user.id)
			.eq("tenant_id", tenantId)
			.maybeSingle();

		const { data: profile } = await supabase
			.from("profiles")
			.select("is_superadmin")
			.eq("user_id", user.id)
			.maybeSingle();

		const isAdmin = membership?.role === "admin" || membership?.role === "owner";
		const isSuperAdmin = profile?.is_superadmin ?? false;

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
			const tables = (sidebarTables ?? [])
				.filter((t) => {
					const id = t.macro_table_id;
					if (seen.has(id)) return false;
					seen.add(id);
					return true;
				})
				.map((t) => ({
					id: t.macro_table_id,
					name: (t.macro_tables as any)?.name ?? "Unknown",
					position: t.position,
				}));

			return NextResponse.json({ tables });
		}

		// For regular users, get tables based on their roles
		const { data: userRoles } = await supabase
			.from("user_roles")
			.select("role_id")
			.eq("user_id", user.id)
			.eq("tenant_id", tenantId);

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
		const tables = (sidebarTables ?? [])
			.filter((t) => {
				const id = t.macro_table_id;
				if (seen.has(id)) return false;
				seen.add(id);
				return true;
			})
			.map((t) => ({
				id: t.macro_table_id,
				name: (t.macro_tables as any)?.name ?? "Unknown",
				position: t.position,
			}));

		return NextResponse.json({ tables });
	} catch (error) {
		console.error("[sidebar-macro-tables] Error:", error);
		return NextResponse.json({ tables: [] });
	}
}
