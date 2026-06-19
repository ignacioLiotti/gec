import { NextResponse } from "next/server";
import {
	INSURANCE_POLICY_COLUMNS,
	INSURANCE_POLICY_MACRO_NAME,
	INSURANCE_POLICY_TABLE_NAME,
	buildInsurancePolicyRowData,
	calculateCancellationDate,
	parseInsurancePoliciesWorkbook,
	type InsurancePolicyFinancialMovementImport,
	type InsurancePolicyImportRow,
} from "@/lib/insurance-policies";
import { getAuthContext } from "../../obras/route";

type ConfirmPayload = {
	rows?: InsurancePolicyImportRow[];
};

type ObraImportLookupRow = {
	id: string;
	n: number | string | null;
	designacion_y_ubicacion: string | null;
};

type ObraImportStateRow = {
	id: string;
	porcentaje: number | string | null;
};

type SupabaseRouteClient = Awaited<ReturnType<typeof getAuthContext>>["supabase"];
type InsurancePolicyUpsert = {
	tenant_id: string;
	obra_id: string | null;
	import_obra_label: string | null;
	import_match_status: "matched" | "unmatched";
	policy_number: string;
	section: string;
	coverage_period: string;
	end_date: string | null;
	insured_amount: number | null;
	currency: string | null;
	premium: number | null;
	prize: number | null;
	balance: number | null;
	status: string;
	risk: string;
	insured_object: string;
	notes: string;
	cancellation_rule_type: InsurancePolicyImportRow["cancellationRuleType"];
	cancellation_rule_offset: number;
	cancellation_rule_configured?: boolean;
	obra_finished_at: string | null;
	definitive_reception_date?: string | null;
	cancellation_requested_at?: string | null;
	cancellation_confirmed_at?: string | null;
	cancellation_notes?: string | null;
	calculated_cancellation_date: string | null;
	is_cancelled: boolean;
	cancelled_at: string | null;
	cancelled_by: string | null;
};

type ExistingPolicyLookupRow = {
	id: string;
	obra_id: string | null;
	policy_number: string;
};

type InsurancePolicyFinancialMovementInsert = {
	tenant_id: string;
	insurance_policy_id: string | null;
	policy_number: string;
	endorsement_number: string | null;
	installment_number: string | null;
	item_number: string | null;
	invoice_position: string | null;
	invoice_number: string | null;
	invoice_letter: string | null;
	issue_date: string | null;
	producer_due_date: string | null;
	insured_due_date: string | null;
	coverage_start: string | null;
	coverage_end: string | null;
	section: string;
	currency: string | null;
	premium_amount: number | null;
	paid_amount: number | null;
	future_paid_amount: number | null;
	due_amount: number | null;
	upcoming_amount: number | null;
	balance_amount: number | null;
	status: string;
	movement_type: "debit" | "credit_note";
	source_file_name: string | null;
	source_cutoff_date: string | null;
	raw_row: Record<string, unknown>;
};

const SUPABASE_IN_CHUNK_SIZE = 80;

