const isVercelProduction =
	process.env.NODE_ENV === "production" &&
	process.env.VERCEL === "1" &&
	process.env.VERCEL_ENV === "production";

export async function register() {
	if (!isVercelProduction) {
		return;
	}

	if (process.env.NEXT_RUNTIME === "nodejs") {
		// Server-side Sentry initialization
		await import("./sentry.server.config");
	}

	if (process.env.NEXT_RUNTIME === "edge") {
		// Edge runtime Sentry initialization
		await import("./sentry.edge.config");
	}
}

type CaptureRequestError = typeof import("@sentry/nextjs").captureRequestError;

export const onRequestError: CaptureRequestError = (
	isVercelProduction
		? async (...args) => {
				const Sentry = await import("@sentry/nextjs");
				return Sentry.captureRequestError(...args);
			}
		: () => {}
) as CaptureRequestError;
