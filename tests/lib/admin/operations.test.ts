import { describe, expect, it } from "vitest";
import { AuditSchema, OcrSchema, UsageSchema, type OperationsRecords } from "@/lib/admin/operations/records";
import { projectOperationsSnapshot } from "@/lib/admin/operations/project";
import { observationWindow, parseOperationsSelection } from "@/lib/admin/operations/selection";
import type { SourceStatus } from "@/lib/admin/operations/types";

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const tenant = id(1);
const otherTenant = id(2);
const actor = id(3);
const extraction = id(4);
const now = new Date("2026-10-17T15:00:00Z");
const sources: SourceStatus[] = ["current", "previous"].map((period) => ({ name: "audit", period: period === "current" ? "current" : "previous", status: "available", rows: 0, truncated: false, coverage: "Observed" }));

function records(): OperationsRecords {
	return {
		tenants: [{ id: tenant, name: "Tenant A", created_at: "2025-01-01T00:00:00Z" }, { id: otherTenant, name: "Tenant B", created_at: "2025-01-01T00:00:00Z" }],
		memberships: [{ tenant_id: tenant, user_id: actor, role: "member", created_at: "2025-01-01T00:00:00Z" }],
		profiles: [{ user_id: actor, full_name: "Persona A" }], audit: [], usage: [], ocr: [],
	};
}

function audit(overrides: Record<string, unknown> = {}) {
	return AuditSchema.parse({ id: id(10), tenant_id: tenant, actor_id: actor, table_name: "obra_tabla_rows", action: "UPDATE", row_pk: { id: id(11) }, changed_keys: ["status"], before_data: { status: "pending" }, after_data: { status: "completed", extraction_id: extraction }, context: {}, created_at: "2026-10-16T12:00:00Z", ...overrides });
}
function usage(overrides: Record<string, unknown> = {}) {
	return UsageSchema.parse({ id: id(20), tenant_id: tenant, kind: "ai_tokens", amount: 100, context: "ocr_tokens", metadata: {}, created_at: "2026-10-16T12:00:00Z", ...overrides });
}
function ocr(overrides: Record<string, unknown> = {}) {
	return OcrSchema.parse({ id: id(30), obra_id: id(40), tabla_id: id(50), extraction_id: extraction, status: "completed", rows_extracted: 5, processing_duration_ms: 300, error_code: null, updated_at: "2026-10-16T12:00:00Z", obras: { tenant_id: tenant }, ...overrides });
}
function project(input: OperationsRecords, sourceStatus = sources) {
	return projectOperationsSnapshot({ records: input, selection: { tenantId: tenant, days: 7 }, sources: sourceStatus, now });
}

