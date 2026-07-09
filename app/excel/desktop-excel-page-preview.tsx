'use client';

import dynamic from "next/dynamic";
import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Loader2, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ExcelPageClientProps, ExcelPageObra } from "@/lib/excel/types";
import type { WizardFlow } from "@/components/ui/contextual-wizard";
import {
	ExcelInlineStatus,
	ExcelPageShell,
	ExcelPanel,
	ExcelTableSurface,
	ExcelToolbarFrame,
} from "./_components/excel-page-chrome";
import { clampPercentage, toText } from "./_components/excel-page-format";
import { usePartialObrasHydration } from "./_components/use-partial-obras-hydration";
import {
	GUIDED_EXCEL_STAGES,
	getGuidedExcelStage,
	isGuidedExcelTour,
} from "@/lib/demo-tours/excel-guided-flow";

const ContextualWizard = dynamic(
	() =>
		import("@/components/ui/contextual-wizard").then((mod) => mod.ContextualWizard),
	{ loading: () => null },
);

type PreviewRow = {
	id: string;
	n?: number | null;
	designacionYUbicacion?: string | null;
	entidadContratante?: string | null;
	porcentaje?: number | null;
	__isPartial?: boolean | null;
};

const PLACEHOLDER = "…";

const mapObraToPreviewRow = (obra: ExcelPageObra): PreviewRow => ({
	id: obra.id,
	n: obra.n ?? null,
	designacionYUbicacion: obra.designacionYUbicacion ?? null,
	entidadContratante: obra.entidadContratante ?? null,
	porcentaje: obra.porcentaje ?? null,
	__isPartial: obra.__isPartial ?? false,
});

