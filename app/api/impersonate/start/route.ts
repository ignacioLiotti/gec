import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { canStartImpersonation } from "@/lib/impersonation-access";
import { getClientIp, rateLimitByIp } from "@/lib/security/rate-limit";
import { isSuperAdminUser } from "@/lib/superadmin";

export async function POST(req: NextRequest) {
	const formData = await req.formData();
	const targetUserId = String(formData.get("user_id") ?? "");
	if (!targetUserId)
		return NextResponse.json({ error: "user_id required" }, { status: 400 });

	const ip = getClientIp(req) ?? "unknown";
	const limit = await rateLimitByIp(`impersonate:${ip}`);
	if (!limit.success) {
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	}
	if (limit.pending) {
		await limit.pending;
	}

	const res = NextResponse.json({ ok: true });
	const admin = createSupabaseAdminClient();

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				getAll() {
					return req.cookies.getAll().map((cookie) => ({
						name: cookie.name,
						value: cookie.value,
					}));
				},
				setAll(cookies: { name: string; value: string; options: CookieOptions }[]) {
					cookies.forEach(({ name, value, options }) => {
						res.cookies.set({ name, value, ...options });
					});
				},
			},
		}
	);

	// Ensure requester is authenticated and is the app-owner superadmin.
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { data: profile } = await supabase
		.from("profiles")
		.select("is_superadmin")
		.eq("user_id", user.id)
		.maybeSingle();

	const access = canStartImpersonation({
		isSuperAdmin: isSuperAdminUser(
			user.id,
			profile?.is_superadmin,
			user.email,
		),
		actorEmail: user.email,
	});
	if (!access.allowed) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const { data: targetUser } = await admin.auth.admin.getUserById(targetUserId);
	if (!targetUser || !targetUser.user?.email) {
		return NextResponse.json(
			{ error: "Target user not found" },
			{ status: 404 }
		);
	}

	// Store current session tokens so we can restore later
	const { data: sess } = await supabase.auth.getSession();
	if (sess?.session) {
		const payload = {
			access_token: sess.session.access_token,
			refresh_token: sess.session.refresh_token,
		};
		res.cookies.set(
			"impersonator_session",
			Buffer.from(JSON.stringify(payload)).toString("base64"),
			{
				httpOnly: true,
				sameSite: "lax",
				secure: process.env.NODE_ENV === "production",
				path: "/",
			}
		);
		// Client-visible flag so UI can detect impersonation
		res.cookies.set("impersonating", "1", {
			httpOnly: false,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
			path: "/",
		});
	}

	// Generate a magic link OTP for the target user
	const { data: linkData, error: linkErr } =
		await admin.auth.admin.generateLink({
			type: "magiclink",
			email: targetUser.user.email,
		});
	if (linkErr || !linkData?.properties?.email_otp) {
		return NextResponse.json(
			{ error: "Failed to generate link" },
			{ status: 500 }
		);
	}

	// Exchange OTP for a session on server; this will update auth cookies to target user
	const { error: verifyErr } = await supabase.auth.verifyOtp({
		email: targetUser.user.email,
		token: linkData.properties.email_otp,
		type: "email",
	});
	if (verifyErr) {
		return NextResponse.json(
			{ error: "Failed to impersonate" },
			{ status: 500 }
		);
	}

	const { error: auditError } = await admin.from("audit_log").insert({
		tenant_id: access.auditTenantId,
		actor_id: user.id,
		actor_email: user.email ?? null,
		table_name: "impersonation",
		row_pk: { target_user_id: targetUserId },
		action: "INSERT",
		context: {
			kind: "impersonation_start",
			ip,
			target_email: targetUser.user.email,
		},
	});
	if (auditError) {
		console.error("[impersonate] failed to write audit log", auditError);
	}

	return res;
}
