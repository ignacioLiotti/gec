import { NextResponse } from "next/server";
import { resolveRequestAccessContext } from "@/lib/demo-session";

export async function GET(request: Request) {
  const { supabase, user, tenantId } = await resolveRequestAccessContext();
  if (!user || !tenantId) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });

  const year = new URL(request.url).searchParams.get("year") ?? "";
  if (!/^(19|20)\d{2}$/.test(year)) {
    return NextResponse.json({ error: "Elegí un año válido." }, { status: 400 });
  }

  const rows = [];
  const pageSize = 500;
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase
      .from("certificates")
      .select("obra_id, n_certificado, monto, fecha_facturacion, obras!inner(n, designacion_y_ubicacion)")
      .eq("tenant_id", tenantId)
      .eq("facturado", true)
      .in("estado", ["CERTIFICADO", "APROBADO", "APPROVED"])
      .is("deleted_at", null)
      .is("obras.deleted_at", null)
      .gte("fecha_facturacion", year + "-01-01")
      .lt("fecha_facturacion", (Number(year) + 1) + "-01-01")
      .order("id")
      .range(start, start + pageSize - 1);
    if (error) return NextResponse.json({ error: "No se pudieron exportar los certificados." }, { status: 500 });
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return NextResponse.json({ rows }, { headers: { "Cache-Control": "private, no-store" } });
}
