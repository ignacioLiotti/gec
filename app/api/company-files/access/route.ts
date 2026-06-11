import { NextResponse } from "next/server";

import { resolveRequestAccessContext } from "@/lib/demo-session";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

const DOCUMENTS_BUCKET = "obra-documents";
const COMPANY_FILES_ROOT = "_company-files";

function companyFilesPrefix(tenantId: string) {
	return `${COMPANY_FILES_ROOT}/${tenantId}`;
}

function isStorageObjectMissing(message: string | null | undefined) {
	return typeof message === "string" && /object not found/i.test(message);
}

export async function GET(request: Request) {
	try {
		const url = new URL(request.url);
		const storagePath = url.searchParams.get("path")?.trim() ?? "";
		const download =
			url.searchParams.get("download") === "1" ||
			url.searchParams.get("download") === "true";
		const expiresInRaw = Number(url.searchParams.get("expiresIn") ?? 3600);
		const expiresIn = Number.isFinite(expiresInRaw)
			? Math.min(24 * 60 * 60, Math.max(60, Math.trunc(expiresInRaw)))
			: 3600;

		const access = await resolveRequestAccessContext();
		const { user, tenantId, actorType } = access;
		if (!user && actorType !== "demo") {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

		const prefix = companyFilesPrefix(tenantId);
		if (!storagePath || !storagePath.startsWith(`${prefix}/`)) {
			return NextResponse.json({ error: "Ruta de archivo invalida" }, { status: 400 });
		}

		const storageClient = createSupabaseAdminClient();
		if (download) {
			const { data, error } = await storageClient.storage
				.from(DOCUMENTS_BUCKET)
				.download(storagePath);
			if (error || !data) {
				if (isStorageObjectMissing(error?.message)) {
					return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
				}
				return NextResponse.json(
					{ error: error?.message ?? "No se pudo descargar el archivo" },
					{ status: 400 },
				);
			}

			const fileName = storagePath.split("/").pop() ?? "archivo";
			const arrayBuffer = await data.arrayBuffer();
			return new NextResponse(arrayBuffer, {
				headers: {
					"Content-Type": data.type || "application/octet-stream",
					"Content-Disposition": `inline; filename="${fileName.replace(/"/g, "")}"`,
					"Cache-Control": "private, max-age=60",
				},
			});
		}

		const { data, error } = await storageClient.storage
			.from(DOCUMENTS_BUCKET)
			.createSignedUrl(storagePath, expiresIn);
		if (error || !data?.signedUrl) {
			if (isStorageObjectMissing(error?.message)) {
				return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
			}
			return NextResponse.json(
				{ error: error?.message ?? "No se pudo generar el acceso al archivo" },
				{ status: 400 },
			);
		}

		return NextResponse.json({ signedUrl: data.signedUrl });
	} catch (error) {
		console.error("[company-files:access]", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error accediendo al archivo" },
			{ status: 500 },
		);
	}
}
