import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const obraId = params.id;
  if (!obraId) {
    return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data: orders, error: ordersError } = await supabase
      .from("material_orders")
      .select("id, nro_orden, solicitante, gestor, proveedor, created_at")
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
      items: orderIdToItems[o.id] || [],
    }));

    return NextResponse.json({ orders: result });
  } catch (err) {
    console.error("[materials:list]", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}



