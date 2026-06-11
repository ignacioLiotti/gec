import { NextResponse } from "next/server";
import {
	INSURANCE_POLICY_COLUMNS,
	INSURANCE_POLICY_MACRO_NAME,
	INSURANCE_POLICY_TABLE_NAME,
	buildInsurancePolicyRowData,
	calculateCancellationDate,
	parseInsurancePoliciesWorkbook,
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
		const parsed = await parseInsurancePoliciesWorkbook(await file.arrayBuffer(), (obras ?? []) as ObraImportLookupRow[]);
		return NextResponse.json({
			preview: parsed.rows,
			errors: parsed.errors,
			hasBlockingErrors: parsed.errors.length > 0 || parsed.rows.some((row) => row.errors.length > 0),
		});
	}

	const payload = (await request.json().catch(() => ({}))) as ConfirmPayload;
	const rows = Array.isArray(payload.rows) ? payload.rows : [];
	const validRows = rows.filter((row) => row.policyNumber && row.errors.length === 0);
	if (validRows.length === 0) {
		return NextResponse.json({ error: "No hay pólizas válidas para importar" }, { status: 400 });
	}

	const matchedRows = validRows.filter((row) => row.obraId);
	const unmatchedRows = validRows.filter((row) => !row.obraId);
	const obraIds = Array.from(new Set(matchedRows.map((row) => row.obraId as string)));
	const obraStates = obraIds.length > 0
		? await supabase
				.from("obras")
				.select("id, porcentaje")
				.eq("tenant_id", tenantId)
				.in("id", obraIds)
		: { data: [], error: null };
	if (obraStates.error) return NextResponse.json({ error: obraStates.error.message }, { status: 500 });
	const finishedObras = new Set(
		(obraStates.data ?? [])
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

	const upserts = matchedRows.map(buildUpsert);
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
		unmatchedImported = await persistUnmatchedInsurancePolicies(supabase, unmatchedRows.map(buildUpsert));
	} catch (unmatchedError) {
		const message = unmatchedError instanceof Error ? unmatchedError.message : "Error importando pólizas sin obra";
		return NextResponse.json({ error: message }, { status: 500 });
	}
	await syncInsuranceMacroRows(supabase, tenantId, obraIds);
	return NextResponse.json({ imported: (data?.length ?? 0) + unmatchedImported });
}
