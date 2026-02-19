import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type CleanupContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: CleanupContext) {
	const { id: obraId } = await context.params;
	if (!obraId) {
		return NextResponse.json({ error: "Parámetros incompletos" }, { status: 400 });
	}

	try {
		const body = await request.json().catch(() => ({}));
		const docPaths = Array.isArray(body?.docPaths)
			? body.docPaths.filter(
					(value: unknown): value is string =>
						typeof value === "string" && value.trim().length > 0,
				)
			: [];

		if (docPaths.length === 0) {
			return NextResponse.json({ ok: true, removed: { rows: 0, documents: 0 } });
		}

		const supabase = await createClient();
		const { data: tablas, error: tablasError } = await supabase
			.from("obra_tablas")
			.select("id")
			.eq("obra_id", obraId);
		if (tablasError) throw tablasError;

		const tablaIds = (tablas ?? [])
			.map((row) => (row as { id?: string }).id)
			.filter((id): id is string => typeof id === "string" && id.length > 0);

		if (tablaIds.length === 0) {
			return NextResponse.json({ ok: true, removed: { rows: 0, documents: 0 } });
		}

		let removedRows = 0;
		for (const docPath of docPaths) {
			const { data: deletedRows, error: rowsDeleteError } = await supabase
				.from("obra_tabla_rows")
				.delete()
				.in("tabla_id", tablaIds)
				.contains("data", { __docPath: docPath })
				.select("id");
			if (rowsDeleteError) throw rowsDeleteError;
			removedRows += deletedRows?.length ?? 0;
		}

		const { data: deletedDocs, error: docsDeleteError } = await supabase
			.from("ocr_document_processing")
			.delete()
			.eq("obra_id", obraId)
			.in("source_path", docPaths)
			.select("id");
		if (docsDeleteError) throw docsDeleteError;

		return NextResponse.json({
			ok: true,
			removed: {
				rows: removedRows,
				documents: deletedDocs?.length ?? 0,
			},
		});
	} catch (error) {
		console.error("[extracted-data:cleanup]", error);
		const message = error instanceof Error ? error.message : "Error limpiando datos";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
