import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

import { createClient } from "@/utils/supabase/server";
import {
	coerceValueForType,
	ensureTablaDataType,
	MATERIALS_OCR_PROMPT,
} from "@/lib/tablas";

type RouteContext = { params: Promise<{ id: string; tablaId: string }> };

type ColumnMeta = {
	id: string;
	label: string;
	fieldKey: string;
	dataType: ReturnType<typeof ensureTablaDataType>;
	required: boolean;
	config: Record<string, unknown>;
};

const DOCUMENTS_BUCKET = "obra-documents";

function zodTypeForColumn(column: ColumnMeta) {
	switch (column.dataType) {
		case "number":
		case "currency":
			return z.union([z.number(), z.string()]);
		case "boolean":
			return z.union([z.boolean(), z.string(), z.number()]);
		default:
			return z.string();
	}
}

function buildExtractionSchema(
	parentColumns: ColumnMeta[],
	itemColumns: ColumnMeta[]
) {
	const parentShape: Record<string, z.ZodTypeAny> = {};
	for (const column of parentColumns) {
		const base = zodTypeForColumn(column);
		parentShape[column.fieldKey] = column.required ? base : base.optional();
	}
	const itemShape: Record<string, z.ZodTypeAny> = {};
	for (const column of itemColumns) {
		const base = zodTypeForColumn(column);
		itemShape[column.fieldKey] = column.required ? base : base.optional();
	}
	const parentSchema = z.object(parentShape).passthrough();
	const itemSchema = z.object(itemShape).passthrough();
	return parentSchema.extend({
		items: z.array(itemSchema).min(1),
	});
}

function buildAutoInstructions({
	docType,
	parentColumns,
	itemColumns,
}: {
	docType?: string | null;
	parentColumns: ColumnMeta[];
	itemColumns: ColumnMeta[];
}) {
	const lines: string[] = [];
	const docLabel = docType && docType.length > 0 ? docType : "documento";
	lines.push(
		`Analizá el ${docLabel} y devolvé un JSON siguiendo este esquema.`
	);
	if (parentColumns.length > 0) {
		lines.push("Campos de la orden:");
		parentColumns.forEach((column) => {
			const label = column.label || column.fieldKey;
			lines.push(
				`- ${label} (campo "${column.fieldKey}", tipo ${column.dataType})`
			);
		});
	}
	if (itemColumns.length > 0) {
		lines.push("Campos por ítem (items[]):");
		itemColumns.forEach((column) => {
			const label = column.label || column.fieldKey;
			lines.push(
				`- ${label} (campo "${column.fieldKey}", tipo ${column.dataType})`
			);
		});
	}
	lines.push('La propiedad "items" debe contener al menos un ítem legible.');
	lines.push("No inventes valores; deja campos vacíos si no se pueden leer.");
	return lines.join("\n");
}

async function fetchTablaMeta(
	supabase: Awaited<ReturnType<typeof createClient>>,
	obraId: string,
	tablaId: string
) {
	const { data, error } = await supabase
		.from("obra_tablas")
		.select("id, obra_id, name, source_type, settings")
		.eq("id", tablaId)
		.eq("obra_id", obraId)
		.maybeSingle();
	if (error) throw error;
	return data;
}

async function fetchColumns(
	supabase: Awaited<ReturnType<typeof createClient>>,
	tablaId: string
) {
	const { data, error } = await supabase
		.from("obra_tabla_columns")
		.select(
			"id, tabla_id, field_key, label, data_type, required, position, config"
		)
		.eq("tabla_id", tablaId)
		.order("position", { ascending: true });
	if (error) throw error;
	return (data ?? []).map((column) => ({
		id: column.id as string,
		label: column.label as string,
		fieldKey: column.field_key as string,
		dataType: ensureTablaDataType(column.data_type as string | undefined),
		required: Boolean(column.required),
		config: (column.config as Record<string, unknown>) ?? {},
	}));
}

function sanitizeFileName(base: string) {
	return base
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-zA-Z0-9._-]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "")
		.toLowerCase();
}

function dataUrlToBuffer(imageDataUrl: string) {
	const match = imageDataUrl.match(/^data:(.+);base64,(.+)$/);
	if (!match) {
		throw new Error("imageDataUrl inválida");
	}
	const mime = match[1];
	const b64 = match[2];
	return { buffer: Buffer.from(b64, "base64"), mime };
}

