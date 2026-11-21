import { z } from "zod";

const uuid = z.string().uuid();
const timestamp = z.string().datetime({ offset: true });
const identity = z.object({ extraction_id: uuid.optional().catch(undefined), extractionId: uuid.optional().catch(undefined) });
const auditValueFields = identity.extend({
	status: z.enum(["pending", "processing", "completed", "failed", "draft", "approved", "rejected", "active", "inactive"]).nullable().optional().catch(undefined),
	is_active: z.boolean().nullable().optional().catch(undefined),
	rows_extracted: z.number().int().nonnegative().nullable().optional().catch(undefined),
	retry_count: z.number().int().nonnegative().nullable().optional().catch(undefined),
	processing_duration_ms: z.number().finite().nonnegative().nullable().optional().catch(undefined),
	materialization_version: z.number().int().nonnegative().nullable().optional().catch(undefined),
});
const auditValues = z.record(z.unknown()).catch({}).transform((raw) => ({
	...auditValueFields.parse(raw),
	observedFieldCount: Object.keys(raw).length,
}));

export const TenantSchema = z.object({ id: uuid, name: z.string().max(500), created_at: timestamp });
export const MembershipSchema = z.object({ tenant_id: uuid, user_id: uuid, role: z.enum(["owner", "admin", "member"]), created_at: timestamp });
export const ProfileSchema = z.object({ user_id: uuid, full_name: z.string().max(500).nullable() });
export const AuditSchema = z.object({
	id: uuid, tenant_id: uuid, actor_id: uuid.nullable(),
	table_name: z.string().regex(/^[a-z][a-z0-9_]{0,80}$/),
	action: z.enum(["INSERT", "UPDATE", "DELETE"]),
	row_pk: z.object({ id: uuid.optional() }).catch({}),
	changed_keys: z.array(z.string()).nullable(),
	before_data: auditValues,
	after_data: auditValues,
	context: identity.catch({}),
	created_at: timestamp,
});
export const UsageSchema = z.object({
	id: uuid, tenant_id: uuid,
	kind: z.enum(["ai_tokens", "storage_bytes", "whatsapp_messages"]),
	amount: z.number().finite(),
	context: z.enum([
		"ocr_operation_started", "ocr_operation_completed", "ocr_operation_failed",
		"ocr_reservation", "ocr_reservation_multi", "ocr_reservation_rollback", "ocr_reservation_rollback_multi",
		"ocr_extraction_failed", "ocr_extraction_failed_multi", "ocr_reservation_rollback_failed", "ocr_reservation_rollback_multi_failed",
		"ocr_extraction_failed_failed", "ocr_extraction_failed_multi_failed",
		"ocr_import", "ocr_import_multi", "document-ai-chat", "sample_analysis",
		"ocr_source_upload", "ocr_source_upload_multi", "documents_upload", "company_files_upload", "whatsapp_document_upload",
		"documents_restore", "documents_soft_delete", "documents_soft_delete_rollback", "documents_manual_purge",
	]).nullable().catch(null),
	metadata: identity.extend({
		processingId: uuid.optional().catch(undefined), actorId: uuid.nullable().optional().catch(null),
		initiatorId: uuid.nullable().optional().catch(null),
		actorType: z.enum(["user", "demo", "system"]).optional().catch(undefined),
		obraId: uuid.optional().catch(undefined), tablaId: uuid.optional().catch(undefined), tablaIds: z.array(uuid).max(200).optional().catch(undefined),
		preview: z.boolean().optional().catch(true), durationMs: z.number().nonnegative().nullable().optional().catch(null),
		simulation: z.boolean().optional().catch(true), impersonation: z.boolean().nullable().optional().catch(null), test: z.boolean().optional().catch(true),
		rowsExtracted: z.number().int().nonnegative().nullable().optional().catch(null), errorCode: z.string().max(100).nullable().optional().catch(null),
		costUsd: z.number().finite().nonnegative().nullable().optional().catch(null),
	}).catch({}),
	created_at: timestamp,
});
export const OcrSchema = z.object({
	id: uuid, obra_id: uuid, tabla_id: uuid, extraction_id: uuid.nullable(),
	status: z.enum(["pending", "processing", "completed", "failed"]),
	rows_extracted: z.number().int().nonnegative().nullable(),
	processing_duration_ms: z.number().nonnegative().nullable(),
	error_code: z.string().nullable(),
	updated_at: timestamp,
	obras: z.object({ tenant_id: uuid }),
});

export type OperationsRecords = {
	tenants: z.infer<typeof TenantSchema>[];
	memberships: z.infer<typeof MembershipSchema>[];
	profiles: z.infer<typeof ProfileSchema>[];
	audit: z.infer<typeof AuditSchema>[];
	usage: z.infer<typeof UsageSchema>[];
	ocr: z.infer<typeof OcrSchema>[];
};
