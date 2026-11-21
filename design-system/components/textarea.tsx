import * as React from "react"
import { fieldClassName } from "./field-styles"
import { cn } from "../lib/utils"

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      data-slot="textarea"
      className={cn(
        fieldClassName, "min-h-16 field-sizing-content",
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Textarea.displayName = "Textarea"
