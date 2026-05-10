import { resolveDocumentAccess } from "../document-access";
import { DocumentReviewPageClient } from "../review-page-client";
import { DocumentGenerationShell } from "../document-shell";

export default async function DocumentGenerationReviewPage() {
  const access = await resolveDocumentAccess();

  if (!access.user) {
    return <div className="p-6 text-sm">Inicia sesion para revisar documentos.</div>;
  }

  if (!access.tenantId) {
    return <div className="p-6 text-sm">No hay una organizacion activa seleccionada.</div>;
  }

  return (
    <DocumentGenerationShell permissions={access.permissions}>
      {access.permissions.canReview ? (
        <DocumentReviewPageClient permissions={access.permissions} />
      ) : (
        <div className="p-6">
          <div className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-600">
            No tienes permisos para revisar documentos.
          </div>
        </div>
      )}
    </DocumentGenerationShell>
  );
}
