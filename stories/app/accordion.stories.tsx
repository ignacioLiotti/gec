import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/accordion";

const meta = {
  title: "App UI/Accordion",
  component: C.Accordion,
  tags: ["autodocs"],
  argTypes: {},
  args: { type: "single", collapsible: true },
} satisfies Meta<typeof C.Accordion>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Single: Story = {
  render: (args) => (
    <C.Accordion {...args}>
      {["Details", "History", "Permissions"].map((label, i) => (
        <C.AccordionItem key={label} value={label} disabled={i === 2}>
          <C.AccordionTrigger>{label}</C.AccordionTrigger>
          <C.AccordionContent>
            {label} for contract revision 2.
          </C.AccordionContent>
        </C.AccordionItem>
      ))}
    </C.Accordion>
  ),
};
export const Multiple: Story = {
  ...Single,
  args: { type: "multiple", defaultValue: ["Details", "History"] },
};
