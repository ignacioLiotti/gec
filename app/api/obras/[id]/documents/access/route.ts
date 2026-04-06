import { NextResponse } from "next/server";

import {
	hasDemoCapability,
	resolveRequestAccessContext,
} from "@/lib/demo-session";

const DOCUMENTS_BUCKET = "obra-documents";

type RouteContext = {
	params: Promise<{ id: string }>;
};

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
			.select("id")
			.eq("id", obraId)
			.eq("tenant_id", tenantId)
			.is("deleted_at", null)
			.maybeSingle();
		if (obraError) throw obraError;
		if (!obra) {
			return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
		}

		if (download) {
			const { data, error } = await supabase.storage
				.from(DOCUMENTS_BUCKET)
				.download(storagePath);
			if (error || !data) {
				return NextResponse.json(
					{ error: error?.message ?? "No se pudo descargar el documento" },
					{ status: 400 },
				);
			}

			const fileName = storagePath.split("/").pop() ?? "documento";
			const arrayBuffer = await data.arrayBuffer();
			return new NextResponse(arrayBuffer, {
				headers: {
					"Content-Type": data.type || "application/octet-stream",
					"Content-Disposition": `inline; filename="${fileName.replace(/"/g, "")}"`,
					"Cache-Control": "private, max-age=60",
				},
			});
		}

		const { data, error } = await supabase.storage
			.from(DOCUMENTS_BUCKET)
			.createSignedUrl(storagePath, expiresIn);
		if (error || !data?.signedUrl) {
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
