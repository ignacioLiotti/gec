import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
	ApiValidationError,
	validateJsonBody,
} from "@/lib/http/validation";

describe("validation helpers", () => {
	it("returns validated and coerced JSON rather than the raw request", async () => {
		const req = new Request("http://localhost", {
			method: "POST",
			body: JSON.stringify({ rows: [{ quantity: "2", amount: "1200.50" }], ignored: "strip this" }),
			headers: { "content-type": "application/json" },
		});
		const schema = z.object({
			rows: z.array(z.object({ quantity: z.coerce.number().int().positive(), amount: z.coerce.number().positive() })),
		});
		await expect(validateJsonBody(req, schema)).resolves.toEqual({ rows: [{ quantity: 2, amount: 1200.5 }] });
	});

	it("maps nested validation failures to the HTTP error contract", async () => {
		const req = new Request("http://localhost", {
			method: "POST",
			body: JSON.stringify({ rows: [{ amount: -1 }] }),
		});
		const validation = validateJsonBody(req, z.object({ rows: z.array(z.object({ amount: z.number().positive() })) }));
		await expect(validation).rejects.toBeInstanceOf(ApiValidationError);
		await expect(validation).rejects.toMatchObject({
			status: 400,
			issues: [expect.stringContaining("rows.0.amount")],
			fieldErrors: { rows: [expect.any(String)] },
		});
	});

	it("distinguishes malformed JSON from an invalid domain value", async () => {
		const req = new Request("http://localhost", { method: "POST", body: "{broken" });
		await expect(validateJsonBody(req, z.object({ amount: z.number() }))).rejects.toMatchObject({
			name: "ApiValidationError", status: 400, issues: ["invalid_json"],
		});
	});
});
