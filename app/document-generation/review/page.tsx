import { resolveDocumentAccess } from "../document-access";
import { DocumentReviewPageClient } from "../review-page-client";
import { DocumentGenerationShell } from "../document-shell";

export default async function DocumentGenerationReviewPage() {
  const access = await resolveDocumentAccess();

  if (!access.user) {
    return <div className="p-6 text-sm">Inicia sesion para ver documentos.</div>;
  }

  if (!access.tenantId) {
    return <div className="p-6 text-sm">No hay una organizacion activa seleccionada.</div>;
  }

  return (
    <DocumentGenerationShell permissions={access.permissions}>
      <DocumentReviewPageClient canReview={access.permissions.canReview} />
    </DocumentGenerationShell>
  );
}
