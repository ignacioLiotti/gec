import type { SupabaseClient } from "@supabase/supabase-js";
import type {
	EngineEvent,
	FlowDefinition,
	FlowInstance,
	FlowRun,
	FlowStepState,
} from "../core/types";

export type DbClient = SupabaseClient;

export async function getFlowInstance(
	supabase: DbClient,
	obraId: string,
	flowDefinitionId: string,
): Promise<FlowInstance | null> {
	const { data, error } = await supabase
		.from("flow_instance")
		.select("id, obra_id, flow_definition_id, definition_json, created_at")
		.eq("obra_id", obraId)
		.eq("flow_definition_id", flowDefinitionId)
		.maybeSingle();

	if (error) throw error;
	if (!data) return null;
	return {
		id: data.id,
		obraId: data.obra_id,
		flowDefinitionId: data.flow_definition_id,
		definitionJson: data.definition_json as FlowDefinition,
		createdAt: data.created_at,
	};
}

export async function upsertFlowInstanceDefinition(
	supabase: DbClient,
	params: {
		obraId: string;
		flowDefinitionId: string;
		definitionJson: FlowDefinition;
	},
): Promise<FlowInstance> {
	const { data, error } = await supabase
		.from("flow_instance")
		.upsert(
			{
				obra_id: params.obraId,
				flow_definition_id: params.flowDefinitionId,
				definition_json: params.definitionJson,
			},
			{ onConflict: "obra_id,flow_definition_id" },
		)
		.select("id, obra_id, flow_definition_id, definition_json, created_at")
		.single();

	if (error) throw error;
	return {
		id: data.id,
		obraId: data.obra_id,
		flowDefinitionId: data.flow_definition_id,
		definitionJson: data.definition_json as FlowDefinition,
		createdAt: data.created_at,
	};
}

export async function getObraTenantId(
	supabase: DbClient,
	obraId: string,
): Promise<string | null> {
	const { data, error } = await supabase
		.from("obras")
		.select("tenant_id")
		.eq("id", obraId)
		.maybeSingle();

	if (error) throw error;
	return data?.tenant_id ?? null;
}

export async function createFlowInstance(
	supabase: DbClient,
	params: {
		obraId: string;
		flowDefinitionId: string;
		definitionJson: FlowDefinition;
	},
): Promise<FlowInstance> {
	const { data, error } = await supabase
		.from("flow_instance")
		.insert({
			obra_id: params.obraId,
			flow_definition_id: params.flowDefinitionId,
			definition_json: params.definitionJson,
		})
		.select("id, obra_id, flow_definition_id, definition_json, created_at")
		.single();

	if (error) throw error;
	return {
		id: data.id,
		obraId: data.obra_id,
		flowDefinitionId: data.flow_definition_id,
		definitionJson: data.definition_json as FlowDefinition,
		createdAt: data.created_at,
	};
}

export async function getOrCreateFlowInstance(
	supabase: DbClient,
	params: {
		obraId: string;
		flowDefinitionId: string;
		definitionJson: FlowDefinition;
	},
): Promise<FlowInstance> {
	const existing = await getFlowInstance(
		supabase,
		params.obraId,
		params.flowDefinitionId,
	);
	if (existing) return existing;
	return createFlowInstance(supabase, params);
}

export async function getFlowRun(
	supabase: DbClient,
	instanceId: string,
	period: string,
): Promise<FlowRun | null> {
	const { data, error } = await supabase
		.from("flow_run")
		.select("id, instance_id, period, status, created_at")
		.eq("instance_id", instanceId)
		.eq("period", period)
		.maybeSingle();

	if (error) throw error;
	if (!data) return null;
	return {
		id: data.id,
		instanceId: data.instance_id,
		period: data.period,
		status: data.status,
		createdAt: data.created_at,
	};
}

export async function getLatestFlowRun(
	supabase: DbClient,
	instanceId: string,
): Promise<FlowRun | null> {
	const { data, error } = await supabase
		.from("flow_run")
		.select("id, instance_id, period, status, created_at")
		.eq("instance_id", instanceId)
		.order("created_at", { ascending: false })
		.limit(1)
		.maybeSingle();

	if (error) throw error;
	if (!data) return null;
	return {
		id: data.id,
		instanceId: data.instance_id,
		period: data.period,
		status: data.status,
		createdAt: data.created_at,
	};
}

export async function createFlowRun(
	supabase: DbClient,
	params: { instanceId: string; period: string },
): Promise<FlowRun> {
	const { data, error } = await supabase
		.from("flow_run")
		.insert({
			instance_id: params.instanceId,
			period: params.period,
		})
		.select("id, instance_id, period, status, created_at")
		.single();

	if (error) throw error;
	return {
		id: data.id,
		instanceId: data.instance_id,
		period: data.period,
		status: data.status,
		createdAt: data.created_at,
	};
}

