import { resolveDocumentAccess } from "../document-access";
import { DocumentGenerationShell } from "../document-shell";
import { TemplateConfigPanel } from "../template-config-panel";

export default async function DocumentGenerationConfigPage() {
  const access = await resolveDocumentAccess();

  if (!access.user) {
    return <div className="p-6 text-sm">Inicia sesion para ver configuracion.</div>;
  }

  if (!access.tenantId) {
    return <div className="p-6 text-sm">No hay una organizacion activa seleccionada.</div>;
  }

  return (
    <DocumentGenerationShell permissions={access.permissions}>
      <div className="px-4 py-6 sm:px-6">
        {access.permissions.canManageTemplates ? (
          <TemplateConfigPanel workId="" permissions={access.permissions} />
        ) : (
          <div className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-600">
            No tienes permisos para editar configuracion de plantillas.
          </div>
        )}
      </div>
    </DocumentGenerationShell>
  );
}
