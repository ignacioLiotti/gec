import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";

export type InsurancePolicyRuleType = "on_finish" | "days_after" | "months_after";

export type InsurancePolicyImportRow = {
	rowNumber: number;
	obraId: string | null;
	obraLabel: string;
	obraMatchStatus: "matched" | "unmatched";
	policyNumber: string;
	section: string;
	coveragePeriod: string;
	endDate: string | null;
	insuredAmount: number | null;
	currency: string | null;
	premium: number | null;
	prize: number | null;
	balance: number | null;
	status: string;
	risk: string;
	insuredObject: string;
	notes: string;
	cancellationRuleType: InsurancePolicyRuleType;
	cancellationRuleOffset: number;
	cancellationRuleConfigured: boolean;
	isCancelled: boolean;
	errors: string[];
};

export type ObraLookupRow = {
	id: string;
	n: number | string | null;
	designacion_y_ubicacion: string | null;
};

const RULE_TYPES = new Set<InsurancePolicyRuleType>([
	"on_finish",
	"days_after",
	"months_after",
]);

const OBRA_MATCH_STOPWORDS = new Set([
	"obra",
	"obras",
	"provincia",
	"corrientes",
	"licitacion",
	"publica",
	"privada",
	"contratacion",
	"directa",
	"expte",
	"expediente",
	"resolucion",
	"ubicacion",
	"localidad",
]);

function normalizeText(value: unknown) {
	return String(value ?? "")
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.trim()
		.toLowerCase();
}

function normalizeHeader(value: unknown) {
	return normalizeText(value).replace(/[^a-z0-9]+/g, "");
}

function getCell(row: Record<string, unknown>, candidates: string[]) {
	const candidateSet = new Set(candidates.map(normalizeHeader));
	for (const [key, value] of Object.entries(row)) {
		if (candidateSet.has(normalizeHeader(key))) return value;
	}
	return null;
}

function getCellByIndex(row: Record<string, unknown>, index: number) {
	return row[`__col_${index}`] ?? null;
}

function parseBoolean(value: unknown) {
	if (typeof value === "boolean") return value;
	const text = normalizeText(value);
	return (
		["si", "sí", "true", "1", "x", "baja", "dada de baja", "neutralizada"].includes(text) ||
		text.startsWith("baja ")
	);
}

function parseNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	const text = String(value ?? "").trim();
	if (!text) return null;
	const normalized = text
		.replace(/\$/g, "")
		.replace(/\s+/g, "")
		.replace(/\./g, "")
		.replace(",", ".");
	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : null;
}

function parseCoverageEndDate(value: unknown): string | null {
	const text = String(value ?? "").trim();
	if (!text) return null;
	const parts = text.split(/\s+-\s+/);
	return parseExcelDate(parts[1] ?? text);
}

export function parseExcelDate(value: unknown): string | null {
	if (value == null || value === "") return null;
	if (typeof value === "number") {
		const parsed = XLSX.SSF.parse_date_code(value);
		if (!parsed) return null;
		return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).toISOString().slice(0, 10);
	}
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value.toISOString().slice(0, 10);
	}
	const text = String(value).trim();
	if (!text) return null;
	const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
	if (iso) return text;
	const slash = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(text);
	if (slash) {
		const day = Number(slash[1]);
		const month = Number(slash[2]);
		const rawYear = Number(slash[3]);
		const year = rawYear < 100 ? 2000 + rawYear : rawYear;
		const date = new Date(Date.UTC(year, month - 1, day));
		if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
			return date.toISOString().slice(0, 10);
		}
	}
	const date = new Date(text);
	return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function parseRule(rawRule: unknown, rawOffset: unknown) {
	const text = normalizeText(rawRule);
	const offset = Number(rawOffset ?? 0);
	if (text.includes("mes")) {
		return {
			type: "months_after" as const,
			offset: Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : extractFirstNumber(text) ?? 1,
		};
	}
	if (text.includes("dia") || text.includes("día")) {
		return {
			type: "days_after" as const,
			offset: Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : extractFirstNumber(text) ?? 1,
		};
	}
	if (RULE_TYPES.has(text as InsurancePolicyRuleType)) {
		return {
			type: text as InsurancePolicyRuleType,
			offset: Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0,
		};
	}
	return { type: "on_finish" as const, offset: 0 };
}

function extractFirstNumber(value: string) {
	const match = value.match(/\d+/);
	return match ? Number(match[0]) : null;
}

