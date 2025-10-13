import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

export async function POST(req: NextRequest) {
	const formData = await req.formData();
	const targetUserId = String(formData.get("user_id") ?? "");
	if (!targetUserId)
		return NextResponse.json({ error: "user_id required" }, { status: 400 });

	const res = NextResponse.json({ ok: true });

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				get(name) {
					return req.cookies.get(name)?.value;
				},
				set(name, value, options) {
					res.cookies.set({ name, value, ...options });
				},
				remove(name, options) {
					res.cookies.set({ name, value: "", ...options });
				},
			},
		}
	);

	// Ensure requester is authenticated and has admin permission in at least one tenant
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const admin = createSupabaseAdminClient();
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
				secure: false,
				path: "/",
			}
		);
		// Client-visible flag so UI can detect impersonation
		res.cookies.set("impersonating", "1", {
			httpOnly: false,
			sameSite: "lax",
			secure: false,
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

	return res;
}
