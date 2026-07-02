import * as React from "react"
import { cn } from "../lib/utils"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-stroke bg-surface px-3 py-2 text-sm text-content shadow-recessed transition-[border-color,box-shadow,background-color,color] placeholder:text-content-disabled focus-visible:border-accent-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-primary/20 disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Input.displayName = "Input"
