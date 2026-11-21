import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import C from "@/components/ui/FolderFrontEmpty";

const meta = {
  title: "App UI/FolderFrontEmpty",
  component: C,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof C>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
