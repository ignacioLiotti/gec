'use client';

import { Suspense, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { FileManager, type FileManagerSelectionChange } from "./file-manager/file-manager";
import { TabsContent } from "@/components/ui/tabs";

import type { MaterialOrder } from "./types";

type DocumentsTabProps = {
	obraId?: string;
	materialOrders: MaterialOrder[];
	refreshMaterialOrders: () => void | Promise<void>;
	recoveryRequestToken?: number;
};

function ObraDocumentsTabContent({
	obraId,
	materialOrders,
	refreshMaterialOrders,
	recoveryRequestToken = 0,
}: DocumentsTabProps) {
	const { replace } = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const queryParams = new URLSearchParams(searchParams);

	const folderParam = queryParams.get("folder") || null;
	const fileParam = queryParams.get("file") || null;

	const updateDocumentsQuery = useCallback(
		(patch: { folder?: string | null; file?: string | null }) => {
			const params = new URLSearchParams(searchParams?.toString?.() || "");
			params.set("tab", "documentos");

			if (!patch.folder) {
				params.delete("folder");
			} else {
				params.set("folder", patch.folder);
			}

			if (!patch.file) {
				params.delete("file");
			} else {
				params.set("file", patch.file);
			}

			const qs = params.toString();
			replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
		},
		[pathname, replace, searchParams]
	);

	const handleSelectionChange = useCallback(
		(selection: FileManagerSelectionChange) => {
			const folderValue = selection.folderPath.length ? selection.folderPath.join("/") : null;
			const fileValue = selection.documentPath.length ? selection.documentPath.join("/") : null;

			updateDocumentsQuery({ folder: folderValue, file: fileValue });
		},
		[updateDocumentsQuery]
	);

	return (
		<TabsContent value="documentos" className="space-y-6">
			<FileManager
				obraId={String(obraId)}
				materialOrders={materialOrders}
				onRefreshMaterials={refreshMaterialOrders}
				selectedFolderPath={folderParam}
				selectedFilePath={fileParam}
				onSelectionChange={handleSelectionChange}
				externalRecoveryRequestToken={recoveryRequestToken}
			/>
		</TabsContent>
	);
}

export function ObraDocumentsTab(props: DocumentsTabProps) {
	return (
		<Suspense
			fallback={
				<TabsContent value="documentos" className="space-y-6">
					<div className="h-[420px] animate-pulse rounded-lg border bg-stone-100" />
				</TabsContent>
			}
		>
			<ObraDocumentsTabContent {...props} />
		</Suspense>
	);
}
