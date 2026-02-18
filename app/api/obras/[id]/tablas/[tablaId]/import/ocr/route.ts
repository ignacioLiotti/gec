import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/utils/supabase/server";
import {
	coerceValueForType,
	ensureTablaDataType,
	MATERIALS_OCR_PROMPT,
} from "@/lib/tablas";
import {
	fetchTenantPlan,
	type SubscriptionPlanLimits,
} from "@/lib/subscription-plans";
import { incrementTenantUsage, logTenantUsageEvent } from "@/lib/tenant-usage";
import { estimateUsdForTokens } from "@/lib/ai-pricing";

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
const OCR_MODEL = process.env.OCR_MODEL ?? "gemini-2.5-flash";
const GOOGLE_API_KEY =
	process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GOOGLE_API_KEY;
const MIN_OCR_TOKEN_RESERVE = 1_500;
const MAX_OCR_TOKEN_RESERVE = 8_000;
const DEFAULT_OCR_TOKEN_RESERVE = 2_000;
const OCR_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS) || 90_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) =>
			setTimeout(() => reject(new Error(`${label} timeout`)), ms)
		),
	]);
}

function extractJsonFromText(raw: string) {
	const trimmed = raw.trim();
	if (!trimmed) {
		throw new Error("Respuesta vacía del modelo");
	}
	const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
	if (fencedMatch?.[1]) {
		return fencedMatch[1].trim();
	}
	const firstBrace = trimmed.indexOf("{");
	const lastBrace = trimmed.lastIndexOf("}");
	if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
		return trimmed.slice(firstBrace, lastBrace + 1);
	}
	throw new Error("No se encontró JSON en la respuesta del modelo");
}

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
		items: z.array(itemSchema).optional(),
	});
}

function buildEmptyExtraction(
	parentColumns: ColumnMeta[],
	itemColumns: ColumnMeta[]
) {
	const parent: Record<string, string> = {};
	for (const column of parentColumns) {
		parent[column.fieldKey] = "";
	}
	const item: Record<string, string> = {};
	for (const column of itemColumns) {
		item[column.fieldKey] = "";
	}
	return {
		...parent,
		items: [item],
	};
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
			const description = typeof column.config?.ocrDescription === "string"
				? (column.config.ocrDescription as string)
				: "";
			lines.push(
				`- ${label} (campo "${column.fieldKey}", tipo ${column.dataType})${description ? ` - ${description}` : ""}`
			);
		});
	}
	if (itemColumns.length > 0) {
		lines.push("Campos por ítem (items[]):");
		itemColumns.forEach((column) => {
			const label = column.label || column.fieldKey;
			const description = typeof column.config?.ocrDescription === "string"
				? (column.config.ocrDescription as string)
				: "";
			lines.push(
				`- ${label} (campo "${column.fieldKey}", tipo ${column.dataType})${description ? ` - ${description}` : ""}`
			);
		});
		lines.push('Incluí "items" si ves filas claras; si no, devolvé una lista vacía.');
	} else {
		lines.push("Esta tabla es de nivel documento: no repitas filas.");
	}
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
		.select("id, obra_id, name, source_type, settings, obras!inner(tenant_id)")
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

function estimateBase64Size(dataUrl: string | null): number {
	if (!dataUrl) return 0;
	const commaIndex = dataUrl.indexOf(",");
	if (commaIndex === -1) return 0;
	const base64 = dataUrl.slice(commaIndex + 1);
	return Math.floor((base64.length * 3) / 4);
}

function estimateOcrTokenUsage(
	file: File | null,
	dataUrl: string | null
): number {
	const baseBytes =
		typeof file?.size === "number" && file.size > 0
			? file.size
			: estimateBase64Size(dataUrl);
	if (!baseBytes) {
		return DEFAULT_OCR_TOKEN_RESERVE;
	}
	const approx = Math.round((baseBytes / 1024) * 40); // ~40 tokens per KB heuristic
	return Math.min(
		MAX_OCR_TOKEN_RESERVE,
		Math.max(MIN_OCR_TOKEN_RESERVE, approx)
	);
}

