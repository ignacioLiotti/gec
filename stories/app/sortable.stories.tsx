import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/sortable";
function SortableExample({
  orientation = "vertical",
}: {
  orientation?: "vertical" | "horizontal" | "mixed";
}) {
  const [items, setItems] = React.useState([
    "Contract",
    "Invoice",
    "Certificate",
  ]);
  return (
    <C.Sortable
      value={items}
      onValueChange={setItems}
      orientation={orientation}
    >
      <C.SortableContent
        className={orientation === "vertical" ? "sb-stack" : "sb-row"}
      >
        {items.map((value) => (
          <C.SortableItem key={value} value={value} className="sb-sample">
            <C.SortableItemHandle aria-label={"Move " + value}>
              {value}
            </C.SortableItemHandle>
          </C.SortableItem>
        ))}
      </C.SortableContent>
      <C.SortableOverlay>
        {({ value }) => (
          <div className="sb-sample bg-surface">{String(value)}</div>
        )}
      </C.SortableOverlay>
    </C.Sortable>
  );
}
const meta = {
  title: "App UI/Sortable",
  component: C.Sortable,
  tags: ["autodocs"],
  argTypes: {},
  args: { value: [] },
} satisfies Meta<typeof C.Sortable>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Vertical: Story = { render: () => <SortableExample /> };
export const Horizontal: Story = {
  render: () => <SortableExample orientation="horizontal" />,
};
export const Mixed: Story = {
  render: () => <SortableExample orientation="mixed" />,
};
