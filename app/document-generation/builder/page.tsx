import { Suspense } from "react";

import { resolveDocumentAccess } from "../document-access";
import { DocumentGenerationShell } from "../document-shell";
import { TemplateBuilderClient } from "./builder-client";

export default async function DocumentTemplateBuilderPage() {
  const access = await resolveDocumentAccess();

  if (!access.user) {
    return <div className="p-6 text-sm">Iniciá sesión para editar plantillas.</div>;
  }
  if (!access.tenantId) {
    return <div className="p-6 text-sm">No hay una organización activa seleccionada.</div>;
  }
  if (!access.permissions.canManageTemplates) {
    return (
      <DocumentGenerationShell permissions={access.permissions}>
        <div className="m-6 rounded-xl border border-stroke-soft bg-surface p-6 text-sm text-content-secondary">
          No tenés permisos para editar plantillas.
        </div>
      </DocumentGenerationShell>
    );
  }

  return (
    <DocumentGenerationShell permissions={access.permissions}>
      <Suspense fallback={<div className="p-6 text-sm text-content-secondary">Cargando editor…</div>}>
        <TemplateBuilderClient />
      </Suspense>
    </DocumentGenerationShell>
  );
}
