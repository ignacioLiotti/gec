import { cn } from "@/lib/utils";

export function DocumentThumbnail({ variant }: { variant: number }) {
	const isCurve = variant === 12 || variant === 13;

	return (
		<div className="flex h-full flex-col bg-white px-2 py-2 text-stone-700">
			<div className="mx-auto h-1 w-8 bg-stone-300" />
			<div className="mx-auto mt-1 h-0.5 w-12 bg-stone-200" />
			{isCurve ? (
				<div className="relative mt-4 flex-1 overflow-hidden border border-stone-200 bg-[linear-gradient(to_right,#e7e5e4_1px,transparent_1px),linear-gradient(to_bottom,#e7e5e4_1px,transparent_1px)] bg-[size:8px_8px]">
					<svg viewBox="0 0 100 54" className="absolute inset-x-1 bottom-2 h-[58%] w-[calc(100%-8px)]" aria-hidden="true">
						<path d="M3 47 C24 46 42 38 56 30 S78 12 97 6" fill="none" stroke="#fb5a0a" strokeWidth="2" />
						<path d="M3 48 C30 47 54 45 73 32 S88 18 97 15" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 2" />
					</svg>
				</div>
			) : (
				<div className="mt-3 flex-1 border border-stone-300">
					<div className="grid h-full grid-cols-4 grid-rows-7">
						{Array.from({ length: 28 }).map((_, index) => (
							<span key={index} className={cn("border-b border-r border-stone-200", index < 4 && "bg-stone-100", index % 9 === 0 && "bg-stone-50")} />
						))}
					</div>
				</div>
			)}
			<div className="mt-2 space-y-1">
				<div className="h-0.5 w-full bg-stone-200" />
				<div className="h-0.5 w-3/4 bg-stone-200" />
			</div>
		</div>
	);
}
