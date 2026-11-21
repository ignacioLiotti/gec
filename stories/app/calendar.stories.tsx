import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/calendar";

const meta = {
  title: "App UI/Calendar",
  component: C.Calendar,
  tags: ["autodocs"],
  argTypes: {},
  args: { defaultMonth: new Date(2026, 8, 1) },
} satisfies Meta<typeof C.Calendar>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Single: Story = {
  render: (args) => (
    <C.Calendar defaultMonth={args.defaultMonth} mode="single" />
  ),
};
export const Selected: Story = {
  render: (args) => (
    <C.Calendar
      defaultMonth={args.defaultMonth}
      mode="single"
      selected={new Date(2026, 8, 7)}
    />
  ),
};
export const Range: Story = {
  render: (args) => (
    <C.Calendar
      defaultMonth={args.defaultMonth}
      mode="range"
      selected={{ from: new Date(2026, 8, 7), to: new Date(2026, 8, 12) }}
      numberOfMonths={2}
    />
  ),
};
export const Multiple: Story = {
  render: (args) => (
    <C.Calendar
      defaultMonth={args.defaultMonth}
      mode="multiple"
      selected={[new Date(2026, 8, 7), new Date(2026, 8, 10)]}
    />
  ),
};
export const DisabledDays: Story = {
  render: (args) => (
    <C.Calendar
      defaultMonth={args.defaultMonth}
      disabled={{ dayOfWeek: [0, 6] }}
      showOutsideDays
    />
  ),
};
export const DropdownCaption: Story = {
  render: (args) => (
    <C.Calendar defaultMonth={args.defaultMonth} captionLayout="dropdown" />
  ),
};
