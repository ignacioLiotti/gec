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

	const { data: job, error: fetchError } = await admin
		.from("background_jobs")
		.select("id, tenant_id, type, payload, attempts")
		.eq("status", "pending")
		.order("created_at", { ascending: true })
		.limit(1)
		.maybeSingle();

	if (fetchError) {
		return NextResponse.json(
			{ error: "Failed to fetch job", detail: fetchError.message },
			{ status: 500 },
		);
	}

	if (!job) {
		return NextResponse.json({ ok: true, status: "idle" });
	}

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
		return NextResponse.json({ ok: true, status: "skipped" });
	}

	try {
		switch (job.type) {
			case "apply_default_folder": {
				const folderId = (job.payload as any)?.folderId as string | undefined;
				if (!folderId) {
					throw new Error("folderId missing in payload");
				}
				await applyDefaultFolderToExistingObras(admin, {
					tenantId: job.tenant_id,
					folderId,
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

		return NextResponse.json({ ok: true, status: "done", jobId: job.id });
	} catch (error: any) {
		await admin
			.from("background_jobs")
			.update({
				status: "failed",
				last_error: error?.message ?? "unknown error",
			})
			.eq("id", job.id);

		return NextResponse.json(
			{ error: "Job failed", detail: error?.message ?? "unknown error" },
			{ status: 500 },
		);
	}
}

export async function GET(request: Request) {
	return POST(request);
}
