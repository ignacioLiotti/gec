import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
  getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
  createServerClient: vi.fn(),
}));
vi.mock("@supabase/ssr", () => ({ createServerClient: auth.createServerClient }));
vi.mock("@/lib/security/rate-limit", () => ({ getClientIp: vi.fn(), rateLimitByIp: vi.fn() }));

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("CONTEXTUAL_FLOW_DEMOS", "1");
  auth.createServerClient.mockReturnValue({ auth });
});
afterEach(() => vi.unstubAllEnvs());

const demoPath = "/portfolio/previews/contextual-flows";
const marker = "x-sintesis-contextual-flow-demo";

describe("local contextual demo request isolation", () => {
  it.each(["GET", "HEAD"])("serves fixture %s requests without reading or refreshing cookies", async method => {
    const response = await proxy(new NextRequest(`http://127.0.0.1:4320${demoPath}`, {
      method,
      headers: { cookie: "sb-127-auth-token=expired-fixture" },
    }));
    expect(auth.createServerClient).not.toHaveBeenCalled();
    expect(response.headers.get(`x-middleware-request-${marker}`)).toBe("1");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'self'");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it.each([
    { environment: "production", enabled: "1", path: demoPath, method: "GET" },
    { environment: "development", enabled: "0", path: demoPath, method: "GET" },
    { environment: "development", enabled: "1", path: "/excel", method: "GET" },
    { environment: "development", enabled: "1", path: "/api/obras", method: "GET" },
    { environment: "development", enabled: "1", path: "/portfolio/previews/obra", method: "GET" },
    { environment: "development", enabled: "1", path: `${demoPath}/extra`, method: "GET" },
    { environment: "development", enabled: "1", path: demoPath, method: "POST" },
  ])("keeps auth for $environment/$enabled $method $path and removes forged markers", async ({ environment, enabled, path, method }) => {
    vi.stubEnv("NODE_ENV", environment);
    vi.stubEnv("CONTEXTUAL_FLOW_DEMOS", enabled);
    const response = await proxy(new NextRequest(`http://127.0.0.1:4320${path}`, {
      method,
      headers: { [marker]: "1" },
    }));
    expect(auth.createServerClient).toHaveBeenCalledOnce();
    expect(auth.getSession).toHaveBeenCalledOnce();
    expect(auth.getUser).toHaveBeenCalledOnce();
    expect(response.headers.get(`x-middleware-request-${marker}`)).toBeNull();
  });
});
