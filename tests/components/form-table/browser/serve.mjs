import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/postcss";

const root = fileURLToPath(new URL("./", import.meta.url));
const project = fileURLToPath(new URL("../../../../", import.meta.url));
const server = await createServer({
	configFile: false,
	root,
	cacheDir: `${project}/.next/cache/form-table-vite`,
	resolve: { alias: { "@": project }, dedupe: ["react", "react-dom"] },
	esbuild: { jsx: "automatic" },
	css: { postcss: { plugins: [tailwindcss()] } },
	server: { host: "127.0.0.1", port: 4317, strictPort: true, fs: { allow: [project] } },
});
await server.listen();
server.printUrls();
