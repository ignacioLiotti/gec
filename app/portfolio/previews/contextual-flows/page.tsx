import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContextualFlowDemos } from "./demo-client";
import { demoFlows, type DemoFlags, type DemoFlow } from "./fixtures";

export const metadata: Metadata = {
  title: "Síntesis · Demos de recorridos",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.ico" },
};
export const dynamic = "force-dynamic";

export default async function ContextualFlowDemosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // This fixture route is never available in a production build.
  if (process.env.NODE_ENV !== "development" || process.env.CONTEXTUAL_FLOW_DEMOS !== "1") notFound();
  const query = await searchParams;
  const initialFlow: DemoFlow = demoFlows.find(flow => flow.id === query.flow)?.id ?? "generate";
  const initialFlags: DemoFlags = {
    generate: query.generate !== "0",
    ask: query.ask !== "0",
    capture: query.capture !== "0",
  };
  return <ContextualFlowDemos initialFlow={initialFlow} initialFlags={initialFlags} />;
}
