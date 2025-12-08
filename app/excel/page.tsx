'use client';

import {
	FormTable,
	FormTableContent,
	FormTablePagination,
	FormTableTabs,
	FormTableToolbar,
} from "@/components/form-table/form-table";
import { obrasDetalleConfig } from "@/components/form-table/configs/obras-detalle";

export default function ExcelPage() {
	return (
		<FormTable config={obrasDetalleConfig}>
			<div className="space-y-6">
				<div className="rounded-3xl bg-gradient-to-r from-orange-500/80 via-orange-400/70 to-amber-400/70 p-px shadow-lg">
					<div className="space-y-3 rounded-[calc(1.5rem-1px)] bg-white/90 px-6 py-6 backdrop-blur">
						<p className="text-sm uppercase tracking-wide text-orange-800/80">
							Panel de obras
						</p>
						<h1 className="text-3xl font-semibold text-slate-900">
							Seguimiento general
						</h1>
						<p className="text-sm text-slate-600">
							Filtrá, buscá y actualizá tus obras directamente desde esta vista.
						</p>
					</div>
				</div>

				<FormTableToolbar />
				<FormTableTabs />
				<FormTableContent className=" max-w-[calc(98vw-var(--sidebar-current-width))] " />
				<FormTablePagination />
			</div>
		</FormTable>
	);
}
