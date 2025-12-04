import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

type RouteContext = {
	params: Promise<{ id: string; tablaId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
	const { id: obraId, tablaId } = await context.params;

	if (!obraId || !tablaId) {
		return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
	}

	try {
		const supabase = await createClient();

		// Fetch document processing records for this tabla
		const { data: documents, error } = await supabase
			.from("ocr_document_processing")
			.select(
				"id, source_bucket, source_path, source_file_name, status, error_message, rows_extracted, processed_at, processing_duration_ms, retry_count, created_at"
			)
			.eq("tabla_id", tablaId)
			.eq("obra_id", obraId)
			.order("created_at", { ascending: false });

		if (error) throw error;

		return NextResponse.json({ documents: documents ?? [] });
	} catch (error) {
		console.error("[tabla-documents:get]", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error loading documents" },
			{ status: 500 }
		);
	}
}

export async function POST(request: Request, context: RouteContext) {
	const { id: obraId, tablaId } = await context.params;

	if (!obraId || !tablaId) {
		return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
	}

	try {
		const body = await request.json().catch(() => ({}));
		const action = body.action as string;
		const documentId = typeof body.documentId === "string" ? body.documentId : null;

		const supabase = await createClient();

		if (action === "retry" && documentId) {
			// Reset document status for retry
			const { data: doc, error: fetchError } = await supabase
				.from("ocr_document_processing")
				.select("id, source_bucket, source_path, source_file_name, retry_count")
				.eq("id", documentId)
				.eq("tabla_id", tablaId)
				.single();

			if (fetchError || !doc) {
				return NextResponse.json({ error: "Document not found" }, { status: 404 });
			}

			// Update status to pending for retry
			const { error: updateError } = await supabase
				.from("ocr_document_processing")
				.update({
					status: "pending",
					error_message: null,
					retry_count: (doc.retry_count || 0) + 1,
				})
				.eq("id", documentId);

			if (updateError) throw updateError;

			// Trigger OCR processing (this would be done via a background job in production)
			// For now, we'll just return success and the user can manually trigger
			return NextResponse.json({ ok: true, action: "retry_queued" });
		}

		return NextResponse.json({ error: "Invalid action" }, { status: 400 });
	} catch (error) {
		console.error("[tabla-documents:post]", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error processing action" },
			{ status: 500 }
		);
	}
}



