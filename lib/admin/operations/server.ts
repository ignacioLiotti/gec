"use server";

import { z } from "zod";
import { getUserRoles } from "@/lib/route-guard";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { ApiValidationError } from "@/lib/http/validation";
import { loadOperationsRecoveryStatus } from "@/lib/operations-recovery";
import { AuditSchema, MembershipSchema, OcrSchema, ProfileSchema, TenantSchema, UsageSchema } from "./records";
import { projectOperationsSnapshot } from "./project";
import { observationWindow, parseOperationsSelection } from "./selection";
import type { OperationsSelection, OperationsSnapshot, SourceName, SourceStatus } from "./types";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;
const PAGE_SIZE = 250;
const EVENT_LIMIT = 1000;

async function readSource<T>({ name, period, schema, fetchPage, limit, coverage }: {
	name: SourceName;
	period: SourceStatus["period"];
	schema: z.ZodType<T, z.ZodTypeDef, unknown>;
	fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>;
	limit: number;
	coverage: string;
}): Promise<{ rows: T[]; source: SourceStatus }> {
	const rows: T[] = [];
	let invalid = false;
	let truncated = false;
	let failed = false;
	for (let offset = 0; offset <= limit; offset += PAGE_SIZE) {
		try {
			const take = Math.min(PAGE_SIZE, limit + 1 - offset);
			const result = await fetchPage(offset, offset + take - 1);
			if (result.error || !Array.isArray(result.data)) { failed = true; break; }
			for (const [index, item] of result.data.entries()) {
				if (offset + index >= limit) { truncated = true; break; }
				const parsed = schema.safeParse(item);
				if (parsed.success) rows.push(parsed.data); else invalid = true;
			}
			if (result.data.length < take || truncated) break;
		} catch { failed = true; break; }
	}
	return { rows, source: { name, period, status: failed && !rows.length ? "unavailable" : failed || invalid || truncated ? "partial" : "available", rows: rows.length, truncated, coverage } };
}

async function loadPeriod(admin: AdminClient, tenantIds: string[], period: "current" | "previous", start: string, end: string) {
	const [audit, usage, ocr] = await Promise.all([
		readSource({ name: "audit", period, schema: AuditSchema, limit: EVENT_LIMIT, coverage: "Cambios de filas auditadas; cobertura de triggers e identidad no verificada.",
			fetchPage: (from, to) => admin.from("audit_log").select("id,tenant_id,actor_id,table_name,row_pk,action,changed_keys,before_data,after_data,context,created_at").in("tenant_id", tenantIds).gte("created_at", start).lt("created_at", end).order("created_at", { ascending: false }).order("id").range(from, to) }),
		readSource({ name: "usage", period, schema: UsageSchema, limit: EVENT_LIMIT, coverage: "Ajustes de consumo y observaciones OCR; registro best effort, sin garantía de captura completa.",
			fetchPage: (from, to) => admin.from("tenant_usage_events").select("id,tenant_id,kind,amount,context,metadata,created_at").in("tenant_id", tenantIds).gte("created_at", start).lt("created_at", end).order("created_at", { ascending: false }).order("id").range(from, to) }),
		readSource({ name: "ocr", period, schema: OcrSchema, limit: EVENT_LIMIT, coverage: "Último estado mutable de documentos actualizado en el período; no es historial de todas las ejecuciones.",
			fetchPage: (from, to) => admin.from("ocr_document_processing").select("id,obra_id,tabla_id,extraction_id,status,rows_extracted,processing_duration_ms,error_code,updated_at,obras!inner(tenant_id)").in("obras.tenant_id", tenantIds).gte("updated_at", start).lt("updated_at", end).order("updated_at", { ascending: false }).order("id").range(from, to) }),
	]);
	return { audit, usage, ocr };
}

