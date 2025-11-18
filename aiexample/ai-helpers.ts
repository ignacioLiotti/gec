// import { generateObject } from "ai";
// import { openai } from "@ai-sdk/openai";
// // import { mistral } from '@ai-sdk/mistral';
// import { z } from "zod";
// // import {
// // 	ocrExtractionSchema,
// // 	documentAnalysisSchema,
// // 	ocrWithAnalysisSchema,
// // 	createFieldExtractionSchema,
// // 	batchExtractionResultSchema,
// // 	tabularExtractionSchema,
// // 	createTabularExtractionSchema,
// // 	generateFallbackResult,
// // 	validateTags,
// // 	type FieldDefinition,
// // 	type ProcessingResult,
// // 	type OCRExtraction,
// // 	type DocumentAnalysis,
// // 	type OCRWithAnalysis,
// // 	type TabularFieldDefinition,
// // 	type TabularExtractionResult,
// // } from "../schemas/ai-schemas";
// // import { retryWithBackoff } from "./upload-utils";

// // Configuration for AI models
// const AI_CONFIG = {
// 	openai: {
// 		model: "gpt-4o-mini",
// 		temperature: 0.1,
// 		maxRetries: 2,
// 	},
// 	mistral: {
// 		model: "mistral-small-latest",
// 		temperature: 0.1,
// 		maxRetries: 2,
// 	},
// 	timeout: 60000, // 60 seconds to reduce timeouts on heavier tabular jobs
// };

// // Helper to add timeout to AI calls
// async function withTimeout<T>(
// 	promise: Promise<T>,
// 	timeoutMs: number,
// 	operation: string
// ): Promise<T> {
// 	const timeoutPromise = new Promise<never>((_, reject) => {
// 		setTimeout(
// 			() => reject(new Error(`${operation} timeout after ${timeoutMs}ms`)),
// 			timeoutMs
// 		);
// 	});
// 	return Promise.race([promise, timeoutPromise]);
// }

// // Safe error message extractor
// function getErrorMessage(error: unknown): string {
// 	if (error instanceof Error) return error.message;
// 	if (typeof error === "string") return error;
// 	try {
// 		return JSON.stringify(error);
// 	} catch {
// 		return "Unknown error";
// 	}
// }

// // Helper to convert image URL to base64 data URL for OpenAI
// async function convertImageUrlToBase64(
// 	imageUrl: string,
// 	fileType?: string
// ): Promise<string> {
// 	try {
// 		// Check if it's a PDF before attempting conversion
// 		if (
// 			fileType === "application/pdf" ||
// 			imageUrl.toLowerCase().includes(".pdf")
// 		) {
// 			throw new Error(
// 				"PDF files cannot be converted to base64 images. Use text extraction instead."
// 			);
// 		}

// 		console.log("[AI] Converting image URL to base64:", { imageUrl, fileType });

// 		const response = await fetch(imageUrl);
// 		if (!response.ok) {
// 			throw new Error(
// 				`Failed to fetch image: ${response.status} ${response.statusText}`
// 			);
// 		}

// 		const arrayBuffer = await response.arrayBuffer();
// 		const buffer = Buffer.from(arrayBuffer);
// 		const base64 = buffer.toString("base64");

// 		// Determine MIME type
// 		let mimeType = fileType || "image/png";

// 		// Check if it's a PDF
// 		if (
// 			fileType === "application/pdf" ||
// 			imageUrl.toLowerCase().includes(".pdf")
// 		) {
// 			throw new Error(
// 				"PDF files are not supported for direct image processing. PDF extraction requires text-based processing."
// 			);
// 		}

// 		if (fileType === "application/octet-stream" || !fileType) {
// 			// Try to determine from URL extension
// 			const urlLower = imageUrl.toLowerCase();
// 			if (urlLower.includes(".jpg") || urlLower.includes(".jpeg")) {
// 				mimeType = "image/jpeg";
// 			} else if (urlLower.includes(".png")) {
// 				mimeType = "image/png";
// 			} else if (urlLower.includes(".gif")) {
// 				mimeType = "image/gif";
// 			} else if (urlLower.includes(".webp")) {
// 				mimeType = "image/webp";
// 			} else {
// 				mimeType = "image/png"; // Default fallback
// 			}
// 		}

