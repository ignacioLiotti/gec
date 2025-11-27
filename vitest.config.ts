import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		globals: true,
		clearMocks: true,
		environment: "node",
		include: ["tests/**/*.test.ts"],
		setupFiles: ["./vitest.setup.ts"],
		threads: false,
		pool: "threads",
	},
});
