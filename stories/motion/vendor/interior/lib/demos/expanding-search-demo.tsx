// MIT source: https://github.com/ddoemonn/interior/blob/52988dcc82c9ef2c21bc6b288207a2b850f9b318/lib/demos/expanding-search-demo.tsx
// Adaptations: import isolation and Sintesis visual token mapping. See ../../LICENSE.
"use client";

import { ExpandingSearch } from "../../components/interior/expanding-search";

export function ExpandingSearchDemo() {
  return (
    <div className="flex justify-center">
      <ExpandingSearch className="max-w-[240px]" />
    </div>
  );
}
