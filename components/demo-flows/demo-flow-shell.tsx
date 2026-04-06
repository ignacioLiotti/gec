import Link from "next/link";
import { ArrowRight, Check, Clock } from "lucide-react";

import type { DemoFlowDefinition } from "@/lib/demo-flows/types";

export function DemoFlowShell({
	tenantName,
	flow,
}: {
	slug: string;
	tenantName: string;
	demoLabel: string;
	flow: DemoFlowDefinition;
}) {
	const primaryStep = flow.steps[0];

	return (
		<div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#fff7ed_0%,transparent_50%),linear-gradient(180deg,#fafaf9_0%,#f0eee9_100%)] flex items-center justify-center px-6 py-16">
			<div className="mx-auto w-full max-w-xl">
				{/* Badges */}
				<div className="mb-8 flex flex-wrap items-center gap-3">
					<div className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-700 shadow-sm">
						{flow.eyebrow ?? "Recorrido guiado"}
					</div>
					<div className="inline-flex items-center rounded-full border border-stone-200 bg-white px-4 py-1 text-xs font-medium text-stone-500 shadow-sm">
						{tenantName}
					</div>
				</div>

				{/* Main card */}
				<div className="rounded-[28px] border border-stone-200/80 bg-white p-10 shadow-[0_40px_100px_rgba(28,25,23,0.10)]">
					{/* Header */}
					<div className="space-y-4 pb-8 border-b border-stone-100">
						<h1 className="text-3xl font-semibold tracking-tight text-stone-950">
							{flow.title}
						</h1>
						<p className="text-[15px] leading-7 text-stone-500">
							{flow.description}
						</p>
					</div>

					{/* Features */}
					{flow.features && flow.features.length > 0 && (
						<div className="py-8 border-b border-stone-100 space-y-4">
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
								Lo que vas a ver
							</p>
							<ul className="space-y-3">
								{flow.features.map((feature, i) => (
									<li key={i} className="flex items-start gap-3">
										<span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100">
											<Check className="h-3 w-3 text-orange-600" strokeWidth={2.5} />
										</span>
										<span className="text-sm leading-6 text-stone-600">
											{feature}
										</span>
									</li>
								))}
							</ul>
						</div>
					)}

					{/* CTA */}
					{primaryStep && (
						<div className="pt-8 space-y-4">
							<Link
								href={primaryStep.href}
								className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-stone-800 active:bg-stone-950"
							>
								{primaryStep.ctaLabel}
								<ArrowRight className="h-4 w-4" />
							</Link>
							<p className="flex items-center justify-center gap-1.5 text-xs text-stone-400">
								<Clock className="h-3.5 w-3.5" />
								Duración estimada: 5 minutos
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
