import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

const aiItemSchema = z.object({
  cantidad: z.number().finite().nonnegative(),
  unidad: z.string().max(50),
  material: z.string().min(1).max(500),
  precioUnitario: z.number().finite().nonnegative().nullable().optional(),
});

const aiExtractionSchema = z.object({
  nroOrden: z.string().optional(),
  solicitante: z.string().optional(),
  gestor: z.string().optional(),
  proveedor: z.string().optional(),
  items: z.array(aiItemSchema).min(1),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const obraId = params.id;
  if (!obraId) {
    return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Archivo PDF requerido (campo 'file')" }, { status: 400 });
    }
    if (!file.type?.includes("pdf")) {
      return NextResponse.json({ error: "Solo se admite PDF" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from PDF
    const pdfParse = (await import("pdf-parse")).default as unknown as (b: Buffer) => Promise<{ text: string }>;
    const { text } = await pdfParse(buffer);
    const cleanedText = (text || "").replace(/\u0000/g, "").trim();
    if (!cleanedText) {
      return NextResponse.json({ error: "No se pudo extraer texto del PDF" }, { status: 422 });
    }

    // Ask AI to structure items
    const { object: extraction } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: aiExtractionSchema,
      messages: [
        {
          role: "user",
          content: `Sos un asistente que extrae una orden de compra de materiales en formato JSON.

Documento (texto plano del PDF):\n\n${cleanedText.substring(0, 15000)}

Instrucciones:
- Devolvés items con estos campos: cantidad (número), unidad (texto), material (texto), precioUnitario (número si está, puede ser null)
- Extraé además si aparecen: nroOrden, solicitante, gestor, proveedor (todos texto)
- La cantidad puede ser decimal. La unidad puede ser u, m, m², kg, etc.
- El material es la descripción del ítem.
- El precioUnitario debe ser numérico sin símbolos. Si no aparece, usá null.
- No inventes ítems; solo lo que figure legible.
`
        },
      ],
      temperature: 0.1,
    });

    // Persist to DB
    const supabase = await createClient();

    const orderInsert = {
      obra_id: obraId,
      nro_orden: extraction.nroOrden ?? null,
      solicitante: extraction.solicitante ?? null,
      gestor: extraction.gestor ?? null,
      proveedor: extraction.proveedor ?? null,
    } as const;

    const { data: order, error: orderError } = await supabase
      .from("material_orders")
      .insert(orderInsert)
      .select()
      .single();
    if (orderError) throw orderError;

    const itemsInsert = extraction.items.map((it) => ({
      order_id: order.id,
      cantidad: it.cantidad ?? 0,
      unidad: it.unidad ?? "",
      material: it.material ?? "",
      precio_unitario: it.precioUnitario ?? 0,
    }));

    if (itemsInsert.length > 0) {
      const { error: itemsError } = await supabase
        .from("material_order_items")
        .insert(itemsInsert);
      if (itemsError) throw itemsError;
    }

    return NextResponse.json({
      ok: true,
      debug: {
        textLength: cleanedText.length,
        preview: cleanedText.slice(0, 500),
      },
      order: {
        id: order.id,
        nroOrden: order.nro_orden,
        solicitante: order.solicitante,
        gestor: order.gestor,
        proveedor: order.proveedor,
      },
      items: extraction.items,
    });
  } catch (err) {
    console.error("[materials/import]", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message, ok: false, debug: { message } }, { status: 500 });
  }
}



