import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client for client components and hooks.
 *
 * Anon key + user session, so RLS applies. `createBrowserClient` reuses a
 * singleton under the hood, making this safe to call per-render. Treat its
 * results as UI state only — authorization is enforced server-side (route
 * guards + RLS), not by what the browser can or cannot fetch.
 */
export function createSupabaseBrowserClient() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

	if (!url || !anonKey) {
		throw new Error(
			"Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
		);
	}

	const configuredHost = new URL(url).hostname;
	const useLocalBridge =
		process.env.NODE_ENV === "development" &&
		["127.0.0.1", "localhost", "[::1]"].includes(configuredHost) &&
		typeof window !== "undefined" &&
		window.location.protocol === "https:" &&
		window.location.hostname.endsWith(".trycloudflare.com");
	if (useLocalBridge) {
		return createBrowserClient(
			`${window.location.origin}/__sintesis_supabase`,
			anonKey,
			{ cookieOptions: { name: `sb-${configuredHost.split(".")[0]}-auth-token` } },
		);
	}

	return createBrowserClient(url, anonKey);
}