function extractTokenUsage(result: unknown): number {
	const usage =
		(result as any)?.response?.usage ??
		(result as any)?.usage ??
		(result as any)?.response?.body?.usage ??
		null;
	const candidate =
		usage?.totalTokens ??
		usage?.total_tokens ??
		usage?.total ??
		usage?.promptTokens ??
		null;
	const parsed =
		typeof candidate === "string"
			? Number.parseInt(candidate, 10)
			: Number(candidate);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
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
		const size =
			typeof buffer.length === "number"
				? buffer.length
				: ((buffer as any).byteLength ?? 0);
		return {
			bucket: DOCUMENTS_BUCKET,
			path: storagePath,
			fileName,
			uploadedBytes: size,
		};
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
	if (!GOOGLE_API_KEY) {
		console.error("[tabla-rows:ocr-import] Missing GOOGLE_API_KEY");
		return NextResponse.json(
			{
				error: "Falta configurar GOOGLE_GENERATIVE_AI_API_KEY en el servidor.",
			},
			{ status: 500 }
		);
	}
	let resolvedTenantId: string | null = null;
	let resolvedPlanLimits: SubscriptionPlanLimits | null = null;
	let reservedTokens = 0;
	let reservationApplied = false;
	let tokensSettled = false;
	let rollbackReservation: ((context: string) => Promise<void>) | null = null;

	// Track processing time
	const startTime = Date.now();
	let storageInfoForError: {
		bucket: string;
		path: string;
		fileName: string;
		uploadedBytes?: number;
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

		const tenantId =
			(tablaMeta as unknown as { obras?: { tenant_id?: string | null } })?.obras
				?.tenant_id ?? null;
		if (!tenantId) {
			return NextResponse.json(
				{ error: "No encontramos la organización de esta obra" },
				{ status: 400 }
			);
		}

		const plan = await fetchTenantPlan(supabase, tenantId);
		const planLimits = plan.limits;
		resolvedTenantId = tenantId;
		resolvedPlanLimits = planLimits;
		rollbackReservation = async (context: string) => {
			if (!reservationApplied || reservedTokens <= 0) return;
			try {
				await incrementTenantUsage(
					supabase,
					tenantId,
					{ aiTokens: -reservedTokens },
					planLimits
				);
				await logTenantUsageEvent(supabase, {
					tenantId,
					kind: "ai_tokens",
					amount: -reservedTokens,
					context,
					metadata: {
						obraId: id,
						tablaId,
						reservedTokens,
					},
				});
			} catch (rollbackError) {
				console.error(
					"[tabla-rows:ocr-import] Failed to rollback token reservation",
					rollbackError
				);
				try {
					await logTenantUsageEvent(supabase, {
						tenantId,
						kind: "ai_tokens",
						amount: 0,
						context: `${context}_failed`,
						metadata: {
							obraId: id,
							tablaId,
							reservedTokens,
							error:
								rollbackError instanceof Error
									? rollbackError.message
									: String(rollbackError),
						},
					});
				} catch (logError) {
					console.error(
						"[tabla-rows:ocr-import] Failed to log rollback failure",
						logError
					);
				}
				return;
			} finally {
				reservationApplied = false;
				reservedTokens = 0;
			}
		};
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
		let storageInfo: {
			bucket: string;
			path: string;
			fileName: string;
			uploadedBytes?: number;
		} | null =
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
					console.error(
						"[tabla-rows:ocr-import] Failed to download existing file:",
						downloadError
					);
					return NextResponse.json(
						{
							error: `No se pudo descargar el archivo: ${downloadError.message}`,
						},
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
				console.error(
					"[tabla-rows:ocr-import] Error fetching existing file:",
					fetchError
				);
				return NextResponse.json(
					{ error: "Error al obtener el archivo existente" },
					{ status: 400 }
				);
			}
		}

		const effectiveImageDataUrl =
			typeof imageDataUrl === "string" ? imageDataUrl : fetchedImageDataUrl;

		if (!file && !effectiveImageDataUrl) {
			return NextResponse.json(
				{ error: "Se requiere un archivo o imageDataUrl" },
				{ status: 400 }
			);
		}

		if (effectiveImageDataUrl) {
			const mimeMatch = effectiveImageDataUrl.match(/^data:([^;]+);/);
			console.log("[tabla-rows:ocr-import] image info", {
				mime: mimeMatch?.[1] ?? "unknown",
				dataUrlLength: effectiveImageDataUrl.length,
				startsWithData: effectiveImageDataUrl.startsWith("data:"),
				model: OCR_MODEL,
			});
		} else if (file) {
			console.log("[tabla-rows:ocr-import] file info", {
				name: file.name,
				type: file.type,
				size: file.size,
				model: OCR_MODEL,
			});
		}

		const enforceAiLimit =
			typeof planLimits.aiTokens === "number" && planLimits.aiTokens > 0;
		const tokenReservationTarget = enforceAiLimit
			? estimateOcrTokenUsage(
					file,
					typeof imageDataUrl === "string" ? imageDataUrl : fetchedImageDataUrl
				)
			: 0;

		if (enforceAiLimit && tokenReservationTarget > 0) {
			try {
				await incrementTenantUsage(
					supabase,
					tenantId,
					{ aiTokens: tokenReservationTarget },
					planLimits
				);
				await logTenantUsageEvent(supabase, {
					tenantId,
					kind: "ai_tokens",
					amount: tokenReservationTarget,
					context: "ocr_reservation",
					metadata: {
						obraId: id,
						tablaId,
					},
				});
				reservedTokens = tokenReservationTarget;
				reservationApplied = true;
			} catch (reservationError) {
				const err = reservationError as Error & { code?: string };
				const status =
					err.code === "ai_limit_exceeded"
						? 402
						: err.code === "insufficient_privilege"
							? 403
							: 400;
				return NextResponse.json(
					{
						error:
							err.message ||
							"Tu plan no tiene tokens de IA disponibles para procesar documentos.",
					},
					{ status }
				);
			}
		}

		let extraction: Record<string, any> | null = null;

		console.log("[tabla-rows:ocr-import] OCR prompt:", instructions);

		const runGenerateTextFallback = async (imageBytes: Uint8Array, mimeType: string) => {
			const b64 = Buffer.from(imageBytes).toString("base64");
			const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${OCR_MODEL}:generateContent?key=${GOOGLE_API_KEY}`;

			const callGeminiRaw = async (prompt: string) => {
				const body = {
					contents: [{
						parts: [
							{ text: prompt },
							{ inline_data: { mime_type: mimeType, data: b64 } },
						],
					}],
					generationConfig: { temperature: 0.1 },
				};
				const res = await withTimeout(
					fetch(apiUrl, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(body),
					}),
					OCR_TIMEOUT_MS,
					"OCR text generation (raw)"
				);
				if (!res.ok) {
					const errBody = await res.json().catch(() => ({}));
					throw new Error(errBody?.error?.message ?? `Gemini API error ${res.status}`);
				}
				const json = await res.json();
				return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
			};

			// First attempt
			const raw = await callGeminiRaw(
				`${instructions}\n\nResponde SOLO con JSON válido, sin explicaciones ni markdown.`
			);
			console.log("[tabla-rows:ocr-import] generateText raw response", { length: raw.length });

			if (!raw.trim()) {
				throw new Error("El modelo devolvió una respuesta vacía. La imagen puede no contener datos legibles.");
			}

			try {
				const jsonText = extractJsonFromText(raw);
				const parsedJson = JSON.parse(jsonText);
				const validated = extractionSchema.parse(parsedJson);
				return { object: validated };
			} catch (parseError) {
				console.warn(
					"[tabla-rows:ocr-import] generateText parse failed, retrying with template",
					{ length: raw.length }
				);
			}

			// Template retry
			const emptyTemplate = buildEmptyExtraction(parentColumns, itemColumns);
			const repairRaw = await callGeminiRaw(
				`${instructions}\n\nDevolvé SOLO JSON válido siguiendo este template. Si no podés leer un campo, dejalo vacío ("").\n\nTEMPLATE JSON:\n${JSON.stringify(emptyTemplate)}\n\nResponde SOLO con JSON válido.`
			);
			if (!repairRaw.trim()) {
				throw new Error("El modelo no pudo extraer datos de esta imagen.");
			}
			const jsonText = extractJsonFromText(repairRaw);
			const parsedJson = JSON.parse(jsonText);
			const validated = extractionSchema.parse(parsedJson);
			return { object: validated };
		};

		if (effectiveImageDataUrl && effectiveImageDataUrl.startsWith("data:")) {
			const { buffer: imgBuf, mime: imgMime } = dataUrlToBuffer(effectiveImageDataUrl);
			const imgBytes = new Uint8Array(imgBuf);
			try {
				const result = await runGenerateTextFallback(imgBytes, imgMime);
				extraction = result.object as Record<string, any>;
			} catch (err) {
				console.error("[tabla-rows:ocr-import] OCR extraction failed", err);
			}
		} else if (file) {
			const arrayBuffer = await file.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);

			if (file.type?.startsWith("image/")) {
				const mime = file.type || "image/png";
				const fileBytes = new Uint8Array(buffer);

				try {
					const result = await runGenerateTextFallback(fileBytes, mime);
					extraction = result.object as Record<string, any>;
				} catch (err) {
					console.error("[tabla-rows:ocr-import] OCR extraction failed", err);
				}
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
			console.warn(
				"[tabla-rows:ocr-import] OCR failed, no data extracted"
			);
			if (rollbackReservation && reservationApplied && !tokensSettled) {
				await rollbackReservation("ocr_extraction_failed");
			}
			return NextResponse.json(
				{ error: "No se pudieron extraer datos de la imagen. Intentá con una imagen más nítida o con otro formato." },
				{ status: 422 }
			);
		}
		if (!Array.isArray((extraction as any).items)) {
			(extraction as any).items = [];
		}
		if (itemColumns.length === 0) {
			(extraction as any).items = [{}];
		} else if ((extraction as any).items.length === 0) {
			const emptyItem = buildEmptyExtraction(parentColumns, itemColumns).items;
			(extraction as any).items = emptyItem;
		}

		const actualTokenUsage =
			reservationApplied
					? reservedTokens
					: DEFAULT_OCR_TOKEN_RESERVE;

		if (actualTokenUsage > 0) {
			try {
				await incrementTenantUsage(
					supabase,
					tenantId,
					{
						aiTokens: reservationApplied
							? actualTokenUsage - reservedTokens
							: actualTokenUsage,
					},
					planLimits
				);
				reservedTokens = actualTokenUsage;
				reservationApplied = true;
				tokensSettled = true;
			} catch (usageError) {
				const err = usageError as Error & { code?: string };
				const status =
					err.code === "ai_limit_exceeded"
						? 402
						: err.code === "insufficient_privilege"
							? 403
							: 400;
				await rollbackReservation("ocr_reservation_rollback");
				return NextResponse.json(
					{
						error:
							err.message ||
							"Tu organización superó el límite de tokens de IA disponible.",
					},
					{ status }
				);
			}
		} else if (reservationApplied) {
			await rollbackReservation("ocr_reservation_rollback");
			tokensSettled = true;
		}

		const costUsd =
			actualTokenUsage > 0
				? estimateUsdForTokens(OCR_MODEL, actualTokenUsage)
				: null;
		await logTenantUsageEvent(supabase, {
			tenantId,
			kind: "ai_tokens",
			amount: actualTokenUsage > 0 ? actualTokenUsage : reservedTokens,
			context: actualTokenUsage > 0 ? "ocr_import" : "ocr_reservation",
			metadata: {
				obraId: id,
				tablaId,
				storagePath: storageInfo?.path ?? null,
				fileName: storageInfo?.fileName ?? null,
				model: OCR_MODEL,
				costUsd,
			},
		});

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
					if (
						typeof storageInfo.uploadedBytes === "number" &&
						storageInfo.uploadedBytes > 0
					) {
						try {
							await incrementTenantUsage(
								supabase,
								tenantId,
								{ storageBytes: storageInfo.uploadedBytes },
								planLimits
							);
							await logTenantUsageEvent(supabase, {
								tenantId,
								kind: "storage_bytes",
								amount: storageInfo.uploadedBytes,
								context: "ocr_source_upload",
								metadata: {
									obraId: id,
									tablaId,
									path: storageInfo.path,
									fileName: storageInfo.fileName,
								},
							});
						} catch (storageLimitError) {
							await supabase.storage
								.from(storageInfo.bucket)
								.remove([storageInfo.path])
								.catch((removeError) =>
									console.error(
										"[tabla-rows:ocr-import] No se pudo eliminar archivo tras error de cuota",
										removeError
									)
								);
							const err = storageLimitError as Error & { code?: string };
							const status =
								err.code === "storage_limit_exceeded"
									? 402
									: err.code === "insufficient_privilege"
										? 403
										: 400;
							return NextResponse.json(
								{
									error:
										err.message ||
										"Superaste el límite de almacenamiento disponible.",
								},
								{ status }
							);
						}
					}
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

			if (
				rollbackReservation &&
				reservationApplied &&
				!tokensSettled &&
				reservedTokens > 0 &&
				resolvedTenantId &&
				resolvedPlanLimits
			) {
				await rollbackReservation("ocr_reservation_rollback");
		}

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
