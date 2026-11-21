// MIT source: https://github.com/ddoemonn/interior/blob/52988dcc82c9ef2c21bc6b288207a2b850f9b318/lib/demos/hold-to-confirm-demo.tsx
// Adaptations: import isolation and Sintesis visual token mapping. See ../../LICENSE.
"use client";

import { HoldToConfirm } from "../../components/interior/hold-to-confirm";

export function HoldToConfirmDemo() {
  return (
    <div className="flex justify-center">
      <HoldToConfirm
        onConfirm={() => {}}
        confirmLabel="Workspace deleted"
      >
        Hold to delete workspace
      </HoldToConfirm>
    </div>
  );
}
