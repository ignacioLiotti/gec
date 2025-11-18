import { NextResponse } from "next/server";
import { getAuthContext } from "../obras/route";

type FlatCertificate = {
  id: string;
  obraId: string;
  obraName: string;
  ente: string;
  n_exp: string;
  n_certificado: number;
  monto: number;
  mes: string;
  estado: string;
  facturado: boolean;
  fecha_facturacion: string | null;
  nro_factura: string | null;
  concepto: string | null;
  cobrado: boolean;
  observaciones: string | null;
  vencimiento: string | null;
  fecha_pago: string | null;
};

export async function GET(request: Request) {
  const { supabase, user, tenantId } = await getAuthContext();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!tenantId) {
    return NextResponse.json({ certificados: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 1 } });
  }

  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const qRaw = (searchParams.get("q") ?? "").trim();
  const rawPage = Number.parseInt(searchParams.get("page") ?? "", 10);
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limitCandidate = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 50;
  const limit = Math.min(Math.max(limitCandidate, 1), 500);
  const rawOrderBy = (searchParams.get("orderBy") ?? "obra").toLowerCase();
  const rawOrderDir = (searchParams.get("orderDir") ?? "asc").toLowerCase();
  const asc = rawOrderDir !== "desc";

  // Load obras for tenant
  const { data: obrasRows, error: obrasErr } = await supabase
    .from("obras")
    .select("id, designacion_y_ubicacion, entidad_contratante")
    .eq("tenant_id", tenantId);

  if (obrasErr) {
    return NextResponse.json({ error: "No se pudieron obtener las obras" }, { status: 500 });
  }

  const obraMap = new Map<string, { name: string; ente: string }>((obrasRows || []).map((o: any) => [o.id as string, { name: String(o.designacion_y_ubicacion || ""), ente: String(o.entidad_contratante || "") }]));
  const obraIds = Array.from(obraMap.keys());

  if (obraIds.length === 0) {
    return NextResponse.json({ certificados: [], pagination: { page: 1, limit, total: 0, totalPages: 1 } });
  }

  const { data: certRows, error: certErr } = await supabase
    .from("certificates")
    .select("*")
    .in("obra_id", obraIds);

  if (certErr) {
    return NextResponse.json({ error: "No se pudieron obtener los certificados" }, { status: 500 });
  }

  const merged: FlatCertificate[] = (certRows || []).map((c: any) => {
    const obra = obraMap.get(String(c.obra_id)) || { name: "", ente: "" };
    return {
      id: String(c.id),
      obraId: String(c.obra_id),
      obraName: obra.name,
      ente: obra.ente,
      n_exp: String(c.n_exp),
      n_certificado: Number(c.n_certificado) || 0,
      monto: Number(c.monto) || 0,
      mes: String(c.mes || ""),
      estado: String(c.estado || ""),
      facturado: Boolean(c.facturado ?? false),
      fecha_facturacion: c.fecha_facturacion ? String(c.fecha_facturacion) : null,
      nro_factura: c.nro_factura == null ? null : String(c.nro_factura),
      concepto: c.concepto == null ? null : String(c.concepto),
      cobrado: Boolean(c.cobrado ?? false),
      observaciones: c.observaciones == null ? null : String(c.observaciones),
      vencimiento: c.vencimiento ? String(c.vencimiento) : null,
      fecha_pago: c.fecha_pago ? String(c.fecha_pago) : null,
    };
  });

  const normalize = (v: string) => v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

  const filtered = (() => {
    if (!qRaw) return merged;
    const q = normalize(qRaw);
    return merged.filter((row) =>
      normalize(row.obraName).includes(q) ||
      normalize(row.ente).includes(q) ||
      normalize(row.n_exp).includes(q) ||
      normalize(row.estado).includes(q) ||
      normalize(row.mes).includes(q) ||
      normalize(String(row.monto)).includes(q) ||
      normalize(String(row.n_certificado)).includes(q) ||
      (row.nro_factura ? normalize(row.nro_factura).includes(q) : false) ||
      (row.concepto ? normalize(row.concepto).includes(q) : false) ||
      (row.observaciones ? normalize(row.observaciones).includes(q) : false) ||
      (row.fecha_facturacion ? normalize(row.fecha_facturacion).includes(q) : false) ||
      (row.vencimiento ? normalize(row.vencimiento).includes(q) : false) ||
      (row.fecha_pago ? normalize(row.fecha_pago).includes(q) : false)
    );
  })();

  const sorted = filtered.sort((a, b) => {
    switch (rawOrderBy) {
      case "ente":
        return asc ? a.ente.localeCompare(b.ente) : b.ente.localeCompare(a.ente);
      case "monto":
        return asc ? a.monto - b.monto : b.monto - a.monto;
      case "n_exp":
        return asc ? a.n_exp.localeCompare(b.n_exp) : b.n_exp.localeCompare(a.n_exp);
      case "obra":
      default:
        return asc ? a.obraName.localeCompare(b.obraName) : b.obraName.localeCompare(a.obraName);
    }
  });

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * limit;
  const paged = sorted.slice(start, start + limit);

  return NextResponse.json({
    certificados: paged,
    pagination: {
      page: safePage,
      limit,
      total,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPreviousPage: safePage > 1,
    },
  });
}











