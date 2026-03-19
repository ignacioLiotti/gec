'use client';

import dynamic from "next/dynamic";
import Link from "next/link";
import { startTransition, useCallback, useEffect, useState } from "react";
import { ArrowRight, FileText, Table2 } from "lucide-react";
import MobileExcelPageClient from "./mobile-excel-page-client";
import { Button } from "@/components/ui/button";
import type { ExcelPageClientProps, ExcelPageObra } from "@/lib/excel/types";

const DesktopExcelPageClient = dynamic(() => import("./desktop-excel-page-client"), {
	loading: () => (
		<div className="min-h-full bg-[#fafafa] px-4 py-4 md:px-8 md:py-8">
			<div className="animate-pulse space-y-4 rounded-xl border border-[#ece7df] bg-white p-6 shadow-card">
				<div className="h-9 w-56 rounded bg-[#f3eee7]" />
				<div className="h-11 w-full rounded-lg bg-[#f6f2eb]" />
				<div className="h-[60vh] w-full rounded-xl bg-[#f6f2eb]" />
			</div>
		</div>
	),
});

const MOBILE_BREAKPOINT = 768;
const DESKTOP_PREVIEW_ROWS = 8;

type ResponsiveExcelPageClientProps = ExcelPageClientProps & {
	initialIsMobile: boolean;
};

const toText = (value: unknown) => (value ?? "").toString().trim();

const clampPercentage = (value: unknown) => {
	const parsed =
		typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
	const safeValue = Number.isFinite(parsed) ? parsed : 0;
	return Math.max(0, Math.min(100, safeValue));
};

