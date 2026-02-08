import { createHash } from "crypto";
import type { EngineEvent } from "../core/types";

function stableStringify(value: unknown): string {
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) {
		return `[${value.map((item) => stableStringify(item)).join(",")}]`;
	}
	const entries = Object.entries(value as Record<string, unknown>)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`);
	return `{${entries.join(",")}}`;
}

export function buildDedupeKey(event: EngineEvent): string {
	if (event.dedupeKey) return event.dedupeKey;
	const payload = stableStringify(event.payload ?? null);
	const raw = `${event.type}:${event.runId ?? "global"}:${payload}`;
	return createHash("sha256").update(raw).digest("hex");
}
