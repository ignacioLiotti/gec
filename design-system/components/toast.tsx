import * as React from "react"
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils"

export const toastVariants = cva(
  "relative flex min-h-[88px] w-full items-center gap-3 rounded-lg border px-5 py-4 pr-12 text-sm shadow-[0_18px_40px_-24px_rgb(27_27_27_/_0.55),0_1px_0_0_rgb(255_255_255_/_0.78)_inset] backdrop-blur-sm",
  {
    variants: {
      variant: {
        default: "border-stroke-soft bg-card text-content",
        info: "border-primary/15 bg-primary/10 text-content",
        success: "border-success/15 bg-success/10 text-content",
        warning: "border-warning/20 bg-warning/15 text-content",
        destructive: "border-destructive/15 bg-destructive/10 text-content"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
)

const toastIconVariants = cva("flex size-5 shrink-0 items-center justify-center rounded-full [&_svg]:size-3.5", {
  variants: {
    variant: {
      default: "bg-content-muted text-card",
      info: "bg-primary text-primary-foreground",
      success: "bg-success text-success-foreground",
      warning: "bg-warning text-warning-foreground",
      destructive: "bg-destructive text-destructive-foreground"
    }
  },
  defaultVariants: {
    variant: "default"
  }
})

const toastTitleVariants = cva("font-medium leading-snug tracking-normal", {
  variants: {
    variant: {
      default: "text-content",
      info: "text-primary",
      success: "text-success",
      warning: "text-warning-foreground",
      destructive: "text-destructive"
    }
  },
  defaultVariants: {
    variant: "default"
  }
})

type ToastVariant = NonNullable<VariantProps<typeof toastVariants>["variant"]>

const toastIcons: Record<ToastVariant, React.ComponentType<{ className?: string }>> = {
  default: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: AlertCircle
}

export interface ToastProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof toastVariants> {
  description?: React.ReactNode
  dismissLabel?: string
  icon?: React.ReactNode
  onDismiss?: () => void
  heading: React.ReactNode
}

export const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, description, dismissLabel, heading, icon, onDismiss, variant, role, ...props }, ref) => {
    const resolvedVariant: ToastVariant = variant ?? "default"
    const Icon = toastIcons[resolvedVariant]

    return (
      <div
        ref={ref}
        role={role ?? (resolvedVariant === "destructive" ? "alert" : "status")}
        data-slot="toast"
        className={cn(toastVariants({ variant: resolvedVariant }), className)}
        {...props}
      >
        <span aria-hidden="true" className={toastIconVariants({ variant: resolvedVariant })}>
          {icon ?? <Icon />}
        </span>
        <div className="min-w-0 flex-1">
          <div className={toastTitleVariants({ variant: resolvedVariant })}>{heading}</div>
          {description ? <div className="mt-0.5 text-sm leading-snug text-content-muted">{description}</div> : null}
        </div>
        {onDismiss ? (
          <button
            type="button"
            aria-label={dismissLabel ?? "Dismiss notification"}
            className="absolute right-3 top-3 inline-flex size-6 items-center justify-center rounded-md text-content-muted transition-[background-color,color] hover:bg-card/70 hover:text-content focus:outline-none focus:ring-2 focus:ring-orange-primary/20"
            onClick={onDismiss}
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
    )
  }
)
Toast.displayName = "Toast"

export type ToastViewportProps = React.HTMLAttributes<HTMLDivElement>

export function ToastViewport({ className, children, ...props }: ToastViewportProps) {
  const items = React.Children.toArray(children).slice(0, 3)

  if (items.length === 0) {
    return null
  }

  return (
    <div
      data-slot="toast-viewport"
      className={cn(
        "pointer-events-none fixed bottom-6 left-1/2 z-toast h-[132px] w-[min(445px,calc(100vw-2rem))] -translate-x-1/2",
        className
      )}
      {...props}
    >
      {items.map((child, index) => (
        <div
          key={index}
          className="absolute inset-x-0 bottom-0 origin-bottom transition-[opacity,transform] duration-200"
          style={{
            opacity: 1 - index * 0.12,
            pointerEvents: index === 0 ? "auto" : "none",
            transform: `translateY(-${index * 14}px) scale(${1 - index * 0.026})`,
            zIndex: items.length - index
          }}
        >
          {child}
        </div>
      ))}
    </div>
  )
}
