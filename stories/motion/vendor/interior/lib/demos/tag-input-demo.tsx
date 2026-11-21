// MIT source: https://github.com/ddoemonn/interior/blob/52988dcc82c9ef2c21bc6b288207a2b850f9b318/lib/demos/tag-input-demo.tsx
// Adaptations: import isolation and Sintesis visual token mapping. See ../../LICENSE.
"use client";

import { TagInput } from "../../components/interior/tag-input";

const START = ["motion", "focus order"];

export function TagInputDemo() {
  return (
    <div className="mx-auto h-[150px] w-full max-w-[420px]">
      <TagInput defaultValue={START} max={6} placeholder="Add a topic" />
    </div>
  );
}
