import { createClient } from "@/utils/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
	ReportTable,
	ReportTableColumn,
	RuleConfig,
	SignalRow,
	FindingRow,
} from "./types";
import { DEFAULT_RULE_CONFIG, getDefaultRuleConfig } from "./defaults";

function parseNumber(value: unknown): number | null {
	if (value == null) return null;
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (typeof value === "string") {
		const cleaned = value
			.replace(/\s/g, "")
			.replace(/\./g, "")
			.replace(/,/g, ".")
			.replace(/[^0-9.-]/g, "");
		const parsed = Number(cleaned);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

function parseBool(value: unknown): boolean | null {
	if (typeof value === "boolean") return value;
	if (typeof value === "string") {
		const v = value.trim().toLowerCase();
		if (["true", "1", "si", "sí", "yes"].includes(v)) return true;
		if (["false", "0", "no", "inactivo", "pendiente"].includes(v))
			return false;
	}
	if (typeof value === "number") return value !== 0;
	return null;
}

function parseDate(value: unknown): Date | null {
	if (!value) return null;
	if (value instanceof Date)
		return Number.isNaN(value.getTime()) ? null : value;
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed) return null;
		if (/^mm\/dd\/yyyy$/i.test(trimmed)) return null;
		const ymMatch = trimmed.match(/^(\d{4})-(\d{2})$/);
		if (ymMatch) {
			const year = Number(ymMatch[1]);
			const month = Number(ymMatch[2]) - 1;
			const date = new Date(Date.UTC(year, month, 1));
			return Number.isNaN(date.getTime()) ? null : date;
		}
		const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
		if (slashMatch) {
			const a = Number(slashMatch[1]);
			const b = Number(slashMatch[2]);
			const year = Number(slashMatch[3]);
			const mmFirst = new Date(Date.UTC(year, a - 1, b));
			if (!Number.isNaN(mmFirst.getTime()) && a >= 1 && a <= 12) {
				return mmFirst;
			}
			const ddFirst = new Date(Date.UTC(year, b - 1, a));
			return Number.isNaN(ddFirst.getTime()) ? null : ddFirst;
		}
		const parsed = new Date(trimmed);
		return Number.isNaN(parsed.getTime()) ? null : parsed;
	}
	return null;
}

function monthsDiff(startPeriod: string, currentPeriod: string): number | null {
	const start = startPeriod.match(/^(\d{4})-(\d{2})$/);
	const curr = currentPeriod.match(/^(\d{4})-(\d{2})$/);
	if (!start || !curr) return null;
	const startYear = Number(start[1]);
	const startMonth = Number(start[2]);
	const currYear = Number(curr[1]);
	const currMonth = Number(curr[2]);
	return (currYear - startYear) * 12 + (currMonth - startMonth);
}

async function resolveTenantId(
	supabase: SupabaseClient,
	userId: string,
	obraId: string,
) {
	const { data: obraRow } = await supabase
		.from("obras")
		.select("tenant_id")
		.eq("id", obraId)
		.maybeSingle();
	const tenantId = (obraRow as any)?.tenant_id as string | undefined;
	if (!tenantId) return null;

	const { data: membership } = await supabase
		.from("memberships")
		.select("tenant_id")
		.eq("tenant_id", tenantId)
		.eq("user_id", userId)
		.maybeSingle();

	return membership?.tenant_id ?? null;
}

export async function getObraTables(obraId: string) {
	const supabase = await createClient();
	const { data: auth } = await supabase.auth.getUser();
	if (!auth.user) return [] as ReportTable[];

	const { data: tablaRows } = await supabase
		.from("obra_tablas")
		.select("id,name,source_type")
		.eq("obra_id", obraId)
		.order("name");

	const tablaIds = (tablaRows ?? []).map((t: any) => t.id);

	const { data: columnRows } = tablaIds.length
		? await supabase
				.from("obra_tabla_columns")
				.select("tabla_id,field_key,label,data_type")
				.in("tabla_id", tablaIds)
				.order("position")
		: { data: [] as any[] };

	const columnsByTabla = new Map<string, ReportTableColumn[]>();
	for (const col of columnRows ?? []) {
		const list = columnsByTabla.get(col.tabla_id) ?? [];
		list.push({
			key: col.field_key,
			label: col.label,
			type: col.data_type,
		});
		columnsByTabla.set(col.tabla_id, list);
	}

	const obraTables: ReportTable[] = (tablaRows ?? []).map((t: any) => ({
		id: t.id,
		name: t.name,
		sourceType: t.source_type,
		columns: columnsByTabla.get(t.id) ?? [],
	}));

	// Only return tables that actually exist for this obra (defaults are applied into obra_tablas)
	return obraTables;
}

