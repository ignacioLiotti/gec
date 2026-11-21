import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/switch";

const meta = {
  title: "App UI/Switch",
  component: C.Switch,
  tags: ["autodocs"],
  argTypes: {},
  args: { "aria-label": "Enable notifications" },
} satisfies Meta<typeof C.Switch>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Unchecked: Story = {};
export const Checked: Story = { args: { defaultChecked: true } };
export const Disabled: Story = { args: { disabled: true } };
export const CheckedDisabled: Story = {
  args: { defaultChecked: true, disabled: true },
};
export const Invalid: Story = { args: { "aria-invalid": true } };

export const SizeSm: Story = { args: { size: "sm" } };
export const SizeMd: Story = { args: { size: "md" } };
export const SizeLg: Story = { args: { size: "lg" } };
