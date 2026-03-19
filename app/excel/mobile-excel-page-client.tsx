'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExcelPageClientProps, ExcelPageObra } from "@/lib/excel/types";

type ObraListItem = {
	id: string;
	n?: number | null;
	designacionYUbicacion?: string | null;
	entidadContratante?: string | null;
	porcentaje?: number | null;
};

const DS = {
	page: "bg-[#fafafa]",
	frame: "rounded-[28px] border border-[#ece7df] bg-[#f6f2eb]/75 p-2 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_18px_45px_rgba(15,23,42,0.06)]",
	frameInner: "rounded-[24px] border border-[#f3eee7] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,250,250,0.96)_100%)] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset]",
};

const toolButtonClass =
	"gap-2 rounded-lg border-[#e8e1d8] bg-white px-3.5 text-[#5a5248] hover:bg-[#fcfaf7] hover:text-[#1f1a17]";

const toText = (value: unknown) => (value ?? "").toString().trim();

const clampPercentage = (value: unknown) => {
	const parsed =
		typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
	const safeValue = Number.isFinite(parsed) ? parsed : 0;
	return Math.max(0, Math.min(100, safeValue));
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

function Framed({
	className,
	innerClassName,
	children,
}: React.PropsWithChildren<{
	className?: string;
	innerClassName?: string;
}>) {
	return (
		<div className={cn(DS.frame, className)}>
			<div className={cn(DS.frameInner, innerClassName)}>{children}</div>
		</div>
	);
}

export default function MobileExcelPageClient({
	initialObras,
}: Pick<ExcelPageClientProps, "initialObras">) {
	const [obras, setObras] = useState<ObraListItem[]>(() =>
		initialObras.map(mapObraToMobileObra)
	);
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		if (initialObras.length > 0) return;
		let cancelled = false;

		const loadObras = async () => {
			try {
				setIsLoading(true);
				const response = await fetch("/api/obras", { cache: "no-store" });
				if (!response.ok) throw new Error("No se pudieron obtener las obras");
				const payload = await response.json();
				const nextObras = Array.isArray(payload.detalleObras)
					? (payload.detalleObras as ExcelPageObra[]).map(mapObraToMobileObra)
					: [];
				if (!cancelled) {
					setObras(nextObras);
				}
			} catch (error) {
				console.error(error);
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		};

		void loadObras();

		return () => {
			cancelled = true;
		};
	}, [initialObras]);

	return (
		<div className={cn("flex-1 space-y-4 px-4 py-4", DS.page)}>
			<Framed>
				<div className="space-y-4 p-4">
					<div className="flex items-center justify-between gap-2">
						<div>
							<h1 className="text-2xl font-semibold tracking-tight text-[#1a1a1a]">Panel de obras</h1>
							<p className="text-xs text-[#999]">Vista rápida y acceso a cada obra</p>
						</div>
						<Button variant="outline" size="sm" asChild className={toolButtonClass}>
							<Link href="/excel/reporte" prefetch={false} className="gap-2">
								<FileText className="h-4 w-4" />
								Reporte
							</Link>
						</Button>
					</div>
					{isLoading ? (
						<div className="rounded-xl border border-[#ece7df] bg-[#fcfaf7] px-3 py-2 text-sm text-[#999]">
							Cargando obras...
						</div>
					) : (
						<div className="grid grid-cols-1 gap-3">
							{obras.map((obra) => (
								<Link
									key={obra.id}
									href={`/excel/${obra.id}`}
									prefetch={false}
									className="rounded-2xl border border-[#ece7df] bg-white p-4 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_10px_24px_rgba(15,23,42,0.05)] transition-colors hover:bg-[#fffaf5]"
								>
									<div className="text-xs text-[#999]">#{obra.n ?? "-"}</div>
									<div className="text-base font-semibold text-[#1a1a1a]">
										{toText(obra.designacionYUbicacion) || "Obra"}
									</div>
									<div className="text-sm text-[#777]">{toText(obra.entidadContratante)}</div>
									<div className="mt-3">
										<div className="mb-1 flex items-center justify-between text-xs">
											<span className="text-[#999]">Avance</span>
											<span className="font-medium tabular-nums text-[#555]">
												{clampPercentage(obra.porcentaje).toFixed(1)}%
											</span>
										</div>
										<div className="h-2 rounded-full bg-[#f3eee7]">
											<div
												className="h-2 rounded-full bg-orange-primary"
												style={{ width: `${clampPercentage(obra.porcentaje)}%` }}
											/>
										</div>
									</div>
								</Link>
							))}
							{obras.length === 0 && (
								<div className="rounded-xl border border-[#ece7df] bg-[#fcfaf7] px-3 py-2 text-sm text-[#999]">
									No hay obras para mostrar.
								</div>
							)}
						</div>
					)}
				</div>
			</Framed>
		</div>
	);
}
