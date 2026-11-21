import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/column-resizer";
function ResizeExample({ mode }: { mode: "fixed" | "balanced" }) {
  const id = React.useId();
  return (
    <table id={id} className="w-full table-fixed border-collapse">
      <C.ColGroup tableId={id} columns={3} mode={mode} />
      <thead>
        <tr>
          {["Document", "Status", "Owner"].map((label, i) => (
            <th
              key={label}
              className="relative border border-stroke p-3 text-left"
            >
              {label}
              <C.ColumnResizer tableId={id} colIndex={i} mode={mode} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Contract</td>
          <td>Review</td>
          <td>Alex Rivera</td>
        </tr>
      </tbody>
    </table>
  );
}
const meta = {
  title: "App UI/ColumnResizer",
  component: C.ColumnResizer,
  tags: ["autodocs"],
  argTypes: {},
  args: { tableId: "example", colIndex: 0 },
} satisfies Meta<typeof C.ColumnResizer>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Fixed: Story = { render: () => <ResizeExample mode="fixed" /> };
export const Balanced: Story = {
  render: () => <ResizeExample mode="balanced" />,
};
