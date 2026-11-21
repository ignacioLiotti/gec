import { useState } from "react";
import { FormTable } from "@/components/form-table/form-table";
import {
  createObrasDetalleConfig,
  mapObraToDetailRow,
} from "@/components/form-table/configs/obras-detalle";
import { portfolioObras, portfolioObrasColumns } from "../fixtures";
export default function Obras() {
  const [config] = useState(() => {
    const base = createObrasDetalleConfig(portfolioObrasColumns, {
      optimizationPreset: "legacy",
    });
    let rows = portfolioObras.map(mapObraToDetailRow);
    try {
      const saved = JSON.parse(
        sessionStorage.getItem("sintesis-guide:obras") || "null",
      );
      if (Array.isArray(saved)) rows = saved;
    } catch {
      /* Start from the supplied sample if browser storage is invalid. */
    }
    return {
      ...base,
      tableId: "guide-obras",
      activeTabStorageKey: "sintesis-guide:obras-tab",
      defaultRows: rows,
      fetchRows: undefined,
      fetchAfterDefaultRows: false,
      serverSideData: false,
      csvExport: undefined,
      onSave: async ({
        rows,
      }: {
        rows: ReturnType<typeof mapObraToDetailRow>[];
      }) => {
        sessionStorage.setItem("sintesis-guide:obras", JSON.stringify(rows));
      },
      columns: base.columns.map((column) =>
        column.id === "designacionYUbicacion"
          ? {
              ...column,
              cellMenuItems: [],
              cellConfig: {
                ...column.cellConfig,
                renderReadOnly: ({ value }: { value: unknown }) => (
                  <a href="./#documents" target="_parent">
                    {String(value)}
                  </a>
                ),
              },
            }
          : column,
      ),
    };
  });
  return (
    <div className="product-page">
      <FormTable config={config} />
    </div>
  );
}
