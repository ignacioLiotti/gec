import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/label";

const meta = {
  title: "App UI/Label",
  component: C.Label,
  tags: ["autodocs"],
  argTypes: {},
  args: { children: "Document name" },
} satisfies Meta<typeof C.Label>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: (args) => (
    <div>
      <C.Label {...args} htmlFor="label-example" />
      <input
        id="label-example"
        className="border border-stroke rounded-md p-2"
      />
    </div>
  ),
};
