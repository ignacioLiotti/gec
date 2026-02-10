"use client";

import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import type { FileSystemItem } from "../types";
import { FormTable } from "@/components/form-table/form-table";
import type { FormTableConfig, FormTableRow } from "@/components/form-table/types";

type DocumentDataSheetProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	document: FileSystemItem | null;
	tableConfig: FormTableConfig<FormTableRow, any> | null;
};

export function DocumentDataSheet({
	isOpen,
	onOpenChange,
	document,
	tableConfig,
}: DocumentDataSheetProps) {
	if (!document || !tableConfig) return null;

	return (
		<Sheet open={isOpen} onOpenChange={onOpenChange} modal={false}>
			<SheetContent
				showOverlay={false}
				onInteractOutside={(event) => {
					event.preventDefault();
				}}
				onPointerDownOutside={(event) => {
					event.preventDefault();
				}}
				className="flex h-[85vh] w-full sm:max-w-2xl flex-col gap-0 p-0 z-40  data-[state=closed]:![--tw-exit-translate-x:-60%] data-[state=open]:![--tw-enter-translate-x:-50%] border-l right-48 my-auto"
			>
				<SheetHeader className="border-b bg-stone-50 px-6 py-4">
					<SheetTitle className="text-base text-stone-800">
						Datos extraídos
					</SheetTitle>
					<SheetDescription className="text-xs uppercase tracking-wide text-stone-400">
						{document.name}
					</SheetDescription>
				</SheetHeader>
				<div className="flex-1 overflow-auto bg-white px-5">
					<FormTable
						config={tableConfig}
						variant="embedded"
						className="max-h-[45vh]"
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
}