function uniqueValues(values: Array<string | null | undefined>) {
	return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function chunkValues<T>(values: T[], size = SUPABASE_IN_CHUNK_SIZE) {
	const chunks: T[][] = [];
	for (let index = 0; index < values.length; index += size) {
		chunks.push(values.slice(index, index + size));
	}
	return chunks;
}

async function fetchExistingPoliciesByNumber(
	supabase: SupabaseRouteClient,
	tenantId: string,
	policyNumbers: string[],
) {
	const rows: ExistingPolicyLookupRow[] = [];
	for (const chunk of chunkValues(uniqueValues(policyNumbers))) {
		const { data, error } = await supabase
			.from("insurance_policies")
			.select("id, obra_id, policy_number")
			.eq("tenant_id", tenantId)
			.in("policy_number", chunk);
		if (error) throw error;
		rows.push(...((data ?? []) as ExistingPolicyLookupRow[]));
	}
	return rows;
}

async function fetchObraStatesById(
	supabase: SupabaseRouteClient,
	tenantId: string,
	obraIds: string[],
) {
	const rows: ObraImportStateRow[] = [];
	for (const chunk of chunkValues(uniqueValues(obraIds))) {
		const { data, error } = await supabase
			.from("obras")
			.select("id, porcentaje")
			.eq("tenant_id", tenantId)
			.in("id", chunk);
		if (error) throw error;
		rows.push(...((data ?? []) as ObraImportStateRow[]));
	}
	return rows;
}

async function annotateInsuranceImportPreview(
	supabase: SupabaseRouteClient,
	tenantId: string,
	rows: InsurancePolicyImportRow[],
) {
	const policyNumbers = uniqueValues(rows.map((row) => row.policyNumber));
	if (policyNumbers.length === 0) return rows;
	const existing = await fetchExistingPoliciesByNumber(supabase, tenantId, policyNumbers);
	const existingPolicyNumbers = new Set(
		(existing ?? []).map((policy) => String(policy.policy_number ?? "")),
	);
	return rows.map((row) => ({
		...row,
		importAction: existingPolicyNumbers.has(row.policyNumber) ? "update" : "create",
	}));
}

async function ensureInsuranceMacroTable(supabase: SupabaseRouteClient, tenantId: string) {
	const { data: existing, error: existingError } = await supabase
		.from("macro_tables")
		.select("id")
		.eq("tenant_id", tenantId)
		.eq("name", INSURANCE_POLICY_MACRO_NAME)
		.maybeSingle<{ id: string }>();
	if (existingError) throw existingError;

	let macroTableId = existing?.id ?? null;
	if (!macroTableId) {
		const { data: created, error: createError } = await supabase
			.from("macro_tables")
			.insert({
				tenant_id: tenantId,
				name: INSURANCE_POLICY_MACRO_NAME,
				description: "Macrotabla sincronizada con las pólizas de seguro importadas.",
				settings: {
					sourceMode: "template",
					sourceTemplateName: INSURANCE_POLICY_TABLE_NAME,
					sourceTemplateId: null,
					sourceTemplateTableNames: [INSURANCE_POLICY_TABLE_NAME],
				},
			})
			.select("id")
			.single<{ id: string }>();
		if (createError) throw createError;
		macroTableId = created.id;
	} else {
		await supabase
			.from("macro_tables")
			.update({
				settings: {
					sourceMode: "template",
					sourceTemplateName: INSURANCE_POLICY_TABLE_NAME,
					sourceTemplateId: null,
					sourceTemplateTableNames: [INSURANCE_POLICY_TABLE_NAME],
				},
			})
			.eq("id", macroTableId)
			.eq("tenant_id", tenantId);
	}

	const { data: existingColumns, error: columnsError } = await supabase
		.from("macro_table_columns")
		.select("id, source_field_key")
		.eq("macro_table_id", macroTableId);
	if (columnsError) throw columnsError;
	const existingKeys = new Set((existingColumns ?? []).map((column) => column.source_field_key as string | null));
	const missingColumns = INSURANCE_POLICY_COLUMNS
		.filter((column) => !existingKeys.has(column.fieldKey))
		.map((column, index) => ({
			macro_table_id: macroTableId,
			column_type: "source",
			source_field_key: column.fieldKey,
			label: column.label,
			data_type: column.dataType,
			position: index,
			config: {},
		}));
	if (missingColumns.length > 0) {
		const { error: insertColumnsError } = await supabase
			.from("macro_table_columns")
			.insert(missingColumns);
		if (insertColumnsError) throw insertColumnsError;
	}

	return macroTableId;
}

async function ensureInsuranceTablaForObra(
	supabase: SupabaseRouteClient,
	obraId: string,
) {
	const { data: existing, error: existingError } = await supabase
		.from("obra_tablas")
		.select("id")
		.eq("obra_id", obraId)
		.eq("name", INSURANCE_POLICY_TABLE_NAME)
		.maybeSingle<{ id: string }>();
	if (existingError) throw existingError;

	let tablaId = existing?.id ?? null;
	if (!tablaId) {
		const { data: created, error: createError } = await supabase
			.from("obra_tablas")
			.insert({
				obra_id: obraId,
				name: INSURANCE_POLICY_TABLE_NAME,
				description: "Pólizas de seguro importadas desde Excel general.",
				source_type: "manual",
				settings: {
					domain: "insurance_policies",
					hideFromDocuments: true,
				},
			})
			.select("id")
			.single<{ id: string }>();
		if (createError) throw createError;
		tablaId = created.id;
	}

	const { data: existingColumns, error: columnsError } = await supabase
		.from("obra_tabla_columns")
		.select("field_key")
		.eq("tabla_id", tablaId);
	if (columnsError) throw columnsError;
	const existingKeys = new Set((existingColumns ?? []).map((column) => column.field_key as string));
	const missingColumns = INSURANCE_POLICY_COLUMNS
		.filter((column) => !existingKeys.has(column.fieldKey))
		.map((column, index) => ({
			tabla_id: tablaId,
			field_key: column.fieldKey,
			label: column.label,
			data_type: column.dataType,
			position: index,
			required: column.fieldKey === "policyNumber",
			config: {},
		}));
	if (missingColumns.length > 0) {
		const { error: insertColumnsError } = await supabase
			.from("obra_tabla_columns")
			.insert(missingColumns);
		if (insertColumnsError) throw insertColumnsError;
	}

	return tablaId;
}

async function syncInsuranceMacroRows(
	supabase: SupabaseRouteClient,
	tenantId: string,
	obraIds: string[],
) {
	await ensureInsuranceMacroTable(supabase, tenantId);
	for (const obraId of obraIds) {
		const tablaId = await ensureInsuranceTablaForObra(supabase, obraId);
		const { error: deleteError } = await supabase
			.from("obra_tabla_rows")
			.delete()
			.eq("tabla_id", tablaId)
			.eq("source", "insurance_import");
		if (deleteError) throw deleteError;

		const { data: policies, error: policiesError } = await supabase
			.from("insurance_policies")
			.select("*, obras(n, designacion_y_ubicacion)")
			.eq("tenant_id", tenantId)
			.eq("obra_id", obraId)
			.order("policy_number", { ascending: true });
		if (policiesError) throw policiesError;
		if (!policies || policies.length === 0) continue;

		const rows = policies.map((policy) => ({
			tabla_id: tablaId,
			data: buildInsurancePolicyRowData(policy as Parameters<typeof buildInsurancePolicyRowData>[0]),
			source: "insurance_import",
			lineage_row_key: `insurance-policy:${policy.id}`,
			materialization_version: 1,
		}));
		const { error: insertError } = await supabase.from("obra_tabla_rows").insert(rows);
		if (insertError) throw insertError;
	}
}

async function persistUnmatchedInsurancePolicies(
	supabase: SupabaseRouteClient,
	rows: InsurancePolicyUpsert[],
) {
	let imported = 0;
	for (const row of rows) {
		const { data: existing, error: existingError } = await supabase
			.from("insurance_policies")
			.select("id")
			.eq("tenant_id", row.tenant_id)
			.eq("policy_number", row.policy_number)
			.is("obra_id", null)
			.maybeSingle<{ id: string }>();
		if (existingError) throw existingError;

		const writePayload = (withRuleConfigured: boolean, withDefinitiveReceptionDate: boolean, withCancellationWorkflow: boolean) => {
			if (withRuleConfigured && withDefinitiveReceptionDate && withCancellationWorkflow) return row;
			const legacyRow: Partial<InsurancePolicyUpsert> = { ...row };
			if (!withRuleConfigured) delete legacyRow.cancellation_rule_configured;
			if (!withDefinitiveReceptionDate) delete legacyRow.definitive_reception_date;
			if (!withCancellationWorkflow) {
				delete legacyRow.cancellation_requested_at;
				delete legacyRow.cancellation_confirmed_at;
				delete legacyRow.cancellation_notes;
			}
			return legacyRow;
		};

		if (existing?.id) {
			let { error } = await supabase
				.from("insurance_policies")
				.update(writePayload(true, true, true))
				.eq("id", existing.id)
				.eq("tenant_id", row.tenant_id);
			if (error && /cancellation_rule_configured|definitive_reception_date|cancellation_requested_at|cancellation_confirmed_at|cancellation_notes/i.test(error.message)) {
				const fallback = await supabase
					.from("insurance_policies")
					.update(writePayload(
						!/cancellation_rule_configured/i.test(error.message),
						!/definitive_reception_date/i.test(error.message),
						!/cancellation_requested_at|cancellation_confirmed_at|cancellation_notes/i.test(error.message),
					))
					.eq("id", existing.id)
					.eq("tenant_id", row.tenant_id);
				error = fallback.error;
			}
			if (error) throw error;
		} else {
			let { error } = await supabase
				.from("insurance_policies")
				.insert(writePayload(true, true, true));
			if (error && /cancellation_rule_configured|definitive_reception_date|cancellation_requested_at|cancellation_confirmed_at|cancellation_notes/i.test(error.message)) {
				const fallback = await supabase
					.from("insurance_policies")
					.insert(writePayload(
						!/cancellation_rule_configured/i.test(error.message),
						!/definitive_reception_date/i.test(error.message),
						!/cancellation_requested_at|cancellation_confirmed_at|cancellation_notes/i.test(error.message),
					));
				error = fallback.error;
			}
			if (error) throw error;
		}
		imported += 1;
	}
	return imported;
}

async function replaceFinancialMovementsForImport(
	supabase: SupabaseRouteClient,
	tenantId: string,
	sourceFileName: string | null,
	sourceCutoffDate: string | null,
	policyNumbers: string[],
	movements: InsurancePolicyFinancialMovementInsert[],
) {
	if (policyNumbers.length === 0) return 0;
	for (const chunk of chunkValues(uniqueValues(policyNumbers))) {
		let deleteQuery = supabase
			.from("insurance_policy_financial_movements")
			.delete()
			.eq("tenant_id", tenantId)
			.in("policy_number", chunk);
		if (sourceFileName) deleteQuery = deleteQuery.eq("source_file_name", sourceFileName);
		if (sourceCutoffDate) deleteQuery = deleteQuery.eq("source_cutoff_date", sourceCutoffDate);
		const { error: deleteError } = await deleteQuery;
		if (deleteError) throw deleteError;
	}
	if (movements.length === 0) return 0;
	for (const chunk of chunkValues(movements, 250)) {
		const { error: insertError } = await supabase
			.from("insurance_policy_financial_movements")
			.insert(chunk);
		if (insertError) throw insertError;
	}
	return movements.length;
}

function buildFinancialMovementInsert(
	tenantId: string,
	policyId: string | null,
	sourceFileName: string | null,
	sourceCutoffDate: string | null,
	movement: InsurancePolicyFinancialMovementImport,
): InsurancePolicyFinancialMovementInsert {
	return {
		tenant_id: tenantId,
		insurance_policy_id: policyId,
		policy_number: movement.policyNumber,
		endorsement_number: movement.endorsementNumber,
		installment_number: movement.installmentNumber,
		item_number: movement.itemNumber,
		invoice_position: movement.invoicePosition,
		invoice_number: movement.invoiceNumber,
		invoice_letter: movement.invoiceLetter,
		issue_date: movement.issueDate,
		producer_due_date: movement.producerDueDate,
		insured_due_date: movement.insuredDueDate,
		coverage_start: movement.coverageStart,
		coverage_end: movement.coverageEnd,
		section: movement.section,
		currency: movement.currency,
		premium_amount: movement.premiumAmount,
		paid_amount: movement.paidAmount,
		future_paid_amount: movement.futurePaidAmount,
		due_amount: movement.dueAmount,
		upcoming_amount: movement.upcomingAmount,
		balance_amount: movement.balanceAmount,
		status: movement.status,
		movement_type: movement.movementType,
		source_file_name: sourceFileName,
		source_cutoff_date: sourceCutoffDate,
		raw_row: movement.raw,
	};
}

export async function POST(request: Request) {
	const { supabase, user, tenantId } = await getAuthContext();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

	const contentType = request.headers.get("content-type") ?? "";
	const { data: obras, error: obrasError } = await supabase
		.from("obras")
		.select("id, n, designacion_y_ubicacion")
		.eq("tenant_id", tenantId)
		.is("deleted_at", null);
	if (obrasError) return NextResponse.json({ error: obrasError.message }, { status: 500 });

	if (contentType.includes("multipart/form-data")) {
		const formData = await request.formData();
		const file = formData.get("file");
		if (!(file instanceof File)) {
			return NextResponse.json({ error: "Archivo Excel requerido" }, { status: 400 });
		}
		const parsed = await parseInsurancePoliciesWorkbook(
			await file.arrayBuffer(),
			(obras ?? []) as ObraImportLookupRow[],
			{ sourceFileName: file.name },
		);
		const previewRows = await annotateInsuranceImportPreview(supabase, tenantId, parsed.rows);
		return NextResponse.json({
			preview: previewRows,
			errors: parsed.errors,
			hasBlockingErrors: parsed.errors.length > 0 || previewRows.some((row) => row.errors.length > 0),
		});
	}

	const payload = (await request.json().catch(() => ({}))) as ConfirmPayload;
	const rows = Array.isArray(payload.rows) ? payload.rows : [];
	const validRows = rows.filter((row) => row.policyNumber && row.errors.length === 0);
	if (validRows.length === 0) {
		return NextResponse.json({ error: "No hay pólizas válidas para importar" }, { status: 400 });
	}

	const exigibleRows = validRows.filter((row) => row.sourceFormat === "exigible_debt");
	const policyMasterRows = validRows.filter((row) => row.sourceFormat !== "exigible_debt");
	const matchedRows = policyMasterRows.filter((row) => row.obraId);
	const unmatchedRows = policyMasterRows.filter((row) => !row.obraId);
	const obraIds = Array.from(new Set(matchedRows.map((row) => row.obraId as string)));
	let obraStates: ObraImportStateRow[] = [];
	try {
		obraStates = await fetchObraStatesById(supabase, tenantId, obraIds);
	} catch (obraStatesError) {
		const message = obraStatesError instanceof Error ? obraStatesError.message : "Error consultando obras";
		return NextResponse.json({ error: message }, { status: 500 });
	}
	const finishedObras = new Set(
		obraStates
			.filter((obra: ObraImportStateRow) => Number(obra.porcentaje ?? 0) >= 100)
			.map((obra: ObraImportStateRow) => obra.id),
	);
	const today = new Date().toISOString().slice(0, 10);

	const buildUpsert = (row: InsurancePolicyImportRow): InsurancePolicyUpsert => {
		const obraFinishedAt = row.obraId && finishedObras.has(row.obraId) ? today : null;
		return {
			tenant_id: tenantId,
			obra_id: row.obraId,
			import_obra_label: row.obraLabel || null,
			import_match_status: row.obraId ? "matched" : "unmatched",
			policy_number: row.policyNumber,
			section: row.section,
			coverage_period: row.coveragePeriod,
			end_date: row.endDate,
			insured_amount: row.insuredAmount,
			currency: row.currency,
			premium: row.premium,
			prize: row.prize,
			balance: row.balance,
			status: row.status,
			risk: row.risk,
			insured_object: row.insuredObject,
			notes: row.notes,
			cancellation_rule_type: row.cancellationRuleType,
			cancellation_rule_offset: row.cancellationRuleOffset,
			cancellation_rule_configured: row.cancellationRuleConfigured === true,
			obra_finished_at: obraFinishedAt,
			definitive_reception_date: null,
			cancellation_requested_at: null,
			cancellation_confirmed_at: null,
			cancellation_notes: null,
			calculated_cancellation_date: row.cancellationRuleConfigured === true
				? calculateCancellationDate(
					obraFinishedAt,
					row.cancellationRuleType,
					row.cancellationRuleOffset,
				)
				: null,
			is_cancelled: row.isCancelled,
			cancelled_at: row.isCancelled ? new Date().toISOString() : null,
			cancelled_by: row.isCancelled ? user.id : null,
		};
	};

	const masterPolicyNumbers = uniqueValues(policyMasterRows.map((row) => row.policyNumber));
	let existingMasterPolicies: ExistingPolicyLookupRow[] = [];
	try {
		existingMasterPolicies = await fetchExistingPoliciesByNumber(supabase, tenantId, masterPolicyNumbers);
	} catch (existingMasterPoliciesError) {
		const message = existingMasterPoliciesError instanceof Error ? existingMasterPoliciesError.message : "Error consultando polizas existentes";
		return NextResponse.json({ error: message }, { status: 500 });
	}
	const existingMasterByPolicy = new Map<string, ExistingPolicyLookupRow>();
	for (const policy of existingMasterPolicies) {
		const current = existingMasterByPolicy.get(policy.policy_number);
		if (!current || (!current.obra_id && policy.obra_id)) existingMasterByPolicy.set(policy.policy_number, policy);
	}
	let existingMasterImported = 0;
	const existingMasterAffectedObraIds = new Set<string>();
	for (const row of policyMasterRows) {
		const existing = existingMasterByPolicy.get(row.policyNumber);
		if (!existing?.id) continue;
		const updatePayload: Partial<InsurancePolicyUpsert> = buildUpsert(row);
		delete updatePayload.tenant_id;
		delete updatePayload.cancellation_requested_at;
		delete updatePayload.cancellation_confirmed_at;
		delete updatePayload.cancellation_notes;
		delete updatePayload.definitive_reception_date;
		if (row.cancellationRuleConfigured !== true) {
			delete updatePayload.cancellation_rule_configured;
			delete updatePayload.cancellation_rule_type;
			delete updatePayload.cancellation_rule_offset;
			delete updatePayload.calculated_cancellation_date;
		}
		if (!row.obraId) {
			delete updatePayload.obra_id;
			delete updatePayload.import_obra_label;
			delete updatePayload.import_match_status;
			delete updatePayload.obra_finished_at;
			delete updatePayload.calculated_cancellation_date;
		}
		const { error: updateError } = await supabase
			.from("insurance_policies")
			.update(updatePayload)
			.eq("id", existing.id)
			.eq("tenant_id", tenantId);
		if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
		if (existing.obra_id) existingMasterAffectedObraIds.add(existing.obra_id);
		if (row.obraId) existingMasterAffectedObraIds.add(row.obraId);
		existingMasterImported += 1;
	}
	const newMatchedRows = matchedRows.filter((row) => !existingMasterByPolicy.has(row.policyNumber));
	const newUnmatchedRows = unmatchedRows.filter((row) => !existingMasterByPolicy.has(row.policyNumber));
	const upserts = newMatchedRows.map(buildUpsert);
	let data: Array<{ id: string }> | null = [];
	let error: { message: string } | null = null;
	if (upserts.length > 0) {
		const result = await supabase
			.from("insurance_policies")
			.upsert(upserts, { onConflict: "tenant_id,obra_id,policy_number" })
			.select("id");
		data = result.data;
		error = result.error;
		if (error && /cancellation_rule_configured|definitive_reception_date|cancellation_requested_at|cancellation_confirmed_at|cancellation_notes/i.test(error.message)) {
			const legacyUpserts = upserts.map((row) => {
				const next: Partial<typeof row> = { ...row };
				if (/cancellation_rule_configured/i.test(error?.message ?? "")) delete next.cancellation_rule_configured;
				if (/definitive_reception_date/i.test(error?.message ?? "")) delete next.definitive_reception_date;
				if (/cancellation_requested_at|cancellation_confirmed_at|cancellation_notes/i.test(error?.message ?? "")) {
					delete next.cancellation_requested_at;
					delete next.cancellation_confirmed_at;
					delete next.cancellation_notes;
				}
				return next;
			});
			const fallback = await supabase
				.from("insurance_policies")
				.upsert(legacyUpserts, { onConflict: "tenant_id,obra_id,policy_number" })
				.select("id");
			data = fallback.data;
			error = fallback.error;
		}
		if (error) return NextResponse.json({ error: error.message }, { status: 500 });
	}
	let unmatchedImported = 0;
	try {
		unmatchedImported = await persistUnmatchedInsurancePolicies(supabase, newUnmatchedRows.map(buildUpsert));
	} catch (unmatchedError) {
		const message = unmatchedError instanceof Error ? unmatchedError.message : "Error importando pólizas sin obra";
		return NextResponse.json({ error: message }, { status: 500 });
	}
	let exigibleImported = 0;
	let financialMovementsImported = 0;
	const financialAffectedObraIds = new Set<string>();
	if (exigibleRows.length > 0) {
		const policyNumbers = uniqueValues(exigibleRows.map((row) => row.policyNumber));
		let existingPolicies: ExistingPolicyLookupRow[] = [];
		try {
			existingPolicies = await fetchExistingPoliciesByNumber(supabase, tenantId, policyNumbers);
		} catch (existingPoliciesError) {
			const message = existingPoliciesError instanceof Error ? existingPoliciesError.message : "Error consultando polizas existentes";
			return NextResponse.json({ error: message }, { status: 500 });
		}
		const existingByPolicy = new Map<string, ExistingPolicyLookupRow>();
		for (const policy of existingPolicies) {
			const current = existingByPolicy.get(policy.policy_number);
			if (!current || (!current.obra_id && policy.obra_id)) existingByPolicy.set(policy.policy_number, policy);
		}
		const policyIdByNumber = new Map<string, string>();
		for (const row of exigibleRows) {
			const existing = existingByPolicy.get(row.policyNumber);
			const upsert = buildUpsert(row);
			if (existing?.id) {
				const { error: updateError } = await supabase
					.from("insurance_policies")
					.update({
						section: upsert.section,
						coverage_period: upsert.coverage_period,
						end_date: upsert.end_date,
						currency: upsert.currency,
						prize: upsert.prize,
						balance: upsert.balance,
						status: upsert.status,
						notes: upsert.notes,
						is_cancelled: false,
						updated_at: new Date().toISOString(),
					})
					.eq("id", existing.id)
					.eq("tenant_id", tenantId);
				if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
				policyIdByNumber.set(row.policyNumber, existing.id);
				if (existing.obra_id) financialAffectedObraIds.add(existing.obra_id);
				exigibleImported += 1;
			} else {
				const { data: created, error: createError } = await supabase
					.from("insurance_policies")
					.insert(upsert)
					.select("id, obra_id")
					.single<{ id: string; obra_id: string | null }>();
				if (createError) return NextResponse.json({ error: createError.message }, { status: 500 });
				policyIdByNumber.set(row.policyNumber, created.id);
				if (created.obra_id) financialAffectedObraIds.add(created.obra_id);
				exigibleImported += 1;
			}
		}
		const sourceFileName = exigibleRows.find((row) => row.sourceFileName)?.sourceFileName ?? null;
		const sourceCutoffDate = exigibleRows.find((row) => row.sourceCutoffDate)?.sourceCutoffDate ?? null;
		const movementInserts = exigibleRows.flatMap((row) =>
			(row.financialMovements ?? []).map((movement) =>
				buildFinancialMovementInsert(
					tenantId,
					policyIdByNumber.get(row.policyNumber) ?? null,
					sourceFileName,
					sourceCutoffDate,
					movement,
				)
			)
		);
		try {
			financialMovementsImported = await replaceFinancialMovementsForImport(
				supabase,
				tenantId,
				sourceFileName,
				sourceCutoffDate,
				policyNumbers,
				movementInserts,
			);
		} catch (movementError) {
			const message = movementError instanceof Error ? movementError.message : "Error importando movimientos financieros de polizas";
			return NextResponse.json({ error: message }, { status: 500 });
		}
	}
	const syncObraIds = Array.from(new Set([...obraIds, ...existingMasterAffectedObraIds, ...financialAffectedObraIds]));
	await syncInsuranceMacroRows(supabase, tenantId, syncObraIds);
	return NextResponse.json({
		imported: (data?.length ?? 0) + unmatchedImported + existingMasterImported + exigibleImported,
		financialMovementsImported,
	});
}
