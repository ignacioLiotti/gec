import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/select";

const meta = {
  title: "App UI/Select",
  component: C.Select,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof C.Select>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: (args) => (
    <C.Select {...args}>
      <C.SelectTrigger aria-label="Document status">
        <C.SelectValue placeholder="Choose status" />
      </C.SelectTrigger>
      <C.SelectContent>
        <C.SelectGroup>
          <C.SelectLabel>Status</C.SelectLabel>
          <C.SelectItem value="draft">Draft</C.SelectItem>
          <C.SelectItem value="review">Review</C.SelectItem>
          <C.SelectSeparator />
          <C.SelectItem value="approved" disabled>
            Approved
          </C.SelectItem>
        </C.SelectGroup>
      </C.SelectContent>
    </C.Select>
  ),
};
export const Selected: Story = { ...Default, args: { defaultValue: "review" } };
export const Disabled: Story = { ...Default, args: { disabled: true } };
export const Open: Story = { ...Default, args: { defaultOpen: true } };
export const WithoutHeading: Story = {
  render: () => (
    <C.Select defaultOpen>
      <C.SelectTrigger aria-label="Status">
        <C.SelectValue placeholder="Choose status" />
      </C.SelectTrigger>
      <C.SelectContent hideHeading>
        <C.SelectItem value="draft">Draft</C.SelectItem>
      </C.SelectContent>
    </C.Select>
  ),
};
export const SelectionMenu: Story = {
  render: () => (
    <C.Select defaultOpen defaultValue="draft">
      <C.SelectTrigger aria-label="Status">
        <C.SelectValue />
      </C.SelectTrigger>
      <C.SelectContent>
        <C.SelectItem selectionVariant="menu" value="draft">
          Draft
        </C.SelectItem>
        <C.SelectItem selectionVariant="menu" value="review">
          Review
        </C.SelectItem>
      </C.SelectContent>
    </C.Select>
  ),
};
export const SelectionQuiet: Story = {
  render: () => (
    <C.Select defaultOpen defaultValue="draft">
      <C.SelectTrigger aria-label="Status">
        <C.SelectValue />
      </C.SelectTrigger>
      <C.SelectContent>
        <C.SelectItem selectionVariant="quiet" value="draft">
          Draft
        </C.SelectItem>
        <C.SelectItem selectionVariant="quiet" value="review">
          Review
        </C.SelectItem>
      </C.SelectContent>
    </C.Select>
  ),
};
export const SelectionRaised: Story = {
  render: () => (
    <C.Select defaultOpen defaultValue="draft">
      <C.SelectTrigger aria-label="Status">
        <C.SelectValue />
      </C.SelectTrigger>
      <C.SelectContent>
        <C.SelectItem selectionVariant="raised" value="draft">
          Draft
        </C.SelectItem>
        <C.SelectItem selectionVariant="raised" value="review">
          Review
        </C.SelectItem>
      </C.SelectContent>
    </C.Select>
  ),
};
export const SelectionTinted: Story = {
  render: () => (
    <C.Select defaultOpen defaultValue="draft">
      <C.SelectTrigger aria-label="Status">
        <C.SelectValue />
      </C.SelectTrigger>
      <C.SelectContent>
        <C.SelectItem selectionVariant="tinted" value="draft">
          Draft
        </C.SelectItem>
        <C.SelectItem selectionVariant="tinted" value="review">
          Review
        </C.SelectItem>
      </C.SelectContent>
    </C.Select>
  ),
};
export const SelectionOutline: Story = {
  render: () => (
    <C.Select defaultOpen defaultValue="draft">
      <C.SelectTrigger aria-label="Status">
        <C.SelectValue />
      </C.SelectTrigger>
      <C.SelectContent>
        <C.SelectItem selectionVariant="outline" value="draft">
          Draft
        </C.SelectItem>
        <C.SelectItem selectionVariant="outline" value="review">
          Review
        </C.SelectItem>
      </C.SelectContent>
    </C.Select>
  ),
};
export const SelectionInset: Story = {
  render: () => (
    <C.Select defaultOpen defaultValue="draft">
      <C.SelectTrigger aria-label="Status">
        <C.SelectValue />
      </C.SelectTrigger>
      <C.SelectContent>
        <C.SelectItem selectionVariant="inset" value="draft">
          Draft
        </C.SelectItem>
        <C.SelectItem selectionVariant="inset" value="review">
          Review
        </C.SelectItem>
      </C.SelectContent>
    </C.Select>
  ),
};
export const SelectionPill: Story = {
  render: () => (
    <C.Select defaultOpen defaultValue="draft">
      <C.SelectTrigger aria-label="Status">
        <C.SelectValue />
      </C.SelectTrigger>
      <C.SelectContent>
        <C.SelectItem selectionVariant="pill" value="draft">
          Draft
        </C.SelectItem>
        <C.SelectItem selectionVariant="pill" value="review">
          Review
        </C.SelectItem>
      </C.SelectContent>
    </C.Select>
  ),
};
export const SelectionLine: Story = {
  render: () => (
    <C.Select defaultOpen defaultValue="draft">
      <C.SelectTrigger aria-label="Status">
        <C.SelectValue />
      </C.SelectTrigger>
      <C.SelectContent>
        <C.SelectItem selectionVariant="line" value="draft">
          Draft
        </C.SelectItem>
        <C.SelectItem selectionVariant="line" value="review">
          Review
        </C.SelectItem>
      </C.SelectContent>
    </C.Select>
  ),
};
export const SelectionContrast: Story = {
  render: () => (
    <C.Select defaultOpen defaultValue="draft">
      <C.SelectTrigger aria-label="Status">
        <C.SelectValue />
      </C.SelectTrigger>
      <C.SelectContent>
        <C.SelectItem selectionVariant="contrast" value="draft">
          Draft
        </C.SelectItem>
        <C.SelectItem selectionVariant="contrast" value="review">
          Review
        </C.SelectItem>
      </C.SelectContent>
    </C.Select>
  ),
};
