"use client";

import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import type { ReactNode } from "react";
import type { FileSystemItem } from "../types";
import { FormTable } from "@/components/form-table/form-table";
import type { FormTableConfig, FormTableRow } from "@/components/form-table/types";

type DocumentDataSheetProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	document: FileSystemItem | null;
	tableConfig: FormTableConfig<FormTableRow, any> | null;
	dataTableSelector?: ReactNode;
};

export function DocumentDataSheet({
	isOpen,
	onOpenChange,
	document,
	tableConfig,
	dataTableSelector,
}: DocumentDataSheetProps) {
	if (!document || !tableConfig) return null;

	return (
		<Sheet open={isOpen} onOpenChange={onOpenChange} modal={false}>
			<SheetContent
				side="right"
				showOverlay={false}
				onInteractOutside={(event) => {
					event.preventDefault();
				}}
				onPointerDownOutside={(event) => {
					event.preventDefault();
				}}
				className="z-[60] flex flex-col gap-0 p-0 border-l
					!inset-auto !right-auto !bottom-auto
					!left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2
					h-[100dvh] sm:h-[88dvh] w-[100vw] sm:w-[96vw] lg:w-[92vw] max-w-[100vw] sm:max-w-xl lg:max-w-2xl
					origin-left
					data-[state=open]:slide-in-from-right-0 data-[state=closed]:slide-out-to-right-0
					data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95
					xl:!left-[52%] xl:!-translate-x-0 xl:w-[38rem] xl:max-w-[38rem]
					2xl:!left-[52.5%] 2xl:!-translate-x-0 2xl:w-[42rem] 2xl:max-w-[42rem]"
			>
				<SheetHeader className="border-b bg-stone-50 px-3 sm:px-6 py-3 sm:py-4">
					<div className="mr-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
						<SheetTitle className="text-base text-stone-800">
							Datos extraídos
						</SheetTitle>
						{dataTableSelector}
					</div>
					<SheetDescription className="text-xs uppercase tracking-wide text-stone-400">
						{document.name}
					</SheetDescription>
				</SheetHeader>
				<div className="flex-1 overflow-auto bg-white px-3 sm:px-5">
					<FormTable
						config={tableConfig}
						variant="embedded"
						className="max-h-[62dvh] sm:max-h-[56dvh] xl:max-h-[52dvh]"
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
}
