// MIT source: https://github.com/ddoemonn/interior/blob/52988dcc82c9ef2c21bc6b288207a2b850f9b318/lib/demos/segmented-control-demo.tsx
// Adaptations: import isolation and Sintesis visual token mapping. See ../../LICENSE.
"use client";

import { useState } from "react";
import { SegmentedControl } from "../../components/interior/segmented-control";

const RANGES = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
];

export function SegmentedControlDemo() {
  const [range, setRange] = useState("day");

  return (
    <div className="flex w-full justify-center">
      <SegmentedControl
        label="Report range"
        options={RANGES}
        value={range}
        onValueChange={setRange}
      />
    </div>
  );
}
