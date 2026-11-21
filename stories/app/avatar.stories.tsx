import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/avatar";

const meta = {
  title: "App UI/Avatar",
  component: C.Avatar,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof C.Avatar>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Fallback: Story = {
  render: (args) => (
    <C.Avatar {...args}>
      <C.AvatarFallback>AR</C.AvatarFallback>
    </C.Avatar>
  ),
};
export const Image: Story = {
  render: (args) => (
    <C.Avatar {...args}>
      <C.AvatarImage
        src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%23ff5800'/%3E%3Ctext x='40' y='50' text-anchor='middle' font-size='28' fill='white'%3EAR%3C/text%3E%3C/svg%3E"
        alt="Alex Rivera"
      />
      <C.AvatarFallback>AR</C.AvatarFallback>
    </C.Avatar>
  ),
};
export const FailedImage: Story = {
  render: (args) => (
    <C.Avatar {...args}>
      <C.AvatarImage src="data:image/png;base64,invalid" alt="Alex Rivera" />
      <C.AvatarFallback>AR</C.AvatarFallback>
    </C.Avatar>
  ),
};
