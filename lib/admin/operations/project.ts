import type { OperationsRecords } from "./records";
import { observationWindow } from "./selection";
import type { ActivityRow, AuditChange, AuditFieldChange, CostSummary, ObservedOperation, OperationsSelection, OperationsSnapshot, SourceStatus } from "./types";

const safeFields = ["status", "is_active", "rows_extracted", "retry_count", "processing_duration_ms", "materialization_version"] as const;
const knownErrorCodes = new Set([
	"provider_unavailable", "rate_limit", "timeout", "invalid_document", "extraction_failed", "unknown",
	"OCR_PROVIDER_HIGH_DEMAND", "OCR_PROVIDER_UNAVAILABLE", "LINEAGE_RECONCILIATION_CONFLICT", "ocr_failed",
	"ocr_unsupported_file", "ocr_empty_result", "ocr_usage_limit", "ocr_storage_limit",
]);

type UsageRecord = OperationsRecords["usage"][number];
const bookkeepingContexts = new Set<UsageRecord["context"]>([
	"ocr_reservation", "ocr_reservation_multi", "ocr_reservation_rollback", "ocr_reservation_rollback_multi",
	"ocr_extraction_failed", "ocr_extraction_failed_multi", "ocr_reservation_rollback_failed", "ocr_reservation_rollback_multi_failed",
	"ocr_extraction_failed_failed", "ocr_extraction_failed_multi_failed",
	"documents_soft_delete", "documents_soft_delete_rollback", "documents_manual_purge",
]);

function isOcrPhase(row: UsageRecord) {
	return row.context === "ocr_operation_started" || row.context === "ocr_operation_completed" || row.context === "ocr_operation_failed";
}

function isCostEligible(row: UsageRecord) {
	if (isOcrPhase(row) || bookkeepingContexts.has(row.context)) return false;
	return row.context !== null || row.metadata.costUsd != null || row.amount > 0;
}

function unique<T>(rows: T[], key: (row: T) => string): T[] {
	return [...new Map(rows.map((row) => [key(row), row])).values()];
}

function fieldChanges(row: OperationsRecords["audit"][number]): { fields: AuditFieldChange[]; hiddenFieldCount: number } {
	const changed = row.changed_keys ?? [];
	const fields = safeFields.filter((field) => {
		if (row.action === "INSERT") return row.after_data[field] !== undefined;
		if (row.action === "DELETE") return row.before_data[field] !== undefined;
		return changed.includes(field) && row.before_data[field] !== undefined && row.after_data[field] !== undefined;
	}).map((field) => ({
		field, before: row.action === "INSERT" ? null : row.before_data[field] ?? null, after: row.action === "DELETE" ? null : row.after_data[field] ?? null, redacted: false,
	}));
	const hiddenFieldCount = row.action === "UPDATE"
		? new Set(changed.filter((field) => !fields.some((entry) => entry.field === field))).size
		: Math.max(0, (row.action === "INSERT" ? row.after_data.observedFieldCount : row.before_data.observedFieldCount) - fields.length);
	return { fields, hiddenFieldCount };
}

