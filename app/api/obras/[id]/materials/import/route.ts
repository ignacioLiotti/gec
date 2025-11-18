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

type AIExtraction = z.infer<typeof aiExtractionSchema>;

export async function POST(
	req: NextRequest,
	context: { params: Promise<{ id: string }> }
) {
	const { id } = await context.params;
	const obraId = id;
	if (!obraId) {
		return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });
	}

	try {
		const url = new URL(req.url);
		const previewMode =
			url.searchParams.get("preview") === "1" ||
			url.searchParams.get("preview") === "true";
		const form = await req.formData();
		const imageDataUrl = form.get("imageDataUrl");
		const fileEntry = form.get("file");
		const file = fileEntry instanceof File ? fileEntry : null;
		if (!file && typeof imageDataUrl !== "string") {
			return NextResponse.json(
				{ error: "Se requiere un archivo o imageDataUrl" },
				{ status: 400 }
			);
		}
		let extraction: AIExtraction | null = null;
		if (typeof imageDataUrl === "string" && imageDataUrl.startsWith("data:")) {
			// Client already rasterized to a data URL
			const res = await generateObject({
				model: openai("gpt-4o-mini"),
				schema: aiExtractionSchema,
				messages: [
					{
						role: "user",
						content: [
							{
								type: "text",
								text: `Extraé una orden de compra de materiales en formato JSON siguiendo el esquema.

Instrucciones:
- Cada ítem: cantidad (número), unidad (texto), material (texto), precioUnitario (número o null)
- Detectá y normalizá números con separador decimal coma.
- Encabezados posibles: "Cantidad", "Unidad", "Detalle Descriptivo del pedido", "Precio Unit", "Total".
- Extraé también si aparecen: nroOrden, solicitante, gestor, proveedor.
- No inventes ítems; solo lo legible.`,
							},
							{ type: "image", image: imageDataUrl },
						],
					},
				],
				temperature: 0.1,
			});
			extraction = res.object;
		} else if (file) {
			const arrayBuffer = await file.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);
			if (file.type?.startsWith("image/")) {
				const mime = file.type || "image/png";
				const base64 = buffer.toString("base64");
				const dataUrl = `data:${mime};base64,${base64}`;

				const res = await generateObject({
					model: openai("gpt-4o-mini"),
					schema: aiExtractionSchema,
					messages: [
						{
							role: "user",
							content: [
								{
									type: "text",
									text: `Extraé una orden de compra de materiales (JSON).`,
								},
								{ type: "image", image: dataUrl },
							],
						},
					],
					temperature: 0.1,
				});
				extraction = res.object;
			} else if (file.type?.includes("pdf")) {
				// PDFs should be rasterized on the client and sent as imageDataUrl; bail if not
				return NextResponse.json(
					{
						ok: false,
						error:
							"PDF escaneado detectado. Reintenta (el cliente rasterizará a imagen).",
					},
					{ status: 422 }
				);
			} else {
				return NextResponse.json(
					{ ok: false, error: "Tipo de archivo no soportado (PDF o imagen)" },
					{ status: 400 }
				);
			}
		} else {
			return NextResponse.json(
				{ ok: false, error: "Tipo de archivo no soportado (PDF o imagen)" },
				{ status: 400 }
			);
		}

		// Safety check: if we got here without a valid extraction, fail early
		if (!extraction) {
			return NextResponse.json(
				{
					ok: false,
					error: "No se pudo extraer información de la orden",
				},
				{ status: 422 }
			);
		}

		// If preview mode, just return extraction without persisting
		if (previewMode) {
			return NextResponse.json({
				ok: true,
				items: extraction.items,
				meta: {
					nroOrden: extraction.nroOrden ?? null,
					solicitante: extraction.solicitante ?? null,
					gestor: extraction.gestor ?? null,
					proveedor: extraction.proveedor ?? null,
				},
			});
		}

		// Persist to DB
		const supabase = await createClient();

		// Validate obra exists before inserting
		const { data: obraExists, error: obraCheckError } = await supabase
			.from("obras")
			.select("id")
			.eq("id", obraId)
			.maybeSingle();
		if (obraCheckError) throw obraCheckError;
		if (!obraExists) {
			return NextResponse.json(
				{ ok: false, error: "Obra no encontrada" },
				{ status: 404 }
			);
		}

		const orderInsert = {
			obra_id: obraId,
			nro_orden: extraction.nroOrden ?? null,
			solicitante: extraction.solicitante ?? null,
			gestor: extraction.gestor ?? null,
			proveedor: extraction.proveedor ?? null,
			// This import endpoint is currently only used in preview mode from the Excel UI.
			// If in the future we support saving directly from here, doc info can be passed
			// via the request and wired into these fields.
			doc_bucket: null,
			doc_path: null,
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
				fileType: file instanceof File ? file.type : null,
				size: file instanceof File ? file.size : null,
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
		return NextResponse.json(
			{ error: message, ok: false, debug: { message } },
			{ status: 500 }
		);
	}
}