export default function DesktopExcelPagePreview({
	initialObras,
}: ExcelPageClientProps) {
	const router = useRouter();
	const { prefetch } = router;
	const searchParams = useSearchParams();
	const guidedTourStage = getGuidedExcelStage(searchParams);
	const { isHydrating: isHydratingRows, rows } =
		usePartialObrasHydration<PreviewRow>({
			initialObras,
			logContext: "[excel/preview] failed to hydrate rows",
			mapObra: mapObraToPreviewRow,
			schedule: "idle",
		});
	const [searchValue, setSearchValue] = useState("");
	const deferredSearchValue = useDeferredValue(searchValue);

	const guidedExcelFlow = useMemo<WizardFlow | null>(() => {
		if (!isGuidedExcelTour(searchParams) || guidedTourStage !== GUIDED_EXCEL_STAGES.excelIntro) {
			return null;
		}

		return {
			id: "guided-excel-landing-preview",
			title: "Recorrido guiado",
			steps: [
				{
					id: "header",
					targetId: "excel-page-header",
					title: "Tu cartera de obras",
					content:
						"Esta vista prioriza mostrarte los nombres primero y completar el resto de los datos después.",
					placement: "bottom",
					skippable: false,
				},
				{
					id: "table",
					targetId: "excel-page-table",
					title: "Vista rápida",
					content:
						"Acá ves una tabla liviana para navegar la cartera sin montar la planilla editable completa.",
					placement: "top",
					skippable: false,
				},
				{
					id: "open-obra",
					targetId: "excel-page-open-obra",
					title: "Abrí el detalle",
					content:
						"Hacé clic en el nombre de la obra para ir al detalle completo con edición y documentos.",
					placement: "right",
					allowClickThrough: true,
					requiredAction: "click_target",
					waitForMs: 2200,
					skippable: false,
				},
			],
		};
	}, [guidedTourStage, searchParams]);

	const filteredRows = useMemo(() => {
		const query = deferredSearchValue.trim().toLowerCase();
		if (!query) return rows;
		return rows.filter((row) => {
			const haystack = [
				row.n == null ? "" : String(row.n),
				toText(row.designacionYUbicacion),
				toText(row.entidadContratante),
			]
				.join(" ")
				.toLowerCase();
			return haystack.includes(query);
		});
	}, [deferredSearchValue, rows]);

	const visibleRows = filteredRows.slice(0, 100);

	return (
		<ExcelPageShell>
			<div className="relative space-y-5">
				<div className="flex flex-col gap-4">
					<div className="flex w-full flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
						<div data-wizard-target="excel-page-header">
							<h1 className="text-3xl font-semibold tracking-tight text-content sm:text-4xl">
								Panel de obras
							</h1>
							<p className="mt-1 text-sm text-content-muted">
								Vista rápida para navegar la cartera sin montar la planilla editable completa.
							</p>
						</div>
					</div>
				</div>

				<div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:justify-between xl:-mb-0">
					<ExcelToolbarFrame side="left">
						<div className="relative ml-0.5 flex items-center gap-2">
							<Search className="pointer-events-none absolute left-2.5 top-2.5 z-10 size-4 text-content-muted" />
							<Input
								type="search"
								value={searchValue}
								onChange={(event) => setSearchValue(event.target.value)}
								placeholder="Buscar obra o entidad"
								className="h-9 w-64 rounded-lg bg-surface pl-9 text-sm"
							/>
						</div>
						{isHydratingRows ? (
							<ExcelInlineStatus className="flex items-center gap-2 text-xs">
								<Loader2 className="size-3.5 animate-spin" />
								Completando datos…
							</ExcelInlineStatus>
						) : null}
					</ExcelToolbarFrame>
					<ExcelToolbarFrame side="right">
						<Button variant="outline" asChild>
							<Link href="/excel/reporte" prefetch={false} className="gap-2">
								<FileText className="size-4" />
								Generar Reporte
							</Link>
						</Button>
					</ExcelToolbarFrame>
				</div>

				<ExcelTableSurface data-wizard-target="excel-page-table">
					<ExcelPanel className="overflow-hidden">
						<div className="overflow-x-auto">
							<table className="w-full min-w-[760px] table-fixed text-sm">
								<thead className="bg-surface-recessed text-left text-xs font-semibold uppercase tracking-wide text-content-muted">
									<tr>
										<th className="px-4 py-3">N°</th>
										<th className="px-4 py-3">Designación y ubicación</th>
										<th className="px-4 py-3">Entidad</th>
										<th className="px-4 py-3 text-right">% avance</th>
									</tr>
								</thead>
								<tbody>
									{visibleRows.map((row, index) => {
										const isPartial = row.__isPartial === true;
										return (
											<tr
												key={row.id}
												className={cn(
													"border-t border-stroke-soft",
													index % 2 === 0 ? "bg-surface" : "bg-table-row-alt",
												)}
											>
												<td className="px-4 py-3 font-mono tabular-nums text-content-muted">
													{row.n ?? PLACEHOLDER}
												</td>
												<td className="px-4 py-3">
													<Link
														href={`/excel/${row.id}`}
														prefetch={false}
														data-wizard-target="excel-page-open-obra"
														className="font-medium text-content transition-colors hover:text-orange-primary"
														onMouseEnter={() => prefetch(`/excel/${row.id}`)}
													>
														{toText(row.designacionYUbicacion) || PLACEHOLDER}
													</Link>
												</td>
												<td className="px-4 py-3 text-content-muted">
													{isPartial ? PLACEHOLDER : toText(row.entidadContratante) || PLACEHOLDER}
												</td>
												<td className="px-4 py-3 text-right font-mono tabular-nums text-content-muted">
													{isPartial ? PLACEHOLDER : `${clampPercentage(row.porcentaje).toFixed(1)}%`}
												</td>
											</tr>
										);
									})}
									{visibleRows.length === 0 ? (
										<tr>
											<td colSpan={4} className="px-4 py-10 text-center text-sm text-content-muted">
												No hay obras que coincidan con la búsqueda.
											</td>
										</tr>
									) : null}
								</tbody>
							</table>
						</div>
					</ExcelPanel>

					<Separator className="bg-stroke-soft" />

					<div className="flex flex-wrap items-center justify-between gap-3 px-3 pb-2 text-sm text-content-muted">
						<p>
							Mostrando <span className="font-medium text-content">{visibleRows.length}</span> de{" "}
							<span className="font-medium text-content">{filteredRows.length}</span> obras
							{filteredRows.length > visibleRows.length ? " en esta vista rápida" : ""}.
						</p>
					</div>
				</ExcelTableSurface>

				{guidedExcelFlow ? (
					<ContextualWizard
						open
						onOpenChange={() => { }}
						flow={guidedExcelFlow}
						showCloseButton={false}
					/>
				) : null}
			</div>
		</ExcelPageShell>
	);
}
