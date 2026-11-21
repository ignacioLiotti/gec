// MIT source: https://github.com/slev12397/beautiful-ui/blob/06557d7ff33a1eb70d5987bae9ac4c70fa0e20c4/components/atoms/Button.tsx
// Adaptations: import isolation and Sintesis visual token mapping. See ../../LICENSE.
"use client";

import { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const filledShadow = "shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]";

/* Pill-shaped by default — the app's core button style. Explicit symmetric
 * padding (not a fixed height) so the top/bottom spacing is always equal. */
export const buttonVariants = cva(
  `inline-flex items-center justify-center font-medium select-none
   transition-[transform,background-color,opacity] duration-150 ease-out
   active:scale-[0.96] disabled:opacity-50 disabled:pointer-events-none`,
  {
    variants: {
      variant: {
        primary: `bg-[var(--mr-ink)] text-[var(--mr-canvas)] hover:opacity-90 dark:bg-[var(--mr-ink)] dark:text-[var(--mr-canvas)] ${filledShadow}`,
        secondary: "bg-[var(--mr-surface)] text-[var(--mr-ink)] shadow-btn hover:bg-[var(--mr-inset)] aria-expanded:bg-[var(--mr-hover)]",
        ghost: "bg-[var(--mr-hover-2)] text-[var(--mr-ink)] hover:bg-[var(--mr-line-strong)]",
        accent: `bg-[var(--mr-accent)] text-white hover:bg-[var(--mr-accent-ink)] ${filledShadow}`,
        success: `bg-[var(--mr-green)] text-white hover:brightness-95 ${filledShadow}`,
        /* transparent until hovered — for dense toolbars/action rows */
        quiet: "text-[var(--mr-ink)] hover:bg-[var(--mr-hover)]",
      },
      size: {
        /* compact toolbar pill — fixed height, lighter weight */
        xs: "h-7 rounded-full px-2.5 text-[12px] font-normal leading-none gap-1",
        /* canonical action pill — 27px tall, roomy sides */
        sm: "h-[27px] px-3 text-[13px] leading-none rounded-full gap-1.5",
        md: "px-4 py-[9px] text-sm leading-none rounded-full gap-2",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;

export function Button({
  variant,
  size,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
