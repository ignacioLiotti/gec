import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/card";

const meta = {
  title: "App UI/Card",
  component: C.Card,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof C.Card>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Complete: Story = {
  render: (args) => (
    <C.Card {...args}>
      <C.CardHeader>
        <C.CardTitle>Project documents</C.CardTitle>
        <C.CardDescription>Files awaiting review</C.CardDescription>
        <C.CardAction>12</C.CardAction>
      </C.CardHeader>
      <C.CardContent>Three documents are ready.</C.CardContent>
      <C.CardFooter>Updated today</C.CardFooter>
    </C.Card>
  ),
};
export const ContentOnly: Story = {
  render: (args) => (
    <C.Card {...args}>
      <C.CardContent>Compact content panel</C.CardContent>
    </C.Card>
  ),
};
export const Flush: Story = { ...Complete, args: { variant: "flush" } };
export const Warning: Story = { ...Complete, args: { variant: "warning" } };
export const Destructive: Story = { ...Complete, args: { variant: "destructive" } };
