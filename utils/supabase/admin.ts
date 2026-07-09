import { createClient } from "@supabase/supabase-js";
import { requireVersionedSecret } from "@/lib/security/secrets";
import { supabaseServerFetch } from "./fetch";

/**
 * Service-role Supabase client. **Bypasses RLS entirely.**
 *
 * Server-only (the service-role key must never reach a client bundle).
 * Callers take over the tenant-isolation responsibility that RLS normally
 * provides: verify the acting user's membership/role and scope every query
 * by tenant explicitly. Reach for `./server.ts` first; use this only where
 * the route's purpose makes the bypass explicit (jobs, admin backfills,
 * cross-tenant maintenance).
 */
export function createSupabaseAdminClient() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceRoleKey = requireVersionedSecret(
		"SUPABASE_SERVICE_ROLE_KEY",
		"Supabase service role key"
	);
	if (!url) {
		throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
	}
	return createClient(url, serviceRoleKey, {
		auth: { persistSession: false },
		global: {
			fetch: supabaseServerFetch,
		},
	});
}
