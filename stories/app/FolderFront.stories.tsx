import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import C from "@/components/ui/FolderFront";

const meta = {
  title: "App UI/FolderFront",
  component: C,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof C>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Dashed: Story = { args: { borderDashed: true } };
export const CustomGradient: Story = {
  args: {
    firstStopColor: "var(--color-orange-primary)",
    secondStopColor: "var(--color-surface)",
  },
};
