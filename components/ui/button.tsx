import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Sintesis DS — lifted button recipe
// Base: border-black/15 + active press + transition
// Per variant: bg + hue-matched 2-layer shadow + inset glint
const buttonVariants = cva(
  "flex items-center justify-center cursor-pointer gap-1.5 whitespace-nowrap rounded-lg text-[12px] font-medium " +
  "border border-black/15 " +
  "active:translate-y-px " +
  "transition-[box-shadow,background-color,opacity] duration-150 " +
  "disabled:pointer-events-none disabled:opacity-50 " +
  "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 " +
  "outline-none focus-visible:ring-2 focus-visible:ring-ring/50 " +
  "aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // Orange — brand primary CTA
        default:
          "bg-orange-primary text-[#FAF9F5] " +
          "shadow-[inset_0_1px_0_rgba(255,255,255,.25),inset_0_-1px_0_rgba(0,0,0,.15)] " +
          "hover:bg-orange-primary/80 hover:shadow-[0_2px_6px_rgba(180,90,30,.40),0_4px_10px_rgba(180,90,30,.25),inset_0_1px_0_rgba(255,255,255,.15)]",
        // Peach secondary — vivid peach over warm white, burnt orange-red text (Sintesis .btn-default-secondary)
        defaultSecondary:
          "bg-[#FFE0CC] text-[#C43E00] " +
          "border-[rgba(196,62,0,0.25)] " +
          "shadow-[0_1px_3px_rgba(200,60,0,.28),0_2px_6px_rgba(200,60,0,.16),inset_0_1px_0_rgba(255,255,255,.85)] " +
          "hover:bg-[#FFD1B3] hover:border-[rgba(196,62,0,0.34)] " +
          "hover:shadow-[0_1px_3px_rgba(200,60,0,.36),0_4px_10px_rgba(200,60,0,.22),inset_0_1px_0_rgba(255,255,255,.90)]",
        // Dark — used for primary actions in dense app UI
        defaultTertiary:
          "bg-stone-100 text-stone-700 " +
          "shadow-[0_1px_2px_rgba(0,0,0,.06),0_1px_3px_rgba(0,0,0,.04),inset_0_1px_0_rgba(255,255,255,.70)] " +
          "hover:bg-stone-200 hover:shadow-[0_2px_4px_rgba(0,0,0,.08),inset_0_1px_0_rgba(255,255,255,.70)] " +
          "border-orange-primary/40 bg-white text-orange-primary p-0 shadow-sm hover:bg-orange-primary hover:text-white",
        dark:
          "bg-stone-900 text-stone-50 " +
          "shadow-[0_1px_3px_rgba(0,0,0,.35),0_2px_6px_rgba(0,0,0,.20),inset_0_1px_0_rgba(255,255,255,.10)] " +
          "hover:bg-stone-800 hover:shadow-[0_2px_6px_rgba(0,0,0,.40),0_4px_10px_rgba(0,0,0,.25),inset_0_1px_0_rgba(255,255,255,.10)]",
        // Outline — secondary action, most used variant
        outline:
          // "bg-stone-50 text-stone-800 " +
          // "shadow-[0_1px_2px_rgba(0,0,0,.20),0_1px_3px_rgba(0,0,0,.06),inset_0_1px_0_rgba(255,255,255,.80)] " +
          // "hover:bg-stone-50 hover:shadow-[0_2px_4px_rgba(0,0,0,.10),0_2px_6px_rgba(0,0,0,.08),inset_0_1px_0_rgba(255,255,255,.80)]",
          "bg-stone-100 text-stone-700 " +
          "shadow-[0_1px_2px_rgba(0,0,0,.06),0_1px_3px_rgba(0,0,0,.04),inset_0_1px_0_rgba(255,255,255,.70)] " +
          "hover:bg-stone-200 hover:shadow-[0_2px_4px_rgba(0,0,0,.08),inset_0_1px_0_rgba(255,255,255,.70)]",
        // Secondary — lighter variant, paper-like
        secondary:
          "bg-stone-100 text-stone-700 border-none " +
          "hover:bg-stone-200 hover:shadow-[0_2px_4px_rgba(0,0,0,.08),inset_0_1px_0_rgba(255,255,255,1)]" +
          "bg-white shadow-[0_1px_0_0_#fff_inset,0_-1px_0_0_#0000001f_inset,0_0_0_1px_#00000024,0_2px_2px_0_#0b090c0d,0_1px_1px_0_#0b090c0f,0_5px_8px_-7px_#0b090c08] " +
          "active:translate-y-[1px] active:shadow-[0_1px_0_0_#fff_inset,0_0px_0_0_#0000001f_inset,0_0_0_1px_#00000012,0_1px_1px_0_#0b090c0f,0_3px_6px_-6px_#0b090c14] ",
        // Destructive — delete / danger
        destructive:
          "bg-[#C9323A] text-[#FFF5F4] " +
          "shadow-[0_1px_3px_rgba(150,30,35,.35),0_2px_6px_rgba(150,30,35,.20),inset_0_1px_0_rgba(255,255,255,.12)] " +
          "hover:bg-[#B52C33] hover:shadow-[0_2px_6px_rgba(150,30,35,.40),0_4px_10px_rgba(150,30,35,.25),inset_0_1px_0_rgba(255,255,255,.12)]",
        // DestructiveSecondary — soft destructive (confirmations, banners)
        destructiveSecondary:
          "bg-red-50 text-red-700 border-red-200 " +
          "shadow-[0_1px_2px_rgba(150,30,35,.08),inset_0_1px_0_rgba(255,255,255,.60)] " +
          "hover:bg-red-100",
        // Success — solid green CTA (Sintesis tn-success-solid)
        success:
          "bg-[#2E7D4F] text-[#F2FBF5] border-[rgba(0,0,0,0.18)] " +
          "shadow-[0_1px_3px_rgba(30,100,55,.38),0_2px_6px_rgba(30,100,55,.22),inset_0_1px_0_rgba(255,255,255,.18)] " +
          "hover:bg-[#276B44] hover:shadow-[0_2px_6px_rgba(30,100,55,.40),0_4px_10px_rgba(30,100,55,.25),inset_0_1px_0_rgba(255,255,255,.18)]",
        successSecondary:
          "bg-green-50 text-green-700 border-green-200 " +
          "shadow-[0_1px_2px_rgba(30,150,35,.08),inset_0_1px_0_rgba(255,255,255,.60)] " +
          "hover:bg-green-100",
        // Ghost — no background, hover fill
        ghost:
          "relative m-0 inline-flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-full border border-[#d9d9d9] bg-[#fefeff] text-[#5c6878] shadow-[0px_10px_24px_-12px_#00000033,0px_2px_6px_#00000012] transition-[border,background-color,color,opacity,box-shadow] duration-150 hover:bg-[#f7f7f7] hover:border-[#cfcfcf] active:bg-[#f4f4f4] disabled:pointer-events-none disabled:opacity-50",
        // Link — inline text navigation
        link:
          "border-transparent bg-transparent text-primary shadow-none " +
          "underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-7 rounded-md gap-1 px-2.5 has-[>svg]:px-2",
        sm: "h-8 rounded-lg gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-lg px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const buttonMotion =
  "transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-150 ease-out"

const lightButtonChrome = cn(
  "[--shadow-light-button:0_1px_0_0_#fff_inset,0_-1px_0_0_#0000001f_inset,0_0_0_1px_var(--btn-ring),0_2px_2px_0_#0b090c0d,0_1px_1px_0_#0b090c0f,0_5px_8px_-7px_#0b090c08]",
  "[--shadow-light-button-hover:0_1px_0_0_#fff_inset,0_-1px_0_0_#00000024_inset,0_0_0_1px_var(--btn-ring-hover),0_3px_3px_0_#0b090c12,0_2px_2px_0_#0b090c0f,0_7px_12px_-8px_#0b090c12]",
  "[--shadow-light-button-active:0_1px_0_0_#fff_inset,0_0_0_0_#00000000_inset,0_0_0_1px_var(--btn-ring-active),0_1px_1px_0_#0b090c12,0_4px_8px_-8px_#0b090c14]",
  "shadow-[var(--btn-shadow,var(--shadow-light-button))] hover:shadow-[var(--btn-shadow,var(--shadow-light-button-hover))] active:shadow-[var(--btn-shadow,var(--shadow-light-button-active))]"
)

const lightButtonVariants = cva(
  cn(
    "relative inline-flex shrink-0 select-none cursor-pointer items-center justify-center whitespace-nowrap rounded-full border-0 bg-clip-padding py-0 align-top text-sm font-medium leading-none outline-none",
    buttonMotion,
    lightButtonChrome,
    "active:translate-y-[0.5px] disabled:pointer-events-none disabled:opacity-50 aria-invalid:[--btn-ring:hsl(var(--destructive)_/_0.45)] aria-invalid:[--btn-ring-hover:hsl(var(--destructive)_/_0.55)] focus-visible:ring-2 focus-visible:ring-orange-primary/20 focus-visible:ring-offset-0 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
  ),
  {
    variants: {
      variant: {
        default:
          "[--btn-ring:#00000017] [--btn-ring-hover:#00000022] [--btn-ring-active:#0000002b] bg-card text-content-secondary hover:bg-surface-muted hover:text-content active:bg-surface-recessed aria-[pressed=true]:bg-surface-muted aria-[pressed=true]:text-content data-[state=open]:bg-surface-muted data-[state=open]:text-content",
        primary:
          "[--btn-ring:hsl(var(--orange-primary)_/_0.24)] [--btn-ring-hover:hsl(var(--orange-primary)_/_0.38)] [--btn-ring-active:hsl(var(--orange-primary)_/_0.46)] bg-card text-orange-primary hover:bg-accent-soft active:bg-accent-soft/80 aria-[pressed=true]:bg-accent-soft data-[state=open]:bg-accent-soft",
        primarySolid:
          "[--btn-ring:hsl(var(--orange-primary)_/_0.55)] [--btn-ring-hover:hsl(var(--orange-primary)_/_0.72)] [--btn-ring-active:hsl(var(--orange-primary)_/_0.84)] bg-orange-primary text-primary-foreground hover:bg-orange-primary/90 active:bg-orange-primary/85 aria-[pressed=true]:bg-orange-primary/90 data-[state=open]:bg-orange-primary/90",
        secondary:
          "[--btn-ring:#00000012] [--btn-ring-hover:#0000001c] [--btn-ring-active:#00000024] bg-surface-muted text-content-muted hover:bg-card hover:text-content-secondary active:bg-surface-recessed aria-[pressed=true]:bg-card aria-[pressed=true]:text-content-secondary data-[state=open]:bg-card data-[state=open]:text-content-secondary",
        destructive:
          "[--btn-ring:hsl(var(--destructive)_/_0.24)] [--btn-ring-hover:hsl(var(--destructive)_/_0.38)] [--btn-ring-active:hsl(var(--destructive)_/_0.46)] bg-card text-destructive hover:bg-destructive/10 active:bg-destructive/15 aria-[pressed=true]:bg-destructive/10 data-[state=open]:bg-destructive/10",
        destructiveSolid:
          "[--btn-ring:hsl(var(--destructive)_/_0.55)] [--btn-ring-hover:hsl(var(--destructive)_/_0.72)] [--btn-ring-active:hsl(var(--destructive)_/_0.84)] bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/85 aria-[pressed=true]:bg-destructive/90 data-[state=open]:bg-destructive/90",
        success:
          "[--btn-ring:hsl(var(--success)_/_0.24)] [--btn-ring-hover:hsl(var(--success)_/_0.38)] [--btn-ring-active:hsl(var(--success)_/_0.46)] bg-card text-success hover:bg-success/10 active:bg-success/15 aria-[pressed=true]:bg-success/10 data-[state=open]:bg-success/10",
        successSolid:
          "[--btn-ring:hsl(var(--success)_/_0.55)] [--btn-ring-hover:hsl(var(--success)_/_0.72)] [--btn-ring-active:hsl(var(--success)_/_0.84)] bg-success text-success-foreground hover:bg-success/90 active:bg-success/85 aria-[pressed=true]:bg-success/90 data-[state=open]:bg-success/90",
        warning:
          "[--btn-ring:hsl(var(--warning)_/_0.30)] [--btn-ring-hover:hsl(var(--warning)_/_0.46)] [--btn-ring-active:hsl(var(--warning)_/_0.54)] bg-card text-warning-foreground hover:bg-warning/15 active:bg-warning/20 aria-[pressed=true]:bg-warning/15 data-[state=open]:bg-warning/15",
        warningSolid:
          "[--btn-ring:hsl(var(--warning)_/_0.55)] [--btn-ring-hover:hsl(var(--warning)_/_0.72)] [--btn-ring-active:hsl(var(--warning)_/_0.84)] bg-warning text-warning-foreground hover:bg-warning/90 active:bg-warning/85 aria-[pressed=true]:bg-warning/90 data-[state=open]:bg-warning/90",
        darkSolid:
          "[--btn-ring:#00000052] [--btn-ring-hover:#00000070] [--btn-ring-active:#0000008a] bg-stone-900 text-stone-50 hover:bg-stone-800 active:bg-stone-950 aria-[pressed=true]:bg-stone-800 data-[state=open]:bg-stone-800",
        ghost:
          "[--btn-ring:transparent] [--btn-ring-hover:#00000017] [--btn-ring-active:#00000022] [--btn-shadow:none] bg-transparent text-content-muted hover:[--btn-shadow:var(--shadow-light-button)] hover:bg-surface-muted hover:text-content active:[--btn-shadow:var(--shadow-light-button)] active:bg-surface-recessed aria-[pressed=true]:[--btn-shadow:var(--shadow-light-button)] aria-[pressed=true]:bg-surface-muted aria-[pressed=true]:text-content data-[state=open]:[--btn-shadow:var(--shadow-light-button)] data-[state=open]:bg-surface-muted data-[state=open]:text-content",
        selected:
          "[--btn-ring:hsl(var(--orange-primary)_/_0.36)] [--btn-ring-hover:hsl(var(--orange-primary)_/_0.50)] [--btn-ring-active:hsl(var(--orange-primary)_/_0.58)] bg-accent-soft text-orange-primary hover:bg-accent-soft/80 active:bg-accent-soft/70 aria-[pressed=true]:bg-accent-soft data-[state=open]:bg-accent-soft"
      },
      size: {
        default: "h-7 min-w-7 gap-1.5 px-2 ",
        sm: "h-6 min-w-6 gap-1 px-1.5 text-[11px] has-[>svg]:px-1",
        lg: "h-8 min-w-8 gap-2 px-2.5 text-sm has-[>svg]:px-2",
        icon: "size-7",
        "icon-sm": "size-6 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-8 [&_svg:not([class*='size-'])]:size-4.5"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

type LightButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof lightButtonVariants> & {
    asChild?: boolean
  }

type ExpandableLightButtonProps = LightButtonProps & {
  label: string
  labelClassName?: string
}

const expandableLightButtonClassName = "group/expand-light gap-0 overflow-hidden"

const expandableLightButtonLabelClassName =
  "pointer-events-none inline-block max-w-0 overflow-hidden whitespace-nowrap align-middle opacity-0 transition-[max-width,opacity,margin-left] delay-200 duration-700 ease-out group-hover/expand-light:ml-1.5 group-hover/expand-light:max-w-[12rem] group-hover/expand-light:opacity-100 group-hover/expand-light:delay-0 group-hover/expand-light:duration-200 group-focus-visible/expand-light:ml-1.5 group-focus-visible/expand-light:max-w-[12rem] group-focus-visible/expand-light:opacity-100 group-focus-visible/expand-light:delay-0 group-focus-visible/expand-light:duration-200 group-data-[state=open]/expand-light:ml-1.5 group-data-[state=open]/expand-light:max-w-[12rem] group-data-[state=open]/expand-light:opacity-100 group-data-[state=open]/expand-light:delay-0 group-data-[state=open]/expand-light:duration-200"

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    return (
      <Comp
        ref={ref}
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

const LightButton = React.forwardRef<HTMLButtonElement, LightButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    return (
      <Comp
        ref={ref}
        data-slot="light-button"
        className={cn(lightButtonVariants({ variant, size, className }))}
        {...props}
      />
    )
  }
)
LightButton.displayName = "LightButton"

const ExpandableLightButton = React.forwardRef<HTMLButtonElement, ExpandableLightButtonProps>(
  ({ className, label, labelClassName, children, "aria-label": ariaLabel, asChild, ...props }, ref) => {
    const labelNode = (
      <span
        className={cn(
          expandableLightButtonLabelClassName,
          labelClassName
        )}
      >
        {label}
      </span>
    )

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ children?: React.ReactNode }>

      return (
        <LightButton
          ref={ref}
          asChild
          aria-label={ariaLabel ?? label}
          className={cn(
            expandableLightButtonClassName,
            className
          )}
          {...props}
        >
          {React.cloneElement(child, undefined, (
            <>
              {child.props.children}
              {labelNode}
            </>
          ))}
        </LightButton>
      )
    }

    return (
      <LightButton
        ref={ref}
        aria-label={ariaLabel ?? label}
        className={cn(
          expandableLightButtonClassName,
          className
        )}
        {...props}
      >
        {children}
        {labelNode}
      </LightButton>
    )
  }
)
ExpandableLightButton.displayName = "ExpandableLightButton"

export {
  Button,
  LightButton,
  ExpandableLightButton,
  buttonVariants,
  lightButtonVariants,
  type ButtonProps,
  type LightButtonProps,
  type ExpandableLightButtonProps,
}
