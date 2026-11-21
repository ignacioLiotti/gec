import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const meta = {
  title: "App UI/DropdownMenu",
  component: C.DropdownMenu,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof C.DropdownMenu>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: function Render(args) {
    const [checked, setChecked] = React.useState(true);
    const [density, setDensity] = React.useState("compact");
    return (
      <C.DropdownMenu {...args}>
        <C.DropdownMenuTrigger asChild>
          <Button variant="outline">Actions</Button>
        </C.DropdownMenuTrigger>
        <C.DropdownMenuContent>
          <C.DropdownMenuLabel>Document actions</C.DropdownMenuLabel>
          <C.DropdownMenuGroup>
            <C.DropdownMenuItem>
              Open<C.DropdownMenuShortcut>Enter</C.DropdownMenuShortcut>
            </C.DropdownMenuItem>
            <C.DropdownMenuItem disabled>Archive</C.DropdownMenuItem>
          </C.DropdownMenuGroup>
          <C.DropdownMenuSeparator />
          <C.DropdownMenuCheckboxItem
            checked={checked}
            onCheckedChange={setChecked}
          >
            Notifications
          </C.DropdownMenuCheckboxItem>
          <C.DropdownMenuRadioGroup value={density} onValueChange={setDensity}>
            <C.DropdownMenuRadioItem value="compact">
              Compact
            </C.DropdownMenuRadioItem>
            <C.DropdownMenuRadioItem value="comfortable">
              Comfortable
            </C.DropdownMenuRadioItem>
          </C.DropdownMenuRadioGroup>
          <C.DropdownMenuSub>
            <C.DropdownMenuSubTrigger>Export</C.DropdownMenuSubTrigger>
            <C.DropdownMenuPortal>
              <C.DropdownMenuSubContent>
                <C.DropdownMenuItem>PDF</C.DropdownMenuItem>
              </C.DropdownMenuSubContent>
            </C.DropdownMenuPortal>
          </C.DropdownMenuSub>
        </C.DropdownMenuContent>
      </C.DropdownMenu>
    );
  },
};
export const Open: Story = { ...Default, args: { defaultOpen: true } };
export const WithoutHeading: Story = {
  render: () => (
    <C.DropdownMenu defaultOpen>
      <C.DropdownMenuTrigger asChild>
        <Button>Actions</Button>
      </C.DropdownMenuTrigger>
      <C.DropdownMenuContent hideHeading>
        <C.DropdownMenuItem>Open document</C.DropdownMenuItem>
      </C.DropdownMenuContent>
    </C.DropdownMenu>
  ),
};
