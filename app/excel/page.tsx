'use client';

import Link from "next/link";
import { FileText } from "lucide-react";
import {
	FormTable,
	FormTableContent,
	FormTablePagination,
	FormTableTabs,
	FormTableToolbar,
} from "@/components/form-table/form-table";
import { obrasDetalleConfig } from "@/components/form-table/configs/obras-detalle";
import { Button } from "@/components/ui/button";

export default function ExcelPage() {
	return (
		<div className="px-4 py-2">

			<FormTable config={obrasDetalleConfig}>
				<div className="space-y-1 relative">
					{/* <p className="text-sm uppercase tracking-wide text-orange-800/80 -mb-1">

					</p> */}
					<h1 className="text-3xl font-bold text-foreground mb-2">
						Panel de obras
					</h1>
					{/* <p className="text-sm text-slate-600">
						Filtrá, buscá y actualizá tus obras directamente desde esta vista.
					</p> */}

					<div className="w-full flex justify-between items-center gap-3 relative">
						<FormTableTabs className="justify-end w-full items-end" />
						<div className="flex items-center gap-2">
							<Button variant="outline" size="sm" asChild>
								<Link href="/excel/reporte" className="gap-2">
									<FileText className="h-4 w-4" />
									Generar Reporte
								</Link>
							</Button>
							<FormTableToolbar />
						</div>
					</div>
					<FormTableContent className="md:max-w-[calc(98vw-var(--sidebar-current-width))] " />
					<FormTablePagination />
				</div>
			</FormTable>
		</div>
	);
}
