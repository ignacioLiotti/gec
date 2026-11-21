import { z } from "zod";
import { expect, test } from "../fixtures/test";
import { withBillingProvider } from "./provider";

const subscriptionSchema = z.object({
	tenantId: z.string(),
	subscription: z.object({
		plan_key: z.string(), status: z.string(), external_subscription_id: z.string().nullable(),
		metadata: z.object({ cancelAtPeriodEnd: z.boolean().optional() }).passthrough(),
	}),
	paywall: z.object({ blocked: z.boolean(), reason: z.string() }),
});

test("BILL-01 members cannot checkout or cancel and subscription reads remain tenant scoped", async ({ scenario }) => {
	const { planKey } = await scenario.billingMobile.seedSubscription({ status: "active" });
	const owner = await scenario.actor("owner");
	const viewer = await scenario.actor("viewer");
	const other = await scenario.actor("otherOwner");
	await withBillingProvider({ namespace: scenario.namespace, tenantId: scenario.tenants.a, planKey, status: "pending" }, async (provider) => {
		for (const endpoint of ["checkout", "cancel"]) {
			const response = await viewer.request.post(`/api/billing/mercadopago/${endpoint}`, { data: { planKey } });
			expect(response.status()).toBe(403);
		}
		const own = await owner.db.from("tenant_subscriptions").select("tenant_id,plan_key").eq("tenant_id", scenario.tenants.a);
		expect(own.error).toBeNull();
		expect(own.data).toEqual([{ tenant_id: scenario.tenants.a, plan_key: planKey }]);
		const foreign = await other.db.from("tenant_subscriptions").select("tenant_id").eq("tenant_id", scenario.tenants.a);
		expect(foreign.error).toBeNull();
		expect(foreign.data).toEqual([]);
		expect((await provider.read()).requests).toEqual([]);
	});
});

test("BILL-02 owner checkout, signed activation, replay, and admin period-end cancellation preserve access", async ({ scenario }) => {
	test.setTimeout(120_000);
	const { planKey } = await scenario.billingMobile.seedSubscription({ status: "cancelled" });
	const owner = await scenario.actor("owner");
	const admin = await scenario.actor("admin");
	const webhook = await scenario.newAnonymousContext();
	try {
		await withBillingProvider({ namespace: scenario.namespace, tenantId: scenario.tenants.a, planKey, status: "pending" }, async (provider) => {
			const blocked = await owner.request.get("/api/obras");
			expect(blocked.status()).toBe(402);
			const checkout = await owner.request.post("/api/billing/mercadopago/checkout", { data: { planKey } });
			expect(checkout.status()).toBe(200);
			expect(await checkout.json()).toMatchObject({ preapprovalId: provider.id, requestedStatus: "pending", status: "pending" });
			expect((await provider.read()).requests[0]).toMatchObject({
				method: "POST", payload: {
					external_reference: `tenant:${scenario.tenants.a}|plan:${planKey}`,
					auto_recurring: { transaction_amount: 1200, currency_id: "ARS", frequency: 1, frequency_type: "months" },
				},
			});
			await provider.setStatus("authorized");
			const headers = provider.headers();
			for (let delivery = 0; delivery < 2; delivery++) {
				const response = await webhook.request.post("/api/billing/mercadopago/webhook", { headers, data: { type: "subscription_preapproval", data: { id: provider.id } } });
				expect(response.status()).toBe(200);
			}
			const read = await owner.request.get("/api/billing/subscription");
			expect(read.status()).toBe(200);
			expect(subscriptionSchema.parse(await read.json())).toMatchObject({
				tenantId: scenario.tenants.a, subscription: { plan_key: planKey, status: "active", external_subscription_id: provider.id },
				paywall: { blocked: false },
			});
			const rows = await owner.db.from("tenant_subscriptions").select("tenant_id").eq("tenant_id", scenario.tenants.a);
			expect(rows.error).toBeNull();
			expect(rows.data).toHaveLength(1);
			expect((await owner.request.get("/api/obras")).status()).toBe(200);
			const cancel = await admin.request.post("/api/billing/mercadopago/cancel");
			expect(cancel.status()).toBe(200);
			expect(await cancel.json()).toMatchObject({ cancelAtPeriodEnd: true, scheduledCancellationAt: provider.periodEnd, status: "active" });
			const after = subscriptionSchema.parse(await (await owner.request.get("/api/billing/subscription")).json());
			expect(after.subscription.metadata.cancelAtPeriodEnd).toBe(true);
			expect(after.paywall.blocked).toBe(false);
			expect((await provider.read()).requests).toContainEqual({
				method: "PUT", path: `/preapproval/${provider.id}`, payload: { auto_recurring: { end_date: provider.periodEnd } },
			});
		});
	} finally { await webhook.close(); }
});

