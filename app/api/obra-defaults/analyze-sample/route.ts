import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import * as XLSX from "xlsx";

import { createClient } from "@/utils/supabase/server";
import { ACTIVE_TENANT_COOKIE } from "@/lib/tenant-selection";
import {
	fetchTenantPlan,
	type SubscriptionPlanLimits,
} from "@/lib/subscription-plans";
import { incrementTenantUsage, logTenantUsageEvent } from "@/lib/tenant-usage";
import { estimateUsdForTokens } from "@/lib/ai-pricing";
import { localizeOcrProviderErrorMessage } from "@/lib/ocr-error-message";
import { normalizeFieldKey } from "@/lib/tablas";
import type { SampleAnalysis } from "@/lib/obra-defaults/sample-analysis";

const ANALYSIS_MODEL = process.env.OCR_MODEL ?? "gemini-2.5-flash";
const GOOGLE_API_KEY =
	process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GOOGLE_API_KEY;
const ANALYSIS_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS) || 90_000;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MIN_TOKEN_RESERVE = 1_500;
const MAX_TOKEN_RESERVE = 8_000;

const SPREADSHEET_MAX_SHEETS = 4;
const SPREADSHEET_MAX_ROWS_PER_SHEET = 60;
const SPREADSHEET_MAX_COLS = 30;
const SPREADSHEET_MAX_CHARS = 24_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) =>
			setTimeout(() => reject(new Error(`${label} timeout`)), ms),
		),
	]);
}

function inferMimeType(fileName: string, provided: string | undefined) {
	const trimmed = (provided ?? "").trim();
	if (trimmed && trimmed !== "application/octet-stream") return trimmed;
	const value = fileName.toLowerCase();
	if (value.endsWith(".pdf")) return "application/pdf";
	if (value.endsWith(".png")) return "image/png";
	if (value.endsWith(".jpg") || value.endsWith(".jpeg")) return "image/jpeg";
	if (value.endsWith(".webp")) return "image/webp";
	if (value.endsWith(".csv")) return "text/csv";
	if (value.endsWith(".xlsx") || value.endsWith(".xls")) {
		return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
	}
	return "application/octet-stream";
}

function isDocumentMime(mime: string) {
	return mime.startsWith("image/") || mime === "application/pdf";
}

function isSpreadsheetMime(mime: string, fileName: string) {
	const value = fileName.toLowerCase();
	return (
		mime === "text/csv" ||
		mime.includes("spreadsheet") ||
		mime === "application/vnd.ms-excel" ||
		value.endsWith(".xlsx") ||
		value.endsWith(".xls") ||
		value.endsWith(".csv")
	);
}

function spreadsheetToText(buffer: Buffer) {
	const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
	const sections: string[] = [];
	const sheetNames = workbook.SheetNames.slice(0, SPREADSHEET_MAX_SHEETS);
	for (const sheetName of sheetNames) {
		const sheet = workbook.Sheets[sheetName];
		if (!sheet) continue;
		const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
			header: 1,
			raw: false,
			blankrows: false,
		});
		const lines = rows
			.slice(0, SPREADSHEET_MAX_ROWS_PER_SHEET)
			.map((row) =>
				(Array.isArray(row) ? row : [])
					.slice(0, SPREADSHEET_MAX_COLS)
					.map((cell) => (cell == null ? "" : String(cell).trim()))
					.join(" | "),
			);
		sections.push(
			[
				`### Hoja "${sheetName}" (${rows.length} filas${rows.length > SPREADSHEET_MAX_ROWS_PER_SHEET ? ", recortadas" : ""})`,
				...lines,
			].join("\n"),
		);
	}
	if (workbook.SheetNames.length > sheetNames.length) {
		sections.push(
			`### (La planilla tiene ${workbook.SheetNames.length} hojas en total; se muestran las primeras ${sheetNames.length}.)`,
		);
	}
	const text = sections.join("\n\n");
	return text.length > SPREADSHEET_MAX_CHARS
		? `${text.slice(0, SPREADSHEET_MAX_CHARS)}\n(...contenido recortado)`
		: text;
}