async function uploadSourceToStorage({
	supabase,
	obraId,
	folderName,
	file,
	imageDataUrl,
}: {
	supabase: Awaited<ReturnType<typeof createClient>>;
	obraId: string;
	folderName: string;
	file: File | null;
	imageDataUrl: string | null;
}) {
	if (!file && !imageDataUrl) return null;

	const uniquePrefix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

	const uploadBuffer = async (
		buffer: Buffer,
		fileName: string,
		contentType: string
	) => {
		const storagePath = `${obraId}/${folderName}/${fileName}`;
		const { error } = await supabase.storage
			.from(DOCUMENTS_BUCKET)
			.upload(storagePath, buffer, { contentType, upsert: false });
		if (error) throw error;
		return { bucket: DOCUMENTS_BUCKET, path: storagePath, fileName };
	};

	if (file) {
		const originalName = file.name || "archivo";
		const extensionFromName = originalName.includes(".")
			? (originalName.split(".").pop() ?? "")
			: "";
		const ext =
			extensionFromName.toLowerCase() ||
			(file.type?.split("/")?.pop() ?? "bin");
		const safeBase =
			sanitizeFileName(originalName.replace(/\.[^/.]+$/, "")) || "archivo";
		const fileName = `${uniquePrefix}-${safeBase}.${ext}`;
		const buffer = Buffer.from(await file.arrayBuffer());
		return uploadBuffer(
			buffer,
			fileName,
			file.type || "application/octet-stream"
		);
	}

	if (imageDataUrl) {
		const { buffer, mime } = dataUrlToBuffer(imageDataUrl);
		const ext = mime.split("/").pop() || "png";
		const fileName = `${uniquePrefix}-captura.${ext}`;
		return uploadBuffer(buffer, fileName, mime);
	}

	return null;
}

