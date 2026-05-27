import { resolveDocumentAccess } from "../document-access";
import { DocumentGenerationShell } from "../document-shell";
import { DocumentDraftsPageClient } from "../drafts-page-client";

export default async function DocumentGenerationDraftsPage() {
  const access = await resolveDocumentAccess();

  if (!access.user) {
    return <div className="p-6 text-sm">Inicia sesion para ver el historial.</div>;
  }

  if (!access.tenantId) {
    return <div className="p-6 text-sm">No hay una organizacion activa seleccionada.</div>;
  }

  return (
    <DocumentGenerationShell permissions={access.permissions}>
      <DocumentDraftsPageClient
        canViewAllDrafts={access.permissions.canViewAllDrafts}
        permissions={access.permissions}
      />
    </DocumentGenerationShell>
  );
}
