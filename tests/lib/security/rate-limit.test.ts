import { describe, expect, it } from "vitest";
import { getClientIp } from "@/lib/security/rate-limit";

describe("getClientIp", () => {
	it("prefers x-forwarded-for header", () => {
		const req = new Request("http://localhost", {
			headers: {
				"x-forwarded-for": "10.0.0.1, 10.0.0.2",
			},
		}) as Request & { ip?: string };
		expect(getClientIp(req)).toBe("10.0.0.1");
	});

	it("falls back to request.ip", () => {
		const req = new Request("http://localhost") as Request & {
			ip?: string;
		};
		req.ip = "127.0.0.1";
		expect(getClientIp(req)).toBe("127.0.0.1");
	});
});
