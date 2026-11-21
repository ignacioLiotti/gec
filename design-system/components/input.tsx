import * as React from "react"
import { fieldClassName } from "./field-styles"
import { cn } from "../lib/utils"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      data-slot="input"
      type={type}
      className={cn(
        fieldClassName, "h-9 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Input.displayName = "Input"
