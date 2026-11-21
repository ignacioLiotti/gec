import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/textarea";

const meta = {
  title: "App UI/Textarea",
  component: C.Textarea,
  tags: ["autodocs"],
  argTypes: {},
  args: { "aria-label": "Document notes", placeholder: "Enter notes" },
} satisfies Meta<typeof C.Textarea>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Empty: Story = {};
export const Filled: Story = { args: { defaultValue: "Document notes" } };
export const Disabled: Story = { args: { disabled: true } };
export const Invalid: Story = { args: { "aria-invalid": true } };
export const ReadOnly: Story = {
  args: { readOnly: true, value: "Approved document" },
};
