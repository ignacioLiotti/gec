type Environment = Readonly<Record<string, string | undefined>>;

type LocalTargetInput =
	| { kind: "discovery" }
	| { kind: "execution"; env: Environment };

export type LocalE2ETarget = Readonly<{
	appUrl: URL;
	supabaseUrl: URL;
	supabaseAnonKey: string;
	supabaseServiceRoleKey: string;
}>;

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

// This blocks remote execution. It does not fix the suite's fixed tenant/user reuse
// or prove that fixture cleanup and tenant isolation are correct.

function required(env: Environment, name: string) {
	const value = env[name]?.trim();
	if (!value) {
		throw new Error(`Local E2E execution requires ${name}.`);
	}
	return value;
}

function loopbackHttpUrl(name: string, value: string) {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error(`${name} must be a valid HTTP URL for a loopback host.`);
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new Error(`${name} must use HTTP or HTTPS.`);
	}
	if (url.username || url.password) {
		throw new Error(`${name} must not contain user information.`);
	}
	if (!LOOPBACK_HOSTS.has(url.hostname.toLowerCase())) {
		throw new Error(
			`${name} must use localhost, 127.0.0.1, or [::1].`,
		);
	}

	return url;
}

export function assertLocalE2ETarget(input: { kind: "discovery" }): null;
export function assertLocalE2ETarget(input: {
	kind: "execution";
	env: Environment;
}): LocalE2ETarget;
export function assertLocalE2ETarget(input: LocalTargetInput) {
	if (input.kind === "discovery") return null;

	const { env } = input;
	if (env.E2E_LOCAL !== "1") {
		throw new Error(
			"Local E2E execution requires E2E_LOCAL=1 for an explicitly disposable local instance.",
		);
	}
	if (env.PLAYWRIGHT_WEB_SERVER_COMMAND?.trim()) {
		throw new Error(
			"PLAYWRIGHT_WEB_SERVER_COMMAND is not allowed because the E2E server must use the fixed local command.",
		);
	}
	if (env.PLAYWRIGHT_SKIP_WEBSERVER === "true") {
		throw new Error(
			"PLAYWRIGHT_SKIP_WEBSERVER cannot run mutating E2E tests because an existing server may use a different database.",
		);
	}

	const appUrl = loopbackHttpUrl(
		"PLAYWRIGHT_BASE_URL",
		env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${env.PORT ?? "3000"}`,
	);
	const supabaseUrl = loopbackHttpUrl(
		"NEXT_PUBLIC_SUPABASE_URL",
		required(env, "NEXT_PUBLIC_SUPABASE_URL"),
	);

	return {
		appUrl,
		supabaseUrl,
		supabaseAnonKey: required(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
		supabaseServiceRoleKey: required(env, "SUPABASE_SERVICE_ROLE_KEY"),
	};
}
