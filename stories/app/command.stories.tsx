import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/command";
import { Button } from "@/components/ui/button";
function CommandDialogExample() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open command palette</Button>
      <C.CommandDialog open={open} onOpenChange={setOpen}>
        <C.CommandInput placeholder="Search..." />
        <C.CommandList>
          <C.CommandEmpty>No results</C.CommandEmpty>
          <C.CommandItem>Contract</C.CommandItem>
        </C.CommandList>
      </C.CommandDialog>
    </>
  );
}
const meta = {
  title: "App UI/Command",
  component: C.Command,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof C.Command>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: (args) => (
    <C.Command {...args}>
      <C.CommandInput placeholder="Search documents..." />
      <C.CommandList>
        <C.CommandEmpty>No documents found.</C.CommandEmpty>
        <C.CommandGroup heading="Documents">
          <C.CommandItem>
            Contract<C.CommandShortcut>Enter</C.CommandShortcut>
          </C.CommandItem>
          <C.CommandItem>Invoice</C.CommandItem>
          <C.CommandItem disabled>Archived certificate</C.CommandItem>
        </C.CommandGroup>
        <C.CommandSeparator />
        <C.CommandGroup heading="Actions">
          <C.CommandItem>New document</C.CommandItem>
        </C.CommandGroup>
      </C.CommandList>
    </C.Command>
  ),
};
export const Dialog: Story = { render: () => <CommandDialogExample /> };
