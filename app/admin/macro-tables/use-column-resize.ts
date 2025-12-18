"use client";

import { useCallback, useEffect, useState } from "react";
import type React from "react";

const DEFAULT_COLUMN_WIDTH = 260;
const MIN_COLUMN_WIDTH = 200;
const MAX_COLUMN_WIDTH = 520;

type ColumnWidthMap = Record<string, number>;

export function useColumnResize(columnIds: string[]) {
  const [columnWidths, setColumnWidths] = useState<ColumnWidthMap>({});

  useEffect(() => {
    setColumnWidths((prev) => {
      let changed = false;
      const next: ColumnWidthMap = { ...prev };

      for (const id of columnIds) {
        if (next[id] === undefined) {
          next[id] = DEFAULT_COLUMN_WIDTH;
          changed = true;
        }
      }

      for (const id of Object.keys(next)) {
        if (!columnIds.includes(id)) {
          delete next[id];
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [columnIds]);

  const getColumnWidth = useCallback(
    (columnId: string) => columnWidths[columnId] ?? DEFAULT_COLUMN_WIDTH,
    [columnWidths],
  );

  const startResize = useCallback(
    (columnId: string, event: React.PointerEvent) => {
      event.preventDefault();
      const startX = event.clientX;
      const initialWidth = columnWidths[columnId] ?? DEFAULT_COLUMN_WIDTH;

      function onPointerMove(moveEvent: PointerEvent) {
        const delta = moveEvent.clientX - startX;
        const rawWidth = initialWidth + delta;
        const clampedWidth = Math.max(
          MIN_COLUMN_WIDTH,
          Math.min(MAX_COLUMN_WIDTH, rawWidth),
        );

        setColumnWidths((prev) => {
          if (prev[columnId] === clampedWidth) return prev;
          return { ...prev, [columnId]: clampedWidth };
        });
      }

      function onPointerUp() {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      }

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [columnWidths],
  );

  return { columnWidths, getColumnWidth, startResize };
}
