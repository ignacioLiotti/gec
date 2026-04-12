import type { ExcelLoadMode } from "@/lib/excel/load-mode";
import type { MainTableSelectOption } from "@/lib/main-table-select";

export type ExcelMainTableColumnKind = "base" | "formula" | "custom";
export type ExcelMainTableFormulaFormat = "currency" | "number";
export type ExcelMainTableColumnCellType =
	| "text"
	| "number"
	| "currency"
	| "date"
	| "boolean"
	| "checkbox"
	| "toggle"
	| "tags"
	| "link"
	| "avatar"
	| "image"
	| "icon"
	| "text-icon"
	| "badge"
	| "select";

export type ExcelPageMainTableColumnConfig = {
	id: string;
	kind: ExcelMainTableColumnKind;
	label: string;
	enabled: boolean;
	width?: number;
	baseColumnId?: string;
	formula?: string;
	formulaFormat?: ExcelMainTableFormulaFormat;
	cellType?: ExcelMainTableColumnCellType;
	selectOptions?: MainTableSelectOption[];
	required?: boolean;
	editable?: boolean;
	enableHide?: boolean;
	enablePin?: boolean;
	enableSort?: boolean;
	enableResize?: boolean;
};

export type ExcelPageObra = {
	id: string;
	n?: number | null;
	designacionYUbicacion?: string | null;
	__isPartial?: boolean | null;
	supDeObraM2?: number | null;
	entidadContratante?: string | null;
	mesBasicoDeContrato?: string | null;
	iniciacion?: string | null;
	contratoMasAmpliaciones?: number | null;
	certificadoALaFecha?: number | null;
	saldoACertificar?: number | null;
	segunContrato?: number | null;
	prorrogasAcordadas?: number | null;
	plazoTotal?: number | null;
	plazoTransc?: number | null;
	porcentaje?: number | null;
	updatedAt?: string | null;
	customData?: Record<string, unknown> | null;
	onFinishFirstMessage?: string | null;
	onFinishSecondMessage?: string | null;
	onFinishSecondSendAt?: string | null;
};

export type ExcelPageClientProps = {
	initialMainTableColumnsConfig: ExcelPageMainTableColumnConfig[] | null;
	initialObras: ExcelPageObra[];
	initialLoadMode: ExcelLoadMode;
};