export async function loadOperationsSnapshot(input: OperationsSelection): Promise<OperationsSnapshot> {
	// Effective roles include permission simulation; limit-management exceptions do not grant access.
	const roles = await getUserRoles();
	if (!roles.isSuperAdmin) throw new ApiValidationError("Acceso restringido a superadministradores", [], 403);
	const params = new URLSearchParams({ days: String(input.days) });
	if (input.tenantId !== null) params.set("tenantId", input.tenantId);
	const selection = parseOperationsSelection(params);
	const now = new Date();
	const window = observationWindow(selection.days, now);
	const admin = createSupabaseAdminClient();
	const backup = await loadOperationsRecoveryStatus();
	const tenants = await readSource({ name: "tenants", period: "inventory", schema: TenantSchema, limit: 200, coverage: "Inventario limitado a 200 tenants; seleccionar un ID permite consultar un tenant fuera de la muestra.",
		fetchPage: (from, to) => {
			const query = admin.from("tenants").select("id,name,created_at").order("created_at", { ascending: false }).order("id").range(from, to);
			return selection.tenantId ? query.eq("id", selection.tenantId) : query;
		} });
	if (selection.tenantId && tenants.source.status === "available" && tenants.rows.length === 0) throw new ApiValidationError("Tenant no encontrado", [], 404);
	const tenantIds = tenants.rows.map((tenant) => tenant.id);
	if (!tenantIds.length) {
		return { ...projectOperationsSnapshot({ selection, now, sources: [tenants.source], records: { tenants: [], memberships: [], profiles: [], audit: [], usage: [], ocr: [] } }), backup };
	}
	const [memberships, current, previous] = await Promise.all([
		readSource({ name: "memberships", period: "inventory", schema: MembershipSchema, limit: EVENT_LIMIT, coverage: "Membresías actuales; no reconstruye elegibilidad histórica.",
			fetchPage: (from, to) => admin.from("memberships").select("tenant_id,user_id,role,created_at").in("tenant_id", tenantIds).order("tenant_id").order("user_id").range(from, to) }),
		loadPeriod(admin, tenantIds, "current", window.start, window.liveEnd),
		loadPeriod(admin, tenantIds, "previous", window.previousStart, window.start),
	]);
	const observedPeopleIds = [...new Set([...memberships.rows.map((member) => member.user_id), ...current.audit.rows.flatMap((row) => row.actor_id ? [row.actor_id] : []), ...previous.audit.rows.flatMap((row) => row.actor_id ? [row.actor_id] : []), ...current.usage.rows.flatMap((row) => row.metadata.actorId ? [row.metadata.actorId] : []), ...previous.usage.rows.flatMap((row) => row.metadata.actorId ? [row.metadata.actorId] : [])])];
	const peopleIds = observedPeopleIds.slice(0, 1000);
	const profileBatches = await Promise.all(Array.from({ length: Math.ceil(peopleIds.length / 100) }, (_, index) => {
		const batchIds = peopleIds.slice(index * 100, (index + 1) * 100);
		return readSource({ name: "profiles", period: "inventory", schema: ProfileSchema, limit: 100, coverage: "Nombres de miembros y actores observados; perfiles faltantes se muestran por ID.",
			fetchPage: (from, to) => admin.from("profiles").select("user_id,full_name").in("user_id", batchIds).order("user_id").range(from, to) });
	}));
	const profileRows = profileBatches.flatMap((batch) => batch.rows);
	const profileSource: SourceStatus = {
		name: "profiles", period: "inventory", rows: profileRows.length, truncated: observedPeopleIds.length > peopleIds.length,
		status: profileBatches.length && profileBatches.every((batch) => batch.source.status === "unavailable") ? "unavailable" : observedPeopleIds.length > peopleIds.length || profileBatches.some((batch) => batch.source.status !== "available") ? "partial" : "available",
		coverage: "Hasta 1000 nombres de miembros y actores observados; perfiles faltantes se muestran por ID.",
	};
	return { ...projectOperationsSnapshot({ selection, now,
		sources: [tenants.source, memberships.source, profileSource, current.audit.source, current.usage.source, current.ocr.source, previous.audit.source, previous.usage.source, previous.ocr.source],
		records: { tenants: tenants.rows, memberships: memberships.rows, profiles: profileRows, audit: [...current.audit.rows, ...previous.audit.rows], usage: [...current.usage.rows, ...previous.usage.rows], ocr: [...current.ocr.rows, ...previous.ocr.rows] },
	}), backup };
}
