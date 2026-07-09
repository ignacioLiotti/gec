/**
 * Lineage Row Key derivation — the stable business identity of extracted rows.
 *
 * `row.id` is a mutable materialization id: reimporting a document may create
 * new rows. `lineage_row_key` is what survives, so macro-table overrides,
 * calculations, and audit trails keep pointing at the same business entity
 * across reimports (ADR 0001, ADR 0002).
 *
 * Identity strategy, in priority order (see CONTEXT.md "Regla canonica de
 * identidad y lineage de fila extraida"):
 *   1. explicit business key declared by the document template
 *   2. structural derivation (file + normalized-content fingerprints
 *      + table identity + item logical key)
 *   3. deterministic positional fallback (position is never the primary
 *      identity outside this fallback)
 *
 * When two rows in one import collapse to the same key, this module throws
 * `LineageReconciliationConflictError` (stable code
 * `LINEAGE_RECONCILIATION_CONFLICT`) instead of silently re-binding —
 * ambiguity must surface to the user, never be guessed away.
 */
import { createHash } from "node:crypto";

type LineageColumnMeta = {
	fieldKey: string;
	config?: Record<string, unknown>;
};

type DeriveLineageRowKeysArgs = {
	tableIdentity: string;
	parentData: Record<string, unknown>;
	itemRows: Array<Record<string, unknown>>;
	parentColumns: LineageColumnMeta[];
	itemColumns: LineageColumnMeta[];
	fileFingerprint: string | null;
	contentFingerprintNormalized: string | null;
	disableStructuralFallback?: boolean;
};

type DuplicateLineageConflict = {
	lineageRowKey: string;
	rowPositions: number[];
};

export class LineageReconciliationConflictError extends Error {
	code = "LINEAGE_RECONCILIATION_CONFLICT" as const;
	context: {
		tableIdentity: string;
		duplicates: DuplicateLineageConflict[];
	};

	constructor(message: string, context: LineageReconciliationConflictError["context"]) {
		super(message);
		this.name = "LineageReconciliationConflictError";
		this.context = context;
	}
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeWhitespace(value: string) {
	return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeScalar(value: unknown): string | number | boolean | null {
	if (value == null) return null;
	if (typeof value === "string") {
		const normalized = normalizeWhitespace(value);
		return normalized.length > 0 ? normalized : null;
	}
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null;
	}
	if (typeof value === "boolean") {
		return value;
	}
	if (value instanceof Date) {
		return value.toISOString();
	}
	return normalizeWhitespace(String(value));
}

function compactLineageValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		const normalizedItems = value
			.map((item) => compactLineageValue(item))
			.filter((item) => item != null);
		return normalizedItems.length > 0 ? normalizedItems : null;
	}

	if (isPlainObject(value)) {
		const entries = Object.entries(value)
			.map(([key, nestedValue]) => [key, compactLineageValue(nestedValue)] as const)
			.filter(([, nestedValue]) => nestedValue != null)
			.sort(([left], [right]) => left.localeCompare(right));
		if (entries.length === 0) return null;
		return Object.fromEntries(entries);
	}

	return normalizeScalar(value);
}

function stableStringify(value: unknown): string {
	const normalized = compactLineageValue(value);
	return JSON.stringify(normalized ?? null);
}

