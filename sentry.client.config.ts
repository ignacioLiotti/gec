import * as Sentry from "@sentry/nextjs";

const tracesSampleRate = Number.parseFloat(
	process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"
);

const replaysSessionSampleRate = Number.parseFloat(
	process.env.SENTRY_REPLAYS_SESSION_SAMPLE_RATE ?? "0"
);

const replaysOnErrorSampleRate = Number.parseFloat(
	process.env.SENTRY_REPLAYS_ERROR_SAMPLE_RATE ?? "1"
);

if (process.env.SENTRY_DSN) {
	Sentry.init({
		dsn: process.env.SENTRY_DSN,
		environment:
			process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
		tracesSampleRate,
		replaysSessionSampleRate,
		replaysOnErrorSampleRate,
		integrations: (integrations) => {
			return integrations;
		},
	});
}
