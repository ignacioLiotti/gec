// MIT source: https://github.com/ddoemonn/interior/blob/52988dcc82c9ef2c21bc6b288207a2b850f9b318/lib/demos/progress-bar-demo.tsx
// Adaptations: import isolation and Sintesis visual token mapping. See ../../LICENSE.
"use client";

import { useEffect, useState } from "react";
import { ProgressBar } from "../../components/interior/progress-bar";

export function ProgressBarDemo() {
  const [value, setValue] = useState<number | null>(null);

  useEffect(() => {
    if (value === null) {
      const id = setTimeout(() => setValue(8), 1300);
      return () => clearTimeout(id);
    }
    if (value < 100) {
      const id = setTimeout(() => setValue(Math.min(100, value + 14)), 520);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setValue(null), 1800);
    return () => clearTimeout(id);
  }, [value]);

  return (
    <div className="mx-auto w-full max-w-[360px]">
      <ProgressBar
        value={value}
        label="roadmap.pdf"
        pendingLabel="Sizing"
        completeLabel="Upload complete"
      />
    </div>
  );
}
