import { NextResponse } from "next/server";
import {
  hasDemoCapability,
  resolveRequestAccessContext,
} from "@/lib/demo-session";

type MaterialOrderRow = {
  id: string;
  nro_orden: string | null;
  fecha: string | null;
  solicitante: string | null;
  proveedor: string | null;
  doc_bucket: string | null;
  doc_path: string | null;
};

type MaterialOrderItemRow = {
  order_id: string;
  cantidad: number | string | null;
  unidad: string | null;
  material: string | null;
  precio_unitario: number | string | null;
};

type CreateMaterialOrderItemBody = {
  cantidad?: number | string | null;
  unidad?: string | null;
  material?: string | null;
  precioUnitario?: number | string | null;
};

type CreateMaterialOrderBody = {
  nroOrden?: string | null;
  fecha?: string | null;
  solicitante?: string | null;
  proveedor?: string | null;
  docBucket?: string | null;
  docPath?: string | null;
  items?: CreateMaterialOrderItemBody[];
};

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const obraId = id;
  if (!obraId) {
    return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });
  }

  try {
    const access = await resolveRequestAccessContext();
    const { supabase, user, tenantId, actorType } = access;
    if (!user && actorType !== "demo") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (actorType === "demo" && !hasDemoCapability(access.demoSession, "excel")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant" }, { status: 400 });
    }
    const { data: obra, error: obraError } = await supabase
      .from("obras")
      .select("id")
      .eq("id", obraId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .maybeSingle();
    if (obraError) throw obraError;
    if (!obra) {
      return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
    }

    const { data: orders, error: ordersError } = await supabase
      .from("material_orders")
      .select("id, nro_orden, fecha, solicitante, proveedor, doc_bucket, doc_path, created_at")
      .eq("obra_id", obraId)
      .order("created_at", { ascending: false });
    if (ordersError) throw ordersError;

    if (!orders || orders.length === 0) {
      return NextResponse.json({ orders: [] });
    }

    const typedOrders = orders as MaterialOrderRow[];
    const orderIds = typedOrders.map((order) => order.id);
    const { data: items, error: itemsError } = await supabase
      .from("material_order_items")
      .select("order_id, cantidad, unidad, material, precio_unitario")
      .in("order_id", orderIds);
    if (itemsError) throw itemsError;

    const orderIdToItems: Record<string, CreateMaterialOrderItemBody[]> = {};
    for (const it of (items ?? []) as MaterialOrderItemRow[]) {
      (orderIdToItems[it.order_id] ||= []).push({
        cantidad: Number(it.cantidad ?? 0),
        unidad: it.unidad ?? "",
        material: it.material ?? "",
        precioUnitario: Number(it.precio_unitario ?? 0),
      });
    }

    const result = typedOrders.map((order) => ({
      id: order.id,
      nroOrden: order.nro_orden,
      fecha: order.fecha,
      solicitante: order.solicitante,
      proveedor: order.proveedor,
      docBucket: order.doc_bucket,
      docPath: order.doc_path,
      items: orderIdToItems[order.id] || [],
    }));

    return NextResponse.json({ orders: result });
  } catch (err) {
    console.error("[materials:list]", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const obraId = id;
  if (!obraId) {
    return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });
  }

  try {
    const access = await resolveRequestAccessContext();
    const { supabase, user, tenantId } = access;
    if (access.actorType !== "user" || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant" }, { status: 400 });
    }

    const body = (await req.json()) as CreateMaterialOrderBody | null;
    const { nroOrden, fecha, solicitante, proveedor, items } = body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Items requeridos" }, { status: 400 });
    }

    const { data: obra, error: obraError } = await supabase
      .from("obras")
      .select("id")
      .eq("id", obraId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .maybeSingle();
    if (obraError) throw obraError;
    if (!obra) {
      return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
    }

    // Insert order
    const { data: order, error: orderError } = await supabase
      .from("material_orders")
      .insert({
        obra_id: obraId,
        nro_orden: nroOrden ?? null,
        fecha: fecha ?? null,
        solicitante: solicitante ?? null,
        proveedor: proveedor ?? null,
        doc_bucket: body?.docBucket ?? null,
        doc_path: body?.docPath ?? null,
      })
      .select()
      .single();
    if (orderError) throw orderError;

    const itemsInsert = items.map((it) => ({
      order_id: order.id,
      cantidad: Number(it.cantidad ?? 0),
      unidad: String(it.unidad ?? ""),
      material: String(it.material ?? ""),
      precio_unitario: Number(it.precioUnitario ?? 0),
    }));

    const { error: itemsError } = await supabase
      .from("material_order_items")
      .insert(itemsInsert);
    if (itemsError) throw itemsError;

    return NextResponse.json({ ok: true, order: { id: order.id } });
  } catch (err) {
    console.error("[materials:create]", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
