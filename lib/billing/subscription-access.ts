export type SubscriptionAccessReason =
	| "status_missing"
	| "status_blocked"
	| "grace_period_expired"
	| "cancelled_at_period_end"
	| "pending_checkout"
	| "active";

export type TenantSubscriptionSnapshot = {
	status: string | null | undefined;
	currentPeriodStart?: string | null | undefined;
	currentPeriodEnd: string | null | undefined;
	cancelAtPeriodEnd?: boolean;
	scheduledCancellationAt?: string | null | undefined;
};

export type SubscriptionAccessResult = {
	blocked: boolean;
	reason: SubscriptionAccessReason;
};

const ACTIVE_STATUSES = new Set(["active", "authorized", "trialing"]);
const PENDING_STATUSES = new Set(["pending", "in_process"]);
const GRACE_STATUSES = new Set(["past_due", "paused"]);

function normalizeStatus(status: string | null | undefined) {
	return (status ?? "").trim().toLowerCase();
}

function parseDate(value: string | null | undefined) {
	if (!value) return null;
	const timestamp = new Date(value).getTime();
	if (!Number.isFinite(timestamp)) return null;
	return timestamp;
}

export function evaluateTenantSubscriptionAccess(
	subscription: TenantSubscriptionSnapshot,
	options?: {
		now?: Date;
		gracePeriodDays?: number;
		pendingGraceMinutes?: number;
	},
): SubscriptionAccessResult {
	const status = normalizeStatus(subscription.status);
	const now = options?.now ?? new Date();
	const gracePeriodDays = Math.max(0, options?.gracePeriodDays ?? 0);
	const pendingGraceMinutes = Math.max(0, options?.pendingGraceMinutes ?? 0);
	const cancellationAt = parseDate(
		subscription.scheduledCancellationAt ?? subscription.currentPeriodEnd,
	);

	if (subscription.cancelAtPeriodEnd && cancellationAt != null && now.getTime() > cancellationAt) {
		return { blocked: true, reason: "cancelled_at_period_end" };
	}

	if (!status) {
		return { blocked: false, reason: "status_missing" };
	}

	if (ACTIVE_STATUSES.has(status)) {
		return { blocked: false, reason: "active" };
	}

	if (PENDING_STATUSES.has(status)) {
		if (pendingGraceMinutes <= 0) {
			return { blocked: true, reason: "status_blocked" };
		}

		const pendingStartTimestamp = parseDate(subscription.currentPeriodStart);
		if (pendingStartTimestamp == null) {
			return { blocked: true, reason: "status_blocked" };
		}

		const pendingGraceMs = pendingGraceMinutes * 60 * 1000;
		if (now.getTime() <= pendingStartTimestamp + pendingGraceMs) {
			return { blocked: false, reason: "pending_checkout" };
		}
		return { blocked: true, reason: "status_blocked" };
	}

	if (GRACE_STATUSES.has(status)) {
		const endTimestamp = parseDate(subscription.currentPeriodEnd);
		if (endTimestamp == null) {
			return { blocked: true, reason: "grace_period_expired" };
		}
		const graceWindowMs = gracePeriodDays * 24 * 60 * 60 * 1000;
		const effectiveEnd = endTimestamp + graceWindowMs;
		if (now.getTime() <= effectiveEnd) {
			return { blocked: false, reason: "active" };
		}
		return { blocked: true, reason: "grace_period_expired" };
	}

	return { blocked: true, reason: "status_blocked" };
}

export function resolveSubscriptionGraceDays() {
	const raw = Number(process.env.SUBSCRIPTION_GRACE_DAYS ?? 0);
	if (!Number.isFinite(raw) || raw < 0) return 0;
	return Math.trunc(raw);
}

export function resolveSubscriptionPendingGraceMinutes() {
	const raw = Number(process.env.SUBSCRIPTION_PENDING_GRACE_MINUTES ?? 60);
	if (!Number.isFinite(raw) || raw < 0) return 0;
	return Math.trunc(raw);
}
