import React, { useEffect } from "react";
import type { Preview } from "@storybook/nextjs-vite";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "../app/globals.css";
import "./preview.css";
import "../stories/redesign/proposal.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const serif = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-geist-serif",
});

function Theme({
  theme,
  design,
  children,
}: {
  theme: string;
  design: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const fontClasses = [sans.variable, mono.variable, serif.variable];
    document.documentElement.classList.add(...fontClasses);
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    document.documentElement.dataset.design = design;
    return () => {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.remove(...fontClasses);
      delete document.documentElement.dataset.design;
    };
  }, [theme, design]);
  return (
    <div
      className={`${sans.variable} ${mono.variable} ${serif.variable} sb-canvas`}
    >
      <TooltipProvider>{children}</TooltipProvider>
    </div>
  );
}

const preview: Preview = {
  globalTypes: {
    design: {
      description: "Diseño de componentes",
      toolbar: {
        icon: "paintbrush",
        items: [
          { value: "current", title: "Actual local" },
          { value: "paper", title: "Propuesta · Papel" },
        ],
        dynamicTitle: true,
      },
    },
    theme: {
      description: "Product theme",
      toolbar: {
        icon: "circlehollow",
        items: ["light", "dark"],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light", design: "current" },
  decorators: [
    (Story, context) => (
      <Theme
        theme={context.globals.theme}
        design={context.globals.design ?? "current"}
      >
        <Story />
      </Theme>
    ),
  ],
  parameters: {
    layout: "padded",
    nextjs: { appDirectory: true },
    controls: { expanded: true },
    options: {
      storySort: { order: ["Foundations", "App UI", "Shared system"] },
    },
  },
};
export default preview;
