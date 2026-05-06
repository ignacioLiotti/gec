"use client";

import type { TablaColumnDataType } from "@/lib/tablas";
import type { FormTableRow } from "@/components/form-table/types";

export type DataInputMethod = 'ocr' | 'manual' | 'both';

export type FileSystemItem = {
	id: string;
	name: string;
	type: "folder" | "file";
	icon?: string;
	children?: FileSystemItem[];
	ocrEnabled?: boolean;
	dataInputMethod?: DataInputMethod;
	ocrTablaId?: string;
	ocrTablaName?: string;
	ocrFolderName?: string;
	ocrTablaColumns?: OcrTablaColumn[];
	ocrTablaRows?: TablaDataRow[];
	extractedData?: Record<string, unknown>[];
	size?: number;
	mimetype?: string;
	dataId?: string;
	storagePath?: string;
	relativePath?: string;
	apsUrn?: string;
	ocrDocumentStatus?: "pending" | "processing" | "completed" | "failed" | "unprocessed";
	ocrDocumentId?: string;
	ocrDocumentError?: string | null;
	ocrErrorCode?: string | null;
	ocrRowsExtracted?: number | null;
	ocrExtractionId?: string | null;
	ocrFileFingerprint?: string | null;
	ocrContentFingerprintNormalized?: string | null;
	ocrFingerprintStatus?: "pending" | "completed" | "degraded" | "failed" | null;
	ocrFingerprintError?: Record<string, unknown> | null;
	uploadedAt?: string | null;
	uploadedByUserId?: string | null;
	uploadedByLabel?: string | null;
	generatedDocumentStatus?: string | null;
};

export type FileManagerSelectionChange = {
	folder: FileSystemItem | null;
	folderPath: string[];
	document: FileSystemItem | null;
	documentPath: string[];
};

export type SelectionChangeOptions = {
	emitSelection?: boolean;
	preserveFilter?: boolean;
	enforceFilter?: boolean;
};

export type MaterialOrder = {
	id: string;
	nroOrden: string;
	fecha: string;
	solicitante: string;
	proveedor: string;
	items: MaterialItem[];
	docUrl?: string;
	docBucket?: string;
	docPath?: string;
	apsUrn?: string;
};

export type MaterialItem = {
	id: string;
	cantidad: number;
	unidad: string;
	material: string;
	precioUnitario: number;
};

export type OcrDocumentStatus = {
	id: string;
	source_bucket: string;
	source_path: string;
	source_file_name: string;
	status: "pending" | "processing" | "completed" | "failed";
	error_message: string | null;
	error_code?: string | null;
	rows_extracted: number | null;
	extraction_id?: string | null;
	file_fingerprint?: string | null;
	content_fingerprint_normalized?: string | null;
	fingerprint_status?: "pending" | "completed" | "degraded" | "failed" | null;
	fingerprint_error?: Record<string, unknown> | null;
};

export type OcrFolderLink = {
	tablaId: string;
	tablaName: string;
	folderName: string;
	columns: OcrTablaColumn[];
	rows: TablaDataRow[];
	orders: MaterialOrder[];
	documents: OcrDocumentStatus[];
	dataInputMethod?: DataInputMethod;
};

export type OcrTablaColumn = {
	id: string;
	fieldKey: string;
	label: string;
	dataType: TablaColumnDataType;
	required: boolean;
	config?: Record<string, unknown>;
};

export type TablaDataRow = {
	id: string;
	data: Record<string, unknown>;
	source?: string;
	lineage_row_key?: string | null;
	extraction_id?: string | null;
	materialization_version?: number | null;
};

export type OcrDocumentTableRow = FormTableRow & Record<string, unknown>;

export type LineageSupportStatus =
	| "implemented"
	| "partial"
	| "planned"
	| "not_supported";

export type LineageGraphNode = {
	id: string;
	type:
		| "document"
		| "extraction"
		| "table"
		| "row"
		| "macro_table"
		| "override"
		| "event";
	label: string;
	status: string;
	supportStatus: LineageSupportStatus;
	data: Record<string, unknown>;
};

export type LineageGraphEdge = {
	id: string;
	source: string;
	target: string;
	type: string;
	label?: string;
};

export type LineageCoverageItem = {
	id: string;
	label: string;
	status: LineageSupportStatus;
	detail: string;
};

export type LineageGraphPayload = {
	selection: {
		obraId: string;
		tablaId: string | null;
		docPath: string | null;
		scope: "document" | "table" | "obra";
	};
	summary: {
		documents: number;
		extractions: number;
		tables: number;
		rows: number;
		macroTables: number;
		overrides: number;
		events: number;
	};
	coverage: {
		pipeline: LineageCoverageItem;
		backing: LineageCoverageItem;
		items: LineageCoverageItem[];
	};
	nodes: LineageGraphNode[];
	edges: LineageGraphEdge[];
};

export type DeletedDocumentEntry = {
	id: string;
	itemType: "file" | "folder";
	status: "deleted" | "restored" | "expired" | "purged";
	storagePath: string;
	fileName: string;
	fileSizeBytes: number | null;
	fileCount: number;
	totalBytes: number;
	deletedAt: string | null;
	deletedByUserId?: string | null;
	deletedByLabel?: string | null;
	recoverUntil: string | null;
	recoverable: boolean;
	restoredAt?: string | null;
	restoredByUserId?: string | null;
	restoredByLabel?: string | null;
	purgedAt?: string | null;
	purgedByUserId?: string | null;
	purgedByLabel?: string | null;
	purgeReason?: string | null;
	purgeJobId?: string | null;
	nestedFolderCount?: number;
	treeEntries?: Array<{
		path: string;
		name: string;
		itemType: "file" | "folder";
		depth: number;
		fileSizeBytes?: number | null;
	}>;
};
