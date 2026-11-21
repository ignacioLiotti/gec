import { DataFlowPageClient } from "@/app/excel/[obraId]/data-flow/page-client";
import { portfolioDataFlowPayload } from "../fixtures";
export default function DataFlow() {
  return (
    <DataFlowPageClient
      scope="tenant"
      graphEndpoint=""
      configEndpoint=""
      backHref="/excel"
      backLabel="Obras"
      breadcrumbRoot="Obras"
      demoPayload={portfolioDataFlowPayload}
      initialSemanticScope="result"
      initialExpanded
    />
  );
}
