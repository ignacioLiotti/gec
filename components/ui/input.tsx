import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  const isSearch = type === "search"

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Shared layout
        "h-9 w-full min-w-0 px-4 text-sm transition-all outline-none border disabled:pointer-events-none disabled:opacity-50 cursor-text",

        isSearch
          ? [
            // 🔎 SEARCH STYLE (secondary surface style)
            "rounded-md border-transparent",
            "[background-origin:border-box]",
            "[background-clip:padding-box,border-box]",
            "bg-[linear-gradient(180deg,rgba(227,227,227,0.1)_0%,rgba(227,227,227,0)_100%),linear-gradient(180deg,#FDFDFD_0%,rgba(241,241,241,0)_100%)]",
            "shadow-[0px_2px_4px_rgba(0,0,0,0.10),0px_0px_0px_1px_rgba(0,0,0,0.16)]",
            "text-[#2A2A2A] placeholder:text-[#6B6B6B]",
            "focus-visible:shadow-[0px_2px_4px_rgba(0,0,0,0.10),0px_0px_0px_1px_theme(colors.orange-primary),0px_0px_0px_4px_theme(colors.orange-primary/0.25)]",
          ]
          : [
            // ✏️ DEFAULT INPUT STYLE (your previous standard style)
            "rounded-md bg-transparent border-2",
            "border-orange-primary/40 hover:border-orange-primary/60",
            "focus-visible:border-orange-primary focus-visible:ring-orange-primary/30 focus-visible:ring-[3px]",
            "text-base md:text-sm",
          ],

        className
      )}
      {...props}
    />
  )
}

export { Input }