export function projectOperationsSnapshot({ records, selection, sources, now = new Date() }: {
	records: OperationsRecords;
	selection: OperationsSelection;
	sources: SourceStatus[];
	now?: Date;
}): OperationsSnapshot {
	const window = observationWindow(selection.days, now);
	const start = Date.parse(window.start);
	const end = Date.parse(window.end);
	const liveEnd = Date.parse(window.liveEnd);
	const previousStart = Date.parse(window.previousStart);
	const inRange = (time: string) => Date.parse(time) >= previousStart && Date.parse(time) < liveEnd;
	const completeDay = (time: string) => Date.parse(time) < end;
	const current = (time: string) => Date.parse(time) >= start;
	const tenants = unique(records.tenants.filter((tenant) => !selection.tenantId || tenant.id === selection.tenantId), (tenant) => tenant.id);
	const tenantIds = new Set(tenants.map((tenant) => tenant.id));
	const memberships = unique(records.memberships.filter((row) => tenantIds.has(row.tenant_id)), (row) => `${row.tenant_id}:${row.user_id}`);
	const profiles = new Map(records.profiles.map((row) => [row.user_id, row.full_name]));
	const actorName = (id: string | null) => id ? profiles.get(id) || `Usuario ${id.slice(0, 8)}` : "Actor no registrado";
	const auditRows = unique(records.audit.filter((row) => tenantIds.has(row.tenant_id) && inRange(row.created_at)), (row) => `${row.tenant_id}:${row.id}`);
	const allUsageRows = unique(records.usage.filter((row) => tenantIds.has(row.tenant_id) && inRange(row.created_at)), (row) => `${row.tenant_id}:${row.id}`);
	const usageRows = allUsageRows.filter((row) => current(row.created_at) && !isOcrPhase(row));
	const phases = unique(allUsageRows.filter((row) => isOcrPhase(row) && row.amount === 0 && row.metadata.extractionId && row.metadata.obraId).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)), (row) => `${row.tenant_id}:${row.metadata.extractionId}:${row.context}`).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
	const ocrRows = unique(records.ocr.filter((row) => tenantIds.has(row.obras.tenant_id) && inRange(row.updated_at) && current(row.updated_at)), (row) => `${row.obras.tenant_id}:${row.id}`);
	const audit: AuditChange[] = auditRows.filter((row) => current(row.created_at)).map((row) => ({
		id: row.id, tenantId: row.tenant_id, actorId: row.actor_id, actorName: actorName(row.actor_id),
		table: row.table_name, action: row.action, createdAt: row.created_at, rowId: row.row_pk.id ?? null,
		extractionId: row.context.extractionId ?? row.context.extraction_id ?? ((row.table_name === "ocr_document_processing" || row.table_name === "obra_tabla_rows") ? row.after_data.extraction_id ?? row.before_data.extraction_id ?? null : null),
		...fieldChanges(row),
	})).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	const costs: CostSummary[] = [];
	for (const row of usageRows) {
		let summary = costs.find((entry) => entry.tenantId === row.tenant_id && entry.kind === row.kind);
		if (!summary) {
			summary = { tenantId: row.tenant_id, kind: row.kind, netAmount: 0, knownUsd: null, pricedEvents: 0, unpricedEvents: 0, basis: "recorded_estimate" };
			costs.push(summary);
		}
		summary.netAmount += row.amount;
		if (!isCostEligible(row)) continue;
		if (row.metadata.costUsd != null) { summary.knownUsd = (summary.knownUsd ?? 0) + row.metadata.costUsd; summary.pricedEvents++; }
		else summary.unpricedEvents++;
	}
	const documents = ocrRows.map((row): ObservedOperation => {
		const linkedAudit = audit.filter((entry) => entry.tenantId === row.obras.tenant_id && ((row.extraction_id !== null && entry.extractionId === row.extraction_id) || (entry.extractionId === null && entry.table === "ocr_document_processing" && entry.rowId === row.id)));
		const linkedUsage = usageRows.filter((entry) => entry.tenant_id === row.obras.tenant_id && ((row.extraction_id !== null && (entry.metadata.extractionId ?? entry.metadata.extraction_id) === row.extraction_id) || entry.metadata.processingId === row.id));
		const eligibleCosts = linkedUsage.filter(isCostEligible);
		const prices = eligibleCosts.flatMap((entry) => entry.metadata.costUsd == null ? [] : [entry.metadata.costUsd]);
		return {
			id: row.id, tenantId: row.obras.tenant_id, extractionId: row.extraction_id, obraId: row.obra_id, tablaId: row.tabla_id, tablaIds: [row.tabla_id], preview: false, basis: "document_state",
			status: row.status, observedAt: row.updated_at, rowsExtracted: row.rows_extracted, durationMs: row.processing_duration_ms,
			errorCode: row.error_code === null ? null : knownErrorCodes.has(row.error_code) ? row.error_code : "unclassified",
			actorIds: [...new Set([...linkedAudit.flatMap((entry) => entry.actorId ? [entry.actorId] : []), ...linkedUsage.flatMap((entry) => entry.metadata.actorId ? [entry.metadata.actorId] : [])])],
			initiatorIds: [...new Set(linkedUsage.flatMap((entry) => entry.metadata.initiatorId ? [entry.metadata.initiatorId] : []))],
			auditIds: linkedAudit.map((entry) => entry.id), usageEventIds: linkedUsage.map((entry) => entry.id),
			knownUsd: prices.length ? prices.reduce((sum, price) => sum + price, 0) : null,
			unpricedEvents: eligibleCosts.length - prices.length,
		};
	});
	const operationMap = new Map<string, ObservedOperation>();
	for (const document of documents) {
		const key = `${document.tenantId}:${document.extractionId ?? document.id}`;
		const existing = operationMap.get(key);
		if (!existing) operationMap.set(key, document);
		else {
			existing.tablaIds = [...new Set([...existing.tablaIds, ...document.tablaIds])];
			existing.tablaId = existing.tablaIds.length === 1 ? existing.tablaIds[0] : null;
			existing.rowsExtracted = existing.rowsExtracted === null || document.rowsExtracted === null ? null : existing.rowsExtracted + document.rowsExtracted;
			existing.auditIds = [...new Set([...existing.auditIds, ...document.auditIds])];
			existing.actorIds = [...new Set([...existing.actorIds, ...document.actorIds])];
			existing.initiatorIds = [...new Set([...existing.initiatorIds, ...document.initiatorIds])];
			const statuses = [existing.status, document.status];
			existing.status = statuses.includes("failed") ? "failed" : statuses.includes("processing") ? "processing" : statuses.includes("pending") ? "pending" : "completed";
		}
	}
	for (const phase of phases.filter((row) => current(row.created_at))) {
		const extractionId = phase.metadata.extractionId;
		const obraId = phase.metadata.obraId;
		if (!extractionId || !obraId) continue;
		const key = `${phase.tenant_id}:${extractionId}`;
		const existing = operationMap.get(key);
		const linkedUsage = usageRows.filter((row) => row.tenant_id === phase.tenant_id && row.metadata.extractionId === extractionId);
		const eligibleCosts = linkedUsage.filter(isCostEligible);
		const prices = eligibleCosts.flatMap((row) => row.metadata.costUsd == null ? [] : [row.metadata.costUsd]);
		const linkedAudit = audit.filter((row) => row.tenantId === phase.tenant_id && row.extractionId === extractionId);
		const tablaIds = phase.metadata.tablaIds ?? (phase.metadata.tablaId ? [phase.metadata.tablaId] : existing?.tablaIds ?? []);
		operationMap.set(key, {
			id: existing?.id ?? extractionId, tenantId: phase.tenant_id, extractionId, obraId, tablaId: tablaIds.length === 1 ? tablaIds[0] : null, tablaIds,
			preview: phase.metadata.preview ?? false, basis: "ocr_phase",
			status: phase.context === "ocr_operation_completed" ? "completed" : phase.context === "ocr_operation_failed" ? "failed" : existing?.status ?? "processing",
			observedAt: phase.created_at, rowsExtracted: phase.metadata.rowsExtracted ?? existing?.rowsExtracted ?? null,
			durationMs: phase.context === "ocr_operation_started" ? existing?.durationMs ?? null : phase.metadata.durationMs ?? existing?.durationMs ?? null,
			errorCode: phase.metadata.errorCode ? knownErrorCodes.has(phase.metadata.errorCode) ? phase.metadata.errorCode : "unclassified" : existing?.errorCode ?? null,
			actorIds: [...new Set([...(existing?.actorIds ?? []), ...linkedAudit.flatMap((row) => row.actorId ? [row.actorId] : []), ...(phase.metadata.actorId ? [phase.metadata.actorId] : [])])],
			initiatorIds: [...new Set([...(existing?.initiatorIds ?? []), ...linkedUsage.flatMap((row) => row.metadata.initiatorId ? [row.metadata.initiatorId] : []), ...(phase.metadata.initiatorId ? [phase.metadata.initiatorId] : [])])],
			auditIds: [...new Set([...(existing?.auditIds ?? []), ...linkedAudit.map((row) => row.id)])],
			usageEventIds: linkedUsage.map((row) => row.id), knownUsd: prices.length ? prices.reduce((sum, value) => sum + value, 0) : null, unpricedEvents: eligibleCosts.length - prices.length,
		});
	}
	const operations = [...operationMap.values()].sort((a, b) => b.observedAt.localeCompare(a.observedAt));
	const auditComparable = ["current", "previous"].every((period) => sources.some((source) => source.name === "audit" && source.period === period && source.status === "available" && !source.truncated));
	const activityMap = new Map<string, ActivityRow>();
	const previousDays = new Map<string, Set<string>>();
	const activities = [
		...auditRows.filter((row) => completeDay(row.created_at)).map((row) => ({ tenantId: row.tenant_id, actorId: row.actor_id, feature: `${row.table_name}.${row.action}`, metric: "audit_changes" as const, createdAt: row.created_at })),
		...phases.filter((row) => completeDay(row.created_at) && row.context === "ocr_operation_started" && row.metadata.actorType === "user" && row.metadata.actorId && row.metadata.initiatorId === row.metadata.actorId && row.metadata.preview === false && row.metadata.simulation === false && row.metadata.impersonation === false && row.metadata.test === false).map((row) => ({ tenantId: row.tenant_id, actorId: row.metadata.actorId ?? null, feature: "ocr.request", metric: "ocr_requests" as const, createdAt: row.created_at })),
	];
	for (const row of activities) {
		const key = `${row.tenantId}:${row.actorId}:${row.feature}`;
		let entry = activityMap.get(key);
		if (!entry) {
			entry = { tenantId: row.tenantId, actorId: row.actorId, actorName: actorName(row.actorId), feature: row.feature, metric: row.metric, current: 0, previous: 0, activeDays: 0, previousActiveDays: 0, comparable: row.metric === "audit_changes" && auditComparable && tenants.some((tenant) => tenant.id === row.tenantId && Date.parse(tenant.created_at) <= previousStart), days: [] };
			activityMap.set(key, entry);
		}
		const day = new Date(row.createdAt).toISOString().slice(0, 10);
		if (current(row.createdAt)) {
			entry.current++;
			const existingDay = entry.days.find((item) => item.date === day);
			if (existingDay) existingDay.count++; else entry.days.push({ date: day, count: 1 });
			entry.activeDays = entry.days.length;
		} else {
			entry.previous++;
			const observedDays = previousDays.get(key) ?? new Set<string>();
			observedDays.add(day); previousDays.set(key, observedDays); entry.previousActiveDays = observedDays.size;
		}
	}
	const completeAudit = audit.filter((row) => completeDay(row.createdAt));
	const people: OperationsSnapshot["people"] = memberships.map((member) => ({ tenantId: member.tenant_id, id: member.user_id, name: actorName(member.user_id), role: member.role, auditChanges: completeAudit.filter((entry) => entry.tenantId === member.tenant_id && entry.actorId === member.user_id).length }));
	for (const entry of audit) {
		if (entry.actorId && !people.some((person) => person.tenantId === entry.tenantId && person.id === entry.actorId)) {
			people.push({ tenantId: entry.tenantId, id: entry.actorId, name: entry.actorName, role: null, auditChanges: completeAudit.filter((item) => item.tenantId === entry.tenantId && item.actorId === entry.actorId).length });
		}
	}
	for (const phase of phases) {
		const actorId = phase.metadata.actorId;
		if (actorId && !people.some((person) => person.tenantId === phase.tenant_id && person.id === actorId)) {
			people.push({ tenantId: phase.tenant_id, id: actorId, name: actorName(actorId), role: null, auditChanges: 0 });
		}
	}
	const durations = operations.flatMap((row) => row.durationMs === null || (row.status !== "completed" && row.status !== "failed") ? [] : [row.durationMs]).sort((a, b) => a - b);
	const middle = Math.floor(durations.length / 2);
	const median = durations.length ? durations.length % 2 ? durations[middle] : (durations[middle - 1] + durations[middle]) / 2 : null;
	return {
		generatedAt: now.toISOString(), selection, window, measurement: "observed_sample", sources,
		tenants: tenants.map((tenant) => {
			const tenantCosts = costs.filter((cost) => cost.tenantId === tenant.id);
			const priced = tenantCosts.flatMap((cost) => cost.knownUsd === null ? [] : [cost.knownUsd]);
			return { id: tenant.id, name: tenant.name, createdAt: tenant.created_at, members: memberships.filter((member) => member.tenant_id === tenant.id).length,
				activeActors: new Set(completeAudit.filter((row) => row.tenantId === tenant.id && row.actorId !== null).map((row) => row.actorId)).size,
				auditChanges: completeAudit.filter((row) => row.tenantId === tenant.id).length,
				previousAuditChanges: auditRows.filter((row) => row.tenant_id === tenant.id && !current(row.created_at)).length,
				observedJobs: operations.filter((row) => row.tenantId === tenant.id).length, failedJobs: operations.filter((row) => row.tenantId === tenant.id && row.status === "failed").length,
				knownUsd: priced.length ? priced.reduce((sum, value) => sum + value, 0) : null, unpricedEvents: tenantCosts.reduce((sum, cost) => sum + cost.unpricedEvents, 0), hasFullWindow: auditComparable && Date.parse(tenant.created_at) <= previousStart };
		}),
		people, activity: [...activityMap.values()].sort((a, b) => b.current - a.current), audit, operations, costs,
		daily: Array.from({ length: selection.days }, (_, index) => {
			const date = new Date(start + index * 86_400_000).toISOString().slice(0, 10);
			return { date, auditChanges: audit.filter((row) => new Date(row.createdAt).toISOString().startsWith(date)).length, observedJobs: operations.filter((row) => new Date(row.observedAt).toISOString().startsWith(date)).length };
		}),
		health: { observedJobs: operations.length, completed: operations.filter((row) => row.status === "completed").length, failed: operations.filter((row) => row.status === "failed").length, pending: operations.filter((row) => row.status === "pending").length, processing: operations.filter((row) => row.status === "processing").length, medianDurationMs: median, durationSamples: durations.length },
		backup: { status: "unconfigured" },
	};
}
