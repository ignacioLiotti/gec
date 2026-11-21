// MIT source: https://github.com/ddoemonn/interior/blob/52988dcc82c9ef2c21bc6b288207a2b850f9b318/lib/demos/tooltip-group-demo.tsx
// Adaptations: import isolation and Sintesis visual token mapping. See ../../LICENSE.
"use client";

import { Tooltip, TooltipGroup } from "../../components/interior/tooltip-group";

const TOOLS = [
  { id: "bold", glyph: "B", label: "Bold", hint: "⌘B" },
  { id: "italic", glyph: "I", label: "Italic", hint: "⌘I" },
  { id: "under", glyph: "U", label: "Underline", hint: "⌘U" },
  { id: "code", glyph: "{}", label: "Inline code", hint: "⌘E" },
  { id: "link", glyph: "↗", label: "Insert link", hint: "⌘K" },
] as const;

export function TooltipGroupDemo() {
  return (
    <div className="grid w-full place-items-center">
      <div className="flex items-center">
        <TooltipGroup className="flex items-center gap-1">
          {TOOLS.map((tool) => (
            <Tooltip
              key={tool.id}
              side="top"
              label={
                <span className="flex items-center gap-2">
                  {tool.label}
                  <span className="font-mono text-[9.5px] opacity-60">
                    {tool.hint}
                  </span>
                </span>
              }
            >
              <button
                type="button"
                className="mat-cap press flex h-9 w-10 items-center justify-center rounded-[7px] font-mono text-[12.5px] text-[var(--mr-ink-2)] hover:text-[var(--mr-ink)]"
              >
                {tool.glyph}
              </button>
            </Tooltip>
          ))}
        </TooltipGroup>
      </div>
    </div>
  );
}
