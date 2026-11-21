// MIT source: https://github.com/ddoemonn/interior/blob/52988dcc82c9ef2c21bc6b288207a2b850f9b318/lib/demos/popover-demo.tsx
// Adaptations: import isolation and Sintesis visual token mapping. See ../../LICENSE.
"use client";

import { useRef, useState } from "react";
import { Popover } from "../../components/interior/popover";

const people = [
  {
    id: "tl",
    first: "Ada",
    name: "Ada Lovelace",
    role: "Layout engine",
    at: "left-3 top-3",
  },
  {
    id: "tr",
    first: "Grace",
    name: "Grace Hopper",
    role: "Compilers",
    at: "right-3 top-3",
  },
  {
    id: "bl",
    first: "Alan",
    name: "Alan Kay",
    role: "Research",
    at: "left-3 bottom-3",
  },
  {
    id: "br",
    first: "Barbara",
    name: "Barbara Liskov",
    role: "Platform",
    at: "right-3 bottom-3",
  },
];

export function PopoverDemo() {
  const field = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div ref={field} className="relative h-full w-full">
      {people.map((person) => (
        <div key={person.id} className={`absolute ${person.at}`}>
          <Popover
            label={`${person.name}, profile`}
            side="top"
            boundary={field}
            open={open === person.id}
            onOpenChange={(next) => setOpen(next ? person.id : null)}
            trigger={person.first}
          >
            <div className="w-[196px]">
              <p className="text-[13px] font-medium text-foreground ">
                {person.name}
              </p>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground ">
                {person.role} · joined 2019
              </p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground ">
                Two reviews open. Last shipped the docs shell on Tuesday.
              </p>
            </div>
          </Popover>
        </div>
      ))}
    </div>
  );
}
