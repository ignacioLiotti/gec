import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/table";

const meta = {
  title: "App UI/Table",
  component: C.Table,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof C.Table>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: (args) => (
    <C.Table {...args}>
      <C.TableCaption>Document review queue</C.TableCaption>
      <C.TableHeader>
        <C.TableRow>
          <C.TableHead>Document</C.TableHead>
          <C.TableHead>Status</C.TableHead>
          <C.TableHead>Pages</C.TableHead>
        </C.TableRow>
      </C.TableHeader>
      <C.TableBody>
        {["Contract", "Invoice", "Certificate"].map((name, i) => (
          <C.TableRow key={name} data-state={i === 1 ? "selected" : undefined}>
            <C.TableCell>{name}</C.TableCell>
            <C.TableCell>{i === 1 ? "Approved" : "Review"}</C.TableCell>
            <C.TableCell>{i + 1}</C.TableCell>
          </C.TableRow>
        ))}
      </C.TableBody>
      <C.TableFooter>
        <C.TableRow>
          <C.TableCell colSpan={2}>Total</C.TableCell>
          <C.TableCell>6</C.TableCell>
        </C.TableRow>
      </C.TableFooter>
    </C.Table>
  ),
};
export const Empty: Story = {
  render: () => (
    <C.Table>
      <C.TableBody>
        <C.TableRow>
          <C.TableCell>No documents</C.TableCell>
        </C.TableRow>
      </C.TableBody>
    </C.Table>
  ),
};
