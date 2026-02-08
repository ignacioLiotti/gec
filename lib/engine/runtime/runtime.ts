import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { resolveFlowDefinition } from "../core/definition";
import { evaluateFlow } from "../core/evaluator";
import { planJobs } from "../core/planner";
import type {
	AvailableInput,
	EngineEvent,
	FlowDefinition,
	FlowRun,
	FlowStepState,
	PlannedJob,
} from "../core/types";
import type { DbClient } from "../adapters/db";
import {
	getLatestFlowRun,
	getOrCreateFlowInstance,
	getOrCreateFlowRun,
	getFlowInstance,
	getObraTenantId,
	insertFlowEvent,
	listOcrDocuments,
	listOcrTablas,
	listFlowEvents,
	listStepStates,
	upsertStepStates,
	upsertFlowInstanceDefinition,
} from "../adapters/db";
import { buildDedupeKey } from "./idempotency";
import { withFlowLock } from "./locks";
import { normalizeFolderName } from "@/lib/tablas";
import XLSX from "xlsx";

export interface FlowState {
	definition: FlowDefinition;
	instanceId: string;
	run: FlowRun | null;
	steps: FlowStepState[];
	plannedJobs: PlannedJob[];
}

export interface EngineContext {
	client?: DbClient;
	admin?: boolean;
	tenantId?: string | null;
}

async function resolveClient(context?: EngineContext): Promise<DbClient> {
	if (context?.client) return context.client;
	if (context?.admin) return createSupabaseAdminClient();
	return createClient();
}

async function assertTenantAccess(
	supabase: DbClient,
	obraId: string,
	tenantId?: string | null,
) {
	if (!tenantId) return;
	const obraTenantId = await getObraTenantId(supabase, obraId);
	if (!obraTenantId || obraTenantId !== tenantId) {
		throw new Error("tenant_mismatch");
	}
}

function formatPeriod(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	return `${year}-${month}`;
}

function findLatestEvent(
	events: EngineEvent[],
	type: string,
): EngineEvent | null {
	for (let i = events.length - 1; i >= 0; i -= 1) {
		if (events[i].type === type) return events[i];
	}
	return null;
}

function deriveAvailableInputs(
	definition: FlowDefinition,
	events: EngineEvent[],
	budgetDetection?: BudgetDetection | null,
): AvailableInput[] {
	const inputs: AvailableInput[] = [];
	for (const step of definition.steps) {
		if (step.type !== "input") continue;
		if (step.id === "budget_base") {
			const marked = findLatestEvent(events, "budget_base.marked");
			if (marked) {
				inputs.push({ stepId: step.id, data: marked.payload ?? null });
				continue;
			}
			if (budgetDetection?.status === "found") {
				inputs.push({
					stepId: step.id,
					data: budgetDetection.data ?? null,
				});
				continue;
			}
		}
	}
	return inputs;
}

function applyMeasurementEvent(
	states: FlowStepState[],
	events: EngineEvent[],
	runId: string,
): FlowStepState[] {
	const latest = findLatestEvent(events, "measurement.submitted");
	if (!latest) return states;
	const next = [...states];
	const idx = next.findIndex((state) => state.stepId === "measurement");
	const payload = latest.payload ?? null;
	const base: FlowStepState = {
		runId,
		stepId: "measurement",
		status: "done",
		outputs: payload,
	};
	if (idx >= 0) {
		next[idx] = {
			...next[idx],
			status: "done",
			outputs: payload,
		};
		return next;
	}
	return [...next, base];
}

type BudgetDetectionStatus = "found" | "missing" | "ocr_pending";

type BudgetDetection = {
	status: BudgetDetectionStatus;
	source?: "ocr" | "storage";
	data?: Record<string, unknown> | null;
};

const BUDGET_KEYWORDS = ["presupuesto", "presupuestos", "budget"];

function matchesBudgetKeyword(value: string | null | undefined): boolean {
	if (!value) return false;
	const normalized = normalizeFolderName(value);
	return BUDGET_KEYWORDS.some((key) => normalized.includes(key));
}