export async function getRuleConfig(obraId: string) {
	const supabase = await createClient();
	const { data: auth } = await supabase.auth.getUser();
	if (!auth.user) return DEFAULT_RULE_CONFIG;

	const tenantId = await resolveTenantId(supabase, auth.user.id, obraId);
	if (!tenantId) return DEFAULT_RULE_CONFIG;

	const { data } = await supabase
		.from("obra_rule_config")
		.select("config_json")
		.eq("tenant_id", tenantId)
		.eq("obra_id", obraId)
		.maybeSingle();

	return {
		...DEFAULT_RULE_CONFIG,
		...(data?.config_json ?? {}),
	} as RuleConfig;
}

export async function saveRuleConfig(obraId: string, config: RuleConfig) {
	const supabase = await createClient();
	const { data: auth } = await supabase.auth.getUser();
	if (!auth.user) throw new Error("Unauthorized");

	const tenantId = await resolveTenantId(supabase, auth.user.id, obraId);
	if (!tenantId) throw new Error("No tenant");

	const { error } = await supabase.from("obra_rule_config").upsert({
		tenant_id: tenantId,
		obra_id: obraId,
		config_json: config,
		updated_at: new Date().toISOString(),
	});

	if (error) throw error;
}

async function fetchRows(
	supabase: SupabaseClient,
	tablaId: string,
): Promise<
	Array<{ id: string; data: Record<string, any>; created_at: string }>
> {
	const { data } = await supabase
		.from("obra_tabla_rows")
		.select("id,data,created_at")
		.eq("tabla_id", tablaId);

	return (data ?? []) as Array<{
		id: string;
		data: Record<string, any>;
		created_at: string;
	}>;
}

