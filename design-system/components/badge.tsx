import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils"

const solidBadgeShadow =
  "[box-shadow:0_1px_0_0_rgb(255_255_255_/_0.28)_inset,0_-1px_0_0_rgb(0_0_0_/_0.14)_inset,0_0_0_1px_rgb(0_0_0_/_0.10),0_8px_18px_-16px_rgb(27_27_27_/_0.66)]"

export const badgeVariants = cva(
  "inline-flex max-w-full items-center border font-medium leading-none shadow-card transition-[background-color,border-color,color,box-shadow] focus:outline-none focus:ring-2 focus:ring-orange-primary/20 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-orange-primary/30 bg-orange-primary/10 text-orange-primary",
        defaultSolid: cn("border-orange-primary/70 bg-orange-primary text-primary-foreground", solidBadgeShadow),
        secondary: "border-accent-border/70 bg-accent-soft text-orange-primary",
        neutral: "border-stroke-soft bg-surface text-content-secondary",
        outline: "border-stroke-soft bg-card text-content-secondary",
        info: "border-primary/25 bg-primary/10 text-primary",
        infoSolid: cn("border-primary/70 bg-primary text-primary-foreground", solidBadgeShadow),
        destructive: "border-destructive/30 bg-destructive/10 text-destructive",
        destructiveSolid: cn("border-destructive/70 bg-destructive text-destructive-foreground", solidBadgeShadow),
        success: "border-success/25 bg-success/10 text-success",
        successSolid: cn("border-success/70 bg-success text-success-foreground", solidBadgeShadow),
        warning: "border-warning/35 bg-warning/15 text-warning-foreground",
        warningSolid: cn("border-warning/70 bg-warning text-warning-foreground", solidBadgeShadow)
      },
      size: {
        xs: "h-5 gap-1 rounded-sm px-2 text-[10px]",
        sm: "h-6 gap-1.5 rounded-md px-2.5 text-[11px]",
        md: "h-7 gap-1.5 rounded-md px-3 text-xs",
        lg: "h-8 gap-2 rounded-md px-3.5 text-sm"
      },
      shape: {
        rounded: "",
        pill: "rounded-full"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "sm",
      shape: "rounded"
    }
  }
)

const badgeIconVariants = cva("inline-flex shrink-0 items-center justify-center", {
  variants: {
    size: {
      xs: "size-2.5 [&_svg]:size-2.5",
      sm: "size-3 [&_svg]:size-3",
      md: "size-3.5 [&_svg]:size-3.5",
      lg: "size-4 [&_svg]:size-4"
    }
  },
  defaultVariants: {
    size: "sm"
  }
})

const badgeDotVariants = cva("shrink-0 rounded-full bg-current opacity-80", {
  variants: {
    size: {
      xs: "size-1.5",
      sm: "size-1.5",
      md: "size-2",
      lg: "size-2.5"
    }
  },
  defaultVariants: {
    size: "sm"
  }
})

const badgeCountVariants = cva("shrink-0 font-semibold tabular-nums opacity-80", {
  variants: {
    size: {
      xs: "text-[10px]",
      sm: "text-[11px]",
      md: "text-xs",
      lg: "text-sm"
    }
  },
  defaultVariants: {
    size: "sm"
  }
})

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  count?: React.ReactNode
  dot?: boolean
  leadingIcon?: React.ReactNode
  trailingIcon?: React.ReactNode
}

export function Badge({
  className,
  variant,
  size,
  shape,
  count,
  dot,
  leadingIcon,
  trailingIcon,
  children,
  ...props
}: BadgeProps) {
  const hasChildren = children !== undefined && children !== null
  const hasCount = count !== undefined && count !== null

  return (
    <div className={cn(badgeVariants({ variant, size, shape }), className)} {...props}>
      {dot ? <span aria-hidden="true" className={badgeDotVariants({ size })} /> : null}
      {leadingIcon ? (
        <span aria-hidden="true" className={badgeIconVariants({ size })}>
          {leadingIcon}
        </span>
      ) : null}
      {hasChildren ? <span className="min-w-0 truncate">{children}</span> : null}
      {hasCount ? <span className={badgeCountVariants({ size })}>{count}</span> : null}
      {trailingIcon ? (
        <span aria-hidden="true" className={badgeIconVariants({ size })}>
          {trailingIcon}
        </span>
      ) : null}
    </div>
  )
}