export function calculateCancellationDate(
	obraFinishedAt: string | null | undefined,
	ruleType: InsurancePolicyRuleType,
	ruleOffset: number,
	definitiveReceptionDate?: string | null,
) {
	const baseSource = definitiveReceptionDate || obraFinishedAt;
	if (!baseSource) return null;
	const base = parseExcelDate(baseSource);
	if (!base) return null;
	const date = new Date(`${base}T00:00:00.000Z`);
	if (ruleType === "days_after") {
		date.setUTCDate(date.getUTCDate() + Math.max(0, Math.floor(ruleOffset)));
	}
	if (ruleType === "months_after") {
		date.setUTCMonth(date.getUTCMonth() + Math.max(0, Math.floor(ruleOffset)));
	}
	return date.toISOString().slice(0, 10);
}

export async function updateInsurancePoliciesForObraCompletion({
	supabase,
	tenantId,
	obraId,
	finishedAt,
}: {
	supabase: Pick<SupabaseClient, "from">;
	tenantId: string;
	obraId: string;
	finishedAt: string;
}) {
	const { data: policies, error } = await supabase
		.from("insurance_policies")
		.select("id, cancellation_rule_type, cancellation_rule_offset, cancellation_rule_configured, definitive_reception_date")
		.eq("tenant_id", tenantId)
		.eq("obra_id", obraId);
	if (error) throw error;

	for (const policy of policies ?? []) {
		const ruleType = policy.cancellation_rule_type as InsurancePolicyRuleType;
		const offset = Number(policy.cancellation_rule_offset ?? 0);
		const ruleConfigured = policy.cancellation_rule_configured === true;
		const { error: updateError } = await supabase
			.from("insurance_policies")
			.update({
				obra_finished_at: finishedAt,
				calculated_cancellation_date: ruleConfigured ? calculateCancellationDate(finishedAt, ruleType, offset, policy.definitive_reception_date) : null,
				last_notified_at: null,
				updated_at: new Date().toISOString(),
			})
			.eq("id", policy.id)
			.eq("tenant_id", tenantId);
		if (updateError) throw updateError;
	}
}

export async function parseInsurancePoliciesWorkbook(
	buffer: ArrayBuffer,
	obras: ObraLookupRow[],
) {
	const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
	const sheetName = workbook.SheetNames[0];
	if (!sheetName) {
		return { rows: [], errors: ["El Excel no tiene hojas."] };
	}

	const sheet = workbook.Sheets[sheetName];
	const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
	const headerIndex = matrix.findIndex((row) =>
		Array.isArray(row) &&
		row.some((cell) => normalizeHeader(cell) === "poliza") &&
		row.some((cell) => normalizeHeader(cell) === "vigencia")
	);
	if (headerIndex < 0) {
		return { rows: [], errors: ["No se encontró la fila de encabezados de pólizas."] };
	}
	const headers = matrix[headerIndex] ?? [];
	const records = matrix
		.slice(headerIndex + 1)
		.map((row, index) => {
			const record: Record<string, unknown> = {};
			(row ?? []).forEach((value, columnIndex) => {
				const header = String(headers[columnIndex] ?? "").trim();
				if (header) record[header] = value;
				record[`__col_${columnIndex}`] = value;
			});
			record.__rowNumber = headerIndex + index + 2;
			return record;
		})
		.filter((record) => String(getCell(record, ["poliza", "póliza"]) ?? "").trim().length > 0);
	const obraIndex = buildObraIndex(obras);
	const rows = records.map((record) => {
		const risk = String(getCell(record, ["riesgo"]) ?? "").trim();
		const insuredObject = String(getCell(record, ["objeto del seguro"]) ?? "").trim();
		const notes = String(getCellByIndex(record, 19) ?? getCellByIndex(record, 18) ?? getCellByIndex(record, 17) ?? "").trim();
		const explicitObraValue =
			getCell(record, ["obra", "n obra", "nro obra", "numero obra", "n", "designacion", "designacion y ubicacion"]) ??
			`${risk}\n${insuredObject}`;
		const policyNumber = String(getCell(record, ["numero de poliza", "nro poliza", "poliza", "póliza", "numero póliza"]) ?? "").trim();
		const coveragePeriod = String(getCell(record, ["vigencia"]) ?? "").trim();
		const endDate =
			parseCoverageEndDate(coveragePeriod) ??
			parseExcelDate(getCell(record, ["fecha de finalizacion", "fecha finalizacion", "vencimiento", "fecha vencimiento", "fecha fin"]));
		const rawRule = getCell(record, ["regla vencimiento", "regla de vencimiento", "vencimiento baja", "regla"]);
		const rawOffset = getCell(record, ["dias", "días", "meses", "cantidad"]);
		const rule = parseRule(rawRule, rawOffset);
		const hasRule = String(rawRule ?? "").trim().length > 0 || String(rawOffset ?? "").trim().length > 0;
		const explicitObraMatch = resolveObra(explicitObraValue, obraIndex, { allowLeadingNumberMatch: true });
		const objectObraMatch = resolveObra(`${risk}\n${insuredObject}`, obraIndex, { allowLeadingNumberMatch: false });
		const obraMatch = objectObraMatch ?? explicitObraMatch;
		const errors: string[] = [];
		if (!policyNumber) errors.push("Falta número de póliza.");

		return {
			rowNumber: Number(record.__rowNumber ?? 0),
			obraId: obraMatch?.id ?? null,
			obraLabel: obraMatch
				? [obraMatch.n != null ? String(obraMatch.n) : "", obraMatch.designacion_y_ubicacion ?? ""]
						.filter(Boolean)
						.join(" ")
				: "No se encontró obra adecuada",
			obraMatchStatus: obraMatch ? "matched" : "unmatched",
			policyNumber,
			section: String(getCell(record, ["seccion", "sección"]) ?? "").trim(),
			coveragePeriod,
			endDate,
			insuredAmount: parseNumber(getCell(record, ["sum.aseg.", "suma asegurada", "sum aseg"])),
			currency: String(getCell(record, ["mon", "moneda"]) ?? "").trim() || null,
			premium: parseNumber(getCell(record, ["prima"])),
			prize: parseNumber(getCell(record, ["premio"])),
			balance: parseNumber(getCell(record, ["saldo $", "saldo"])),
			status: String(getCell(record, ["estado"]) ?? "").trim(),
			risk,
			insuredObject,
			notes,
			cancellationRuleType: rule.type,
			cancellationRuleOffset: rule.offset,
			cancellationRuleConfigured: hasRule,
			isCancelled: parseBoolean(notes || getCell(record, ["poliza dada de baja", "baja", "dada de baja", "cancelada"])),
			errors,
		} satisfies InsurancePolicyImportRow;
	});

	return { rows, errors: [] };
}

