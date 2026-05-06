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

  if (!access.permissions.canCreate) {
    return (
      <DocumentGenerationShell permissions={access.permissions}>
        <div className="p-6">
          <div className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-600">
            No tienes permisos para crear o editar documentos.
          </div>
        </div>
      </DocumentGenerationShell>
    );
  }

  return (
    <DocumentGenerationShell permissions={access.permissions}>
      <DocumentGenerationPageClient />
    </DocumentGenerationShell>
  );
}
