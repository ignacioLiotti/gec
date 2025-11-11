'use client';

import { forwardRef, InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface CustomInputProps extends InputHTMLAttributes<HTMLInputElement> {
	variant?: "default" | "cammo" | "show-empty";
}

export const CustomInput = forwardRef<HTMLInputElement, CustomInputProps>(
	({ className, type, variant = "default", ...props }, ref) => {
		const baseStyles =
			"w-full font-mono text-base bg-transparent border-none outline-none px-0 focus:ring-0 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-primary";

		const variantStyles: Record<NonNullable<CustomInputProps["variant"]>, string> =
		{
			default: "border-b border-[#e5e7eb] focus:border-black transition-colors",
			cammo: "bg-transparent border-none outline-none shadow-none",
			"show-empty": cn(
				"border-b border-[#e5e7eb] focus:border-black transition-colors",
				!props.value && "bg-dashedInput",
			),
		};

		return (
			<input
				type={type}
				ref={ref}
				className={cn(baseStyles, variantStyles[variant], className)}
				{...props}
			/>
		);
	},
);
CustomInput.displayName = "CustomInput";


