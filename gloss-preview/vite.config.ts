import { defineConfig } from "vite";
import path from "node:path";
const root = import.meta.dirname;
export default defineConfig({
  root,
  base: "./",
  envDir: root,
  envPrefix: "GLOSS_PREVIEW_PUBLIC_",
  publicDir: "public",
  resolve: { alias: { "@": path.resolve(root, "..") } },
  define: { "process.env": "{}" },
  esbuild: { jsx: "automatic" },
  server: {
    host: "127.0.0.1",
    port: 4180,
    strictPort: true,
    fs: { allow: [path.resolve(root, "..")] },
  },
  preview: { host: "127.0.0.1", port: 4181, strictPort: true },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      onwarn(warning, warn) {
        if (
          warning.code === "MODULE_LEVEL_DIRECTIVE" &&
          warning.message.includes("use client")
        )
          return;
        warn(warning);
      },
    },
  },
});
