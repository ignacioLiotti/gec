import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseServerFetch } from "./fetch";

/**
 * Cookie-bound Supabase client for server components and API route handlers.
 *
 * Uses the anon key, so every query runs under the signed-in user's RLS
 * policies — this is the tenant-isolation boundary. Authenticate with
 * `(await createClient()).auth.getUser()` at the entry point of every
 * protected page/route. For RLS-bypassing access, see `./admin.ts`.
 */
export async function createClient() {
	const cookieStore = await cookies();

	return createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			global: {
				fetch: supabaseServerFetch,
			},
			cookies: {
				getAll() {
					return cookieStore.getAll();
				},
				setAll(
					cookiesToSet: {
						name: string;
						value: string;
						options: CookieOptions;
					}[],
				) {
					try {
						cookiesToSet.forEach(({ name, value, options }) =>
							cookieStore.set(name, value, options),
						);
					} catch {
						// The `setAll` method was called from a Server Component.
						// This can be ignored if you have middleware refreshing
						// user sessions.
					}
				},
			},
		},
	);
}
