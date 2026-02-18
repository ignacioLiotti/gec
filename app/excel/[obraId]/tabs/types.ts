export type Certificate = {
	id: string;
	obra_id: string;
	n_exp: string;
	n_certificado: number;
	monto: number;
	mes: string;
	estado: string;
};

export type NewCertificateFormState = {
	n_exp: string;
	n_certificado: string;
	monto: string;
	mes: string;
	estado: string;
};

export type ObraRole = { id: string; key: string; name: string | null };
export type ObraUser = {
	id: string;
	full_name: string | null;
	email: string | null;
};
export type ObraUserRole = { user_id: string; role_id: string };

export type FlujoAction = {
	id: string;
	action_type: "email" | "calendar_event";
	timing_mode: "immediate" | "offset" | "scheduled";
	offset_value: number | null;
	offset_unit: "minutes" | "hours" | "days" | "weeks" | "months" | null;
	scheduled_date: string | null;
	title: string;
	message: string | null;
	recipient_user_ids: string[];
	notification_types: ("in_app" | "email")[];
	enabled: boolean;
	executed_at: string | null;
	/** When the action is scheduled to execute (set when obra reaches 100%) */
	scheduled_for: string | null;
	/** When the obra reached 100% and triggered this action */
	triggered_at: string | null;
};

export type MaterialItem = {
	id: string;
	cantidad: number;
	unidad: string;
	material: string;
	precioUnitario: number;
	// Pre-normalized fields for efficient filtering (avoids normalize() on every keystroke)
	_materialNorm?: string;
	_unidadNorm?: string;
};

export type MaterialOrder = {
	id: string;
	nroOrden: string;
	solicitante: string;
	gestor: string;
	proveedor: string;
	items: MaterialItem[];
	docUrl?: string;
	docPath?: string;
	docBucket?: string;
	// Pre-normalized fields for efficient filtering
	_nroOrdenNorm?: string;
	_solicitanteNorm?: string;
	_gestorNorm?: string;
	_proveedorNorm?: string;
};

export type TablaColumnDataType =
	| "text"
	| "number"
	| "currency"
	| "boolean"
	| "date";

export type ObraTablaColumn = {
	id: string;
	tablaId: string;
	fieldKey: string;
	label: string;
	dataType: TablaColumnDataType;
	required: boolean;
	position: number;
	config?: Record<string, unknown>;
};

export type ObraTabla = {
	id: string;
	obraId: string;
	name: string;
	description: string | null;
	sourceType: "manual" | "csv" | "ocr";
	settings: Record<string, unknown>;
	rowCount: number;
	columns: ObraTablaColumn[];
};
