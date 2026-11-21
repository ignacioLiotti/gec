import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

const meta = {
  title: "App UI/Tooltip",
  component: C.Tooltip,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof C.Tooltip>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: (args) => (
    <C.Tooltip {...args}>
      <C.TooltipTrigger asChild>
        <Button variant="outline">Hover or focus</Button>
      </C.TooltipTrigger>
      <C.TooltipContent>Open document details</C.TooltipContent>
    </C.Tooltip>
  ),
};
export const Open: Story = { ...Default, args: { defaultOpen: true } };
export const Top: Story = {
  render: () => (
    <C.Tooltip defaultOpen>
      <C.TooltipTrigger asChild>
        <Button>Anchor</Button>
      </C.TooltipTrigger>
      <C.TooltipContent side="top">top tooltip</C.TooltipContent>
    </C.Tooltip>
  ),
};
export const Bottom: Story = {
  render: () => (
    <C.Tooltip defaultOpen>
      <C.TooltipTrigger asChild>
        <Button>Anchor</Button>
      </C.TooltipTrigger>
      <C.TooltipContent side="bottom">bottom tooltip</C.TooltipContent>
    </C.Tooltip>
  ),
};
export const Left: Story = {
  render: () => (
    <C.Tooltip defaultOpen>
      <C.TooltipTrigger asChild>
        <Button>Anchor</Button>
      </C.TooltipTrigger>
      <C.TooltipContent side="left">left tooltip</C.TooltipContent>
    </C.Tooltip>
  ),
};
export const Right: Story = {
  render: () => (
    <C.Tooltip defaultOpen>
      <C.TooltipTrigger asChild>
        <Button>Anchor</Button>
      </C.TooltipTrigger>
      <C.TooltipContent side="right">right tooltip</C.TooltipContent>
    </C.Tooltip>
  ),
};