export async function recomputeSignals(obraId: string, periodKey?: string) {
	const supabase = await createClient();
	const { data: auth } = await supabase.auth.getUser();
	if (!auth.user) throw new Error("Unauthorized");

	const tenantId = await resolveTenantId(supabase, auth.user.id, obraId);
	if (!tenantId) throw new Error("No tenant");

	const config = await getRuleConfig(obraId);

	const signals: Array<{
		signal_key: string;
		value_num: number | null;
		value_bool: boolean | null;
		value_json: any;
	}> = [];
	const logs: Array<{
		signal_key: string;
		inputs_json: any;
		outputs_json: any;
	}> = [];

	// Curve pack
	if (config.enabledPacks.curve) {
		const curve = config.mappings.curve;
		if (curve?.measurementTableId && curve.actualPctColumnKey) {
			const rows = await fetchRows(supabase, curve.measurementTableId);
			const lastRow = rows
				.map((row) => ({
					row,
					value: parseNumber(row.data?.[curve.actualPctColumnKey ?? ""]),
				}))
				.filter((r) => r.value != null)
				.sort(
					(a, b) =>
						new Date(b.row.created_at).getTime() -
						new Date(a.row.created_at).getTime(),
				)[0];
			const actualPct = lastRow?.value ?? null;

			let planPct: number | null = null;
			if (curve.plan?.mode === "linear" && curve.plan.months) {
				if (periodKey) {
					const startPeriod = curve.plan.startPeriod ?? periodKey;
					const diff = monthsDiff(startPeriod, periodKey);
					const monthIndex = diff != null ? diff + 1 : 1;
					planPct = Math.min(100, (monthIndex / curve.plan.months) * 100);
				}
			}

			const delta =
				actualPct != null && planPct != null ? actualPct - planPct : null;

			signals.push(
				{
					signal_key: "progress.actual_pct",
					value_num: actualPct,
					value_bool: null,
					value_json: null,
				},
				{
					signal_key: "progress.plan_pct",
					value_num: planPct,
					value_bool: null,
					value_json: null,
				},
				{
					signal_key: "progress.delta_pct",
					value_num: delta,
					value_bool: null,
					value_json: null,
				},
			);
			logs.push(
				{
					signal_key: "progress.actual_pct",
					inputs_json: {
						tableId: curve.measurementTableId,
						columnKey: curve.actualPctColumnKey,
					},
					outputs_json: { actualPct },
				},
				{
					signal_key: "progress.plan_pct",
					inputs_json: { plan: curve.plan, periodKey },
					outputs_json: { planPct },
				},
				{
					signal_key: "progress.delta_pct",
					inputs_json: { actualPct, planPct },
					outputs_json: { delta },
				},
			);
		}
	}

	// Unpaid certificates
	if (config.enabledPacks.unpaidCerts) {
		const unpaid = config.mappings.unpaidCerts;
		if (
			unpaid?.certTableId &&
			unpaid.issuedAtColumnKey &&
			unpaid.paidBoolColumnKey
		) {
			const rows = await fetchRows(supabase, unpaid.certTableId);
			const thresholdDays = unpaid.days ?? 90;
			const now = new Date();
			let count = 0;
			let amount = 0;
			let oldestDays: number | null = null;

			for (const row of rows) {
				const paid = parseBool(row.data?.[unpaid.paidBoolColumnKey]);
				if (paid) continue;
				const issuedAt = parseDate(row.data?.[unpaid.issuedAtColumnKey]);
				if (!issuedAt) continue;
				const days = Math.floor(
					(now.getTime() - issuedAt.getTime()) / (1000 * 60 * 60 * 24),
				);
				if (days < thresholdDays) continue;
				count += 1;
				if (unpaid.amountColumnKey) {
					amount += parseNumber(row.data?.[unpaid.amountColumnKey]) ?? 0;
				}
				oldestDays = oldestDays == null ? days : Math.max(oldestDays, days);
			}

			signals.push(
				{
					signal_key: "cert.unpaid_over_days_count",
					value_num: count,
					value_bool: null,
					value_json: null,
				},
				{
					signal_key: "cert.unpaid_over_days_amount",
					value_num: unpaid.amountColumnKey ? amount : null,
					value_bool: null,
					value_json: null,
				},
				{
					signal_key: "cert.oldest_unpaid_days",
					value_num: oldestDays,
					value_bool: null,
					value_json: null,
				},
			);
			logs.push(
				{
					signal_key: "cert.unpaid_over_days_count",
					inputs_json: {
						tableId: unpaid.certTableId,
						issuedAtColumnKey: unpaid.issuedAtColumnKey,
						paidBoolColumnKey: unpaid.paidBoolColumnKey,
						thresholdDays,
					},
					outputs_json: { count },
				},
				{
					signal_key: "cert.unpaid_over_days_amount",
					inputs_json: {
						tableId: unpaid.certTableId,
						amountColumnKey: unpaid.amountColumnKey,
					},
					outputs_json: {
						amount: unpaid.amountColumnKey ? amount : null,
					},
				},
				{
					signal_key: "cert.oldest_unpaid_days",
					inputs_json: { thresholdDays },
					outputs_json: { oldestDays },
				},
			);
		}
	}

	// Inactivity
	if (config.enabledPacks.inactivity) {
		const inactive = config.mappings.inactivity;
		const now = new Date();

		let lastMeasurement: Date | null = null;
		let lastCertificate: Date | null = null;

		if (inactive?.measurementTableId && inactive.measurementDateColumnKey) {
			const rows = await fetchRows(supabase, inactive.measurementTableId);
			for (const row of rows) {
				const dt = parseDate(row.data?.[inactive.measurementDateColumnKey]);
				if (!dt) continue;
				if (!lastMeasurement || dt > lastMeasurement) lastMeasurement = dt;
			}
		}

		if (inactive?.certTableId && inactive.certIssuedAtColumnKey) {
			const rows = await fetchRows(supabase, inactive.certTableId);
			for (const row of rows) {
				const dt = parseDate(row.data?.[inactive.certIssuedAtColumnKey]);
				if (!dt) continue;
				if (!lastCertificate || dt > lastCertificate) lastCertificate = dt;
			}
		}

		const lastActivity =
			lastMeasurement && lastCertificate
				? lastMeasurement > lastCertificate
					? lastMeasurement
					: lastCertificate
				: (lastMeasurement ?? lastCertificate);

		const inactiveDays = lastActivity
			? Math.floor(
					(now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24),
				)
			: null;

		signals.push(
			{
				signal_key: "activity.last_measurement_at",
				value_num: null,
				value_bool: null,
				value_json: lastMeasurement?.toISOString() ?? null,
			},
			{
				signal_key: "activity.last_certificate_at",
				value_num: null,
				value_bool: null,
				value_json: lastCertificate?.toISOString() ?? null,
			},
			{
				signal_key: "activity.last_activity_at",
				value_num: null,
				value_bool: null,
				value_json: lastActivity?.toISOString() ?? null,
			},
			{
				signal_key: "activity.inactive_days",
				value_num: inactiveDays,
				value_bool: null,
				value_json: null,
			},
		);
		logs.push(
			{
				signal_key: "activity.last_measurement_at",
				inputs_json: {
					tableId: inactive?.measurementTableId,
					columnKey: inactive?.measurementDateColumnKey,
				},
				outputs_json: { lastMeasurement: lastMeasurement?.toISOString() ?? null },
			},
			{
				signal_key: "activity.last_certificate_at",
				inputs_json: {
					tableId: inactive?.certTableId,
					columnKey: inactive?.certIssuedAtColumnKey,
				},
				outputs_json: { lastCertificate: lastCertificate?.toISOString() ?? null },
			},
			{
				signal_key: "activity.last_activity_at",
				inputs_json: {
					lastMeasurement: lastMeasurement?.toISOString() ?? null,
					lastCertificate: lastCertificate?.toISOString() ?? null,
				},
				outputs_json: { lastActivity: lastActivity?.toISOString() ?? null },
			},
			{
				signal_key: "activity.inactive_days",
				inputs_json: { lastActivity: lastActivity?.toISOString() ?? null },
				outputs_json: { inactiveDays },
			},
		);
	}

	const computedAt = new Date().toISOString();
	const upserts = signals.map((signal) => ({
		tenant_id: tenantId,
		obra_id: obraId,
		period_key: periodKey ?? null,
		signal_key: signal.signal_key,
		value_num: signal.value_num,
		value_bool: signal.value_bool,
		value_json: signal.value_json,
		computed_at: computedAt,
	}));

	if (upserts.length > 0) {
		const { error } = await supabase
			.from("obra_signals")
			.upsert(upserts, {
				onConflict: "tenant_id,obra_id,period_key,signal_key",
			});
		if (error) throw error;
	}

	const { data: runRow } = await supabase
		.from("obra_signal_runs")
		.insert({
			tenant_id: tenantId,
			obra_id: obraId,
			period_key: periodKey ?? null,
		})
		.select("id")
		.single();
	const runId = (runRow as any)?.id as string | undefined;
	if (runId && logs.length > 0) {
		const { error: logError } = await supabase
			.from("obra_signal_logs")
			.insert(
				logs.map((log) => ({
					run_id: runId,
					tenant_id: tenantId,
					obra_id: obraId,
					period_key: periodKey ?? null,
					signal_key: log.signal_key,
					inputs_json: log.inputs_json,
					outputs_json: log.outputs_json,
					computed_at: computedAt,
				})),
			);
		if (logError) throw logError;
	}

	const snapshot = await getSignalsSnapshot(obraId, periodKey);
	return { snapshot, runId, logs };
}

