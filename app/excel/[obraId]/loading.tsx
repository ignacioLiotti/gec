function LoadingBlock({ className = "" }: { className?: string }) {
	return (
		<div
			className={[
				"animate-pulse rounded-xl border border-[#ece7df] bg-white/80",
				className,
			].join(" ")}
		/>
	);
}

export default function ObraDetailLoading() {
	return (
		<div className="flex-1 space-y-5 px-4 py-4 md:px-6">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				<div className="space-y-2">
					<LoadingBlock className="h-9 w-72 max-w-full" />
					<LoadingBlock className="h-4 w-48 max-w-full" />
				</div>
				<LoadingBlock className="h-11 w-full lg:w-[420px]" />
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				<LoadingBlock className="h-28" />
				<LoadingBlock className="h-28" />
				<LoadingBlock className="h-28" />
			</div>

			<div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
				<LoadingBlock className="h-[420px]" />
				<div className="space-y-4">
					<LoadingBlock className="h-[200px]" />
					<LoadingBlock className="h-[200px]" />
				</div>
			</div>
		</div>
	);
}
