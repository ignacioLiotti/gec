import * as Sentry from "@sentry/nextjs";

const tracesSampleRate = Number.parseFloat(
	process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"
);
const profilesSampleRate = Number.parseFloat(
	process.env.SENTRY_PROFILES_SAMPLE_RATE ?? "0.1"
);

Sentry.init({
	dsn: process.env.SENTRY_DSN,
	environment:
		process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
	tracesSampleRate,
	profilesSampleRate,
	debug: process.env.SENTRY_DEBUG === "1",
});