export async function POST(request: NextRequest, context: RouteContext) {
	const { id, tablaId } = await context.params;
	if (!id || !tablaId) {
		return NextResponse.json(
			{ error: "Parámetros incompletos" },
			{ status: 400 }
		);
	}

	// Track processing time
	const startTime = Date.now();
	let storageInfoForError: {
		bucket: string;
		path: string;
		fileName: string;
	} | null = null;

	try {
		const supabase = await createClient();
		const tablaMeta = await fetchTablaMeta(supabase, id, tablaId);
		if (!tablaMeta) {
			return NextResponse.json(
				{ error: "Tabla no encontrada" },
				{ status: 404 }
			);
		}

		if ((tablaMeta.source_type as string) !== "ocr") {
			return NextResponse.json(
				{ error: "Esta tabla no está configurada para importación OCR" },
				{ status: 400 }
			);
		}
		const settings = (tablaMeta.settings as Record<string, unknown>) ?? {};
		const ocrProfile =
			typeof settings?.ocrProfile === "string"
				? (settings.ocrProfile as string)
				: null;
		const ocrFolderName =
			typeof settings?.ocrFolder === "string"
				? (settings.ocrFolder as string)
				: null;
		if (!ocrFolderName) {
			return NextResponse.json(
				{ error: "La tabla OCR no tiene carpeta asociada" },
				{ status: 400 }
			);
		}

		const columns = await fetchColumns(supabase, tablaId);
		if (columns.length === 0) {
			return NextResponse.json(
				{ error: "No hay columnas configuradas" },
				{ status: 400 }
			);
		}

		const columnMap = new Map(
			columns.map((column) => [column.fieldKey, column])
		);
		const parentColumns = columns.filter((column) => {
			const scope = (column.config?.ocrScope as string) || "item";
			return scope === "parent";
		});
		const parentKeys = new Set(parentColumns.map((column) => column.fieldKey));
		const itemColumns = columns.filter(
			(column) => !parentKeys.has(column.fieldKey)
		);
		const extractionSchema = buildExtractionSchema(parentColumns, itemColumns);
		const docType =
			typeof settings?.ocrDocType === "string"
				? (settings.ocrDocType as string)
				: null;
		const customInstructions =
			typeof settings?.ocrInstructions === "string" &&
			(settings.ocrInstructions as string).trim().length > 0
				? ((settings.ocrInstructions as string) ?? "").trim()
				: null;
		const instructions =
			customInstructions ??
			(ocrProfile === "materials"
				? MATERIALS_OCR_PROMPT
				: buildAutoInstructions({ docType, parentColumns, itemColumns }));

		const url = new URL(request.url);
		const previewMode =
			url.searchParams.get("preview") === "1" ||
			url.searchParams.get("preview") === "true";
		const skipStorage =
			url.searchParams.get("skipStorage") === "1" ||
			url.searchParams.get("skipStorage") === "true";

		const form = await request.formData();
		const imageDataUrl = form.get("imageDataUrl");
		const fileEntry = form.get("file");
		const file = fileEntry instanceof File ? fileEntry : null;
		const existingBucket = form.get("existingBucket");
		const existingPath = form.get("existingPath");
		const existingFileName = form.get("existingFileName");
		let storageInfo: { bucket: string; path: string; fileName: string } | null =
			typeof existingBucket === "string" &&
			existingBucket.length > 0 &&
			typeof existingPath === "string" &&
			existingPath.length > 0
				? {
						bucket: existingBucket,
						path: existingPath,
						fileName:
							typeof existingFileName === "string" &&
							existingFileName.trim().length > 0
								? sanitizeFileName(existingFileName)
								: sanitizeFileName(
										existingPath.split("/").pop() ?? `ocr-${Date.now()}.png`
									),
					}
				: null;
		if (storageInfo) {
			storageInfoForError = storageInfo;
		}

		// If we have an existing file in storage but no new file/imageDataUrl, fetch it
		let fetchedImageDataUrl: string | null = null;
		if (!file && typeof imageDataUrl !== "string" && storageInfo) {
			try {
				const { data: fileData, error: downloadError } = await supabase.storage
					.from(storageInfo.bucket)
					.download(storageInfo.path);

				if (downloadError) {
					console.error("[tabla-rows:ocr-import] Failed to download existing file:", downloadError);
					return NextResponse.json(
						{ error: `No se pudo descargar el archivo: ${downloadError.message}` },
						{ status: 400 }
					);
				}

				if (fileData) {
					const arrayBuffer = await fileData.arrayBuffer();
					const buffer = Buffer.from(arrayBuffer);
					const mime = fileData.type || "image/png";

					if (!mime.startsWith("image/")) {
						return NextResponse.json(
							{ error: "El archivo existente no es una imagen" },
							{ status: 400 }
						);
					}

					const base64 = buffer.toString("base64");
					fetchedImageDataUrl = `data:${mime};base64,${base64}`;
				}
			} catch (fetchError) {
				console.error("[tabla-rows:ocr-import] Error fetching existing file:", fetchError);
				return NextResponse.json(
					{ error: "Error al obtener el archivo existente" },
					{ status: 400 }
				);
			}
		}

		const effectiveImageDataUrl = typeof imageDataUrl === "string" ? imageDataUrl : fetchedImageDataUrl;

		if (!file && !effectiveImageDataUrl) {
			return NextResponse.json(
				{ error: "Se requiere un archivo o imageDataUrl" },
				{ status: 400 }
			);
		}

		let extraction: Record<string, any> | null = null;

		if (effectiveImageDataUrl && effectiveImageDataUrl.startsWith("data:")) {
			const res = await generateObject({
				model: openai("gpt-4o-mini"),
				schema: extractionSchema,
				messages: [
					{
						role: "user",
						content: [
							{
								type: "text",
								text: instructions,
							},
							{ type: "image", image: effectiveImageDataUrl },
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
					schema: extractionSchema,
					messages: [
						{
							role: "user",
							content: [
								{
									type: "text",
									text: instructions,
								},
								{ type: "image", image: dataUrl },
							],
						},
					],
					temperature: 0.1,
				});
				extraction = res.object;
			} else if (file.type?.includes("pdf")) {
				return NextResponse.json(
					{ error: "Convierte el PDF a imagen antes de enviarlo" },
					{ status: 422 }
				);
			} else {
				return NextResponse.json(
					{ error: "Tipo de archivo no soportado (PDF o imagen)" },
					{ status: 400 }
				);
			}
		}

		if (!extraction) {
			return NextResponse.json(
				{ error: "No se pudo extraer información de la orden" },
				{ status: 422 }
			);
		}

		if (previewMode) {
			const meta: Record<string, unknown> = {};
			for (const column of parentColumns) {
				meta[column.fieldKey] = (extraction as any)[column.fieldKey] ?? null;
			}
			return NextResponse.json({
				ok: true,
				items: extraction.items,
				meta,
			});
		}

		const baseMeta: Record<string, unknown> = {};
		for (const column of parentColumns) {
			if ((extraction as any)[column.fieldKey] == null) continue;
			baseMeta[column.fieldKey] = coerceValueForType(
				column.dataType,
				(extraction as any)[column.fieldKey]
			);
		}

		if (!previewMode && !skipStorage) {
			try {
				storageInfo = await uploadSourceToStorage({
					supabase,
					obraId: id,
					folderName: ocrFolderName,
					file,
					imageDataUrl: typeof imageDataUrl === "string" ? imageDataUrl : null,
				});
				if (storageInfo) {
					storageInfoForError = storageInfo;
				}
			} catch (storageError) {
				console.error("[tabla-rows:ocr-import] upload failed", storageError);
			}
		} else if (storageInfo) {
			storageInfoForError = storageInfo;
		}

		if (storageInfo) {
			baseMeta.__docBucket = storageInfo.bucket;
			baseMeta.__docPath = storageInfo.path;
			baseMeta.__docFileName = storageInfo.fileName;
			storageInfoForError = storageInfo;
		}

		if (storageInfo?.path) {
			try {
				await supabase
					.from("obra_tabla_rows")
					.delete()
					.eq("tabla_id", tablaId)
					.contains("data", { __docPath: storageInfo.path });
			} catch (deleteError) {
				console.error(
					"[tabla-rows:ocr-import] Failed clearing previous rows for",
					storageInfo.path,
					deleteError
				);
			}
		}

		const rowsPayload = extraction.items.map(
			(item: Record<string, unknown>) => {
				const data: Record<string, unknown> = { ...baseMeta };
				for (const column of itemColumns) {
					const rawValue = item[column.fieldKey];
					data[column.fieldKey] = coerceValueForType(
						column.dataType,
						rawValue ?? null
					);
				}
				return {
					tabla_id: tablaId,
					data,
					source: "ocr",
				};
			}
		);

		const { error: insertError } = await supabase
			.from("obra_tabla_rows")
			.insert(rowsPayload);
		if (insertError) throw insertError;

		// Track document processing
		if (storageInfo) {
			const processingDuration = Date.now() - startTime;
			await supabase.from("ocr_document_processing").upsert(
				{
					tabla_id: tablaId,
					obra_id: id,
					source_bucket: storageInfo.bucket,
					source_path: storageInfo.path,
					source_file_name: storageInfo.fileName,
					status: "completed",
					rows_extracted: rowsPayload.length,
					processed_at: new Date().toISOString(),
					processing_duration_ms: processingDuration,
				},
				{ onConflict: "tabla_id,source_path" }
			);
		}

		return NextResponse.json({
			ok: true,
			inserted: rowsPayload.length,
			file: storageInfo
				? { bucket: storageInfo.bucket, path: storageInfo.path }
				: null,
		});
	} catch (error) {
		console.error("[tabla-rows:ocr-import]", error);
		const message =
			error instanceof Error ? error.message : "Error desconocido";

		// Track failed processing if we have file info
		if (typeof storageInfoForError !== "undefined" && storageInfoForError) {
			try {
				const supabase = await createClient();
				await supabase.from("ocr_document_processing").upsert(
					{
						tabla_id: tablaId,
						obra_id: id,
						source_bucket: storageInfoForError.bucket,
						source_path: storageInfoForError.path,
						source_file_name: storageInfoForError.fileName,
						status: "failed",
						error_message: message,
						processed_at: new Date().toISOString(),
					},
					{ onConflict: "tabla_id,source_path" }
				);
			} catch (trackError) {
				console.error(
					"[tabla-rows:ocr-import] Failed to track error",
					trackError
				);
			}
		}

		return NextResponse.json({ error: message }, { status: 500 });
	}
}
