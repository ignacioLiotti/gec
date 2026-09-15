import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), provision: vi.fn() }));
vi.mock("@/app/api/obras/route", () => ({
  getAuthContext: mocks.auth,
  loadTenantMainTableCustomColumnIds: vi.fn().mockResolvedValue(null),
  sanitizeCustomData: () => ({}),
}));
vi.mock("@/lib/obra-defaults/provision", () => ({ provisionObraDefaults: mocks.provision }));

import { PATCH } from "@/app/api/obras/bulk/route";
import { POST } from "@/app/api/obras/first/route";

const obraId = "11111111-1111-4111-8111-111111111111";
const obra = {
  n: 1, designacionYUbicacion: "Desague pluvial", entidadContratante: "IN.VI.CO",
  mesBasicoDeContrato: "2026-09-01", iniciacion: "2026-09-15", supDeObraM2: 0,
  contratoMasAmpliaciones: 0, certificadoALaFecha: 0, saldoACertificar: 0,
  segunContrato: 0, prorrogasAcordadas: 0, plazoTotal: 0, plazoTransc: 0, porcentaje: 0,
};

describe.each([
  { name: "bulk creation", handler: PATCH, payload: { updates: [obra], tenant_id: "other-tenant" }, status: 200, write: "upsert" },
  { name: "first obra", handler: POST, payload: { ...obra, tenant_id: "other-tenant" }, status: 201, write: "insert" },
])("$name", ({ handler, payload, status, write }) => {
  let rpc: ReturnType<typeof vi.fn>;
  let query: Record<string, ReturnType<typeof vi.fn>>;
  beforeEach(() => {
    rpc = vi.fn(async (name: string) => ({ data: name === "is_member_of", error: null }));
    query = {};
    for (const method of ["select", "eq", "is", "order", "limit", "insert", "upsert", "in"]) query[method] = vi.fn(() => query);
    query.single = vi.fn().mockResolvedValue({ data: { id: obraId, n: 1 }, error: null });
    query.then = vi.fn((resolve) => resolve({ data: [{ id: obraId, n: 1 }], error: null, count: 0 }));
    mocks.auth.mockResolvedValue({ user: { id: "member" }, tenantId: "tenant-1", supabase: { rpc, from: vi.fn(() => query) } });
    mocks.provision.mockResolvedValue({ success: true, foldersApplied: 8, tablasApplied: 4 });
  });
  const request = () => new Request("http://localhost/api/obras", { method: "POST", body: JSON.stringify(payload) });

  it("creates and provisions for a member without operational permissions in the active tenant", async () => {
    const response = await handler(request());
    expect(response.status).toBe(status);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("is_member_of", { tenant: "tenant-1" });
    const value = query[write].mock.calls[0][0];
    expect(Array.isArray(value) ? value[0].tenant_id : value.tenant_id).toBe("tenant-1");
    expect(mocks.provision).toHaveBeenCalledWith(expect.anything(), obraId, "tenant-1");
  });
  it("rejects non-members before writing or provisioning", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect((await handler(request())).status).toBe(403);
    expect(query[write]).not.toHaveBeenCalled();
    expect(mocks.provision).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated requests", async () => {
    mocks.auth.mockResolvedValue({ user: null, tenantId: null });
    expect((await handler(request())).status).toBe(401);
    expect(query[write]).not.toHaveBeenCalled();
  });
  it("fails closed when membership lookup fails", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("lookup failed") });
    expect((await handler(request())).status).toBe(500);
    expect(query[write]).not.toHaveBeenCalled();
  });
  it("does not report success when default materialization fails", async () => {
    mocks.provision.mockResolvedValue({ success: false, foldersApplied: 0, tablasApplied: 0, error: "setup failed" });
    expect((await handler(request())).status).toBe(503);
  });
});
