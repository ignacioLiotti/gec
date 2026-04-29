import { NextResponse } from "next/server";

import {
	hasDemoCapability,
	resolveRequestAccessContext,
} from "@/lib/demo-session";

type RouteContext = { params: Promise<{ id: string }> };

type SupportStatus = "implemented" | "partial" | "planned" | "not_supported";

type GraphNode = {
	id: string;
	type:
		| "document"
		| "extraction"
		| "table"
		| "row"
		| "macro_table"
		| "override"
		| "event";
	label: string;
	status: string;
	supportStatus: SupportStatus;
	data: Record<string, unknown>;
};

type GraphEdge = {
	id: string;
	source: string;
	target: string;
	type: string;
	label?: string;
};

type GraphOverrideRecord = {
	id: string;
	macro_table_id: string;
	source_row_id: string;
	source_tabla_id: string | null;
	lineage_row_key: string | null;
	column_id: string;
	value: unknown;
	binding_status: "legacy" | "stable" | "conflict" | null;
	binding_error: Record<string, unknown> | null;
};

function shortId(value: string | null | undefined, fallback: string) {
	if (!value) return fallback;
	return value.length > 12 ? value.slice(0, 12) : value;
}

function buildStableIdentityKey(
	sourceTablaId: string | null | undefined,
	lineageRowKey: string | null | undefined,
) {
	if (!sourceTablaId || !lineageRowKey) return null;
	return `${sourceTablaId}::${lineageRowKey}`;
}

function pushNode(
	nodes: GraphNode[],
	seen: Set<string>,
	node: GraphNode,
) {
	if (seen.has(node.id)) return;
	seen.add(node.id);
	nodes.push(node);
}

function pushEdge(
	edges: GraphEdge[],
	seen: Set<string>,
	edge: GraphEdge,
) {
	if (seen.has(edge.id)) return;
	seen.add(edge.id);
	edges.push(edge);
}

function isMissingLineageMigrationError(message: string): boolean {
	return /source_tabla_id|binding_status|binding_error|lineage_row_key|materialization_version|extraction_id/i.test(
		message,
	) && /does not exist|column/i.test(message);
}

