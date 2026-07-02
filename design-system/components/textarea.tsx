import * as React from "react"
import { cn } from "../lib/utils"

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-24 w-full rounded-md border border-stroke bg-surface px-3 py-2 text-sm text-content shadow-recessed transition-[border-color,box-shadow,background-color,color] placeholder:text-content-disabled focus-visible:border-accent-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Textarea.displayName = "Textarea"