// 		const dataUrl = `data:${mimeType};base64,${base64}`;
// 		console.log(
// 			"[AI] Successfully converted image to base64, size:",
// 			Math.round(base64.length / 1024),
// 			"KB"
// 		);

// 		return dataUrl;
// 	} catch (error) {
// 		console.error("[AI] Failed to convert image URL to base64:", error);
// 		throw new Error(
// 			`Image conversion failed: ${error instanceof Error ? error.message : "Unknown error"}`
// 		);
// 	}
// }

// /**
//  * Extract text from an image using OpenAI Vision with structured output
//  */
// export async function extractTextWithAI(
// 	imageUrl: string,
// 	fileName: string
// ): Promise<OCRExtraction> {
// 	try {
// 		// Convert image URL to base64 for OpenAI (OpenAI can't access local URLs)
// 		const imageDataUrl = await convertImageUrlToBase64(imageUrl, "image/png");

// 		const { object } = await withTimeout(
// 			generateObject({
// 				model: openai(AI_CONFIG.openai.model),
// 				schema: ocrExtractionSchema,
// 				messages: [
// 					{
// 						role: "user",
// 						content: [
// 							{
// 								type: "text",
// 								text: `Extract ALL text from this image.
//               - Preserve the original structure and formatting
//               - Include all readable text, numbers, dates, and details
//               - Detect if there's handwriting
//               - Identify the primary language
//               - Provide a confidence score for the extraction quality`,
// 							},
// 							{
// 								type: "image",
// 								image: imageDataUrl,
// 							},
// 						],
// 					},
// 				],
// 				temperature: AI_CONFIG.openai.temperature,
// 			}),
// 			AI_CONFIG.timeout,
// 			"OCR extraction"
// 		);

// 		return object;
// 	} catch (error) {
// 		console.error("[AI] OCR extraction failed:", error);
// 		// Return a default result on error
// 		return {
// 			extractedText: "",
// 			confidence: 0,
// 			hasHandwriting: false,
// 			language: "es",
// 			pageCount: 1,
// 		};
// 	}
// }

// /**
//  * Analyze document content and generate metadata with structured output
//  */
// export async function analyzeDocument(
// 	documentContent: string,
// 	fileName: string,
// 	fileType: string
// ): Promise<DocumentAnalysis> {
// 	try {
// 		const { object } = await withTimeout(
// 			generateObject({
// 				model: openai(AI_CONFIG.openai.model),
// 				schema: documentAnalysisSchema,
// 				messages: [
// 					{
// 						role: "user",
// 						content: `Analyze this construction document named "${fileName}" of type "${fileType}".

// Based on the content below:
// 1. Provide the raw OCR text as extracted
// 2. Generate a search-optimized description (what keywords would someone use to find this?)
// 3. Classify into the most appropriate category
// 4. Generate 3-10 relevant tags in Spanish (lowercase, specific terms)
// 5. Optionally provide a brief summary and document type
// 6. Extract any dates found in YYYY-MM-DD format

// Content:
// ${documentContent.substring(0, 4000)}${documentContent.length > 4000 ? "..." : ""}`,
// 					},
// 				],
// 				temperature: 0.3,
// 			}),
// 			AI_CONFIG.timeout,
// 			"Document analysis"
// 		);

// 		// Validate and clean tags
// 		object.tags = validateTags(object.tags);

// 		return object;
// 	} catch (error) {
// 		console.error("[AI] Document analysis failed:", error);
// 		throw error;
// 	}
// }

// /**
//  * Combined OCR and analysis in a single pass (more efficient for images)
//  */
// export async function extractAndAnalyzeDocument(
// 	imageUrl: string,
// 	fileName: string,
// 	fileType: string
// ): Promise<ProcessingResult> {
// 	try {
// 		// Convert image URL to base64 for OpenAI (OpenAI can't access local URLs)
// 		const imageDataUrl = await convertImageUrlToBase64(imageUrl, fileType);

// 		const { object } = await withTimeout(
// 			generateObject({
// 				model: openai(AI_CONFIG.openai.model),
// 				schema: ocrWithAnalysisSchema,
// 				messages: [
// 					{
// 						role: "user",
// 						content: [
// 							{
// 								type: "text",
// 								text: `Extract text and analyze this construction document "${fileName}".

