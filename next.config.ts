// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactStrictMode: true,
	reactCompiler: true,
	experimental: {
		serverActions: {
			bodySizeLimit: "2mb",
		},
		serverComponentsExternalPackages: [
			"node-fetch",
			"undici",
			"@react-email/components",
			"@react-email/render",
			"@react-email/tailwind",
			"@supabase/node-fetch",
		],
		// 👇 Fuerza desactivar Turbopack por completo
		turbo: false,
	},

	// 👇 Le avisás a Next.js que querés Webpack y evitás el error
	webpack: (config, { isServer }) => {
		if (isServer) {
			config.externals = config.externals || [];
			config.externals.push({
				"node:stream": "commonjs node:stream",
				"node:buffer": "commonjs node:buffer",
				"node:util": "commonjs node:util",
				"node:crypto": "commonjs node:crypto",
			});
		} else {
			config.resolve = config.resolve || {};
			config.resolve.alias = config.resolve.alias || {};
			config.resolve.alias.canvas = false;
		}
		return config;
	},
};

export default nextConfig;
