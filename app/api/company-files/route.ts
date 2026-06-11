import { NextResponse } from "next/server";

import { resolveRequestAccessContext } from "@/lib/demo-session";
import { fetchTenantPlan } from "@/lib/subscription-plans";
import { incrementTenantUsage, logTenantUsageEvent } from "@/lib/tenant-usage";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

const DOCUMENTS_BUCKET = "obra-documents";
const COMPANY_FILES_ROOT = "_company-files";

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

function companyFilesPrefix(tenantId: string) {
	return `${COMPANY_FILES_ROOT}/${tenantId}`;
}

export async function GET() {
	try {
		const access = await resolveRequestAccessContext();
		const { user, tenantId, actorType } = access;
		if (!user && actorType !== "demo") {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		if (!tenantId) return NextResponse.json({ files: [] });

		const storageClient = createSupabaseAdminClient();
		const prefix = companyFilesPrefix(tenantId);
		const { data, error } = await storageClient.storage
			.from(DOCUMENTS_BUCKET)
			.list(prefix, { limit: 200, sortBy: { column: "updated_at", order: "desc" } });
		if (error) return NextResponse.json({ error: error.message }, { status: 500 });

		return NextResponse.json({
			files: (data ?? [])
				.filter((item) => item.name && item.id)
				.map((item) => ({
					name: item.name,
					path: `${prefix}/${item.name}`,
					size: Number(item.metadata?.size ?? 0),
					mimeType: typeof item.metadata?.mimetype === "string" ? item.metadata.mimetype : null,
					createdAt: item.created_at ?? null,
					updatedAt: item.updated_at ?? null,
				})),
		});
	} catch (error) {
		console.error("[company-files:list]", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error cargando archivos globales" },
			{ status: 500 },
		);
	}
}

export async function POST(request: Request) {
	try {
		const access = await resolveRequestAccessContext();
		const { supabase, user, tenantId, actorType } = access;
		if (!user && actorType !== "demo") {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		if (actorType === "demo") {
			return NextResponse.json({ error: "Demo no puede subir archivos globales" }, { status: 403 });
		}
		if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

		const form = await request.formData();
		const fileEntry = form.get("file");
		const file = fileEntry instanceof File ? fileEntry : null;
		if (!file) return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });

		const uploadedSize =
			typeof file.size === "number" && Number.isFinite(file.size) && file.size > 0
				? file.size
				: 0;
		const plan = await fetchTenantPlan(supabase, tenantId);
		const storageClient = createSupabaseAdminClient();
		const prefix = companyFilesPrefix(tenantId);
		const baseStorageFileName = sanitizeFileName(file.name) || `archivo-${Date.now()}`;
		let storageFileName = baseStorageFileName;
		let storagePath = `${prefix}/${storageFileName}`;
		let uploadError: unknown = null;

		for (let attempt = 1; attempt <= 200; attempt += 1) {
			storageFileName = withNumericSuffix(baseStorageFileName, attempt);
			storagePath = `${prefix}/${storageFileName}`;
			const { error } = await storageClient.storage
				.from(DOCUMENTS_BUCKET)
				.upload(storagePath, file, {
					contentType: file.type || "application/octet-stream",
					upsert: false,
				});
			if (!error) {
				uploadError = null;
				break;
			}
			uploadError = error;
			if (!isAlreadyExistsError(error)) break;
		}

		if (uploadError) throw uploadError;

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
					context: "company_files_upload",
					metadata: { path: storagePath, fileName: storageFileName },
				});
			} catch (usageError) {
				await storageClient.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
				const err = usageError as Error & { code?: string };
				return NextResponse.json(
					{ error: err.message || "Superaste el limite de almacenamiento disponible." },
					{ status: usageErrorToStatus(err.code) },
				);
			}
		}

		return NextResponse.json({
			file: {
				name: storageFileName,
				path: storagePath,
				size: uploadedSize,
				mimeType: file.type || "application/octet-stream",
			},
		});
	} catch (error) {
		console.error("[company-files:upload]", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error subiendo archivo global" },
			{ status: 500 },
		);
	}
}
