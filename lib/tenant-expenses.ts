export const TENANT_EXPENSE_SELECT_FIELDS = `
	id,
	tenant_id,
	billing_period_start,
	billing_period_end,
	supabase_storage_bytes,
	supabase_storage_limit_bytes,
	ai_tokens_used,
	ai_token_budget,
	whatsapp_api_messages,
	whatsapp_api_budget,
	currency,
	notes,
	updated_at
`;

export type TenantExpenseRecord = {
	id: string;
	tenant_id: string;
	billing_period_start: string;
	billing_period_end: string;
	supabase_storage_bytes: number | null;
	supabase_storage_limit_bytes: number | null;
	ai_tokens_used: number | null;
	ai_token_budget: number | null;
	whatsapp_api_messages: number | null;
	whatsapp_api_budget: number | null;
	currency: string | null;
	notes: string | null;
	updated_at: string | null;
};

export type TenantExpenseSnapshot = {
	id: string;
	tenantId: string;
	tenantName: string;
	billingPeriodStart: string;
	billingPeriodEnd: string;
	supabaseStorageBytes: number;
	supabaseStorageLimitBytes: number;
	aiTokensUsed: number;
	aiTokenBudget: number;
	whatsappMessages: number;
	whatsappBudget: number;
	currency: string | null;
	updatedAt: string | null;
	notes?: string | null;
	ownerName?: string | null;
	ownerId?: string | null;
};

export function normalizeTenantExpense(
	row: TenantExpenseRecord,
	metadata?: { tenantName?: string | null; ownerName?: string | null; ownerId?: string | null }
): TenantExpenseSnapshot {
	return {
		id: row.id,
		tenantId: row.tenant_id,
		tenantName: metadata?.tenantName ?? "Organización",
		billingPeriodStart: row.billing_period_start,
		billingPeriodEnd: row.billing_period_end,
		supabaseStorageBytes: row.supabase_storage_bytes ?? 0,
		supabaseStorageLimitBytes: row.supabase_storage_limit_bytes ?? 0,
		aiTokensUsed: row.ai_tokens_used ?? 0,
		aiTokenBudget: row.ai_token_budget ?? 0,
		whatsappMessages: row.whatsapp_api_messages ?? 0,
		whatsappBudget: row.whatsapp_api_budget ?? 0,
		currency: row.currency,
		updatedAt: row.updated_at,
		notes: row.notes ?? undefined,
		ownerName: metadata?.ownerName,
		ownerId: metadata?.ownerId,
	};
}

export type ExpenseUsageSummary = {
	trackedTenants: number;
	storageBytesUsed: number;
	storageBytesLimit: number;
	aiTokensUsed: number;
	aiTokenBudget: number;
	whatsappMessages: number;
	whatsappBudget: number;
};

export function summarizeLatestUsage(rows: TenantExpenseSnapshot[]): ExpenseUsageSummary {
	const latestByTenant = getLatestExpenseByTenant(rows);
	let storageUsed = 0;
	let storageLimit = 0;
	let aiUsed = 0;
	let aiLimit = 0;
	let whatsappUsed = 0;
	let whatsappLimit = 0;

	for (const snapshot of latestByTenant.values()) {
		storageUsed += snapshot.supabaseStorageBytes;
		storageLimit += snapshot.supabaseStorageLimitBytes;
		aiUsed += snapshot.aiTokensUsed;
		aiLimit += snapshot.aiTokenBudget;
		whatsappUsed += snapshot.whatsappMessages;
		whatsappLimit += snapshot.whatsappBudget;
	}

	return {
		trackedTenants: latestByTenant.size,
		storageBytesUsed: storageUsed,
		storageBytesLimit: storageLimit,
		aiTokensUsed: aiUsed,
		aiTokenBudget: aiLimit,
		whatsappMessages: whatsappUsed,
		whatsappBudget: whatsappLimit,
	};
}

export function getLatestExpenseByTenant(
	rows: TenantExpenseSnapshot[]
): Map<string, TenantExpenseSnapshot> {
	const latest = new Map<string, TenantExpenseSnapshot>();
	for (const snapshot of rows) {
		const existing = latest.get(snapshot.tenantId);
		if (!existing) {
			latest.set(snapshot.tenantId, snapshot);
			continue;
		}
		const existingDate = new Date(existing.billingPeriodEnd).getTime();
		const currentDate = new Date(snapshot.billingPeriodEnd).getTime();
		if (currentDate >= existingDate) {
			latest.set(snapshot.tenantId, snapshot);
		}
	}
	return latest;
}

export function findTenantsWithoutUsage(
	tenantIds: string[],
	rows: TenantExpenseSnapshot[]
): string[] {
	const withData = new Set(rows.map((row) => row.tenantId));
	return tenantIds.filter((tenantId) => !withData.has(tenantId));
}

export function formatReadableBytes(value: number): string {
	if (value <= 0) return "0 GB";
	const units = ["B", "KB", "MB", "GB", "TB", "PB"];
	let size = value;
	let unitIndex = 0;
	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex += 1;
	}
	const rounded = size >= 10 ? Math.round(size) : Math.round(size * 10) / 10;
	return `${rounded} ${units[unitIndex]}`;
}

export function formatCompactNumber(value: number): string {
	if (!Number.isFinite(value) || value === 0) return "0";
	const abs = Math.abs(value);
	if (abs >= 1_000_000_000) return `${trimTrailingZeros(value / 1_000_000_000)}B`;
	if (abs >= 1_000_000) return `${trimTrailingZeros(value / 1_000_000)}M`;
	if (abs >= 1_000) return `${trimTrailingZeros(value / 1_000)}k`;
	return new Intl.NumberFormat("es-AR").format(value);
}

function trimTrailingZeros(value: number): string {
	const fixed = value.toFixed(1);
	return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
}
