import { describe, expect, it } from "vitest";

import { assertLocalE2ETarget } from "@/tests/e2e/helpers/local-target";

const localEnvironment = {
	E2E_LOCAL: "1",
	PLAYWRIGHT_BASE_URL: "http://127.0.0.1:3000",
	NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
	NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-anon-key",
	SUPABASE_SERVICE_ROLE_KEY: "local-service-role-key",
	PLAYWRIGHT_WEB_SERVER_COMMAND: "",
	PLAYWRIGHT_SKIP_WEBSERVER: "false",
};

describe("local E2E target guard", () => {
	it("allows credential-free test discovery", () => {
		expect(assertLocalE2ETarget({ kind: "discovery" })).toBeNull();
	});

	it.each([
		["localhost", "http://localhost:3000", "http://localhost:54321"],
		["IPv4 loopback", "https://127.0.0.1:3000", "http://127.0.0.1:54321"],
		["IPv6 loopback", "http://[::1]:3000", "http://[::1]:54321"],
	])("allows %s app and Supabase targets", (_label, appUrl, supabaseUrl) => {
		const target = assertLocalE2ETarget({
			kind: "execution",
			env: {
				...localEnvironment,
				PLAYWRIGHT_BASE_URL: appUrl,
				NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
			},
		});

		expect(target.appUrl.hostname).toBe(new URL(appUrl).hostname);
		expect(target.supabaseUrl.hostname).toBe(new URL(supabaseUrl).hostname);
	});

	it("requires an explicit disposable-local marker", () => {
		expect(() =>
			assertLocalE2ETarget({
				kind: "execution",
				env: { ...localEnvironment, E2E_LOCAL: undefined },
			}),
		).toThrow(/E2E_LOCAL=1/);
	});

	it.each([
		[
			"a custom web server command",
			{ PLAYWRIGHT_WEB_SERVER_COMMAND: "npm run dev -- --turbo" },
			/PLAYWRIGHT_WEB_SERVER_COMMAND is not allowed/,
		],
		[
			"the nominal command supplied as an override",
			{ PLAYWRIGHT_WEB_SERVER_COMMAND: "npm run dev" },
			/PLAYWRIGHT_WEB_SERVER_COMMAND is not allowed/,
		],
		[
			"an existing web server",
			{ PLAYWRIGHT_SKIP_WEBSERVER: "true" },
			/PLAYWRIGHT_SKIP_WEBSERVER cannot run mutating E2E tests/,
		],
	])("rejects %s", (_label, envOverride, expectedError) => {
		expect(() =>
			assertLocalE2ETarget({
				kind: "execution",
				env: { ...localEnvironment, ...envOverride },
			}),
		).toThrow(expectedError);
	});

	it.each([
		["remote app", "PLAYWRIGHT_BASE_URL", "https://example.com"],
		["remote Supabase", "NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co"],
		["localhost suffix", "PLAYWRIGHT_BASE_URL", "http://localhost.example.com"],
		["IPv4 suffix", "NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1.example.com"],
		["trailing-dot hostname", "PLAYWRIGHT_BASE_URL", "http://localhost.:3000"],
	])("rejects %s", (_label, name, value) => {
		expect(() =>
			assertLocalE2ETarget({
				kind: "execution",
				env: { ...localEnvironment, [name]: value },
			}),
		).toThrow(/localhost, 127\.0\.0\.1, or \[::1\]/);
	});

	it.each([
		["non-HTTP app URL", "PLAYWRIGHT_BASE_URL", "file:///tmp/app"],
		["non-HTTP Supabase URL", "NEXT_PUBLIC_SUPABASE_URL", "ftp://localhost/data"],
		["app URL user information", "PLAYWRIGHT_BASE_URL", "http://user@localhost:3000"],
		[
			"Supabase URL user information",
			"NEXT_PUBLIC_SUPABASE_URL",
			"http://user:password@localhost:54321",
		],
	])("rejects %s", (_label, name, value) => {
		expect(() =>
			assertLocalE2ETarget({
				kind: "execution",
				env: { ...localEnvironment, [name]: value },
			}),
		).toThrow();
	});

	it.each([
		"NEXT_PUBLIC_SUPABASE_URL",
		"NEXT_PUBLIC_SUPABASE_ANON_KEY",
		"SUPABASE_SERVICE_ROLE_KEY",
	])("requires %s without exposing configured key values", (name) => {
		const secret = "must-not-appear-in-errors";
		let message = "";
		try {
			assertLocalE2ETarget({
				kind: "execution",
				env: {
					...localEnvironment,
					NEXT_PUBLIC_SUPABASE_ANON_KEY: secret,
					SUPABASE_SERVICE_ROLE_KEY: secret,
					[name]: "",
				},
			});
		} catch (error) {
			message = error instanceof Error ? error.message : String(error);
		}

		expect(message).toContain(name);
		expect(message).not.toContain(secret);
	});
});
