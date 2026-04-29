"use client";

import { useEffect, useMemo, useState } from "react";
import {
	AlertCircle,
	CheckCircle2,
	Clock3,
	FileText,
	GitBranchPlus,
	RefreshCw,
	Table2,
	Waypoints,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
	LineageCoverageItem,
	LineageGraphNode,
	LineageGraphPayload,
	LineageSupportStatus,
} from "../types";

type LineagePanelProps = {
	obraId: string;
	tablaId: string | null;
	docPath: string | null;
	refreshKey?: number;
};

function supportTone(status: LineageSupportStatus) {
	switch (status) {
		case "implemented":
			return "bg-emerald-50 text-emerald-700 border-emerald-200";
		case "partial":
			return "bg-amber-50 text-amber-800 border-amber-200";
		case "planned":
			return "bg-blue-50 text-blue-700 border-blue-200";
		case "not_supported":
			return "bg-stone-100 text-stone-700 border-stone-200";
	}
}

function nodeStatusTone(status: string) {
	if (
		status === "completed" ||
		status === "active" ||
		status === "current" ||
		status === "implemented"
	) {
		return "bg-emerald-50 text-emerald-700 border-emerald-200";
	}
	if (status === "failed") {
		return "bg-red-50 text-red-700 border-red-200";
	}
	if (status === "stable") {
		return "bg-emerald-50 text-emerald-700 border-emerald-200";
	}
	if (status === "legacy") {
		return "bg-amber-50 text-amber-800 border-amber-200";
	}
	if (status === "conflict") {
		return "bg-red-50 text-red-700 border-red-200";
	}
	if (status === "processing" || status === "pending" || status === "projected") {
		return "bg-amber-50 text-amber-800 border-amber-200";
	}
	if (status === "rematerialized") {
		return "bg-sky-50 text-sky-700 border-sky-200";
	}
	return "bg-stone-100 text-stone-700 border-stone-200";
}

function supportLabel(status: LineageSupportStatus) {
	switch (status) {
		case "implemented":
			return "implemented";
		case "partial":
			return "partial";
		case "planned":
			return "planned";
		case "not_supported":
			return "not_supported";
	}
}

function nodeTypeLabel(type: LineageGraphNode["type"]) {
	switch (type) {
		case "document":
			return "Documento";
		case "extraction":
			return "Extraccion";
		case "table":
			return "Tabla";
	case "row":
		return "Fila";
	case "macro_table":
		return "MacroTabla";
	case "override":
		return "Override";
	case "event":
		return "Evento";
	}
}

function renderCoverageItem(item: LineageCoverageItem) {
	return (
		<div
			key={item.id}
			className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm"
		>
			<div className="flex items-center justify-between gap-2">
				<p className="text-sm font-medium text-stone-800">{item.label}</p>
				<Badge variant="outline" className={cn("text-[11px]", supportTone(item.status))}>
					{supportLabel(item.status)}
				</Badge>
			</div>
			<p className="mt-1 text-xs text-stone-500">{item.detail}</p>
		</div>
	);
}

function compactValue(value: unknown) {
	if (typeof value !== "string" || value.length === 0) return null;
	return value.length > 24 ? `${value.slice(0, 24)}...` : value;
}

