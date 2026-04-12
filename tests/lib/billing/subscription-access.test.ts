import { afterEach, describe, expect, it } from "vitest";

import {
	evaluateTenantSubscriptionAccess,
	resolveSubscriptionGraceDays,
	resolveSubscriptionPendingGraceMinutes,
} from "@/lib/billing/subscription-access";

const ORIGINAL_GRACE = process.env.SUBSCRIPTION_GRACE_DAYS;
const ORIGINAL_PENDING_GRACE = process.env.SUBSCRIPTION_PENDING_GRACE_MINUTES;

afterEach(() => {
	if (typeof ORIGINAL_GRACE === "undefined") {
		delete process.env.SUBSCRIPTION_GRACE_DAYS;
	} else {
		process.env.SUBSCRIPTION_GRACE_DAYS = ORIGINAL_GRACE;
	}

	if (typeof ORIGINAL_PENDING_GRACE === "undefined") {
		delete process.env.SUBSCRIPTION_PENDING_GRACE_MINUTES;
	} else {
		process.env.SUBSCRIPTION_PENDING_GRACE_MINUTES = ORIGINAL_PENDING_GRACE;
	}
});

describe("evaluateTenantSubscriptionAccess", () => {
	it("allows when status is missing", () => {
		const result = evaluateTenantSubscriptionAccess({
			status: null,
			currentPeriodEnd: null,
		});
		expect(result).toEqual({ blocked: false, reason: "status_missing" });
	});

	it("allows active-like statuses", () => {
		const result = evaluateTenantSubscriptionAccess({
			status: "AUTHORIZED",
			currentPeriodEnd: null,
		});
		expect(result).toEqual({ blocked: false, reason: "active" });
	});

	it("allows paused status inside grace window", () => {
		const result = evaluateTenantSubscriptionAccess(
			{
				status: "paused",
				currentPeriodStart: null,
				currentPeriodEnd: "2026-04-01T00:00:00.000Z",
			},
			{
				now: new Date("2026-04-03T00:00:00.000Z"),
				gracePeriodDays: 5,
			},
		);
		expect(result).toEqual({ blocked: false, reason: "active" });
	});

	it("blocks when grace window expired", () => {
		const result = evaluateTenantSubscriptionAccess(
			{
				status: "past_due",
				currentPeriodStart: null,
				currentPeriodEnd: "2026-04-01T00:00:00.000Z",
			},
			{
				now: new Date("2026-04-10T00:00:00.000Z"),
				gracePeriodDays: 2,
			},
		);
		expect(result).toEqual({ blocked: true, reason: "grace_period_expired" });
	});

	it("allows pending status during checkout grace window", () => {
		const result = evaluateTenantSubscriptionAccess(
			{
				status: "pending",
				currentPeriodStart: "2026-04-10T00:00:00.000Z",
				currentPeriodEnd: null,
			},
			{
				now: new Date("2026-04-10T00:30:00.000Z"),
				pendingGraceMinutes: 60,
			},
		);
		expect(result).toEqual({ blocked: false, reason: "pending_checkout" });
	});

	it("blocks pending status after checkout grace window", () => {
		const result = evaluateTenantSubscriptionAccess(
			{
				status: "pending",
				currentPeriodStart: "2026-04-10T00:00:00.000Z",
				currentPeriodEnd: null,
			},
			{
				now: new Date("2026-04-10T02:00:00.000Z"),
				pendingGraceMinutes: 60,
			},
		);
		expect(result).toEqual({ blocked: true, reason: "status_blocked" });
	});

	it("blocks hard status values", () => {
		const result = evaluateTenantSubscriptionAccess({
			status: "cancelled",
			currentPeriodStart: null,
			currentPeriodEnd: null,
		});
		expect(result).toEqual({ blocked: true, reason: "status_blocked" });
	});

	it("keeps access until scheduled cancellation date", () => {
		const result = evaluateTenantSubscriptionAccess(
			{
				status: "active",
				currentPeriodStart: "2026-04-01T00:00:00.000Z",
				currentPeriodEnd: "2026-04-30T00:00:00.000Z",
				cancelAtPeriodEnd: true,
				scheduledCancellationAt: "2026-04-30T00:00:00.000Z",
			},
			{
				now: new Date("2026-04-20T00:00:00.000Z"),
			},
		);
		expect(result).toEqual({ blocked: false, reason: "active" });
	});

	it("blocks after scheduled cancellation date", () => {
		const result = evaluateTenantSubscriptionAccess(
			{
				status: "active",
				currentPeriodStart: "2026-04-01T00:00:00.000Z",
				currentPeriodEnd: "2026-04-30T00:00:00.000Z",
				cancelAtPeriodEnd: true,
				scheduledCancellationAt: "2026-04-30T00:00:00.000Z",
			},
			{
				now: new Date("2026-05-01T00:00:00.000Z"),
			},
		);
		expect(result).toEqual({ blocked: true, reason: "cancelled_at_period_end" });
	});
});

describe("resolveSubscriptionPendingGraceMinutes", () => {
	it("reads valid positive integer values", () => {
		process.env.SUBSCRIPTION_PENDING_GRACE_MINUTES = "45";
		expect(resolveSubscriptionPendingGraceMinutes()).toBe(45);
	});

	it("clamps invalid values to zero", () => {
		process.env.SUBSCRIPTION_PENDING_GRACE_MINUTES = "-1";
		expect(resolveSubscriptionPendingGraceMinutes()).toBe(0);

		process.env.SUBSCRIPTION_PENDING_GRACE_MINUTES = "invalid";
		expect(resolveSubscriptionPendingGraceMinutes()).toBe(0);
	});
});

describe("resolveSubscriptionGraceDays", () => {
	it("reads valid positive integer values", () => {
		process.env.SUBSCRIPTION_GRACE_DAYS = "7";
		expect(resolveSubscriptionGraceDays()).toBe(7);
	});

	it("clamps invalid values to zero", () => {
		process.env.SUBSCRIPTION_GRACE_DAYS = "-2";
		expect(resolveSubscriptionGraceDays()).toBe(0);

		process.env.SUBSCRIPTION_GRACE_DAYS = "not-a-number";
		expect(resolveSubscriptionGraceDays()).toBe(0);
	});
});