// 1. Extract ALL text content exactly as it appears
// 2. Generate a search-optimized description (focus on keywords)
// 3. Classify into the appropriate category
// 4. Generate 3-10 relevant tags in Spanish (lowercase)
// 5. Assess confidence and check for structured data like tables`,
// 							},
// 							{
// 								type: "image",
// 								image: imageDataUrl,
// 							},
// 						],
// 					},
// 				],
// 				temperature: AI_CONFIG.openai.temperature,
// 			}),
// 			AI_CONFIG.timeout,
// 			"OCR with analysis"
// 		);

// 		// Convert to ProcessingResult format
// 		return {
// 			ocrText: object.ocrText,
// 			description: object.description,
// 			tags: validateTags(object.tags),
// 			confidence: object.confidence,
// 			provider: "openai-gpt4-vision",
// 			summary: (object as any).summary,
// 		};
// 	} catch (error) {
// 		console.error("[AI] Combined extraction failed:", error);
// 		return generateFallbackResult(fileName, getErrorMessage(error));
// 	}
// }

// /**
//  * Extract structured fields from text based on field definitions
//  */
// export async function extractStructuredFields(
// 	ocrText: string,
// 	fieldDefinitions: FieldDefinition[],
// 	documentName?: string
// ): Promise<Record<string, any>> {
// 	if (!fieldDefinitions.length || !ocrText) {
// 		return {};
// 	}

// 	try {
// 		const schema = createFieldExtractionSchema(fieldDefinitions);

// 		// Build field descriptions for the prompt
// 		const fieldDescriptions = fieldDefinitions
// 			.map((field) => {
// 				const required = field.is_required ? "(required)" : "(optional)";
// 				const pattern = field.extraction_pattern
// 					? ` - Pattern: ${field.extraction_pattern}`
// 					: "";
// 				return `- ${field.field_label} (${field.field_name}): ${field.field_type} ${required}${pattern}`;
// 			})
// 			.join("\n");

// 		const { object } = await withTimeout(
// 			generateObject({
// 				model: openai(AI_CONFIG.openai.model),
// 				schema,
// 				messages: [
// 					{
// 						role: "user",
// 						content: `Extract the following fields from this document${documentName ? ` "${documentName}"` : ""}.

// Fields to extract:
// ${fieldDescriptions}

// Important:
// - For dates, use YYYY-MM-DD format
// - For numbers, extract numeric values only (no currency symbols)
// - For currency, convert to numeric format
// - For missing optional fields, use null
// - Be precise and extract exact values

// Document text:
// ${ocrText.substring(0, 4000)}${ocrText.length > 4000 ? "..." : ""}`,
// 					},
// 				],
// 				temperature: AI_CONFIG.openai.temperature,
// 			}),
// 			AI_CONFIG.timeout,
// 			"Field extraction"
// 		);

// 		return object;
// 	} catch (error) {
// 		console.error("[AI] Field extraction failed:", error);
// 		// Return empty object on error
// 		return {};
// 	}
// }

// /**
//  * Extract fields with additional metadata (confidence scores, validation)
//  */
// export async function extractFieldsWithMetadata(
// 	ocrText: string,
// 	fieldDefinitions: FieldDefinition[],
// 	documentName?: string
// ): Promise<z.infer<typeof batchExtractionResultSchema>> {
// 	try {
// 		const fieldNames = fieldDefinitions.map((f) => f.field_name).join(", ");

// 		const { object } = await withTimeout(
// 			generateObject({
// 				model: openai(AI_CONFIG.openai.model),
// 				schema: batchExtractionResultSchema,
// 				messages: [
// 					{
// 						role: "user",
// 						content: `Extract fields from this document with confidence scores.

// Fields needed: ${fieldNames}

// ${fieldDefinitions
// 	.map(
// 		(f) =>
// 			`- ${f.field_name}: ${f.field_label} (${f.field_type}, ${f.is_required ? "required" : "optional"})`
// 	)
// 	.join("\n")}

// For each field provide:
// 1. The extracted value in extracted_fields
// 2. Confidence score (0-1) in confidence_scores
// 3. Validation status in validation_status

// Document: ${documentName || "Unknown"}
// Text: ${ocrText.substring(0, 4000)}`,
// 					},
// 				],
// 				temperature: AI_CONFIG.openai.temperature,
// 			}),
// 			AI_CONFIG.timeout,
// 			"Field extraction with metadata"
// 		);

