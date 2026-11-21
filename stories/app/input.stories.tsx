import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/input";

const meta = {
  title: "App UI/Input",
  component: C.Input,
  tags: ["autodocs"],
  argTypes: {},
  args: { "aria-label": "Document notes", placeholder: "Enter notes" },
} satisfies Meta<typeof C.Input>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Empty: Story = {};
export const Filled: Story = { args: { defaultValue: "Document notes" } };
export const Disabled: Story = { args: { disabled: true } };
export const Invalid: Story = { args: { "aria-invalid": true } };
export const ReadOnly: Story = {
  args: { readOnly: true, value: "Approved document" },
};
export const Search: Story = { args: { type: "search" } };
export const Password: Story = { args: { type: "password" } };
export const Number: Story = { args: { type: "number" } };
export const Date: Story = { args: { type: "date" } };
export const File: Story = { args: { type: "file" } };
export const Email: Story = { args: { type: "email" } };
