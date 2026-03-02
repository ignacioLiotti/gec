import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center cursor-pointer gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "relative border border-transparent leading-[normal] " +
          "[background-origin:border-box] [background-clip:padding-box,border-box] " +
          "[background-image:linear-gradient(180deg,#201E25_0%,#323137_100%),linear-gradient(180deg,#4B4951_0%,#313036_70%)] " +
          "hover:[background-image:linear-gradient(180deg,#26232D_100%,#3A3840_0%),linear-gradient(180deg,#5A5861_100%,#3B3941_0%)] " +
          "text-gray-200 " +
          "shadow-[0px_2px_4px_rgba(0,0,0,0.10),0px_0px_0px_1px_#0D0D0D] " +
          "transition-[box-shadow,transform,background-image] duration-150 " +
          "hover:shadow-[0px_4px_8px_rgba(0,0,0,0.15),0px_0px_0px_1px_#0D0D0D] ",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        destructiveSecondary:
          "bg-destructive/10 text-destructive hover:bg-destructive/10 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "bg-[radial-gradient(100%_50%_at_50%_0%,#fff_0%,#fff0_100%),var(--background-85,#fafafad9)] bg-white shadow-[0_0_0_1px_#00000012,0_1px_0_0_#fff_inset,0_8px_3px_0_#0b090c03,0_5px_3px_0_#0b090c08,0_2px_2px_0_#0b090c0d,0_1px_1px_0_#0b090c0f,0_-1px_0_0_#0000001f_inset] text-primary",
        secondary:
          "relative border border-transparent leading-[normal]  " +
          "[background-origin:border-box] " +
          "[background-clip:padding-box,border-box] " +
          "[background-image:linear-gradient(180deg,rgba(227,227,227,0.4)_0%,rgba(227,227,227,0.2)_100%),linear-gradient(180deg,#FDFDFD_0%,rgba(241,241,241,0)_100%)] " +
          "shadow-[0px_2px_4px_rgba(0,0,0,0.10),0px_0px_0px_1px_rgba(0,0,0,0.16)] " +
          "text-[#2A2A2A] " +
          "transition-[box-shadow,transform,background-image] duration-150 " +
          "hover:[background-image:linear-gradient(180deg,rgba(227,227,227,0.6)_0%,rgba(227,227,227,0.3)_100%),linear-gradient(180deg,#FFFFFF_0%,rgba(241,241,241,0)_100%)] " +
          "hover:shadow-[0px_4px_8px_rgba(0,0,0,0.12),0px_0px_0px_1px_rgba(0,0,0,0.18)] ",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-7 rounded-md gap-1 px-2.5 has-[>svg]:px-2",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
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
