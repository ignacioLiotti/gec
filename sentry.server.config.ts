// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const isVercelProduction =
  process.env.NODE_ENV === "production" &&
  process.env.VERCEL === "1" &&
  process.env.VERCEL_ENV === "production";

Sentry.init({
  dsn: "https://7f010bc9dd4dd67e0737974677944584@o4510431432343552.ingest.us.sentry.io/4510431442567168",
  enabled: isVercelProduction,

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});
