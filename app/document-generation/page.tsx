import { DocumentGenerationPageClient } from "./page-client";
import { resolveDocumentAccess } from "./document-access";
import { DocumentGenerationShell } from "./document-shell";

export default async function DocumentGenerationPage() {
  const access = await resolveDocumentAccess();

  if (!access.user) {
    return <div className="p-6 text-sm">Inicia sesion para generar documentos.</div>;
  }

  if (!access.tenantId) {
    return <div className="p-6 text-sm">No hay una organizacion activa seleccionada.</div>;
  }

  return (
    <DocumentGenerationShell permissions={access.permissions}>
      <DocumentGenerationPageClient permissions={access.permissions} />
    </DocumentGenerationShell>
  );
}
