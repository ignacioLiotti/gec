import { NextResponse } from "next/server";
import { resolveRequestAccessContext } from "@/lib/demo-session";
import { INSURANCE_POLICY_TABLE_NAME } from "@/lib/insurance-policies";

const MAX_LIMIT = 100;

function parsePositiveInt(value: string | null, fallback: number) {
	const parsed = Number.parseInt(value ?? "", 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function escapeLikeSearchTerm(value: string) {
	return value.replace(/[%_]/g, "\\$&");
}

function buildPolicyNumberSearchTerms(value: string) {
	const trimmed = value.trim();
	const terms = new Set<string>();
	if (trimmed) terms.add(trimmed);
	if (trimmed.includes("/")) {
		terms.add(trimmed.replace(/\s*\/\s*/g, "/"));
		terms.add(trimmed.replace(/\s*\/\s*/g, " / "));
	}
	return Array.from(terms).map(escapeLikeSearchTerm).filter(Boolean);
}

export async function GET(request: Request) {
	const access = await resolveRequestAccessContext();
	const { supabase, tenantId } = access;
	if (access.actorType === "anonymous") {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	if (!tenantId) return NextResponse.json({ policies: [] });
	const url = new URL(request.url);
	const returnAll = url.searchParams.get("all") === "1" || url.searchParams.get("all") === "true";
	const page = parsePositiveInt(url.searchParams.get("page"), 1);
	const limit = Math.min(MAX_LIMIT, parsePositiveInt(url.searchParams.get("limit"), 50));
	const search = url.searchParams.get("q")?.trim() ?? "";
	const policyFilter = url.searchParams.get("policies")?.trim() ?? "";
	const obraFilter = url.searchParams.get("obra")?.trim() ?? "";
	const sectionFilter = url.searchParams.get("section")?.trim() ?? "";
	const endDateFrom = url.searchParams.get("endDateFrom")?.trim() ?? "";
	const endDateTo = url.searchParams.get("endDateTo")?.trim() ?? "";
	const minInsuredAmount = Number(url.searchParams.get("minInsuredAmount") ?? 0);
	const minPremium = Number(url.searchParams.get("minPremium") ?? 0);
	const statusFilter = url.searchParams.get("status") ?? "all";
	const view = url.searchParams.get("view") ?? "imported";
	const orderBy = url.searchParams.get("orderBy") ?? "policy_number";
	const orderDir = url.searchParams.get("orderDir") === "desc" ? "desc" : "asc";
	const today = new Date();
	const todayIso = today.toISOString().slice(0, 10);
	const inSixtyDays = new Date(today);
	inSixtyDays.setDate(today.getDate() + 60);
	const inSixtyDaysIso = inSixtyDays.toISOString().slice(0, 10);
	const from = (page - 1) * limit;
	const to = from + limit - 1;
	const allowedOrderFields = new Set([
		"policy_number",
		"section",
		"coverage_period",
		"end_date",
		"insured_amount",
		"currency",
		"premium",
		"prize",
		"balance",
		"status",
		"risk",
		"insured_object",
		"calculated_cancellation_date",
		"is_cancelled",
	]);
	const sortField = allowedOrderFields.has(orderBy) ? orderBy : "policy_number";
	const shouldRequireObraJoin = view === "related" || obraFilter.length > 0;
	const obraSelect = shouldRequireObraJoin
		? "obras!inner(id, n, designacion_y_ubicacion, porcentaje, tenant_id, deleted_at)"
		: "obras(id, n, designacion_y_ubicacion, porcentaje, tenant_id, deleted_at)";
	if (url.searchParams.get("summary") === "1") {
		const { count: totalPolicies, error: totalError } = await supabase
			.from("insurance_policies")
			.select("id", { count: "exact", head: true })
			.eq("tenant_id", tenantId);
		if (totalError) return NextResponse.json({ error: totalError.message }, { status: 500 });

		let { data: policies, error: activeError } = await supabase
			.from("insurance_policies")
			.select("end_date, premium, prize, balance, is_cancelled, section, status, risk, insured_object, coverage_period, cancellation_requested_at, cancellation_confirmed_at")
			.eq("tenant_id", tenantId);
		if (activeError && /cancellation_requested_at|cancellation_confirmed_at/i.test(activeError.message)) {
			const fallback = await supabase
				.from("insurance_policies")
				.select("end_date, premium, prize, balance, is_cancelled, section, status, risk, insured_object, coverage_period")
				.eq("tenant_id", tenantId);
			policies = fallback.data?.map((policy) => ({
				...policy,
				cancellation_requested_at: null,
				cancellation_confirmed_at: null,
			})) ?? null;
			activeError = fallback.error;
		}
		if (activeError) return NextResponse.json({ error: activeError.message }, { status: 500 });

		const todayDate = new Date();
		const today = todayDate.toISOString().slice(0, 10);
		const warningDate = new Date(todayDate);
		warningDate.setDate(todayDate.getDate() + 15);
		const warningIso = warningDate.toISOString().slice(0, 10);
		let activePolicies = 0;
		let observedActiveAmount = 0;
		let observedBalance = 0;
		let finishedWithoutCancellation = 0;
		let finishedWithoutCancellationAmount = 0;
		let cancelledWithBalance = 0;
		let cancelledWithBalanceAmount = 0;
		let activeWithoutEndDate = 0;
		let creditSignal = 0;
		let creditSignalAmount = 0;
		let preventiveCancellationAlerts = 0;
		let preventiveCancellationAlertAmount = 0;
		let potentialOverbillingPolicies = 0;
		let potentialOverbillingAmount = 0;
		for (const policy of policies ?? []) {
			const premium = Number(policy.premium ?? 0) || 0;
			const prize = Number(policy.prize ?? 0) || 0;
			const balance = Number(policy.balance ?? 0) || 0;
			const observedAmount = premium || prize || balance || 0;
			const safeObservedAmount = Number.isFinite(observedAmount) ? observedAmount : 0;
			const safeBalance = Number.isFinite(balance) ? balance : 0;
			const policyText = [
				policy.section,
				policy.status,
				policy.risk,
				policy.insured_object,
				policy.coverage_period,
			].join(" ").toLowerCase();
			const isOfferMaintenance = policyText.includes("oferta");
			const hasCancellationWorkflow = Boolean(policy.cancellation_requested_at || policy.cancellation_confirmed_at);
			const hasPositiveObservedAmount = safeObservedAmount > 0 || safeBalance > 0;
			observedBalance += safeBalance;
			const hasCreditSignal = premium < 0 || prize < 0 || balance < 0;
			if (hasCreditSignal) {
				creditSignal += 1;
				creditSignalAmount += Math.min(premium, 0) + Math.min(prize, 0) + Math.min(balance, 0);
			}
			if (policy.is_cancelled) {
				if (safeBalance > 0) {
					cancelledWithBalance += 1;
					cancelledWithBalanceAmount += safeBalance;
				}
				continue;
			}
			activePolicies += 1;
			observedActiveAmount += safeObservedAmount;
			if (policy.end_date && policy.end_date.slice(0, 10) < today) {
				finishedWithoutCancellation += 1;
				finishedWithoutCancellationAmount += safeObservedAmount;
				if (!hasCreditSignal && !isOfferMaintenance && !hasCancellationWorkflow) {
					potentialOverbillingPolicies += 1;
					potentialOverbillingAmount += hasPositiveObservedAmount
						? Math.max(safeObservedAmount, safeBalance, 0)
						: 0;
				}
			} else if (policy.end_date && policy.end_date.slice(0, 10) <= warningIso && !hasCreditSignal && !isOfferMaintenance && !hasCancellationWorkflow) {
				preventiveCancellationAlerts += 1;
				preventiveCancellationAlertAmount += Math.max(safeObservedAmount, safeBalance, 0);
			}
			if (!policy.end_date) {
				activeWithoutEndDate += 1;
			}
		}

		return NextResponse.json({
			summary: {
				totalPolicies: totalPolicies ?? 0,
				activePolicies,
				currentExpense: observedActiveAmount,
				finishedWithoutCancellation,
				finishedWithoutCancellationExpense: finishedWithoutCancellationAmount,
				observedActiveAmount,
				observedBalance,
				activeExpiredAmount: finishedWithoutCancellationAmount,
				cancelledWithBalance,
				cancelledWithBalanceAmount,
				activeWithoutEndDate,
				creditSignal,
				creditSignalAmount,
				preventiveCancellationAlerts,
				preventiveCancellationAlertAmount,
				potentialOverbillingPolicies,
				potentialOverbillingAmount,
			},
			permissions: {
				canDeleteAllPolicies: access.isSuperAdmin === true,
			},
		});
	}

	const selectWithRuleConfiguration = `
			id,
			tenant_id,
			obra_id,
			import_obra_label,
			import_match_status,
			policy_number,
			section,
			coverage_period,
			end_date,
			insured_amount,
			currency,
			premium,
			prize,
			balance,
			status,
			risk,
			insured_object,
			cancellation_rule_type,
			cancellation_rule_offset,
			cancellation_rule_configured,
			obra_finished_at,
			definitive_reception_date,
			cancellation_requested_at,
			cancellation_confirmed_at,
			cancellation_notes,
			calculated_cancellation_date,
			is_cancelled,
			cancelled_at,
			last_notified_at,
			${obraSelect}
		`;
	const selectLegacy = `
			id,
			tenant_id,
			obra_id,
			import_obra_label,
			import_match_status,
			policy_number,
			section,
			coverage_period,
			end_date,
			insured_amount,
			currency,
			premium,
			prize,
			balance,
			status,
			risk,
			insured_object,
			cancellation_rule_type,
			cancellation_rule_offset,
			obra_finished_at,
			definitive_reception_date,
			cancellation_requested_at,
			cancellation_confirmed_at,
			cancellation_notes,
			calculated_cancellation_date,
			is_cancelled,
			cancelled_at,
			last_notified_at,
			${obraSelect}
		`;
	const selectMinimal = `
			id,
			tenant_id,
			obra_id,
			policy_number,
			section,
			coverage_period,
			end_date,
			insured_amount,
			currency,
			premium,
			prize,
			balance,
			status,
			risk,
			insured_object,
			cancellation_rule_type,
			cancellation_rule_offset,
			obra_finished_at,
			calculated_cancellation_date,
			is_cancelled,
			cancelled_at,
			last_notified_at,
			${obraSelect}
		`;
	const query = (select: string) => {
		let baseQuery = supabase
			.from("insurance_policies")
			.select(select)
			.eq("tenant_id", tenantId)
			.order(sortField, { ascending: orderDir === "asc" });

		if (shouldRequireObraJoin) {
			baseQuery = baseQuery
				.eq("obras.tenant_id", tenantId)
				.is("obras.deleted_at", null);
		}

		return baseQuery;
	};

	const applyFilters = (baseQuery: ReturnType<typeof query>) => {
		let nextQuery = baseQuery;
		if (statusFilter === "active") nextQuery = nextQuery.eq("is_cancelled", false);
		if (statusFilter === "cancelled") nextQuery = nextQuery.eq("is_cancelled", true);
		if (statusFilter === "expired") {
			nextQuery = nextQuery
				.eq("is_cancelled", false)
				.lt("calculated_cancellation_date", todayIso);
		}
		if (statusFilter === "dueSoon") {
			nextQuery = nextQuery
				.eq("is_cancelled", false)
				.gte("calculated_cancellation_date", todayIso)
				.lte("calculated_cancellation_date", inSixtyDaysIso);
		}
		if (view === "related") nextQuery = nextQuery.gte("obras.porcentaje", 100);
		if (policyFilter) {
			const policyTerms = policyFilter
				.split(",")
				.flatMap((item) => buildPolicyNumberSearchTerms(item))
				.filter(Boolean);
			if (policyTerms.length > 0) {
				nextQuery = nextQuery.or(
					policyTerms.map((term) => `policy_number.ilike.%${term}%`).join(",")
				);
			}
		}
		if (obraFilter) {
			nextQuery = nextQuery.ilike(
				"obras.designacion_y_ubicacion",
				`%${obraFilter.replace(/[%_]/g, "\\$&")}%`
			);
		}
		if (sectionFilter) {
			nextQuery = nextQuery.ilike("section", `%${sectionFilter.replace(/[%_]/g, "\\$&")}%`);
		}
		if (endDateFrom) nextQuery = nextQuery.gte("end_date", endDateFrom);
		if (endDateTo) nextQuery = nextQuery.lte("end_date", endDateTo);
		if (Number.isFinite(minInsuredAmount) && minInsuredAmount > 0) {
			nextQuery = nextQuery.gte("insured_amount", minInsuredAmount);
		}
		if (Number.isFinite(minPremium) && minPremium > 0) {
			nextQuery = nextQuery.or(
				`premium.gte.${minPremium},prize.gte.${minPremium},balance.gte.${minPremium}`
			);
		}
		if (search) {
			const escaped = escapeLikeSearchTerm(search);
			const policyTerms = buildPolicyNumberSearchTerms(search);
			nextQuery = nextQuery.or(
				[
					...policyTerms.map((term) => `policy_number.ilike.%${term}%`),
					`section.ilike.%${escaped}%`,
					`coverage_period.ilike.%${escaped}%`,
					`import_obra_label.ilike.%${escaped}%`,
					`status.ilike.%${escaped}%`,
					`risk.ilike.%${escaped}%`,
					`insured_object.ilike.%${escaped}%`,
				].join(",")
			);
		}
		return nextQuery;
	};

	const finalizeQuery = (baseQuery: ReturnType<typeof query>) => {
		if (returnAll) return baseQuery;
		return baseQuery.range(from, to);
	};

	const primary = await finalizeQuery(applyFilters(query(selectWithRuleConfiguration)));
	let data = primary.data as unknown[] | null;
	let error = primary.error;
	if (error && /cancellation_rule_configured|definitive_reception_date|cancellation_requested_at|cancellation_confirmed_at|cancellation_notes/i.test(error.message)) {
		const fallback = await finalizeQuery(applyFilters(query(selectLegacy)));
		const fallbackData = fallback.data as unknown[] | null;
		data = fallbackData?.map((policy) => ({
			...(policy as Record<string, unknown>),
			cancellation_rule_configured: false,
			definitive_reception_date: null,
			cancellation_requested_at: null,
			cancellation_confirmed_at: null,
			cancellation_notes: null,
		})) ?? null;
		error = fallback.error;
	}
	if (error && /import_obra_label|import_match_status|cancellation_rule_configured|definitive_reception_date|cancellation_requested_at|cancellation_confirmed_at|cancellation_notes/i.test(error.message)) {
		const fallback = await finalizeQuery(applyFilters(query(selectMinimal)));
		const fallbackData = fallback.data as unknown[] | null;
		data = fallbackData?.map((policy) => ({
			...(policy as Record<string, unknown>),
			import_obra_label: null,
			import_match_status: "matched",
			cancellation_rule_configured: false,
			definitive_reception_date: null,
			cancellation_requested_at: null,
			cancellation_confirmed_at: null,
			cancellation_notes: null,
		})) ?? null;
		error = fallback.error;
	}
	if (error) return NextResponse.json({ error: error.message }, { status: 500 });
	const loadedCount = data?.length ?? 0;
	const total = returnAll ? loadedCount : from + loadedCount + (loadedCount === limit ? 1 : 0);
	const responseLimit = returnAll ? total : limit;
	const totalPages = returnAll ? 1 : Math.max(1, Math.ceil(total / limit));
	return NextResponse.json({
		policies: data ?? [],
		pagination: {
			page: returnAll ? 1 : page,
			limit: responseLimit,
			total,
			totalPages,
			hasNextPage: returnAll ? false : page < totalPages,
			hasPreviousPage: returnAll ? false : page > 1,
		},
	});
}

export async function DELETE() {
	const access = await resolveRequestAccessContext();
	const { supabase, tenantId } = access;
	if (access.actorType === "anonymous") {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });
	if (access.isSuperAdmin !== true) {
		return NextResponse.json({ error: "Solo superadmins pueden borrar todas las polizas" }, { status: 403 });
	}

	const { data: obraRows, error: obrasError } = await supabase
		.from("obras")
		.select("id")
		.eq("tenant_id", tenantId)
		.is("deleted_at", null);
	if (obrasError) return NextResponse.json({ error: obrasError.message }, { status: 500 });

	const obraIds = (obraRows ?? []).map((obra) => obra.id as string);
	if (obraIds.length > 0) {
		const { data: tablas, error: tablasError } = await supabase
			.from("obra_tablas")
			.select("id")
			.in("obra_id", obraIds)
			.eq("name", INSURANCE_POLICY_TABLE_NAME);
		if (tablasError) return NextResponse.json({ error: tablasError.message }, { status: 500 });

		const tablaIds = (tablas ?? []).map((tabla) => tabla.id as string);
		if (tablaIds.length > 0) {
			const { error: rowsError } = await supabase
				.from("obra_tabla_rows")
				.delete()
				.eq("source", "insurance_import")
				.in("tabla_id", tablaIds);
			if (rowsError) return NextResponse.json({ error: rowsError.message }, { status: 500 });
		}
	}

	const { error } = await supabase
		.from("insurance_policies")
		.delete()
		.eq("tenant_id", tenantId);
	if (error) return NextResponse.json({ error: error.message }, { status: 500 });

	return NextResponse.json({ ok: true });
}
