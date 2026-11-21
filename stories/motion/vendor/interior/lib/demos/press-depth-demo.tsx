// MIT source: https://github.com/ddoemonn/interior/blob/52988dcc82c9ef2c21bc6b288207a2b850f9b318/lib/demos/press-depth-demo.tsx
// Adaptations: import isolation and Sintesis visual token mapping. See ../../LICENSE.
"use client";

import { PressDepth } from "../../components/interior/press-depth";

export function PressDepthDemo() {
  return (
    <div className="flex justify-center">
      <PressDepth>Press me</PressDepth>
    </div>
  );
}
