import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { applyDefaultFolderToExistingObras } from "@/lib/obra-defaults/apply-default-folder";
import { removeDefaultFolderFromExistingObras } from "@/lib/obra-defaults/remove-default-folder";

function isAuthorized(request: Request) {
	const secret = process.env.CRON_SECRET;
	if (!secret) {
		return process.env.NODE_ENV !== "production";
	}
	const header = request.headers.get("x-cron-secret");
	return header === secret;
}

export async function POST(request: Request) {
	if (!isAuthorized(request)) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const admin = createSupabaseAdminClient();
	const MAX_JOBS_PER_RUN = 25;
	// TODO(domain-model): This runner operates only on `background_jobs` technical state.
	// Introduce `migration_runs` with formal lifecycle:
	// planned -> validated -> running -> completed/failed/rolled_back.
	const { data: jobs, error: fetchError } = await admin
		.from("background_jobs")
		.select("id, tenant_id, type, payload, attempts")
		.eq("status", "pending")
		.order("created_at", { ascending: true })
		.limit(MAX_JOBS_PER_RUN);

	if (fetchError) {
		return NextResponse.json(
			{ error: "Failed to fetch job", detail: fetchError.message },
			{ status: 500 },
		);
	}

	if (!jobs || jobs.length === 0) {
		return NextResponse.json({ ok: true, status: "idle" });
	}
	let processed = 0;
	let failed = 0;

	for (const job of jobs) {
		const { data: lockedJob, error: lockError } = await admin
			.from("background_jobs")
			.update({
				status: "running",
				attempts: (job.attempts ?? 0) + 1,
			})
			.eq("id", job.id)
			.eq("status", "pending")
			.select("id")
			.maybeSingle();

		if (lockError || !lockedJob) {
			continue;
		}

		try {
				switch (job.type) {
					case "apply_default_folder": {
					const folderId = (job.payload as any)?.folderId as string | undefined;
					const forceSync = (job.payload as any)?.forceSync === true;
					const previousPath =
						typeof (job.payload as any)?.previousPath === "string"
							? (job.payload as any).previousPath
							: undefined;
					if (!folderId) {
						throw new Error("folderId missing in payload");
					}
					// TODO(domain-model): For destructive force sync, block execution unless an
					// approved impact preview already exists in migration validation state.
					// TODO(domain-model): Enforce deterministic compatibility class in payload/result.
					// If class is unknown or unverifiable, escalate to `destructiva` and block run
					// until preview + explicit approval are present.
					// TODO(domain-model): Validate approval token one-shot (owner/admin only),
					// bound to migration_run + frozen preview snapshot, and not expired.
					// TODO(domain-model): Verify canonical snapshot integrity before execution:
					// canonical_snapshot_hash + snapshot_hmac_signature + classification_rules_version.
					// Reject if recomputed snapshot differs from approved snapshot.
					// TODO(domain-model): Enforce matching `snapshot_canonicalization_version`
					// and recompute with JCS/RFC 8785 + domain array identity rules.
					await applyDefaultFolderToExistingObras(admin, {
						tenantId: job.tenant_id,
						folderId,
						forceSync,
						previousPath,
					});
						break;
					}
					case "remove_default_folder": {
						const folderPath = (job.payload as any)?.folderPath as string | undefined;
						const defaultTablaIds = Array.isArray((job.payload as any)?.defaultTablaIds)
							? ((job.payload as any).defaultTablaIds as unknown[]).filter(
									(value): value is string =>
										typeof value === "string" && value.length > 0,
								)
							: [];
						if (!folderPath) {
							throw new Error("folderPath missing in payload");
						}
						await removeDefaultFolderFromExistingObras(admin, {
							tenantId: job.tenant_id,
							folderPath,
							defaultTablaIds,
						});
						break;
					}
					default:
						throw new Error(`Unknown job type: ${job.type}`);
				}

			// TODO(domain-model): Mirror this technical completion into a domain migration
			// record with impact_real counters and schema identity after execution.
			// TODO(domain-model): Persist approval token consumption to prevent unauthorized reruns.
			await admin
				.from("background_jobs")
				.update({ status: "done", last_error: null })
				.eq("id", job.id);
			processed += 1;
		} catch (error: any) {
			// TODO(domain-model): Even partial failures must close with a final auditable
			// migration outcome, including rollback_reference when compensation is triggered.
			// TODO(domain-model): Define retry policy for destructive runs: by default require
			// revalidation and fresh approval token before another execution attempt.
			await admin
				.from("background_jobs")
				.update({
					status: "failed",
					last_error: error?.message ?? "unknown error",
				})
				.eq("id", job.id);
			failed += 1;
		}
	}

	return NextResponse.json({
		ok: true,
		status: "done",
		processed,
		failed,
		picked: jobs.length,
	});
}

export async function GET(request: Request) {
	return POST(request);
}
