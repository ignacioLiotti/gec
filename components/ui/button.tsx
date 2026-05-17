import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Sintesis DS — lifted button recipe
// Base: border-black/15 + active press + transition
// Per variant: bg + hue-matched 2-layer shadow + inset glint
const buttonVariants = cva(
  "inline-flex items-center justify-center cursor-pointer gap-1.5 whitespace-nowrap rounded-lg text-xs font-medium " +
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
          "shadow-[0_1px_3px_rgba(180,90,30,.35),0_2px_6px_rgba(180,90,30,.20),inset_0_1px_0_rgba(255,255,255,.15)] " +
          "hover:bg-[#C96B4A] hover:shadow-[0_2px_6px_rgba(180,90,30,.40),0_4px_10px_rgba(180,90,30,.25),inset_0_1px_0_rgba(255,255,255,.15)]",
        // Dark — used for primary actions in dense app UI
        dark:
          "bg-stone-900 text-stone-50 " +
          "shadow-[0_1px_3px_rgba(0,0,0,.35),0_2px_6px_rgba(0,0,0,.20),inset_0_1px_0_rgba(255,255,255,.10)] " +
          "hover:bg-stone-800 hover:shadow-[0_2px_6px_rgba(0,0,0,.40),0_4px_10px_rgba(0,0,0,.25),inset_0_1px_0_rgba(255,255,255,.10)]",
        // Outline — secondary action, most used variant
        outline:
          "bg-white text-stone-800 " +
          "shadow-[0_1px_2px_rgba(0,0,0,.08),0_1px_3px_rgba(0,0,0,.06),inset_0_1px_0_rgba(255,255,255,.80)] " +
          "hover:bg-stone-50 hover:shadow-[0_2px_4px_rgba(0,0,0,.10),0_2px_6px_rgba(0,0,0,.08),inset_0_1px_0_rgba(255,255,255,.80)]",
        // Secondary — lighter variant, paper-like
        secondary:
          "bg-stone-100 text-stone-700 " +
          "shadow-[0_1px_2px_rgba(0,0,0,.06),0_1px_3px_rgba(0,0,0,.04),inset_0_1px_0_rgba(255,255,255,.70)] " +
          "hover:bg-stone-200 hover:shadow-[0_2px_4px_rgba(0,0,0,.08),inset_0_1px_0_rgba(255,255,255,.70)]",
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
        // Ghost — no background, hover fill
        ghost:
          "border-transparent bg-transparent text-stone-700 shadow-none " +
          "hover:bg-stone-100 hover:text-stone-900",
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

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

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

export { Button, buttonVariants, type ButtonProps }
