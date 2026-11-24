import { NextResponse } from "next/server";

import {
	hasDemoCapability,
	resolveRequestAccessContext,
} from "@/lib/demo-session";
import { normalizeFolderPath } from "@/lib/tablas";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

const DOCUMENTS_BUCKET = "obra-documents";

type RouteContext = {
	params: Promise<{ id: string }>;
};

function isStorageObjectMissing(message: string | null | undefined) {
	return typeof message === "string" && /object not found/i.test(message);
}

export async function GET(request: Request, context: RouteContext) {
	const { id: obraId } = await context.params;
	if (!obraId) {
		return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });
	}

	try {
		const url = new URL(request.url);
		const storagePath = url.searchParams.get("path")?.trim() ?? "";
		const download =
			url.searchParams.get("download") === "1" ||
			url.searchParams.get("download") === "true";
		const thumbnail = url.searchParams.get("thumbnail") === "1";
		const expiresInRaw = Number(url.searchParams.get("expiresIn") ?? 3600);
		const expiresIn = Number.isFinite(expiresInRaw)
			? Math.min(24 * 60 * 60, Math.max(60, Math.trunc(expiresInRaw)))
			: 3600;

		if (!storagePath || !storagePath.startsWith(`${obraId}/`)) {
			return NextResponse.json(
				{ error: "Ruta de documento invalida" },
				{ status: 400 },
			);
		}

		const access = await resolveRequestAccessContext();
		const { supabase, user, tenantId, actorType } = access;
		if (!user && actorType !== "demo") {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		if (actorType === "demo" && !hasDemoCapability(access.demoSession, "excel")) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}
		if (!tenantId) {
			return NextResponse.json({ error: "No tenant" }, { status: 400 });
		}

		const { data: obra, error: obraError } = await supabase
			.from("obras")
			.select("obra_document_deletes(storage_path, item_type)")
			.eq("id", obraId)
			.eq("tenant_id", tenantId)
			.is("deleted_at", null)
			.eq("obra_document_deletes.tenant_id", tenantId)
			.is("obra_document_deletes.restored_at", null)
			.maybeSingle();
		if (obraError) throw obraError;
		if (!obra) {
			return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
		}

		const legacyNormalizedStoragePath = normalizeFolderPath(storagePath);
		const blocked = (obra.obra_document_deletes ?? []).some((row) => {
			const deletedPath =
				typeof row.storage_path === "string" ? row.storage_path : "";
			if (!deletedPath) return false;
			if (row.item_type === "folder") {
				return (
					storagePath === deletedPath ||
					storagePath.startsWith(`${deletedPath}/`) ||
					legacyNormalizedStoragePath === deletedPath ||
					legacyNormalizedStoragePath.startsWith(`${deletedPath}/`)
				);
			}
			return (
				storagePath === deletedPath ||
				legacyNormalizedStoragePath === deletedPath
			);
		});
		if (blocked) {
			return NextResponse.json(
				{ error: "Documento eliminado o fuera de la ventana de recuperación." },
				{ status: 404 },
			);
		}

		const storageClient = createSupabaseAdminClient();
		const { data: rejectedGeneratedDocument, error: rejectedGeneratedDocumentError } =
			await storageClient
				.from("generated_documents")
				.select("id")
				.eq("tenant_id", tenantId)
				.eq("obra_id", obraId)
				.eq("storage_bucket", DOCUMENTS_BUCKET)
				.eq("storage_path", storagePath)
				.eq("status", "REJECTED")
				.maybeSingle();
		if (rejectedGeneratedDocumentError) throw rejectedGeneratedDocumentError;
		if (rejectedGeneratedDocument) {
			return NextResponse.json(
				{ error: "No se puede descargar un documento rechazado." },
				{ status: 403 },
			);
		}

		if (thumbnail && !download) {
			const { loadDocumentCover } = await import("@/lib/document-thumbnail-server");
			const cover = await loadDocumentCover(storageClient.storage, tenantId, DOCUMENTS_BUCKET, storagePath);
			return new NextResponse(cover, {
				status: cover ? 200 : 204,
				headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
			});
		}

		if (download) {
			const { data, error } = await storageClient.storage
				.from(DOCUMENTS_BUCKET)
				.download(storagePath);
			if (error || !data) {
				if (isStorageObjectMissing(error?.message)) {
					return NextResponse.json(
						{
							error:
								"El documento figura en metadata pero el archivo ya no existe en Storage.",
							code: "DOCUMENT_STORAGE_MISSING",
						},
						{ status: 404 },
					);
				}
				return NextResponse.json(
					{ error: error?.message ?? "No se pudo descargar el documento" },
					{ status: 400 },
				);
			}

			const fileName = storagePath.split("/").pop() ?? "documento";
			const safeFileName = fileName.replace(/["\\\r\n]/g, "");
			const fallbackFileName = safeFileName
				.normalize("NFKD")
				.replace(/[^\x20-\x7e]/g, "_");
			const encodedFileName = encodeURIComponent(safeFileName);
			const arrayBuffer = await data.arrayBuffer();
			return new NextResponse(arrayBuffer, {
				headers: {
					"Content-Type": data.type || "application/octet-stream",
					"Content-Disposition": `attachment; filename="${fallbackFileName}"; filename*=UTF-8''${encodedFileName}`,
					"Cache-Control": "private, no-store",
				},
			});
		}

		const { data, error } = await storageClient.storage
			.from(DOCUMENTS_BUCKET)
			.createSignedUrl(storagePath, expiresIn);
		if (error || !data?.signedUrl) {
			if (isStorageObjectMissing(error?.message)) {
				return NextResponse.json(
					{
						error:
							"El documento figura en metadata pero el archivo ya no existe en Storage.",
						code: "DOCUMENT_STORAGE_MISSING",
					},
					{ status: 404 },
				);
			}
			return NextResponse.json(
				{ error: error?.message ?? "No se pudo generar el acceso al documento" },
				{ status: 400 },
			);
		}

		return NextResponse.json({ signedUrl: data.signedUrl });
	} catch (error) {
		console.error("[documents:access]", error);
		const message =
			error instanceof Error ? error.message : "Error accediendo al documento";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
