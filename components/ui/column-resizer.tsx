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

export function ColGroup({ tableId, columns }: { tableId: string; columns: number }) {
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
      } else if (!hasAnyWidths) {
        // If no columns have been resized, use equal percentages for even distribution
        const percentage = 100 / columns;
        colEl.style.width = `${percentage}%`;
      }
    });

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
    }, 100);

    // Set up ResizeObserver to observe the container, not the table
    // Scale columns proportionally ONLY when container has extra space
    // Never shrink columns below their minimum widths - allow scrolling instead
    const resizeObserver = new ResizeObserver(() => {
      if (isScalingRef.current) return; // Prevent infinite loop

      const containerWidth = container.getBoundingClientRect().width;
      const currentTotalWidth = colgroupRef.current.reduce((sum, colEl) => {
        return sum + (colEl?.getBoundingClientRect().width || 0);
      }, 0);

      // Get the sum of minimum widths
      const minTotalWidth = Object.values(minWidthsRef.current).reduce((sum, w) => sum + w, 0);

      // Only scale UP if container is wider than current total AND wider than minimum total
      // Never scale down - if content is too wide, the overflow-x-auto will handle scrolling
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
  }, [tableId, columns]);

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

      function onMove(ev: MouseEvent) {
        const delta = ev.clientX - startX;
        const next = Math.max(minWidth, Math.round(startWidth + delta));
        col.style.width = `${next}px`;
        widths[colIndex] = next;
        // Update minimum width reference in ColGroup component
        // We'll need to trigger a re-render or update the minWidthsRef
        // For now, this will be handled when the component remounts or when widths are reloaded
      }

      function onUp() {
        // Update the saved width as the new minimum
        saveWidths(tableId, widths);
        // Trigger a custom event to notify ColGroup about the width change
        if (table) {
          const event = new CustomEvent('columnResized', {
            detail: { tableId, colIndex, newWidth: widths[colIndex] }
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
      aria-hidden
    />
  );
}


