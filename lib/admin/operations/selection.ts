import { z } from "zod";
import { validateSearchParams } from "@/lib/http/validation";
import type { ObservationWindow, OperationsSelection } from "./types";

const SelectionSchema = z.object({
	tenantId: z.string().uuid().optional(),
	days: z.enum(["7", "30", "90"]).default("30"),
}).strict();

export function parseOperationsSelection(params: URLSearchParams): OperationsSelection {
	const parsed = validateSearchParams(params, SelectionSchema);
	return { tenantId: parsed.tenantId ?? null, days: parsed.days === "7" ? 7 : parsed.days === "90" ? 90 : 30 };
}

export function observationWindow(days: OperationsSelection["days"], now: Date): ObservationWindow {
	const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
	const duration = days * 86_400_000;
	return {
		start: new Date(end - duration).toISOString(),
		end: new Date(end).toISOString(),
		liveEnd: now.toISOString(),
		previousStart: new Date(end - duration * 2).toISOString(),
		timeZone: "UTC",
	};
}
