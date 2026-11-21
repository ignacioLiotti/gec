import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";

const meta = {
  title: "App UI/HoverCard",
  component: C.HoverCard,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof C.HoverCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: (args) => (
    <C.HoverCard {...args}>
      <C.HoverCardTrigger asChild>
        <Button variant="outline">Hover details</Button>
      </C.HoverCardTrigger>
      <C.HoverCardContent>
        <p>Contract revision 2</p>
        <p className="text-content-muted">Updated by Alex Rivera</p>
      </C.HoverCardContent>
    </C.HoverCard>
  ),
};
export const Open: Story = { ...Default, args: { defaultOpen: true } };
export const Top: Story = {
  render: () => (
    <C.HoverCard defaultOpen>
      <C.HoverCardTrigger asChild>
        <Button>Anchor</Button>
      </C.HoverCardTrigger>
      <C.HoverCardContent side="top">Details</C.HoverCardContent>
    </C.HoverCard>
  ),
};
export const Bottom: Story = {
  render: () => (
    <C.HoverCard defaultOpen>
      <C.HoverCardTrigger asChild>
        <Button>Anchor</Button>
      </C.HoverCardTrigger>
      <C.HoverCardContent side="bottom">Details</C.HoverCardContent>
    </C.HoverCard>
  ),
};
export const Left: Story = {
  render: () => (
    <C.HoverCard defaultOpen>
      <C.HoverCardTrigger asChild>
        <Button>Anchor</Button>
      </C.HoverCardTrigger>
      <C.HoverCardContent side="left">Details</C.HoverCardContent>
    </C.HoverCard>
  ),
};
export const Right: Story = {
  render: () => (
    <C.HoverCard defaultOpen>
      <C.HoverCardTrigger asChild>
        <Button>Anchor</Button>
      </C.HoverCardTrigger>
      <C.HoverCardContent side="right">Details</C.HoverCardContent>
    </C.HoverCard>
  ),
};
