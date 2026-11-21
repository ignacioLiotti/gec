import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const meta = {
  title: "App UI/Dialog",
  component: C.Dialog,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof C.Dialog>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: (args) => (
    <C.Dialog {...args}>
      <C.DialogTrigger asChild>
        <Button>Open dialog</Button>
      </C.DialogTrigger>
      <C.DialogContent>
        <C.DialogHeader>
          <C.DialogTitle>Review document</C.DialogTitle>
          <C.DialogDescription>
            Check the details before continuing.
          </C.DialogDescription>
        </C.DialogHeader>
        <div className="p-4">Contract, revision 2</div>
        <C.DialogFooter>
          <C.DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </C.DialogClose>
          <C.DialogClose asChild>
            <Button>Confirm</Button>
          </C.DialogClose>
        </C.DialogFooter>
      </C.DialogContent>
    </C.Dialog>
  ),
};
export const InitiallyOpen: Story = { ...Default, args: { defaultOpen: true } };
export const WithoutCloseIcon: Story = {
  render: () => (
    <C.Dialog defaultOpen>
      <C.DialogTrigger asChild>
        <Button>Open dialog</Button>
      </C.DialogTrigger>
      <C.DialogContent showCloseButton={false}>
        <C.DialogHeader>
          <C.DialogTitle>Review document</C.DialogTitle>
          <C.DialogDescription>
            Close using the footer action.
          </C.DialogDescription>
        </C.DialogHeader>
        <C.DialogFooter>
          <C.DialogClose asChild>
            <Button>Close</Button>
          </C.DialogClose>
        </C.DialogFooter>
      </C.DialogContent>
    </C.Dialog>
  ),
};
