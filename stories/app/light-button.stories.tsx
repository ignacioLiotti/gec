import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/button";
import { Plus } from "lucide-react";
type PlaygroundArgs = {
  label: string;
  size: React.ComponentProps<typeof C.LightButton>["size"];
  disabled: boolean;
  invalid: boolean;
  showIcon: boolean;
  asLink: boolean;
  pressed: boolean;
  expanded: boolean;
};
const variants = [
  "default",
  "primary",
  "primarySolid",
  "secondary",
  "destructive",
  "destructiveSolid",
  "success",
  "successSolid",
  "warning",
  "warningSolid",
  "darkSolid",
  "ghost",
  "selected",
] as const satisfies readonly NonNullable<
  React.ComponentProps<typeof C.LightButton>["variant"]
>[];

const meta = {
  title: "App UI/LightButton",
  parameters: {
    controls: {
      include: [
        "label",
        "size",
        "disabled",
        "invalid",
        "showIcon",
        "asLink",
        "pressed",
        "expanded",
      ],
    },
  },
  argTypes: {
    label: { control: "text" },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon", "icon-sm", "icon-lg"],
    },
    disabled: { control: "boolean" },
    invalid: { control: "boolean" },
    showIcon: { control: "boolean" },
    asLink: { control: "boolean" },
    pressed: { control: "boolean" },
    expanded: { control: "boolean" },
  },
  args: {
    label: "Save changes",
    size: "default",
    disabled: false,
    invalid: false,
    showIcon: false,
    asLink: false,
    pressed: false,
    expanded: false,
  },
} satisfies Meta<PlaygroundArgs>;
export default meta;
type Story = StoryObj<PlaygroundArgs>;
export const Playground: Story = {
  args: meta.args,
  render: (args) => (
    <div className="sb-grid">
      {variants.map((variant) => {
        const iconOnly = args.size?.startsWith("icon");
        const content = (
          <>
            {" "}
            {(args.showIcon || iconOnly) && <Plus />}
            {!iconOnly && args.label}
          </>
        );
        return (
          <div className="sb-sample" key={variant}>
            <code className="sb-caption">{variant}</code>
            <C.LightButton
              variant={variant}
              size={args.size}
              disabled={args.disabled}
              aria-invalid={args.invalid}
              aria-label={args.label}
              asChild={args.asLink}
              aria-pressed={args.pressed}
              data-state={args.expanded ? "open" : undefined}
            >
              {args.asLink ? (
                <a
                  href="#example"
                  onClick={(event) => event.preventDefault()}
                  aria-disabled={args.disabled}
                  tabIndex={args.disabled ? -1 : undefined}
                >
                  {content}
                </a>
              ) : (
                content
              )}
            </C.LightButton>
          </div>
        );
      })}
    </div>
  ),
};
