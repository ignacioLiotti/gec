import os from "node:os";
import { NextResponse } from "next/server";

const REQUIRED_TOKEN = process.env.HEALTHCHECK_TOKEN;

export async function GET(request: Request) {
	if (REQUIRED_TOKEN) {
		const provided =
			request.headers.get("x-health-token") ??
			new URL(request.url).searchParams.get("token");
		if (provided !== REQUIRED_TOKEN) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
	}

	const uptimeSeconds = process.uptime();
	return NextResponse.json({
		ok: true,
		timestamp: new Date().toISOString(),
		uptimeSeconds,
		host: os.hostname(),
		version: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
	});
}
