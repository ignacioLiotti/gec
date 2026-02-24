import * as Sentry from "@sentry/nextjs";

const isVercelProduction =
	process.env.NODE_ENV === "production" &&
	process.env.NEXT_PUBLIC_VERCEL_ENV === "production";

const tracesSampleRate = Number.parseFloat(
	process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1"
);

const replaysSessionSampleRate = Number.parseFloat(
	process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE ?? "0"
);

const replaysOnErrorSampleRate = Number.parseFloat(
	process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ERROR_SAMPLE_RATE ?? "1"
);

Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
	enabled: isVercelProduction,
	environment:
		process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
		process.env.NODE_ENV ??
		"development",
	tracesSampleRate,
	replaysSessionSampleRate,
	replaysOnErrorSampleRate,
	integrations: [
		Sentry.replayIntegration({
			maskAllText: true,
			blockAllMedia: true,
		}),
		Sentry.browserTracingIntegration(),
	],
	// Enable debug mode in development to see Sentry logs
	debug: process.env.NODE_ENV === "development",
});
