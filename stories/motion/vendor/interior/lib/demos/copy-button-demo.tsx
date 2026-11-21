// MIT source: https://github.com/ddoemonn/interior/blob/52988dcc82c9ef2c21bc6b288207a2b850f9b318/lib/demos/copy-button-demo.tsx
// Adaptations: import isolation and Sintesis visual token mapping. See ../../LICENSE.
"use client";

import { CopyButton } from "../../components/interior/copy-button";

export function CopyButtonDemo() {
  return (
    <div className="flex justify-center">
      <CopyButton value="npx interior add copy-button" />
    </div>
  );
}