// 		return object;
// 	} catch (error) {
// 		console.error("[AI] Field extraction with metadata failed:", error);
// 		return {
// 			extracted_fields: {},
// 			confidence_scores: {},
// 			validation_status: {},
// 			warnings: ["Extraction failed: " + getErrorMessage(error)],
// 		};
// 	}
// }

// /**
//  * Process document with Mistral (for non-image documents or as fallback)
//  */
// export async function analyzeWithMistral(
// 	documentText: string,
// 	fileName: string
// ): Promise<ProcessingResult> {
// 	try {
// 		const { object } = await withTimeout(
// 			generateObject({
// 				model: mistral(AI_CONFIG.mistral.model),
// 				schema: documentAnalysisSchema,
// 				messages: [
// 					{
// 						role: "user",
// 						content: `Analyze this document "${fileName}":

// 1. Provide a search-optimized description
// 2. Suggest an appropriate category
// 3. Generate relevant tags in Spanish
// 4. Include the original text as ocrText

// Text: ${documentText.substring(0, 3000)}...`,
// 					},
// 				],
// 				temperature: AI_CONFIG.mistral.temperature,
// 			}),
// 			AI_CONFIG.timeout,
// 			"Mistral analysis"
// 		);

// 		return {
// 			ocrText: object.ocrText,
// 			description: object.description,
// 			tags: validateTags(object.tags),
// 			confidence: 0.85,
// 			provider: "mistral-small",
// 		};
// 	} catch (error) {
// 		console.error("[AI] Mistral analysis failed:", error);
// 		return generateFallbackResult(fileName, getErrorMessage(error));
// 	}
// }

// /**
//  * Smart retry wrapper for AI operations
//  */
// export async function retryAIOperation<T>(
// 	operation: () => Promise<T>,
// 	operationName: string,
// 	maxAttempts = 3
// ): Promise<T> {
// 	return retryWithBackoff(operation, {
// 		maxAttempts,
// 		initialDelay: 1000,
// 		maxDelay: 5000,
// 		backoffMultiplier: 2,
// 	});
// }

// /**
//  * Helper to process documents with automatic provider fallback
//  */
// export async function processDocumentWithAI(
// 	documentUrl: string,
// 	fileName: string,
// 	fileType: string,
// 	preferredProvider: "openai" | "mistral" = "openai"
// ): Promise<ProcessingResult> {
// 	// For images, use OpenAI Vision
// 	if (
// 		fileType.includes("image") ||
// 		fileType.includes("png") ||
// 		fileType.includes("jpg")
// 	) {
// 		try {
// 			return await retryAIOperation(
// 				() => extractAndAnalyzeDocument(documentUrl, fileName, fileType),
// 				"OpenAI Vision processing"
// 			);
// 		} catch (error) {
// 			console.error(
// 				"[AI] OpenAI Vision failed, trying text extraction:",
// 				error
// 			);
// 		}
// 	}

// 	// For text-based documents or as fallback
// 	try {
// 		// First try to get text content (this would need to be implemented based on your document type)
// 		const documentText = await fetchDocumentText(documentUrl);

// 		if (preferredProvider === "mistral") {
// 			return await retryAIOperation(
// 				() => analyzeWithMistral(documentText, fileName),
// 				"Mistral processing"
// 			);
// 		} else {
// 			const analysis = await retryAIOperation(
// 				() => analyzeDocument(documentText, fileName, fileType),
// 				"OpenAI analysis"
// 			);

// 			return {
// 				ocrText: analysis.ocrText,
// 				description: analysis.description,
// 				tags: analysis.tags,
// 				confidence: 0.9,
// 				provider: "openai-gpt4",
// 				summary: analysis.summary,
// 			};
// 		}
// 	} catch (error) {
// 		console.error("[AI] All providers failed:", error);
// 		return generateFallbackResult(fileName, "All AI providers unavailable");
// 	}
// }

// /**
//  * Fetch document text content - simplified implementation
//  */
// async function fetchDocumentText(documentUrl: string): Promise<string> {
// 	try {
// 		const response = await fetch(documentUrl);
// 		if (!response.ok) {
// 			throw new Error(`Failed to fetch document: ${response.statusText}`);
// 		}

