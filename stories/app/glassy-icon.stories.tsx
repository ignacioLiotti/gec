import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/glassy-icon";

const meta = {
  title: "App UI/GlassyIcon",
  component: C.GlassyIcon,
  tags: ["autodocs"],
  argTypes: {},
  args: { title: "Document", children: <span className="px-3">A</span> },
} satisfies Meta<typeof C.GlassyIcon>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Sizes: Story = {
  render: (args) => (
    <div className="sb-row">
      {[8, 10, 12].map((size) => (
        <C.GlassyIcon
          {...args}
          key={size}
          size={size}
          className={size === 8 ? "h-8" : size === 10 ? "h-10" : "h-12"}
        />
      ))}
    </div>
  ),
};
