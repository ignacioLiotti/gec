import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/notch-tail";

const meta = {
  title: "App UI/NotchTail",
  component: C.NotchTail,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof C.NotchTail>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Left: Story = {
  render: () => (
    <div className="p-6">
      <div className="relative mx-auto h-12 w-48 border border-stroke bg-surface">
        <C.NotchTail side="left" />
      </div>
    </div>
  ),
};
export const Right: Story = {
  render: () => (
    <div className="p-6">
      <div className="relative mx-auto h-12 w-48 border border-stroke bg-surface">
        <C.NotchTail side="right" />
      </div>
    </div>
  ),
};
