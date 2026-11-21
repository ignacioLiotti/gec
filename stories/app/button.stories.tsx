import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/button";
import { Plus } from "lucide-react";
type PlaygroundArgs = {
  label: string;
  size: React.ComponentProps<typeof C.Button>["size"];
  disabled: boolean;
  invalid: boolean;
  showIcon: boolean;
  asLink: boolean;
  fullWidth: boolean;
};
const variants = [
  "default",
  "primary",
  "field",
  "defaultSecondary",
  "defaultTertiary",
  "dark",
  "outline",
  "secondary",
  "destructive",
  "destructiveSecondary",
  "success",
  "successSecondary",
  "ghost",
  "ghost-tile",
  "glassy",
  "link",
  "indented",
  "indented-inverse",
] as const satisfies readonly NonNullable<
  React.ComponentProps<typeof C.Button>["variant"]
>[];

const meta = {
  title: "App UI/Button",
  parameters: {
    controls: {
      include: [
        "label",
        "size",
        "disabled",
        "invalid",
        "showIcon",
        "asLink",
        "fullWidth",
      ],
    },
  },
  argTypes: {
    label: { control: "text" },
    size: {
      control: "select",
      options: [
        "default",
        "md",
        "tile",
        "xs",
        "sm",
        "lg",
        "icon",
        "icon-sm",
        "icon-lg",
      ],
    },
    disabled: { control: "boolean" },
    invalid: { control: "boolean" },
    showIcon: { control: "boolean" },
    asLink: { control: "boolean" },
    fullWidth: { control: "boolean" },
  },
  args: {
    label: "Save changes",
    size: "default",
    disabled: false,
    invalid: false,
    showIcon: false,
    asLink: false,
    fullWidth: false,
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
            <C.Button
              variant={variant}
              size={variant === "ghost-tile" && args.size === "default" ? "tile" : args.size}
              disabled={args.disabled}
              aria-invalid={args.invalid}
              aria-label={args.label}
              asChild={args.asLink}
              fullWidth={args.fullWidth}
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
            </C.Button>
          </div>
        );
      })}
    </div>
  ),
};
