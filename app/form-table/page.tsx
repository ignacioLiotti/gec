'use client';

import {
	FormTable,
	FormTableContent,
	FormTablePagination,
	FormTableTabs,
	FormTableToolbar,
} from "@/components/form-table/form-table";
import { obrasDetalleConfig } from "@/components/form-table/configs/obras-detalle";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function FormTablePage() {
	return (
		<FormTable config={obrasDetalleConfig}>
			<TooltipProvider delayDuration={200}>
				<div className="space-y-4">
					<FormTableToolbar />
					<FormTableTabs />
					<FormTableContent className="max-w-[calc(98vw-var(--sidebar-current-width))] overflow-hidden" />
					<FormTablePagination />
				</div>
			</TooltipProvider>
		</FormTable>
	);
}
