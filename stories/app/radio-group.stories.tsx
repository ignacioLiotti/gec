import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/radio-group";

const meta = {
  title: "App UI/RadioGroup",
  component: C.RadioGroup,
  tags: ["autodocs"],
  argTypes: {},
  args: { defaultValue: "Draft", "aria-label": "Document status" },
} satisfies Meta<typeof C.RadioGroup>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: (args) => (
    <C.RadioGroup {...args}>
      {["Draft", "Review", "Approved"].map((value) => (
        <label key={value} className="sb-row">
          <C.RadioGroupItem value={value} />
          {value}
        </label>
      ))}
    </C.RadioGroup>
  ),
};
export const Disabled: Story = { ...Default, args: { disabled: true } };
export const SizeSm: Story = { ...Default, args: { size: "sm" } };
export const SizeMd: Story = { ...Default, args: { size: "md" } };
export const SizeLg: Story = { ...Default, args: { size: "lg" } };
