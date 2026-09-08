import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/app/api/obras/route", () => ({
 getAuthContext: mocks.auth,
 loadTenantMainTableCustomColumnIds: vi.fn().mockResolvedValue(null),
 sanitizeCustomData: (data: unknown) => data,
 executeFlujoActions: vi.fn(),
}));
vi.mock("@/lib/notifications/engine", () => ({ emitEvent: vi.fn() }));
vi.mock("@/lib/obras/delete-lifecycle", () => ({ softDeleteObraWithDocuments: vi.fn() }));
vi.mock("@/lib/demo-session", () => ({ hasAnyDemoCapability: vi.fn(), resolveRequestAccessContext: vi.fn() }));
vi.mock("@/lib/insurance-policies", () => ({ updateInsurancePoliciesForObraCompletion: vi.fn() }));
vi.mock("@/lib/insurance-policies-macro", () => ({ syncInsurancePoliciesToMacroTable: vi.fn() }));

import { PATCH, PUT } from "@/app/api/obras/[id]/route";

const obraId = "11111111-1111-4111-8111-111111111111";
const payload = {
 n: 103, designacionYUbicacion: "Obra de prueba", supDeObraM2: 6015,
 entidadContratante: "Entidad", mesBasicoDeContrato: "2025-10", iniciacion: "2026-07-06",
 contratoMasAmpliaciones: 100, certificadoALaFecha: 32, saldoACertificar: 68,
 segunContrato: 3, prorrogasAcordadas: 0, plazoTotal: 3, plazoTransc: 1, porcentaje: 32,
};

describe.each([{ method: "PUT", handler: PUT }, { method: "PATCH", handler: PATCH }])("existing obra edit via $method", ({ method, handler }) => {
 let member: boolean;
 let rpc: ReturnType<typeof vi.fn>;
 let query: Record<string, ReturnType<typeof vi.fn>>;
 beforeEach(() => {
  member = true;
  rpc = vi.fn(async (name: string) => ({ data: name === "is_member_of" && member, error: null }));
  query = {};
  for (const method of ["select", "eq", "is", "update"]) query[method] = vi.fn(() => query);
  query.maybeSingle = vi.fn().mockResolvedValue({ data: { porcentaje: 32, designacion_y_ubicacion: "Obra" }, error: null });
  mocks.auth.mockResolvedValue({ user: { id: "member" }, tenantId: "tenant-1", supabase: { rpc, from: vi.fn(() => query) } });
 });
 const request = () => new Request("http://localhost/api/obras/" + obraId, { method, body: JSON.stringify(payload) });
 const context = () => ({ params: Promise.resolve({ id: obraId }) });

 it("saves for a tenant member without obras:edit and scopes the write", async () => {
  const response = await handler(request(), context());
  expect(response.status).toBe(200);
  expect(rpc).toHaveBeenCalledWith("is_member_of", { tenant: "tenant-1" });
  expect(query.update).toHaveBeenCalled();
  expect(query.eq).toHaveBeenCalledWith("tenant_id", "tenant-1");
  expect(query.eq).toHaveBeenCalledWith("id", obraId);
 });
 it("rejects a non-member before writing", async () => {
  member = false;
  expect((await handler(request(), context())).status).toBe(403);
  expect(query.update).not.toHaveBeenCalled();
 });
 it("rejects unauthenticated requests", async () => {
  mocks.auth.mockResolvedValue({ user: null, tenantId: null });
  expect((await handler(request(), context())).status).toBe(401);
  expect(query.update).not.toHaveBeenCalled();
 });
 it("does not write when membership lookup fails", async () => {
  rpc.mockResolvedValue({ data: null, error: new Error("lookup failed") });
  expect((await handler(request(), context())).status).toBe(500);
  expect(query.update).not.toHaveBeenCalled();
 });
});
