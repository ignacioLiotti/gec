import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runDocumentAi } from "@/lib/document-ai/orchestrate-run";
import { retrieveDocumentAiContext } from "@/lib/document-ai/retrieval/retrieve-document-ai-context";
import {
	DOCUMENT_AI_OUTPUT_TYPES,
	type DocumentAiIntent,
	type DocumentAiOutputType,
	type DocumentAiRow,
} from "@/lib/document-ai/schemas/types";
import {
	validateStoragePath,
	type DocumentAiChatScope,
	type ValidatedObra,
} from "./scope";

const DOCUMENTS_BUCKET = "obra-documents";
const SIGNED_URL_TTL_SECONDS = 3600;
const MAX_SEARCH_ROWS = 40;
const MAX_SEARCH_CHUNKS = 8;
const MAX_TABLE_ROWS = 100;

export type CollectedToolInvocation = {
	toolName: string;
	args: Record<string, unknown>;
	result: unknown;
};

type ToolFactoryParams = {
	supabase: SupabaseClient;
	admin: SupabaseClient;
	tenantId: string;
	userId: string;
	baseUrl: string;
	scope: DocumentAiChatScope;
	tenantObras: Map<string, ValidatedObra>;
	onInvocation: (invocation: CollectedToolInvocation) => void;
};

function compactRowData(data: Record<string, unknown>, maxFields = 10) {
	const entries = Object.entries(data)
		.filter(([key, value]) => !key.startsWith("__") && value !== null && value !== "")
		.slice(0, maxFields);
	return Object.fromEntries(entries);
}

function normalizeFileName(name: string) {
	return name.normalize("NFC").trim().toLowerCase();
}

/** Collapses a file name to alphanumerics for loose matching across naming styles
 * (e.g. "CERT 8 - CLUB SPORTIVO.PDF" vs "cert-8-club-sportivo.pdf"). */
function normalizeForMatch(name: string) {
	return name
		.normalize("NFC")
		.toLowerCase()
		.replace(/\.[a-z0-9]+$/i, "")
		.replace(/[^a-z0-9]+/g, "");
}

/**
 * Signs a storage path, falling back to a directory listing when the exact
 * path is missing. `__docPath`/`source_path` can drift from the real object
 * name (folder renames, or NFC/NFD Unicode differences in accented Spanish
 * filenames between OSes), so we match by normalized name as a last resort.
 */
async function signDocument(admin: SupabaseClient, bucket: string, path: string, ttlSeconds: number) {
	const direct = await admin.storage.from(bucket).createSignedUrl(path, ttlSeconds);
	if (!direct.error && direct.data?.signedUrl) {
		return { path, signedUrl: direct.data.signedUrl, error: null as string | null };
	}
	const lastSlash = path.lastIndexOf("/");
	const dir = lastSlash >= 0 ? path.slice(0, lastSlash) : "";
	const fileName = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
	const { data: listing } = await admin.storage.from(bucket).list(dir, { limit: 1000 });
	const match = (listing ?? []).find(
		(item) => item.metadata && normalizeFileName(item.name) === normalizeFileName(fileName),
	);
	if (match) {
		const correctedPath = dir ? `${dir}/${match.name}` : match.name;
		const retry = await admin.storage.from(bucket).createSignedUrl(correctedPath, ttlSeconds);
		if (!retry.error && retry.data?.signedUrl) {
			return { path: correctedPath, signedUrl: retry.data.signedUrl, error: null as string | null };
		}
	}
	return { path, signedUrl: null, error: direct.error?.message ?? "desconocido" };
}

function compactRow(row: DocumentAiRow) {
	return {
		filaId: row.id,
		tablaId: row.tableId,
		tabla: row.tableName,
		obraId: row.obraId,
		tipoDocumento: row.documentType,
		documento: typeof row.data.__docFileName === "string" ? row.data.__docFileName : null,
		storagePath: typeof row.data.__docPath === "string" ? row.data.__docPath : null,
		datos: compactRowData(row.data),
	};
}

