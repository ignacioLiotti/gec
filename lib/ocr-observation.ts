import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { OWNER_IMPERSONATION_EMAIL } from "@/lib/impersonation-access";
import { logTenantUsageEvent } from "@/lib/tenant-usage";

export type OcrObservationContext = {
	tenantId: string;
	extractionId: string;
	actorId: string | null;
	initiatorId: string | null;
	actorType: "user" | "demo";
	obraId: string;
	tablaIds: readonly string[];
	preview: boolean;
	simulation: boolean;
	impersonation: boolean | null;
	test: boolean;
	startedAt: number;
};

type OcrOutcome =
	| { phase: "started" }
	| { phase: "completed"; rowsExtracted: number }
	| { phase: "failed"; errorCode: string };

const sessionSchema = z.object({ access_token: z.string().min(1).max(16_384) });

/** Resolve the original authenticated identity without trusting the UI impersonation flag. */
export async function resolveOcrInitiator(
	supabase: SupabaseClient,
	actorId: string | null,
	encodedSession: string | undefined,
): Promise<{ initiatorId: string | null; impersonation: boolean | null }> {
	if (!encodedSession) return { initiatorId: actorId, impersonation: false };
	try {
		if (encodedSession.length > 32_768) return { initiatorId: null, impersonation: null };
		const session = sessionSchema.parse(JSON.parse(Buffer.from(encodedSession, "base64").toString("utf8")));
		const { data, error } = await supabase.auth.getUser(session.access_token);
		if (error || !data.user) return { initiatorId: null, impersonation: null };
		if (data.user.id === actorId) return { initiatorId: actorId, impersonation: false };
		if (data.user.email?.trim().toLowerCase() === OWNER_IMPERSONATION_EMAIL) {
			return { initiatorId: data.user.id, impersonation: true };
		}
	} catch {
		// Unverifiable origin stays unknown and is excluded from human-use observations.
	}
	return { initiatorId: null, impersonation: null };
}

/** Observation only: never increments quotas or copies document/provider payloads. */
export async function recordOcrObservation(
	supabase: SupabaseClient,
	context: OcrObservationContext,
	outcome: OcrOutcome,
): Promise<void> {
	const metadata = {
		extractionId: context.extractionId,
		actorId: context.actorId,
		initiatorId: context.initiatorId,
		actorType: context.actorType,
		obraId: context.obraId,
		tablaIds: [...context.tablaIds],
		preview: context.preview,
		simulation: context.simulation,
		impersonation: context.impersonation,
		test: context.test,
		durationMs: Math.max(0, Date.now() - context.startedAt),
		...(outcome.phase === "completed"
			? { rowsExtracted: Math.max(0, Math.trunc(outcome.rowsExtracted)) }
			: {}),
		...(outcome.phase === "failed"
			? { errorCode: /^[a-z0-9_:-]{1,80}$/i.test(outcome.errorCode) ? outcome.errorCode : "ocr_failed" }
			: {}),
	};
	try {
		await logTenantUsageEvent(supabase, {
			tenantId: context.tenantId,
			kind: "ai_tokens",
			amount: 0,
			context: `ocr_operation_${outcome.phase}`,
			metadata,
		});
	} catch {
		// This best-effort observation must not turn a persisted extraction into a failed request.
		console.warn("[ocr-observation] observation_unavailable", {
			extractionId: context.extractionId,
			phase: outcome.phase,
		});
	}
}
