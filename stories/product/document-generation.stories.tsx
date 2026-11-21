import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Toaster } from "sonner";

import { DocumentGenerationPageClient } from "@/app/document-generation/page-client";
import { installDocumentGenerationFixture } from "./document-generation-fixtures";

function RuntimeFixture() {
  return (
    <React.StrictMode>
      <DocumentGenerationPageClient />
      <Toaster position="bottom-right" richColors />
    </React.StrictMode>
  );
}

const meta = {
  id: "product-document-generation-runtime",
  title: "Product/Document generation runtime",
  component: RuntimeFixture,
  beforeEach: installDocumentGenerationFixture,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/document-generation",
        query: {
          workId: "work-norte",
          folder: "Compras/Ordenes",
          documentType: "PURCHASE_ORDER",
        },
      },
    },
  },
} satisfies Meta<typeof RuntimeFixture>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StateMachine: Story = {};

export const BootstrapFromFolder: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/document-generation",
        query: { workId: "work-norte", folder: "Compras/Ordenes" },
      },
    },
  },
};

export const DraftRecovery: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/document-generation",
        query: { draftId: "draft-recovery" },
      },
    },
  },
};

export const GeneratedEditing: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/document-generation",
        query: { generatedId: "generated-editing" },
      },
    },
  },
};