function inferFileKind(
	fileName: string,
): "xlsx" | "xls" | "csv" | "pdf" | "other" {
	const lower = fileName.toLowerCase();
	if (lower.endsWith(".xlsx")) return "xlsx";
	if (lower.endsWith(".xls")) return "xls";
	if (lower.endsWith(".csv")) return "csv";
	if (lower.endsWith(".pdf")) return "pdf";
	return "other";
}

async function detectBudgetBase(
	supabase: DbClient,
	obraId: string,
): Promise<BudgetDetection> {
	const ocrTablas = await listOcrTablas(supabase, obraId);
	const budgetTablas = ocrTablas.filter((tabla) => {
		const settings = tabla.settings ?? {};
		const ocrFolder =
			typeof settings.ocrFolder === "string" ? settings.ocrFolder : "";
		const ocrDocType =
			typeof settings.ocrDocType === "string" ? settings.ocrDocType : "";
		return (
			matchesBudgetKeyword(tabla.name) ||
			matchesBudgetKeyword(ocrFolder) ||
			matchesBudgetKeyword(ocrDocType)
		);
	});

	if (budgetTablas.length > 0) {
		const docs = await listOcrDocuments(supabase, {
			obraId,
			tablaIds: budgetTablas.map((tabla) => tabla.id),
		});
		const completed = docs.find((doc) => doc.status === "completed");
		if (completed) {
			return {
				status: "found",
				source: "ocr",
				data: {
					tablaId: completed.tablaId,
					sourcePath: completed.sourcePath,
					sourceFileName: completed.sourceFileName,
					status: completed.status,
				},
			};
		}
		const pending = docs.find(
			(doc) => doc.status === "pending" || doc.status === "processing",
		);
		if (pending) {
			return {
				status: "ocr_pending",
				source: "ocr",
				data: {
					tablaId: pending.tablaId,
					sourcePath: pending.sourcePath,
					sourceFileName: pending.sourceFileName,
					status: pending.status,
				},
			};
		}

		const candidateFolders = budgetTablas
			.map((tabla) => {
				const settings = tabla.settings ?? {};
				return typeof settings.ocrFolder === "string" ? settings.ocrFolder : "";
			})
			.filter(Boolean);

		for (const folderName of candidateFolders) {
			const { data: files } = await supabase.storage
				.from("obra-documents")
				.list(`${obraId}/${folderName}`, { limit: 20 });
			const file = (files ?? []).find((item) => item.name);
			if (file) {
				const fileKind = inferFileKind(file.name);
				if (fileKind === "xlsx" || fileKind === "xls" || fileKind === "csv") {
					return {
						status: "found",
						source: "storage",
						data: {
							folder: folderName,
							fileName: file.name,
							storagePath: `${obraId}/${folderName}/${file.name}`,
							fileKind,
						},
					};
				}
				return {
					status: "ocr_pending",
					source: "ocr",
					data: {
						folder: folderName,
						fileName: file.name,
						storagePath: `${obraId}/${folderName}/${file.name}`,
						fileKind,
					},
				};
			}
		}
	}

	const { data: rootItems } = await supabase.storage
		.from("obra-documents")
		.list(obraId, { limit: 500 });
	const candidateFolders = (rootItems ?? []).filter(
		(item) => !item.metadata && matchesBudgetKeyword(item.name),
	);

	for (const folder of candidateFolders) {
		const folderName = folder.name.replace(/\/$/, "");
		const { data: files } = await supabase.storage
			.from("obra-documents")
			.list(`${obraId}/${folderName}`, { limit: 20 });
		if (!files || files.length === 0) continue;
		const file = files[0];
		const fileKind = inferFileKind(file.name);
		if (fileKind === "xlsx" || fileKind === "xls" || fileKind === "csv") {
			return {
				status: "found",
				source: "storage",
				data: {
					folder: folderName,
					fileName: file.name,
					storagePath: `${obraId}/${folderName}/${file.name}`,
					fileKind,
				},
			};
		}
		return {
			status: "ocr_pending",
			source: "storage",
			data: {
				folder: folderName,
				fileName: file.name,
				storagePath: `${obraId}/${folderName}/${file.name}`,
				fileKind,
			},
		};
	}

	return { status: "missing" };
}

