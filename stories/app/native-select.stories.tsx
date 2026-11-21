import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { NativeSelect } from "@/components/ui/native-select";

const meta = { title: "App UI/Native Select", component: NativeSelect, args: { "aria-label": "Document type", children: [<option key="draft" value="draft">Draft</option>, <option key="report" value="report">Report</option>] } } satisfies Meta<typeof NativeSelect>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };
export const Invalid: Story = { args: { "aria-invalid": true } };