export async function GET(request: Request, context: RouteContext) {
	const { id: obraId } = await context.params;
	if (!obraId) {
		return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });
	}

	try {
		const access = await resolveRequestAccessContext();
		const { supabase, user, tenantId, actorType } = access;

		if (!user && actorType !== "demo") {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		if (actorType === "demo" && !hasDemoCapability(access.demoSession, "excel")) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}
		if (!tenantId) {
			return NextResponse.json({ error: "No tenant" }, { status: 400 });
		}

		const url = new URL(request.url);
		const tablaIdFilter = url.searchParams.get("tablaId")?.trim() || null;
		const docPathFilter = url.searchParams.get("docPath")?.trim() || null;
		const limitParam = Number(url.searchParams.get("limit"));
		const rowsLimit = Math.min(
			50,
			Math.max(1, Number.isFinite(limitParam) ? limitParam : 20),
		);

		const { data: obraRow, error: obraError } = await supabase
			.from("obras")
			.select("id")
			.eq("id", obraId)
			.eq("tenant_id", tenantId)
			.is("deleted_at", null)
			.maybeSingle();
		if (obraError) throw obraError;
		if (!obraRow) {
			return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
		}

		let tablasQuery = supabase
			.from("obra_tablas")
			.select("id, name, source_type")
			.eq("obra_id", obraId)
			.eq("source_type", "ocr")
			.order("created_at", { ascending: true });
		if (tablaIdFilter) {
			tablasQuery = tablasQuery.eq("id", tablaIdFilter);
		}

		const { data: tablas, error: tablasError } = await tablasQuery;
		if (tablasError) throw tablasError;

		const tablaIds = (tablas ?? []).map((tabla) => tabla.id as string);
		const scope = docPathFilter ? "document" : tablaIdFilter ? "table" : "obra";

		if (tablaIds.length === 0) {
			return NextResponse.json({
				selection: {
					obraId,
					tablaId: tablaIdFilter,
					docPath: docPathFilter,
					scope,
				},
				summary: {
					documents: 0,
					extractions: 0,
					tables: 0,
					rows: 0,
					macroTables: 0,
					overrides: 0,
					events: 0,
				},
				coverage: {
					pipeline: {
						id: "ocr_simple",
						label: "Pipeline OCR simple",
						status: "implemented" satisfies SupportStatus,
						detail: "Este panel cubre el import OCR simple via /import/ocr.",
					},
					backing: {
						id: "ocr_processing_backing",
						label: "Backing actual de extraccion",
						status: "partial" satisfies SupportStatus,
						detail: "La extraccion visible proviene de ocr_document_processing solo para el flujo OCR simple.",
					},
					items: [
						{
							id: "unsupported_selection",
							label: "Seleccion actual",
							status: "not_supported" satisfies SupportStatus,
							detail: "No encontramos una tabla OCR soportada para proyectar lineage en esta vista.",
						},
					],
				},
				nodes: [],
				edges: [],
			});
		}

		let documentsQuery = supabase
			.from("ocr_document_processing")
			.select(
				"id, tabla_id, source_bucket, source_path, source_file_name, status, error_message, error_code, rows_extracted, processed_at, extraction_id, file_fingerprint, content_fingerprint_normalized, fingerprint_status, fingerprint_error, created_at",
			)
			.eq("obra_id", obraId)
			.in("tabla_id", tablaIds)
			.order("created_at", { ascending: false });
		if (docPathFilter) {
			documentsQuery = documentsQuery.eq("source_path", docPathFilter);
		}

		const { data: documents, error: documentsError } = await documentsQuery;
		if (documentsError) throw documentsError;

		const extractionIds = new Set(
			(documents ?? [])
				.map((document) =>
					typeof document.extraction_id === "string" ? document.extraction_id : null,
				)
				.filter((value): value is string => Boolean(value)),
		);

		const { data: rows, error: rowsError } = await supabase
			.from("obra_tabla_rows")
			.select(
				"id, tabla_id, lineage_row_key, extraction_id, materialization_version, data, source, created_at, updated_at",
			)
			.in("tabla_id", tablaIds)
			.order("updated_at", { ascending: false })
			.limit(Math.max(rowsLimit * 20, 200));
		if (rowsError) throw rowsError;

		const filteredRows = (rows ?? [])
			.filter((row) => {
				const data = (row.data as Record<string, unknown>) ?? {};
				const rowDocPath =
					typeof data.__docPath === "string" ? data.__docPath : null;
				if (docPathFilter) {
					return (
						rowDocPath === docPathFilter ||
						(typeof row.extraction_id === "string" &&
							extractionIds.has(row.extraction_id))
					);
				}
				return true;
			})
			.slice(0, rowsLimit);

		const currentRowIds = filteredRows.map((row) => row.id as string);
		const stableIdentityByRowId = new Map<string, string>();
		for (const row of filteredRows) {
			const stableIdentity = buildStableIdentityKey(
				row.tabla_id as string,
				typeof row.lineage_row_key === "string" ? (row.lineage_row_key as string) : null,
			);
			if (stableIdentity) {
				stableIdentityByRowId.set(row.id as string, stableIdentity);
			}
		}

		const overrideRecordsById = new Map<string, GraphOverrideRecord>();
		if (currentRowIds.length > 0) {
			const { data: legacyOverrides, error: legacyOverridesError } = await supabase
				.from("macro_table_custom_values")
				.select("id, macro_table_id, source_row_id, source_tabla_id, lineage_row_key, column_id, value, binding_status, binding_error")
				.in("source_row_id", currentRowIds);
			if (legacyOverridesError) throw legacyOverridesError;
			for (const override of legacyOverrides ?? []) {
				overrideRecordsById.set(override.id as string, {
					id: override.id as string,
					macro_table_id: override.macro_table_id as string,
					source_row_id: override.source_row_id as string,
					source_tabla_id:
						typeof override.source_tabla_id === "string"
							? (override.source_tabla_id as string)
							: null,
					lineage_row_key:
						typeof override.lineage_row_key === "string"
							? (override.lineage_row_key as string)
							: null,
					column_id: override.column_id as string,
					value: override.value,
					binding_status:
						override.binding_status === "legacy" ||
						override.binding_status === "stable" ||
						override.binding_status === "conflict"
							? (override.binding_status as "legacy" | "stable" | "conflict")
							: null,
					binding_error:
						override.binding_error &&
						typeof override.binding_error === "object" &&
						!Array.isArray(override.binding_error)
							? (override.binding_error as Record<string, unknown>)
							: null,
				});
			}
		}
		if (tablaIds.length > 0) {
			const { data: stableOverrides, error: stableOverridesError } = await supabase
				.from("macro_table_custom_values")
				.select("id, macro_table_id, source_row_id, source_tabla_id, lineage_row_key, column_id, value, binding_status, binding_error")
				.in("source_tabla_id", tablaIds);
			if (stableOverridesError) throw stableOverridesError;
			for (const override of stableOverrides ?? []) {
				overrideRecordsById.set(override.id as string, {
					id: override.id as string,
					macro_table_id: override.macro_table_id as string,
					source_row_id: override.source_row_id as string,
					source_tabla_id:
						typeof override.source_tabla_id === "string"
							? (override.source_tabla_id as string)
							: null,
					lineage_row_key:
						typeof override.lineage_row_key === "string"
							? (override.lineage_row_key as string)
							: null,
					column_id: override.column_id as string,
					value: override.value,
					binding_status:
						override.binding_status === "legacy" ||
						override.binding_status === "stable" ||
						override.binding_status === "conflict"
							? (override.binding_status as "legacy" | "stable" | "conflict")
							: null,
					binding_error:
						override.binding_error &&
						typeof override.binding_error === "object" &&
						!Array.isArray(override.binding_error)
							? (override.binding_error as Record<string, unknown>)
							: null,
				});
			}
		}

		const overrideStateByRowId = new Map<
			string,
			{ stable: number; legacy: number; conflict: number }
		>();
		for (const override of overrideRecordsById.values()) {
			let targetRowId: string | null = null;
			if (currentRowIds.includes(override.source_row_id)) {
				targetRowId = override.source_row_id;
			} else {
				const stableIdentity = buildStableIdentityKey(
					override.source_tabla_id,
					override.lineage_row_key,
				);
				if (stableIdentity) {
					const match = [...stableIdentityByRowId.entries()].find(
						([, identity]) => identity === stableIdentity,
					);
					targetRowId = match?.[0] ?? null;
				}
			}
			if (!targetRowId) continue;
			const current = overrideStateByRowId.get(targetRowId) ?? {
				stable: 0,
				legacy: 0,
				conflict: 0,
			};
			if (override.binding_status === "stable") current.stable += 1;
			else if (override.binding_status === "conflict") current.conflict += 1;
			else current.legacy += 1;
			overrideStateByRowId.set(targetRowId, current);
		}

		const macroTableIds = [...new Set([...overrideRecordsById.values()].map((override) => override.macro_table_id))];
		const macroTableNameById = new Map<string, string>();
		const macroSourceTableIdsByMacroId = new Map<string, Set<string>>();
		if (macroTableIds.length > 0) {
			const { data: macroTables, error: macroTablesError } = await supabase
				.from("macro_tables")
				.select("id, name")
				.in("id", macroTableIds);
			if (macroTablesError) throw macroTablesError;
			for (const macroTable of macroTables ?? []) {
				macroTableNameById.set(macroTable.id as string, macroTable.name as string);
			}
			const { data: macroSources, error: macroSourcesError } = await supabase
				.from("macro_table_sources")
				.select("macro_table_id, obra_tabla_id")
				.in("macro_table_id", macroTableIds);
			if (macroSourcesError) throw macroSourcesError;
			for (const source of macroSources ?? []) {
				const macroTableId = source.macro_table_id as string;
				const tableId = source.obra_tabla_id as string;
				const current = macroSourceTableIdsByMacroId.get(macroTableId) ?? new Set<string>();
				current.add(tableId);
				macroSourceTableIdsByMacroId.set(macroTableId, current);
			}
		}

		const nodes: GraphNode[] = [];
		const edges: GraphEdge[] = [];
		const nodeIds = new Set<string>();
		const edgeIds = new Set<string>();
		const tableNameById = new Map(
			(tablas ?? []).map((tabla) => [tabla.id as string, tabla.name as string]),
		);
		const rowNodeIdByRowId = new Map<string, string>();
		const rowNodeIdByStableIdentity = new Map<string, string>();

		for (const document of documents ?? []) {
			const docPath = document.source_path as string;
			const tableId = document.tabla_id as string;
			const documentNodeId = `doc:${docPath}`;
			const extractionId =
				(typeof document.extraction_id === "string" && document.extraction_id) ||
				`processing:${document.id as string}`;
			const extractionNodeId = `ext:${extractionId}`;
			const tableNodeId = `table:${tableId}`;
			const uploadEventNodeId = `event:document_uploaded:${document.id as string}`;
			const extractionEventType =
				document.status === "failed"
					? "extraction_failed"
					: document.status === "completed"
						? "extraction_completed"
						: "extraction_processing";
			const extractionEventNodeId = `event:${extractionEventType}:${extractionId}`;

			pushNode(nodes, nodeIds, {
				id: documentNodeId,
				type: "document",
				label: (document.source_file_name as string) || "Documento OCR",
				status: (document.status as string) || "unknown",
				supportStatus: "implemented",
				data: {
					sourcePath: docPath,
					sourceBucket: document.source_bucket,
					sourceFileName: document.source_file_name,
					rowsExtracted: document.rows_extracted,
				},
			});

			pushNode(nodes, nodeIds, {
				id: extractionNodeId,
				type: "extraction",
				label: `Extraccion ${shortId(extractionId, "actual")}`,
				status: (document.status as string) || "unknown",
				supportStatus: "partial",
				data: {
					extractionId,
					tablaId: document.tabla_id,
					fileFingerprint: document.file_fingerprint,
					contentFingerprintNormalized:
						document.content_fingerprint_normalized,
					fingerprintStatus: document.fingerprint_status,
					fingerprintError: document.fingerprint_error,
					processedAt: document.processed_at,
					errorMessage: document.error_message,
					errorCode:
						typeof document.error_code === "string" ? document.error_code : null,
				},
			});

			pushNode(nodes, nodeIds, {
				id: tableNodeId,
				type: "table",
				label: tableNameById.get(tableId) ?? "Tabla OCR",
				status: "active",
				supportStatus: "implemented",
				data: {
					tablaId: tableId,
					tablaName: tableNameById.get(tableId) ?? "Tabla OCR",
				},
			});

			pushNode(nodes, nodeIds, {
				id: uploadEventNodeId,
				type: "event",
				label: "document_uploaded",
				status: "projected",
				supportStatus: "partial",
				data: {
					eventType: "document_uploaded",
					projectionMode: "projected",
					occurredAt: document.created_at,
					producerNodeId: documentNodeId,
					consumerNodeId: extractionNodeId,
					producerType: "document",
					consumerType: "extraction",
				},
			});
			pushEdge(edges, edgeIds, {
				id: `${documentNodeId}->${uploadEventNodeId}`,
				source: documentNodeId,
				target: uploadEventNodeId,
				type: "document_to_event",
				label: "emite",
			});
			pushEdge(edges, edgeIds, {
				id: `${uploadEventNodeId}->${extractionNodeId}`,
				source: uploadEventNodeId,
				target: extractionNodeId,
				type: "event_to_extraction",
				label: "dispara",
			});

			pushNode(nodes, nodeIds, {
				id: extractionEventNodeId,
				type: "event",
				label: extractionEventType,
				status: "projected",
				supportStatus: "partial",
				data: {
					eventType: extractionEventType,
					projectionMode: "projected",
					occurredAt: document.processed_at ?? document.created_at,
					producerNodeId: extractionNodeId,
					consumerNodeId: tableNodeId,
					producerType: "extraction",
					consumerType: "table",
				},
			});
			pushEdge(edges, edgeIds, {
				id: `${extractionNodeId}->${extractionEventNodeId}`,
				source: extractionNodeId,
				target: extractionEventNodeId,
				type: "extraction_to_event",
				label: "estado",
			});
			pushEdge(edges, edgeIds, {
				id: `${extractionEventNodeId}->${tableNodeId}`,
				source: extractionEventNodeId,
				target: tableNodeId,
				type: "event_to_table",
				label: "impacta",
			});

			pushEdge(edges, edgeIds, {
				id: `${documentNodeId}->${extractionNodeId}`,
				source: documentNodeId,
				target: extractionNodeId,
				type: "document_to_extraction",
				label: "origen",
			});
			pushEdge(edges, edgeIds, {
				id: `${extractionNodeId}->${tableNodeId}`,
				source: extractionNodeId,
				target: tableNodeId,
				type: "extraction_to_table",
				label: "materializa",
			});
		}

		for (const row of filteredRows) {
			const tableId = row.tabla_id as string;
			const tableNodeId = `table:${tableId}`;
			const lineageRowKey =
				(typeof row.lineage_row_key === "string" && row.lineage_row_key) ||
				`legacy:${row.id as string}`;
			const rowNodeId = `row:${tableId}:${lineageRowKey}`;
			const data = (row.data as Record<string, unknown>) ?? {};

			pushNode(nodes, nodeIds, {
				id: tableNodeId,
				type: "table",
				label: tableNameById.get(tableId) ?? "Tabla OCR",
				status: "active",
				supportStatus: "implemented",
				data: {
					tablaId: tableId,
					tablaName: tableNameById.get(tableId) ?? "Tabla OCR",
				},
			});

			pushNode(nodes, nodeIds, {
				id: rowNodeId,
				type: "row",
				label: shortId(lineageRowKey, "fila"),
				status:
					Number(row.materialization_version ?? 1) > 1
						? "rematerialized"
						: "current",
				supportStatus: "implemented",
				data: {
					rowId: row.id,
					tablaId: tableId,
					lineageRowKey,
					extractionId: row.extraction_id,
					materializationVersion: row.materialization_version ?? 1,
					docPath:
						typeof data.__docPath === "string" ? data.__docPath : null,
					docFileName:
						typeof data.__docFileName === "string"
							? data.__docFileName
							: null,
				},
			});
			rowNodeIdByRowId.set(row.id as string, rowNodeId);
			const stableIdentity = buildStableIdentityKey(tableId, lineageRowKey);
			if (stableIdentity) {
				rowNodeIdByStableIdentity.set(stableIdentity, rowNodeId);
			}

			pushEdge(edges, edgeIds, {
				id: `${tableNodeId}->${rowNodeId}`,
				source: tableNodeId,
				target: rowNodeId,
				type: "table_to_row",
				label: "contiene",
			});

			const extractionId =
				typeof row.extraction_id === "string" ? row.extraction_id : null;
			if (extractionId) {
				const extractionNodeId = `ext:${extractionId}`;
				pushNode(nodes, nodeIds, {
					id: extractionNodeId,
					type: "extraction",
					label: `Extraccion ${shortId(extractionId, "row-only")}`,
					status: "row_only",
					supportStatus: "partial",
					data: {
						extractionId,
						tablaId: tableId,
						note: "Extraccion referenciada por filas pero no visible en el backing OCR actual.",
					},
				});
				pushEdge(edges, edgeIds, {
					id: `${extractionNodeId}->${tableNodeId}`,
					source: extractionNodeId,
					target: tableNodeId,
					type: "extraction_to_table",
					label: "materializa",
				});

				const rowEventType =
					Number(row.materialization_version ?? 1) > 1
						? "rows_rematerialized"
						: "rows_materialized";
				const rowEventNodeId = `event:${rowEventType}:${row.id as string}`;
				pushNode(nodes, nodeIds, {
					id: rowEventNodeId,
					type: "event",
					label: rowEventType,
					status: "projected",
					supportStatus: "partial",
					data: {
						eventType: rowEventType,
						projectionMode: "projected",
						occurredAt: row.updated_at ?? row.created_at,
						producerNodeId: extractionNodeId,
						consumerNodeId: rowNodeId,
						producerType: "extraction",
						consumerType: "row",
					},
				});
				pushEdge(edges, edgeIds, {
					id: `${extractionNodeId}->${rowEventNodeId}`,
					source: extractionNodeId,
					target: rowEventNodeId,
					type: "extraction_to_event",
					label: "proyecta",
				});
				pushEdge(edges, edgeIds, {
					id: `${rowEventNodeId}->${rowNodeId}`,
					source: rowEventNodeId,
					target: rowNodeId,
					type: "event_to_row",
					label: "materializa",
				});
			}

			const overrideState = overrideStateByRowId.get(row.id as string);
			if (overrideState?.stable) {
				const stableOverrideEventId = `event:override_reattached:${row.id as string}`;
				pushNode(nodes, nodeIds, {
					id: stableOverrideEventId,
					type: "event",
					label: "override_reattached",
					status: "projected",
					supportStatus: "partial",
					data: {
						eventType: "override_reattached",
						projectionMode: "projected",
						producerNodeId: rowNodeId,
						consumerScope: "macro_tables",
						supportStatus: "implemented",
						overrideCount: overrideState.stable,
					},
				});
				pushEdge(edges, edgeIds, {
					id: `${rowNodeId}->${stableOverrideEventId}`,
					source: rowNodeId,
					target: stableOverrideEventId,
					type: "row_to_event",
					label: "reattached",
				});
			}
			if (overrideState?.legacy) {
				const legacyOverrideEventId = `event:override_legacy_binding:${row.id as string}`;
				pushNode(nodes, nodeIds, {
					id: legacyOverrideEventId,
					type: "event",
					label: "override_legacy_binding",
					status: "projected",
					supportStatus: "partial",
					data: {
						eventType: "override_legacy_binding",
						projectionMode: "projected",
						producerNodeId: rowNodeId,
						consumerScope: "macro_tables",
						supportStatus: "partial",
						overrideCount: overrideState.legacy,
					},
				});
				pushEdge(edges, edgeIds, {
					id: `${rowNodeId}->${legacyOverrideEventId}`,
					source: rowNodeId,
					target: legacyOverrideEventId,
					type: "row_to_event",
					label: "legacy",
				});
			}
			if (overrideState?.conflict) {
				const conflictEventId = `event:override_conflict:${row.id as string}`;
				pushNode(nodes, nodeIds, {
					id: conflictEventId,
					type: "event",
					label: "override_conflict_detected",
					status: "projected",
					supportStatus: "partial",
					data: {
						eventType: "override_conflict_detected",
						projectionMode: "projected",
						producerNodeId: rowNodeId,
						consumerScope: "macro_tables",
						supportStatus: "implemented",
						overrideCount: overrideState.conflict,
						errorCode: "LINEAGE_OVERRIDE_REATTACH_CONFLICT",
					},
				});
				pushEdge(edges, edgeIds, {
					id: `${rowNodeId}->${conflictEventId}`,
					source: rowNodeId,
					target: conflictEventId,
					type: "row_to_event",
					label: "conflicto",
				});
			}
		}

		for (const macroTableId of macroTableIds) {
			const macroTableNodeId = `macro:${macroTableId}`;
			pushNode(nodes, nodeIds, {
				id: macroTableNodeId,
				type: "macro_table",
				label: macroTableNameById.get(macroTableId) ?? `Macro ${shortId(macroTableId, "macro")}`,
				status: "active",
				supportStatus: "implemented",
				data: {
					macroTableId,
					name: macroTableNameById.get(macroTableId) ?? null,
				},
			});

			const sourceTableIds = macroSourceTableIdsByMacroId.get(macroTableId) ?? new Set<string>();
			for (const sourceTableId of sourceTableIds) {
				const tableNodeId = `table:${sourceTableId}`;
				if (!nodeIds.has(tableNodeId)) continue;
				pushEdge(edges, edgeIds, {
					id: `${tableNodeId}->${macroTableNodeId}`,
					source: tableNodeId,
					target: macroTableNodeId,
					type: "table_to_macro_table",
					label: "downstream",
				});
			}
		}

		for (const override of overrideRecordsById.values()) {
			const overrideNodeId = `override:${override.id}`;
			const macroTableNodeId = `macro:${override.macro_table_id}`;
			const stableIdentity = buildStableIdentityKey(
				override.source_tabla_id,
				override.lineage_row_key,
			);
			const targetRowNodeId =
				rowNodeIdByRowId.get(override.source_row_id) ??
				(stableIdentity ? rowNodeIdByStableIdentity.get(stableIdentity) : undefined);

			pushNode(nodes, nodeIds, {
				id: overrideNodeId,
				type: "override",
				label: `Override ${shortId(override.column_id, "col")}`,
				status: override.binding_status ?? "unknown",
				supportStatus: "implemented",
				data: {
					overrideId: override.id,
					macroTableId: override.macro_table_id,
					columnId: override.column_id,
					sourceRowId: override.source_row_id,
					sourceTablaId: override.source_tabla_id,
					lineageRowKey: override.lineage_row_key,
					bindingStatus: override.binding_status,
					errorCode:
						typeof override.binding_error?.errorCode === "string"
							? override.binding_error.errorCode
							: override.binding_status === "conflict"
								? "LINEAGE_OVERRIDE_REATTACH_CONFLICT"
								: null,
					valuePreview:
						typeof override.value === "string" || typeof override.value === "number"
							? override.value
							: null,
				},
			});

			if (targetRowNodeId) {
				pushEdge(edges, edgeIds, {
					id: `${targetRowNodeId}->${overrideNodeId}`,
					source: targetRowNodeId,
					target: overrideNodeId,
					type: "row_to_override",
					label:
						override.binding_status === "stable"
							? "stable"
							: override.binding_status === "legacy"
								? "legacy"
								: "conflict",
				});
			}

			pushEdge(edges, edgeIds, {
				id: `${overrideNodeId}->${macroTableNodeId}`,
				source: overrideNodeId,
				target: macroTableNodeId,
				type: "override_to_macro_table",
				label: "aplica",
			});
		}

		const stableOverrideCount = [...overrideStateByRowId.values()].reduce(
			(total, state) => total + state.stable,
			0,
		);
		const legacyOverrideCount = [...overrideStateByRowId.values()].reduce(
			(total, state) => total + state.legacy,
			0,
		);
		const conflictOverrideCount = [...overrideStateByRowId.values()].reduce(
			(total, state) => total + state.conflict,
			0,
		);

		return NextResponse.json({
			selection: {
				obraId,
				tablaId: tablaIdFilter,
				docPath: docPathFilter,
				scope,
			},
			summary: {
				documents: nodes.filter((node) => node.type === "document").length,
				extractions: nodes.filter((node) => node.type === "extraction").length,
				tables: nodes.filter((node) => node.type === "table").length,
				rows: nodes.filter((node) => node.type === "row").length,
				macroTables: nodes.filter((node) => node.type === "macro_table").length,
				overrides: nodes.filter((node) => node.type === "override").length,
				events: nodes.filter((node) => node.type === "event").length,
			},
			coverage: {
				pipeline: {
					id: "document_import_lineage",
					label: "Pipelines documentales con lineage",
					status: "partial" satisfies SupportStatus,
					detail:
						"OCR simple ya esta cerrado. OCR multi y spreadsheet multi ahora escriben el mismo contrato fisico, pero su cobertura global sigue en expansion.",
				},
				backing: {
					id: "ocr_processing_backing",
					label: "Backing actual de extraccion",
					status: "partial" satisfies SupportStatus,
					detail:
						"El nodo extraccion se proyecta desde ocr_document_processing solo para el flujo OCR simple. No es la fuente canonica global del lineage.",
				},
				items: [
					{
						id: "lineage_fields",
						label: "lineage_row_key + extraction_id + materialization_version",
						status: "implemented" satisfies SupportStatus,
						detail: "Las filas OCR simples ya exponen identidad estable, extraccion y version de materializacion.",
					},
					{
						id: "conflict_detection",
						label: "Conflictos de reconciliacion OCR",
						status: "implemented" satisfies SupportStatus,
						detail: "El import OCR simple devuelve LINEAGE_RECONCILIATION_CONFLICT y deja evidencia de falla.",
					},
					{
						id: "macro_override_reattach",
						label: "Overrides downstream por lineage",
						status: "implemented" satisfies SupportStatus,
						detail: `Dual-read / dual-write activo en macrotablas. Overrides estables visibles: ${stableOverrideCount}. Fallback legacy: ${legacyOverrideCount}. Conflictos visibles: ${conflictOverrideCount}.`,
					},
					{
						id: "macro_nodes",
						label: "Macrotablas y overrides como nodos",
						status: "implemented" satisfies SupportStatus,
						detail: `El grafo ya muestra nodos reales de macrotablas (${macroTableIds.length}) y overrides (${overrideRecordsById.size}) con estados stable / legacy / conflict.`,
					},
					{
						id: "projected_events",
						label: "Eventos projected",
						status: "partial" satisfies SupportStatus,
						detail: "Los eventos mostrados son proyecciones read-only desde estado existente; no hay event store canonico en este slice.",
					},
					{
						id: "recommendations",
						label: "Recomendaciones",
						status: "not_supported" satisfies SupportStatus,
						detail: "No hay nodos reales de recomendaciones en este slice.",
					},
					{
						id: "multi_pipeline",
						label: "OCR multi / spreadsheet multi",
						status: "partial" satisfies SupportStatus,
						detail: "Ambos pipelines ya materializan lineage_row_key, extraction_id y materialization_version. Spreadsheet multi usa reconciliacion conservadora sin fallback estructural automatico.",
					},
				],
			},
			nodes,
			edges,
		});
	} catch (error) {
		console.error("[lineage-graph:get]", error);
		const message = error instanceof Error ? error.message : "Error desconocido";
		if (isMissingLineageMigrationError(message)) {
			return NextResponse.json(
				{
					error:
						"Faltan migraciones de lineage en la base activa. Aplica 0093_row_lineage_identity.sql y 0094_macro_table_lineage_overrides.sql.",
					code: "LINEAGE_MIGRATION_REQUIRED",
				},
				{ status: 500 },
			);
		}
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
