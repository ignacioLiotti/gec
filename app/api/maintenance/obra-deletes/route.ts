import { NextResponse } from "next/server";

import {
	OBRA_PURGE_REASON_RETENTION,
	resolveObraDeleteStatus,
} from "@/lib/obras/delete-lifecycle";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

const DOCUMENTS_BUCKET = "obra-documents";
const MAX_ITEMS_PER_RUN = 100;

type PurgeCandidate = {
	id: string;
	tenant_id: string;
	obra_id: string;
	restore_deadline_at: string | null;
	restored_at: string | null;
	purged_at: string | null;
};

type StorageEntry = {
	id?: string | null;
	name: string;
	metadata?: Record<string, unknown> | null;
};

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

async function listObraStorageFiles(admin: ReturnType<typeof createSupabaseAdminClient>, obraId: string) {
	const queue: string[] = [obraId];
	const files: string[] = [];

	while (queue.length > 0) {
		const folder = queue.shift();
		if (!folder) continue;
		const { data, error } = await admin.storage.from(DOCUMENTS_BUCKET).list(folder, {
			limit: 1000,
			sortBy: { column: "name", order: "asc" },
		});
		if (error) {
			const message = String(error.message ?? "").toLowerCase();
			if (message.includes("not found")) {
				continue;
			}
			throw error;
		}

		for (const entry of (data ?? []) as StorageEntry[]) {
			const fullPath = `${folder}/${entry.name}`.replace(/\/{2,}/g, "/");
			const isFolder = !entry.metadata;
			if (isFolder) {
				queue.push(fullPath);
			} else {
				files.push(fullPath);
			}
		}
	}

	return files;
}

export async function POST(request: Request) {
	if (!isAuthorized(request)) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const admin = createSupabaseAdminClient();
	const now = new Date();
	const nowIso = now.toISOString();
	const purgeJobId =
		request.headers.get("x-cron-job-id") ??
		request.headers.get("x-vercel-id") ??
		`obra-deletes-${nowIso}`;

	try {
		const { data, error } = await admin
			.from("obra_deletes")
			.select("id, tenant_id, obra_id, restore_deadline_at, restored_at, purged_at")
			.is("restored_at", null)
			.is("purged_at", null)
			.lte("restore_deadline_at", nowIso)
			.order("restore_deadline_at", { ascending: true })
			.limit(MAX_ITEMS_PER_RUN);
		if (error) throw error;

		const candidates = (data ?? []) as PurgeCandidate[];
		if (candidates.length === 0) {
			return NextResponse.json({ ok: true, status: "idle", processed: 0 });
		}

		let processed = 0;
		let filesRemoved = 0;
		const failed: Array<{ deleteId: string; reason: string }> = [];

		for (const candidate of candidates) {
			const status = resolveObraDeleteStatus({
				restoredAt: candidate.restored_at,
				purgedAt: candidate.purged_at,
				restoreDeadlineAt: candidate.restore_deadline_at,
				nowMs: now.getTime(),
			});
			if (status === "restored" || status === "purged" || status === "deleted") {
				continue;
			}

			try {
				const filePaths = await listObraStorageFiles(admin, candidate.obra_id);
				for (const pathsChunk of chunk(filePaths, 100)) {
					const { error: removeError } = await admin.storage
						.from(DOCUMENTS_BUCKET)
						.remove(pathsChunk);
					if (removeError) {
						const message = String(removeError.message ?? "").toLowerCase();
						if (!message.includes("not found")) {
							throw removeError;
						}
					}
				}
				filesRemoved += filePaths.length;

				const { error: purgeObraError } = await admin
					.from("obras")
					.update({
						purged_at: nowIso,
						purge_job_id: purgeJobId,
					})
					.eq("tenant_id", candidate.tenant_id)
					.eq("id", candidate.obra_id)
					.not("deleted_at", "is", null);
				if (purgeObraError) throw purgeObraError;

				const { error: purgeDeleteError } = await admin
					.from("obra_deletes")
					.update({
						status: "purged",
						purged_at: nowIso,
						purged_by: null,
						purged_by_email: "system:obra-deletes-job",
						purge_job_id: purgeJobId,
						purge_reason: OBRA_PURGE_REASON_RETENTION,
					})
					.eq("id", candidate.id)
					.eq("tenant_id", candidate.tenant_id)
					.is("restored_at", null)
					.is("purged_at", null);
				if (purgeDeleteError) throw purgeDeleteError;

				processed += 1;
			} catch (errorCandidate) {
				console.error("[maintenance:obra-deletes] failed to purge delete event", {
					deleteId: candidate.id,
					error: errorCandidate,
				});
				failed.push({
					deleteId: candidate.id,
					reason:
						errorCandidate instanceof Error
							? errorCandidate.message
							: "unknown",
				});
			}
		}

		return NextResponse.json({
			ok: true,
			status: "done",
			purgeJobId,
			picked: candidates.length,
			processed,
			filesRemoved,
			failed: failed.length,
			failedItems: failed,
		});
	} catch (error) {
		console.error("[maintenance:obra-deletes]", error);
		return NextResponse.json(
			{
				error: "Failed to purge expired obra deletes",
				detail: error instanceof Error ? error.message : "unknown",
			},
			{ status: 500 },
		);
	}
}

export async function GET(request: Request) {
	return POST(request);
}