function buildObraIndex(obras: ObraLookupRow[]) {
	const byNumber = new Map<string, ObraLookupRow>();
	const byName = new Map<string, ObraLookupRow>();
	const searchable = new Map<ObraLookupRow, string>();
	for (const obra of obras) {
		if (obra.n != null) byNumber.set(String(obra.n).trim(), obra);
		const name = normalizeText(obra.designacion_y_ubicacion);
		if (name) byName.set(name, obra);
		searchable.set(obra, name);
	}
	return { byNumber, byName, searchable };
}

function resolveObra(
	value: unknown,
	index: ReturnType<typeof buildObraIndex>,
	options: { allowLeadingNumberMatch: boolean },
) {
	const raw = String(value ?? "").trim();
	if (!raw) return null;
	const numberMatch = options.allowLeadingNumberMatch
		? /^(?:obra\s*)?(?:n(?:ro|°|º)?\.?\s*)?(\d+)(?:\s*[-–—:]|\s*$)/i.exec(raw)
		: null;
	if (numberMatch) {
		const byNumber = index.byNumber.get(numberMatch[1]);
		if (byNumber) return byNumber;
	}
	const normalizedRaw = normalizeText(raw);
	const exact = index.byName.get(normalizedRaw);
	if (exact) return exact;
	let best: { obra: ObraLookupRow; score: number } | null = null;
	for (const [obra, name] of index.searchable) {
		if (!name) continue;
		const tokens = name
			.split(/\s+/)
			.filter((token) => token.length > 3 && !OBRA_MATCH_STOPWORDS.has(token));
		const score = tokens.filter((token) => normalizedRaw.includes(token)).length;
		if (score > 0 && (!best || score > best.score)) best = { obra, score };
	}
	return best && best.score >= 2 ? best.obra : null;
}

export const INSURANCE_POLICY_TABLE_NAME = "Pólizas de seguro";
export const INSURANCE_POLICY_MACRO_NAME = "Pólizas de seguro";

