import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_PLAN_KEY = "starter";
const FALLBACK_PLAN_NAME = "Starter";

export type SubscriptionPlanLimits = {
	storageBytes: number | null;
	aiTokens: number | null;
	whatsappMessages: number | null;
};

export type SubscriptionPlan = {
	key: string;
	name: string;
	description: string | null;
	limits: SubscriptionPlanLimits;
};

type SubscriptionRow = {
	plan_key: string;
	status: string;
	storage_limit_bytes_override: number | string | null;
	ai_token_budget_override: number | string | null;
	whatsapp_message_budget_override: number | string | null;
	subscription_plans: {
		plan_key: string;
		name: string;
		description: string | null;
		storage_limit_bytes: number | string | null;
		ai_token_budget: number | string | null;
		whatsapp_message_budget: number | string | null;
	} | null;
};

type RawSubscriptionRow = Omit<SubscriptionRow, "subscription_plans"> & {
	subscription_plans:
		| SubscriptionRow["subscription_plans"]
		| SubscriptionRow["subscription_plans"][];
};

function normalizeSubscriptionRow(row: RawSubscriptionRow): SubscriptionRow {
	return {
		...row,
		subscription_plans: Array.isArray(row.subscription_plans)
			? row.subscription_plans[0] ?? null
			: row.subscription_plans,
	};
}

function normalizeLimit(value: number | string | null | undefined): number | null {
	if (value === null || typeof value === "undefined") return null;
	const parsed =
		typeof value === "string" ? Number.parseInt(value, 10) : Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function mapPlan(row: SubscriptionRow | null): SubscriptionPlan {
	const plan = row?.subscription_plans;
	const overrideStorage = normalizeLimit(row?.storage_limit_bytes_override);
	const overrideTokens = normalizeLimit(row?.ai_token_budget_override);
	const overrideWhatsapp = normalizeLimit(row?.whatsapp_message_budget_override);
	return {
		key: plan?.plan_key ?? row?.plan_key ?? DEFAULT_PLAN_KEY,
		name: plan?.name ?? FALLBACK_PLAN_NAME,
		description: plan?.description ?? null,
		limits: {
			storageBytes: overrideStorage ?? normalizeLimit(plan?.storage_limit_bytes),
			aiTokens: overrideTokens ?? normalizeLimit(plan?.ai_token_budget),
			whatsappMessages:
				overrideWhatsapp ?? normalizeLimit(plan?.whatsapp_message_budget),
		},
	};
}

export async function fetchPlanByKey(
	supabase: SupabaseClient,
	planKey: string
): Promise<SubscriptionPlan | null> {
	const { data, error } = await supabase
		.from("subscription_plans")
		.select(
			"plan_key, name, description, storage_limit_bytes, ai_token_budget, whatsapp_message_budget"
		)
		.eq("plan_key", planKey)
		.maybeSingle();

	if (error) {
		console.error("[subscription-plans] Failed to load plan", error);
		return null;
	}

	if (!data) return null;

	return {
		key: data.plan_key,
		name: data.name,
		description: data.description,
		limits: {
			storageBytes: normalizeLimit(data.storage_limit_bytes),
			aiTokens: normalizeLimit(data.ai_token_budget),
			whatsappMessages: normalizeLimit(data.whatsapp_message_budget),
		},
	};
}

export async function fetchTenantPlan(
	supabase: SupabaseClient,
	tenantId: string
): Promise<SubscriptionPlan> {
	const { data, error } = await supabase
		.from("tenant_subscriptions")
		.select(
			`plan_key,
			 status,
			 storage_limit_bytes_override,
			 ai_token_budget_override,
			 whatsapp_message_budget_override,
			 subscription_plans(plan_key, name, description, storage_limit_bytes, ai_token_budget, whatsapp_message_budget)`
		)
		.eq("tenant_id", tenantId)
		.maybeSingle();

	if (error) {
		console.error("[subscription-plans] Failed to load tenant subscription", {
			tenantId,
			error,
		});
	}

	if (data) {
		return mapPlan(normalizeSubscriptionRow(data as RawSubscriptionRow));
	}

	// Fallback to default plan definition if tenant has no subscription yet.
	const fallback = await fetchPlanByKey(supabase, DEFAULT_PLAN_KEY);
	return (
		fallback ?? {
			key: DEFAULT_PLAN_KEY,
			name: FALLBACK_PLAN_NAME,
			description: null,
			limits: {
				storageBytes: null,
				aiTokens: null,
				whatsappMessages: null,
			},
		}
	);
}
