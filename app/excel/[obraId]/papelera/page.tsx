import { Suspense } from "react";

import { TrashPageClient } from "./trash-page-client";

export default async function ObraTrashPage({
	params,
}: {
	params: Promise<{ obraId: string }>;
}) {
	const { obraId } = await params;

	return (
		<Suspense fallback={<div className="p-6 text-sm text-stone-500">Cargando papelera...</div>}>
			<TrashPageClient obraId={obraId} />
		</Suspense>
	);
}
