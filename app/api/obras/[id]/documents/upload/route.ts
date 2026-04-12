import { NextResponse } from "next/server";

import {
	hasDemoCapability,
	resolveRequestAccessContext,
} from "@/lib/demo-session";
import { fetchTenantPlan } from "@/lib/subscription-plans";
import { incrementTenantUsage, logTenantUsageEvent } from "@/lib/tenant-usage";
import { normalizeFolderPath } from "@/lib/tablas";

type RouteContext = { params: Promise<{ id: string }> };

const DOCUMENTS_BUCKET = "obra-documents";

function sanitizeFileName(base: string) {
	return base
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-zA-Z0-9._ -]/g, "-")
		.replace(/-+/g, "-")
		.replace(/\s+/g, " ")
		.trim();
}

function splitFileName(name: string) {
	const dotIndex = name.lastIndexOf(".");
	if (dotIndex <= 0) return { stem: name, ext: "" };
	return {
		stem: name.slice(0, dotIndex),
		ext: name.slice(dotIndex),
	};
}

function withNumericSuffix(name: string, attempt: number) {
	if (attempt <= 1) return name;
	const { stem, ext } = splitFileName(name);
	return `${stem} (${attempt})${ext}`;
}

function isAlreadyExistsError(error: unknown) {
	const message = String((error as { message?: string })?.message ?? "").toLowerCase();
	const statusCode = Number((error as { statusCode?: number })?.statusCode ?? 0);
	return (
		statusCode === 409 ||
		message.includes("already exists") ||
		message.includes("duplicate") ||
		message.includes("resource already exists")
	);
}

function usageErrorToStatus(code?: string) {
	if (code === "storage_limit_exceeded") return 402;
	if (code === "insufficient_privilege") return 403;
	return 400;
}

export async function POST(request: Request, context: RouteContext) {
	const { id: obraId } = await context.params;
	if (!obraId) {
		return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });
	}

	try {
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

		const { data: obraRow, error: obraError } = await supabase
			.from("obras")
			.select("id")
			.eq("id", obraId)
			.eq("tenant_id", tenantId)
			.is("deleted_at", null)
			.maybeSingle();
		if (obraError) throw obraError;
		if (!obraRow) {
			return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
		}

		const form = await request.formData();
		const fileEntry = form.get("file");
		const folderPathEntry = form.get("folderPath");
		const file = fileEntry instanceof File ? fileEntry : null;
		const folderPath = typeof folderPathEntry === "string" ? folderPathEntry.trim() : "";

		if (!file) {
			return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
		}
		if (!folderPath) {
			return NextResponse.json({ error: "Falta la carpeta destino" }, { status: 400 });
		}

		const normalizedFolderPath = normalizeFolderPath(folderPath);
		const obraPrefix = normalizeFolderPath(obraId);
		if (
			normalizedFolderPath !== obraPrefix &&
			!normalizedFolderPath.startsWith(`${obraPrefix}/`)
		) {
			return NextResponse.json(
				{ error: "La carpeta destino no pertenece a la obra." },
				{ status: 400 },
			);
		}

		const baseStorageFileName = sanitizeFileName(file.name) || `archivo-${Date.now()}`;
		const fileBytes = Buffer.from(await file.arrayBuffer());
		const uploadedSize =
			typeof fileBytes.length === "number" && fileBytes.length > 0 ? fileBytes.length : 0;
		const plan = await fetchTenantPlan(supabase, tenantId);

		let storageFileName = baseStorageFileName;
		let storagePath = `${normalizedFolderPath}/${storageFileName}`;
		let uploadError: unknown = null;

		for (let attempt = 1; attempt <= 200; attempt += 1) {
			storageFileName = withNumericSuffix(baseStorageFileName, attempt);
			storagePath = `${normalizedFolderPath}/${storageFileName}`;

			const { error } = await supabase.storage
				.from(DOCUMENTS_BUCKET)
				.upload(storagePath, fileBytes, {
					contentType: file.type || "application/octet-stream",
					upsert: false,
				});

			if (!error) {
				uploadError = null;
				break;
			}

			uploadError = error;
			if (!isAlreadyExistsError(error)) {
				break;
			}
		}

		if (uploadError) {
			throw uploadError;
		}

		if (uploadedSize > 0) {
			try {
				await incrementTenantUsage(
					supabase,
					tenantId,
					{ storageBytes: uploadedSize },
					plan.limits,
				);
				await logTenantUsageEvent(supabase, {
					tenantId,
					kind: "storage_bytes",
					amount: uploadedSize,
					context: "documents_upload",
					metadata: {
						obraId,
						path: storagePath,
						fileName: storageFileName,
					},
				});
			} catch (usageError) {
				await supabase.storage
					.from(DOCUMENTS_BUCKET)
					.remove([storagePath])
					.catch((removeError) =>
						console.error(
							"[documents-upload] failed to rollback file after limit error",
							removeError,
						),
					);
				const err = usageError as Error & { code?: string };
				return NextResponse.json(
					{ error: err.message || "Superaste el limite de almacenamiento disponible." },
					{ status: usageErrorToStatus(err.code) },
				);
			}
		}

		if (user?.id) {
			const { error: trackingError } = await supabase
				.from("obra_document_uploads")
				.upsert(
					{
						obra_id: obraId,
						storage_bucket: DOCUMENTS_BUCKET,
						storage_path: storagePath,
						file_name: storageFileName,
						uploaded_by: user.id,
					},
					{ onConflict: "storage_path" },
				);
			if (trackingError) {
				console.error("[documents-upload] tracking failed", trackingError);
			}
		}

		return NextResponse.json({
			ok: true,
			bucket: DOCUMENTS_BUCKET,
			path: storagePath,
			fileName: storageFileName,
			uploadedBytes: uploadedSize,
		});
	} catch (error) {
		console.error("[documents-upload]", error);
		const message = error instanceof Error ? error.message : "Error al subir archivos";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
