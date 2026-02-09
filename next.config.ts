// next.config.ts
import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
	reactStrictMode: true,
	reactCompiler: true,
	experimental: {
		// Required for edge workflows and background tasks
		serverActions: {
			bodySizeLimit: "10mb", // Increased for PDF generation with large HTML payloads
		},
		serverComponentsExternalPackages: [
			"node-fetch",
			"undici",
			"@react-email/components",
			"@react-email/render",
			"@react-email/tailwind",
			"@supabase/node-fetch",
			"puppeteer-core",
			"@sparticuz/chromium",
			"xlsx",
		],
	},
	// webpack: (config, { isServer }) => {
	// 	if (isServer) {
	// 		// Externalize Node.js built-ins for server-side code
	// 		config.externals = config.externals || [];
	// 		config.externals.push({
	// 			"node:stream": "commonjs node:stream",
	// 			"node:buffer": "commonjs node:buffer",
	// 			"node:util": "commonjs node:util",
	// 			"node:crypto": "commonjs node:crypto",
	// 		});
	// 	} else {
	// 		// Exclude canvas from client-side bundle (required for react-pdf)
	// 		config.resolve = config.resolve || {};
	// 		config.resolve.alias = config.resolve.alias || {};
	// 		config.resolve.alias.canvas = false;
	// 	}
	// 	return config;
	// },
};

const sentryOptions = {
	silent: true,
	org: process.env.SENTRY_ORG,
	project: process.env.SENTRY_PROJECT,
	widenClientFileUpload: true,
};

const configWithSentry =
	process.env.SENTRY_DSN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
		? withSentryConfig(nextConfig, sentryOptions)
		: nextConfig;

export default withSentryConfig(withWorkflow(configWithSentry), {
	// For all available options, see:
	// https://www.npmjs.com/package/@sentry/webpack-plugin#options

	org: "sintesis-bi",

	project: "javascript-nextjs",

	// Only print logs for uploading source maps in CI
	silent: !process.env.CI,

	// For all available options, see:
	// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

	// Upload a larger set of source maps for prettier stack traces (increases build time)
	widenClientFileUpload: true,

	// Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
	// This can increase your server load as well as your hosting bill.
	// Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
	// side errors will fail.
	// tunnelRoute: "/monitoring",

	// Automatically tree-shake Sentry logger statements to reduce bundle size
	disableLogger: true,

	// Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
	// See the following for more information:
	// https://docs.sentry.io/product/crons/
	// https://vercel.com/docs/cron-jobs
	automaticVercelMonitors: true,
});
