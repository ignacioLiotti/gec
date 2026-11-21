import { afterEach, describe, expect, it, vi } from "vitest";
import ContextualFlowDemosPage from "@/app/portfolio/previews/contextual-flows/page";

vi.mock("@/app/portfolio/previews/contextual-flows/demo-client", () => ({
  ContextualFlowDemos: () => null,
}));

afterEach(() => vi.unstubAllEnvs());

describe("contextual flow demo access", () => {
  it.each(["production", "test"])("returns Next notFound outside development, including %s", async environment => {
    vi.stubEnv("NODE_ENV", environment);
    vi.stubEnv("CONTEXTUAL_FLOW_DEMOS", "1");
    await expect(ContextualFlowDemosPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });

  it("requires an explicit opt-in in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CONTEXTUAL_FLOW_DEMOS", "0");
    await expect(ContextualFlowDemosPage({ searchParams: Promise.resolve({ generate: "1" }) })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });

  it("restores independent variants from a demo URL", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CONTEXTUAL_FLOW_DEMOS", "1");
    const element = await ContextualFlowDemosPage({ searchParams: Promise.resolve({ flow: "capture", generate: "0", ask: "0", capture: "1" }) });
    expect(element.props.initialFlow).toBe("capture");
    expect(element.props.initialFlags).toEqual({ generate: false, ask: false, capture: true });
  });
});
