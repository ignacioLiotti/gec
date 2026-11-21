import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { recordOcrObservation, resolveOcrInitiator, type OcrObservationContext } from "@/lib/ocr-observation";

const context = {
	tenantId: "tenant-a",
	extractionId: "extraction-a",
	actorId: "person-a",
	initiatorId: "person-a",
	actorType: "user",
	obraId: "obra-a",
	tablaIds: ["table-a", "table-b"],
	preview: false,
	simulation: false,
	impersonation: false,
	test: false,
	startedAt: 1_000,
} satisfies OcrObservationContext;

function recordingClient() {
	const requests: { url: string; body: unknown }[] = [];
	const supabase = createClient("http://127.0.0.1:54321", "synthetic-test-key", {
		auth: { persistSession: false, autoRefreshToken: false },
		global: {
			fetch: async (input, init) => {
				requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
				return new Response(null, { status: 201 });
			},
		},
	});
	return { supabase, requests };
}

describe("OCR operation observation", () => {
	it("links a multi-table request and completion without charging quotas or copying source data", async () => {
		const { supabase, requests } = recordingClient();
		const sourceContext = { ...context, documentText: "PRIVATE DOCUMENT", providerToken: "PRIVATE TOKEN" };
		await recordOcrObservation(supabase, sourceContext, { phase: "started" });
		await recordOcrObservation(supabase, sourceContext, { phase: "completed", rowsExtracted: 12 });
		expect(requests).toHaveLength(2);
		expect(requests.every(request => request.url.endsWith("/rest/v1/tenant_usage_events"))).toBe(true);
		expect(requests.map(request => request.body)).toEqual([
			expect.objectContaining({ tenant_id: "tenant-a", amount: 0, context: "ocr_operation_started" }),
			expect.objectContaining({ tenant_id: "tenant-a", amount: 0, context: "ocr_operation_completed", metadata: expect.objectContaining({ extractionId: "extraction-a", actorId: "person-a", tablaIds: ["table-a", "table-b"], rowsExtracted: 12 }) }),
		]);
		expect(JSON.stringify(requests)).not.toContain("PRIVATE");
	});

	it("preserves exclusion flags and emits only a bounded error code", async () => {
		const { supabase, requests } = recordingClient();
		await recordOcrObservation(supabase, { ...context, actorId: null, actorType: "demo", preview: true, simulation: true, impersonation: true, test: true }, { phase: "failed", errorCode: "provider included PRIVATE DOCUMENT" });
		expect(requests[0].body).toEqual(expect.objectContaining({ metadata: expect.objectContaining({ actorId: null, actorType: "demo", preview: true, simulation: true, impersonation: true, test: true, errorCode: "ocr_failed" }) }));
		expect(JSON.stringify(requests)).not.toContain("PRIVATE");
	});

	it("does not reject a business result when the observation transport fails", async () => {
		const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const client = createClient("http://127.0.0.1:54321", "synthetic-test-key", {
			auth: { persistSession: false, autoRefreshToken: false },
			global: { fetch: async () => { throw new Error("offline"); } },
		});
		try {
			await expect(recordOcrObservation(client, context, { phase: "completed", rowsExtracted: 1 })).resolves.toBeUndefined();
		} finally {
			warning.mockRestore();
			error.mockRestore();
		}
	});
});

describe("OCR originating identity", () => {
	const encodedSession = Buffer.from(JSON.stringify({ access_token: "synthetic-origin-token" })).toString("base64");

	function identityClient(identity: { id: string; email: string } | null) {
		const requests: string[] = [];
		const supabase = createClient("http://127.0.0.1:54321", "synthetic-test-key", {
			auth: { persistSession: false, autoRefreshToken: false },
			global: { fetch: async (input) => {
				requests.push(String(input));
				return identity
					? Response.json({ ...identity, aud: "authenticated", created_at: "2026-01-01T00:00:00Z" })
					: Response.json({ message: "invalid token" }, { status: 401 });
			} },
		});
		return { supabase, requests };
	}

	it("uses the executing actor without contacting auth when no original session exists", async () => {
		const { supabase, requests } = identityClient(null);
		expect(await resolveOcrInitiator(supabase, "person-a", undefined)).toEqual({ initiatorId: "person-a", impersonation: false });
		expect(requests).toHaveLength(0);
	});

	it("retains the server-verified original owner separately from the executing actor", async () => {
		const { supabase, requests } = identityClient({ id: "original-owner", email: "ignaciolati@gmail.com" });
		expect(await resolveOcrInitiator(supabase, "person-a", encodedSession)).toEqual({ initiatorId: "original-owner", impersonation: true });
		expect(requests).toEqual(["http://127.0.0.1:54321/auth/v1/user"]);
	});

	it("marks an invalid original session as unknown", async () => {
		const { supabase } = identityClient(null);
		expect(await resolveOcrInitiator(supabase, "person-a", encodedSession)).toEqual({ initiatorId: null, impersonation: null });
	});

	it("does not accept an unrelated authenticated user as the impersonating operator", async () => {
		const { supabase } = identityClient({ id: "another-user", email: "synthetic@example.test" });
		expect(await resolveOcrInitiator(supabase, "person-a", encodedSession)).toEqual({ initiatorId: null, impersonation: null });
	});

	it("rejects malformed or excessive cookie input before auth", async () => {
		const { supabase, requests } = identityClient(null);
		for (const value of ["invalid", "a".repeat(32_769)]) {
			expect(await resolveOcrInitiator(supabase, "person-a", value)).toEqual({ initiatorId: null, impersonation: null });
		}
		expect(requests).toHaveLength(0);
	});
});
