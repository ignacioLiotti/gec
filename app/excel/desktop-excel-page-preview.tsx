'use client';

import dynamic from "next/dynamic";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Loader2, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { NotchTail } from "@/components/ui/notch-tail";
import { cn } from "@/lib/utils";
import type { ExcelPageClientProps, ExcelPageObra } from "@/lib/excel/types";
import type { WizardFlow } from "@/components/ui/contextual-wizard";
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

const toText = (value: unknown) => (value ?? "").toString().trim();

const clampPercentage = (value: unknown) => {
	const parsed =
		typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
	const safeValue = Number.isFinite(parsed) ? parsed : 0;
	return Math.max(0, Math.min(100, safeValue));
};

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
	const searchParams = useSearchParams();
	const guidedTourStage = getGuidedExcelStage(searchParams);
	const [rows, setRows] = useState<PreviewRow[]>(() => initialObras.map(mapObraToPreviewRow));
	const [isHydratingRows, setIsHydratingRows] = useState(false);
	const [searchValue, setSearchValue] = useState("");
	const deferredSearchValue = useDeferredValue(searchValue);

	useEffect(() => {
		setRows(initialObras.map(mapObraToPreviewRow));
	}, [initialObras]);

	useEffect(() => {
		if (!initialObras.some((obra) => obra.__isPartial === true)) return;
		let cancelled = false;
		let idleHandle: number | null = null;
		let timeoutHandle: ReturnType<typeof globalThis.setTimeout> | null = null;

		const hydrateRows = async () => {
			setIsHydratingRows(true);
			try {
				const response = await fetch("/api/obras", { cache: "no-store" });
				if (!response.ok) {
					throw new Error("No se pudieron obtener las obras");
				}
				const payload = await response.json();
				const nextRows = Array.isArray(payload.detalleObras)
					? (payload.detalleObras as ExcelPageObra[]).map(mapObraToPreviewRow)
					: [];
				if (!cancelled) {
					setRows(nextRows);
				}
			} catch (error) {
				console.error("[excel/preview] failed to hydrate rows", error);
			} finally {
				if (!cancelled) {
					setIsHydratingRows(false);
				}
			}
		};

		const scheduleHydration = () => {
			void hydrateRows();
		};

		if (typeof window !== "undefined" && "requestIdleCallback" in window) {
			idleHandle = window.requestIdleCallback(scheduleHydration, {
				timeout: 2000,
			});
		} else {
			timeoutHandle = globalThis.setTimeout(scheduleHydration, 250);
		}

		return () => {
			cancelled = true;
			if (idleHandle != null && typeof window !== "undefined" && "cancelIdleCallback" in window) {
				window.cancelIdleCallback(idleHandle);
			}
			if (timeoutHandle != null) {
				globalThis.clearTimeout(timeoutHandle);
			}
		};
	}, [initialObras]);

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
		<div className="relative min-h-full max-w-[calc(100vw-var(--sidebar-current-width))] bg-[#fafafa] px-4 py-4 md:px-8 md:py-8">
			<div className="relative space-y-5">
				<div className="flex flex-col gap-4">
					<div className="flex w-full flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
						<div data-wizard-target="excel-page-header">
							<h1 className="text-3xl font-semibold tracking-tight text-[#1a1a1a] sm:text-4xl">
								Panel de obras
							</h1>
							<p className="mt-1 text-sm text-[#999]">
								Vista rápida para navegar la cartera sin montar la planilla editable completa.
							</p>
						</div>
					</div>
				</div>

				<div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:justify-between xl:-mb-0">
					<div
						className="relative -ml-[1px] flex items-center gap-2 rounded-xl border border-[#09090b1f] bg-card p-2 pb-0 xl:rounded-r-none xl:rounded-b-none xl:border-r-0 xl:border-b-0"
						style={
							{
								"--notch-bg": "white",
								"--notch-stroke": "rgb(231 229 228)",
							} as React.CSSProperties
						}
					>
						<div className="relative ml-0.5 flex items-center gap-2">
							<Search className="pointer-events-none absolute left-2.5 top-2.5 z-10 size-4 text-muted-foreground" />
							<Input
								type="search"
								value={searchValue}
								onChange={(event) => setSearchValue(event.target.value)}
								placeholder="Buscar obra o entidad"
								className="h-9 w-64 rounded-lg border-[#e8e8e8] bg-white pl-9 text-sm"
							/>
						</div>
						{isHydratingRows ? (
							<div className="flex items-center gap-2 rounded-lg border border-[#ece7df] bg-[#fcfaf7] px-3 py-2 text-xs text-[#6b6258]">
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
								Completando datos…
							</div>
						) : null}
						<NotchTail side="right" className="z-100 mb-[1px] h-[45px] !hidden xl:!block" />
					</div>
					<div
						className="relative -mr-[1px] flex items-center gap-2 rounded-xl border border-[#09090b1f] bg-card p-2 pb-0 xl:justify-end xl:rounded-l-none xl:rounded-b-none xl:border-l-0 xl:border-b-0"
						style={
							{
								"--notch-bg": "white",
								"--notch-stroke": "rgb(231 229 228)",
							} as React.CSSProperties
						}
					>
						<NotchTail side="left" className="mb-[1px] h-[45px] !hidden xl:!block" />
						<Button variant="outline" asChild>
							<Link href="/excel/reporte" prefetch={false} className="gap-2">
								<FileText className="h-4 w-4" />
								Generar Reporte
							</Link>
						</Button>
					</div>
				</div>

				<div
					data-wizard-target="excel-page-table"
					className="flex flex-col gap-4 rounded-xl bg-card p-2.5 pt-3.5 shadow-card xl:rounded-t-none"
				>
					<div className="overflow-hidden rounded-lg border border-[#ece7df] bg-white shadow-card">
						<div className="overflow-x-auto">
							<table className="w-full min-w-[760px] table-fixed text-sm">
								<thead className="bg-[#fcfaf7] text-left text-xs font-semibold uppercase tracking-wide text-[#6b6258]">
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
													"border-t border-[#f0ebe5]",
													index % 2 === 0 ? "bg-white" : "bg-[#fcfaf7]",
												)}
											>
												<td className="px-4 py-3 font-mono tabular-nums text-[#6b6258]">
													{row.n ?? PLACEHOLDER}
												</td>
												<td className="px-4 py-3">
													<Link
														href={`/excel/${row.id}`}
														prefetch={false}
														data-wizard-target="excel-page-open-obra"
														className="font-medium text-[#1f1a17] hover:text-orange-primary"
														onMouseEnter={() => router.prefetch(`/excel/${row.id}`)}
													>
														{toText(row.designacionYUbicacion) || PLACEHOLDER}
													</Link>
												</td>
												<td className="px-4 py-3 text-[#6b6258]">
													{isPartial ? PLACEHOLDER : toText(row.entidadContratante) || PLACEHOLDER}
												</td>
												<td className="px-4 py-3 text-right font-mono tabular-nums text-[#6b6258]">
													{isPartial ? PLACEHOLDER : `${clampPercentage(row.porcentaje).toFixed(1)}%`}
												</td>
											</tr>
										);
									})}
									{visibleRows.length === 0 ? (
										<tr>
											<td colSpan={4} className="px-4 py-10 text-center text-sm text-[#8a7f71]">
												No hay obras que coincidan con la búsqueda.
											</td>
										</tr>
									) : null}
								</tbody>
							</table>
						</div>
					</div>

					<Separator className="bg-border" />

					<div className="flex flex-wrap items-center justify-between gap-3 px-3 pb-2 text-sm text-[#6b6258]">
						<p>
							Mostrando <span className="font-medium text-[#1f1a17]">{visibleRows.length}</span> de{" "}
							<span className="font-medium text-[#1f1a17]">{filteredRows.length}</span> obras
							{filteredRows.length > visibleRows.length ? " en esta vista rápida" : ""}.
						</p>
					</div>
				</div>

				{guidedExcelFlow ? (
					<ContextualWizard
						open
						onOpenChange={() => { }}
						flow={guidedExcelFlow}
						showCloseButton={false}
					/>
				) : null}
			</div>
		</div>
	);
}
