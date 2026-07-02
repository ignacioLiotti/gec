import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"
import { cn } from "../lib/utils"

const checkedControlShadow =
  "data-[state=checked]:![box-shadow:0_1px_0_0_rgb(255_255_255_/_0.30)_inset,0_1px_0_0_rgb(255_190_128_/_0.36)_inset,0_-2px_0_0_rgb(154_52_18_/_0.32)_inset,0_0_0_1px_hsl(var(--orange-primary)_/_0.90),0_2px_0_0_rgb(194_65_12_/_0.56),0_9px_15px_-10px_hsl(var(--orange-primary)_/_0.86)]"

export type CheckboxSize = "sm" | "md" | "lg"

const checkboxSizes: Record<CheckboxSize, { root: string; icon: string }> = {
  sm: {
    root: "h-[1.125rem] w-[1.125rem] rounded-[5px]",
    icon: "h-3.5 w-3.5"
  },
  md: {
    root: "h-[1.375rem] w-[1.375rem] rounded-[6px]",
    icon: "h-[1.125rem] w-[1.125rem] "
  },
  lg: {
    root: "h-[1.625rem] w-[1.625rem] rounded-[7px]",
    icon: "h-[1.375rem] w-[1.375rem]"
  }
}

export type CheckboxProps = Omit<
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
  "size"
> & {
  size?: CheckboxSize
}

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, size = "md", ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer shrink-0 cursor-pointer border border-stroke bg-surface text-primary-foreground shadow-[inset_0_1px_0_0_#dcdcdc,inset_0_-1px_0_0_#fff,0_0_0_1px_#dcdcdc] transition-[background-color,border-color,box-shadow,color,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-primary/20 active:translate-y-px active:duration-100 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-colors data-[state=checked]:border-orange-primary data-[state=checked]:bg-orange-primary",
      checkboxSizes[size].root,
      checkedControlShadow,
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      forceMount
      className="flex items-center justify-center text-current opacity-0 scale-90 translate-y-1 transition-[opacity,scale,translate,filter] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none data-[state=checked]:translate-y-0 data-[state=checked]:opacity-100 data-[state=checked]:blur-0 data-[state=checked]:scale-100"
    >
      <Check className={checkboxSizes[size].icon} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName
