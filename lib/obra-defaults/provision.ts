import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { applyObraDefaults, type ApplyDefaultsResult } from "@/lib/obra-defaults";
import { STANDARD_OBRA_DEFAULTS_MATERIALIZER_VERSION } from "@/lib/tenant-blueprints/constants";

type ProvisioningIssue = {
	code: "defaults_apply_partial" | "health_record_failed";
	message: string;
	retryable: true;
};

function isMissingProvisioningRpc(error: PostgrestError | null) {
	return (
		error?.code === "PGRST202" ||
		error?.code === "42883" ||
		Boolean(error?.message?.includes("begin_obra_setup_provisioning"))
	);
}

function withHealthFailure(
	result: ApplyDefaultsResult,
	message: string,
): ApplyDefaultsResult {
	return {
		...result,
		success: false,
		error: [result.error, message].filter(Boolean).join(". "),
	};
}

/**
 * Materialize tenant defaults and persist the latest attempt when migration
 * 0128 is available. The fallback keeps deployments usable while the authored
 * migration is waiting for its deliberate manual application.
 */
export async function provisionObraDefaults(
	supabase: SupabaseClient,
	obraId: string,
	tenantId: string,
): Promise<ApplyDefaultsResult> {
	const { data: attemptId, error: beginError } = await supabase.rpc(
		"begin_obra_setup_provisioning",
		{
			p_obra_id: obraId,
			p_materializer_version:
				STANDARD_OBRA_DEFAULTS_MATERIALIZER_VERSION,
		},
	);

	if (beginError) {
		if (isMissingProvisioningRpc(beginError)) {
			console.warn(
				"[obra-setup] provisioning health migration is not applied; using compatibility mode",
			);
			return applyObraDefaults(supabase, obraId, tenantId);
		}
		console.error("[obra-setup] failed to begin tracked provisioning", beginError);
		return {
			success: false,
			foldersApplied: 0,
			tablasApplied: 0,
			error: "No se pudo iniciar la preparación controlada de la obra",
		};
	}
	if (typeof attemptId !== "string" || !attemptId) {
		return {
			success: false,
			foldersApplied: 0,
			tablasApplied: 0,
			error: "No se pudo identificar el intento de preparación de la obra",
		};
	}

	const result = await applyObraDefaults(supabase, obraId, tenantId);
	const issues: ProvisioningIssue[] = result.success
		? []
		: [
				{
					code: "defaults_apply_partial",
					message:
						result.error ??
						"Parte de la estructura recomendada no pudo prepararse",
					retryable: true,
				},
			];
	const manifest = {
		materializerVersion: STANDARD_OBRA_DEFAULTS_MATERIALIZER_VERSION,
		observed: {
			folderPlaceholdersReadyThisAttempt: result.foldersApplied,
			tablesCreatedThisAttempt: result.tablasApplied,
		},
	};

	const { data: finished, error: finishError } = await supabase.rpc(
		"finish_obra_setup_provisioning",
		{
			p_obra_id: obraId,
			p_attempt_id: attemptId,
			p_status: result.success ? "ready" : "partial",
			p_manifest: manifest,
			p_issues: issues,
		},
	);

	if (finishError || finished !== true) {
		console.error("[obra-setup] failed to finish tracked provisioning", {
			finishError,
			finished,
		});
		return withHealthFailure(
			result,
			"No se pudo confirmar el estado de la preparación. Reintentá para verificarla",
		);
	}

	return result;
}
