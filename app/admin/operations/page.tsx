import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseOperationsSelection } from "@/lib/admin/operations/selection";
import { loadOperationsSnapshot } from "@/lib/admin/operations/server";
import type { OperationsSnapshot } from "@/lib/admin/operations/types";
import { ApiValidationError } from "@/lib/http/validation";

import { OperationsClient } from "./operations-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Operaciones de plataforma" };

export default async function OperationsPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const query = await searchParams;
	const params = new URLSearchParams();
	for (const key of ["tenantId", "days"]) {
		const value = query[key];
		for (const item of Array.isArray(value) ? value : value ? [value] : []) {
			params.append(key, item);
		}
	}
	let snapshot: OperationsSnapshot;
	try {
		snapshot = await loadOperationsSnapshot(parseOperationsSelection(params));
	} catch (error) {
		const status = error instanceof ApiValidationError ? error.status : 503;
		const message = status === 403
			? "Esta consola requiere acceso de superadministrador."
			: status === 400
				? "El tenant o el período de la consulta no es válido."
				: status === 404
					? "No se encontró el tenant solicitado."
					: "No se pudo consultar la consola. Volvé a intentarlo más tarde.";
		return (
			<main className="p-3 sm:p-6">
				<Card>
					<CardHeader><CardTitle>Operaciones de plataforma</CardTitle></CardHeader>
					<CardContent className="space-y-4">
						<p className="text-sm text-content-muted" role="status">{message}</p>
						<Button asChild variant="outline"><Link href="/admin/operations">Volver a la consola</Link></Button>
					</CardContent>
				</Card>
			</main>
		);
	}
	return <main className="p-3 sm:p-6"><OperationsClient snapshot={snapshot} /></main>;
}
