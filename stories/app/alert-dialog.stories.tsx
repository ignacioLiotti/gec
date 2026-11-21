import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

const meta = {
  title: "App UI/AlertDialog",
  component: C.AlertDialog,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof C.AlertDialog>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: (args) => (
    <C.AlertDialog {...args}>
      <C.AlertDialogTrigger asChild>
        <Button variant="destructive">Delete document</Button>
      </C.AlertDialogTrigger>
      <C.AlertDialogContent>
        <C.AlertDialogHeader>
          <C.AlertDialogTitle>Delete document?</C.AlertDialogTitle>
          <C.AlertDialogDescription>
            This example only closes the dialog.
          </C.AlertDialogDescription>
        </C.AlertDialogHeader>
        <C.AlertDialogFooter>
          <C.AlertDialogCancel>Cancel</C.AlertDialogCancel>
          <C.AlertDialogAction>Delete</C.AlertDialogAction>
        </C.AlertDialogFooter>
      </C.AlertDialogContent>
    </C.AlertDialog>
  ),
};
export const Open: Story = { ...Default, args: { defaultOpen: true } };
