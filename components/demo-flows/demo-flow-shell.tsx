import Link from "next/link";

import type { DemoFlowDefinition } from "@/lib/demo-flows/types";
import { Button } from "@/components/ui/button";

export function DemoFlowShell({
	slug,
	tenantName,
	demoLabel,
	flow,
}: {
	slug: string;
	tenantName: string;
	demoLabel: string;
	flow: DemoFlowDefinition;
}) {
	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff7ed,transparent_30%),linear-gradient(180deg,#fafaf9_0%,#f5f5f4_100%)] px-6 py-16 text-stone-900">
			<div className="mx-auto flex max-w-5xl flex-col gap-8">
				<div className="flex flex-wrap items-center gap-3">
					<div className="inline-flex items-center rounded-full border border-orange-200 bg-white px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">
						{flow.eyebrow ?? "Demo"}
					</div>
					<div className="inline-flex items-center rounded-full border border-stone-200 bg-white px-4 py-1 text-xs font-medium text-stone-600">
						{tenantName}
					</div>
				</div>

				<div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
					<section className="space-y-5 rounded-[28px] border border-stone-200 bg-white p-8 shadow-[0_30px_80px_rgba(28,25,23,0.08)]">
						<div className="space-y-3">
							<p className="text-sm font-medium uppercase tracking-[0.18em] text-stone-400">
								{demoLabel}
							</p>
							<h1 className="text-3xl font-semibold tracking-tight text-stone-950">
								{flow.title}
							</h1>
							<p className="max-w-2xl text-sm leading-6 text-stone-600">
								{flow.description}
							</p>
						</div>

						<div className="grid gap-4">
							{flow.steps.map((step, index) => (
								<div
									key={step.id}
									className="rounded-2xl border border-stone-200 bg-stone-50 p-5"
								>
									<div className="flex flex-wrap items-start justify-between gap-3">
										<div className="space-y-2">
											<p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
												Paso {index + 1}
											</p>
											<h2 className="text-lg font-semibold text-stone-950">
												{step.title}
											</h2>
											<p className="max-w-xl text-sm leading-6 text-stone-600">
												{step.description}
											</p>
										</div>
										<Button
											asChild
											className="bg-stone-900 text-white hover:bg-stone-800"
										>
											<Link href={step.href}>{step.ctaLabel}</Link>
										</Button>
									</div>
								</div>
							))}
						</div>
					</section>

					<aside className="space-y-4 rounded-[28px] border border-stone-200 bg-white p-8 shadow-[0_30px_80px_rgba(28,25,23,0.08)]">
						<div className="space-y-2">
							<h2 className="text-lg font-semibold text-stone-950">
								Como escalar esto
							</h2>
							<p className="text-sm leading-6 text-stone-600">
								Cada prospecto puede tener su propio flujo sin tocar las paginas
								base de Excel o Macro Tablas. La demo decide que flujo mostrar
								desde la configuracion del tenant.
							</p>
						</div>

						<div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm leading-6 text-stone-600">
							Los siguientes pasos pueden apuntar a rutas reales del producto o
							a pantallas demo especificas bajo <code>/demo/[slug]/flow/*</code>.
						</div>

						<Button asChild variant="outline" className="w-full">
							<Link href={`/demo/${encodeURIComponent(slug)}`}>
								Volver al acceso demo
							</Link>
						</Button>
					</aside>
				</div>
			</div>
		</div>
	);
}