export function buildDocumentAiChatTools(params: ToolFactoryParams) {
	const { supabase, admin, tenantId, userId, baseUrl, scope, tenantObras, onInvocation } = params;

	/** Model-provided obra ids are suggestions; only tenant obras pass. */
	const resolveObraId = (candidate?: string | null) => {
		if (candidate && tenantObras.has(candidate)) return candidate;
		return null;
	};

	const searchObraIds = (candidate?: string | null): Array<string | null> => {
		const direct = resolveObraId(candidate);
		if (direct) return [direct];
		if (scope.obraIds.length > 0) return scope.obraIds.slice(0, 5);
		return [null];
	};

	const collect = <T>(toolName: string, args: Record<string, unknown>, result: T): T => {
		onInvocation({ toolName, args, result });
		return result;
	};

	return {
		listar_obras: tool({
			description:
				"Lista las obras del tenant actual con su id, nombre y porcentaje de avance. Usala para resolver a qué obra se refiere el usuario.",
			parameters: z.object({}),
			execute: async () => {
				const obras = Array.from(tenantObras.values()).map((obra) => ({
					id: obra.id,
					nombre: obra.nombre,
					avance: obra.avance,
				}));
				return collect("listar_obras", {}, { total: obras.length, obras: obras.slice(0, 100) });
			},
		}),

		listar_carpetas: tool({
			description:
				"Lista las carpetas y archivos de una obra en una ruta dada (vacía = raíz). Indica qué carpetas tienen tablas OCR vinculadas.",
			parameters: z.object({
				obraId: z.string().describe("Id de la obra (de listar_obras o del alcance seleccionado)"),
				ruta: z.string().optional().describe("Ruta relativa de la carpeta, vacía para la raíz"),
			}),
			execute: async ({ obraId, ruta }) => {
				const args = { obraId, ruta: ruta ?? "" };
				const validObraId = resolveObraId(obraId);
				if (!validObraId) {
					return collect("listar_carpetas", args, {
						error: "La obra no existe o no pertenece a esta organización.",
					});
				}
				const relative = (ruta ?? "").split("/").filter((part) => part && part !== "..").join("/");
				const prefix = relative ? `${validObraId}/${relative}` : validObraId;

				const [listResult, tablasResult] = await Promise.all([
					supabase.storage.from(DOCUMENTS_BUCKET).list(prefix, {
						limit: 200,
						sortBy: { column: "name", order: "asc" },
					}),
					supabase
						.from("obra_tablas")
						.select("id, name, settings")
						.eq("obra_id", validObraId)
						.eq("source_type", "ocr"),
				]);
				if (listResult.error) {
					return collect("listar_carpetas", args, {
						error: `No se pudo listar la carpeta: ${listResult.error.message}`,
					});
				}
				const ocrFolders = new Map<string, string>();
				for (const tabla of (tablasResult.data ?? []) as Array<Record<string, unknown>>) {
					const settings = (tabla.settings as Record<string, unknown>) ?? {};
					const folder = typeof settings.ocrFolder === "string" ? settings.ocrFolder : "";
					if (folder) ocrFolders.set(folder.toLowerCase(), String(tabla.id));
				}

				const carpetas: Array<{ nombre: string; ruta: string; ocrTablaId: string | null }> = [];
				const archivos: Array<{ nombre: string; storagePath: string; bytes: number | null }> = [];
				for (const item of listResult.data ?? []) {
					if (item.name === ".emptyFolderPlaceholder" || item.name === ".keep") continue;
					if (!item.metadata) {
						const childPath = relative ? `${relative}/${item.name}` : item.name;
						carpetas.push({
							nombre: item.name,
							ruta: childPath,
							ocrTablaId: ocrFolders.get(childPath.toLowerCase()) ?? ocrFolders.get(item.name.toLowerCase()) ?? null,
						});
					} else {
						archivos.push({
							nombre: item.name,
							storagePath: `${prefix}/${item.name}`,
							bytes: typeof item.metadata.size === "number" ? item.metadata.size : null,
						});
					}
				}
				return collect("listar_carpetas", args, {
					obraId: validObraId,
					ruta: relative,
					carpetas,
					archivos: archivos.slice(0, 100),
				});
			},
		}),

		buscar_documentos: tool({
			description:
				"Busca filas extraídas y fragmentos indexados de los documentos de obra (certificados, facturas, órdenes de compra, etc.). Devuelve datos estructurados con su documento de origen.",
			parameters: z.object({
				consulta: z.string().describe("Qué se está buscando, en lenguaje natural"),
				obraId: z.string().optional().describe("Limitar a una obra puntual"),
				carpeta: z.string().optional().describe("Limitar a una carpeta (ruta relativa)"),
				tipoDocumento: z
					.string()
					.optional()
					.describe("Ej: certificado_avance, orden_compra, factura, remito, contrato, presupuesto"),
				fechaDesde: z.string().optional().describe("ISO yyyy-mm-dd"),
				fechaHasta: z.string().optional().describe("ISO yyyy-mm-dd"),
			}),
			execute: async ({ consulta, obraId, carpeta, tipoDocumento, fechaDesde, fechaHasta }) => {
				const args = { consulta, obraId, carpeta, tipoDocumento, fechaDesde, fechaHasta };
				try {
					const targets = searchObraIds(obraId);
					const folderFromScope =
						!carpeta && targets.length === 1 && targets[0]
							? scope.folders.find((folder) => folder.obraId === targets[0])?.path ?? null
							: null;

					const contexts = await Promise.all(
						targets.map((targetObraId) => {
							const intent: DocumentAiIntent = {
								output: "summary",
								documentTypes: tipoDocumento ? [tipoDocumento] : [],
								filters: {
									obraId: targetObraId,
									folderPath: carpeta ?? folderFromScope,
									dateFrom: fechaDesde ?? null,
									dateTo: fechaHasta ?? null,
									proveedor: null,
									estado: null,
								},
								analysisGoal: consulta,
								metrics: ["count"],
								groupBy: "none",
								chartType: "table",
								wantsContinuity: false,
							};
							return retrieveDocumentAiContext({ supabase, tenantId, intent, limit: 150 });
						}),
					);

					const rows = contexts.flatMap((context) => context.rows);
					const chunks = contexts.flatMap((context) => context.chunks);
					const warnings = Array.from(new Set(contexts.flatMap((context) => context.warnings)));

					const documentos = new Map<string, { nombre: string | null; storagePath: string; tipo: string | null; obraId: string | null }>();
					for (const row of rows) {
						const path = typeof row.data.__docPath === "string" ? row.data.__docPath : null;
						if (path && !documentos.has(path)) {
							documentos.set(path, {
								nombre: typeof row.data.__docFileName === "string" ? row.data.__docFileName : null,
								storagePath: path,
								tipo: row.documentType,
								obraId: row.obraId,
							});
						}
					}

					return collect("buscar_documentos", args, {
						totalFilas: rows.length,
						filas: rows.slice(0, MAX_SEARCH_ROWS).map(compactRow),
						fragmentos: chunks.slice(0, MAX_SEARCH_CHUNKS).map((chunk) => ({
							tipoDocumento: chunk.documentType,
							contenido: chunk.content.slice(0, 400),
							datos: compactRowData(chunk.structuredData, 8),
						})),
						documentos: Array.from(documentos.values()).slice(0, 20),
						advertencias: warnings,
					});
				} catch (error) {
					// A thrown tool error aborts the whole stream; report it as data
					// so the model can tell the user instead.
					console.error("[document-ai/chat] buscar_documentos failed", error);
					return collect("buscar_documentos", args, {
						error: error instanceof Error ? error.message : "La búsqueda falló.",
					});
				}
			},
		}),

		obtener_filas_tabla: tool({
			description:
				"Trae filas completas de una tabla específica de una obra (tablaId de buscar_documentos o listar_carpetas).",
			parameters: z.object({
				tablaId: z.string().describe("Id de la tabla"),
				limite: z.number().int().min(1).max(MAX_TABLE_ROWS).optional(),
			}),
			execute: async ({ tablaId, limite }) => {
				const args = { tablaId, limite: limite ?? 50 };
				const { data: tabla, error: tablaError } = await supabase
					.from("obra_tablas")
					.select("id, name, obra_id, obras!inner(tenant_id)")
					.eq("id", tablaId)
					.eq("obras.tenant_id", tenantId)
					.maybeSingle();
				if (tablaError || !tabla) {
					return collect("obtener_filas_tabla", args, {
						error: "La tabla no existe o no pertenece a esta organización.",
					});
				}
				const { data: rawRows, error: rowsError } = await supabase
					.from("obra_tabla_rows")
					.select("id, data, created_at")
					.eq("tabla_id", tablaId)
					.order("created_at", { ascending: false })
					.limit(Math.min(limite ?? 50, MAX_TABLE_ROWS));
				if (rowsError) {
					return collect("obtener_filas_tabla", args, {
						error: `No se pudieron cargar las filas: ${rowsError.message}`,
					});
				}
				return collect("obtener_filas_tabla", args, {
					tabla: { id: String(tabla.id), nombre: typeof tabla.name === "string" ? tabla.name : null },
					filas: (rawRows ?? []).map((row) => ({
						id: String(row.id),
						datos: compactRowData((row.data as Record<string, unknown>) ?? {}, 14),
					})),
				});
			},
		}),

		preview_documento: tool({
			description:
				"Genera una previsualización segura (URL firmada temporal) de un documento para mostrarla al usuario. Usala cuando el usuario quiera ver o abrir un documento. Pasá el storagePath EXACTO devuelto por buscar_documentos o listar_carpetas, sin modificarlo.",
			parameters: z.object({
				storagePath: z.string().describe("storagePath exacto devuelto por buscar_documentos o listar_carpetas"),
			}),
			execute: async ({ storagePath }) => {
				const args = { storagePath };
				// Normalize model quirks: leading slashes or a prepended bucket name.
				let candidate = storagePath.trim().replace(/^\/+/, "");
				if (candidate.startsWith(`${DOCUMENTS_BUCKET}/`)) {
					candidate = candidate.slice(DOCUMENTS_BUCKET.length + 1);
				}
				if (!candidate || candidate.includes("..")) {
					return collect("preview_documento", args, {
						error: "El documento no pertenece a una obra de esta organización.",
					});
				}

				let validated = validateStoragePath(candidate, tenantObras);
				let signed = validated
					? await signDocument(admin, DOCUMENTS_BUCKET, candidate, SIGNED_URL_TTL_SECONDS)
					: { path: candidate, signedUrl: null as string | null, error: "ruta no reconocida" };

				if (!signed.signedUrl) {
					// `__docPath` can drift from the real object after folder moves, and
					// the model sometimes passes only a display file name. Resolve
					// against ocr_document_processing (RLS-scoped to this tenant),
					// matching by normalized file name, and re-validate the result.
					const targetName = normalizeForMatch(candidate.split("/").pop() ?? "");
					const obraFilter = validated ? [validated.obraId] : scope.obraIds.length > 0 ? scope.obraIds : null;
					let query = supabase
						.from("ocr_document_processing")
						.select("source_bucket, source_path, source_file_name, obra_id");
					if (obraFilter) query = query.in("obra_id", obraFilter);
					const { data: candidates } = await query.limit(500);
					for (const match of candidates ?? []) {
						const fileName = typeof match.source_file_name === "string" ? match.source_file_name : "";
						if (!fileName || normalizeForMatch(fileName) !== targetName) continue;
						const matchPath = typeof match.source_path === "string" ? match.source_path : "";
						const matchValidated = validateStoragePath(matchPath, tenantObras);
						if (!matchValidated) continue;
						const bucket =
							typeof match.source_bucket === "string" && match.source_bucket ? match.source_bucket : DOCUMENTS_BUCKET;
						const retry = await signDocument(admin, bucket, matchPath, SIGNED_URL_TTL_SECONDS);
						if (retry.signedUrl) {
							signed = retry;
							validated = matchValidated;
							break;
						}
					}
				}

				if (!validated || !signed.signedUrl) {
					console.warn("[document-ai/chat] preview_documento failed", {
						storagePath,
						candidate,
						error: signed.error,
					});
					return collect("preview_documento", args, {
						error: validated
							? `No se pudo firmar el documento: ${signed.error ?? "desconocido"}`
							: "El documento no pertenece a una obra de esta organización.",
					});
				}

				const { data: deleted } = await supabase
					.from("obra_document_deletes")
					.select("storage_path")
					.eq("tenant_id", tenantId)
					.eq("obra_id", validated.obraId)
					.eq("storage_path", signed.path)
					.is("restored_at", null)
					.maybeSingle();
				if (deleted) {
					return collect("preview_documento", args, { error: "El documento fue eliminado." });
				}

				const nombre = signed.path.split("/").pop() ?? "documento";
				const extension = nombre.toLowerCase().split(".").pop() ?? "";
				return collect("preview_documento", args, {
					nombre,
					storagePath: signed.path,
					obraId: validated.obraId,
					url: signed.signedUrl,
					esImagen: ["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(extension),
					esPdf: extension === "pdf",
					expiraEnSegundos: SIGNED_URL_TTL_SECONDS,
				});
			},
		}),

		generar_reporte: tool({
			description:
				"Genera un reporte formal descargable (pdf, pptx, docx, xlsx, summary, chart o dashboard) usando el pipeline auditable de Document AI. Usala solo cuando el usuario pide un entregable, no para responder preguntas.",
			parameters: z.object({
				pedido: z.string().describe("Descripción completa del reporte pedido, en lenguaje natural"),
				obraId: z.string().optional().describe("Obra sobre la que se genera el reporte"),
				carpeta: z.string().optional().describe("Carpeta puntual, si aplica"),
				formato: z.enum(DOCUMENT_AI_OUTPUT_TYPES).describe("Formato del entregable"),
			}),
			execute: async ({ pedido, obraId, carpeta, formato }) => {
				const args = { pedido, obraId, carpeta, formato };
				const targetObraId = resolveObraId(obraId) ?? scope.obraIds[0] ?? null;
				try {
					const result = await runDocumentAi({
						supabase,
						admin,
						tenantId,
						userId,
						obraId: targetObraId,
						folderPath: carpeta ?? null,
						prompt: pedido,
						outputType: formato as DocumentAiOutputType,
						pdfRenderer:
							formato === "pdf"
								? async (html) => {
									const pdfResponse = await fetch(new URL("/api/pdf-render", baseUrl), {
										method: "POST",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({
											html,
											options: {
												companyName: "Sintesis",
												reportTitle: "Document AI",
												date: new Date().toLocaleDateString("es-AR"),
												format: "A4",
												landscape: false,
											},
										}),
									});
									if (!pdfResponse.ok) {
										const payload = await pdfResponse.json().catch(() => ({}));
										throw new Error(
											typeof payload.error === "string" ? payload.error : "No se pudo renderizar PDF.",
										);
									}
									return new Uint8Array(await pdfResponse.arrayBuffer());
								}
								: undefined,
					});
					return collect("generar_reporte", args, {
						runId: result.runId,
						titulo: result.composition.title,
						resumen: result.composition.executiveSummary,
						formato,
						advertencias: result.composition.warnings,
						downloadUrl: `/api/document-ai/runs/${result.runId}/download`,
					});
				} catch (error) {
					return collect("generar_reporte", args, {
						error: error instanceof Error ? error.message : "No se pudo generar el reporte.",
					});
				}
			},
		}),
	};
}
