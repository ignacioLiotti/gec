// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

const isVercelProduction =
  process.env.NODE_ENV === "production" &&
  process.env.VERCEL === "1" &&
  process.env.VERCEL_ENV === "production";

if (isVercelProduction) {
  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      enabled: true,

      // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
      tracesSampleRate: Number.parseFloat(
        process.env.SENTRY_TRACES_SAMPLE_RATE ??
          process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ??
          "0.1",
      ),

      // Enable logs to be sent to Sentry
      enableLogs: true,

      // Enable sending user PII (Personally Identifiable Information)
      // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
      sendDefaultPii: true,
    });
  });
}

export {};
