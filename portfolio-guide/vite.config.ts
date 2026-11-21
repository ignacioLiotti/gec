import { defineConfig } from "vite";
import path from "node:path";
const root = import.meta.dirname;
const repo = path.resolve(root, "..");
export default defineConfig({
  plugins: [
    {
      name: "guide-document-styles",
      enforce: "pre",
      transform(code, id) {
        if (
          !/\/file-manager\/components\/document-(sheet|preview)\.tsx$/.test(
            id.replaceAll("\\", "/"),
          )
        )
          return;
        // These viewer rules already use component-specific class names. Each guide
        // screen has its own document, so they can run without Next's styled-jsx compiler.
        return {
          code: code.replace(
            /<style jsx>\{`([\s\S]*?)`\}<\/style>/g,
            (_, css: string) =>
              "<style>{`" +
              css.replace(/:global\(([^)]+)\)/g, "$1") +
              "`}</style>",
          ),
          map: null,
        };
      },
    },
  ],
  root,
  base: "./",
  envDir: root,
  envPrefix: "GUIDE_PUBLIC_",
  publicDir: "public",
  resolve: {
    alias: [
      { find: "next/link", replacement: path.join(root, "runtime/link.tsx") },
      {
        find: "next/navigation",
        replacement: path.join(root, "runtime/navigation.ts"),
      },
      {
        find: "next/dynamic",
        replacement: path.join(root, "runtime/dynamic.tsx"),
      },
      {
        find: "@/lib/pdf/generate-pdf",
        replacement: path.join(root, "runtime/print.ts"),
      },
      {
        find: /^\.\/export-xlsx-server$/,
        replacement: path.join(root, "runtime/xlsx.ts"),
      },
      { find: "@", replacement: repo },
    ],
  },
  define: { "process.env": "{}" },
  esbuild: { jsx: "automatic" },
  server: {
    host: "127.0.0.1",
    port: 4175,
    strictPort: true,
    fs: { allow: [repo] },
  },
  preview: { host: "127.0.0.1", port: 4176, strictPort: true },
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
        if (warning.code === "SOURCEMAP_ERROR") return;
        warn(warning);
      },
    },
  },
});
