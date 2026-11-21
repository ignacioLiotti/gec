import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

const meta = {
  title: "App UI/Popover",
  component: C.Popover,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof C.Popover>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: (args) => (
    <C.Popover {...args}>
      <C.PopoverTrigger asChild>
        <Button variant="outline">Open details</Button>
      </C.PopoverTrigger>
      <C.PopoverContent>
        <p>Contract revision 2</p>
        <p className="text-content-muted">Updated by Alex Rivera</p>
      </C.PopoverContent>
    </C.Popover>
  ),
};
export const Open: Story = { ...Default, args: { defaultOpen: true } };
export const Top: Story = {
  render: () => (
    <C.Popover defaultOpen>
      <C.PopoverTrigger asChild>
        <Button>Anchor</Button>
      </C.PopoverTrigger>
      <C.PopoverContent side="top">Details</C.PopoverContent>
    </C.Popover>
  ),
};
export const Bottom: Story = {
  render: () => (
    <C.Popover defaultOpen>
      <C.PopoverTrigger asChild>
        <Button>Anchor</Button>
      </C.PopoverTrigger>
      <C.PopoverContent side="bottom">Details</C.PopoverContent>
    </C.Popover>
  ),
};
export const Left: Story = {
  render: () => (
    <C.Popover defaultOpen>
      <C.PopoverTrigger asChild>
        <Button>Anchor</Button>
      </C.PopoverTrigger>
      <C.PopoverContent side="left">Details</C.PopoverContent>
    </C.Popover>
  ),
};
export const Right: Story = {
  render: () => (
    <C.Popover defaultOpen>
      <C.PopoverTrigger asChild>
        <Button>Anchor</Button>
      </C.PopoverTrigger>
      <C.PopoverContent side="right">Details</C.PopoverContent>
    </C.Popover>
  ),
};
