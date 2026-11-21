"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils"
import { fieldClassName } from "./field-styles"

const shadowPressed =
  "active:![box-shadow:0_0px_0_0_var(--elevation-top)_inset,0_0px_0_0_var(--elevation-background)_inset,0_0_0_1px_var(--elevation-ring),0_0px_0_1px_var(--elevation-halo)]"
const buttonMotion =
  "transition-[background-color,border-color,color,box-shadow,transform,filter] duration-fast ease-standard motion-reduce:transition-none motion-reduce:transform-none"

const elevationBase =
  "" +
  buttonMotion +
  " hover:duration-normal hover:ease-standard active:translate-y-px active:duration-fast active:ease-standard " +
  "[box-shadow:0_1px_0_0_var(--elevation-top)_inset,0_-1px_0_0_var(--elevation-bottom)_inset,0_0_0_0px_var(--elevation-ring),0_0_0_1px_var(--elevation-halo),0_1px_0px_0_var(--elevation-lip),0_0px_0px_0px_var(--elevation-ambient),0_0px_0px_0px_var(--elevation-drop)] " +
  "hover:[box-shadow:0_1px_0_0_var(--elevation-top)_inset,0_-1px_0_0_var(--elevation-bottom)_inset,0_0_0_0px_var(--elevation-ring),0_0_0_1px_var(--elevation-halo),0_1px_0px_0_var(--elevation-lip),0_0px_0px_0px_var(--elevation-ambient),0_0px_0px_0px_var(--elevation-drop)] " +
  shadowPressed

const elevationBackground = {
  accentSoft: "[--elevation-background:hsl(var(--accent-soft))]",
  dark: "[--elevation-background:#1c1917]",
  destructive: "[--elevation-background:var(--destructive)]",
  greenSoft: "[--elevation-background:#f0fdf4]",
  orangePrimary: "[--elevation-background:hsl(var(--orange-primary))]",
  redSoft: "[--elevation-background:#fef2f2]",
  success: "[--elevation-background:hsl(var(--success))]",
  surface: "[--elevation-background:hsl(var(--surface))]",
  surfaceMuted: "[--elevation-background:hsl(var(--surface-muted))]",
  transparent: "[--elevation-background:transparent]"
} as const

const elevationPrimary =
  "[--elevation-top:#ffffff75] [--elevation-bottom:#7c2d12a6] [--elevation-ring:#9a341240] [--elevation-halo:#f97316] [--elevation-lip:#00000000] [--elevation-ambient:#00000000] [--elevation-drop:#00000000]"

const elevationOrangeSoft =
  "[--elevation-top:var(--control-glint)] [--elevation-bottom:#c2410c57] [--elevation-ring:#c2410c36] [--elevation-halo:#f9731629] [--elevation-lip:#00000000] [--elevation-ambient:#00000000] [--elevation-drop:#00000000]"

const elevationStone =
  "[--elevation-top:var(--control-glint)] [--elevation-bottom:#57534e57] [--elevation-ring:#57534e36] [--elevation-halo:#78716c3b] [--elevation-lip:#00000000] [--elevation-ambient:#00000000] [--elevation-drop:#00000000]"

const elevationDark =
  "[--elevation-top:#ffffff2e] [--elevation-bottom:#000000a3] [--elevation-ring:#00000052] [--elevation-halo:#000000] [--elevation-lip:#00000000] [--elevation-ambient:#00000000] [--elevation-drop:#00000000]"

const elevationDestructive =
  "[--elevation-top:#ffffff70] [--elevation-bottom:#7f1d1da6] [--elevation-ring:#991b1b45] [--elevation-halo:#9e272e] [--elevation-lip:#00000000] [--elevation-ambient:#00000000] [--elevation-drop:#00000000]"

const elevationDestructiveSoft =
  "[--elevation-top:var(--control-glint)] [--elevation-bottom:#b91c1c57] [--elevation-ring:#b91c1c36] [--elevation-halo:#dc262630] [--elevation-lip:#00000000] [--elevation-ambient:#00000000] [--elevation-drop:#00000000]"

const elevationSuccess =
  "[--elevation-top:#ffffff70] [--elevation-bottom:#14532da6] [--elevation-ring:#16653445] [--elevation-halo:#16a34a] [--elevation-lip:#00000000] [--elevation-ambient:#00000000] [--elevation-drop:#00000000]"

const elevationSuccessSoft =
  "[--elevation-top:var(--control-glint)] [--elevation-bottom:#16a34a57] [--elevation-ring:#16a34a36] [--elevation-halo:#16a34a29] [--elevation-lip:#00000000] [--elevation-ambient:#00000000] [--elevation-drop:#00000000]"

function withElevation(colors: string, background: string) {
  return cn(elevationBase, colors, background)
}

const primaryButton = cn(
  "bg-orange-primary text-primary-foreground hover:bg-orange-primary/90",
  withElevation(elevationPrimary, elevationBackground.orangePrimary)
)

