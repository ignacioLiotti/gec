import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const meta = {
  title: "App UI/Sheet",
  component: C.Sheet,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof C.Sheet>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Left: Story = {
  render: (args) => (
    <C.Sheet {...args}>
      <C.SheetTrigger asChild>
        <Button>Open left sheet</Button>
      </C.SheetTrigger>
      <C.SheetContent side="left">
        <C.SheetHeader>
          <C.SheetTitle>Document details</C.SheetTitle>
          <C.SheetDescription>Review the current revision.</C.SheetDescription>
        </C.SheetHeader>
        <p className="p-4">Contract revision 2</p>
        <C.SheetFooter>
          <C.SheetClose asChild>
            <Button>Close</Button>
          </C.SheetClose>
        </C.SheetFooter>
      </C.SheetContent>
    </C.Sheet>
  ),
};
export const Right: Story = {
  render: (args) => (
    <C.Sheet {...args}>
      <C.SheetTrigger asChild>
        <Button>Open right sheet</Button>
      </C.SheetTrigger>
      <C.SheetContent side="right">
        <C.SheetHeader>
          <C.SheetTitle>Document details</C.SheetTitle>
          <C.SheetDescription>Review the current revision.</C.SheetDescription>
        </C.SheetHeader>
        <p className="p-4">Contract revision 2</p>
        <C.SheetFooter>
          <C.SheetClose asChild>
            <Button>Close</Button>
          </C.SheetClose>
        </C.SheetFooter>
      </C.SheetContent>
    </C.Sheet>
  ),
};
export const Top: Story = {
  render: (args) => (
    <C.Sheet {...args}>
      <C.SheetTrigger asChild>
        <Button>Open top sheet</Button>
      </C.SheetTrigger>
      <C.SheetContent side="top">
        <C.SheetHeader>
          <C.SheetTitle>Document details</C.SheetTitle>
          <C.SheetDescription>Review the current revision.</C.SheetDescription>
        </C.SheetHeader>
        <p className="p-4">Contract revision 2</p>
        <C.SheetFooter>
          <C.SheetClose asChild>
            <Button>Close</Button>
          </C.SheetClose>
        </C.SheetFooter>
      </C.SheetContent>
    </C.Sheet>
  ),
};
export const Bottom: Story = {
  render: (args) => (
    <C.Sheet {...args}>
      <C.SheetTrigger asChild>
        <Button>Open bottom sheet</Button>
      </C.SheetTrigger>
      <C.SheetContent side="bottom">
        <C.SheetHeader>
          <C.SheetTitle>Document details</C.SheetTitle>
          <C.SheetDescription>Review the current revision.</C.SheetDescription>
        </C.SheetHeader>
        <p className="p-4">Contract revision 2</p>
        <C.SheetFooter>
          <C.SheetClose asChild>
            <Button>Close</Button>
          </C.SheetClose>
        </C.SheetFooter>
      </C.SheetContent>
    </C.Sheet>
  ),
};
export const Open: Story = { ...Right, args: { defaultOpen: true } };
