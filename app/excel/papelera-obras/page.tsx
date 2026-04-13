import { Suspense } from "react";

import { ObrasTrashPageClient } from "./trash-page-client";

export default function ObrasTrashPage() {
	return (
		<Suspense fallback={<div className="p-6 text-sm text-stone-500">Cargando papelera de obras...</div>}>
			<ObrasTrashPageClient />
		</Suspense>
	);
}
