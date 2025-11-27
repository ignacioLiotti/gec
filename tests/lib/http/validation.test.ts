import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
	ApiValidationError,
	validateJsonBody,
	validateWithSchema,
} from "@/lib/http/validation";

describe("validation helpers", () => {
	it("parses valid payloads", () => {
		const parsed = validateWithSchema(
			z.object({ foo: z.string() }),
			{ foo: "bar" },
			"body"
		);
		expect(parsed).toEqual({ foo: "bar" });
	});

	it("throws ApiValidationError on invalid payloads", () => {
		expect(() =>
			validateWithSchema(z.object({ foo: z.string().min(3) }), { foo: "a" }, "body")
		).toThrowError(ApiValidationError);
	});

	it("validates JSON bodies", async () => {
		const req = new Request("http://localhost", {
			method: "POST",
			body: JSON.stringify({ foo: "bar" }),
			headers: { "content-type": "application/json" },
		});
		const payload = await validateJsonBody(req, z.object({ foo: z.string() }));
		expect(payload.foo).toBe("bar");
	});
});
