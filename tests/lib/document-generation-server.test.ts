import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  canDeleteGeneratedDocument,
  canEditGeneratedDocument,
  validateGenerationTarget,
} from "@/lib/document-generation-server";

function createSupabaseTableMock(
  rowsByTable: Record<string, Array<Record<string, unknown>>>,
) {
  return {
    from: vi.fn((table: string) => {
      const result = { data: rowsByTable[table] ?? [], error: null };
      const query: Record<string, unknown> = {};
      const chain = vi.fn(() => query);
      Object.assign(query, {
        select: chain,
        eq: chain,
        in: chain,
        order: chain,
        then: (resolve: (value: typeof result) => unknown) =>
          Promise.resolve(result).then(resolve),
      });
      return query;
    }),
  } as unknown as SupabaseClient;
}

describe("generated document authorization", () => {
  it.each(["GENERATED", "UNDER_REVIEW", "APPROVED", "REJECTED"])(
    "allows users with create permission to edit %s documents",
    (status) => {
      expect(canEditGeneratedDocument({ canCreate: true, userId: "user-1", status })).toBe(true);
    },
  );

  it("does not allow editing cancelled documents or editing without create permission", () => {
    expect(
      canEditGeneratedDocument({ canCreate: true, userId: "user-1", status: "CANCELLED" }),
    ).toBe(false);
    expect(
      canEditGeneratedDocument({ canCreate: false, userId: "user-1", status: "APPROVED" }),
    ).toBe(false);
    expect(
      canEditGeneratedDocument({ canCreate: true, userId: null, status: "APPROVED" }),
    ).toBe(false);
  });

  it("allows only the user who generated the document to delete it", () => {
    expect(canDeleteGeneratedDocument({ userId: "user-1", generatedBy: "user-1" })).toBe(true);
    expect(canDeleteGeneratedDocument({ userId: "user-2", generatedBy: "user-1" })).toBe(false);
    expect(canDeleteGeneratedDocument({ userId: null, generatedBy: "user-1" })).toBe(false);
  });
});

describe("generation target validation", () => {
  const workId = "00000000-0000-0000-0000-000000000125";
  const tenantId = "00000000-0000-0000-0000-000000000853";

  it("rejects a virtual tenant folder without a materialized obra extraction table", async () => {
    const supabase = createSupabaseTableMock({
      obra_default_folders: [
        { path: "ordenes-de-compra", name: "Ordenes de Compra" },
      ],
      obra_default_tablas: [
        {
          linked_folder_path: "ordenes-de-compra",
          settings: { documentTypes: ["PURCHASE_ORDER"] },
        },
      ],
      obra_tablas: [],
    });

    const result = await validateGenerationTarget(
      { supabase, tenantId, userId: "user-1" },
      {
        workId,
        folderPath: "ordenes-de-compra",
        documentType: "PURCHASE_ORDER",
      },
    );

    expect(result.valid).toBe(false);
    expect(result.error).toContain("no tiene preparada una tabla de extracción");
  });

  it("accepts a materialized extraction table with columns", async () => {
    const supabase = createSupabaseTableMock({
      obra_default_folders: [
        { path: "ordenes-de-compra", name: "Ordenes de Compra" },
      ],
      obra_default_tablas: [
        {
          linked_folder_path: "ordenes-de-compra",
          settings: { documentTypes: ["PURCHASE_ORDER"] },
        },
      ],
      obra_tablas: [
        {
          id: "table-1",
          settings: {
            ocrFolder: "ordenes-de-compra",
            documentTypes: ["PURCHASE_ORDER"],
          },
        },
      ],
      obra_tabla_columns: [
        {
          tabla_id: "table-1",
          field_key: "numero_orden",
          data_type: "text",
          config: {},
          position: 0,
        },
      ],
    });

    await expect(
      validateGenerationTarget(
        { supabase, tenantId, userId: "user-1" },
        {
          workId,
          folderPath: "ordenes-de-compra",
          documentType: "PURCHASE_ORDER",
        },
      ),
    ).resolves.toEqual({ valid: true, error: null });
  });
});
