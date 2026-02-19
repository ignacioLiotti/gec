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
			// Prefer LATAM/AR format (dd/mm/yyyy). Only fall back to mm/dd when dd/mm is impossible.
			const ddFirstValid = a >= 1 && a <= 31 && b >= 1 && b <= 12;
			const mmFirstValid = a >= 1 && a <= 12 && b >= 1 && b <= 31;
			if (ddFirstValid) {
				const ddFirst = new Date(Date.UTC(year, b - 1, a));
				if (!Number.isNaN(ddFirst.getTime())) return ddFirst;
			}
			if (mmFirstValid) {
				const mmFirst = new Date(Date.UTC(year, a - 1, b));
				if (!Number.isNaN(mmFirst.getTime())) return mmFirst;
			}
			return null;
		}
		const parsed = new Date(trimmed);
		return Number.isNaN(parsed.getTime()) ? null : parsed;
	}
	return null;
}

function normalizeText(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.trim();
}

function toPeriodKey(value: Date): string {
	const year = value.getUTCFullYear();
	const month = String(value.getUTCMonth() + 1).padStart(2, "0");
	return `${year}-${month}`;
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

function addMonthsToPeriodKey(
	startPeriod: string,
	offset: number,
): string | null {
	const start = startPeriod.match(/^(\d{4})-(\d{2})$/);
	if (!start) return null;
	const year = Number(start[1]);
	const month = Number(start[2]) - 1;
	if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
	const date = new Date(Date.UTC(year, month + offset, 1));
	return Number.isNaN(date.getTime()) ? null : toPeriodKey(date);
}

function periodKeyFromCurveRow(
	rowData: Record<string, any> | null | undefined,
	startPeriod?: string,
): string | null {
	const rawPeriodo =
		rowData?.periodo ?? rowData?.periodo_key ?? rowData?.period ?? rowData?.mes;
	if (typeof rawPeriodo === "string") {
		const normalized = normalizeText(rawPeriodo);
		const mesN = normalized.match(/mes\s*(\d{1,3})/);
		if (mesN && startPeriod) {
			const offset = Number(mesN[1]);
			if (Number.isFinite(offset)) {
				const period = addMonthsToPeriodKey(startPeriod, offset);
				if (period) return period;
			}
		}
		const dateFromPeriodo = parseDate(rawPeriodo);
		if (dateFromPeriodo) return toPeriodKey(dateFromPeriodo);
	}

	const rawFecha =
		rowData?.fecha_certificacion ??
		rowData?.fecha ??
		rowData?.issued_at ??
		rowData?.date;
	const dateFromFecha = parseDate(rawFecha);
	if (dateFromFecha) return toPeriodKey(dateFromFecha);
	return null;
}

function firstDefinedValue(
	rowData: Record<string, any> | null | undefined,
	keys: string[],
) {
	if (!rowData) return undefined;
	for (const key of keys) {
		const value = rowData[key];
		if (value !== undefined && value !== null && String(value).trim() !== "") {
			return value;
		}
	}
	return undefined;
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

async function loadRuleConfigForTenant(
	supabase: SupabaseClient,
	tenantId: string,
	obraId: string,
): Promise<RuleConfig> {
	const { data } = await supabase
		.from("obra_rule_config")
		.select("config_json")
		.eq("tenant_id", tenantId)
		.eq("obra_id", obraId)
		.maybeSingle();

	const stored = ((data?.config_json ?? {}) as Partial<RuleConfig>) ?? {};
	return {
		...DEFAULT_RULE_CONFIG,
		...stored,
		enabledPacks: {
			...DEFAULT_RULE_CONFIG.enabledPacks,
			...(stored.enabledPacks ?? {}),
		},
		mappings: {
			...DEFAULT_RULE_CONFIG.mappings,
			...(stored.mappings ?? {}),
		},
		thresholds: {
			...DEFAULT_RULE_CONFIG.thresholds,
			...(stored.thresholds ?? {}),
			curve: {
				...DEFAULT_RULE_CONFIG.thresholds.curve,
				...(stored.thresholds?.curve ?? {}),
			},
			unpaidCerts: {
				...DEFAULT_RULE_CONFIG.thresholds.unpaidCerts,
				...(stored.thresholds?.unpaidCerts ?? {}),
			},
			inactivity: {
				...DEFAULT_RULE_CONFIG.thresholds.inactivity,
				...(stored.thresholds?.inactivity ?? {}),
			},
			monthlyMissingCert: {
				...DEFAULT_RULE_CONFIG.thresholds.monthlyMissingCert,
				...(stored.thresholds?.monthlyMissingCert ?? {}),
			},
			stageStalled: {
				...DEFAULT_RULE_CONFIG.thresholds.stageStalled,
				...(stored.thresholds?.stageStalled ?? {}),
			},
		},
	} as RuleConfig;
}

async function loadSignalsSnapshotForTenant(
	supabase: SupabaseClient,
	tenantId: string,
	obraId: string,
	periodKey?: string,
): Promise<SignalRow[]> {
	const { data } = await supabase
		.from("obra_signals")
		.select("signal_key,value_num,value_bool,value_json,computed_at")
		.eq("tenant_id", tenantId)
		.eq("obra_id", obraId)
		.eq("period_key", periodKey ?? null);

	return (data ?? []) as SignalRow[];
}

async function loadFindingsForTenant(
	supabase: SupabaseClient,
	tenantId: string,
	obraId: string,
	periodKey?: string,
): Promise<FindingRow[]> {
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
	return loadRuleConfigForTenant(supabase, tenantId, obraId);
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
	Array<{
		id: string;
		data: Record<string, any>;
		created_at: string;
		updated_at: string;
	}>
> {
	const { data } = await supabase
		.from("obra_tabla_rows")
		.select("id,data,created_at,updated_at")
		.eq("tabla_id", tablaId);

	return (data ?? []) as Array<{
		id: string;
		data: Record<string, any>;
		created_at: string;
		updated_at: string;
	}>;
}

export async function recomputeSignals(obraId: string, periodKey?: string) {
	const supabase = await createClient();
	const { data: auth } = await supabase.auth.getUser();
	if (!auth.user) throw new Error("Unauthorized");

	const tenantId = await resolveTenantId(supabase, auth.user.id, obraId);
	if (!tenantId) throw new Error("No tenant");

	const config = await loadRuleConfigForTenant(supabase, tenantId, obraId);
	const rowsByTabla = new Map<
		string,
		Promise<
			Array<{
				id: string;
				data: Record<string, any>;
				created_at: string;
				updated_at: string;
			}>
		>
	>();
	const getRows = (tablaId: string) => {
		let promise = rowsByTabla.get(tablaId);
		if (!promise) {
			promise = fetchRows(supabase, tablaId);
			rowsByTabla.set(tablaId, promise);
		}
		return promise;
	};

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
	const currentPeriodKey = periodKey ?? toPeriodKey(new Date());

	// Curve pack
	if (config.enabledPacks.curve) {
		const curve = config.mappings.curve;
		const curveMeasurementTableId =
			curve?.resumenTableId ?? curve?.measurementTableId;
		if (curveMeasurementTableId && curve?.actualPctColumnKey) {
			const rows = await getRows(curveMeasurementTableId);
			const normalizedRows = rows
				.map((row) => ({
					row,
					value: (() => {
						const parsed = parseNumber(row.data?.[curve.actualPctColumnKey ?? ""]);
						if (parsed == null) return null;
						return Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
					})(),
					period: periodKeyFromCurveRow(
						(row.data as Record<string, any>) ?? null,
						curve.plan?.startPeriod,
					),
				}))
				.filter((r) => r.value != null);

			let actualPct: number | null = null;
			let actualSource: "period_match" | "max_value" | "latest_created" | "none" =
				"none";
			let actualPeriodUsed: string | null = null;
			let actualRowId: string | null = null;

			const withPeriod = normalizedRows.filter(
				(r): r is typeof r & { period: string } => typeof r.period === "string",
			);
			const derivedStartPeriod =
				withPeriod.length > 0
					? [...withPeriod]
						.map((r) => r.period)
						.sort((a, b) => a.localeCompare(b))[0]
					: null;
			if (withPeriod.length > 0) {
				const ranked = withPeriod
					.map((r) => ({
						...r,
						diff: periodKey
							? monthsDiff(r.period, periodKey)
							: monthsDiff(r.period, currentPeriodKey),
					}))
					.filter((r) => r.diff != null && r.diff >= 0)
					.sort((a, b) => (a.diff as number) - (b.diff as number));
				if (ranked.length > 0) {
					actualPct = ranked[0].value;
					actualSource = "period_match";
					actualPeriodUsed = ranked[0].period;
					actualRowId = ranked[0].row.id;
				}
			}

			if (actualPct == null && normalizedRows.length > 0) {
				const maxValueRow = normalizedRows.reduce((best, current) => {
					if (!best) return current;
					return (current.value as number) > (best.value as number)
						? current
						: best;
				}, null as (typeof normalizedRows)[number] | null);
				if (maxValueRow) {
					actualPct = maxValueRow.value;
					actualSource = "max_value";
					actualPeriodUsed = maxValueRow.period ?? null;
					actualRowId = maxValueRow.row.id;
				}
			}

			if (actualPct == null && normalizedRows.length > 0) {
				const latestCreated = [...normalizedRows].sort(
					(a, b) =>
						new Date(b.row.created_at).getTime() -
						new Date(a.row.created_at).getTime(),
				)[0];
				actualPct = latestCreated?.value ?? null;
				if (actualPct != null) {
					actualSource = "latest_created";
					actualPeriodUsed = latestCreated?.period ?? null;
					actualRowId = latestCreated?.row.id ?? null;
				}
			}

			let planPct: number | null = null;
			let planSource: "plan_table_period_match" | "linear" | "none" = "none";
			let planStartPeriodUsed: string | null = null;
			const targetPeriod = periodKey ?? currentPeriodKey;

			if (curve?.planTableId) {
				const planRows = await getRows(curve.planTableId);
				const normalizedPlanRows = planRows
					.map((row) => {
						const rowData = (row.data as Record<string, any>) ?? null;
						const parsed = parseNumber(
							firstDefinedValue(rowData, [
								"avance_acumulado_pct",
								"avance_acum_pct",
								"avance_plan_acumulado_pct",
								"plan_acumulado_pct",
							]),
						);
						if (parsed == null) return null;
						return {
							row,
							value: Math.abs(parsed) <= 1 ? parsed * 100 : parsed,
							period: periodKeyFromCurveRow(rowData, curve.plan?.startPeriod),
						};
					})
					.filter(
						(r): r is { row: any; value: number; period: string | null } =>
							r != null,
					);

				const rankedPlan = normalizedPlanRows
					.filter(
						(r): r is typeof r & { period: string } => typeof r.period === "string",
					)
					.map((r) => ({ ...r, diff: monthsDiff(r.period, targetPeriod) }))
					.filter((r) => r.diff != null && r.diff >= 0)
					.sort((a, b) => (a.diff as number) - (b.diff as number));

				if (rankedPlan.length > 0) {
					planPct = rankedPlan[0].value;
					planSource = "plan_table_period_match";
					planStartPeriodUsed = rankedPlan[0].period;
				}
			}

			if (planPct == null && curve.plan?.mode === "linear" && curve.plan.months) {
				const startPeriod =
					derivedStartPeriod ?? curve.plan.startPeriod ?? targetPeriod;
				const diff = monthsDiff(startPeriod, targetPeriod);
				const monthIndex = diff != null ? diff + 1 : 1;
				planPct = Math.min(100, (monthIndex / curve.plan.months) * 100);
				planSource = "linear";
				planStartPeriodUsed = startPeriod;
			}

			const delta =
				actualPct != null && planPct != null ? actualPct - planPct : null;

				signals.push(
					{
						signal_key: "progress.actual_pct",
						value_num: actualPct,
						value_bool: null,
						value_json: {
							source: actualSource,
							periodKey: actualPeriodUsed,
							rowId: actualRowId,
						},
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
							tableId: curveMeasurementTableId,
							columnKey: curve.actualPctColumnKey,
						},
						outputs_json: {
							actualPct,
							source: actualSource,
							rowsConsidered: normalizedRows.length,
						},
					},
					{
						signal_key: "progress.plan_pct",
						inputs_json: { plan: curve.plan, periodKey },
						outputs_json: {
							planPct,
							source: planSource,
							planTableId: curve?.planTableId ?? null,
							startPeriodSource:
								planSource === "linear"
									? derivedStartPeriod
										? "derived_from_measurements"
										: curve.plan?.startPeriod
											? "configured"
											: "target_fallback"
									: "plan_table",
							startPeriodUsed: planStartPeriodUsed,
						},
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
			const rows = await getRows(unpaid.certTableId);
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

	// Missing monthly certificate (historical continuity check)
	if (config.enabledPacks.monthlyMissingCert) {
		const mapping = config.mappings.monthlyMissingCert ?? {};
		const certTableId =
			mapping.certTableId ??
			config.mappings.unpaidCerts?.certTableId ??
			config.mappings.inactivity?.certTableId;
		const certIssuedAtColumnKey =
			mapping.certIssuedAtColumnKey ??
			config.mappings.unpaidCerts?.issuedAtColumnKey ??
			config.mappings.inactivity?.certIssuedAtColumnKey;

		if (certTableId && certIssuedAtColumnKey) {
			const rows = await getRows(certTableId);
			const monthlyCounts = new Map<string, number>();

			for (const row of rows) {
				const issuedAt = parseDate(row.data?.[certIssuedAtColumnKey]);
				if (!issuedAt) continue;
				const key = toPeriodKey(issuedAt);
				monthlyCounts.set(key, (monthlyCounts.get(key) ?? 0) + 1);
			}

			const currentMonthCount = monthlyCounts.get(currentPeriodKey) ?? 0;
			const historicalMonthsCount = Array.from(monthlyCounts.keys()).filter(
				(monthKey) => monthKey < currentPeriodKey,
			).length;
			const missingCurrentMonth =
				historicalMonthsCount > 0 && currentMonthCount === 0;

			signals.push(
				{
					signal_key: "cert.current_month_count",
					value_num: currentMonthCount,
					value_bool: null,
					value_json: null,
				},
				{
					signal_key: "cert.historical_months_count",
					value_num: historicalMonthsCount,
					value_bool: null,
					value_json: null,
				},
				{
					signal_key: "cert.missing_current_month",
					value_num: null,
					value_bool: missingCurrentMonth,
					value_json: { periodKey: currentPeriodKey },
				},
			);
			logs.push(
				{
					signal_key: "cert.current_month_count",
					inputs_json: { certTableId, certIssuedAtColumnKey, periodKey: currentPeriodKey },
					outputs_json: { currentMonthCount },
				},
				{
					signal_key: "cert.historical_months_count",
					inputs_json: { periodKey: currentPeriodKey },
					outputs_json: { historicalMonthsCount },
				},
				{
					signal_key: "cert.missing_current_month",
					inputs_json: { currentPeriodKey, historicalMonthsCount, currentMonthCount },
					outputs_json: { missingCurrentMonth },
				},
			);
		}
	}

	// Stalled stage by location keyword (e.g. Tesoreria)
	if (config.enabledPacks.stageStalled) {
		const stalled = config.mappings.stageStalled;
		if (stalled?.stageTableId && stalled.locationColumnKey) {
			const rows = await getRows(stalled.stageTableId);
			const keyword = normalizeText(stalled.keyword ?? "tesoreria");
			const thresholdWeeks = stalled.weeks ?? 2;
			const thresholdDays = thresholdWeeks * 7;
			const now = new Date();

			let stalledCount = 0;
			let oldestStalledDays: number | null = null;

			for (const row of rows) {
				const rawLocation = row.data?.[stalled.locationColumnKey];
				if (typeof rawLocation !== "string") continue;
				if (!normalizeText(rawLocation).includes(keyword)) continue;

				const since =
					parseDate(
						stalled.stageSinceColumnKey
							? row.data?.[stalled.stageSinceColumnKey]
							: null,
					) ??
					parseDate(row.updated_at) ??
					parseDate(row.created_at);
				if (!since) continue;

				const days = Math.floor(
					(now.getTime() - since.getTime()) / (1000 * 60 * 60 * 24),
				);
				if (days < thresholdDays) continue;

				stalledCount += 1;
				oldestStalledDays =
					oldestStalledDays == null ? days : Math.max(oldestStalledDays, days);
			}

			signals.push(
				{
					signal_key: "stage.stalled_count",
					value_num: stalledCount,
					value_bool: null,
					value_json: { keyword: stalled.keyword ?? "tesorería", thresholdWeeks },
				},
				{
					signal_key: "stage.stalled_oldest_days",
					value_num: oldestStalledDays,
					value_bool: null,
					value_json: null,
				},
			);
			logs.push(
				{
					signal_key: "stage.stalled_count",
					inputs_json: {
						tableId: stalled.stageTableId,
						locationColumnKey: stalled.locationColumnKey,
						stageSinceColumnKey: stalled.stageSinceColumnKey ?? null,
						keyword: stalled.keyword ?? "tesorería",
						thresholdWeeks,
					},
					outputs_json: { stalledCount },
				},
				{
					signal_key: "stage.stalled_oldest_days",
					inputs_json: { thresholdWeeks },
					outputs_json: { oldestStalledDays },
				},
			);
		}
	}

	// Inactivity
	if (config.enabledPacks.inactivity) {
		const inactive = config.mappings.inactivity ?? {};
		const inactivityMeasurementTableId =
			inactive.measurementTableId ??
			config.mappings.curve?.resumenTableId ??
			config.mappings.curve?.measurementTableId;
		const inactivityMeasurementDateColumnKey =
			inactive.measurementDateColumnKey ??
			(config.mappings.curve?.actualPctColumnKey
				? "fecha_certificacion"
				: undefined);
		const inactivityCertTableId =
			inactive.certTableId ??
			config.mappings.monthlyMissingCert?.certTableId ??
			config.mappings.unpaidCerts?.certTableId;
		const inactivityCertIssuedAtColumnKey =
			inactive.certIssuedAtColumnKey ??
			config.mappings.monthlyMissingCert?.certIssuedAtColumnKey ??
			config.mappings.unpaidCerts?.issuedAtColumnKey ??
			"fecha_certificacion";
		const now = new Date();

		let lastMeasurement: Date | null = null;
		let lastCertificate: Date | null = null;

		if (inactivityMeasurementTableId && inactivityMeasurementDateColumnKey) {
			const rows = await getRows(inactivityMeasurementTableId);
			for (const row of rows) {
				const dt = parseDate(row.data?.[inactivityMeasurementDateColumnKey]);
				if (!dt) continue;
				if (!lastMeasurement || dt > lastMeasurement) lastMeasurement = dt;
			}
		}

		if (inactivityCertTableId && inactivityCertIssuedAtColumnKey) {
			const rows = await getRows(inactivityCertTableId);
			for (const row of rows) {
				const dt = parseDate(row.data?.[inactivityCertIssuedAtColumnKey]);
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
							tableId: inactivityCertTableId ?? null,
							columnKey: inactivityCertIssuedAtColumnKey ?? null,
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

	const snapshot = await loadSignalsSnapshotForTenant(
		supabase,
		tenantId,
		obraId,
		periodKey,
	);
	return { snapshot, runId, logs };
}

export async function getSignalsSnapshot(obraId: string, periodKey?: string) {
	const supabase = await createClient();
	const { data: auth } = await supabase.auth.getUser();
	if (!auth.user) return [] as SignalRow[];

	const tenantId = await resolveTenantId(supabase, auth.user.id, obraId);
	if (!tenantId) return [] as SignalRow[];
	return loadSignalsSnapshotForTenant(supabase, tenantId, obraId, periodKey);
}

export async function evaluateFindings(obraId: string, periodKey?: string) {
	const supabase = await createClient();
	const { data: auth } = await supabase.auth.getUser();
	if (!auth.user) throw new Error("Unauthorized");

	const tenantId = await resolveTenantId(supabase, auth.user.id, obraId);
	if (!tenantId) throw new Error("No tenant");

	const config = await loadRuleConfigForTenant(supabase, tenantId, obraId);
	const signals = await loadSignalsSnapshotForTenant(
		supabase,
		tenantId,
		obraId,
		periodKey,
	);
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
				title: "Certificado facturado no cobrado",
				message: `Hay ${count} certificados facturados no cobrados por más de ${config.mappings.unpaidCerts?.days ?? 90} días.`,
				evidence_json: { count },
			});
		}
	}

	if (config.enabledPacks.monthlyMissingCert) {
		const missingCurrentMonth =
			signalMap.get("cert.missing_current_month")?.value_bool ?? false;
		const period =
			(signalMap.get("cert.missing_current_month")?.value_json as any)?.periodKey ??
			periodKey ??
			toPeriodKey(new Date());
		if (missingCurrentMonth) {
			findings.push({
				rule_key: "cert.missing_current_month",
				severity: config.thresholds.monthlyMissingCert.severity,
				title: "Falta certificado del mes actual",
				message: `Se detectaron certificados en meses anteriores pero falta el certificado del período ${period}.`,
				evidence_json: { period },
			});
		}
	}

	if (config.enabledPacks.inactivity) {
		const inactiveDays =
			signalMap.get("activity.inactive_days")?.value_num ?? null;
		const threshold =
			config.mappings.inactivity?.days ??
			(config.mappings.inactivity?.months != null
				? config.mappings.inactivity.months * 30
				: 90);
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

	if (config.enabledPacks.stageStalled) {
		const stalledCount = signalMap.get("stage.stalled_count")?.value_num ?? 0;
		if (stalledCount > 0) {
			const details = signalMap.get("stage.stalled_count")?.value_json as any;
			findings.push({
				rule_key: "stage.stalled",
				severity: config.thresholds.stageStalled.severity,
				title: "Expediente detenido en etapa",
				message: `${stalledCount} registros permanecen en "${details?.keyword ?? "tesorería"}" por más de ${details?.thresholdWeeks ?? 2} semanas.`,
				evidence_json: { stalledCount, ...details },
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

	return loadFindingsForTenant(supabase, tenantId, obraId, periodKey);
}

export async function listFindings(obraId: string, periodKey?: string) {
	const supabase = await createClient();
	const { data: auth } = await supabase.auth.getUser();
	if (!auth.user) return [] as FindingRow[];

	const tenantId = await resolveTenantId(supabase, auth.user.id, obraId);
	if (!tenantId) return [] as FindingRow[];
	return loadFindingsForTenant(supabase, tenantId, obraId, periodKey);
}

export { getDefaultRuleConfig };
