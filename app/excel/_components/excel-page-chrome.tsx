import type { ComponentProps, CSSProperties, PropsWithChildren } from "react";
import { NotchTail } from "@/components/ui/notch-tail";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type DivProps = ComponentProps<"div">;

const notchStyle = {
	"--notch-bg": "hsl(var(--card))",
	"--notch-stroke": "hsl(var(--border-soft))",
} as CSSProperties;

export function ExcelPageShell({ className, ...props }: DivProps) {
	return (
		<div
			className={cn(
				"relative h-full min-h-0 w-full overflow-y-auto overflow-x-hidden bg-canvas px-3 py-4 text-content sm:px-4 md:max-w-[calc(100vw-var(--sidebar-current-width))] md:px-16 md:py-8",
				className,
			)}
			{...props}
		/>
	);
}

export function ExcelPageHeader({
	title,
	description,
	targetId,
	size = "desktop",
	className,
}: {
	title: string;
	description: string;
	targetId?: string;
	size?: "desktop" | "mobile";
	className?: string;
}) {
	return (
		<div data-wizard-target={targetId} className={className}>
			<h1
				className={cn(
					"font-semibold tracking-tight text-content",
					size === "desktop" ? "text-3xl sm:text-4xl" : "text-2xl",
				)}
			>
				{title}
			</h1>
			<p className={cn("text-content-muted", size === "desktop" ? "mt-1 text-sm" : "text-xs")}>
				{description}
			</p>
		</div>
	);
}

export function ExcelToolbarFrame({
	side,
	targetId,
	className,
	children,
}: PropsWithChildren<{
	side: "left" | "right";
	targetId?: string;
	className?: string;
}>) {
	return (
		<div
			data-wizard-target={targetId}
			className={cn(
				"relative z-10 flex min-w-0 items-center gap-2 rounded-xl border-b-0 bg-surface pt-2 px-3 shadow-[0_2px_0_0_#f7f7f7,0_1px_0_0_#fff_inset,0_0_0_1px_#e2e2e2]",
				side === "left" &&
				"overflow-x-auto pb-[2px] -mb-[2px] ml-[0px] xl:overflow-visible xl:rounded-b-none xl:rounded-r-none xl:border-b-0 xl:border-r-0",
				side === "right" &&
				"flex-wrap xl:mr-[0px] xl:justify-end xl:rounded-b-none xl:rounded-l-none xl:border-b-0 xl:border-l-0 xl:pb-[2px] xl:-mb-[2px]",
				className,
			)}
			style={notchStyle}
		>
			{side === "right" ? (
				<NotchTail side="left" className="-mb-[3px] pb-[3px] h-[47px] !hidden xl:!block" />
			) : null}
			{children}
			{side === "left" ? (
				<NotchTail side="right" className="z-10 -mb-[1px] pb-[3px] h-[49px] !hidden xl:!block" />
			) : null}
		</div>
	);
}

export function ExcelTableSurface({ className, ...props }: DivProps) {
	return (
		<div
			className={cn(
				"flex min-w-0 flex-col gap-4 rounded-lg  bg-surface p-2 pt-3 shadow-card  sm:p-4 sm:pt-3.5 xl:rounded-t-none",
				className,
			)}
			{...props}
		/>
	);
}




export function ExcelPanel({ className, ...props }: DivProps) {
	return (
		<div
			className={cn("rounded-lg border border-stroke-soft bg-surface shadow-card", className)}
			{...props}
		/>
	);
}

export function ExcelInlineStatus({ className, ...props }: DivProps) {
	return (
		<div
			className={cn(
				"rounded-lg border border-stroke-soft bg-surface-recessed px-3 py-2 text-sm text-content-muted",
				className,
			)}
			{...props}
		/>
	);
}

export function ExcelProgressBar({ value }: { value: number }) {
	return (
		<div className="h-2 rounded-full bg-surface-recessed">
			<div
				className="h-2 rounded-full bg-orange-primary"
				style={{ width: `${value}%` }}
			/>
		</div>
	);
}

export function ExcelPageSkeleton({
	tableRows = 8,
}: {
	tableRows?: number;
}) {
	return (
		<ExcelPageShell>
			<div className="space-y-5">
				<div className="space-y-2">
					<Skeleton className="h-9 w-56" />
					<Skeleton className="h-4 w-80 max-w-full" />
				</div>

				<div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
					<Skeleton className="h-14 w-full rounded-lg xl:max-w-[560px]" />
					<Skeleton className="h-14 w-full rounded-lg xl:max-w-[320px]" />
				</div>

				<ExcelTableSurface>
					<div className="grid grid-cols-6 gap-3 border-b border-stroke-soft pb-3">
						{Array.from({ length: 6 }).map((_, index) => (
							<Skeleton key={index} className="h-4" />
						))}
					</div>
					<div className="space-y-3">
						{Array.from({ length: tableRows }).map((_, index) => (
							<div key={index} className="grid grid-cols-6 gap-3">
								{Array.from({ length: 6 }).map((__, cellIndex) => (
									<Skeleton key={cellIndex} className="h-10 rounded-lg" />
								))}
							</div>
						))}
					</div>
				</ExcelTableSurface>
			</div>
		</ExcelPageShell>
	);
}