export async function getOrCreateFlowRun(
	supabase: DbClient,
	params: { instanceId: string; period: string },
): Promise<FlowRun> {
	const existing = await getFlowRun(supabase, params.instanceId, params.period);
	if (existing) return existing;
	return createFlowRun(supabase, params);
}

export async function listStepStates(
	supabase: DbClient,
	runId: string,
): Promise<FlowStepState[]> {
	const { data, error } = await supabase
		.from("flow_step_state")
		.select("id, run_id, step_id, status, reason, inputs_json, outputs_json, updated_at")
		.eq("run_id", runId)
		.order("step_id", { ascending: true });

	if (error) throw error;
	return (data ?? []).map((row) => ({
		id: row.id,
		runId: row.run_id,
		stepId: row.step_id,
		status: row.status,
		reason: row.reason,
		inputs: row.inputs_json,
		outputs: row.outputs_json,
		updatedAt: row.updated_at,
	}));
}

export async function upsertStepStates(
	supabase: DbClient,
	states: FlowStepState[],
): Promise<void> {
	if (!states.length) return;
	const payload = states.map((state) => ({
		run_id: state.runId,
		step_id: state.stepId,
		status: state.status,
		reason: state.reason ?? null,
		inputs_json: state.inputs ?? null,
		outputs_json: state.outputs ?? null,
	}));

	const { error } = await supabase
		.from("flow_step_state")
		.upsert(payload, { onConflict: "run_id,step_id" });

	if (error) throw error;
}

export async function insertFlowEvent(
	supabase: DbClient,
	params: {
		obraId: string;
		runId?: string | null;
		type: string;
		payload?: Record<string, unknown> | null;
		dedupeKey?: string | null;
	},
): Promise<{ id: string } | null> {
	const { data, error } = await supabase
		.from("flow_event")
		.insert({
			obra_id: params.obraId,
			run_id: params.runId ?? null,
			type: params.type,
			payload_json: params.payload ?? null,
			dedupe_key: params.dedupeKey ?? null,
		})
		.select("id")
		.single();

	if (error) {
		const code = (error as any)?.code;
		if (code === "23505") return null;
		throw error;
	}

	return data ? { id: data.id } : null;
}

export async function listFlowEvents(
	supabase: DbClient,
	params: { obraId: string; runId?: string | null },
): Promise<EngineEvent[]> {
	let query = supabase
		.from("flow_event")
		.select("type, payload_json, dedupe_key, run_id, created_at")
		.eq("obra_id", params.obraId)
		.order("created_at", { ascending: true });

	if (params.runId) {
		query = query.eq("run_id", params.runId);
	}

	const { data, error } = await query;
	if (error) throw error;

	return (data ?? []).map((row) => ({
		type: row.type,
		payload: row.payload_json,
		dedupeKey: row.dedupe_key,
		runId: row.run_id,
	}));
}

export async function listOcrTablas(
	supabase: DbClient,
	obraId: string,
): Promise<Array<{ id: string; name: string; settings: Record<string, unknown> }>> {
	const { data, error } = await supabase
		.from("obra_tablas")
		.select("id, name, settings")
		.eq("obra_id", obraId)
		.eq("source_type", "ocr")
		.order("created_at", { ascending: true });

	if (error) throw error;
	return (data ?? []).map((row) => ({
		id: row.id as string,
		name: row.name as string,
		settings: (row.settings as Record<string, unknown>) ?? {},
	}));
}

export async function listOcrDocuments(
	supabase: DbClient,
	params: { obraId: string; tablaIds: string[] },
): Promise<
	Array<{
		id: string;
		tablaId: string;
		status: string;
		sourcePath: string;
		sourceFileName: string;
	}>
> {
	if (params.tablaIds.length === 0) return [];
	const { data, error } = await supabase
		.from("ocr_document_processing")
		.select("id, tabla_id, status, source_path, source_file_name")
		.eq("obra_id", params.obraId)
		.in("tabla_id", params.tablaIds)
		.order("created_at", { ascending: false });

	if (error) throw error;
	return (data ?? []).map((row) => ({
		id: row.id as string,
		tablaId: row.tabla_id as string,
		status: row.status as string,
		sourcePath: row.source_path as string,
		sourceFileName: row.source_file_name as string,
	}));
}

export async function acquireFlowLock(
	supabase: DbClient,
	instanceId: string,
	ttlSeconds: number,
	lockToken: string,
): Promise<boolean> {
	const expiresIso = new Date(Date.now() + ttlSeconds * 1000).toISOString();
	const { data, error } = await supabase.rpc("acquire_flow_lock", {
		p_instance_id: instanceId,
		p_lock_token: lockToken,
		p_expires_at: expiresIso,
	});

	if (error) throw error;
	return data === true;
}

export async function releaseFlowLock(
	supabase: DbClient,
	instanceId: string,
	lockToken: string,
): Promise<void> {
	const { error } = await supabase.rpc("release_flow_lock", {
		p_instance_id: instanceId,
		p_lock_token: lockToken,
	});

	if (error) throw error;
}