function DesktopExcelPreview({
	obras,
	stats,
	onLoadInteractivePanel,
}: {
	obras: ExcelPageObra[];
	stats: ExcelPageClientProps["initialPreviewStats"];
	onLoadInteractivePanel: () => void;
}) {
	const previewRows = obras.slice(0, DESKTOP_PREVIEW_ROWS);

	return (
		<div className="min-h-full max-w-[calc(100vw-var(--sidebar-current-width))] bg-[#fafafa] px-4 py-4 md:px-8 md:py-8">
			<div className="space-y-5">
				<div className="rounded-[28px] border border-[#ece7df] bg-[#f6f2eb]/75 p-2 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_18px_45px_rgba(15,23,42,0.06)]">
					<div className="rounded-[24px] border border-[#f3eee7] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,250,250,0.96)_100%)] p-6 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset]">
						<div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
							<div className="max-w-2xl space-y-2">
								<div className="inline-flex items-center gap-2 rounded-full border border-[#ece7df] bg-white px-3 py-1 text-xs font-medium text-[#6f675f]">
									<Table2 className="h-3.5 w-3.5" />
									Carga diferida del panel interactivo
								</div>
								<div>
									<h1 className="text-3xl font-semibold tracking-tight text-[#1a1a1a] sm:text-4xl">
										Panel de obras
									</h1>
									<p className="mt-1 text-sm text-[#777]">
										La vista inicial evita hidratar la tabla completa en el primer render. Filtros,
										edicion e importacion se cargan cuando abras el panel interactivo.
									</p>
								</div>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<Button type="button" onClick={onLoadInteractivePanel} className="gap-2">
									Abrir panel interactivo
									<ArrowRight className="h-4 w-4" />
								</Button>
								<Button variant="outline" asChild>
									<Link href="/excel/reporte" prefetch={false} className="gap-2">
										<FileText className="h-4 w-4" />
										Generar reporte
									</Link>
								</Button>
							</div>
						</div>
						<div className="mt-5 grid gap-3 md:grid-cols-3">
							<div className="rounded-2xl border border-[#ece7df] bg-white px-4 py-3">
								<div className="text-xs uppercase tracking-[0.16em] text-[#999]">Obras</div>
								<div className="mt-1 text-2xl font-semibold text-[#1a1a1a]">
									{stats.totalCount.toLocaleString("es-AR")}
								</div>
							</div>
							<div className="rounded-2xl border border-[#ece7df] bg-white px-4 py-3">
								<div className="text-xs uppercase tracking-[0.16em] text-[#999]">Completadas</div>
								<div className="mt-1 text-2xl font-semibold text-[#1a1a1a]">
									{stats.completedCount.toLocaleString("es-AR")}
								</div>
							</div>
							<div className="rounded-2xl border border-[#ece7df] bg-white px-4 py-3">
								<div className="text-xs uppercase tracking-[0.16em] text-[#999]">Avance promedio</div>
								<div className="mt-1 text-2xl font-semibold text-[#1a1a1a]">
									{stats.averageProgress.toFixed(1)}%
								</div>
							</div>
						</div>
					</div>
				</div>

				<div className="overflow-hidden rounded-[28px] border border-[#ece7df] bg-white shadow-card">
					<div className="border-b border-[#f0ebe5] px-6 py-4">
						<h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#6f675f]">
							Primeras obras
						</h2>
					</div>
					<div className="divide-y divide-[#f0ebe5]">
						{previewRows.map((obra) => (
							<div
								key={obra.id}
								className="grid gap-3 px-6 py-4 md:grid-cols-[96px_minmax(0,1.4fr)_minmax(0,1fr)_140px]"
							>
								<div>
									<div className="text-xs uppercase tracking-[0.16em] text-[#999]">N</div>
									<div className="mt-1 text-sm font-semibold text-[#1a1a1a]">
										{obra.n ?? "-"}
									</div>
								</div>
								<div className="min-w-0">
									<div className="text-xs uppercase tracking-[0.16em] text-[#999]">Designacion</div>
									<div className="mt-1 truncate text-sm font-medium text-[#1a1a1a]">
										{toText(obra.designacionYUbicacion) || "Obra sin designacion"}
									</div>
								</div>
								<div className="min-w-0">
									<div className="text-xs uppercase tracking-[0.16em] text-[#999]">Entidad</div>
									<div className="mt-1 truncate text-sm text-[#5a5248]">
										{toText(obra.entidadContratante) || "-"}
									</div>
								</div>
								<div>
									<div className="text-xs uppercase tracking-[0.16em] text-[#999]">Avance</div>
									<div className="mt-2 h-2 rounded-full bg-[#f3eee7]">
										<div
											className="h-2 rounded-full bg-orange-primary"
											style={{ width: `${clampPercentage(obra.porcentaje)}%` }}
										/>
									</div>
									<div className="mt-1 text-right text-sm font-medium tabular-nums text-[#5a5248]">
										{clampPercentage(obra.porcentaje).toFixed(1)}%
									</div>
								</div>
							</div>
						))}
						{previewRows.length === 0 && (
							<div className="px-6 py-8 text-sm text-[#777]">No hay obras para mostrar.</div>
						)}
					</div>
					{stats.totalCount > previewRows.length && (
						<div className="border-t border-[#f0ebe5] px-6 py-4 text-sm text-[#777]">
							Mostrando {previewRows.length} de {stats.totalCount} obras. La tabla completa se carga bajo demanda.
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

export default function ExcelPageClient({
	initialMainTableColumnsConfig,
	initialObras,
	initialPreviewObras,
	initialPreviewStats,
	initialIsMobile,
}: ResponsiveExcelPageClientProps) {
	const [isMobile, setIsMobile] = useState(initialIsMobile);
	const [shouldLoadDesktop, setShouldLoadDesktop] = useState(false);

	const handleLoadDesktop = useCallback(() => {
		startTransition(() => {
			setShouldLoadDesktop(true);
		});
	}, []);

	useEffect(() => {
		const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
		const syncViewport = () => setIsMobile(mediaQuery.matches);
		syncViewport();
		mediaQuery.addEventListener("change", syncViewport);
		return () => mediaQuery.removeEventListener("change", syncViewport);
	}, []);

	if (isMobile) {
		return <MobileExcelPageClient initialObras={initialObras} />;
	}

	if (!shouldLoadDesktop) {
		return (
			<DesktopExcelPreview
				obras={initialPreviewObras}
				stats={initialPreviewStats}
				onLoadInteractivePanel={handleLoadDesktop}
			/>
		);
	}

	return (
		<DesktopExcelPageClient
			initialMainTableColumnsConfig={initialMainTableColumnsConfig}
			initialObras={initialObras}
		/>
	);
}
