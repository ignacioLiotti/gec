// MIT source: https://github.com/ddoemonn/interior/blob/52988dcc82c9ef2c21bc6b288207a2b850f9b318/lib/demos/ripple-demo.tsx
// Adaptations: import isolation and Sintesis visual token mapping. See ../../LICENSE.
"use client";

import { Ripple } from "../../components/interior/ripple";

export function RippleDemo() {
  return (
    <div className="flex justify-center">
      <Ripple className="h-11 px-6">Tap anywhere on me</Ripple>
    </div>
  );
}
