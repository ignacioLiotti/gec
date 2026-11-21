import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/separator";

const meta = {
  title: "App UI/Separator",
  component: C.Separator,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof C.Separator>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Horizontal: Story = {
  render: (args) => (
    <div className="sb-stack">
      Documents
      <C.Separator {...args} />
      Activity
    </div>
  ),
};
export const Vertical: Story = {
  render: (args) => (
    <div className="sb-row h-12">
      Documents
      <C.Separator {...args} orientation="vertical" />
      Activity
    </div>
  ),
};
