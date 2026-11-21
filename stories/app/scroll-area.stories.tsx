import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/scroll-area";

const meta = {
  title: "App UI/ScrollArea",
  component: C.ScrollArea,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof C.ScrollArea>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Vertical: Story = {
  render: (args) => (
    <C.ScrollArea
      {...args}
      className="h-48 w-64 border border-stroke rounded-md"
    >
      <div className="p-4">
        {Array.from({ length: 30 }, (_, i) => (
          <p key={i}>Document {i + 1}</p>
        ))}
      </div>
    </C.ScrollArea>
  ),
};
export const Horizontal: Story = {
  render: (args) => (
    <C.ScrollArea {...args} className="w-64 border border-stroke rounded-md">
      <div className="flex w-max gap-6 p-4">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i}>Document {i + 1}</span>
        ))}
      </div>
      <C.ScrollBar orientation="horizontal" />
    </C.ScrollArea>
  ),
};