async function generateCertificateOutputs(
	supabase: DbClient,
	params: {
		obraId: string;
		period: string;
		measurementOutputs?: Record<string, unknown> | null;
	},
): Promise<Record<string, unknown>> {
	const rows = Array.isArray(params.measurementOutputs?.rows)
		? (params.measurementOutputs?.rows as Record<string, unknown>[])
		: [];
	const workbook = XLSX.utils.book_new();
	const worksheet = XLSX.utils.json_to_sheet(rows);
	XLSX.utils.book_append_sheet(workbook, worksheet, "Medicion");
	const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
	const fileName = `certificado-${params.period}.xlsx`;
	const storagePath = `${params.obraId}/certificados/${params.period}/${fileName}`;

	await supabase.storage.from("obra-documents").upload(storagePath, buffer, {
		contentType:
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		upsert: true,
	});

	const { data: signed } = await supabase.storage
		.from("obra-documents")
		.createSignedUrl(storagePath, 60 * 60);

	return {
		certificate_xlsx: signed?.signedUrl ?? storagePath,
		certificate_storage_path: storagePath,
		row_count: rows.length,
	};
}

async function ensureFlowInstance(
	supabase: Awaited<ReturnType<typeof createClient>>,
	obraId: string,
	definition?: FlowDefinition,
) {
	const resolved = definition ?? resolveFlowDefinition();
	return getOrCreateFlowInstance(supabase, {
		obraId,
		flowDefinitionId: resolved.id,
		definitionJson: resolved,
	});
}

export async function emitEvent(
	obraId: string,
	event: EngineEvent,
	context?: EngineContext,
) {
	const supabase = await resolveClient(context);
	await assertTenantAccess(supabase, obraId, context?.tenantId);
	const instance = await ensureFlowInstance(supabase, obraId);
	const definition = instance.definitionJson ?? resolveFlowDefinition();

	let runId = event.runId ?? null;
	if (!runId && event.period) {
		const run = await getOrCreateFlowRun(supabase, {
			instanceId: instance.id,
			period: event.period,
		});
		runId = run.id;
	}

	const dedupeKey = buildDedupeKey({ ...event, runId });
	return insertFlowEvent(supabase, {
		obraId,
		runId,
		type: event.type,
		payload: event.payload ?? null,
		dedupeKey,
	});
}

