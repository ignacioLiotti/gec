// next.config.ts
import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactStrictMode: true,
	reactCompiler: true,

	experimental: {
		serverActions: {
			bodySizeLimit: "2mb",
		},
		// This is the key fix for Supabase + Vercel in 2025
		serverComponentsExternalPackages: [
			"@supabase/node-fetch",
			// Also add these if you ever use them directly
			// "node-fetch", "undici", etc.
		],
	},

	webpack: (config, { isServer }) => {
		if (isServer) {
			// Keep your existing externals (good for SSR/Edge)
			config.externals = config.externals || [];
			config.externals.push({
				"node:stream": "commonjs node:stream",
				"node:buffer": "commonjs node:buffer",
				"node:util": "commonjs node:util",
				"node:crypto": "commonjs node:crypto",
			});
		} else {
			// Client-side: stub out canvas (for react-pdf)
			config.resolve = config.resolve || {};
			config.resolve.alias = config.resolve.alias || {};
			config.resolve.alias.canvas = false;

			// Optional: aggressively stub Node.js builtins on client
			config.resolve.fallback = {
				...config.resolve.fallback,
				stream: false,
				http: false,
				https: false,
				url: false,
				zlib: false,
				crypto: false,
				buffer: false,
			};
		}

		return config;
	},
};

export default withWorkflow(nextConfig);
