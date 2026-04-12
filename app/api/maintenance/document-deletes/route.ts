import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

const MAX_ITEMS_PER_RUN = 250;

function isAuthorized(request: Request) {
	const secret = process.env.CRON_SECRET;
	if (!secret) {
		return process.env.NODE_ENV !== "production";
	}
	const header = request.headers.get("x-cron-secret");
	return header === secret;
}

function chunk<T>(items: T[], size: number) {
	const output: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		output.push(items.slice(i, i + size));
	}
	return output;
}

type PurgeCandidate = {
	id: string;
	obra_id: string;
	item_type: "file" | "folder";
	storage_bucket: string;
	storage_path: string;
};

export async function POST(request: Request) {
	if (!isAuthorized(request)) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const admin = createSupabaseAdminClient();
	const nowIso = new Date().toISOString();
	const purgeJobId =
		request.headers.get("x-cron-job-id") ??
		request.headers.get("x-vercel-id") ??
		`document-deletes-${nowIso}`;

	try {
		const { data: candidates, error: candidatesError } = await admin
			.from("obra_document_deletes")
			.select("id, obra_id, item_type, storage_bucket, storage_path")
			.is("restored_at", null)
			.is("purged_at", null)
			.lte("recover_until", nowIso)
			.order("recover_until", { ascending: true })
			.limit(MAX_ITEMS_PER_RUN);

		if (candidatesError) throw candidatesError;

		if (!candidates || candidates.length === 0) {
			return NextResponse.json({ ok: true, status: "idle", processed: 0 });
		}

		const typedCandidates = candidates as PurgeCandidate[];
		const fileCandidates = typedCandidates.filter((row) => row.item_type === "file");
		const folderCandidates = typedCandidates.filter((row) => row.item_type === "folder");

		const purgeableIds = new Set<string>(folderCandidates.map((row) => row.id));
		const failedPaths: string[] = [];

		for (const row of fileCandidates) {
			const bucket = row.storage_bucket || "obra-documents";
			const { error: storageError } = await admin.storage
				.from(bucket)
				.remove([row.storage_path]);

			if (storageError) {
				const message = String(storageError.message ?? "").toLowerCase();
				const statusCode = Number((storageError as { statusCode?: number }).statusCode ?? 0);
				const isNotFound = statusCode === 404 || message.includes("not found");
				if (isNotFound) {
					purgeableIds.add(row.id);
					continue;
				}
				console.error("[maintenance:document-deletes] storage remove failed", {
					path: row.storage_path,
					error: storageError,
				});
				failedPaths.push(row.storage_path);
				continue;
			}

			purgeableIds.add(row.id);
		}

		const purgeableFileRows = fileCandidates.filter((row) => purgeableIds.has(row.id));
		const tablaIdsByObra = new Map<string, string[]>();

		for (const row of purgeableFileRows) {
			const currentPaths = tablaIdsByObra.get(row.obra_id);
			if (currentPaths) continue;
			const { data: tablaRows, error: tablaError } = await admin
				.from("obra_tablas")
				.select("id")
				.eq("obra_id", row.obra_id);
			if (tablaError) {
				console.error("[maintenance:document-deletes] tabla fetch failed", {
					obraId: row.obra_id,
					error: tablaError,
				});
				tablaIdsByObra.set(row.obra_id, []);
				continue;
			}
			tablaIdsByObra.set(
				row.obra_id,
				(tablaRows ?? [])
					.map((tabla) => tabla.id as string)
					.filter((tablaId): tablaId is string => typeof tablaId === "string"),
			);
		}

		const fileRowsByObra = new Map<string, PurgeCandidate[]>();
		for (const row of purgeableFileRows) {
			const bucket = fileRowsByObra.get(row.obra_id) ?? [];
			bucket.push(row);
			fileRowsByObra.set(row.obra_id, bucket);
		}

		for (const [obraId, rows] of fileRowsByObra.entries()) {
			const paths = rows.map((row) => row.storage_path);

			const { error: uploadTrackingDeleteError } = await admin
				.from("obra_document_uploads")
				.delete()
				.eq("obra_id", obraId)
				.in("storage_path", paths);
			if (uploadTrackingDeleteError) {
				console.error("[maintenance:document-deletes] upload tracking cleanup failed", {
					obraId,
					error: uploadTrackingDeleteError,
				});
			}

			const { error: ocrDocsDeleteError } = await admin
				.from("ocr_document_processing")
				.delete()
				.eq("obra_id", obraId)
				.in("source_path", paths);
			if (ocrDocsDeleteError) {
				console.error("[maintenance:document-deletes] ocr processing cleanup failed", {
					obraId,
					error: ocrDocsDeleteError,
				});
			}

			const tablaIds = tablaIdsByObra.get(obraId) ?? [];
			if (tablaIds.length > 0) {
				for (const path of paths) {
					const { error: rowsDeleteError } = await admin
						.from("obra_tabla_rows")
						.delete()
						.in("tabla_id", tablaIds)
						.contains("data", { __docPath: path });
					if (rowsDeleteError) {
						console.error("[maintenance:document-deletes] tabla rows cleanup failed", {
							obraId,
							path,
							error: rowsDeleteError,
						});
					}
				}
			}
		}

		const purgeIds = Array.from(purgeableIds);
		for (const idsChunk of chunk(purgeIds, 200)) {
			const { error: purgeError } = await admin
				.from("obra_document_deletes")
				.update({
					purged_at: nowIso,
					purged_by_email: "system:document-deletes-job",
					purge_job_id: purgeJobId,
					purge_reason: "retention_30_days",
				})
				.in("id", idsChunk)
				.is("restored_at", null)
				.is("purged_at", null);
			if (purgeError) {
				console.error("[maintenance:document-deletes] mark purge failed", purgeError);
			}
		}

		return NextResponse.json({
			ok: true,
			status: "done",
			purgeJobId,
			picked: typedCandidates.length,
			processed: purgeIds.length,
			failed: failedPaths.length,
			failedPaths,
		});
	} catch (error) {
		console.error("[maintenance:document-deletes]", error);
		return NextResponse.json(
			{
				error: "Failed to purge expired deletes",
				detail: error instanceof Error ? error.message : "unknown",
			},
			{ status: 500 },
		);
	}
}

export async function GET(request: Request) {
	return POST(request);
}
