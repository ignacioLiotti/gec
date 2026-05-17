// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

const isVercelProduction =
	process.env.NODE_ENV === "production" &&
	process.env.NEXT_PUBLIC_VERCEL_ENV === "production";

if (isVercelProduction) {
	void import("@sentry/nextjs").then((Sentry) => {
		Sentry.init({
			dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
			enabled: true,
			environment:
				process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
				process.env.NODE_ENV ??
				"production",
			tracesSampleRate: Number.parseFloat(
				process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1",
			),
			replaysSessionSampleRate: Number.parseFloat(
				process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE ?? "0",
			),
			replaysOnErrorSampleRate: Number.parseFloat(
				process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ERROR_SAMPLE_RATE ?? "1",
			),
			integrations: [
				Sentry.replayIntegration({
					maskAllText: true,
					blockAllMedia: true,
				}),
				Sentry.browserTracingIntegration(),
			],
		});
	});
}

type CaptureRouterTransitionStart =
	typeof import("@sentry/nextjs").captureRouterTransitionStart;

export const onRouterTransitionStart: CaptureRouterTransitionStart = ((
	...args
) => {
	if (!isVercelProduction) {
		return;
	}

	void import("@sentry/nextjs").then((Sentry) => {
		Sentry.captureRouterTransitionStart(...args);
	});
}) as CaptureRouterTransitionStart;
