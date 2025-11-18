"use client";

import { useCallback, useEffect, useRef } from "react";

type StoredWidths = Record<number, number>;

function getStorageKey(tableId: string) {
  return `resizable-cols:${tableId}`;
}

function loadWidths(tableId: string): StoredWidths {
  try {
    const raw = localStorage.getItem(getStorageKey(tableId));
    return raw ? (JSON.parse(raw) as StoredWidths) : {};
  } catch {
    return {};
  }
}

function saveWidths(tableId: string, widths: StoredWidths) {
  try {
    localStorage.setItem(getStorageKey(tableId), JSON.stringify(widths));
  } catch {
    // ignore
  }
}

export function ColGroup({ tableId, columns, mode = "balanced" }: { tableId: string; columns: number; mode?: "balanced" | "fixed" }) {
  const colgroupRef = useRef<HTMLTableColElement[] | null[]>([]);
  const minWidthsRef = useRef<Record<number, number>>({});
  const isScalingRef = useRef(false);

  useEffect(() => {
    const widths = loadWidths(tableId);
    const hasAnyWidths = Object.values(widths).some(w => w && w > 0);

    // Find the table element and its container
    const table = colgroupRef.current[0]?.closest('table') as HTMLTableElement | null;
    if (!table) return;

    const container = table.parentElement as HTMLElement | null;
    if (!container) return;

    // Initialize column widths
    colgroupRef.current.forEach((colEl, idx) => {
      if (!colEl) return;

      if (widths[idx] && widths[idx] > 0) {
        colEl.style.width = `${widths[idx]}px`;
        minWidthsRef.current[idx] = widths[idx]; // Store as minimum width
      }
    });

    // Ensure table can exceed container width for horizontal scrolling
    table.style.width = 'auto';
    table.style.minWidth = '100%';

    // Store initial minimum widths after a brief delay to ensure columns are rendered
    const timeoutId = setTimeout(() => {
      colgroupRef.current.forEach((colEl, idx) => {
        if (colEl) {
          const computedWidth = colEl.getBoundingClientRect().width;
          if (computedWidth > 0) {
            // Only set minimum if not already set from saved widths
            if (!minWidthsRef.current[idx]) {
              minWidthsRef.current[idx] = computedWidth;
            }
          }
        }
      });

      // Initialize widths if none saved
      if (!hasAnyWidths) {
        if (mode === "balanced") {
          // Spread evenly to fill container (proportional look)
          const containerWidth = container.getBoundingClientRect().width;
          if (containerWidth > 0) {
            const initialWidth = Math.floor(containerWidth / columns);
            colgroupRef.current.forEach((colEl, idx) => {
              if (colEl && !widths[idx]) {
                colEl.style.width = `${initialWidth}px`;
                minWidthsRef.current[idx] = initialWidth;
              }
            });
          }
        } else {
          // Fixed mode: give a sane default min width in px
          const initialWidth = 160;
          colgroupRef.current.forEach((colEl, idx) => {
            if (colEl && !widths[idx]) {
              colEl.style.width = `${initialWidth}px`;
              minWidthsRef.current[idx] = initialWidth;
            }
          });
        }
      }

      // In fixed mode, freeze all current column widths to their computed px
      if (mode === "fixed") {
        const current = loadWidths(tableId);
        let changed = false;
        colgroupRef.current.forEach((colEl, idx) => {
          if (!colEl) return;
          const w = Math.round(colEl.getBoundingClientRect().width);
          if (w > 0) {
            colEl.style.width = `${w}px`;
            minWidthsRef.current[idx] = w;
            if (current[idx] !== w) {
              current[idx] = w;
              changed = true;
            }
          }
        });
        if (changed) saveWidths(tableId, current);
      }
    }, 100);

    // Set up ResizeObserver to observe the container, not the table
    // Scale columns proportionally ONLY when container has extra space
    // Never shrink columns below their minimum widths - allow scrolling instead
    // Allow columns to exceed container width for horizontal scrolling
    const resizeObserver = new ResizeObserver(() => {
      if (mode === "fixed") return; // do not touch widths in fixed mode
      if (isScalingRef.current) return; // Prevent infinite loop

      const containerWidth = container.getBoundingClientRect().width;
      const currentTotalWidth = colgroupRef.current.reduce((sum, colEl) => {
        return sum + (colEl?.getBoundingClientRect().width || 0);
      }, 0);

      // Get the sum of minimum widths
      const minTotalWidth = Object.values(minWidthsRef.current).reduce((sum, w) => sum + w, 0);

      // Only scale UP if container is wider than current total AND wider than minimum total
      // Never scale down - if content is too wide, the overflow-x-auto will handle scrolling
      // Allow columns to be resized beyond container width for horizontal scrolling
      if (containerWidth > currentTotalWidth + 10 && containerWidth > minTotalWidth && currentTotalWidth > 0 && minTotalWidth > 0) {
        const scaleFactor = containerWidth / currentTotalWidth;
        isScalingRef.current = true;

        colgroupRef.current.forEach((colEl, idx) => {
          if (!colEl) return;
          const currentWidth = colEl.getBoundingClientRect().width;
          const minWidth = minWidthsRef.current[idx] || currentWidth;

          if (currentWidth > 0) {
            const scaledWidth = currentWidth * scaleFactor;
            // Ensure we never go below minimum width
            const finalWidth = Math.max(scaledWidth, minWidth);
            colEl.style.width = `${finalWidth}px`;
          }
        });

        // Reset flag after a brief delay
        setTimeout(() => {
          isScalingRef.current = false;
        }, 50);
      }
    });

    resizeObserver.observe(container);

    // Listen for column resize events to update minimum widths
    const handleColumnResized = (e: CustomEvent) => {
      if (e.detail.tableId === tableId && e.detail.colIndex !== undefined && e.detail.newWidth) {
        minWidthsRef.current[e.detail.colIndex] = e.detail.newWidth;
      }
    };

    table.addEventListener('columnResized', handleColumnResized as EventListener);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      table.removeEventListener('columnResized', handleColumnResized as EventListener);
    };
  }, [tableId, columns, mode]);

  return (
    <colgroup>
      {Array.from({ length: columns }).map((_, i) => (
        // eslint-disable-next-line jsx-a11y/aria-role
        <col key={i} ref={(el) => { colgroupRef.current[i] = el; }} />
      ))}
    </colgroup>
  );
}

