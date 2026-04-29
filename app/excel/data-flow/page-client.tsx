"use client";

import { DataFlowPageClient } from "../[obraId]/data-flow/page-client";

export default function TenantDataFlowPageClient() {
  return (
    <DataFlowPageClient
      scope="tenant"
      graphEndpoint="/api/data-flow-graph"
      configEndpoint="/api/data-flow-config"
      backHref="/excel"
      backLabel="Excel"
      breadcrumbRoot="Excel"
    />
  );
}
