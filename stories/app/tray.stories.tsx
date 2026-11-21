import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/tray";
function TrayExample() {
  const [active, setActive] = React.useState("All");
  return (
    <C.Tray>
      {["All", "Review", "Approved"].map((label) => (
        <C.Chip
          key={label}
          active={active === label}
          onClick={() => setActive(label)}
        >
          {label}
        </C.Chip>
      ))}
    </C.Tray>
  );
}
const meta = {
  title: "App UI/Tray",
  component: C.Tray,
  tags: ["autodocs"],
  argTypes: {},
  args: { children: null },
} satisfies Meta<typeof C.Tray>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = { render: () => <TrayExample /> };
export const States: Story = {
  render: () => (
    <C.Tray>
      <C.Chip>Default</C.Chip>
      <C.Chip active>Active</C.Chip>
      <C.Chip disabled>Disabled</C.Chip>
      {(["extraction", "manual", "mixed"] as const).map((dot) => (
        <C.Chip key={dot} dot={dot}>
          {dot}
        </C.Chip>
      ))}
    </C.Tray>
  ),
};
