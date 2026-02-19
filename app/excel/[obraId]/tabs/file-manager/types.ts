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
	extractedData?: any[];
	size?: number;
	mimetype?: string;
	dataId?: string;
	storagePath?: string;
	relativePath?: string;
	apsUrn?: string;
	ocrDocumentStatus?: "pending" | "processing" | "completed" | "failed" | "unprocessed";
	ocrDocumentId?: string;
	ocrDocumentError?: string | null;
	ocrRowsExtracted?: number | null;
	uploadedAt?: string | null;
	uploadedByUserId?: string | null;
	uploadedByLabel?: string | null;
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
	solicitante: string;
	gestor: string;
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
	rows_extracted: number | null;
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
};

export type OcrDocumentTableRow = FormTableRow & Record<string, unknown>;
