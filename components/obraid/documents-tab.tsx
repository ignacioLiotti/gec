'use client';

import { TabsContent } from "@/components/ui/tabs";
import { FileManager } from "@/components/obras/file-manager";

import type { MaterialOrder } from "./types";

type DocumentsTabProps = {
	obraId?: string;
	materialOrders: MaterialOrder[];
	refreshMaterialOrders: () => void | Promise<void>;
};

export function ObraDocumentsTab({ obraId, materialOrders, refreshMaterialOrders }: DocumentsTabProps) {
	return (
		<TabsContent value="documentos" className="space-y-6">
			<FileManager
				obraId={String(obraId)}
				materialOrders={materialOrders}
				onRefreshMaterials={refreshMaterialOrders}
			/>
		</TabsContent>
	);
}