const buttonVariants = cva(
  cn(
    "inline-flex shrink-0 select-none cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-[12px] font-medium outline-none",
    buttonMotion,
    "active:translate-y-[0.5px] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-0 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
  ),
  {
    variants: {
      variant: {
        default: primaryButton,
        primary: primaryButton,
        field: cn(fieldClassName, "justify-between font-normal active:translate-y-0"),
        defaultSecondary: cn(
          "border-accent-border/70 bg-accent-soft text-orange-primary hover:border-accent-border hover:bg-accent-soft/80",
          withElevation(elevationOrangeSoft, elevationBackground.accentSoft)
        ),
        defaultTertiary: cn(
          "border-orange-primary/40 bg-surface p-0 text-orange-primary hover:bg-orange-primary hover:text-primary-foreground",
          withElevation(elevationOrangeSoft, elevationBackground.surface)
        ),
        dark: cn(
          "bg-stone-900 text-stone-50 hover:bg-stone-800",
          withElevation(elevationDark, elevationBackground.dark)
        ),
        outline: cn(
          "bg-surface-muted text-content-secondary hover:bg-surface-recessed hover:text-content",
          withElevation(elevationStone, elevationBackground.surfaceMuted)
        ),
        secondary: cn(
          "border-none bg-surface text-content-secondary hover:bg-surface-raised hover:text-content",
          withElevation(elevationStone, elevationBackground.surface)
        ),
        destructive: cn(
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
          withElevation(elevationDestructive, elevationBackground.destructive)
        ),
        destructiveSecondary: cn(
          "border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/15",
          withElevation(elevationDestructiveSoft, elevationBackground.redSoft)
        ),
        success: cn(
          "border-black/20 bg-success text-success-foreground hover:bg-success/90",
          withElevation(elevationSuccess, elevationBackground.success)
        ),
        successSecondary: cn(
          "border-success/25 bg-success/10 text-success hover:bg-success/15",
          withElevation(elevationSuccessSoft, elevationBackground.greenSoft)
        ),
        ghost:
          "border-transparent bg-transparent text-content-muted shadow-none hover:bg-surface-muted hover:text-content active:translate-y-0 active:bg-surface-recessed",
        "ghost-tile": cn(
          "relative m-0 inline-flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-md border border-stroke bg-surface text-content-muted transition-[border,background-color,color,opacity,box-shadow] duration-150 hover:border-stroke-strong hover:bg-surface-muted active:bg-surface-recessed",
          withElevation(elevationStone, elevationBackground.surface)
        ),
        glassy:
          "border-stroke/70 bg-surface-glass/65 text-content-secondary shadow-glass backdrop-blur-md hover:bg-surface-glass/85 hover:text-content active:shadow-pressed",
        link:
          "border-transparent bg-transparent text-orange-primary shadow-none underline-offset-4 hover:underline active:translate-y-0",
        indented:
          "border-transparent bg-surface-recessed/55 !px-4 text-content-muted shadow-recessed underline-offset-4 hover:bg-surface-recessed hover:text-content-muted active:translate-y-0",
        "indented-inverse":
          "border-transparent bg-surface-raised/80 !px-4 text-content-muted shadow-raised underline-offset-4 hover:bg-surface hover:text-content-muted hover:shadow-raised-hover active:shadow-pressed"
      },
      size: {
        tile: "size-[88px]",
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        md: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-7 gap-1 rounded-md px-2.5 has-[>svg]:px-2",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
  fullWidth?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    return (
      <Comp
        ref={ref}
        data-slot="button"
        className={cn(buttonVariants({ variant, size: size ?? (variant === "ghost-tile" ? "tile" : undefined) }), fullWidth && "w-full", className)}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

const lightButtonChrome = cn(
  "[--shadow-light-button:0_1px_0_0_var(--control-glint)_inset,0_-1px_0_0_#0000001f_inset,0_0_0_1px_var(--btn-ring),0_2px_2px_0_#0b090c0d,0_1px_1px_0_#0b090c0f,0_5px_8px_-7px_#0b090c08]",
  "[--shadow-light-button-hover:0_1px_0_0_var(--control-glint)_inset,0_-1px_0_0_#00000024_inset,0_0_0_1px_var(--btn-ring-hover),0_3px_3px_0_#0b090c12,0_2px_2px_0_#0b090c0f,0_7px_12px_-8px_#0b090c12]",
  "[--shadow-light-button-active:0_1px_0_0_var(--control-glint)_inset,0_0_0_0_#00000000_inset,0_0_0_1px_var(--btn-ring-active),0_1px_1px_0_#0b090c12,0_4px_8px_-8px_#0b090c14]",
  "shadow-[var(--btn-shadow,var(--shadow-light-button))] hover:shadow-[var(--btn-shadow,var(--shadow-light-button-hover))] active:shadow-[var(--btn-shadow,var(--shadow-light-button-active))]"
)

const lightButtonVariants = cva(
  cn(
    "relative inline-flex shrink-0 select-none cursor-pointer items-center justify-center whitespace-nowrap rounded-full border-0 bg-clip-padding py-0 align-top text-sm font-medium leading-none outline-none",
    buttonMotion,
    lightButtonChrome,
    "active:translate-y-[0.5px] disabled:pointer-events-none disabled:opacity-50 aria-invalid:[--btn-ring:color-mix(in_srgb,var(--destructive)_45%,transparent)] aria-invalid:[--btn-ring-hover:color-mix(in_srgb,var(--destructive)_55.00000000000001%,transparent)] focus-visible:ring-2 focus-visible:ring-orange-primary/20 focus-visible:ring-offset-0 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
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
          "[--btn-ring:color-mix(in_srgb,var(--destructive)_24%,transparent)] [--btn-ring-hover:color-mix(in_srgb,var(--destructive)_38%,transparent)] [--btn-ring-active:color-mix(in_srgb,var(--destructive)_46%,transparent)] bg-card text-destructive hover:bg-destructive/10 active:bg-destructive/15 aria-[pressed=true]:bg-destructive/10 data-[state=open]:bg-destructive/10",
        destructiveSolid:
          "[--btn-ring:color-mix(in_srgb,var(--destructive)_55.00000000000001%,transparent)] [--btn-ring-hover:color-mix(in_srgb,var(--destructive)_72%,transparent)] [--btn-ring-active:color-mix(in_srgb,var(--destructive)_84%,transparent)] bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/85 aria-[pressed=true]:bg-destructive/90 data-[state=open]:bg-destructive/90",
        success:
          "[--btn-ring:hsl(var(--success)_/_0.24)] [--btn-ring-hover:hsl(var(--success)_/_0.38)] [--btn-ring-active:hsl(var(--success)_/_0.46)] bg-card text-success hover:bg-success/10 active:bg-success/15 aria-[pressed=true]:bg-success/10 data-[state=open]:bg-success/10",
        successSolid:
          "[--btn-ring:hsl(var(--success)_/_0.55)] [--btn-ring-hover:hsl(var(--success)_/_0.72)] [--btn-ring-active:hsl(var(--success)_/_0.84)] bg-success text-success-foreground hover:bg-success/90 active:bg-success/85 aria-[pressed=true]:bg-success/90 data-[state=open]:bg-success/90",
        warning:
          "[--btn-ring:hsl(var(--warning)_/_0.30)] [--btn-ring-hover:hsl(var(--warning)_/_0.46)] [--btn-ring-active:hsl(var(--warning)_/_0.54)] bg-card text-warning-foreground hover:bg-warning/15 active:bg-warning/20 aria-[pressed=true]:bg-warning/15 data-[state=open]:bg-warning/15",
        warningSolid:
          "[--btn-ring:hsl(var(--warning)_/_0.55)] [--btn-ring-hover:hsl(var(--warning)_/_0.72)] [--btn-ring-active:hsl(var(--warning)_/_0.84)] bg-warning text-stone-950 hover:bg-warning/90 active:bg-warning/85 aria-[pressed=true]:bg-warning/90 data-[state=open]:bg-warning/90",
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

type LightButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof lightButtonVariants> & {
    asChild?: boolean
  }

type ExpandableLightButtonProps = LightButtonProps & {
  label: string
  labelClassName?: string
}

const expandableLightButtonClassName =
  "group/expand-light gap-0 overflow-hidden [&>svg]:transition-transform [&>svg]:duration-180 [&>svg]:ease-[cubic-bezier(0.23,1,0.32,1)] hover:[&>svg]:scale-105 active:[&>svg]:scale-95 motion-reduce:[&>svg]:transition-none"

const expandableLightButtonLabelClassName =
  "pointer-events-none grid min-w-0 grid-cols-[0fr] opacity-0 transition-[grid-template-columns,opacity,margin-left] duration-180 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover/expand-light:ml-1.5 group-hover/expand-light:grid-cols-[1fr] group-hover/expand-light:opacity-100 group-focus-visible/expand-light:ml-1.5 group-focus-visible/expand-light:grid-cols-[1fr] group-focus-visible/expand-light:opacity-100 group-data-[state=open]/expand-light:ml-1.5 group-data-[state=open]/expand-light:grid-cols-[1fr] group-data-[state=open]/expand-light:opacity-100 motion-reduce:transition-none"

const expandableLightButtonLabelTextClassName =
  "min-w-0 -translate-x-1 overflow-hidden whitespace-nowrap transition-transform duration-180 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover/expand-light:translate-x-0 group-focus-visible/expand-light:translate-x-0 group-data-[state=open]/expand-light:translate-x-0 motion-reduce:transition-none"

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
        <span className={expandableLightButtonLabelTextClassName}>{label}</span>
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

export { LightButton, ExpandableLightButton, lightButtonVariants, type LightButtonProps, type ExpandableLightButtonProps }
