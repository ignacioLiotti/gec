import { NextResponse } from "next/server";
import { getAuthContext } from "../../obras/route";

const ALLOWED_FIELDS = new Set([
  "facturado",
  "fecha_facturacion",
  "nro_factura",
  "concepto",
  "cobrado",
  "observaciones",
  "vencimiento",
  "fecha_pago",
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, user, tenantId } = await getAuthContext();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!tenantId) {
    return NextResponse.json({ error: "No se encontró una organización para el usuario" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const updatePayload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(key)) {
      updatePayload[key] = value;
    }
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: "No hay campos válidos para actualizar" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("certificates")
    .update(updatePayload)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ certificate: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, user, tenantId } = await getAuthContext();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!tenantId) {
    return NextResponse.json(
      { error: "No se encontró una organización para el usuario" },
      { status: 400 }
    );
  }

  if (!id) {
    return NextResponse.json(
      { error: "Certificado no encontrado" },
      { status: 404 }
    );
  }

  const { data: certificate, error: fetchError } = await supabase
    .from("certificates")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json(
      { error: "No se pudo verificar el certificado" },
      { status: 500 }
    );
  }

  if (!certificate) {
    return NextResponse.json(
      { error: "Certificado no encontrado" },
      { status: 404 }
    );
  }

  const { error } = await supabase
    .from("certificates")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) {
    return NextResponse.json(
      { error: "No se pudo eliminar el certificado" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}











