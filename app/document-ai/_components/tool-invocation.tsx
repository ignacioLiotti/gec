"use client";

import { useState } from "react";
import type { ToolInvocation } from "ai";
import {
	Building2,
	Check,
	ChevronRight,
	Download,
	ExternalLink,
	FileSearch,
	FileText,
	FolderOpen,
	Loader2,
	Sparkles,
	Table2,
	TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TOOL_META: Record<string, { icon: typeof FileText; running: string; done: string }> = {
	listar_obras: { icon: Building2, running: "Listando obras", done: "Obras consultadas" },
	listar_carpetas: { icon: FolderOpen, running: "Explorando carpetas", done: "Carpetas exploradas" },
	buscar_documentos: { icon: FileSearch, running: "Buscando en documentos", done: "Búsqueda completada" },
	obtener_filas_tabla: { icon: Table2, running: "Leyendo tabla", done: "Tabla consultada" },
	preview_documento: { icon: FileText, running: "Preparando documento", done: "Documento listo" },
	generar_reporte: { icon: Sparkles, running: "Generando reporte", done: "Reporte generado" },
};

type ResultRecord = Record<string, unknown>;

function asRecord(value: unknown): ResultRecord {
	return value && typeof value === "object" ? (value as ResultRecord) : {};
}

function summarizeResult(toolName: string, result: ResultRecord): string | null {
	if (typeof result.error === "string") return result.error;
	if (toolName === "listar_obras" && typeof result.total === "number") {
		return `${result.total} obras`;
	}
	if (toolName === "buscar_documentos") {
		const filas = typeof result.totalFilas === "number" ? result.totalFilas : 0;
		const docs = Array.isArray(result.documentos) ? result.documentos.length : 0;
		return `${filas} filas · ${docs} documentos`;
	}
	if (toolName === "listar_carpetas") {
		const carpetas = Array.isArray(result.carpetas) ? result.carpetas.length : 0;
		const archivos = Array.isArray(result.archivos) ? result.archivos.length : 0;
		return `${carpetas} carpetas · ${archivos} archivos`;
	}
	if (toolName === "obtener_filas_tabla" && Array.isArray(result.filas)) {
		return `${result.filas.length} filas`;
	}
	return null;
}

function DocumentPreviewCard({ result }: { result: ResultRecord }) {
	const nombre = typeof result.nombre === "string" ? result.nombre : "documento";
	const url = typeof result.url === "string" ? result.url : null;
	if (!url) return null;
	const esImagen = result.esImagen === true;
	return (
		<a
			href={url}
			target="_blank"
			rel="noreferrer"
			className="dai-press group block w-64 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-[0_1px_3px_rgba(28,25,23,0.06)] transition-[border-color,box-shadow] duration-200 hover:border-stone-300 hover:shadow-[0_4px_14px_rgba(28,25,23,0.08)]"
		>
			<div className="flex h-36 items-center justify-center overflow-hidden bg-stone-100">
				{esImagen ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img
						src={url}
						alt={nombre}
						loading="lazy"
						decoding="async"
						className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
					/>
				) : (
					<FileText className={cn("size-10", result.esPdf === true ? "text-red-400" : "text-stone-400")} />
				)}
			</div>
			<div className="flex items-center justify-between gap-2 px-3 py-2.5">
				<p className="truncate text-[13px] font-medium text-stone-800" title={nombre}>
					{nombre}
				</p>
				<ExternalLink className="size-3.5 shrink-0 text-stone-400 transition-colors group-hover:text-[#ff5800]" />
			</div>
		</a>
	);
}

