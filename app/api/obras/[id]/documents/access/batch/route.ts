import { NextResponse } from "next/server";

import {
	hasDemoCapability,
	resolveRequestAccessContext,
} from "@/lib/demo-session";
import { normalizeFolderPath } from "@/lib/tablas";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

const DOCUMENTS_BUCKET = "obra-documents";
const MAX_BATCH_SIZE = 120;

type RouteContext = {
	params: Promise<{ id: string }>;
};

type BatchAccessRequest = {
	paths?: unknown;
	expiresIn?: unknown;
};

function normalizePathList(value: unknown, obraId: string) {
	if (!Array.isArray(value)) return [];
	const seen = new Set<string>();
	const paths: string[] = [];
	for (const rawPath of value) {
		const path = typeof rawPath === "string" ? rawPath.trim() : "";
		if (!path || !path.startsWith(`${obraId}/`) || seen.has(path)) continue;
		seen.add(path);
		paths.push(path);
		if (paths.length >= MAX_BATCH_SIZE) break;
	}
	return paths;
}

export async function POST(request: Request, context: RouteContext) {
	const { id: obraId } = await context.params;
	if (!obraId) {
		return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });
	}

	try {
		const body = (await request.json().catch(() => ({}))) as BatchAccessRequest;
		const paths = normalizePathList(body.paths, obraId);
		const expiresInRaw = Number(body.expiresIn ?? 3600);
		const expiresIn = Number.isFinite(expiresInRaw)
			? Math.min(24 * 60 * 60, Math.max(60, Math.trunc(expiresInRaw)))
			: 3600;

		if (paths.length === 0) {
			return NextResponse.json({ urls: {} });
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

		const { data: deleteRows, error: deleteRowsError } = await supabase
			.from("obra_document_deletes")
			.select("storage_path, item_type")
			.eq("tenant_id", tenantId)
			.eq("obra_id", obraId)
			.is("restored_at", null);
		if (deleteRowsError) throw deleteRowsError;

		const isBlocked = (storagePath: string) => {
			const legacyNormalizedStoragePath = normalizeFolderPath(storagePath);
			return (deleteRows ?? []).some((row) => {
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
		};

		const allowedPaths = paths.filter((path) => !isBlocked(path));
		if (allowedPaths.length === 0) {
			return NextResponse.json({ urls: {} });
		}

		const storageClient = createSupabaseAdminClient();
		const { data, error } = await storageClient.storage
			.from(DOCUMENTS_BUCKET)
			.createSignedUrls(allowedPaths, expiresIn);
		if (error) {
			return NextResponse.json(
				{ error: error.message ?? "No se pudieron firmar los documentos" },
				{ status: 400 },
			);
		}

		const urls: Record<string, string> = {};
		for (const entry of data ?? []) {
			if (entry.path && entry.signedUrl) {
				urls[entry.path] = entry.signedUrl;
			}
		}

		return NextResponse.json({ urls });
	} catch (error) {
		console.error("[documents:access:batch]", error);
		const message =
			error instanceof Error ? error.message : "Error accediendo a documentos";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
