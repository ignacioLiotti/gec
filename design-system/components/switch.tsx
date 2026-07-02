import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"
import { cn } from "../lib/utils"

const checkedTrackShadow =
  "data-[state=checked]:![box-shadow:0_-1px_0_0_rgb(255_255_255_/_0.26)_inset,0_1px_0_0_rgb(154_52_18_/_0.30)_inset,0_0_0_1px_hsl(var(--orange-primary)_/_0.90),0_3px_0_0_rgb(194_65_12_/_0.52),0_11px_18px_-12px_hsl(var(--orange-primary)_/_0.88)]"

export type SwitchSize = "sm" | "md" | "lg"

const switchSizes: Record<SwitchSize, { root: string; thumb: string; travel: string }> = {
  sm: {
    root: "h-[1.375rem] w-[2.375rem] rounded-[6px]",
    thumb: "h-[1.125rem] w-[1.125rem] rounded-[4px]",
    travel: "data-[state=checked]:translate-x-[0.95rem]"
  },
  md: {
    root: "h-[1.625rem] w-[2.875rem] rounded-[8px]",
    thumb: "h-[1.375rem] w-[1.375rem] rounded-[6px]",
    travel: "data-[state=checked]:translate-x-[1.15rem]"
  },
  lg: {
    root: "h-7 w-[3.25rem] rounded-[9px]",
    thumb: "h-6 w-6 rounded-[7px]",
    travel: "data-[state=checked]:translate-x-[1.45rem]"
  }
}

export type SwitchProps = Omit<React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>, "size"> & {
  size?: SwitchSize
}

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SwitchProps
>(({ className, size = "md", ...props }, ref) => (
  <SwitchPrimitive.Root
    className={cn(
      "peer inline-flex shrink-0 cursor-pointer items-center border border-stroke bg-surface-recessed p-0.5 shadow-recessed transition-[background-color,border-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-primary/20 active:duration-100 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-colors data-[state=checked]:border-orange-primary data-[state=checked]:bg-orange-primary",
      switchSizes[size].root,
      checkedTrackShadow,
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block bg-surface ring-0 transition-[box-shadow,translate] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-[translate] [box-shadow:inset_0_2px_#ffffffc7,inset_0_-2px_#00000014,0_0_0_1px_#1b1b1b1a,0_7px_12px_-9px_#1b1b1be6] motion-reduce:transition-none data-[state=unchecked]:translate-x-0",
        switchSizes[size].thumb,
        switchSizes[size].travel
      )}
    />
  </SwitchPrimitive.Root>
))
Switch.displayName = SwitchPrimitive.Root.displayName
