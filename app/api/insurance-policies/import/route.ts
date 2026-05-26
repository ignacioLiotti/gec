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
			.select("*")
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
	const validRows = rows.filter((row) => row.obraId && row.policyNumber && row.errors.length === 0);
	if (validRows.length === 0) {
		return NextResponse.json({ error: "No hay pólizas válidas para importar" }, { status: 400 });
	}

	const obraIds = Array.from(new Set(validRows.map((row) => row.obraId as string)));
	const { data: obraStates, error: stateError } = await supabase
		.from("obras")
		.select("id, porcentaje")
		.eq("tenant_id", tenantId)
		.in("id", obraIds);
	if (stateError) return NextResponse.json({ error: stateError.message }, { status: 500 });
	const finishedObras = new Set(
		(obraStates ?? [])
			.filter((obra: ObraImportStateRow) => Number(obra.porcentaje ?? 0) >= 100)
			.map((obra: ObraImportStateRow) => obra.id),
	);
	const today = new Date().toISOString().slice(0, 10);

	const upserts = validRows.map((row) => {
		const obraFinishedAt = finishedObras.has(row.obraId as string) ? today : null;
		return {
			tenant_id: tenantId,
			obra_id: row.obraId,
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
			obra_finished_at: obraFinishedAt,
			calculated_cancellation_date: calculateCancellationDate(
				obraFinishedAt,
				row.cancellationRuleType,
				row.cancellationRuleOffset,
			),
			is_cancelled: row.isCancelled,
			cancelled_at: row.isCancelled ? new Date().toISOString() : null,
			cancelled_by: row.isCancelled ? user.id : null,
		};
	});

	const { data, error } = await supabase
		.from("insurance_policies")
		.upsert(upserts, { onConflict: "tenant_id,obra_id,policy_number" })
		.select("id");
	if (error) return NextResponse.json({ error: error.message }, { status: 500 });
	await syncInsuranceMacroRows(supabase, tenantId, obraIds);
	return NextResponse.json({ imported: data?.length ?? 0 });
}