function hashCanonical(value: unknown) {
	return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function compactRecord(record: Record<string, unknown>) {
	return (compactLineageValue(record) as Record<string, unknown> | null) ?? {};
}

function hasExplicitBusinessKey(config: Record<string, unknown> | undefined) {
	return (
		config?.lineageKey === true ||
		config?.businessKey === true ||
		config?.identityKey === true
	);
}

function buildBusinessKeySource({
	parentData,
	itemData,
	parentColumns,
	itemColumns,
}: {
	parentData: Record<string, unknown>;
	itemData: Record<string, unknown>;
	parentColumns: LineageColumnMeta[];
	itemColumns: LineageColumnMeta[];
}) {
	const parts: Array<{ fieldKey: string; value: unknown }> = [];

	for (const column of [...parentColumns, ...itemColumns]) {
		if (!hasExplicitBusinessKey(column.config)) continue;
		const value =
			column.fieldKey in itemData ? itemData[column.fieldKey] : parentData[column.fieldKey];
		const normalized = compactLineageValue(value);
		if (normalized == null) continue;
		parts.push({ fieldKey: column.fieldKey, value: normalized });
	}

	return parts.length > 0 ? parts : null;
}

function buildFallbackLineageRowKey({
	tableIdentity,
	parentData,
	itemData,
	itemPosition,
	fileFingerprint,
	contentFingerprintNormalized,
}: {
	tableIdentity: string;
	parentData: Record<string, unknown>;
	itemData: Record<string, unknown>;
	itemPosition: number;
	fileFingerprint: string | null;
	contentFingerprintNormalized: string | null;
}) {
	return `pos:${hashCanonical({
		tableIdentity,
		itemPosition,
		fileFingerprint,
		contentFingerprintNormalized,
		parentData: compactRecord(parentData),
		itemData: compactRecord(itemData),
	})}`;
}

export function computeFileFingerprint(input: ArrayBuffer | Uint8Array | Buffer) {
	const bytes =
		input instanceof Uint8Array ? input : input instanceof ArrayBuffer ? new Uint8Array(input) : input;
	return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function buildContentFingerprintSource({
	parentData,
	itemRows,
}: {
	parentData: Record<string, unknown>;
	itemRows: Array<Record<string, unknown>>;
}) {
	const parent = compactRecord(parentData);
	const items = itemRows
		.map((item) => compactRecord(item))
		.filter((item) => Object.keys(item).length > 0)
		.sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));

	return { parent, items };
}

export function computeContentFingerprintNormalized(value: unknown) {
	const normalized = compactLineageValue(value);
	if (normalized == null) return null;
	return `sha256:${createHash("sha256").update(JSON.stringify(normalized)).digest("hex")}`;
}

export function deriveLineageRowKeys({
	tableIdentity,
	parentData,
	itemRows,
	parentColumns,
	itemColumns,
	fileFingerprint,
	contentFingerprintNormalized,
	disableStructuralFallback = false,
}: DeriveLineageRowKeysArgs) {
	const provisionalKeys = itemRows.map((itemData, itemPosition) => {
		const businessKey = buildBusinessKeySource({
			parentData,
			itemData,
			parentColumns,
			itemColumns,
		});

		if (businessKey) {
			return {
				key: `biz:${hashCanonical({ tableIdentity, businessKey })}`,
				mode: "business" as const,
			};
		}

		const logicalKey = {
			parent: compactRecord(parentData),
			item: compactRecord(itemData),
		};
		const hasLogicalKey =
			Object.keys(logicalKey.parent).length > 0 || Object.keys(logicalKey.item).length > 0;

		if (!disableStructuralFallback && contentFingerprintNormalized && hasLogicalKey) {
			return {
				key: `struct:${hashCanonical({
					tableIdentity,
					contentFingerprintNormalized,
					logicalKey,
				})}`,
				mode: "struct" as const,
			};
		}

		return {
			key: buildFallbackLineageRowKey({
				tableIdentity,
				parentData,
				itemData,
				itemPosition,
				fileFingerprint,
				contentFingerprintNormalized,
			}),
			mode: "position" as const,
		};
	});

	const keyCounts = new Map<string, number>();
	for (const provisional of provisionalKeys) {
		keyCounts.set(provisional.key, (keyCounts.get(provisional.key) ?? 0) + 1);
	}

	const finalKeys = provisionalKeys.map((provisional, itemPosition) => {
		if ((keyCounts.get(provisional.key) ?? 0) <= 1) {
			return provisional.key;
		}

		return buildFallbackLineageRowKey({
			tableIdentity,
			parentData,
			itemData: itemRows[itemPosition] ?? {},
			itemPosition,
			fileFingerprint,
			contentFingerprintNormalized,
		});
	});

	const duplicateMap = new Map<string, number[]>();
	for (const [index, lineageRowKey] of finalKeys.entries()) {
		const positions = duplicateMap.get(lineageRowKey) ?? [];
		positions.push(index);
		duplicateMap.set(lineageRowKey, positions);
	}

	const duplicates = [...duplicateMap.entries()]
		.filter(([, positions]) => positions.length > 1)
		.map(([lineageRowKey, positions]) => ({
			lineageRowKey,
			rowPositions: positions,
		}));

	if (duplicates.length > 0) {
		throw new LineageReconciliationConflictError(
			"No se pudo reconciliar la identidad estable de una o más filas.",
			{
				tableIdentity,
				duplicates,
			},
		);
	}

	return finalKeys;
}
