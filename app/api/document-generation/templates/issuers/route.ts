import { NextResponse } from "next/server";
import { resolveRequestAccessContext } from "@/lib/demo-session";
import { escapeHtml } from "@/lib/document-generation";
import { loadDocumentGenerationPermissions, loadTemplateCatalog } from "@/lib/document-generation-server";
import logos from "@/lib/purchase-order-issuer-logos.json";

const ISSUERS = [
  {
    key: "purchase-order-concret-libres",
    title: "CONCRET LIBRES S.A.",
    logo: logos.concret,
    lines: ["San Juan 1149", "CUIT 30-71173998-6", "Tel. 3794-461947"],
  },
  {
    key: "purchase-order-libresmat",
    title: "LIBRESMAT S.R.L.",
    logo: logos.libresmat,
    lines: ["Av. Jorge Newbery · CP 3230 Paso de los Libres (Ctes.)", "CUIT 30-71523462-5 · Tel. 03772-426594", "libresmatsrl@hotmail.com · libresmat.srl@gmail.com"],
  },
];

export async function POST() {
  const access = await resolveRequestAccessContext();
  const { supabase, user, tenantId } = access;
  if (access.actorType !== "user" || !user || !tenantId) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const context = { supabase, tenantId, userId: user.id, permissionSimulation: access.permissionSimulation };
  const permissions = await loadDocumentGenerationPermissions(context);
  if (!permissions.canManageTemplates) return NextResponse.json({ error: "Sin permisos para publicar plantillas." }, { status: 403 });

  const { data: base, error: lookupError } = await supabase.from("document_generation_templates")
    .select("schema, content_html, target_folder_path")
    .eq("tenant_id", tenantId)
    .eq("key", "purchase-order-default")
    .eq("document_type", "PURCHASE_ORDER")
    .eq("status", "active")
    .order("version", { ascending: false }).limit(1).maybeSingle();

  const issuerBlock = /<div class="brand">[\s\S]*?<p class="company-copy">[\s\S]*?<\/p>/;
  if (lookupError) return NextResponse.json({ error: "No se pudo leer la plantilla base." }, { status: 500 });
  if (!base || !issuerBlock.test(base.content_html)) {
    return NextResponse.json({ error: "Esta organización necesita una plantilla base de orden de compra con encabezado de emisor." }, { status: 400 });
  }

  const templates = ISSUERS.map((issuer) => ({
    tenant_id: tenantId,
    key: issuer.key,
    name: "Orden de compra · " + issuer.title,
    description: "Orden de compra emitida por " + issuer.title,
    document_type: "PURCHASE_ORDER",
    target_folder_path: base.target_folder_path,
    version: 1,
    status: "active",
    is_system: false,
    created_by: user.id,
    schema: base.schema,
    content_html: base.content_html.replace(issuerBlock, () =>
      '<div class="brand"><img alt="' + escapeHtml(issuer.title) + '" src="' + issuer.logo +
      '" style="display:block;max-width:180px;max-height:54px;object-fit:contain"></div>' +
      '<p class="company-copy"><strong>' + escapeHtml(issuer.title) + '</strong><br>' +
      issuer.lines.map(escapeHtml).join("<br>") + "</p>",
    ),
  }));

  const { data: existing, error: existingError } = await supabase.from("document_generation_templates")
    .select("key").eq("tenant_id", tenantId).in("key", ISSUERS.map((issuer) => issuer.key));
  if (existingError) return NextResponse.json({ error: "No se pudieron leer las variantes." }, { status: 500 });
  const pending = templates.filter((template) => !existing.some((row) => row.key === template.key));
  const { error } = pending.length ? await supabase.from("document_generation_templates").insert(pending) : { error: null };
  if (error && error.code !== "23505") {
    return NextResponse.json({ error: "No se pudieron publicar las plantillas." }, { status: 500 });
  }
  return NextResponse.json({ templates: await loadTemplateCatalog(context) });
}