describe("operations observation contract", () => {
	it("uses complete UTC days with half-open current and prior periods", () => {
		expect(observationWindow(7, now)).toEqual({ start: "2026-10-10T00:00:00.000Z", end: "2026-10-17T00:00:00.000Z", liveEnd: now.toISOString(), previousStart: "2026-10-03T00:00:00.000Z", timeZone: "UTC" });
		const input = records();
		input.audit = [audit({ id: id(101), created_at: "2026-10-03T00:00:00Z" }), audit({ id: id(102), created_at: "2026-10-10T00:00:00Z" }), audit({ id: id(103), created_at: "2026-10-17T00:00:00Z" }), audit({ id: id(104), created_at: "2026-10-02T23:59:59Z" })];
		const snapshot = project(input);
		expect(snapshot.activity[0]).toMatchObject({ current: 1, previous: 1, activeDays: 1, previousActiveDays: 1, comparable: true });
		expect(snapshot.audit.map((row) => row.id)).toEqual([id(103), id(102)]);
		expect(snapshot.tenants[0].auditChanges).toBe(1);
		expect(snapshot.daily).toHaveLength(7);
	});

	it("rejects invalid, repeated, or unknown selection parameters", () => {
		expect(parseOperationsSelection(new URLSearchParams())).toEqual({ tenantId: null, days: 30 });
		for (const query of ["days=365", "tenantId=bad", "days=7&days=30", "other=1"]) expect(() => parseOperationsSelection(new URLSearchParams(query))).toThrow();
	});

	it("isolates tenant records and exact correlations, including shared extraction ids", () => {
		const input = records();
		input.audit = [audit(), audit({ id: id(12), tenant_id: otherTenant })];
		input.usage = [usage({ metadata: { extractionId: extraction, costUsd: 0.2 } }), usage({ id: id(21), tenant_id: otherTenant, metadata: { extractionId: extraction, costUsd: 999 } }), usage({ id: id(22), metadata: { obraId: id(40), tablaId: id(50), costUsd: 0.3 } })];
		input.ocr = [ocr(), ocr({ id: id(31), obras: { tenant_id: otherTenant } })];
		const snapshot = project(input);
		expect(snapshot.tenants).toHaveLength(1);
		expect(snapshot.audit).toHaveLength(1);
		expect(snapshot.operations).toHaveLength(1);
		expect(snapshot.operations[0]).toMatchObject({ knownUsd: 0.2, usageEventIds: [id(20)], auditIds: [id(10)], actorIds: [actor] });
		expect(snapshot.costs[0].knownUsd).toBe(0.5);
	});

	it("does not turn reservations, rollback adjustments or unknown prices into actions or zero cost", () => {
		const input = records();
		input.usage = [usage({ amount: 1000 }), usage({ id: id(21), amount: -1000 }), usage({ id: id(22), amount: 5, metadata: { costUsd: null } })];
		const snapshot = project(input);
		expect(snapshot.activity).toEqual([]);
		expect(snapshot.operations).toEqual([]);
		expect(snapshot.costs[0]).toMatchObject({ netAmount: 5, knownUsd: null, pricedEvents: 0, unpricedEvents: 2 });
		expect(snapshot.tenants[0].knownUsd).toBeNull();
	});

	it.each(["ocr_import", "ocr_import_multi"])("excludes quota bookkeeping around %s from both tenant and operation cost coverage", (context) => {
		const input = records();
		const multi = context === "ocr_import_multi";
		const metadata = { extractionId: extraction, obraId: id(40) };
		input.usage = [
			usage({ context: multi ? "ocr_reservation_multi" : "ocr_reservation", amount: 2000, metadata }),
			usage({ id: id(21), context, amount: 1500, metadata: { ...metadata, costUsd: 0.3 } }),
			usage({ id: id(22), context: multi ? "ocr_reservation_rollback_multi" : "ocr_reservation_rollback", amount: -2000, metadata: { ...metadata, costUsd: 999 } }),
			usage({ id: id(23), context: "ocr_reservation_rollback_failed", amount: 0, metadata }),
		];
		input.ocr = [ocr()];
		const snapshot = project(input);
		expect(snapshot.costs[0]).toMatchObject({ netAmount: 1500, knownUsd: 0.3, pricedEvents: 1, unpricedEvents: 0 });
		expect(snapshot.operations[0]).toMatchObject({ knownUsd: 0.3, unpricedEvents: 0, usageEventIds: [id(20), id(21), id(22), id(23)] });
		expect(snapshot.activity).toEqual([]);
	});

	it("retains an unpriced provider call, ignores a failed reservation, and keeps signed movements", () => {
		const input = records();
		const metadata = { extractionId: extraction, obraId: id(40) };
		input.usage = [
			usage({ context: "ocr_reservation", amount: 2000, metadata }),
			usage({ id: id(21), context: "ocr_import", amount: 2000, metadata }),
			usage({ id: id(22), context: "ocr_extraction_failed", amount: -2000, metadata }),
			usage({ id: id(23), context: "unknown-negative", amount: -100, metadata }),
			usage({ id: id(24), context: "ocr_operation_failed", amount: 0, metadata }),
		];
		const snapshot = project(input);
		expect(snapshot.costs[0]).toMatchObject({ netAmount: 1900, knownUsd: null, pricedEvents: 0, unpricedEvents: 1 });
		expect(snapshot.operations[0]).toMatchObject({ status: "failed", knownUsd: null, unpricedEvents: 1 });
	});

	it("counts storage uploads and WhatsApp usage as unpriced but not storage deletion rollback", () => {
		const input = records();
		input.usage = [
			usage({ kind: "storage_bytes", context: "documents_upload", amount: 100 }),
			usage({ id: id(21), kind: "storage_bytes", context: "documents_soft_delete", amount: -100 }),
			usage({ id: id(22), kind: "storage_bytes", context: "documents_soft_delete_rollback", amount: 100 }),
			usage({ id: id(23), kind: "whatsapp_messages", context: null, amount: 3 }),
		];
		const snapshot = project(input);
		expect(snapshot.costs.find((cost) => cost.kind === "storage_bytes")).toMatchObject({ netAmount: 100, knownUsd: null, unpricedEvents: 1 });
		expect(snapshot.costs.find((cost) => cost.kind === "whatsapp_messages")).toMatchObject({ netAmount: 3, knownUsd: null, unpricedEvents: 1 });
	});

	it("retains a recorded zero price and rejects malformed price metadata", () => {
		const input = records();
		input.usage = [usage({ metadata: { costUsd: 0 } }), usage({ id: id(21), metadata: { costUsd: -3 } }), usage({ id: id(22), metadata: { costUsd: "4" } })];
		expect(project(input).costs[0]).toMatchObject({ knownUsd: 0, pricedEvents: 1, unpricedEvents: 2 });
	});

	it("deduplicates source records without losing a distinct audited change", () => {
		const input = records();
		input.audit = [audit(), audit(), audit({ id: id(12) })];
		input.usage = [usage({ metadata: { costUsd: 0.2 } }), usage({ metadata: { costUsd: 0.2 } })];
		expect(project(input).tenants[0]).toMatchObject({ auditChanges: 2, knownUsd: 0.2 });
	});

	it("never sends arbitrary audit JSON, provider errors, secret values or secret field names", () => {
		const input = records();
		input.audit = [audit({ changed_keys: ["status", "password", "secret-example-value"], before_data: { status: "pending", password: "secret-example-value", json: { credential: "secret-example-value" } }, after_data: { status: "completed", password: "secret-example-value" }, context: { providerResponse: "secret-example-value" } })];
		input.ocr = [ocr({ error_code: "secret-example-value", error_message: "secret-example-value", source_path: "secret-example-value" })];
		const snapshot = project(input);
		expect(snapshot.audit[0]).toMatchObject({ fields: [{ field: "status", before: "pending", after: "completed", redacted: false }], hiddenFieldCount: 2 });
		expect(snapshot.operations[0].errorCode).toBe("unclassified");
		expect(JSON.stringify(snapshot)).not.toContain("secret-example-value");
	});

	it.each([null, "private-unknown-status"])("keeps exact extraction correlation and valid numeric diffs with status %j", (status) => {
		const input = records(); input.ocr = [ocr()];
		input.audit = [audit({ changed_keys: ["status", "processing_duration_ms", "rows_extracted"], before_data: { status: "pending", processing_duration_ms: null, rows_extracted: 0 }, after_data: { extraction_id: extraction, status, processing_duration_ms: 300, rows_extracted: "private-bad-number" } })];
		const snapshot = project(input);
		expect(snapshot.operations[0].auditIds).toEqual([id(10)]);
		expect(snapshot.audit[0].extractionId).toBe(extraction);
		expect(snapshot.audit[0].fields).toContainEqual({ field: "processing_duration_ms", before: null, after: 300, redacted: false });
		expect(snapshot.audit[0].fields.some((field) => field.field === "rows_extracted")).toBe(false);
		if (status === null) expect(snapshot.audit[0].fields).toContainEqual({ field: "status", before: "pending", after: null, redacted: false });
		else expect(snapshot.audit[0].fields.some((field) => field.field === "status")).toBe(false);
		expect(snapshot.audit[0].hiddenFieldCount).toBe(status === null ? 1 : 2);
		expect(JSON.stringify(snapshot)).not.toContain("private-");
	});

	it("counts suppressed creation fields even when changed_keys is absent", () => {
		const input = records();
		input.audit = [audit({ action: "INSERT", changed_keys: null, before_data: null, after_data: { status: "unknown-private", processing_duration_ms: 300, privateSecret: "private-value" } })];
		const snapshot = project(input);
		expect(snapshot.audit[0]).toMatchObject({ fields: [{ field: "processing_duration_ms", before: null, after: 300, redacted: false }], hiddenFieldCount: 2 });
		expect(JSON.stringify(snapshot)).not.toContain("private");
	});

	it("does not call a truncated sample or a new tenant comparable", () => {
		const input = records(); input.audit = [audit()];
		expect(project(input, sources.map((source) => ({ ...source, truncated: true, status: "partial" }))).activity[0].comparable).toBe(false);
		expect(project(input, sources.map((source) => ({ ...source, truncated: true, status: "partial" }))).tenants[0].hasFullWindow).toBe(false);
		input.tenants[0].created_at = "2026-10-12T00:00:00Z";
		expect(project(input).activity[0].comparable).toBe(false);
		expect(project(input).tenants[0].hasFullWindow).toBe(false);
	});

	it("shows today's extraction and cost immediately without counting a partial day as a completed observation day", () => {
		const input = records();
		input.audit = [audit({ created_at: "2026-10-17T10:00:00Z" })];
		const metadata = { extractionId: extraction, obraId: id(40), actorId: actor, actorType: "user", preview: false };
		input.usage = [usage({ created_at: "2026-10-17T10:00:00Z", amount: 0, context: "ocr_operation_started", metadata }), usage({ id: id(21), created_at: "2026-10-17T10:01:00Z", metadata: { ...metadata, costUsd: 0.4 } }), usage({ id: id(22), created_at: now.toISOString(), metadata: { ...metadata, costUsd: 100 } })];
		const snapshot = project(input);
		expect(snapshot.operations).toHaveLength(1);
		expect(snapshot.audit).toHaveLength(1);
		expect(snapshot.costs[0].knownUsd).toBe(0.4);
		expect(snapshot.activity).toEqual([]);
		expect(snapshot.daily.every((day) => day.auditChanges === 0 && day.observedJobs === 0)).toBe(true);
		expect(snapshot.tenants[0].auditChanges).toBe(0);
	});

	it("keeps demo correlation with null actor and malformed price without exposing arbitrary metadata", () => {
		const input = records();
		input.usage = [usage({ amount: 0, context: "ocr_operation_failed", metadata: { extractionId: extraction, obraId: id(40), actorId: null, actorType: "demo", preview: false, errorCode: "private-provider-error", costUsd: "unknown" } })];
		const snapshot = project(input);
		expect(snapshot.operations[0]).toMatchObject({ extractionId: extraction, status: "failed", actorIds: [], errorCode: "unclassified" });
		expect(snapshot.activity).toEqual([]);
		expect(JSON.stringify(snapshot)).not.toContain("private-provider-error");
	});

	it("refuses to link an older extraction merely because an upsert reused its processing row id", () => {
		const input = records(); input.ocr = [ocr()];
		input.audit = [audit({ table_name: "ocr_document_processing", row_pk: { id: id(30) }, after_data: { extraction_id: id(99) } })];
		expect(project(input).operations[0].auditIds).toEqual([]);
	});

	it("groups multi-table document states by extraction id and uses a sample median", () => {
		const input = records();
		input.ocr = [ocr(), ocr({ id: id(31), tabla_id: id(51), rows_extracted: 3 }), ocr({ id: id(32), extraction_id: id(5), processing_duration_ms: 500 })];
		const snapshot = project(input);
		expect(snapshot.operations).toHaveLength(2);
		expect(snapshot.operations[0]).toMatchObject({ tablaId: null, tablaIds: [id(50), id(51)], rowsExtracted: 8 });
		expect(snapshot.health).toMatchObject({ observedJobs: 2, durationSamples: 2, medianDurationMs: 400 });
	});

	it("does not include pending or in-flight durations in completed-job latency", () => {
		const input = records();
		input.ocr = [ocr(), ocr({ id: id(31), extraction_id: id(5), status: "processing", processing_duration_ms: 1 })];
		input.usage = [usage({ amount: 0, context: "ocr_operation_started", metadata: { extractionId: id(6), obraId: id(40), durationMs: 2 } })];
		const snapshot = project(input);
		expect(snapshot.health).toMatchObject({ durationSamples: 1, medianDurationMs: 300, processing: 2 });
		expect(snapshot.operations.find((operation) => operation.extractionId === id(6))?.durationMs).toBeNull();
	});

	it("counts accepted human OCR requests once, links their phases and excludes phase events from costs", () => {
		const input = records();
		const metadata = { extractionId: extraction, obraId: id(40), tablaIds: [id(50), id(51)], actorId: actor, initiatorId: actor, actorType: "user", preview: false, simulation: false, impersonation: false, test: false };
		input.usage = [usage({ amount: 0, context: "ocr_operation_started", metadata }), usage({ id: id(21), amount: 0, context: "ocr_operation_started", metadata }), usage({ id: id(22), amount: 0, context: "ocr_operation_completed", metadata: { ...metadata, rowsExtracted: 15, durationMs: 800 }, created_at: "2026-10-16T12:05:00Z" }), usage({ id: id(23), amount: -200, metadata: { ...metadata, costUsd: 0.4 } })];
		const snapshot = project(input);
		expect(snapshot.activity).toHaveLength(1);
		expect(snapshot.activity[0]).toMatchObject({ metric: "ocr_requests", current: 1, previous: 0, comparable: false });
		expect(snapshot.operations).toHaveLength(1);
		expect(snapshot.operations[0]).toMatchObject({ status: "completed", rowsExtracted: 15, durationMs: 800, knownUsd: 0.4, basis: "ocr_phase", actorIds: [actor] });
		expect(snapshot.costs[0]).toMatchObject({ pricedEvents: 1, unpricedEvents: 0, netAmount: -200 });
	});

	it.each([{ preview: true }, { actorType: "demo" }, { simulation: true }, { impersonation: true }, { test: true }, { impersonation: null }, { impersonation: undefined }, { simulation: undefined }, { test: undefined }, { initiatorId: null }, { initiatorId: undefined }, { initiatorId: id(81) }])("excludes non-production or unverifiable human activity %j", (flags) => {
		const input = records();
		input.usage = [usage({ amount: 0, context: "ocr_operation_started", metadata: { extractionId: extraction, obraId: id(40), actorId: actor, initiatorId: actor, actorType: "user", preview: false, simulation: false, impersonation: false, test: false, ...flags } })];
		expect(project(input).activity).toEqual([]);
		expect(project(input).operations).toHaveLength(1);
	});

	it("keeps explicit initiating and executing identities separate without inferring an origin", () => {
		const input = records();
		input.usage = [usage({ amount: 0, context: "ocr_operation_started", metadata: { extractionId: extraction, obraId: id(40), actorId: actor, initiatorId: id(80), actorType: "user", preview: false, simulation: false, impersonation: true, test: false } })];
		expect(project(input).operations[0]).toMatchObject({ actorIds: [actor], initiatorIds: [id(80)] });
		expect(project(input).activity).toEqual([]);
		input.usage = [usage({ amount: 0, context: "ocr_operation_started", metadata: { extractionId: extraction, obraId: id(40), actorId: actor, initiatorId: "not-an-id" } })];
		expect(project(input).operations[0]).toMatchObject({ actorIds: [actor], initiatorIds: [] });
	});
});