function ReportCard({ result }: { result: ResultRecord }) {
	const titulo = typeof result.titulo === "string" ? result.titulo : "Reporte Document AI";
	const resumen = typeof result.resumen === "string" ? result.resumen : "";
	const downloadUrl = typeof result.downloadUrl === "string" ? result.downloadUrl : null;
	const formato = typeof result.formato === "string" ? result.formato : "";
	const advertencias = Array.isArray(result.advertencias)
		? (result.advertencias as unknown[]).filter((entry): entry is string => typeof entry === "string")
		: [];
	if (!downloadUrl) return null;
	return (
		<div className="w-full max-w-md overflow-hidden rounded-xl border border-stone-200 bg-white shadow-[0_1px_3px_rgba(28,25,23,0.06)]">
			<div className="flex items-start gap-3 px-4 pt-4">
				<span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#fff1e9] text-[#ff5800]">
					<Sparkles className="size-4.5" />
				</span>
				<div className="min-w-0">
					<p className="text-[13px] font-semibold text-stone-900">{titulo}</p>
					{resumen ? <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-stone-500">{resumen}</p> : null}
				</div>
			</div>
			{advertencias.length > 0 ? (
				<div className="mx-4 mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
					<TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
					<span className="line-clamp-2">{advertencias[0]}</span>
				</div>
			) : null}
			<div className="mt-3 flex items-center justify-between border-t border-stone-100 px-4 py-2.5">
				<span className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400">{formato}</span>
				<a
					href={downloadUrl}
					className="dai-press inline-flex items-center gap-1.5 rounded-lg bg-[#ff5800] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#e84f00]"
				>
					<Download className="size-3.5" />
					Descargar
				</a>
			</div>
		</div>
	);
}

function SearchResultDetail({ result }: { result: ResultRecord }) {
	const documentos = Array.isArray(result.documentos) ? (result.documentos as ResultRecord[]) : [];
	const advertencias = Array.isArray(result.advertencias)
		? (result.advertencias as unknown[]).filter((entry): entry is string => typeof entry === "string")
		: [];
	if (documentos.length === 0 && advertencias.length === 0) return null;
	return (
		<div className="space-y-1.5 pt-2">
			{documentos.slice(0, 8).map((doc, index) => (
				<div key={index} className="flex items-center gap-2 text-xs text-stone-600">
					<FileText className="size-3.5 shrink-0 text-stone-400" />
					<span className="truncate">{typeof doc.nombre === "string" ? doc.nombre : String(doc.storagePath ?? "")}</span>
					{typeof doc.tipo === "string" && doc.tipo ? (
						<span className="ml-auto shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500">
							{doc.tipo.replace(/_/g, " ")}
						</span>
					) : null}
				</div>
			))}
			{advertencias.map((warning) => (
				<div key={warning} className="flex items-start gap-2 text-xs text-amber-700">
					<TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
					{warning}
				</div>
			))}
		</div>
	);
}

export function ToolInvocationView({ invocation }: { invocation: ToolInvocation }) {
	const [open, setOpen] = useState(false);
	const meta = TOOL_META[invocation.toolName] ?? {
		icon: Sparkles,
		running: invocation.toolName,
		done: invocation.toolName,
	};
	const Icon = meta.icon;
	const isDone = invocation.state === "result";
	const result = isDone ? asRecord((invocation as { result?: unknown }).result) : {};
	const hasError = isDone && typeof result.error === "string";
	const summary = isDone ? summarizeResult(invocation.toolName, result) : null;

	// Rich results render as standalone cards instead of a pill.
	if (isDone && invocation.toolName === "preview_documento" && !hasError) {
		return <DocumentPreviewCard result={result} />;
	}
	if (isDone && invocation.toolName === "generar_reporte" && !hasError) {
		return <ReportCard result={result} />;
	}

	const expandable = isDone && (invocation.toolName === "buscar_documentos" || hasError);

	return (
		<div className="max-w-md">
			<button
				type="button"
				onClick={() => expandable && setOpen((current) => !current)}
				className={cn(
					"dai-press flex w-full items-center gap-2 rounded-lg border bg-white px-2.5 py-1.5 text-left",
					hasError ? "border-rose-200" : "border-stone-200",
					expandable ? "cursor-pointer hover:border-stone-300" : "cursor-default",
					"transition-colors duration-200",
				)}
			>
				{isDone ? (
					hasError ? (
						<TriangleAlert className="size-3.5 shrink-0 text-rose-500" />
					) : (
						<Check className="size-3.5 shrink-0 text-emerald-600" />
					)
				) : (
					<Loader2 className="size-3.5 shrink-0 animate-spin text-[#ff5800]" />
				)}
				<Icon className="size-3.5 shrink-0 text-stone-400" />
				<span className="truncate text-xs font-medium text-stone-600">
					{isDone ? meta.done : `${meta.running}…`}
				</span>
				{summary ? (
					<span className={cn("ml-auto shrink-0 text-[11px]", hasError ? "text-rose-500" : "text-stone-400")}>
						{summary}
					</span>
				) : null}
				{expandable ? (
					<ChevronRight
						className={cn(
							"size-3.5 shrink-0 text-stone-300 transition-transform duration-200",
							open && "rotate-90",
						)}
					/>
				) : null}
			</button>
			{expandable ? (
				<div className="dai-expand" data-open={open}>
					<div>
						<div className="mx-1 rounded-b-lg border-x border-b border-stone-200 bg-stone-50/60 px-3 pb-2.5">
							{hasError ? (
								<p className="pt-2 text-xs text-rose-600">{String(result.error)}</p>
							) : (
								<SearchResultDetail result={result} />
							)}
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