const ANALYSIS_PROMPT = `Sos un asistente que ayuda a configurar la extracción de datos de documentos de obras de construcción (certificados, facturas, órdenes de compra, remitos, mediciones, etc.).

Analizá el documento adjunto y devolvé SOLO un JSON que describa su estructura para poder configurar la extracción automática de futuros documentos similares. No estás extrayendo datos para guardar: estás describiendo el documento y proponiendo qué conviene extraer.

Reglas:
- "family": nombre corto y natural del tipo de documento en español (ej: "certificado mensual de obra"). Se usa como nombre de carpeta.
- "fields": datos de nivel documento (aparecen una vez por documento): número, fecha, emisor, totales, etc. Para cada uno incluí el valor REAL leído del ejemplo en "sampleValue".
- "tables": listas de filas repetidas (ítems, materiales, tareas). Incluí hasta 3 filas reales en "sampleRows", con las claves iguales al "fieldKey" de cada columna.
- "fieldKey": snake_case, sin acentos, corto y estable (ej: "monto_total").
- "dataType": text | number | currency | date | boolean.
- "confidence": qué tan seguro estás de haber leído bien ese dato en este ejemplo (alta | media | baja).
- "meaning": una línea que explique qué es el dato y dónde suele estar, útil como instrucción de extracción.
- "aliases": otras formas en que ese dato puede aparecer rotulado (ej: "N°", "Nro.", "Numero").
- "format": pdf_texto (PDF digital), escaneo (documento escaneado), foto (foto de celular), planilla (Excel/CSV).
- "layoutHint": formulario_fijo si el documento parece un formulario con posiciones fijas; variable si es un documento libre.
- "sheets": solo para planillas, una entrada por hoja detectada.
- "suggestedInstructions": 1 a 4 instrucciones concretas para extraer bien este tipo de documento (ej: "usar el monto del recuadro final firmado, no el subtotal").
- "warnings": cosas que podrían complicar la extracción (sellos encima del texto, tablas cortadas entre páginas, etc.). Puede ser vacío.
- No inventes campos que no estén en el documento. Preferí pocos campos útiles antes que muchos dudosos.
- Todos los textos visibles para el usuario van en español rioplatense, sin tecnicismos.`;

const GEMINI_RESPONSE_SCHEMA = {
	type: "OBJECT",
	properties: {
		document: {
			type: "OBJECT",
			properties: {
				family: { type: "STRING" },
				summary: { type: "STRING" },
				format: {
					type: "STRING",
					enum: ["pdf_texto", "escaneo", "foto", "planilla"],
				},
				legibility: { type: "STRING", enum: ["alta", "media", "baja"] },
				pageCount: { type: "INTEGER" },
				sheets: {
					type: "ARRAY",
					items: {
						type: "OBJECT",
						properties: {
							name: { type: "STRING" },
							hasData: { type: "BOOLEAN" },
							summary: { type: "STRING" },
						},
						required: ["name", "hasData", "summary"],
					},
				},
				layoutHint: {
					type: "STRING",
					enum: ["formulario_fijo", "variable"],
				},
			},
			required: [
				"family",
				"summary",
				"format",
				"legibility",
				"pageCount",
				"layoutHint",
			],
		},
		fields: {
			type: "ARRAY",
			items: {
				type: "OBJECT",
				properties: {
					fieldKey: { type: "STRING" },
					label: { type: "STRING" },
					dataType: {
						type: "STRING",
						enum: ["text", "number", "currency", "date", "boolean"],
					},
					sampleValue: { type: "STRING", nullable: true },
					confidence: { type: "STRING", enum: ["alta", "media", "baja"] },
					meaning: { type: "STRING" },
					aliases: { type: "ARRAY", items: { type: "STRING" } },
				},
				required: ["fieldKey", "label", "dataType", "confidence", "meaning"],
			},
		},
		tables: {
			type: "ARRAY",
			items: {
				type: "OBJECT",
				properties: {
					label: { type: "STRING" },
					description: { type: "STRING" },
					columns: {
						type: "ARRAY",
						items: {
							type: "OBJECT",
							properties: {
								fieldKey: { type: "STRING" },
								label: { type: "STRING" },
								dataType: {
									type: "STRING",
									enum: ["text", "number", "currency", "date", "boolean"],
								},
								sampleValue: { type: "STRING", nullable: true },
								confidence: {
									type: "STRING",
									enum: ["alta", "media", "baja"],
								},
								meaning: { type: "STRING" },
								aliases: { type: "ARRAY", items: { type: "STRING" } },
							},
							required: [
								"fieldKey",
								"label",
								"dataType",
								"confidence",
								"meaning",
							],
						},
					},
					sampleRows: {
						type: "ARRAY",
						items: {
							type: "OBJECT",
							properties: {},
						},
					},
					totalRowsSeen: { type: "INTEGER" },
				},
				required: ["label", "description", "columns", "totalRowsSeen"],
			},
		},
		suggestedInstructions: { type: "ARRAY", items: { type: "STRING" } },
		warnings: { type: "ARRAY", items: { type: "STRING" } },
	},
	required: ["document", "fields", "tables", "suggestedInstructions", "warnings"],
} as const;