test("BILL-03 invalid webhook signature cannot reach provider or change subscription", async ({ scenario }) => {
	const { planKey } = await scenario.billingMobile.seedSubscription({ status: "active" });
	const owner = await scenario.actor("owner");
	const context = await scenario.newAnonymousContext();
	const before = await owner.db.from("tenant_subscriptions").select("*").eq("tenant_id", scenario.tenants.a).single();
	expect(before.error).toBeNull();
	try {
		await withBillingProvider({ namespace: scenario.namespace, tenantId: scenario.tenants.a, planKey, status: "cancelled" }, async (provider) => {
			const response = await context.request.post("/api/billing/mercadopago/webhook", {
				headers: { "x-request-id": "invalid-signature-case", "x-signature": "ts=1,v1=00" },
				data: { data: { id: provider.id } },
			});
			expect(response.status()).toBe(401);
			expect((await provider.read()).requests).toEqual([]);
			const row = await owner.db.from("tenant_subscriptions").select("*").eq("tenant_id", scenario.tenants.a).single();
			expect(row.error).toBeNull();
			expect(row.data).toEqual(before.data);
		});
	} finally { await context.close(); }
});

test("BILL-04 delayed cancelled event for superseded preapproval cannot revoke the current subscription", async ({ scenario }) => {
	const oldPlan = await scenario.billingMobile.seedSubscription({ status: "active" });
	const currentPlan = await scenario.billingMobile.seedSubscription({ status: "active" });
	const owner = await scenario.actor("owner");
	const context = await scenario.newAnonymousContext();
	try {
		await withBillingProvider({ namespace: scenario.namespace, tenantId: scenario.tenants.a, planKey: oldPlan.planKey, status: "authorized" }, async (old) => {
			await withBillingProvider({ namespace: scenario.namespace, tenantId: scenario.tenants.a, planKey: currentPlan.planKey, status: "authorized" }, async (current) => {
				const previousCheckout = await owner.request.post("/api/billing/mercadopago/checkout", { data: { planKey: oldPlan.planKey } });
				expect(previousCheckout.status()).toBe(200);
				const checkout = await owner.request.post("/api/billing/mercadopago/checkout", { data: { planKey: currentPlan.planKey } });
				expect(checkout.status()).toBe(200);
				const before = await owner.db.from("tenant_subscriptions").select("*").eq("tenant_id", scenario.tenants.a).single();
				expect(before.error).toBeNull();
				expect(before.data).toMatchObject({ status: "active", plan_key: currentPlan.planKey, external_subscription_id: current.id });
				await old.setStatus("cancelled");
				const late = await context.request.post("/api/billing/mercadopago/webhook", {
					headers: old.headers(), data: { type: "subscription_preapproval", data: { id: old.id } },
				});
				expect(late.ok()).toBe(true);
				const row = await owner.db.from("tenant_subscriptions").select("*").eq("tenant_id", scenario.tenants.a).single();
				expect(row.error).toBeNull();
				expect(row.data).toEqual(before.data);
				expect((await old.read()).requests.map(({ method, path }) => ({ method, path }))).toEqual([
					{ method: "POST", path: "/preapproval" }, { method: "GET", path: `/preapproval/${old.id}` },
				]);
				expect((await current.read()).requests.map(({ method, path }) => ({ method, path }))).toEqual([{ method: "POST", path: "/preapproval" }]);
				const fresh = await scenario.newContext("owner");
				try {
					const read = await fresh.request.get("/api/billing/subscription");
					expect(read.status()).toBe(200);
					expect(subscriptionSchema.parse(await read.json())).toMatchObject({
						subscription: { plan_key: currentPlan.planKey, status: "active", external_subscription_id: current.id },
						paywall: { blocked: false },
					});
					expect((await fresh.request.get("/api/obras")).status()).toBe(200);
				} finally { await fresh.close(); }
			});
		});
	} finally { await context.close(); }
});
