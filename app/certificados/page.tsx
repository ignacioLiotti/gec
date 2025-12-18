'use client';

import {
  FormTable,
  FormTableContent,
  FormTablePagination,
  FormTableTabs,
  FormTableToolbar,
} from "@/components/form-table/form-table";
import { certificadosConfig } from "@/components/form-table/configs/certificados";

export default function CertificadosPage() {
  return (
    <div className="px-4 py-2">
      <FormTable config={certificadosConfig}>
        <div className="space-y-1">
          <p className="text-sm uppercase tracking-wide text-orange-800/80 -mb-1">
            Gestión de certificados
          </p>
          <h1 className="text-3xl font-bold text-foreground mb-2">Certificados por obra</h1>
          <FormTableTabs />
          <FormTableToolbar />
          <FormTableContent className="md:max-w-[calc(98vw-var(--sidebar-current-width))]" />
          <FormTablePagination />
        </div>
      </FormTable>
    </div>
  );
}