const confidenceSchema = z
	.enum(["alta", "media", "baja"])
	.catch("media" as const);
const dataTypeSchema = z
	.enum(["text", "number", "currency", "date", "boolean"])
	.catch("text" as const);

const analysisFieldSchema = z.object({
	fieldKey: z.string().min(1),
	label: z.string().min(1),
	dataType: dataTypeSchema,
	sampleValue: z.string().nullish(),
	confidence: confidenceSchema,
	meaning: z.string().catch(""),
	aliases: z.array(z.string()).catch([]),
});

const analysisResponseSchema = z.object({
	document: z.object({
		family: z.string().min(1),
		summary: z.string().catch(""),
		format: z
			.enum(["pdf_texto", "escaneo", "foto", "planilla"])
			.catch("pdf_texto" as const),
		legibility: confidenceSchema,
		pageCount: z.number().int().catch(1),
		sheets: z
			.array(
				z.object({
					name: z.string().catch(""),
					hasData: z.boolean().catch(true),
					summary: z.string().catch(""),
				}),
			)
			.catch([]),
		layoutHint: z
			.enum(["formulario_fijo", "variable"])
			.catch("variable" as const),
	}),
	fields: z.array(analysisFieldSchema).catch([]),
	tables: z
		.array(
			z.object({
				label: z.string().min(1),
				description: z.string().catch(""),
				columns: z.array(analysisFieldSchema).catch([]),
				sampleRows: z.array(z.record(z.unknown())).catch([]),
				totalRowsSeen: z.number().int().catch(0),
			}),
		)
		.catch([]),
	suggestedInstructions: z.array(z.string()).catch([]),
	warnings: z.array(z.string()).catch([]),
});

function normalizeAnalysis(
	parsed: z.infer<typeof analysisResponseSchema>,
): SampleAnalysis {
	const seenKeys = new Set<string>();
	const normalizeField = (field: z.infer<typeof analysisFieldSchema>) => {
		let fieldKey = normalizeFieldKey(field.fieldKey || field.label);
		if (!fieldKey) fieldKey = normalizeFieldKey(field.label) || "campo";
		let unique = fieldKey;
		let suffix = 2;
		while (seenKeys.has(unique)) {
			unique = `${fieldKey}_${suffix}`;
			suffix += 1;
		}
		seenKeys.add(unique);
		return {
			fieldKey: unique,
			label: field.label.trim() || unique,
			dataType: field.dataType,
			sampleValue:
				typeof field.sampleValue === "string" && field.sampleValue.trim()
					? field.sampleValue.trim()
					: null,
			confidence: field.confidence,
			meaning: field.meaning.trim(),
			aliases: field.aliases.map((alias) => alias.trim()).filter(Boolean),
		};
	};

	const fields = parsed.fields.map(normalizeField);
	const tables = parsed.tables.map((table) => {
		seenKeys.clear();
		const columns = table.columns.map(normalizeField);
		const columnKeyByOriginal = new Map(
			table.columns.map((original, index) => [
				normalizeFieldKey(original.fieldKey || original.label),
				columns[index].fieldKey,
			]),
		);
		const sampleRows = table.sampleRows.slice(0, 3).map((row) => {
			const normalizedRow: Record<string, string> = {};
			for (const [rawKey, rawValue] of Object.entries(row)) {
				if (rawValue == null) continue;
				const mappedKey =
					columnKeyByOriginal.get(normalizeFieldKey(rawKey)) ??
					normalizeFieldKey(rawKey);
				if (!mappedKey) continue;
				normalizedRow[mappedKey] = String(rawValue).trim();
			}
			return normalizedRow;
		});
		return {
			label: table.label.trim(),
			description: table.description.trim(),
			columns,
			sampleRows,
			totalRowsSeen: table.totalRowsSeen,
		};
	});
	seenKeys.clear();

	return {
		document: {
			family: parsed.document.family.trim(),
			summary: parsed.document.summary.trim(),
			format: parsed.document.format,
			legibility: parsed.document.legibility,
			pageCount: Math.max(1, parsed.document.pageCount),
			sheets: parsed.document.sheets.map((sheet) => ({
				name: sheet.name.trim(),
				hasData: sheet.hasData,
				summary: sheet.summary.trim(),
			})),
			layoutHint: parsed.document.layoutHint,
		},
		fields,
		tables,
		suggestedInstructions: parsed.suggestedInstructions
			.map((line) => line.trim())
			.filter(Boolean),
		warnings: parsed.warnings.map((line) => line.trim()).filter(Boolean),
	};
}

