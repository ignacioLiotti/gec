import type { BrowserContextOptions } from "@playwright/test";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import {
	createClient,
	type Session,
	type SupabaseClient,
} from "@supabase/supabase-js";

import type { LocalE2ETarget } from "./local-target";

type SerializedCookie = {
	name: string;
	value: string;
	options: CookieOptions;
};

type StorageState = NonNullable<
	Exclude<BrowserContextOptions["storageState"], string>
>;

export type AuthenticatedSession = {
	db: SupabaseClient;
	storageState: StorageState;
};

function appCookie(
	target: LocalE2ETarget,
	cookie: SerializedCookie,
): StorageState["cookies"][number] {
	return {
		name: cookie.name,
		value: cookie.value,
		domain: target.appUrl.hostname,
		path: cookie.options.path ?? "/",
		expires: -1,
		httpOnly: cookie.options.httpOnly ?? false,
		secure: target.appUrl.protocol === "https:",
		sameSite: "Lax",
	};
}

async function serializeSsrSession(
	target: LocalE2ETarget,
	session: Session,
): Promise<SerializedCookie[]> {
	let cookies: SerializedCookie[] = [];
	const serverClient = createServerClient(
		target.supabaseUrl.href,
		target.supabaseAnonKey,
		{
			auth: {
				autoRefreshToken: false,
				detectSessionInUrl: false,
				persistSession: true,
			},
			cookies: {
				getAll: () => cookies,
				setAll: (nextCookies) => {
					cookies = nextCookies;
				},
			},
		},
	);

	const { error } = await serverClient.auth.setSession({
		access_token: session.access_token,
		refresh_token: session.refresh_token,
	});
	if (error) {
		throw new Error(`Failed to serialize the E2E actor session: ${error.message}`);
	}
	if (cookies.length === 0) {
		throw new Error("Supabase did not emit SSR cookies for the E2E actor session.");
	}

	return cookies;
}

export async function signInSyntheticActor(params: {
	target: LocalE2ETarget;
	email: string;
	password: string;
	activeTenantId: string;
}): Promise<AuthenticatedSession> {
	const db = createClient(
		params.target.supabaseUrl.href,
		params.target.supabaseAnonKey,
		{
			auth: {
				autoRefreshToken: false,
				detectSessionInUrl: false,
				persistSession: false,
			},
		},
	);
	const { data, error } = await db.auth.signInWithPassword({
		email: params.email,
		password: params.password,
	});
	if (error || !data.session) {
		throw new Error(
			`Failed to authenticate a synthetic E2E actor: ${error?.message ?? "session missing"}`,
		);
	}

	const authCookies = await serializeSsrSession(params.target, data.session);
	return {
		db,
		storageState: {
			cookies: [
				...authCookies.map((cookie) => appCookie(params.target, cookie)),
				{
					name: "active_tenant_id",
					value: params.activeTenantId,
					domain: params.target.appUrl.hostname,
					path: "/",
					expires: -1,
					httpOnly: false,
					secure: params.target.appUrl.protocol === "https:",
					sameSite: "Lax",
				},
			],
			origins: [],
		},
	};
}
