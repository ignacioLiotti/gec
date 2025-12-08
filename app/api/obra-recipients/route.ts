import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { z } from "zod";
import {
	ApiValidationError,
	validateSearchParams,
} from "@/lib/http/validation";

const ObraRecipientsQuerySchema = z.object({
	obraId: z.string().uuid("obraId inválido"),
});

export async function GET(request: Request) {
	try {
		const { obraId } = validateSearchParams(
			new URL(request.url).searchParams,
			ObraRecipientsQuerySchema
		);

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
			.is("deleted_at", null)
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

		const uniqueMemberIds = Array.from(new Set(memberIds));

		const [{ data: userRoles }, { data: profiles }] = await Promise.all([
			roleIds.length
				? admin
						.from("user_roles")
						.select("user_id,role_id")
						.in("role_id", roleIds)
				: Promise.resolve({ data: [] as any[] }),
			uniqueMemberIds.length
				? admin
						.from("profiles")
						.select("user_id,full_name")
						.in("user_id", uniqueMemberIds)
				: Promise.resolve({ data: [] as any[] }),
		]);

		const profileNameMap = new Map(
			(profiles ?? []).map((p: any) => [
				p.user_id as string,
				(p.full_name as string | null) ?? null,
			])
		);

		const emailMap = new Map<string, string | null>();
		if (uniqueMemberIds.length) {
			const lookups = await Promise.all(
				uniqueMemberIds.map(async (userId) => {
					try {
						const { data } = await admin.auth.admin.getUserById(userId);
						return { userId, email: data?.user?.email ?? null };
					} catch (error) {
						console.error("[obra-recipients] failed to fetch user email", {
							userId,
							error,
						});
						return { userId, email: null };
					}
				})
			);

			for (const result of lookups) {
				emailMap.set(result.userId, result.email);
			}
		}

		const users = uniqueMemberIds.map((id) => ({
			id,
			full_name: profileNameMap.get(id) ?? null,
			email: emailMap.get(id) ?? null,
		}));

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
		if (error instanceof ApiValidationError) {
			return NextResponse.json(
				{ error: error.message, issues: error.issues },
				{ status: error.status }
			);
		}
		return NextResponse.json(
			{ error: error?.message ?? "Internal server error" },
			{ status: 500 }
		);
	}
}
