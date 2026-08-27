import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { canEditObras } from "@/lib/obras/permissions";

describe("canEditObras", () => {
	it("requests the tenant-scoped obras:edit permission", async () => {
		const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
		const supabase = { rpc } as unknown as SupabaseClient;

		await expect(canEditObras(supabase, "tenant-1")).resolves.toBe(true);
		expect(rpc).toHaveBeenCalledWith("has_permission", {
			tenant: "tenant-1",
			perm_key: "obras:edit",
		});
	});

	it("returns false when the permission is not granted", async () => {
		const supabase = {
			rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
		} as unknown as SupabaseClient;

		await expect(canEditObras(supabase, "tenant-1")).resolves.toBe(false);
	});

	it("surfaces permission lookup failures", async () => {
		const error = new Error("rpc unavailable");
		const supabase = {
			rpc: vi.fn().mockResolvedValue({ data: null, error }),
		} as unknown as SupabaseClient;

		await expect(canEditObras(supabase, "tenant-1")).rejects.toBe(error);
	});
});