// 		// For now, just return empty string - this would need proper PDF/doc parsing
// 		// In production, you'd use libraries like pdf-parse, mammoth.js, etc.
// 		return "";
// 	} catch (error) {
// 		console.error("Document text extraction failed:", error);
// 		throw new Error("Document text extraction not implemented for this type");
// 	}
// }

// /**
//  * Extract tabular data from an image using OpenAI Vision
//  * Used for documents with multiple rows like bank statements, invoices, etc.
//  */
// export async function extractTabularData(
// 	imageUrl: string,
// 	fileName: string,
// 	fieldDefinitions: TabularFieldDefinition[]
// ): Promise<TabularExtractionResult> {
// 	try {
// 		console.log("[AI] Starting tabular extraction for:", fileName);

// 		// Convert image URL to base64 for OpenAI
// 		const imageDataUrl = await convertImageUrlToBase64(imageUrl, "image/png");

// 		// Create dynamic schema based on field definitions
// 		const dynamicSchema = createTabularExtractionSchema(fieldDefinitions);

// 		// Build field descriptions for AI
// 		const fieldDescriptions = fieldDefinitions
// 			.map(
// 				(field) =>
// 					`- ${field.field_name} (${field.field_type}): ${field.field_label}${field.extraction_pattern ? ` - Pattern: ${field.extraction_pattern}` : ""}`
// 			)
// 			.join("\n");

// 		const { object } = await withTimeout(
// 			generateObject({
// 				model: openai(AI_CONFIG.openai.model),
// 				schema: dynamicSchema,
// 				messages: [
// 					{
// 						role: "user",
// 						content: [
// 							{
// 								type: "text",
// 								text: `Extract tabular data from this document "${fileName}".

// This document contains multiple rows of data. Please extract each row and structure the data according to these field definitions:

// ${fieldDescriptions}

// Instructions:
// 1. Extract ALL visible rows of data
// 2. Each row should be a separate object in the tableData array
// 3. Use consistent field names as defined above
// 4. Convert values to appropriate types (numbers for currency/numeric fields, dates in YYYY-MM-DD format)
// 5. If a field is empty or unclear, use null
// 6. Assess data quality based on clarity and completeness
// 7. Include all readable text in extractedText
// 8. Add a rowText property per row with the full raw text of that row

// Return structured data with high confidence only if the data is clearly readable.`,
// 							},
// 							{
// 								type: "image",
// 								image: imageDataUrl,
// 							},
// 						],
// 					},
// 				],
// 				temperature: AI_CONFIG.openai.temperature,
// 			}),
// 			AI_CONFIG.timeout,
// 			"OpenAI tabular extraction"
// 		);

// 		console.log("[AI] Tabular extraction successful:", {
// 			rowCount: object.tableData.length,
// 			confidence: object.confidence,
// 			fileName,
// 		});

// 		return object;
// 	} catch (error) {
// 		console.error("[AI] Tabular extraction failed:", error);
// 		throw new Error(
// 			`Tabular extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`
// 		);
// 	}
// }

// /**
//  * Extract and analyze tabular document in one call
//  * Combines OCR + analysis + tabular extraction
//  */
// export async function extractAndAnalyzeTabularDocument(
// 	imageUrl: string,
// 	fileName: string,
// 	fileType: string,
// 	fieldDefinitions: TabularFieldDefinition[]
// ): Promise<ProcessingResult> {
// 	try {
// 		console.log(
// 			"[AI] Starting combined tabular extraction and analysis for:",
// 			fileName
// 		);

// 		// First, perform tabular extraction
// 		const tabularResult = await extractTabularData(
// 			imageUrl,
// 			fileName,
// 			fieldDefinitions
// 		);

// 		// Then, analyze the document for categorization
// 		const analysisResult = await extractAndAnalyzeDocument(
// 			imageUrl,
// 			fileName,
// 			fileType
// 		);

// 		// Combine results
// 		return {
// 			ocrText: tabularResult.extractedText,
// 			description:
// 				analysisResult.description || `Tabular document: ${fileName}`,
// 			tags: analysisResult.tags || ["documento", "tabular"],
// 			extractedData: {
// 				tabularData: tabularResult.tableData,
// 				tableMetadata: tabularResult.tableMetadata,
// 			},
// 			confidence: Math.min(
// 				tabularResult.confidence,
// 				analysisResult.confidence || 0.8
// 			),
// 			provider: "openai-tabular",
// 			summary: (analysisResult as any).summary,
// 		};
// 	} catch (error) {
// 		console.error("[AI] Combined tabular processing failed:", error);
// 		return generateFallbackResult(fileName, getErrorMessage(error));
// 	}
// }

