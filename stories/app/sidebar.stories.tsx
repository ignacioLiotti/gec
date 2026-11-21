import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/sidebar";
import { FileText, Plus } from "lucide-react";
function SidebarExample(props: React.ComponentProps<typeof C.Sidebar>) {
  return (
    <C.SidebarProvider>
      <C.Sidebar {...props}>
        <C.SidebarHeader>
          <C.SidebarInput
            placeholder="Search navigation"
            aria-label="Search navigation"
          />
        </C.SidebarHeader>
        <C.SidebarSeparator />
        <C.SidebarContent>
          <C.SidebarGroup>
            <C.SidebarGroupLabel>Workspace</C.SidebarGroupLabel>
            <C.SidebarGroupAction aria-label="Add workspace">
              <Plus />
            </C.SidebarGroupAction>
            <C.SidebarGroupContent>
              <C.SidebarMenu>
                {(["sm", "default", "lg"] as const).map((size, i) => (
                  <C.SidebarMenuItem key={size}>
                    <C.SidebarMenuButton size={size} isActive={i === 0}>
                      <FileText />
                      <span>Documents {size}</span>
                    </C.SidebarMenuButton>
                    <C.SidebarMenuBadge>{i + 1}</C.SidebarMenuBadge>
                    <C.SidebarMenuAction aria-label="Add document">
                      <Plus />
                    </C.SidebarMenuAction>
                  </C.SidebarMenuItem>
                ))}
                <C.SidebarMenuItem>
                  <C.SidebarMenuButton disabled>Disabled</C.SidebarMenuButton>
                  <C.SidebarMenuSub>
                    {(["sm", "md"] as const).map((size) => (
                      <C.SidebarMenuSubItem key={size}>
                        <C.SidebarMenuSubButton size={size} href="#example">
                          Revision {size}
                        </C.SidebarMenuSubButton>
                      </C.SidebarMenuSubItem>
                    ))}
                  </C.SidebarMenuSub>
                </C.SidebarMenuItem>
                <C.SidebarMenuSkeleton showIcon />
              </C.SidebarMenu>
            </C.SidebarGroupContent>
          </C.SidebarGroup>
        </C.SidebarContent>
        <C.SidebarFooter>Alex Rivera</C.SidebarFooter>
        <C.SidebarRail />
      </C.Sidebar>
      <C.SidebarInset>
        <C.SidebarTrigger />
        <p className="p-4">Workspace content</p>
      </C.SidebarInset>
    </C.SidebarProvider>
  );
}
const meta = {
  title: "App UI/Sidebar",
  component: C.Sidebar,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof C.Sidebar>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: (args) => <SidebarExample {...args} />,
};
export const Floating: Story = { ...Default, args: { variant: "floating" } };
export const Inset: Story = { ...Default, args: { variant: "inset" } };
export const Right: Story = { ...Default, args: { side: "right" } };
export const IconCollapse: Story = {
  ...Default,
  args: { collapsible: "icon" },
};
export const Static: Story = { ...Default, args: { collapsible: "none" } };
