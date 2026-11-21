import type { APIRequestContext, APIResponse, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import * as XLSX from "xlsx";
import { z } from "zod";

const certificateSchema = z.object({
	id: z.string().uuid(),
	obra_id: z.string().uuid(),
	n_exp: z.string(),
	n_certificado: z.coerce.number(),
	monto: z.coerce.number(),
	mes: z.string(),
	estado: z.string(),
	facturado: z.boolean().nullable().optional(),
	fecha_facturacion: z.string().nullable().optional(),
	nro_factura: z.string().nullable().optional(),
	concepto: z.string().nullable().optional(),
	cobrado: z.boolean().nullable().optional(),
	observaciones: z.string().nullable().optional(),
	vencimiento: z.string().nullable().optional(),
	fecha_pago: z.string().nullable().optional(),
}).passthrough();

const certificateResponseSchema = z.object({ certificate: certificateSchema });
const obraCertificatesResponseSchema = z.object({
	certificates: z.array(certificateSchema),
	total: z.number(),
});

const insuranceImportRowSchema = z.object({
	rowNumber: z.number(),
	importAction: z.enum(["create", "update"]).optional(),
	sourceFormat: z.enum(["policy_master", "exigible_debt"]).optional(),
	sourceFileName: z.string().optional(),
	sourceCutoffDate: z.string().nullable().optional(),
	obraId: z.string().uuid().nullable(),
	obraLabel: z.string(),
	obraMatchStatus: z.enum(["matched", "unmatched"]),
	policyNumber: z.string(),
	section: z.string(),
	coveragePeriod: z.string(),
	endDate: z.string().nullable(),
	insuredAmount: z.number().nullable(),
	currency: z.string().nullable(),
	premium: z.number().nullable(),
	prize: z.number().nullable(),
	balance: z.number().nullable(),
	status: z.string(),
	risk: z.string(),
	insuredObject: z.string(),
	notes: z.string(),
	cancellationRuleType: z.enum(["on_finish", "days_after", "months_after"]),
	cancellationRuleOffset: z.number(),
	cancellationRuleConfigured: z.boolean(),
	isCancelled: z.boolean(),
	errors: z.array(z.string()),
}).passthrough();

const insuranceImportPreviewSchema = z.object({
	preview: z.array(insuranceImportRowSchema),
	errors: z.array(z.string()),
	hasBlockingErrors: z.boolean(),
});

const insurancePolicySchema = z.object({
	id: z.string().uuid(),
	tenant_id: z.string().uuid(),
	obra_id: z.string().uuid().nullable(),
	import_obra_label: z.string().nullable().optional(),
	import_match_status: z.string().nullable().optional(),
	policy_number: z.string(),
	cancellation_requested_at: z.string().nullable().optional(),
	cancellation_confirmed_at: z.string().nullable().optional(),
	cancellation_notes: z.string().nullable().optional(),
	notes: z.string().nullable().optional(),
	obra_finished_at: z.string().nullable().optional(),
	calculated_cancellation_date: z.string().nullable().optional(),
	last_notified_at: z.string().nullable().optional(),
	is_cancelled: z.boolean(),
}).passthrough();

const insurancePoliciesResponseSchema = z.object({
	policies: z.array(insurancePolicySchema),
}).passthrough();

export type InsuranceImportRow = z.infer<typeof insuranceImportRowSchema>;
export type InsurancePolicy = z.infer<typeof insurancePolicySchema>;

async function requireOk(response: APIResponse, operation: string) {
	if (response.ok()) return;
	throw new Error(`${operation} failed (${response.status()}): ${await response.text()}`);
}

export async function createCertificate(
	request: APIRequestContext,
	obraId: string,
	input: {
		nExp: string;
		nCertificate: number;
		amount: number;
		month: string;
	},
) {
	const response = await request.post(`/api/obras/${obraId}/certificates`, {
		data: {
			n_exp: input.nExp,
			n_certificado: input.nCertificate,
			monto: input.amount,
			mes: input.month,
			estado: "CERTIFICADO",
		},
	});
	await requireOk(response, `create certificate ${input.nExp}`);
	return certificateResponseSchema.parse(await response.json()).certificate;
}

export async function listObraCertificates(
	request: APIRequestContext,
	obraId: string,
) {
	const response = await request.get(`/api/obras/${obraId}/certificates`);
	await requireOk(response, `list certificates for obra ${obraId}`);
	return obraCertificatesResponseSchema.parse(await response.json());
}

export async function patchCertificate(
	request: APIRequestContext,
	certificateId: string,
	data: Record<string, unknown>,
) {
	return request.patch(`/api/certificados/${certificateId}`, { data });
}

export function buildInsurancePolicyWorkbook(rows: Array<{
	policyNumber: string;
	obra: string;
	section?: string;
	status?: string;
	risk?: string;
}>) {
	const sheet = XLSX.utils.aoa_to_sheet([
		[
			"Poliza",
			"Vigencia",
			"Obra",
			"Seccion",
			"Sum.Aseg.",
			"Mon",
			"Prima",
			"Premio",
			"Saldo",
			"Estado",
			"Riesgo",
			"Objeto del Seguro",
		],
		...rows.map((row) => [
			row.policyNumber,
			"01/10/2026 - 30/09/2027",
			row.obra,
			row.section ?? "Caucion",
			250_000,
			"ARS",
			12_500.25,
			15_000.5,
			2_500.25,
			row.status ?? "Vigente",
			row.risk ?? "Ejecucion de contrato",
			"Cumplimiento de obra publica",
		]),
	]);
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, sheet, "Polizas");
	return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export async function previewInsuranceImport(
	request: APIRequestContext,
	buffer: Buffer,
	fileName: string,
) {
	const response = await request.post("/api/insurance-policies/import", {
		multipart: {
			file: {
				name: fileName,
				mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				buffer,
			},
		},
	});
	await requireOk(response, `preview insurance import ${fileName}`);
	return insuranceImportPreviewSchema.parse(await response.json());
}

export async function confirmInsuranceImport(
	request: APIRequestContext,
	rows: InsuranceImportRow[],
) {
	const response = await request.post("/api/insurance-policies/import", {
		data: { rows },
	});
	await requireOk(response, "confirm insurance import");
	return z.object({ imported: z.number() }).passthrough().parse(await response.json());
}

export async function listInsurancePolicies(
	request: APIRequestContext,
	query = "",
) {
	const response = await request.get(
		`/api/insurance-policies?all=1&q=${encodeURIComponent(query)}`,
	);
	await requireOk(response, "list insurance policies");
	return insurancePoliciesResponseSchema.parse(await response.json()).policies;
}

export async function findInsurancePolicy(
	request: APIRequestContext,
	policyNumber: string,
): Promise<InsurancePolicy> {
	const policies = await listInsurancePolicies(request, policyNumber);
	const policy = policies.find((candidate) => candidate.policy_number === policyNumber);
	if (!policy) throw new Error(`Policy ${policyNumber} was not returned by the actor API.`);
	return policy;
}

export function formTableCell(
	page: Page,
	rowId: string,
	columnId: string,
) {
	return page.locator(
		`td[data-form-table-cell="true"][data-row-id="${rowId}"][data-column-id="${columnId}"]`,
	);
}

export async function editFormTableCell(
	page: Page,
	rowId: string,
	columnId: string,
	field: string,
	value: string,
) {
	const cell = formTableCell(page, rowId, columnId);
	await expect(cell).toBeVisible();
	await cell.click();
	const input = page.getByTestId(`cell-input-${rowId}-${field}`);
	await expect(input).toBeVisible();
	await input.fill(value);
	await input.press("Tab");
}

export async function checkFormTableCheckbox(
	page: Page,
	rowId: string,
	columnId: string,
) {
	const cell = formTableCell(page, rowId, columnId);
	await expect(cell).toBeVisible();
	await expect(cell).toContainText("No");
	await cell.click();
	const checkbox = cell.getByRole("checkbox");
	await expect(checkbox).toBeVisible();
	await expect(checkbox).not.toBeChecked();
	await checkbox.click();
	await expect(checkbox).toBeChecked();
}
