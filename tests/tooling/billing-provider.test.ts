import { randomUUID } from "node:crypto";
import { z } from "zod";
import { expect, it } from "vitest";

import { startBillingProviderFixture } from "@/scripts/integration-billing-provider.mjs";

it("keeps synthetic payment transport authenticated, explicitly registered and inspectable without retaining credentials", async () => {
	const provider = await startBillingProviderFixture();
	try {
		const id = randomUUID();
		const tenant = randomUUID();
		const reference = `tenant:${tenant}|plan:e2e-provider-contract`;
		const registration = { namespace: "e2e-provider-contract", preapproval: {
			id, status: "pending", external_reference: reference,
			next_payment_date: "2026-12-01T00:00:00.000Z", init_point: `${provider.url}/checkout/${id}`,
		} };
		const controlHeaders = { "content-type": "application/json", "x-e2e-provider-token": provider.token };
		expect((await fetch(`${provider.url}/fixtures`, { method: "POST", body: JSON.stringify(registration) })).status).toBe(401);
		const created = await fetch(`${provider.url}/fixtures`, { method: "POST", headers: controlHeaders, body: JSON.stringify(registration) });
		expect(created.status).toBe(201);
		const fixture = z.object({ id: z.string().uuid() }).parse(await created.json());
		const headers = { "content-type": "application/json", authorization: `Bearer ${provider.accessToken}`, "x-idempotency-key": randomUUID() };
		const checkout = { external_reference: reference, status: "pending", payer_email: "synthetic@e2e.invalid", reason: "Local payment contract", back_url: `${provider.url}/back`, notification_url: `${provider.url}/webhook`, auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 1200, currency_id: "ARS" } };
		expect((await fetch(`${provider.url}/preapproval`, { method: "POST", headers: controlHeaders, body: JSON.stringify(checkout) })).status).toBe(401);
		const unknown = await fetch(`${provider.url}/preapproval`, { method: "POST", headers, body: JSON.stringify({ ...checkout, external_reference: `tenant:${randomUUID()}|plan:e2e-unregistered` }) });
		expect(unknown.status).toBe(404);
		const accepted = await fetch(`${provider.url}/preapproval`, { method: "POST", headers, body: JSON.stringify(checkout) });
		expect(accepted.status).toBe(201);
		expect(await accepted.json()).toMatchObject({ id, status: "pending", external_reference: reference });
		const statusChange = await fetch(`${provider.url}/fixtures/${fixture.id}`, { method: "PATCH", headers: controlHeaders, body: JSON.stringify({ status: "authorized" }) });
		expect(statusChange.status).toBe(200);
		const read = await fetch(`${provider.url}/preapproval/${id}`, { headers });
		expect(read.status).toBe(200);
		expect(await read.json()).toMatchObject({ id, status: "authorized" });
		const ended = await fetch(`${provider.url}/preapproval/${id}`, { method: "PUT", headers, body: JSON.stringify({ auto_recurring: { end_date: "2026-12-01T00:00:00.000Z" } }) });
		expect(ended.status).toBe(200);
		const observed = await (await fetch(`${provider.url}/fixtures/${fixture.id}`, { headers: controlHeaders })).json();
		expect(observed).toEqual({ requests: [
			{ method: "POST", path: "/preapproval", payload: checkout },
			{ method: "GET", path: `/preapproval/${id}` },
			{ method: "PUT", path: `/preapproval/${id}`, payload: { auto_recurring: { end_date: "2026-12-01T00:00:00.000Z" } } },
		] });
		expect(JSON.stringify(observed)).not.toContain(provider.accessToken);
		expect(JSON.stringify(observed)).not.toContain(provider.token);
		expect((await fetch(`${provider.url}/fixtures/${fixture.id}`, { method: "DELETE", headers: controlHeaders })).status).toBe(200);
		expect((await fetch(`${provider.url}/preapproval/${id}`, { headers })).status).toBe(404);
	} finally {
		await provider.close();
		await provider.close();
	}
	await expect(fetch(`${provider.url}/health`)).rejects.toThrow();
});
