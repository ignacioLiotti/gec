import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

const meta = {
  title: "App UI/Collapsible",
  component: C.Collapsible,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof C.Collapsible>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: (args) => (
    <C.Collapsible {...args}>
      <C.CollapsibleTrigger asChild>
        <Button variant="outline">Revision history</Button>
      </C.CollapsibleTrigger>
      <C.CollapsibleContent>Revision 1, Revision 2</C.CollapsibleContent>
    </C.Collapsible>
  ),
};
export const Open: Story = { ...Default, args: { defaultOpen: true } };
export const Disabled: Story = { ...Default, args: { disabled: true } };
