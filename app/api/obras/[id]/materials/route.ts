import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const obraId = id;
  if (!obraId) {
    return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data: orders, error: ordersError } = await supabase
      .from("material_orders")
      .select("id, nro_orden, solicitante, gestor, proveedor, doc_bucket, doc_path, created_at")
      .eq("obra_id", obraId)
      .order("created_at", { ascending: false });
    if (ordersError) throw ordersError;

    if (!orders || orders.length === 0) {
      return NextResponse.json({ orders: [] });
    }

    const orderIds = orders.map((o) => o.id);
    const { data: items, error: itemsError } = await supabase
      .from("material_order_items")
      .select("order_id, cantidad, unidad, material, precio_unitario")
      .in("order_id", orderIds);
    if (itemsError) throw itemsError;

    const orderIdToItems: Record<string, any[]> = {};
    for (const it of items ?? []) {
      (orderIdToItems[it.order_id] ||= []).push({
        cantidad: Number(it.cantidad ?? 0),
        unidad: it.unidad ?? "",
        material: it.material ?? "",
        precioUnitario: Number(it.precio_unitario ?? 0),
      });
    }

    const result = orders.map((o) => ({
      id: o.id,
      nroOrden: o.nro_orden,
      solicitante: o.solicitante,
      gestor: o.gestor,
      proveedor: o.proveedor,
      docBucket: (o as any).doc_bucket ?? null,
      docPath: (o as any).doc_path ?? null,
      items: orderIdToItems[o.id] || [],
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
    const body = await req.json();
    const { nroOrden, solicitante, gestor, proveedor, items } = body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Items requeridos" }, { status: 400 });
    }

    const supabase = await createClient();

    // Insert order
    const { data: order, error: orderError } = await supabase
      .from("material_orders")
      .insert({
        obra_id: obraId,
        nro_orden: nroOrden ?? null,
        solicitante: solicitante ?? null,
        gestor: gestor ?? null,
        proveedor: proveedor ?? null,
        doc_bucket: (body?.docBucket as string | null) ?? null,
        doc_path: (body?.docPath as string | null) ?? null,
      })
      .select()
      .single();
    if (orderError) throw orderError;

    const itemsInsert = (items as any[]).map((it) => ({
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