export async function getSignalsSnapshot(obraId: string, periodKey?: string) {
	const supabase = await createClient();
	const { data: auth } = await supabase.auth.getUser();
	if (!auth.user) return [] as SignalRow[];

	const tenantId = await resolveTenantId(supabase, auth.user.id, obraId);
	if (!tenantId) return [] as SignalRow[];

	const { data } = await supabase
		.from("obra_signals")
		.select("signal_key,value_num,value_bool,value_json,computed_at")
		.eq("tenant_id", tenantId)
		.eq("obra_id", obraId)
		.eq("period_key", periodKey ?? null);

	return (data ?? []) as SignalRow[];
}

export async function evaluateFindings(obraId: string, periodKey?: string) {
	const supabase = await createClient();
	const { data: auth } = await supabase.auth.getUser();
	if (!auth.user) throw new Error("Unauthorized");

	const tenantId = await resolveTenantId(supabase, auth.user.id, obraId);
	if (!tenantId) throw new Error("No tenant");

	const config = await getRuleConfig(obraId);
	const signals = await getSignalsSnapshot(obraId, periodKey);
	const signalMap = new Map(signals.map((s) => [s.signal_key, s]));

	const findings: Array<{
		rule_key: string;
		severity: "info" | "warn" | "critical";
		title: string;
		message: string;
		evidence_json: any;
	}> = [];

	if (config.enabledPacks.curve) {
		const delta = signalMap.get("progress.delta_pct")?.value_num ?? null;
		if (delta != null) {
			if (delta < -config.thresholds.curve.criticalBelow) {
				findings.push({
					rule_key: "curve.delta_critical",
					severity: "critical",
					title: "Desvío crítico en curva",
					message: `El avance está ${Math.abs(delta).toFixed(1)} puntos por debajo del plan.`,
					evidence_json: { delta },
				});
			} else if (delta < -config.thresholds.curve.warnBelow) {
				findings.push({
					rule_key: "curve.delta_warn",
					severity: "warn",
					title: "Desvío en curva",
					message: `El avance está ${Math.abs(delta).toFixed(1)} puntos por debajo del plan.`,
					evidence_json: { delta },
				});
			}
		}
	}

	if (config.enabledPacks.unpaidCerts) {
		const count = signalMap.get("cert.unpaid_over_days_count")?.value_num ?? 0;
		if (count > 0) {
			findings.push({
				rule_key: "cert.unpaid_over_days",
				severity: config.thresholds.unpaidCerts.severity,
				title: "Certificados impagos",
				message: `Hay ${count} certificados impagos por más de ${config.mappings.unpaidCerts?.days ?? 90} días.`,
				evidence_json: { count },
			});
		}
	}

	if (config.enabledPacks.inactivity) {
		const inactiveDays =
			signalMap.get("activity.inactive_days")?.value_num ?? null;
		const threshold = config.mappings.inactivity?.days ?? 90;
		if (inactiveDays != null && inactiveDays > threshold) {
			findings.push({
				rule_key: "activity.inactive",
				severity: config.thresholds.inactivity.severity,
				title: "Obra inactiva",
				message: `No se registró actividad en ${inactiveDays} días.`,
				evidence_json: { inactiveDays },
			});
		}
	}

	await supabase
		.from("obra_findings")
		.delete()
		.eq("tenant_id", tenantId)
		.eq("obra_id", obraId)
		.eq("period_key", periodKey ?? null)
		.eq("status", "open");

	if (findings.length > 0) {
		const { error } = await supabase.from("obra_findings").insert(
			findings.map((f) => ({
				tenant_id: tenantId,
				obra_id: obraId,
				period_key: periodKey ?? null,
				rule_key: f.rule_key,
				severity: f.severity,
				title: f.title,
				message: f.message,
				evidence_json: f.evidence_json,
				status: "open",
				created_at: new Date().toISOString(),
			})),
		);
		if (error) throw error;
	}

	return listFindings(obraId, periodKey);
}

export async function listFindings(obraId: string, periodKey?: string) {
	const supabase = await createClient();
	const { data: auth } = await supabase.auth.getUser();
	if (!auth.user) return [] as FindingRow[];

	const tenantId = await resolveTenantId(supabase, auth.user.id, obraId);
	if (!tenantId) return [] as FindingRow[];

	const { data } = await supabase
		.from("obra_findings")
		.select(
			"id,rule_key,severity,title,message,evidence_json,status,created_at",
		)
		.eq("tenant_id", tenantId)
		.eq("obra_id", obraId)
		.eq("period_key", periodKey ?? null)
		.order("created_at", { ascending: false });

	return (data ?? []) as FindingRow[];
}

export { getDefaultRuleConfig };
