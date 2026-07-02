import { resolveDocumentAccess } from "../document-access";
import { DocumentGenerationShell } from "../document-shell";
import { ApprovedDocumentsPageClient } from "../approved-documents-page-client";

export default async function ApprovedDocumentsPage() {
  const access = await resolveDocumentAccess();

  if (!access.user) {
    return <div className="p-6 text-sm">Inicia sesion para ver documentos aprobados.</div>;
  }

  if (!access.tenantId) {
    return <div className="p-6 text-sm">No hay una organizacion activa seleccionada.</div>;
  }

  return (
    <DocumentGenerationShell permissions={access.permissions}>
      {access.permissions.canReview ? (
        <ApprovedDocumentsPageClient />
      ) : (
        <div className="p-6">
          <div className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-600">
            No tienes permisos para ver documentos aprobados.
          </div>
        </div>
      )}
    </DocumentGenerationShell>
  );
}
