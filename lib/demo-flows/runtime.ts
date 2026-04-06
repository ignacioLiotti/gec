import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import {
	DEFAULT_DEMO_FLOW_ID,
	demoFlowRegistry,
} from "@/lib/demo-flows/registry";
import type {
	DemoExperienceSettings,
	DemoFlowDefinition,
} from "@/lib/demo-flows/types";

function normalizeStringList(value: unknown) {
	if (!Array.isArray(value)) return [];
	return value
		.filter((item): item is string => typeof item === "string")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

export function parseDemoExperienceSettings(
	value: unknown,
): DemoExperienceSettings {
	const settings =
		value && typeof value === "object" && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: {};
	const enabledFlowIds = normalizeStringList(settings.enabledFlowIds);

	return {
		landingFlowId:
			typeof settings.landingFlowId === "string" &&
			settings.landingFlowId.trim().length > 0
				? settings.landingFlowId.trim()
				: null,
		enabledFlowIds,
		headline:
			typeof settings.headline === "string" && settings.headline.trim().length > 0
				? settings.headline.trim()
				: null,
		subheadline:
			typeof settings.subheadline === "string" &&
			settings.subheadline.trim().length > 0
				? settings.subheadline.trim()
				: null,
	};
}

export async function getTenantDemoExperienceSettings(tenantId: string) {
	const admin = createSupabaseAdminClient();
	const { data, error } = await admin
		.from("tenants")
		.select("demo_settings")
		.eq("id", tenantId)
		.maybeSingle();

	if (error) {
		console.error("[demo-flows] failed to load tenant demo settings", {
			tenantId,
			error,
		});
		return parseDemoExperienceSettings(null);
	}

	return parseDemoExperienceSettings(data?.demo_settings ?? null);
}

export function getEnabledDemoFlows(
	settings: DemoExperienceSettings,
): DemoFlowDefinition[] {
	const ids =
		settings.enabledFlowIds.length > 0
			? settings.enabledFlowIds
			: [DEFAULT_DEMO_FLOW_ID];

	return ids
		.map((id) => demoFlowRegistry[id])
		.filter((flow): flow is DemoFlowDefinition => Boolean(flow));
}

export function getLandingDemoFlow(
	settings: DemoExperienceSettings,
): DemoFlowDefinition {
	if (settings.landingFlowId && demoFlowRegistry[settings.landingFlowId]) {
		return demoFlowRegistry[settings.landingFlowId];
	}

	return getEnabledDemoFlows(settings)[0] ?? demoFlowRegistry[DEFAULT_DEMO_FLOW_ID];
}

export async function getDemoLaunchPath(slug: string, tenantId: string) {
	const settings = await getTenantDemoExperienceSettings(tenantId);
	const landingFlow = getLandingDemoFlow(settings);
	return `/demo/${encodeURIComponent(slug)}/flow/${encodeURIComponent(landingFlow.id)}`;
}
