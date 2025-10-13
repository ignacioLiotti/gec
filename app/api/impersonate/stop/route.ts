import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: NextRequest) {
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

	const b64 = req.cookies.get("impersonator_session")?.value;
	if (!b64) return res;
	try {
		const orig = JSON.parse(Buffer.from(b64, "base64").toString());
		// Restore original session by setting tokens
		await supabase.auth.setSession({
			access_token: orig.access_token,
			refresh_token: orig.refresh_token,
		});
		res.cookies.set("impersonator_session", "", {
			httpOnly: true,
			maxAge: 0,
			path: "/",
		});
		res.cookies.set("impersonating", "", {
			httpOnly: false,
			maxAge: 0,
			path: "/",
		});
	} catch {
		// ignore
	}
	return res;
}
