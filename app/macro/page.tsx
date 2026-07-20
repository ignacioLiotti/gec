import { Suspense } from "react";

import MacroTablesPageClient from "./macro-page-client";

/**
 * Server shell for /macro. The interactive page lives in
 * `macro-page-client.tsx` (client component); this split follows the
 * `app/excel` pattern so server-side concerns (auth, initial data,
 * metadata) can be added here without touching the client tree.
 * The Suspense boundary is required because the client page reads
 * `useSearchParams`.
 */
export default function MacroTablesPage() {
	return (
		<Suspense fallback={null}>
			<MacroTablesPageClient />
		</Suspense>
	);
}
