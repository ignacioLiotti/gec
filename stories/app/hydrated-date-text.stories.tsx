import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/hydrated-date-text";

const meta = {
  title: "App UI/HydratedDateText",
  component: C.HydratedDateText,
  tags: ["autodocs"],
  argTypes: {},
  args: { value: "2026-09-07T12:00:00Z", options: { timeZone: "UTC" } },
} satisfies Meta<typeof C.HydratedDateText>;
export default meta;
type Story = StoryObj<typeof meta>;
export const DateTime: Story = {};
export const Relative: Story = { args: { format: "relative" } };
export const Invalid: Story = {
  args: { value: "invalid", fallback: "Date unavailable" },
};
export const English: Story = { args: { locale: "en-US" } };
