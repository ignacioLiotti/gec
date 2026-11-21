// MIT source: https://github.com/ddoemonn/interior/blob/52988dcc82c9ef2c21bc6b288207a2b850f9b318/lib/demos/reorder-list-demo.tsx
// Adaptations: import isolation and Sintesis visual token mapping. See ../../LICENSE.
"use client";

import { useState } from "react";
import { ReorderList } from "../../components/interior/reorder-list";

type Track = { id: string; title: string; length: string };

const SETLIST: Track[] = [
  { id: "a", title: "Opening remarks", length: "5 min" },
  { id: "b", title: "Roadmap review", length: "15 min" },
  { id: "c", title: "Design critique", length: "20 min" },
  { id: "d", title: "Open questions", length: "10 min" },
];

export function ReorderListDemo() {
  const [agenda, setAgenda] = useState(SETLIST);

  return (
    <div className="grid w-full place-items-center">
      <div className="w-full max-w-[320px]">
        <ReorderList
        items={agenda}
        getId={(t) => t.id}
        getLabel={(t) => t.title}
        onReorder={setAgenda}
        label="Meeting agenda"
      >
        {(t) => (
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-[13px] font-medium text-foreground ">
              {t.title}
            </p>
            <p className="shrink-0 font-mono text-[10.5px] tabular-nums text-muted-foreground ">
              {t.length}
            </p>
          </div>
        )}
        </ReorderList>
      </div>
    </div>
  );
}
