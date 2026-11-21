import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/design-system/components/toast";
import { Plus } from "lucide-react";
type PlaygroundArgs = {
  heading: string;
  description: string;
  dismissible: boolean;
  customIcon: boolean;
  stacked: boolean;
};
const variants = [
  "default",
  "info",
  "success",
  "warning",
  "destructive",
] as const satisfies readonly NonNullable<
  React.ComponentProps<typeof C.Toast>["variant"]
>[];
function ToastExample({
  variant,
  ...args
}: PlaygroundArgs & {
  variant: React.ComponentProps<typeof C.Toast>["variant"];
}) {
  const [visible, setVisible] = React.useState(true);
  return visible ? (
    <C.Toast
      variant={variant}
      heading={args.heading}
      description={args.description}
      icon={args.customIcon ? <Plus /> : undefined}
      onDismiss={args.dismissible ? () => setVisible(false) : undefined}
    />
  ) : (
    <button onClick={() => setVisible(true)}>Show notification</button>
  );
}
const meta = {
  title: "Shared system/Toast",
  parameters: {
    controls: {
      include: [
        "heading",
        "description",
        "dismissible",
        "customIcon",
        "stacked",
      ],
    },
  },
  argTypes: {
    heading: { control: "text" },
    description: { control: "text" },
    dismissible: { control: "boolean" },
    customIcon: { control: "boolean" },
    stacked: { control: "boolean" },
  },
  args: {
    heading: "Changes saved",
    description: "The document is ready for review.",
    dismissible: false,
    customIcon: false,
    stacked: false,
  },
} satisfies Meta<PlaygroundArgs>;
export default meta;
type Story = StoryObj<PlaygroundArgs>;
export const Playground: Story = {
  args: meta.args,
  render: (args) => (
    <>
      <div className="sb-grid">
        {variants.map((variant) => (
          <div className="sb-sample" key={variant}>
            <code className="sb-caption">{variant}</code>
            <ToastExample {...args} variant={variant} />
          </div>
        ))}
      </div>
      {args.stacked && (
        <C.ToastViewport>
          {variants.slice(0, 3).map((variant) => (
            <ToastExample key={variant} {...args} variant={variant} />
          ))}
        </C.ToastViewport>
      )}
    </>
  ),
};
