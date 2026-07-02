import * as React from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { Circle } from "lucide-react"
import { cn } from "../lib/utils"

const checkedControlShadow =
  "data-[state=checked]:![box-shadow:0_1px_0_0_rgb(255_255_255_/_0.92)_inset,0_-1px_0_0_rgb(220_220_220_/_0.88)_inset,0_0_0_1px_hsl(var(--orange-primary)_/_0.42),0_2px_0_0_rgb(214_211_209_/_0.72),0_11px_18px_-14px_rgb(27_27_27_/_0.70)]"

export type RadioGroupSize = "sm" | "md" | "lg"

const RadioGroupSizeContext = React.createContext<RadioGroupSize>("md")

const radioGroupItemSizes: Record<RadioGroupSize, { item: string; indicator: string }> = {
  sm: {
    item: "h-[1.125rem] w-[1.125rem]",
    indicator: "h-2.5 w-2.5"
  },
  md: {
    item: "h-[1.375rem] w-[1.375rem]",
    indicator: "h-3 w-3"
  },
  lg: {
    item: "h-[1.625rem] w-[1.625rem]",
    indicator: "h-4 w-4"
  }
}

export type RadioGroupProps = Omit<
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>,
  "size"
> & {
  size?: RadioGroupSize
}

export const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  RadioGroupProps
>(({ className, size = "md", ...props }, ref) => (
  <RadioGroupSizeContext.Provider value={size}>
    <RadioGroupPrimitive.Root ref={ref} className={cn("grid gap-2", className)} {...props} />
  </RadioGroupSizeContext.Provider>
))
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName

export type RadioGroupItemProps = Omit<
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>,
  "size"
> & {
  size?: RadioGroupSize
}

export const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  RadioGroupItemProps
>(({ className, size, ...props }, ref) => {
  const groupSize = React.useContext(RadioGroupSizeContext)
  const itemSize = size ?? groupSize

  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "aspect-square cursor-pointer rounded-full border border-stroke bg-surface text-orange-primary shadow-recessed transition-[background-color,border-color,box-shadow,color,translate] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-primary/20 active:translate-y-px active:duration-100 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-colors data-[state=checked]:border-orange-primary data-[state=checked]:bg-surface-raised",
        radioGroupItemSizes[itemSize].item,
        checkedControlShadow,
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        forceMount
        className="flex items-center justify-center opacity-0 scale-75 transition-[opacity,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none data-[state=checked]:opacity-100 data-[state=checked]:scale-100"
      >
        <Circle className={cn("fill-current text-current", radioGroupItemSizes[itemSize].indicator)} />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
})
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName
