import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { provisionObraDefaults } from "@/lib/obra-defaults/provision";

function client(failure?: "columns" | "storage" | "begin" | "finish") {
  const inserted: Record<string, unknown[]> = {};
  const rows: Record<string, unknown[]> = {
    obra_default_folders: [{ id: "folder", name: "Ordenes", path: "ordenes", position: 0 }],
    obra_default_tablas: [{ id: "default", name: "Ordenes", source_type: "ocr", linked_folder_path: "ordenes", settings: {} }],
    obra_default_tabla_columns: [{ id: "column", default_tabla_id: "default", field_key: "total", label: "Total", data_type: "number", position: 0, required: false }],
  };
  const rpc = vi.fn(async (name: string) => ({
    data: name === "begin_obra_setup_provisioning" ? "attempt" : true,
    error: name.startsWith(failure ?? "never") ? { code: "42501", message: "denied" } : null,
  }));
  const upload = vi.fn().mockResolvedValue({ error: failure === "storage" ? { message: "storage failed" } : null });
  const from = vi.fn((table: string) => {
    let writing = false;
    const result = () => ({
      data: writing ? null : rows[table] ?? [],
      error: writing && table === "obra_tabla_columns" && failure === "columns" ? { message: "column write failed" } : null,
    });
    const query = {
      select: vi.fn(() => query), eq: vi.fn(() => query), in: vi.fn(() => query), order: vi.fn(() => query),
      insert: vi.fn((value: unknown) => { writing = true; (inserted[table] ??= []).push(value); return query; }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: "new-table" }, error: null }),
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return query;
  });
  return { supabase: { rpc, from, storage: { from: () => ({ upload }) } } as unknown as SupabaseClient, rpc, inserted, upload };
}

describe("member obra provisioning", () => {
  it("materializes folders, tables, and columns before recording ready", async () => {
    const { supabase, rpc, inserted, upload } = client();
    expect(await provisionObraDefaults(supabase, "obra-1", "tenant-1")).toMatchObject({ success: true, foldersApplied: 1, tablasApplied: 1 });
    expect(upload.mock.calls[0][0]).toBe("obra-1/ordenes/.keep");
    expect(inserted.obra_tablas[0]).toMatchObject({ obra_id: "obra-1" });
    expect(inserted.obra_tabla_columns[0]).toEqual([expect.objectContaining({ tabla_id: "new-table", field_key: "total" })]);
    expect(rpc).toHaveBeenLastCalledWith("finish_obra_setup_provisioning", expect.objectContaining({ p_attempt_id: "attempt", p_status: "ready" }));
  });
  it.each(["columns", "storage"] as const)("records partial when %s materialization fails", async (failure) => {
    const { supabase, rpc } = client(failure);
    expect((await provisionObraDefaults(supabase, "obra-1", "tenant-1")).success).toBe(false);
    expect(rpc).toHaveBeenLastCalledWith("finish_obra_setup_provisioning", expect.objectContaining({ p_status: "partial" }));
  });
  it("does not materialize anything when begin is denied", async () => {
    const { supabase, inserted, upload } = client("begin");
    expect((await provisionObraDefaults(supabase, "obra-1", "tenant-1")).success).toBe(false);
    expect(inserted).toEqual({});
    expect(upload).not.toHaveBeenCalled();
  });
  it("does not report ready when recording completion fails", async () => {
    const { supabase } = client("finish");
    expect((await provisionObraDefaults(supabase, "obra-1", "tenant-1")).success).toBe(false);
  });
});
