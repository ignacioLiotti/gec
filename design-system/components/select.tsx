import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "../lib/utils"

export const Select = SelectPrimitive.Root
export const SelectGroup = SelectPrimitive.Group
export const SelectValue = SelectPrimitive.Value

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-md border border-stroke bg-surface px-3 py-2 text-sm text-content shadow-recessed transition-[border-color,box-shadow,background-color,color] placeholder:text-content-disabled focus:outline-none focus:ring-2 focus:ring-content/10 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 text-content-muted" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

export const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1 text-content-muted", className)}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

export const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1 text-content-muted", className)}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName

export interface SelectContentProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> {
  heading?: React.ReactNode
  hideHeading?: boolean
}

export const SelectContent = React.forwardRef<React.ElementRef<typeof SelectPrimitive.Content>, SelectContentProps>(
  ({ className, children, heading = "Options", hideHeading = false, position = "popper", ...props }, ref) => {
    const showHeading = !hideHeading && heading !== null && heading !== false

    return (
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          ref={ref}
          className={cn(
            "relative z-dropdown max-h-96 min-w-32 overflow-hidden rounded-md border border-stroke bg-surface p-1 text-content shadow-dropdown data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
            className
          )}
          position={position}
          {...props}
        >
          {showHeading ? (
            <>
              <div className="px-2 py-1.5 text-sm font-semibold text-content">{heading}</div>
              <div className="-mx-1 my-1 h-px bg-stroke-soft" />
            </>
          ) : null}
          <SelectScrollUpButton />
          <SelectPrimitive.Viewport
            className={cn(
              position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
            )}
          >
            {children}
          </SelectPrimitive.Viewport>
          <SelectScrollDownButton />
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    )
  }
)
SelectContent.displayName = SelectPrimitive.Content.displayName

export const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label ref={ref} className={cn("px-2 py-1.5 text-sm font-semibold text-content", className)} {...props} />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

export type SelectItemSelectionVariant = "menu" | "quiet" | "raised" | "tinted" | "outline" | "inset" | "pill" | "line" | "contrast"

const selectItemSelectionVariants: Record<SelectItemSelectionVariant, string> = {
  menu: "data-[state=checked]:font-medium data-[state=checked]:text-content data-[highlighted]:data-[state=checked]:bg-surface-recessed",
  quiet:
    "data-[state=checked]:bg-surface-muted data-[state=checked]:font-medium data-[state=checked]:text-content data-[highlighted]:data-[state=checked]:bg-surface-recessed",
  raised:
    "data-[state=checked]:border-stroke-soft data-[state=checked]:bg-surface-raised data-[state=checked]:font-medium data-[state=checked]:text-content data-[state=checked]:shadow-[0_1px_0_rgb(255_255_255_/_0.82)_inset,0_1px_2px_rgb(27_27_27_/_0.06)] data-[highlighted]:data-[state=checked]:bg-surface-recessed",
  tinted:
    "data-[state=checked]:border-stroke-soft data-[state=checked]:bg-surface-recessed data-[state=checked]:font-medium data-[state=checked]:text-content data-[highlighted]:data-[state=checked]:bg-surface-recessed",
  outline:
    "data-[state=checked]:border-stroke data-[state=checked]:bg-card data-[state=checked]:font-medium data-[state=checked]:text-content data-[state=checked]:shadow-[0_0_0_1px_rgb(27_27_27_/_0.06),0_1px_2px_rgb(27_27_27_/_0.06)] data-[highlighted]:data-[state=checked]:bg-surface-recessed",
  inset:
    "data-[state=checked]:border-stroke-soft data-[state=checked]:bg-surface-recessed data-[state=checked]:font-medium data-[state=checked]:text-content data-[state=checked]:shadow-recessed data-[highlighted]:data-[state=checked]:bg-surface-recessed",
  pill:
    "rounded-full data-[state=checked]:border-stroke-soft data-[state=checked]:bg-surface-raised data-[state=checked]:font-medium data-[state=checked]:text-content data-[state=checked]:shadow-raised data-[highlighted]:data-[state=checked]:bg-surface-recessed",
  line:
    "data-[state=checked]:bg-surface-raised data-[state=checked]:font-medium data-[state=checked]:text-content data-[state=checked]:shadow-[inset_2px_0_0_hsl(var(--content-muted)),0_1px_0_rgb(255_255_255_/_0.82)_inset] data-[highlighted]:data-[state=checked]:bg-surface-recessed",
  contrast:
    "data-[state=checked]:border-content data-[state=checked]:bg-content data-[state=checked]:font-medium data-[state=checked]:text-card data-[state=checked]:shadow-[0_1px_0_rgb(255_255_255_/_0.18)_inset,0_6px_16px_-12px_rgb(27_27_27_/_0.9)] data-[highlighted]:data-[state=checked]:bg-content"
}

const selectItemIndicatorVariants: Record<SelectItemSelectionVariant, string> = {
  menu: "text-content-muted group-data-[highlighted]:text-content group-data-[state=checked]:text-content-secondary",
  quiet: "text-content-muted group-data-[highlighted]:text-content group-data-[state=checked]:text-content-secondary",
  raised: "text-content-muted group-data-[highlighted]:text-content group-data-[state=checked]:text-content-secondary",
  tinted: "text-content-muted group-data-[highlighted]:text-content group-data-[state=checked]:text-content-secondary",
  outline: "text-content-muted group-data-[highlighted]:text-content group-data-[state=checked]:text-content-secondary",
  inset: "text-content-muted group-data-[highlighted]:text-content group-data-[state=checked]:text-content-secondary",
  pill: "text-content-muted group-data-[highlighted]:text-content group-data-[state=checked]:text-content-secondary",
  line: "text-content-muted group-data-[highlighted]:text-content group-data-[state=checked]:text-content-secondary",
  contrast: "text-card group-data-[state=checked]:text-card"
}

export interface SelectItemProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> {
  selectionVariant?: SelectItemSelectionVariant
}

export const SelectItem = React.forwardRef<React.ElementRef<typeof SelectPrimitive.Item>, SelectItemProps>(
  ({ className, children, selectionVariant = "menu", ...props }, ref) => (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        "group relative flex w-full cursor-default select-none items-center rounded-md border border-transparent py-2 pl-8 pr-2.5 text-sm text-content outline-none transition-[background-color,border-color,box-shadow,color] duration-150 data-[highlighted]:bg-surface-recessed data-[highlighted]:text-content data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        selectItemSelectionVariants[selectionVariant],
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "absolute left-2 flex size-4 items-center justify-center transition-[color,opacity] duration-150",
          selectItemIndicatorVariants[selectionVariant]
        )}
      >
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
)
SelectItem.displayName = SelectPrimitive.Item.displayName

export const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-stroke-soft", className)} {...props} />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName
