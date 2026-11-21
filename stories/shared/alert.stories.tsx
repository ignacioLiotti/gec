import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/design-system/components/alert";
type PlaygroundArgs = { heading: string; description: string };
const variants = [
  "default",
  "info",
  "success",
  "warning",
  "destructive",
] as const satisfies readonly NonNullable<
  React.ComponentProps<typeof C.Alert>["variant"]
>[];

const meta = {
  title: "Shared system/Alert",
  parameters: { controls: { include: ["heading", "description"] } },
  argTypes: { heading: { control: "text" }, description: { control: "text" } },
  args: {
    heading: "Review required",
    description: "Check the document before approving it.",
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
          <C.Alert variant={variant}>
            <C.AlertTitle>{args.heading}</C.AlertTitle>
            {args.description && (
              <C.AlertDescription>{args.description}</C.AlertDescription>
            )}
          </C.Alert>
        </div>
      ))}
    </div>
  ),
};
