import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const obraId = searchParams.get("obraId");

		if (!obraId) {
			return NextResponse.json(
				{ error: "obraId is required" },
				{ status: 400 }
			);
		}

		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { data: obra, error: obraError } = await supabase
			.from("obras")
			.select("tenant_id")
			.eq("id", obraId)
			.maybeSingle();

		if (obraError || !obra) {
			return NextResponse.json({ error: "Obra not found" }, { status: 404 });
		}

		const tenantId = (obra as any).tenant_id as string;

		const admin = createSupabaseAdminClient();

		const [{ data: roles }, { data: memberships }] = await Promise.all([
			admin
				.from("roles")
				.select("id,key,name")
				.eq("tenant_id", tenantId)
				.order("name"),
			admin.from("memberships").select("user_id").eq("tenant_id", tenantId),
		]);

		const roleIds = (roles ?? []).map((r: any) => r.id as string);
		const memberIds = (memberships ?? []).map((m: any) => m.user_id as string);

		const [{ data: userRoles }, { data: profiles }] = await Promise.all([
			roleIds.length
				? admin
						.from("user_roles")
						.select("user_id,role_id")
						.in("role_id", roleIds)
				: Promise.resolve({ data: [] as any[] }),
			memberIds.length
				? supabase
						.from("profiles")
						.select("user_id,full_name")
						.in("user_id", memberIds)
				: Promise.resolve({ data: [] as any[] }),
		]);

		const users =
			profiles?.map((p: any) => ({
				id: p.user_id as string,
				full_name: (p.full_name as string | null) ?? null,
			})) ?? [];

		return NextResponse.json({
			roles:
				roles?.map((r: any) => ({
					id: r.id as string,
					key: String(r.key),
					name: (r.name as string | null) ?? null,
				})) ?? [],
			users,
			userRoles:
				userRoles?.map((ur: any) => ({
					user_id: ur.user_id as string,
					role_id: ur.role_id as string,
				})) ?? [],
		});
	} catch (error: any) {
		console.error("Error in GET /api/obra-recipients:", error);
		return NextResponse.json(
			{ error: error?.message ?? "Internal server error" },
			{ status: 500 }
		);
	}
}
