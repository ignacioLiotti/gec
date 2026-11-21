import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/context-menu";

const meta = {
  title: "App UI/ContextMenu",
  component: C.ContextMenu,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof C.ContextMenu>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: (args) => (
    <C.ContextMenu {...args}>
      <C.ContextMenuTrigger className="block border border-stroke rounded-md p-6">
        Right-click this document
      </C.ContextMenuTrigger>
      <C.ContextMenuContent>
        <C.ContextMenuLabel>Document</C.ContextMenuLabel>
        <C.ContextMenuGroup>
          <C.ContextMenuItem>
            Open<C.ContextMenuShortcut>Enter</C.ContextMenuShortcut>
          </C.ContextMenuItem>
          <C.ContextMenuItem disabled>Archive</C.ContextMenuItem>
        </C.ContextMenuGroup>
        <C.ContextMenuSeparator />
        <C.ContextMenuCheckboxItem checked>
          Notifications
        </C.ContextMenuCheckboxItem>
        <C.ContextMenuRadioGroup value="draft">
          <C.ContextMenuRadioItem value="draft">Draft</C.ContextMenuRadioItem>
          <C.ContextMenuRadioItem value="review">Review</C.ContextMenuRadioItem>
        </C.ContextMenuRadioGroup>
        <C.ContextMenuSub>
          <C.ContextMenuSubTrigger>Export</C.ContextMenuSubTrigger>
          <C.ContextMenuPortal>
            <C.ContextMenuSubContent>
              <C.ContextMenuItem>PDF</C.ContextMenuItem>
            </C.ContextMenuSubContent>
          </C.ContextMenuPortal>
        </C.ContextMenuSub>
      </C.ContextMenuContent>
    </C.ContextMenu>
  ),
};
