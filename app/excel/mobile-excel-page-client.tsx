'use client';

import Link from "next/link";
import { FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenantAdminStatus } from "@/hooks/use-tenant-admin-status";
import type { ExcelPageClientProps, ExcelPageObra } from "@/lib/excel/types";
import {
	ExcelInlineStatus,
	ExcelPageHeader,
	ExcelPageShell,
	ExcelPanel,
	ExcelProgressBar,
} from "./_components/excel-page-chrome";
import { clampPercentage, toText } from "./_components/excel-page-format";
import { usePartialObrasHydration } from "./_components/use-partial-obras-hydration";

type ObraListItem = {
	id: string;
	n?: number | null;
	designacionYUbicacion?: string | null;
	entidadContratante?: string | null;
	porcentaje?: number | null;
};

function mapObraToMobileObra(obra: ExcelPageObra): ObraListItem {
	return {
		id: obra.id,
		n: obra.n ?? null,
		designacionYUbicacion: obra.designacionYUbicacion ?? null,
		entidadContratante: obra.entidadContratante ?? null,
		porcentaje: obra.porcentaje ?? null,
	};
}

export default function MobileExcelPageClient({
	initialObras,
}: Pick<ExcelPageClientProps, "initialObras">) {
	const { isAdmin: isTenantAdmin } = useTenantAdminStatus();
	const { isHydrating, rows: obras } = usePartialObrasHydration<ObraListItem>({
		hydrateWhenEmpty: true,
		initialObras,
		logContext: "[excel/mobile] failed to hydrate rows",
		mapObra: mapObraToMobileObra,
	});
	const isLoading = initialObras.length === 0 && isHydrating;

	return (
		<ExcelPageShell className="flex-1 space-y-4 md:max-w-none md:px-4 md:py-4">
			<ExcelPanel className="p-4">
				<div className="space-y-4">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<ExcelPageHeader
							title="Panel de obras"
							description="Vista rápida y acceso a cada obra"
							size="mobile"
						/>
						<div className="flex flex-wrap items-center gap-2">
							<Button variant="outline" size="sm" asChild>
								<Link href="/excel/reporte" prefetch={false} className="gap-2">
									<FileText className="size-4" />
									Reporte
								</Link>
							</Button>
							{isTenantAdmin && (
								<Button variant="outline" size="sm" asChild>
									<Link href="/excel/papelera-obras" prefetch={false} className="gap-2">
										<Trash2 className="size-4" />
										Papelera
									</Link>
								</Button>
							)}
						</div>
					</div>
					{isLoading ? (
						<ExcelInlineStatus>
							Cargando obras&hellip;
						</ExcelInlineStatus>
					) : (
						<div className="grid grid-cols-1 gap-3">
							{obras.map((obra) => (
								<Link
									key={obra.id}
									href={`/excel/${obra.id}`}
									prefetch={false}
									className="rounded-md border border-stroke-soft bg-card p-4 shadow-card transition-colors hover:bg-surface-muted"
								>
									<div className="text-xs text-content-muted">#{obra.n ?? "-"}</div>
									<div className="text-base font-semibold text-content">
										{toText(obra.designacionYUbicacion) || "Obra"}
									</div>
									<div className="text-sm text-content-muted">{toText(obra.entidadContratante)}</div>
									<div className="mt-3">
										<div className="mb-1 flex items-center justify-between text-xs">
											<span className="text-content-muted">Avance</span>
											<span className="font-medium tabular-nums text-content-secondary">
												{clampPercentage(obra.porcentaje).toFixed(1)}%
											</span>
										</div>
										<ExcelProgressBar value={clampPercentage(obra.porcentaje)} />
									</div>
								</Link>
							))}
							{obras.length === 0 && (
								<ExcelInlineStatus>
									No hay obras para mostrar.
								</ExcelInlineStatus>
							)}
						</div>
					)}
				</div>
			</ExcelPanel>
		</ExcelPageShell>
	);
}
