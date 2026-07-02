import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils"

const shadowPressed =
  "active:![box-shadow:0_0px_0_0_var(--elevation-top)_inset,0_0px_0_0_var(--elevation-background)_inset,0_0_0_1px_var(--elevation-ring),0_0px_0_1px_var(--elevation-halo)]"
const buttonMotion =
  "transition-[background-color,border-color,color,box-shadow,transform,filter] duration-fast ease-standard"

const elevationBase =
  "will-change-transform " +
  buttonMotion +
  " hover:duration-normal hover:ease-standard active:translate-y-px active:duration-fast active:ease-standard " +
  "[box-shadow:0_1px_0_0_var(--elevation-top)_inset,0_-1px_0_0_var(--elevation-bottom)_inset,0_0_0_0px_var(--elevation-ring),0_0_0_1px_var(--elevation-halo),0_1px_0px_0_var(--elevation-lip),0_0px_0px_0px_var(--elevation-ambient),0_0px_0px_0px_var(--elevation-drop)] " +
  "hover:[box-shadow:0_1px_0_0_var(--elevation-top)_inset,0_-1px_0_0_var(--elevation-bottom)_inset,0_0_0_0px_var(--elevation-ring),0_0_0_1px_var(--elevation-halo),0_1px_0px_0_var(--elevation-lip),0_0px_0px_0px_var(--elevation-ambient),0_0px_0px_0px_var(--elevation-drop)] " +
  shadowPressed

const elevationBackground = {
  accentSoft: "[--elevation-background:hsl(var(--accent-soft))]",
  dark: "[--elevation-background:#1c1917]",
  destructive: "[--elevation-background:hsl(var(--destructive))]",
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
  "[--elevation-top:#ffffff] [--elevation-bottom:#c2410c57] [--elevation-ring:#c2410c36] [--elevation-halo:#f9731629] [--elevation-lip:#00000000] [--elevation-ambient:#00000000] [--elevation-drop:#00000000]"

const elevationStone =
  "[--elevation-top:#ffffff] [--elevation-bottom:#57534e57] [--elevation-ring:#57534e36] [--elevation-halo:#78716c3b] [--elevation-lip:#00000000] [--elevation-ambient:#00000000] [--elevation-drop:#00000000]"

const elevationDark =
  "[--elevation-top:#ffffff2e] [--elevation-bottom:#000000a3] [--elevation-ring:#00000052] [--elevation-halo:#000000] [--elevation-lip:#00000000] [--elevation-ambient:#00000000] [--elevation-drop:#00000000]"

const elevationDestructive =
  "[--elevation-top:#ffffff70] [--elevation-bottom:#7f1d1da6] [--elevation-ring:#991b1b45] [--elevation-halo:#9e272e] [--elevation-lip:#00000000] [--elevation-ambient:#00000000] [--elevation-drop:#00000000]"

const elevationDestructiveSoft =
  "[--elevation-top:#ffffff] [--elevation-bottom:#b91c1c57] [--elevation-ring:#b91c1c36] [--elevation-halo:#dc262630] [--elevation-lip:#00000000] [--elevation-ambient:#00000000] [--elevation-drop:#00000000]"

const elevationSuccess =
  "[--elevation-top:#ffffff70] [--elevation-bottom:#14532da6] [--elevation-ring:#16653445] [--elevation-halo:#16a34a] [--elevation-lip:#00000000] [--elevation-ambient:#00000000] [--elevation-drop:#00000000]"

const elevationSuccessSoft =
  "[--elevation-top:#ffffff] [--elevation-bottom:#16a34a57] [--elevation-ring:#16a34a36] [--elevation-halo:#16a34a29] [--elevation-lip:#00000000] [--elevation-ambient:#00000000] [--elevation-drop:#00000000]"

function withElevation(colors: string, background: string) {
  return cn(elevationBase, colors, background)
}

const primaryButton = cn(
  "bg-orange-primary text-primary-foreground hover:bg-orange-primary/90",
  withElevation(elevationPrimary, elevationBackground.orangePrimary)
)

const buttonVariants = cva(
  cn(
    "inline-flex shrink-0 select-none cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[12px] font-medium outline-none",
    buttonMotion,
    "active:translate-y-[0.5px] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-0 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
  ),
  {
    variants: {
      variant: {
        default: primaryButton,
        primary: primaryButton,
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
          "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
          withElevation(elevationDestructiveSoft, elevationBackground.redSoft)
        ),
        success: cn(
          "border-black/20 bg-success text-success-foreground hover:bg-success/90",
          withElevation(elevationSuccess, elevationBackground.success)
        ),
        successSecondary: cn(
          "border-green-200 bg-green-50 text-green-700 hover:bg-green-100",
          withElevation(elevationSuccessSoft, elevationBackground.greenSoft)
        ),
        ghost:
          "border-transparent bg-transparent text-content-muted shadow-none hover:bg-surface-muted hover:text-content active:translate-y-0 active:bg-surface-recessed",
        "ghost-tile": cn(
          "relative m-0 inline-flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-md border border-white bg-surface text-content-muted transition-[border,background-color,color,opacity,box-shadow] duration-150 hover:border-stroke-strong hover:bg-surface-muted active:bg-surface-recessed",
          withElevation(elevationStone, elevationBackground.surface)
        ),
        glassy:
          "border-white/70 bg-surface-glass/65 text-content-secondary shadow-glass backdrop-blur-md hover:bg-surface-glass/85 hover:text-content active:shadow-pressed",
        link:
          "border-transparent bg-transparent text-orange-primary shadow-none underline-offset-4 hover:underline active:translate-y-0",
        indented:
          "border-transparent bg-surface-recessed/55 !px-4 text-content-muted shadow-recessed underline-offset-4 hover:bg-surface-recessed hover:text-content-muted active:translate-y-0",
        "indented-inverse":
          "border-transparent bg-surface-raised/80 !px-4 text-content-muted shadow-raised underline-offset-4 hover:bg-surface hover:text-content-muted hover:shadow-raised-hover active:shadow-pressed"
      },
      size: {
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
        className={cn(buttonVariants({ variant, size }), fullWidth && "w-full", className)}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
