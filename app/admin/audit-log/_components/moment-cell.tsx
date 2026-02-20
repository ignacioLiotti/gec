"use client";

import { useEffect, useMemo, useState } from "react";

type MomentCellProps = {
  value: string;
};

export function MomentCell({ value }: MomentCellProps) {
  const date = useMemo(() => new Date(value), [value]);
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    setNowMs(Date.now());
  }, []);

  const formatted = useMemo(
    () =>
      date.toLocaleString("es-AR", {
        dateStyle: "short",
        timeStyle: "medium",
      }),
    [date]
  );

  const relative = useMemo(() => {
    const diffMs = nowMs - date.getTime();
    if (!Number.isFinite(diffMs)) return "";

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 1) return "hace instantes";
    if (diffMinutes < 60) return `hace ${diffMinutes} min`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `hace ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    return `hace ${diffDays} d`;
  }, [date, nowMs]);

  return (
    <td className="px-3 py-3 text-sm">
      <div className="font-medium">{formatted}</div>
      <div className="text-xs text-muted-foreground">{relative}</div>
    </td>
  );
}