function extractJsonFromText(raw: string) {
	const trimmed = raw.trim();
	if (!trimmed) throw new Error("Respuesta vacía del modelo");
	const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
	if (fencedMatch?.[1]) return fencedMatch[1].trim();
	const firstBrace = trimmed.indexOf("{");
	const lastBrace = trimmed.lastIndexOf("}");
	if (firstBrace !== -1 && lastBrace > firstBrace) {
		return trimmed.slice(firstBrace, lastBrace + 1);
	}
	throw new Error("No se encontró JSON en la respuesta del modelo");
}

function estimateTokenReserve(bytes: number) {
	if (!bytes) return MIN_TOKEN_RESERVE;
	const approx = Math.round((bytes / 1024) * 40);
	return Math.min(MAX_TOKEN_RESERVE, Math.max(MIN_TOKEN_RESERVE, approx));
}

async function getAuthContext() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return { supabase, user: null, tenantId: null };

	const cookieStore = await cookies();
	const preferredTenantId = cookieStore.get(ACTIVE_TENANT_COOKIE)?.value;

	let membership = null;
	if (preferredTenantId) {
		const preferredResult = await supabase
			.from("memberships")
			.select("tenant_id")
			.eq("user_id", user.id)
			.eq("tenant_id", preferredTenantId)
			.limit(1)
			.maybeSingle();
		membership = preferredResult.data ?? null;
	}
	if (!membership) {
		const fallbackResult = await supabase
			.from("memberships")
			.select("tenant_id")
			.eq("user_id", user.id)
			.order("created_at", { ascending: true })
			.limit(1)
			.maybeSingle();
		membership = fallbackResult.data ?? null;
	}

	return { supabase, user, tenantId: membership?.tenant_id ?? null };
}

type GeminiPart =
	| { text: string }
	| { inline_data: { mime_type: string; data: string } };

