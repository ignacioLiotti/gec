// next.config.ts
import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactStrictMode: true,
	reactCompiler: true,
	experimental: {
		// Required for edge workflows and background tasks
		serverActions: {
			bodySizeLimit: "2mb",
		},
	},
	webpack: (config, { isServer }) => {
		if (isServer) {
			// Externalize Node.js built-ins for server-side code
			config.externals = config.externals || [];
			config.externals.push({
				"node:stream": "commonjs node:stream",
				"node:buffer": "commonjs node:buffer",
				"node:util": "commonjs node:util",
				"node:crypto": "commonjs node:crypto",
			});
		} else {
			// Exclude canvas from client-side bundle (required for react-pdf)
			config.resolve = config.resolve || {};
			config.resolve.alias = config.resolve.alias || {};
			config.resolve.alias.canvas = false;
		}
		return config;
	},
};

export default withWorkflow(nextConfig);
