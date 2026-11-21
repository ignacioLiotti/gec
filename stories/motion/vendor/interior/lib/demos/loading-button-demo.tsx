// MIT source: https://github.com/ddoemonn/interior/blob/52988dcc82c9ef2c21bc6b288207a2b850f9b318/lib/demos/loading-button-demo.tsx
// Adaptations: import isolation and Sintesis visual token mapping. See ../../LICENSE.
"use client";

import { LoadingButton } from "../../components/interior/loading-button";

function publish() {
  return new Promise((resolve) => setTimeout(resolve, 1600));
}

export function LoadingButtonDemo() {
  return (
    <div className="flex justify-center">
      <LoadingButton onAction={publish} successLabel="Published">
        Publish
      </LoadingButton>
    </div>
  );
}
