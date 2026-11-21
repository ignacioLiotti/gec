import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as C from "@/components/ui/contextual-wizard";
import { Button } from "@/components/ui/button";
function WizardExample({ required = false }: { required?: boolean }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="sb-stack">
      <Button onClick={() => setOpen(true)}>Start tour</Button>
      <Button data-wizard-target="storybook-document">Document actions</Button>
      <C.ContextualWizard
        open={open}
        onOpenChange={setOpen}
        flow={{
          id: "storybook",
          title: "Document tour",
          steps: [
            {
              id: "actions",
              targetId: "storybook-document",
              title: "Document actions",
              content: "Open the document actions before continuing.",
              requiredAction: required ? "click_target" : undefined,
            },
            {
              id: "done",
              targetId: "storybook-document",
              title: "Ready",
              content: "The tour is complete.",
            },
          ],
        }}
      />
    </div>
  );
}
const meta = {
  title: "App UI/ContextualWizard",
  component: C.ContextualWizard,
  tags: ["autodocs"],
  argTypes: {},
  args: {
    open: false,
    onOpenChange: () => {},
    flow: { id: "example", title: "Example", steps: [] },
  },
} satisfies Meta<typeof C.ContextualWizard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { render: () => <WizardExample /> };
export const RequiredClick: Story = {
  render: () => <WizardExample required />,
};
