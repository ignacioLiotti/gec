import { describe, expect, it } from "vitest";

import { resolveObraDeleteStatus } from "@/lib/obras/delete-lifecycle";

describe("resolveObraDeleteStatus", () => {
	it("returns purged when purged_at exists", () => {
		expect(
			resolveObraDeleteStatus({
				restoredAt: null,
				purgedAt: "2026-04-01T10:00:00.000Z",
				restoreDeadlineAt: "2026-04-15T10:00:00.000Z",
				nowMs: Date.parse("2026-04-02T10:00:00.000Z"),
			}),
		).toBe("purged");
	});

	it("returns restored when restored_at exists and not purged", () => {
		expect(
			resolveObraDeleteStatus({
				restoredAt: "2026-04-01T10:00:00.000Z",
				purgedAt: null,
				restoreDeadlineAt: "2026-04-15T10:00:00.000Z",
				nowMs: Date.parse("2026-04-02T10:00:00.000Z"),
			}),
		).toBe("restored");
	});

	it("returns expired when deadline elapsed", () => {
		expect(
			resolveObraDeleteStatus({
				restoredAt: null,
				purgedAt: null,
				restoreDeadlineAt: "2026-04-01T10:00:00.000Z",
				nowMs: Date.parse("2026-04-02T10:00:00.000Z"),
			}),
		).toBe("expired");
	});

	it("returns deleted when still inside restore window", () => {
		expect(
			resolveObraDeleteStatus({
				restoredAt: null,
				purgedAt: null,
				restoreDeadlineAt: "2026-04-30T10:00:00.000Z",
				nowMs: Date.parse("2026-04-02T10:00:00.000Z"),
			}),
		).toBe("deleted");
	});
});