export async function evaluate(
	obraId: string,
	period?: string | null,
	context?: EngineContext,
) {
	const supabase = await resolveClient(context);
	await assertTenantAccess(supabase, obraId, context?.tenantId);
	const instance = await ensureFlowInstance(supabase, obraId);
	const definition = instance.definitionJson ?? resolveFlowDefinition();

	return withFlowLock(supabase, instance.id, async () => {
		const runPeriod = period ?? formatPeriod(new Date());
		const run = await getOrCreateFlowRun(supabase, {
			instanceId: instance.id,
			period: runPeriod,
		});
		const events = await listFlowEvents(supabase, {
			obraId,
			runId: run.id,
		});
		const currentStates = await listStepStates(supabase, run.id);
		const budgetDetection = await detectBudgetBase(supabase, obraId);
		const withMeasurement = applyMeasurementEvent(
			currentStates,
			events,
			run.id,
		);
		const availableInputs = deriveAvailableInputs(
			definition,
			events,
			budgetDetection,
		);
		const result = evaluateFlow({
			definition,
			currentStates: withMeasurement,
			availableInputs,
		});

		const statesWithRunId = result.states.map((state) => ({
			...state,
			runId: state.runId || run.id,
		}));
		const updatedStates = [...statesWithRunId];
		const budgetStateIndex = updatedStates.findIndex(
			(step) => step.stepId === "budget_base",
		);
		if (budgetStateIndex >= 0) {
			const budgetState = updatedStates[budgetStateIndex];
			if (budgetState.status === "blocked") {
				if (budgetDetection.status === "missing") {
					budgetState.reason = {
						type: "budget_missing",
						message:
							"No se encontro un presupuesto base. Subi el documento en Documentos y procesa OCR.",
					};
				} else if (budgetDetection.status === "ocr_pending") {
					budgetState.reason = {
						type: "budget_ocr_pending",
						message:
							"Presupuesto cargado pero OCR pendiente. Procesa el documento para continuar.",
						...budgetDetection.data,
					};
				}
			} else if (budgetState.status === "done" && budgetDetection.data) {
				budgetState.inputs = budgetDetection.data;
			}
		}

		const plannedJobs = planJobs(definition, updatedStates);

		const certificateRequested = findLatestEvent(
			events,
			"certificate.generate.requested",
		);
		if (certificateRequested) {
			const certificateIndex = updatedStates.findIndex(
				(step) => step.stepId === "certificate",
			);
			const measurementStep = updatedStates.find(
				(step) => step.stepId === "measurement",
			);
			if (certificateIndex >= 0) {
				const certificateState = updatedStates[certificateIndex];
				if (certificateState.status === "ready") {
					const outputs = await generateCertificateOutputs(supabase, {
						obraId,
						period: run.period,
						measurementOutputs: measurementStep?.outputs ?? null,
					});
					updatedStates[certificateIndex] = {
						...certificateState,
						status: "done",
						outputs,
					};
				}
			}
		}

		await upsertStepStates(supabase, updatedStates);

		for (const job of plannedJobs) {
			await insertFlowEvent(supabase, {
				obraId,
				runId: run.id,
				type: "job.planned",
				payload: {
					jobType: job.type,
					stepId: job.stepId,
				},
				dedupeKey: `job:${run.id}:${job.stepId}`,
			});
		}

		return {
			definition,
			instanceId: instance.id,
			run,
			steps: updatedStates,
			plannedJobs,
		};
	});
}

export async function getFlowState(
	obraId: string,
	period?: string | null,
	context?: EngineContext,
) {
	const supabase = await resolveClient(context);
	await assertTenantAccess(supabase, obraId, context?.tenantId);
	const defaultDefinition = resolveFlowDefinition();
	const instance = await getFlowInstance(
		supabase,
		obraId,
		defaultDefinition.id,
	);
	if (!instance) {
		return {
			definition: defaultDefinition,
			instanceId: "",
			run: null,
			steps: [],
			plannedJobs: [],
		};
	}
	const definition = instance.definitionJson ?? defaultDefinition;

	let run: FlowRun | null = null;
	if (period) {
		run = await getOrCreateFlowRun(supabase, {
			instanceId: instance.id,
			period,
		});
	} else {
		run = await getLatestFlowRun(supabase, instance.id);
	}

	if (!run) {
		return {
			definition,
			instanceId: instance.id,
			run: null,
			steps: [],
			plannedJobs: [],
		};
	}

	const steps = await listStepStates(supabase, run.id);
	return {
		definition,
		instanceId: instance.id,
		run,
		steps,
		plannedJobs: [],
	};
}

export async function initFlowInstance(
	obraId: string,
	flowDefinitionIdOrJson?: FlowDefinition | string | null,
	context?: EngineContext,
) {
	const supabase = await resolveClient(context);
	await assertTenantAccess(supabase, obraId, context?.tenantId);
	const definition = resolveFlowDefinition(flowDefinitionIdOrJson ?? undefined);
	return getOrCreateFlowInstance(supabase, {
		obraId,
		flowDefinitionId: definition.id,
		definitionJson: definition,
	});
}

export async function setFlowDefinition(
	obraId: string,
	definition: FlowDefinition,
	context?: EngineContext,
) {
	const supabase = await resolveClient(context);
	await assertTenantAccess(supabase, obraId, context?.tenantId);
	return upsertFlowInstanceDefinition(supabase, {
		obraId,
		flowDefinitionId: definition.id,
		definitionJson: definition,
	});
}