export function ColumnResizer({ tableId, colIndex, minWidth = 80 }: { tableId: string; colIndex: number; minWidth?: number }) {
  const autoSizeColumn = useCallback((target: HTMLElement) => {
    const table = (target.closest("table") ?? undefined) as HTMLTableElement | undefined;
    if (!table) return;
    const col = table.querySelectorAll<HTMLTableColElement>("colgroup col")[colIndex];
    if (!col) return;

    // Measure max text width across header and visible body values
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function computeFont(el: HTMLElement | null): string {
      if (!el) return getComputedStyle(document.body).font || "14px sans-serif";
      const cs = getComputedStyle(el);
      // Prefer the 'font' shorthand; if not present, build from parts
      const shorthand = (cs as any).font as string | undefined;
      if (shorthand && shorthand !== "") return shorthand;
      const size = cs.fontSize || "14px";
      const family = cs.fontFamily || "sans-serif";
      const weight = cs.fontWeight || "400";
      return `${weight} ${size} ${family}`;
    }

    const tableFont = computeFont(table);
    ctx.font = tableFont;

    const measureText = (text: string) => {
      const metrics = ctx.measureText(text ?? "");
      return Math.ceil(metrics.width);
    };

    let max = minWidth;

    // Headers: get the text content of the header cell (button label)
    const headerRowGroups = Array.from(table.querySelectorAll("thead tr"));
    headerRowGroups.forEach((tr) => {
      const ths = tr.querySelectorAll<HTMLTableCellElement>("th");
      const th = ths[colIndex] as HTMLTableCellElement | undefined;
      if (!th || th.style.display === "none") return;
      const label = (th.textContent || "").trim();
      if (label) {
        max = Math.max(max, measureText(label) + 32);
      }
    });

    // Body: use the textual value (input value or text content)
    const bodyRows = Array.from(table.querySelectorAll("tbody tr"));
    bodyRows.forEach((tr) => {
      const tds = tr.querySelectorAll<HTMLTableCellElement>("td");
      const td = tds[colIndex] as HTMLTableCellElement | undefined;
      if (!td || td.style.display === "none") return;
      let value = "";
      const input = td.querySelector("input") as HTMLInputElement | null;
      if (input) {
        value = (input.value ?? "").toString();
      } else {
        value = (td.textContent || "").trim();
      }
      if (value) {
        max = Math.max(max, measureText(value) + 32);
      }
    });

    const widths = loadWidths(tableId);
    const next = Math.max(minWidth, Math.round(max));
    col.style.width = `${next}px`;
    widths[colIndex] = next;
    saveWidths(tableId, widths);

    // Notify ColGroup of new min width
    const event = new CustomEvent('columnResized', {
      detail: { tableId, colIndex, newWidth: widths[colIndex] }
    });
    table.dispatchEvent(event);
  }, [tableId, colIndex, minWidth]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      const th = (e.currentTarget.closest("th") ?? undefined) as HTMLTableCellElement | undefined;
      const table = (e.currentTarget.closest("table") ?? undefined) as HTMLTableElement | undefined;
      if (!table) return;
      const col = table.querySelectorAll<HTMLTableColElement>("colgroup col")[colIndex];
      if (!col) return;

      const startX = e.clientX;
      const startWidth = col.getBoundingClientRect().width;

      const widths = loadWidths(tableId);

      // Debug: log current mode and all column widths at the start of a resize
      let resizeMode: "balanced" | "fixed" = "balanced";
      try {
        const raw = localStorage.getItem("excel:resizeMode");
        if (raw === "fixed") resizeMode = "fixed";
      } catch {
        // ignore
      }
      const allCols = Array.from(table.querySelectorAll<HTMLTableColElement>("colgroup col"));
      const currentWidths = allCols.map((c, i) => ({
        index: i,
        width: Math.round(c.getBoundingClientRect().width),
      }));
      // In fixed mode, freeze all columns to their current px width and set table width explicitly
      let baseTotalWidth = currentWidths.reduce((sum, w) => sum + (w.width || 0), 0);
      if (resizeMode === "fixed") {
        allCols.forEach((c, i) => {
          const w = currentWidths[i]?.width ?? 0;
          if (w > 0) {
            c.style.width = `${w}px`;
            widths[i] = w;
          }
        });
        try {
          // Set explicit table width so it can overflow and not redistribute
          table.style.width = `${baseTotalWidth}px`;
          table.style.minWidth = "0px";
        } catch {
          // ignore
        }
      }
      // eslint-disable-next-line no-console
      console.log("[ColumnResizer] start", {
        tableId,
        colIndex,
        resizeMode,
        widths: currentWidths,
        startWidth: Math.round(startWidth),
      });

      function onMove(ev: MouseEvent) {
        const delta = ev.clientX - startX;
        const next = Math.max(minWidth, Math.round(startWidth + delta));
        col.style.width = `${next}px`;
        widths[colIndex] = next;
        if (resizeMode === "fixed") {
          // Keep total table width as sum of frozen widths with the updated column width
          const newTotal = baseTotalWidth - Math.round(startWidth) + next;
          if (table) {
            try {
              table.style.width = `${newTotal}px`;
            } catch {
              // ignore
            }
          }
        }
        // Update minimum width reference in ColGroup component
        // We'll need to trigger a re-render or update the minWidthsRef
        // For now, this will be handled when the component remounts or when widths are reloaded
      }

      function onUp() {
        // Update the saved width as the new minimum
        saveWidths(tableId, widths);
        if (table) {
          // Debug: log final widths when completing resize
          const finalCols = Array.from(
            table.querySelectorAll<HTMLTableColElement>("colgroup col")
          );
          const finalWidths = finalCols.map((c, i) => ({
            index: i,
            width: Math.round(c.getBoundingClientRect().width),
          }));
          // eslint-disable-next-line no-console
          console.log("[ColumnResizer] end", {
            tableId,
            colIndex,
            resizeMode,
            widths: finalWidths,
            newWidth: widths[colIndex],
          });
          // Trigger a custom event to notify ColGroup about the width change
          const event = new CustomEvent("columnResized", {
            detail: { tableId, colIndex, newWidth: widths[colIndex] },
          });
          table.dispatchEvent(event);
        }

        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.classList.remove("select-none");
      }

      document.body.classList.add("select-none");
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [tableId, colIndex, minWidth]
  );

  return (
    <div
      className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none"
      onMouseDown={onMouseDown}
      onDoubleClick={(e) => {
        e.preventDefault();
        autoSizeColumn(e.currentTarget as unknown as HTMLElement);
      }}
      style={{ touchAction: 'none' }}
      aria-hidden
    />
  );
}


