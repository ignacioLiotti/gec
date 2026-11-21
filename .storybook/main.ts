import type { StorybookConfig } from "@storybook/nextjs-vite";
import path from "node:path";

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs"],
  framework: {
    name: "@storybook/nextjs-vite",
    options: { nextConfigPath: ".storybook/next.config.mjs" },
  },
  staticDirs: ["../public"],
  core: { disableTelemetry: true },
  async viteFinal(config) {
    const { mergeConfig } = await import("vite");
    return mergeConfig(config, {
      resolve: { alias: { "@": path.resolve(import.meta.dirname, "..") } },
    });
  },
};
export default config;
