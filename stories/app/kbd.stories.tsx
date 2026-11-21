import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/kbd";

const meta = {
  title: "App UI/Kbd",
  component: C.Kbd,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof C.Kbd>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Key: Story = { args: { children: "Enter" } };
export const Group: Story = {
  render: () => (
    <C.KbdGroup>
      <C.Kbd>Ctrl</C.Kbd>
      <span>+</span>
      <C.Kbd>K</C.Kbd>
    </C.KbdGroup>
  ),
};
