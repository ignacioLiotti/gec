import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ roles: vi.fn(), admin: vi.fn(), recovery: vi.fn() }));
vi.mock("@/lib/route-guard", () => ({ getUserRoles: mocks.roles }));
vi.mock("@/utils/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
vi.mock("@/lib/operations-recovery", () => ({ loadOperationsRecoveryStatus: mocks.recovery }));

import { GET } from "@/app/api/admin/operations/route";
import { loadOperationsSnapshot } from "@/lib/admin/operations/server";

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const tenantId = id(1);
const now = new Date();
const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
const yesterday = new Date(today - 86_400_000).toISOString();
const oldDate = "2025-01-01T00:00:00Z";
type Row = Record<string, unknown>;

// In-memory transport respects predicates and ranges; it does not exercise PostgreSQL/RLS.
function database(tables: Record<string, Row[]>, failure?: string) {
	const calls: { table: string; filters: { column: string; value: unknown }[]; from: number; to: number }[] = [];
	return {
		calls,
		from(table: string) {
			const predicates: ((row: Row) => boolean)[] = [];
			const filters: { column: string; value: unknown }[] = [];
			let from = 0; let to = 0;
			function value(row: Row, column: string): unknown {
				if (column === "obras.tenant_id") {
					const obra = row.obras;
					return typeof obra === "object" && obra !== null && "tenant_id" in obra ? obra.tenant_id : undefined;
				}
				return row[column];
			}
			const query = {
				select: () => query, order: () => query,
				eq(column: string, target: unknown) { filters.push({ column, value: target }); predicates.push((row) => value(row, column) === target); return query; },
				in(column: string, targets: unknown[]) { filters.push({ column, value: targets }); predicates.push((row) => targets.includes(value(row, column))); return query; },
				gte(column: string, target: string) { filters.push({ column, value: target }); predicates.push((row) => typeof value(row, column) === "string" && Date.parse(String(value(row, column))) >= Date.parse(target)); return query; },
				lt(column: string, target: string) { filters.push({ column, value: target }); predicates.push((row) => typeof value(row, column) === "string" && Date.parse(String(value(row, column))) < Date.parse(target)); return query; },
				range(start: number, end: number) { from = start; to = end; return query; },
				then(resolve: (value: { data: Row[] | null; error: unknown }) => unknown) {
					calls.push({ table, filters, from, to });
					return Promise.resolve(resolve(table === failure ? { data: null, error: { message: "database-password-private" } } : { data: (tables[table] ?? []).filter((row) => predicates.every((predicate) => predicate(row))).slice(from, to + 1), error: null }));
				},
			};
			return query;
		},
	};
}
function auditRow(value: number, tenant = tenantId): Row {
	return { id: id(value), tenant_id: tenant, actor_id: id(3), table_name: "obras", action: "UPDATE", row_pk: { id: id(8) }, changed_keys: [], before_data: {}, after_data: {}, context: {}, created_at: yesterday };
}
function tables(): Record<string, Row[]> {
	return { tenants: [{ id: tenantId, name: "Tenant A", created_at: oldDate }, { id: id(2), name: "Tenant B", created_at: oldDate }], memberships: [], profiles: [], audit_log: [], tenant_usage_events: [], ocr_document_processing: [] };
}

beforeEach(() => { mocks.roles.mockReset(); mocks.admin.mockReset(); mocks.recovery.mockReset(); mocks.recovery.mockResolvedValue({ status: "unconfigured" }); });

describe("operations server boundary", () => {
	it.each([
		{ isSuperAdmin: false, isAdmin: false },
		{ isSuperAdmin: false, isAdmin: true },
		{ isSuperAdmin: false, actualIsSuperAdmin: true, permissionSimulation: { roles: [] } },
		{ isSuperAdmin: false, isAdmin: true, canManageTenantLimits: true },
	])("denies ineffective superadmin roles before admin-client creation: %j", async (roles) => {
		mocks.roles.mockResolvedValue(roles);
		const response = await GET(new Request("http://localhost/api/admin/operations?days=7"));
		expect(response.status).toBe(403);
		expect(mocks.admin).not.toHaveBeenCalled();
		expect(mocks.recovery).not.toHaveBeenCalled();
	});

	it("passes the sanitized recovery source through only after authorization", async () => {
		mocks.roles.mockResolvedValue({ isSuperAdmin: true });
		mocks.admin.mockReturnValue(database(tables()));
		mocks.recovery.mockResolvedValue({ status: "unavailable" });
		const snapshot = await loadOperationsSnapshot({ tenantId, days: 7 });
		expect(snapshot.backup).toEqual({ status: "unavailable" });
		expect(mocks.recovery).toHaveBeenCalledOnce();
	});

	it("scopes each source, returns only selected tenant, and uses no-store", async () => {
		mocks.roles.mockResolvedValue({ isSuperAdmin: true });
		const data = tables();
		data.audit_log = [auditRow(10), auditRow(11, id(2))];
		const client = database(data); mocks.admin.mockReturnValue(client);
		const response = await GET(new Request(`http://localhost/api/admin/operations?tenantId=${tenantId}&days=7`));
		const snapshot = await response.json();
		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("private, no-store");
		expect(snapshot.audit).toHaveLength(1);
		expect(snapshot.tenants).toHaveLength(1);
		for (const call of client.calls.filter((item) => ["audit_log", "tenant_usage_events", "memberships", "ocr_document_processing"].includes(item.table))) {
			expect(call.filters).toContainEqual({ column: call.table === "ocr_document_processing" ? "obras.tenant_id" : "tenant_id", value: [tenantId] });
		}
	});

	it("bounds source pages and marks a truncated current sample without hiding the previous period", async () => {
		mocks.roles.mockResolvedValue({ isSuperAdmin: true });
		const data = tables();
		data.audit_log = Array.from({ length: 1001 }, (_, index) => auditRow(index + 100));
		data.audit_log.push({ ...auditRow(2000), created_at: new Date(today - 8 * 86_400_000).toISOString() });
		const client = database(data); mocks.admin.mockReturnValue(client);
		const snapshot = await loadOperationsSnapshot({ tenantId, days: 7 });
		expect(snapshot.audit).toHaveLength(1000);
		expect(snapshot.sources.find((source) => source.name === "audit" && source.period === "current")).toMatchObject({ status: "partial", truncated: true, rows: 1000 });
		expect(snapshot.tenants[0].previousAuditChanges).toBe(1);
		expect(snapshot.activity[0].comparable).toBe(false);
		expect(client.calls.every((call) => call.to - call.from < 250 && call.to <= 1000)).toBe(true);
	});

	it("isolates an unavailable source and never returns its raw error", async () => {
		mocks.roles.mockResolvedValue({ isSuperAdmin: true });
		const data = tables(); data.audit_log = [auditRow(10)];
		mocks.admin.mockReturnValue(database(data, "tenant_usage_events"));
		const snapshot = await loadOperationsSnapshot({ tenantId, days: 7 });
		expect(snapshot.audit).toHaveLength(1);
		expect(snapshot.sources.find((source) => source.name === "usage")).toMatchObject({ status: "unavailable", rows: 0 });
		expect(snapshot.tenants[0].knownUsd).toBeNull();
		expect(JSON.stringify(snapshot)).not.toContain("database-password-private");
	});

	it("reports malformed records as partial, and sanitizes startup errors", async () => {
		mocks.roles.mockResolvedValue({ isSuperAdmin: true });
		const data = tables(); data.audit_log = [auditRow(10), { ...auditRow(11), actor_id: "malformed" }];
		mocks.admin.mockReturnValue(database(data));
		const snapshot = await loadOperationsSnapshot({ tenantId, days: 7 });
		expect(snapshot.audit).toHaveLength(1);
		expect(snapshot.sources.find((source) => source.name === "audit" && source.period === "current")).toMatchObject({ status: "partial", truncated: false });
		mocks.admin.mockImplementation(() => { throw new Error("private-service-role"); });
		const response = await GET(new Request("http://localhost/api/admin/operations"));
		expect(response.status).toBe(503);
		expect(await response.text()).not.toContain("private-service-role");
	});
});
