import { notFound, redirect } from "next/navigation";

import { DemoFlowShell } from "@/components/demo-flows/demo-flow-shell";
import {
	getDemoLinkBySlug,
	resolveDemoSessionFromCookies,
} from "@/lib/demo-session";
import {
	getEnabledDemoFlows,
	getTenantDemoExperienceSettings,
} from "@/lib/demo-flows/runtime";

type DemoFlowPageProps = {
	params: Promise<{ slug: string; flowId: string }>;
};

export default async function DemoFlowPage({ params }: DemoFlowPageProps) {
	const { slug, flowId } = await params;
	const [demoLink, activeSession] = await Promise.all([
		getDemoLinkBySlug(slug),
		resolveDemoSessionFromCookies(),
	]);

	if (!demoLink) {
		notFound();
	}

	if (
		!activeSession ||
		activeSession.slug !== slug ||
		activeSession.tenantId !== demoLink.tenant_id
	) {
		redirect(`/demo/${slug}`);
	}

	const settings = await getTenantDemoExperienceSettings(demoLink.tenant_id);
	const enabledFlows = getEnabledDemoFlows(settings);
	const flow = enabledFlows.find((entry) => entry.id === flowId);

	if (!flow) {
		notFound();
	}

	const tenantName = Array.isArray(demoLink.tenants)
		? (demoLink.tenants[0]?.name ?? "Organizacion demo")
		: (demoLink.tenants?.name ?? "Organizacion demo");

	return (
		<DemoFlowShell
			slug={slug}
			tenantName={tenantName}
			demoLabel={demoLink.label ?? `Demo para ${tenantName}`}
			flow={flow}
		/>
	);
}
