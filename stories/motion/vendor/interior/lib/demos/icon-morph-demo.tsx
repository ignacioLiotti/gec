// MIT source: https://github.com/ddoemonn/interior/blob/52988dcc82c9ef2c21bc6b288207a2b850f9b318/lib/demos/icon-morph-demo.tsx
// Adaptations: import isolation and Sintesis visual token mapping. See ../../LICENSE.
"use client";

import { IconMorph } from "../../components/interior/icon-morph";

export function IconMorphDemo() {
  return (
    <div className="flex items-center justify-center gap-3">
      <IconMorph preset="play-pause" semantics="pressed" />
      <IconMorph preset="menu-close" semantics="expanded" />
    </div>
  );
}
