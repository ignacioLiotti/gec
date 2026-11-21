import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { OperationsClient } from "@/app/admin/operations/operations-client";

import {
  operationsConsoleFixture,
  operationsConsoleRecoveryFixture,
  operationsConsoleUnavailableFixture,
} from "./operations-console-fixture";

const meta = {
  id: "product-operations-console",
  title: "Product/Operations console",
  component: OperationsClient,
  args: { snapshot: operationsConsoleFixture, synthetic: true },
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/admin/operations", query: {} },
    },
  },
  decorators: [
    (Story) => (
      <main className="min-h-screen bg-canvas p-3 sm:p-6">
        <Story />
      </main>
    ),
  ],
} satisfies Meta<typeof OperationsClient>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};

export const Costs: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/admin/operations", query: { view: "costs" } },
    },
  },
};

export const Traceability: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/admin/operations",
        query: { view: "trace", auditId: "audit-73" },
      },
    },
  },
};

export const HealthAndRecovery: Story = {
  args: { snapshot: operationsConsoleRecoveryFixture, synthetic: true },
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/admin/operations",
        query: { view: "health", operationId: "operation-1038" },
      },
    },
  },
};

export const SourcesUnavailable: Story = {
  args: { snapshot: operationsConsoleUnavailableFixture, synthetic: true },
};
