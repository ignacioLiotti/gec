import * as Sentry from "@sentry/nextjs";

const isVercelProduction =
	process.env.NODE_ENV === "production" &&
	process.env.VERCEL === "1" &&
	process.env.VERCEL_ENV === "production";

export async function register() {
	if (process.env.NEXT_RUNTIME === "nodejs") {
		// Server-side Sentry initialization
		await import("./sentry.server.config");
	}

	if (process.env.NEXT_RUNTIME === "edge") {
		// Edge runtime Sentry initialization
		await import("./sentry.edge.config");
	}
}

export const onRequestError = isVercelProduction
	? Sentry.captureRequestError
	: () => {};
