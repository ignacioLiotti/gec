// MIT source: https://github.com/ddoemonn/interior/blob/52988dcc82c9ef2c21bc6b288207a2b850f9b318/lib/demos/dropdown-demo.tsx
// Adaptations: import isolation and Sintesis visual token mapping. See ../../LICENSE.
"use client";

import { useState } from "react";
import { Dropdown } from "../../components/interior/dropdown";

const VISIBILITY = [
  { value: "private", label: "Only me", hint: "default" },
  { value: "team", label: "Anyone at Acme" },
  { value: "link", label: "Anyone with the link" },
  { value: "public", label: "Public on the web" },
];

export function DropdownDemo() {
  const [visibility, setVisibility] = useState("private");

  return (
    <div className="grid w-full place-items-center pb-[96px]">
      <Dropdown
        label="Visibility"
        items={VISIBILITY}
        value={visibility}
        onChange={setVisibility}
      />
    </div>
  );
}
