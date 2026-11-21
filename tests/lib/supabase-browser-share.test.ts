import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ createBrowserClient: vi.fn(() => ({ browserClient: true })) }));
vi.mock("@supabase/ssr", () => sdk);
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

beforeEach(() => {
	vi.stubEnv("NODE_ENV", "development");
	vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
	vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "synthetic-anon-key");
	vi.stubGlobal("window", { location: { origin: "https://example.trycloudflare.com", hostname: "example.trycloudflare.com", protocol: "https:" } });
	sdk.createBrowserClient.mockClear();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("local app sharing browser connection", () => {
	it("routes the browser through the same origin and keeps the server's original auth-cookie namespace", () => {
		createSupabaseBrowserClient();
		expect(sdk.createBrowserClient).toHaveBeenCalledWith("https://example.trycloudflare.com/__sintesis_supabase", "synthetic-anon-key", { cookieOptions: { name: "sb-127-auth-token" } });
	});

	it.each(["production", "test"])("keeps the configured connection in %s", (mode) => {
		vi.stubEnv("NODE_ENV", mode);
		createSupabaseBrowserClient();
		expect(sdk.createBrowserClient).toHaveBeenCalledWith("http://127.0.0.1:54321", "synthetic-anon-key");
	});

	it("keeps a remote Supabase connection even on a tunnel", () => {
		vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.supabase.co");
		createSupabaseBrowserClient();
		expect(sdk.createBrowserClient).toHaveBeenCalledWith("https://synthetic.supabase.co", "synthetic-anon-key");
	});

	it.each(["localhost", "127.0.0.1", "other.example", "example.trycloudflare.com.attacker.test"])("keeps configured connections for host %s", (hostname) => {
		vi.stubGlobal("window", { location: { origin: `https://${hostname}`, hostname, protocol: "https:" } });
		createSupabaseBrowserClient();
		expect(sdk.createBrowserClient).toHaveBeenCalledWith("http://127.0.0.1:54321", "synthetic-anon-key");
	});

	it("keeps configured connections during server rendering", () => {
		vi.stubGlobal("window", undefined);
		createSupabaseBrowserClient();
		expect(sdk.createBrowserClient).toHaveBeenCalledWith("http://127.0.0.1:54321", "synthetic-anon-key");
	});

	it("refuses to construct a client without an anon key", () => {
		vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
		expect(() => createSupabaseBrowserClient()).toThrow("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
		expect(sdk.createBrowserClient).not.toHaveBeenCalled();
	});
});
