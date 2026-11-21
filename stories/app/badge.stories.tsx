import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/badge";
import { Plus } from "lucide-react";
type PlaygroundArgs = {
  label: string;
  size: React.ComponentProps<typeof C.Badge>["size"];
  shape: React.ComponentProps<typeof C.Badge>["shape"];
  dot: boolean;
  showCount: boolean;
  count: number;
  leadingIcon: boolean;
  trailingIcon: boolean;
};
const variants = [
  "default",
  "defaultSolid",
  "secondary",
  "neutral",
  "category",
  "outline",
  "info",
  "infoSolid",
  "destructive",
  "destructiveSolid",
  "success",
  "successSolid",
  "warning",
  "warningSolid",
] as const satisfies readonly NonNullable<
  React.ComponentProps<typeof C.Badge>["variant"]
>[];

const meta = {
  title: "App UI/Badge",
  parameters: {
    controls: {
      include: [
        "label",
        "size",
        "shape",
        "dot",
        "showCount",
        "count",
        "leadingIcon",
        "trailingIcon",
      ],
    },
  },
  argTypes: {
    label: { control: "text" },
    size: { control: "select", options: ["xs", "sm", "md", "lg"] },
    shape: { control: "select", options: ["rounded", "pill"] },
    dot: { control: "boolean" },
    showCount: { control: "boolean" },
    count: { control: "number" },
    leadingIcon: { control: "boolean" },
    trailingIcon: { control: "boolean" },
  },
  args: {
    label: "In review",
    size: "sm",
    shape: "rounded",
    dot: false,
    showCount: false,
    count: 12,
    leadingIcon: false,
    trailingIcon: false,
  },
} satisfies Meta<PlaygroundArgs>;
export default meta;
type Story = StoryObj<PlaygroundArgs>;
export const Playground: Story = {
  args: meta.args,
  render: (args) => (
    <div className="sb-grid">
      {variants.map((variant) => (
        <div className="sb-sample" key={variant}>
          <code className="sb-caption">{variant}</code>
          <C.Badge
            variant={variant}
            size={args.size}
            shape={args.shape}
            dot={args.dot}
            count={args.showCount ? args.count : undefined}
            leadingIcon={args.leadingIcon ? <Plus /> : undefined}
            trailingIcon={args.trailingIcon ? <Plus /> : undefined}
          >
            {args.label}
          </C.Badge>
        </div>
      ))}
    </div>
  ),
};
