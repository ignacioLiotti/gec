import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubscriptionPlanLimits } from "./subscription-plans";

export type TenantUsageSnapshot = {
	periodStart: string;
	periodEnd: string;
	storageBytes: number;
	aiTokens: number;
	whatsappMessages: number;
};

export type UsageDelta = {
	storageBytes?: number;
	aiTokens?: number;
	whatsappMessages?: number;
};

export type UsageLogEntry = {
	tenantId: string;
	kind: "storage_bytes" | "ai_tokens" | "whatsapp_messages";
	amount: number;
	context?: string | null;
	metadata?: Record<string, unknown>;
};

type UsageRow = {
	id: string;
	tenant_id: string;
	billing_period_start: string;
	billing_period_end: string;
	supabase_storage_bytes: number | string | null;
	ai_tokens_used: number | string | null;
	whatsapp_api_messages: number | string | null;
};

function buildPeriodBounds(date: Date = new Date()): { start: string; end: string } {
	const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
	const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
	const startStr = start.toISOString().slice(0, 10);
	const endStr = end.toISOString().slice(0, 10);
	return { start: startStr, end: endStr };
}

function normalizeNumber(value: number | string | null | undefined): number {
	if (value === null || typeof value === "undefined") return 0;
	const parsed =
		typeof value === "string" ? Number.parseInt(value, 10) : Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function mapUsageRow(
	row: UsageRow | null,
	fallbackPeriod: { start: string; end: string }
): TenantUsageSnapshot {
	const periodStart = row?.billing_period_start ?? fallbackPeriod.start;
	const periodEnd = row?.billing_period_end ?? fallbackPeriod.end;
	return {
		periodStart,
		periodEnd,
		storageBytes: normalizeNumber(row?.supabase_storage_bytes),
		aiTokens: normalizeNumber(row?.ai_tokens_used),
		whatsappMessages: normalizeNumber(row?.whatsapp_api_messages),
	};
}

export async function fetchTenantUsage(
	supabase: SupabaseClient,
	tenantId: string
): Promise<TenantUsageSnapshot> {
	const period = buildPeriodBounds();
	const { start, end } = period;
	const { data, error } = await supabase
		.from("tenant_api_expenses")
		.select(
			"id, tenant_id, billing_period_start, billing_period_end, supabase_storage_bytes, ai_tokens_used, whatsapp_api_messages"
		)
		.eq("tenant_id", tenantId)
		.eq("billing_period_start", start)
		.eq("billing_period_end", end)
		.maybeSingle();

	if (error) {
		console.error("[tenant-usage] Failed to fetch usage snapshot", {
			tenantId,
			error,
		});
	}

	return mapUsageRow((data as UsageRow | null) ?? null, period);
}

export async function incrementTenantUsage(
	supabase: SupabaseClient,
	tenantId: string,
	delta: UsageDelta,
	limits: SubscriptionPlanLimits
): Promise<TenantUsageSnapshot> {
	const payload = {
		p_tenant: tenantId,
		p_storage_delta: Math.trunc(delta.storageBytes ?? 0),
		p_ai_tokens_delta: Math.trunc(delta.aiTokens ?? 0),
		p_whatsapp_delta: Math.trunc(delta.whatsappMessages ?? 0),
		p_storage_limit: limits.storageBytes ?? null,
		p_ai_token_limit: limits.aiTokens ?? null,
		p_whatsapp_limit: limits.whatsappMessages ?? null,
	};

	if (
		payload.p_storage_delta === 0 &&
		payload.p_ai_tokens_delta === 0 &&
		payload.p_whatsapp_delta === 0
	) {
		return fetchTenantUsage(supabase, tenantId);
	}

	const { data, error } = await supabase.rpc(
		"increment_tenant_api_usage",
		payload
	);

	if (error) {
		const code = error.message ?? "usage_increment_failed";
		const enriched = new Error(error.hint ?? error.message);
		(enriched as Error & { code?: string }).code = code;
		throw enriched;
	}

	const period = buildPeriodBounds();
	return mapUsageRow((data as UsageRow | null) ?? null, period);
}

export async function logTenantUsageEvent(
	supabase: SupabaseClient,
	entry: UsageLogEntry
): Promise<void> {
	const payload = {
		tenant_id: entry.tenantId,
		kind: entry.kind,
		amount: Math.trunc(entry.amount),
		context: entry.context ?? null,
		metadata: entry.metadata ?? {},
	};
	const { error } = await supabase.from("tenant_usage_events").insert(payload);
	if (error) {
		console.error("[tenant-usage] Failed to log usage event", error, entry);
	}
}
