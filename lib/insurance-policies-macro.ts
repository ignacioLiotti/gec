import type { SupabaseClient } from "@supabase/supabase-js";
import {
	INSURANCE_POLICY_COLUMNS,
	INSURANCE_POLICY_MACRO_NAME,
	INSURANCE_POLICY_TABLE_NAME,
	buildInsurancePolicyRowData,
} from "@/lib/insurance-policies";

type SupabaseLike = Pick<SupabaseClient, "from">;

async function ensureInsuranceMacroTable(supabase: SupabaseLike, tenantId: string) {
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
		const { error: updateError } = await supabase
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
		if (updateError) throw updateError;
	}

	const { data: existingColumns, error: columnsError } = await supabase
		.from("macro_table_columns")
		.select("source_field_key")
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

async function ensureInsuranceTablaForObra(supabase: SupabaseLike, obraId: string) {
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
				settings: { domain: "insurance_policies", hideFromDocuments: true },
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

export async function syncInsurancePoliciesToMacroTable({
	supabase,
	tenantId,
	obraIds,
}: {
	supabase: SupabaseLike;
	tenantId: string;
	obraIds: string[];
}) {
	await ensureInsuranceMacroTable(supabase, tenantId);
	for (const obraId of [...new Set(obraIds)]) {
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
