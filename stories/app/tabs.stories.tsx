import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/tabs";

const meta = {
  title: "App UI/Tabs",
  component: C.Tabs,
  tags: ["autodocs"],
  argTypes: {},
  args: { defaultValue: "files" },
} satisfies Meta<typeof C.Tabs>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: (args) => (
    <C.Tabs {...args}>
      <C.TabsList>
        <C.TabsTrigger value="files">Files</C.TabsTrigger>
        <C.TabsTrigger value="activity">Activity</C.TabsTrigger>
        <C.TabsTrigger value="settings" disabled>
          Settings
        </C.TabsTrigger>
      </C.TabsList>
      <C.TabsContent value="files">Project files</C.TabsContent>
      <C.TabsContent value="activity">Recent changes</C.TabsContent>
    </C.Tabs>
  ),
};
export const Vertical: Story = {
  ...Default,
  args: { orientation: "vertical" },
};