async function callGeminiAnalysis(parts: GeminiPart[]) {
	const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${ANALYSIS_MODEL}:generateContent?key=${GOOGLE_API_KEY}`;
	const body = {
		contents: [{ parts }],
		generationConfig: {
			temperature: 0.1,
			responseMimeType: "application/json",
			responseSchema: GEMINI_RESPONSE_SCHEMA,
		},
	};
	const res = await withTimeout(
		fetch(apiUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
		ANALYSIS_TIMEOUT_MS,
		"Sample analysis",
	);
	if (!res.ok) {
		const errBody = await res.json().catch(() => ({}));
		const providerMessage =
			typeof errBody?.error?.message === "string"
				? errBody.error.message
				: `Gemini API error ${res.status}`;
		throw new Error(localizeOcrProviderErrorMessage(providerMessage));
	}
	const payload = await res.json();
	const rawText: string =
		payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
	const totalTokens: number =
		Number(payload?.usageMetadata?.totalTokenCount) || 0;
	return { rawText, totalTokens };
}

export async function POST(request: NextRequest) {
	let tenantId: string | null = null;
	let planLimits: SubscriptionPlanLimits | null = null;
	let reservedTokens = 0;
	let supabaseForRollback: Awaited<ReturnType<typeof createClient>> | null =
		null;

	const rollbackReservation = async (context: string) => {
		if (!supabaseForRollback || !tenantId || reservedTokens <= 0 || !planLimits)
			return;
		await incrementTenantUsage(
			supabaseForRollback,
			tenantId,
			{ aiTokens: -reservedTokens },
			planLimits,
		);
		await logTenantUsageEvent(supabaseForRollback, {
			tenantId,
			kind: "ai_tokens",
			amount: -reservedTokens,
			context,
			metadata: { reservedTokens },
		});
		reservedTokens = 0;
	};

	try {
		const { supabase, user, tenantId: resolvedTenantId } =
			await getAuthContext();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		if (!resolvedTenantId) {
			return NextResponse.json({ error: "No tenant" }, { status: 400 });
		}
		tenantId = resolvedTenantId;
		supabaseForRollback = supabase;

		const { data: canManage, error: permissionError } = await supabase.rpc(
			"has_permission",
			{ tenant: resolvedTenantId, perm_key: "admin:obra-defaults" },
		);
		if (permissionError) throw permissionError;
		if (canManage !== true) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		if (!GOOGLE_API_KEY) {
			return NextResponse.json(
				{
					error:
						"Falta configurar GOOGLE_GENERATIVE_AI_API_KEY en el servidor.",
				},
				{ status: 500 },
			);
		}

		const form = await request.formData();
		const fileEntry = form.get("file");
		const file = fileEntry instanceof File ? fileEntry : null;
		if (!file) {
			return NextResponse.json(
				{ error: "Se requiere un archivo de ejemplo." },
				{ status: 400 },
			);
		}
		if (file.size > MAX_FILE_BYTES) {
			return NextResponse.json(
				{ error: "El archivo supera el límite de 15 MB." },
				{ status: 413 },
			);
		}

		const fileName = file.name || "ejemplo";
		const mime = inferMimeType(fileName, file.type);
		const buffer = Buffer.from(await file.arrayBuffer());

		let parts: GeminiPart[];
		if (isDocumentMime(mime)) {
			parts = [
				{ text: ANALYSIS_PROMPT },
				{
					inline_data: {
						mime_type: mime,
						data: buffer.toString("base64"),
					},
				},
			];
		} else if (isSpreadsheetMime(mime, fileName)) {
			const spreadsheetText = spreadsheetToText(buffer);
			if (!spreadsheetText.trim()) {
				return NextResponse.json(
					{ error: "La planilla está vacía o no se pudo leer." },
					{ status: 422 },
				);
			}
			parts = [
				{ text: ANALYSIS_PROMPT },
				{
					text: `El documento es una planilla ("${fileName}"). Contenido por hoja, celdas separadas con " | ":\n\n${spreadsheetText}`,
				},
			];
		} else {
			return NextResponse.json(
				{
					error:
						"Tipo de archivo no soportado. Subí un PDF, una imagen o una planilla (Excel/CSV).",
				},
				{ status: 400 },
			);
		}

		const plan = await fetchTenantPlan(supabase, resolvedTenantId);
		planLimits = plan.limits;
		const enforceAiLimit =
			typeof planLimits.aiTokens === "number" && planLimits.aiTokens > 0;
		if (enforceAiLimit) {
			const reserveTarget = estimateTokenReserve(file.size);
			try {
				await incrementTenantUsage(
					supabase,
					resolvedTenantId,
					{ aiTokens: reserveTarget },
					planLimits,
				);
				reservedTokens = reserveTarget;
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
							"Tu plan no tiene tokens de IA disponibles para analizar documentos.",
					},
					{ status },
				);
			}
		}

		let rawText = "";
		let totalTokens = 0;
		try {
			({ rawText, totalTokens } = await callGeminiAnalysis(parts));
		} catch (analysisError) {
			await rollbackReservation("sample_analysis_failed");
			throw analysisError;
		}

		const actualTokens = Math.max(totalTokens, reservedTokens);
		if (actualTokens > reservedTokens) {
			try {
				await incrementTenantUsage(
					supabase,
					resolvedTenantId,
					{ aiTokens: actualTokens - reservedTokens },
					planLimits,
				);
				reservedTokens = actualTokens;
			} catch {
				// Settlement over-limit: keep the reservation, the analysis already ran.
			}
		}
		await logTenantUsageEvent(supabase, {
			tenantId: resolvedTenantId,
			kind: "ai_tokens",
			amount: actualTokens,
			context: "sample_analysis",
			metadata: {
				model: ANALYSIS_MODEL,
				fileName,
				mime,
				costUsd:
					actualTokens > 0
						? estimateUsdForTokens(ANALYSIS_MODEL, actualTokens)
						: null,
			},
		});

		let analysis: SampleAnalysis;
		try {
			const jsonText = extractJsonFromText(rawText);
			analysis = normalizeAnalysis(
				analysisResponseSchema.parse(JSON.parse(jsonText)),
			);
		} catch (parseError) {
			console.error(
				"[obra-defaults:analyze-sample] invalid model response",
				parseError,
			);
			return NextResponse.json(
				{
					error:
						"No pudimos interpretar el documento. Probá con otro archivo o con una versión más legible.",
				},
				{ status: 422 },
			);
		}

		if (analysis.fields.length === 0 && analysis.tables.length === 0) {
			return NextResponse.json(
				{
					error:
						"No encontramos datos para extraer en este documento. Probá con un ejemplo más completo.",
				},
				{ status: 422 },
			);
		}

		return NextResponse.json({ analysis });
	} catch (error) {
		console.error("[obra-defaults:analyze-sample] error", error);
		await rollbackReservation("sample_analysis_error").catch(() => undefined);
		const message =
			error instanceof Error ? error.message : "Error analizando el documento";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
