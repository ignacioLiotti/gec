import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/skeleton";

const meta = {
  title: "App UI/Skeleton",
  component: C.Skeleton,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof C.Skeleton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Text: Story = { args: { className: "h-4 w-64" } };
export const Avatar: Story = { args: { className: "size-12 rounded-full" } };
export const Panel: Story = {
  render: () => (
    <div className="sb-stack">
      <C.Skeleton className="h-32 w-full" />
      <C.Skeleton className="h-4 w-64" />
      <C.Skeleton className="h-4 w-40" />
    </div>
  ),
};