// /**
//  * Process tabular document with Mistral fallback
//  * For when OpenAI fails or for cost optimization
//  */
// export async function processTabularDocumentWithMistral(
// 	ocrText: string,
// 	fileName: string,
// 	fieldDefinitions: TabularFieldDefinition[]
// ): Promise<ProcessingResult> {
// 	try {
// 		console.log("[AI] Processing tabular data with Mistral for:", fileName);

// 		// Clean the OCR text to prevent JSON parsing issues
// 		// Remove excessive pipe characters, quotes, and other problematic characters
// 		const cleanedText = ocrText
// 			.replace(/\|[\s\|]+\|/g, "|") // Replace multiple pipes with single pipe
// 			.replace(/\|+/g, "|") // Replace consecutive pipes
// 			.replace(/["\\"]/g, "'") // Replace double quotes with single quotes
// 			.replace(/\r\n/g, "\n") // Normalize line endings
// 			.replace(/\s+/g, " ") // Normalize whitespace
// 			.replace(/\n+/g, "\n") // Remove excessive line breaks
// 			.trim()
// 			.substring(0, 3000); // Limit length to prevent token overflow

// 		// Build field descriptions
// 		const fieldDescriptions = fieldDefinitions
// 			.map(
// 				(field) =>
// 					`- ${field.field_name}: ${field.field_label} (${field.field_type})`
// 			)
// 			.join("\n");

// 		// Use generic tabular schema since Mistral doesn't support dynamic schemas as well
// 		let extractionResult;
// 		try {
// 			const runOnce = async () => {
// 				const { object } = await withTimeout(
// 					generateObject({
// 						model: mistral(AI_CONFIG.mistral.model),
// 						schema: tabularExtractionSchema,
// 						messages: [
// 							{
// 								role: "user",
// 								content: `You are analyzing a document with tabular data. Extract all rows of data from the text.

// Document: "${fileName}"

// Fields to extract for each row:
// ${fieldDescriptions}

// Instructions:
// 1. Identify the table structure in the text
// 2. Extract each row as a separate object
// 3. Map values to the correct fields based on position
// 4. For dates, use YYYY-MM-DD format
// 5. For currency, extract numeric values only
// 6. Skip header rows and empty rows

// Text to analyze:
// ${cleanedText}

// Return the data in the required JSON structure with tableData array containing all rows.`,
// 							},
// 						],
// 						temperature: AI_CONFIG.mistral.temperature,
// 					}),
// 					AI_CONFIG.timeout,
// 					"Mistral tabular extraction"
// 				);
// 				return object;
// 			};

// 			const object = await retryAIOperation(
// 				runOnce,
// 				"Mistral tabular extraction",
// 				3
// 			);
// 			extractionResult = object;
// 		} catch (extractError) {
// 			console.error(
// 				"[AI] Mistral structured extraction failed, using fallback:",
// 				extractError
// 			);

// 			// Fallback: Return a simpler result
// 			extractionResult = {
// 				extractedText: ocrText.substring(0, 1000),
// 				confidence: 0.5,
// 				tableData: [],
// 				tableMetadata: {
// 					rowCount: 0,
// 					columnCount: fieldDefinitions.length,
// 					hasHeaders: false,
// 					dataQuality: "poor" as const,
// 				},
// 			};
// 		}

// 		return {
// 			ocrText: extractionResult.extractedText || ocrText,
// 			description: `Tabular document: ${fileName}`,
// 			tags: ["documento", "tabular", "datos-multiples"],
// 			extractedData: {
// 				tabularData: extractionResult.tableData || [],
// 				tableMetadata: extractionResult.tableMetadata || {
// 					rowCount: 0,
// 					columnCount: fieldDefinitions.length,
// 					hasHeaders: false,
// 					dataQuality: "poor",
// 				},
// 			},
// 			confidence: extractionResult.confidence || 0.5,
// 			provider: "mistral-tabular",
// 		};
// 	} catch (error) {
// 		console.error("[AI] Mistral tabular processing failed:", error);
// 		return generateFallbackResult(fileName, getErrorMessage(error));
// 	}
// }