export const INSURANCE_POLICY_COLUMNS = [
	{ fieldKey: "obraLabel", label: "Obra", dataType: "text" },
	{ fieldKey: "policyNumber", label: "Número de póliza", dataType: "text" },
	{ fieldKey: "section", label: "Sección", dataType: "text" },
	{ fieldKey: "coveragePeriod", label: "Vigencia", dataType: "text" },
	{ fieldKey: "endDate", label: "Fecha de finalización", dataType: "date" },
	{ fieldKey: "insuredAmount", label: "Suma asegurada", dataType: "currency" },
	{ fieldKey: "currency", label: "Moneda", dataType: "text" },
	{ fieldKey: "premium", label: "Prima", dataType: "currency" },
	{ fieldKey: "prize", label: "Premio", dataType: "currency" },
	{ fieldKey: "balance", label: "Saldo", dataType: "currency" },
	{ fieldKey: "status", label: "Estado", dataType: "text" },
	{ fieldKey: "risk", label: "Riesgo", dataType: "text" },
	{ fieldKey: "insuredObject", label: "Objeto del Seguro", dataType: "text" },
	{ fieldKey: "cancellationRule", label: "Regla vencimiento", dataType: "text" },
	{ fieldKey: "definitiveReceptionDate", label: "Recepcion definitiva", dataType: "date" },
	{ fieldKey: "calculatedCancellationDate", label: "Fecha calculada baja", dataType: "date" },
	{ fieldKey: "isCancelled", label: "Póliza dada de baja", dataType: "boolean" },
	{ fieldKey: "cancellationRequestedAt", label: "Baja solicitada", dataType: "date" },
	{ fieldKey: "cancellationConfirmedAt", label: "Baja confirmada", dataType: "date" },
	{ fieldKey: "cancellationNotes", label: "Gestion de baja", dataType: "text" },
	{ fieldKey: "notes", label: "Observaciones", dataType: "text" },
] as const;

export function buildInsurancePolicyRowData(policy: {
	id: string;
	policy_number: string;
	section?: string | null;
	coverage_period?: string | null;
	end_date?: string | null;
	insured_amount?: number | string | null;
	currency?: string | null;
	premium?: number | string | null;
	prize?: number | string | null;
	balance?: number | string | null;
	status?: string | null;
	risk?: string | null;
	insured_object?: string | null;
	cancellation_rule_type: InsurancePolicyRuleType;
	cancellation_rule_offset: number | string | null;
	cancellation_rule_configured?: boolean | null;
	definitive_reception_date?: string | null;
	calculated_cancellation_date?: string | null;
	cancellation_requested_at?: string | null;
	cancellation_confirmed_at?: string | null;
	cancellation_notes?: string | null;
	is_cancelled: boolean;
	notes?: string | null;
	import_obra_label?: string | null;
	import_match_status?: string | null;
	obras?:
		| {
				n?: number | string | null;
				designacion_y_ubicacion?: string | null;
		  }
		| Array<{
				n?: number | string | null;
				designacion_y_ubicacion?: string | null;
		  }>
		| null;
}) {
	const offset = Number(policy.cancellation_rule_offset ?? 0);
	const obra = Array.isArray(policy.obras) ? policy.obras[0] : policy.obras;
	const matchedObraLabel = obra
		? [obra.n != null ? String(obra.n) : "", obra.designacion_y_ubicacion ?? ""]
				.filter(Boolean)
				.join(" ")
		: "";
	return {
		insurancePolicyId: policy.id,
		obraLabel:
			policy.import_match_status === "unmatched"
				? "No se encontró obra adecuada"
				: matchedObraLabel || policy.import_obra_label || "",
		policyNumber: policy.policy_number,
		section: policy.section ?? "",
		coveragePeriod: policy.coverage_period ?? "",
		endDate: policy.end_date ?? null,
		insuredAmount: policy.insured_amount ?? null,
		currency: policy.currency ?? "",
		premium: policy.premium ?? null,
		prize: policy.prize ?? null,
		balance: policy.balance ?? null,
		status: policy.status ?? "",
		risk: policy.risk ?? "",
		insuredObject: policy.insured_object ?? "",
		cancellationRule:
			policy.cancellation_rule_configured !== true
				? ""
				: policy.cancellation_rule_type === "days_after"
				? `${offset} días después`
				: policy.cancellation_rule_type === "months_after"
					? `${offset} meses después`
					: "Al finalizar obra",
		definitiveReceptionDate: policy.definitive_reception_date ?? null,
		calculatedCancellationDate: policy.calculated_cancellation_date ?? null,
		cancellationRequestedAt: policy.cancellation_requested_at ?? null,
		cancellationConfirmedAt: policy.cancellation_confirmed_at ?? null,
		cancellationNotes: policy.cancellation_notes ?? "",
		isCancelled: policy.is_cancelled,
		notes: policy.notes ?? "",
	};
}