export function LineagePanel({
	obraId,
	tablaId,
	docPath,
	refreshKey = 0,
}: LineagePanelProps) {
	const [payload, setPayload] = useState<LineageGraphPayload | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [reloadNonce, setReloadNonce] = useState(0);

	useEffect(() => {
		if (!obraId || !tablaId) {
			setPayload(null);
			setError(null);
			return;
		}

		let cancelled = false;
		const controller = new AbortController();
		const search = new URLSearchParams();
		search.set("tablaId", tablaId);
		if (docPath) search.set("docPath", docPath);
		search.set("limit", docPath ? "20" : "40");

		async function load() {
			setIsLoading(true);
			setError(null);
			setPayload(null);
			try {
				const response = await fetch(
					`/api/obras/${obraId}/lineage-graph?${search.toString()}`,
					{
						cache: "no-store",
						signal: controller.signal,
					},
				);
				const json = (await response.json().catch(() => ({}))) as
					| LineageGraphPayload
					| { error?: string };
				if (!response.ok) {
					throw new Error(
						typeof json === "object" && json && "error" in json
							? json.error || "No se pudo cargar lineage"
							: "No se pudo cargar lineage",
					);
				}
				if (!cancelled) {
					setPayload(json as LineageGraphPayload);
				}
			} catch (loadError) {
				if (controller.signal.aborted) return;
				if (!cancelled) {
					setPayload(null);
					setError(
						loadError instanceof Error
							? loadError.message
							: "No se pudo cargar lineage",
					);
				}
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		}

		void load();
		return () => {
			cancelled = true;
			controller.abort();
		};
	}, [docPath, obraId, refreshKey, reloadNonce, tablaId]);

	const groupedNodes = useMemo(() => {
		const source = payload?.nodes ?? [];
		return {
			document: source.filter((node) => node.type === "document"),
			extraction: source.filter((node) => node.type === "extraction"),
			table: source.filter((node) => node.type === "table"),
			row: source.filter((node) => node.type === "row"),
			macro_table: source.filter((node) => node.type === "macro_table"),
			override: source.filter((node) => node.type === "override"),
			event: source.filter((node) => node.type === "event"),
		};
	}, [payload?.nodes]);

	if (!tablaId) {
		return (
			<div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
				<div className="flex items-center gap-2 text-stone-800">
					<Waypoints className="h-4 w-4" />
					<h3 className="text-sm font-semibold">Lineage</h3>
				</div>
				<p className="mt-2 text-sm text-stone-500">
					No disponible para esta seleccion. Elegi una carpeta OCR o un
					documento procesado por OCR simple.
				</p>
			</div>
		);
	}

	return (
		<div className="rounded-lg border border-stone-200 bg-[#fafaf8] p-4 shadow-sm">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<div className="flex items-center gap-2 text-stone-800">
						<Waypoints className="h-4 w-4" />
						<h3 className="text-sm font-semibold">Lineage</h3>
					</div>
					<p className="mt-1 text-xs text-stone-500">
						Grafo read-only del slice actual. Refleja el estado real del flujo
						OCR simple y sus efectos downstream visibles hoy.
					</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => setReloadNonce((value) => value + 1)}
					disabled={isLoading}
					className="gap-1.5"
				>
					<RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
					Actualizar
				</Button>
			</div>

			<div className="mt-4 flex flex-col gap-3">
				<div className="space-y-3">
					<div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
						<p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
							Cobertura real del slice
						</p>
						<div className="mt-3 space-y-2">
							{payload ? (
								<>
									{renderCoverageItem(payload.coverage.pipeline)}
									{renderCoverageItem(payload.coverage.backing)}
									{payload.coverage.items.map(renderCoverageItem)}
								</>
							) : error ? (
								<div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
									<AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
									<span>{error}</span>
								</div>
							) : (
								<div className="flex items-center gap-2 text-sm text-stone-500">
									<Clock3 className="h-4 w-4" />
									<span>Cargando cobertura...</span>
								</div>
							)}
						</div>
					</div>

					<div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
						<p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
							Que soporta este panel hoy
						</p>
						<div className="mt-3 grid gap-2 sm:grid-cols-2">
							<div className="rounded-md border border-stone-200 p-3">
								<p className="text-sm font-medium text-stone-800">Pipeline cubierto</p>
								<p className="mt-1 text-xs text-stone-500">
									OCR simple via `/import/ocr`
								</p>
							</div>
							<div className="rounded-md border border-stone-200 p-3">
								<p className="text-sm font-medium text-stone-800">Trazabilidad visible</p>
								<p className="mt-1 text-xs text-stone-500">
									`lineage_row_key`, `materialization_version`, `extraction_id`,
									fingerprints y estado.
								</p>
							</div>
							<div className="rounded-md border border-stone-200 p-3">
								<p className="text-sm font-medium text-stone-800">Downstream visible</p>
								<p className="mt-1 text-xs text-stone-500">
									Macrotablas y overrides ya aparecen como nodos reales con estados
									`stable`, `legacy` y `conflict`.
								</p>
							</div>
							<div className="rounded-md border border-stone-200 p-3">
								<p className="text-sm font-medium text-stone-800">Real vs proyeccion</p>
								<p className="mt-1 text-xs text-stone-500">
									Eventos son projected. Recomendaciones siguen `not_supported`.
								</p>
							</div>
						</div>
					</div>
				</div>

				<div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
					<div className="flex items-center justify-between gap-2">
						<div>
							<p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
								Grafo actual
							</p>
							<p className="mt-1 text-xs text-stone-500">
								Documento -&gt; Extraccion -&gt; Tabla -&gt; Fila -&gt; Override -&gt; MacroTabla -&gt; Evento
							</p>
						</div>
						{payload ? (
							<div className="flex gap-1.5">
								<Badge variant="outline" className="text-[11px]">
									Docs {payload.summary.documents}
								</Badge>
								<Badge variant="outline" className="text-[11px]">
									Ext {payload.summary.extractions}
								</Badge>
								<Badge variant="outline" className="text-[11px]">
									Rows {payload.summary.rows}
								</Badge>
								<Badge variant="outline" className="text-[11px]">
									Ovr {payload.summary.overrides}
								</Badge>
								<Badge variant="outline" className="text-[11px]">
									Macro {payload.summary.macroTables}
								</Badge>
								<Badge variant="outline" className="text-[11px]">
									Evt {payload.summary.events}
								</Badge>
							</div>
						) : null}
					</div>

					<div className="mt-4 grid gap-3 xl:grid-cols-[1fr_44px_1fr_44px_1fr_44px_1fr_44px_1fr_44px_1fr_44px_1.15fr]">
						{([
							["document", groupedNodes.document, FileText],
							["extraction", groupedNodes.extraction, GitBranchPlus],
							["table", groupedNodes.table, Table2],
							["row", groupedNodes.row, CheckCircle2],
							["override", groupedNodes.override, RefreshCw],
							["macro_table", groupedNodes.macro_table, Table2],
							["event", groupedNodes.event, RefreshCw],
						] as const).map(([type, items, Icon], index, all) => (
							<div key={type} className={cn(index < all.length - 1 ? "xl:contents" : undefined)}>
								<div className="min-w-0">
									<div className="mb-2 flex items-center gap-2">
										<Icon className="h-4 w-4 text-stone-500" />
										<p className="text-sm font-medium text-stone-800">
											{nodeTypeLabel(type)}
										</p>
									</div>
									<div className="space-y-2">
										{items.length === 0 ? (
											<div className="rounded-md border border-dashed border-stone-200 bg-stone-50 p-3 text-xs text-stone-400">
												Sin nodos para esta seleccion
											</div>
										) : (
											items.map((node) => (
												<div
													key={node.id}
													className="rounded-md border border-stone-200 bg-stone-50 p-3"
												>
													<div className="flex items-start justify-between gap-2">
														<div className="min-w-0">
															<p className="truncate text-sm font-medium text-stone-800">
																{node.label}
															</p>
															<p className="mt-0.5 text-[11px] text-stone-500">
																{nodeTypeLabel(node.type)}
															</p>
														</div>
														<div className="flex flex-col items-end gap-1">
															<Badge
																variant="outline"
																className={cn("text-[10px]", nodeStatusTone(node.status))}
															>
																{node.status}
															</Badge>
															<Badge
																variant="outline"
																className={cn("text-[10px]", supportTone(node.supportStatus))}
															>
																{supportLabel(node.supportStatus)}
															</Badge>
														</div>
													</div>
													<div className="mt-2 space-y-1 text-[11px] text-stone-600">
														{node.type === "document" ? (
															<p className="truncate">
																path: {String(node.data.sourcePath ?? "-")}
															</p>
														) : null}
														{node.type === "extraction" ? (
															<>
																<p>extraction_id: {compactValue(node.data.extractionId) ?? "-"}</p>
																<p>fingerprint: {String(node.data.fingerprintStatus ?? "-")}</p>
																{typeof node.data.errorCode === "string" && node.data.errorCode ? (
																	<p className="text-red-700">error: {String(node.data.errorCode)}</p>
																) : null}
															</>
														) : null}
														{node.type === "table" ? (
															<p>tabla_id: {compactValue(node.data.tablaId) ?? "-"}</p>
														) : null}
														{node.type === "row" ? (
															<>
																<p>lineage: {compactValue(node.data.lineageRowKey) ?? "-"}</p>
																<p>mat_version: {String(node.data.materializationVersion ?? "-")}</p>
																<p>extraction: {compactValue(node.data.extractionId) ?? "-"}</p>
															</>
														) : null}
														{node.type === "override" ? (
															<>
																<p>binding: {String(node.data.bindingStatus ?? "-")}</p>
																<p>lineage: {compactValue(node.data.lineageRowKey) ?? "-"}</p>
																<p>column: {compactValue(node.data.columnId) ?? "-"}</p>
																{typeof node.data.errorCode === "string" ? (
																	<p className="text-red-700">error: {String(node.data.errorCode)}</p>
																) : null}
															</>
														) : null}
														{node.type === "macro_table" ? (
															<>
																<p>macro_table_id: {compactValue(node.data.macroTableId) ?? "-"}</p>
																<p>name: {compactValue(node.data.name) ?? "-"}</p>
															</>
														) : null}
														{node.type === "event" ? (
															<>
																<p>event: {String(node.data.eventType ?? "-")}</p>
																<p>mode: {String(node.data.projectionMode ?? "real")}</p>
																<p>producer: {compactValue(node.data.producerNodeId) ?? "-"}</p>
																<p>
																	consumer:{" "}
																	{compactValue(node.data.consumerNodeId) ??
																		compactValue(node.data.consumerScope) ??
																		"-"}
																</p>
																{typeof node.data.errorCode === "string" ? (
																	<p className="text-red-700">error: {String(node.data.errorCode)}</p>
																) : null}
															</>
														) : null}
													</div>
												</div>
											))
										)}
									</div>
								</div>
								{index < all.length - 1 ? (
									<div className="hidden xl:flex items-start justify-center pt-16 text-stone-300">
										<div className="flex flex-col items-center gap-2">
											<div className="h-px w-10 bg-stone-300" />
											<div className="text-[10px] uppercase tracking-wide">-&gt;</div>
										</div>
									</div>
								) : null}
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
