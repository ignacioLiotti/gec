import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

async function getAuthContext() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return { supabase, user: null, tenantId: null, isAdmin: false };
	}

	// Get tenant from memberships (same pattern as other macro-tables routes)
	const { data: membership } = await supabase
		.from("memberships")
		.select("tenant_id, role")
		.eq("user_id", user.id)
		.order("created_at", { ascending: true })
		.limit(1)
		.maybeSingle();

	const tenantId = membership?.tenant_id ?? null;

	if (!tenantId) {
		return { supabase, user, tenantId: null, isAdmin: false };
	}

	// Check if superadmin
	const { data: profile } = await supabase
		.from("profiles")
		.select("is_superadmin")
		.eq("user_id", user.id)
		.maybeSingle();

	const isAdmin =
		membership?.role === "admin" ||
		membership?.role === "owner" ||
		profile?.is_superadmin === true;

	return { supabase, user, tenantId, isAdmin };
}

// GET - Get sidebar assignments for a macro table
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { supabase, user, tenantId, isAdmin } = await getAuthContext();
	const { id: macroTableId } = await params;

	console.log("[sidebar-macro-tables:get] Auth context:", {
		hasUser: !!user,
		tenantId,
		isAdmin,
		macroTableId,
	});

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!tenantId) {
		console.log("[sidebar-macro-tables:get] No tenant ID found");
		return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
	}

	if (!isAdmin) {
		console.log("[sidebar-macro-tables:get] User is not admin");
		return NextResponse.json({ error: "Admin access required" }, { status: 403 });
	}

	try {
		// Verify macro table belongs to tenant
		const { data: macroTable, error: mtError } = await supabase
			.from("macro_tables")
			.select("id")
			.eq("id", macroTableId)
			.eq("tenant_id", tenantId)
			.maybeSingle();

		if (mtError || !macroTable) {
			return NextResponse.json({ error: "Macro table not found" }, { status: 404 });
		}

		// Get sidebar assignments for this macro table
		const { data: assignments, error: assignError } = await supabase
			.from("sidebar_macro_tables")
			.select("id, role_id, position")
			.eq("macro_table_id", macroTableId);

		if (assignError) {
			console.error("[sidebar-macro-tables:get] Error:", assignError);
			throw assignError;
		}

		// Get all roles for the tenant
		const { data: roles, error: rolesError } = await supabase
			.from("roles")
			.select("id, key, name")
			.eq("tenant_id", tenantId)
			.order("name");

		if (rolesError) {
			console.error("[sidebar-macro-tables:get] Roles error:", rolesError);
			throw rolesError;
		}

		return NextResponse.json({
			assignments: assignments ?? [],
			roles: roles ?? [],
		});
	} catch (error) {
		console.error("[sidebar-macro-tables:get]", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error fetching sidebar config" },
			{ status: 500 }
		);
	}
}

// POST - Add/update sidebar assignments for a macro table
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { supabase, user, tenantId, isAdmin } = await getAuthContext();
	const { id: macroTableId } = await params;

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!tenantId || !isAdmin) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const body = await request.json();
		const roleIds: string[] = Array.isArray(body.roleIds) ? body.roleIds : [];

		// Verify macro table belongs to tenant
		const { data: macroTable, error: mtError } = await supabase
			.from("macro_tables")
			.select("id")
			.eq("id", macroTableId)
			.eq("tenant_id", tenantId)
			.maybeSingle();

		if (mtError || !macroTable) {
			return NextResponse.json({ error: "Macro table not found" }, { status: 404 });
		}

		// Get current assignments
		const { data: currentAssignments } = await supabase
			.from("sidebar_macro_tables")
			.select("role_id")
			.eq("macro_table_id", macroTableId);

		const currentRoleIds = new Set((currentAssignments ?? []).map((a) => a.role_id));
		const newRoleIds = new Set(roleIds);

		// Roles to add
		const toAdd = roleIds.filter((id) => !currentRoleIds.has(id));
		// Roles to remove
		const toRemove = Array.from(currentRoleIds).filter((id) => !newRoleIds.has(id));

		// Remove unselected roles
		if (toRemove.length > 0) {
			const { error: deleteError } = await supabase
				.from("sidebar_macro_tables")
				.delete()
				.eq("macro_table_id", macroTableId)
				.in("role_id", toRemove);

			if (deleteError) {
				console.error("[sidebar-macro-tables:post] Delete error:", deleteError);
			}
		}

		// Add new roles
		if (toAdd.length > 0) {
			const { error: insertError } = await supabase
				.from("sidebar_macro_tables")
				.insert(
					toAdd.map((roleId, index) => ({
						role_id: roleId,
						macro_table_id: macroTableId,
						position: index,
					}))
				);

			if (insertError) {
				console.error("[sidebar-macro-tables:post] Insert error:", insertError);
				throw insertError;
			}
		}

		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("[sidebar-macro-tables:post]", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error updating sidebar config" },
			{ status: 500 }
		);
	}
}
