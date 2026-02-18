import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { applyDefaultFolderToExistingObras } from "@/lib/obra-defaults/apply-default-folder";

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
					await applyDefaultFolderToExistingObras(admin, {
						tenantId: job.tenant_id,
						folderId,
						forceSync,
						previousPath,
					});
					break;
				}
				default:
					throw new Error(`Unknown job type: ${job.type}`);
			}

			await admin
				.from("background_jobs")
				.update({ status: "done", last_error: null })
				.eq("id", job.id);
			processed += 1;
		} catch (error: any) {
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
