import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { rateLimitByTenant } from "@/lib/security/rate-limit";
import { z } from "zod";
import {
	ApiValidationError,
	validateJsonBody,
} from "@/lib/http/validation";

const RotateSecretSchema = z
	.object({
		graceDays: z.coerce.number().int().positive().max(30).optional(),
	})
	.optional()
	.default({});

async function requireAdminTenant(request: Request) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
	}

	const { searchParams } = new URL(request.url);
	const requestedTenant = searchParams.get("tenantId");

	let query = supabase
		.from("memberships")
		.select("tenant_id, role")
		.eq("user_id", user.id)
		.in("role", ["owner", "admin"])
		.order("created_at", { ascending: true })
		.limit(1);

	if (requestedTenant) {
		query = query.eq("tenant_id", requestedTenant);
	}

	const { data: membership, error: membershipError } = await query.maybeSingle();

	if (membershipError || !membership?.tenant_id) {
		return {
			error: NextResponse.json(
				{ error: "No tenés permisos de administrador en esta organización." },
				{ status: 403 }
			),
		};
	}

	return { tenantId: membership.tenant_id };
}

export async function GET(request: Request) {
	const { tenantId, error } = await requireAdminTenant(request);
	if (error || !tenantId) {
		return error;
	}

	const limit = await rateLimitByTenant(tenantId, "tenant-secret-read");
	if (!limit.success) {
		return NextResponse.json(
			{ error: "Demasiadas solicitudes. Intentá de nuevo más tarde." },
			{ status: 429 }
		);
	}

	const admin = createSupabaseAdminClient();
	const { data, error: secretsError } = await admin
		.from("tenant_api_secrets")
		.select(
			"version,status,valid_from,valid_to,created_at,rotated_at"
		)
		.eq("tenant_id", tenantId)
		.order("version", { ascending: false })
		.limit(10);

	if (secretsError) {
		return NextResponse.json(
			{ error: "No se pudieron cargar los secretos", detail: secretsError.message },
			{ status: 500 }
		);
	}

	return NextResponse.json({
		secrets: data ?? [],
	});
}

export async function POST(request: Request) {
	try {
		const { tenantId, error } = await requireAdminTenant(request);
		if (error || !tenantId) {
			return error;
		}

		const limit = await rateLimitByTenant(tenantId, "tenant-secret-rotate");
		if (!limit.success) {
			return NextResponse.json(
				{
					error: "Rotaste demasiadas veces este secreto. Esperá antes de reintentar.",
				},
				{ status: 429 }
			);
		}

		const { graceDays } = await validateJsonBody(request, RotateSecretSchema);
		const graceValue =
			graceDays && Number.isFinite(graceDays) ? `${graceDays} days` : undefined;

		const admin = createSupabaseAdminClient();
		const { data, error: rotateError } = await admin.rpc(
			"rotate_tenant_api_secret",
			{
				p_tenant_id: tenantId,
				p_grace_period: graceValue,
			}
		);

		if (rotateError) {
			return NextResponse.json(
				{
					error: "No se pudo rotar el secreto",
					detail: rotateError.message,
				},
				{ status: 500 }
			);
		}

		return NextResponse.json({
			secret: data?.secret ?? null,
			version: data?.version ?? null,
			status: data?.status ?? null,
		});
	} catch (error: any) {
		if (error instanceof ApiValidationError) {
			return NextResponse.json(
				{ error: error.message, issues: error.issues },
				{ status: error.status }
			);
		}
		throw error;
	}
}
