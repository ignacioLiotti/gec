// import type { Column, Table } from "@tanstack/react-table";
// import * as React from "react";

// export function getCommonPinningStyles<TData>({
//   column,
// }: {
//   column: Column<TData, unknown> & {
//     getIsPinned?: () => false | "left" | "right";
//     getStart?: (side: "left" | "right") => number;
//     getAfter?: (side: "left" | "right") => number;
//   };
// }): React.CSSProperties {
//   const isPinned = column.getIsPinned ? column.getIsPinned() : false;
//   if (!isPinned) return {};

//   const style: React.CSSProperties = { position: "sticky", zIndex: 1 };

//   if (isPinned === "left") {
//     const offset = column.getStart ? column.getStart("left") : 0;
//     style.left = `${offset}px`;
//   } else if (isPinned === "right") {
//     const offset = column.getAfter ? column.getAfter("right") : 0;
//     style.right = `${offset}px`;
//   }

//   return style;
// }

// export function autoFitColumns<TData>(
//   table: Table<TData>,
//   opts?: { sampleRows?: number; min?: number; max?: number; padding?: number },
// ) {
//   if (typeof window === "undefined") return;

//   const sampleRows = Math.max(1, opts?.sampleRows ?? 20);
//   const min = opts?.min ?? 80; // px
//   const max = opts?.max ?? 480; // px
//   const padding = opts?.padding ?? 24; // account for cell padding + resizer

//   const measurer = document.createElement("span");
//   measurer.style.position = "absolute";
//   measurer.style.visibility = "hidden";
//   measurer.style.whiteSpace = "pre";
//   measurer.style.fontSize = "0.875rem"; // text-sm
//   measurer.style.fontFamily = "inherit";
//   measurer.style.padding = "0";
//   document.body.appendChild(measurer);

//   const rows = table.getRowModel().rows;
//   const headers = table.getFlatHeaders();

//   for (const header of headers) {
//     const column = header.column as Column<TData, unknown>;
//     // Skip select checkbox column if any
//     if (column.id === "select") {
//       column.setSize(40);
//       continue;
//     }

//     // Base width from header label
//     let headerLabel = "";
//     if (typeof column.columnDef.header === "string") {
//       headerLabel = column.columnDef.header;
//     } else {
//       headerLabel = column.id;
//     }

//     measurer.textContent = headerLabel;
//     let best = measurer.getBoundingClientRect().width + padding;

//     const take = Math.min(sampleRows, rows.length);
//     for (let i = 0; i < take; i++) {
//       const row = rows[i];
//       const cell = row
//         .getVisibleCells()
//         .find((c) => c.column.id === column.id);
//       if (!cell) continue;
//       const value = cell.getValue();
//       const text = value == null ? "" : String(value);
//       if (!text) continue;
//       measurer.textContent = text;
//       const w = measurer.getBoundingClientRect().width + padding;
//       if (w > best) best = w;
//     }

//     const clamped = Math.max(min, Math.min(max, Math.ceil(best)));
//     const anyColumn = column as unknown as { setSize?: (n: number) => void };
//     if (typeof anyColumn.setSize === "function") {
//       anyColumn.setSize(clamped);
//     } else {
//       const anyTable = table as unknown as {
//         setColumnSizing?: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
//         getState: () => { columnSizing: Record<string, number> };
//       };
//       if (typeof anyTable.setColumnSizing === "function") {
//         const current = anyTable.getState().columnSizing || {};
//         anyTable.setColumnSizing((prev) => ({ ...prev, [column.id]: clamped }));
//       }
//     }
//   }

//   document.body.removeChild(measurer);
// }
