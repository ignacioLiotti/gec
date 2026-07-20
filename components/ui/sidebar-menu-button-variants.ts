import { cva } from "class-variance-authority";

const sidebarMenuButtonVariants = cva(
	"peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-lg px-3 text-left text-sm outline-none transition-[width,height,padding,gap,color,background-color,box-shadow,transform,filter] duration-[600ms] ease-[cubic-bezier(0.3,0.7,0.4,1)] leading-normal cursor-pointer will-change-transform " +
		"border border-transparent " +
		"[background-origin:border-box] [background-clip:padding-box,border-box] " +
		"[background-image:linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.01)_100%),linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.03)_100%)] " +
		"text-muted-foreground " +
		"data-[active=true]:text-foreground " +
		"data-[active=true]:bg-white data-[active=true]:shadow-[0_1px_0_0_#fff_inset,0_-1px_0_0_#0000001f_inset,0_0_0_1px_#00000012,0_2px_2px_0_#0b090c0d,0_1px_1px_0_#0b090c0f,0_5px_8px_-7px_#0b090c08] " +
		" data-[active=true]:hover:brightness-[1.02] data-[active=true]:hover:duration-[250ms] data-[active=true]:hover:ease-[cubic-bezier(0.3,0.7,0.4,1.5)] data-[active=true]:hover:shadow-[0_1px_0_0_#fff_inset,0_-1px_0_0_#0000001f_inset,0_0_0_1px_#00000012,0_3px_2px_0_#0b090c0d,0_2px_1px_0_#0b090c0f,0_8px_12px_-10px_#0b090c14] " +
		"active:translate-y-px active:duration-[34ms] active:ease-linear " +
		"data-[active=true]:active:translate-y-[1px] data-[active=true]:active:shadow-[0_1px_0_0_#fff_inset,0_0px_0_0_#0000001f_inset,0_0_0_1px_#00000012,0_1px_1px_0_#0b090c0f,0_3px_6px_-6px_#0b090c14] " +
		"disabled:pointer-events-none disabled:opacity-50 " +
		"aria-disabled:pointer-events-none aria-disabled:opacity-50 " +
		"group-data-[collapsible=icon]:h-(--sidebar-menu-button-height)! group-data-[collapsible=icon]:w-8! group-data-[collapsible=icon]:gap-0! group-data-[collapsible=icon]:p-2! " +
		"[--sidebar-menu-label-duration:200ms] group-data-[collapsible=icon]:[--sidebar-menu-label-duration:300ms] motion-reduce:[--sidebar-menu-label-duration:0ms] [&>span:last-child]:min-w-0 [&>span:last-child]:truncate [&>span:last-child]:transition-[opacity,transform] [&>span:last-child]:duration-(--sidebar-menu-label-duration) [&>span:last-child]:ease-(--sidebar-motion-ease) group-data-[collapsible=icon]:[&>span:last-child]:-translate-x-1 group-data-[collapsible=icon]:[&>span:last-child]:opacity-0 [&>svg]:size-4 [&>svg]:shrink-0",
	{
		variants: {
			variant: {
				default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
			},
			size: {
				default:
					"h-9 sm:h-8 [--sidebar-menu-button-height:2.25rem] sm:[--sidebar-menu-button-height:2rem]",
				sm: "h-8 text-sm sm:h-7 sm:text-xs [--sidebar-menu-button-height:2rem] sm:[--sidebar-menu-button-height:1.75rem]",
				lg: "h-12 text-base sm:text-sm [--sidebar-menu-button-height:3rem] group-data-[collapsible=icon]:p-0!",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

export { sidebarMenuButtonVariants };
