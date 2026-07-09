import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full leading-[1px] border px-2 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        neutral: "border-stroke-soft bg-surface text-content-secondary",
        info: "border-primary/25 bg-primary/10 text-primary",
        infoSolid: "border-primary/70 bg-primary text-primary-foreground",
        success: "border-success/25 bg-success/10 text-success",
        successSolid: "border-success/70 bg-success text-success-foreground",
        warning: "border-warning/35 bg-warning/15 text-warning-foreground",
        warningSolid: "border-warning/70 bg-warning text-warning-foreground",
        defaultSolid: "border-orange-primary/70 bg-orange-primary text-primary-foreground",
        destructiveSolid: "border-destructive/70 bg-destructive text-destructive-foreground",
      },
      size: {
        xs: "h-5 gap-1 px-2 text-[10px]",
        sm: "h-6 gap-1.5 px-2.5 text-[11px]",
        md: "h-7 gap-1.5 px-3 text-xs",
        lg: "h-8 gap-2 px-3.5 text-sm",
      },
      shape: {
        rounded: "rounded-md",
        pill: "rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  size,
  shape,
  asChild = false,
  count,
  dot,
  leadingIcon,
  trailingIcon,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean
    count?: React.ReactNode
    dot?: boolean
    leadingIcon?: React.ReactNode
    trailingIcon?: React.ReactNode
  }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size, shape }), className)}
      {...props}
    >
      {dot ? <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current opacity-80" /> : null}
      {leadingIcon ? <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center">{leadingIcon}</span> : null}
      {children}
      {count !== undefined && count !== null ? <span className="shrink-0 font-semibold tabular-nums opacity-80">{count}</span> : null}
      {trailingIcon ? <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center">{trailingIcon}</span> : null}
    </Comp>
  )
}

export { Badge, badgeVariants }
