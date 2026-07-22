"use client";

import {
	ArrowLeft,
	Check,
	ChevronLeft,
	ChevronRight,
	Download,
	FileText,
	FolderOpen,
	RefreshCw,
	Search,
	Table2,
	Trash2,
	X,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DocumentThumbnail } from "../../_components/document-thumbnail";

type ExtractedFieldId = "concept" | "date" | "certified" | "progress" | "accumulated";

type PortfolioDocument = {
	id: number;
	name: string;
	shortName: string;
	status: "completed" | "attention";
	period: string;
};

const documents: PortfolioDocument[] = [
	{ id: 1, name: "CERT N° 10 · Medición mensual", shortName: "CERT N-10", status: "completed", period: "OCT/25" },
	{ id: 2, name: "CERT 0-12 · Viviendas Santo Tomé", shortName: "CERT-0-12", status: "completed", period: "NOV/25" },
	{ id: 3, name: "CERT 2-12 · Viviendas Santo Tomé", shortName: "CERT-2-12", status: "completed", period: "DIC/25" },
	{ id: 4, name: "CERT 3-12 · Viviendas Santo Tomé", shortName: "CERT-3-12", status: "completed", period: "ENE/26" },
	{ id: 5, name: "CERT 4-12 · Viviendas Santo Tomé", shortName: "CERT-4-12", status: "completed", period: "FEB/26" },
	{ id: 6, name: "CERT 5-12 · Viviendas Santo Tomé", shortName: "CERT-5-12", status: "completed", period: "MAR/26" },
	{ id: 7, name: "CERT 6-12 · Viviendas Santo Tomé", shortName: "CERT-6-12", status: "completed", period: "ABR/26" },
	{ id: 8, name: "CERT ANTICIPO Y N° 1 · Construcción 12 viviendas", shortName: "CERT-ANTICIPO", status: "completed", period: "JUL/25" },
	{ id: 9, name: "CERT N° 7 · Certificado de obra", shortName: "CERT-N-7", status: "completed", period: "MAY/26" },
	{ id: 10, name: "CERT N° 8 · Certificado de obra", shortName: "CERT-N-8", status: "completed", period: "JUN/26" },
	{ id: 11, name: "CERT N° 9 · Certificado de obra", shortName: "CERT-N-9", status: "completed", period: "JUL/26" },
	{ id: 12, name: "CURVA CONTRATO · Plan de avance", shortName: "CURVA-CONTRATO", status: "attention", period: "PLAN" },
	{ id: 13, name: "Plan de trabajo · 12 viviendas", shortName: "PT 12 VIV", status: "completed", period: "PLAN" },
];

const extractedRows = [
	{ id: 1, concept: "Avance Financiero", date: "JUL/25", certified: "$ 133.467,80", progress: "12,56%", accumulated: "$ 239.743,64" },
	{ id: 2, concept: "Avance Físico Básico", date: "JUL/25", certified: "$ 30.213,29", progress: "2,84%", accumulated: "$ 30.213,29" },
	{ id: 3, concept: "Anticipos Financieros", date: "JUL/25", certified: "$ 106.275,84", progress: "10,00%", accumulated: "$ 212.551,68" },
] as const;

const fieldLabels: Record<ExtractedFieldId, string> = {
	concept: "Concepto",
	date: "Fecha certificación",
	certified: "Monto certificado",
	progress: "Avance físico acumulado",
	accumulated: "Monto acumulado",
};

const extractedFields = ["concept", "date", "certified", "progress", "accumulated"] as const satisfies readonly ExtractedFieldId[];

function SourceCell({
	field,
	activeField,
	children,
	className,
	sourceRef,
	showOriginLabel = false,
}: {
	field: ExtractedFieldId;
	activeField: ExtractedFieldId | null;
	children: React.ReactNode;
	className?: string;
	sourceRef?: (node: HTMLSpanElement | null) => void;
	showOriginLabel?: boolean;
}) {
	return (
		<span
			ref={sourceRef}
			data-ocr-source={field}
			data-highlighted={activeField === field ? "true" : undefined}
			className={cn(
				"relative inline-block rounded-sm px-0.5 transition-colors duration-150",
				activeField === field && "z-[1] bg-orange-200 text-orange-950 ring-2 ring-orange-500 ring-offset-1",
				className,
			)}
		>
			{children}
			{activeField === field && showOriginLabel ? (
				<span className="absolute -right-1 -top-2 rounded bg-orange-500 px-1 py-0.5 text-[5px] font-bold uppercase tracking-wide text-white shadow-sm">
					Origen
				</span>
			) : null}
		</span>
	);
}

function CertificateDocument({ activeField }: { activeField: ExtractedFieldId | null }) {
	const sourceElements = useRef<Partial<Record<ExtractedFieldId, Array<HTMLSpanElement | null>>>>({});
	const dataRows = [
		["Avance Financiero", "133.467,80", "12,56", "239.743,64", "22,56"],
		["Avance Físico Básico", "30.213,29", "2,84", "30.213,29", "2,84"],
		["Certificado de Obra", "30.213,29", "2,84", "30.213,29", "2,84"],
		["Otros", "0,00", "0,00", "0,00", "0,00"],
		["Anticipos Financieros", "106.275,84", "10,00", "212.551,68", "20,00"],
		["Descuento Anticipos", "-3.021,33", "-0,28", "-3.021,33", "-0,28"],
		["Acopio", "0,00", "0,00", "0,00", "0,00"],
		["Desacopio", "0,00", "0,00", "0,00", "0,00"],
	] as const;

	useEffect(() => {
		if (!activeField) return;
		const sourceElement = sourceElements.current[activeField]?.[0];
		if (!sourceElement) return;
		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const scrollTimer = window.setTimeout(() => {
			sourceElement.scrollIntoView({
				behavior: reduceMotion ? "auto" : "smooth",
				block: "center",
				inline: "center",
			});
		}, reduceMotion ? 0 : 210);

		return () => window.clearTimeout(scrollTimer);
	}, [activeField]);

	const registerSource = (field: ExtractedFieldId, index = 0) => (node: HTMLSpanElement | null) => {
		const fieldSources = sourceElements.current[field] ?? [];
		fieldSources[index] = node;
		sourceElements.current[field] = fieldSources;
	};

	return (
		<div className="w-[680px] shrink-0 border border-stone-200 bg-white px-10 py-9 font-serif text-[11px] text-black shadow-sm">
			<div className="text-center">
				<p className="text-[17px] font-bold tracking-wide">INSTITUTO DE VIVIENDA DE CORRIENTES</p>
				<p className="text-[10px]">Ministerio de Obras y Servicios Públicos</p>
				<p className="text-[15px] font-bold">PLANILLA RESUMEN en UVI</p>
			</div>

			<div className="mt-3 grid grid-cols-[1.2fr_0.8fr] gap-4 border border-black px-2 py-2 leading-4">
				<div className="grid min-w-0 grid-cols-[64px_1fr] content-start gap-x-1">
					<span>Obra:</span>
					<strong className="min-w-0 leading-[1.35]">CONST 12 VIV Y O.C. P/CONJ. - GR2 C/PROV E INST DE TERMO TANQUE SOLAR - SANTO TOMÉ</strong>
					<span>Contratista:</span><strong>GEC SA</strong>
					<span>Localidad:</span><strong>SANTO TOMÉ</strong>
				</div>
				<div className="min-w-0">
					<p className="flex justify-between"><span>Mto. Cont. Inicial (UVI)</span><strong>1.062.758,41</strong></p>
					<p className="flex justify-between"><span>Mto. Cont. Inicial ($)</span><strong>838.633.288,92</strong></p>
					<p className="flex justify-between"><span>Fecha Inicio Obra:</span><strong>JUL/25</strong></p>
					<p className="flex justify-between"><span>Fecha:</span><SourceCell field="date" activeField={activeField} sourceRef={registerSource("date")} showOriginLabel className="font-bold">JUL/25</SourceCell></p>
				</div>
			</div>

			<table className="mt-3 w-full table-fixed border-collapse text-center text-[10px]">
				<thead>
					<tr className="font-bold">
						<th className="w-[30%] border border-black py-1.5">Concepto</th>
						<th colSpan={2} className="border border-black">Presente Certificado</th>
						<th colSpan={2} className="border border-black">Total Acumulado</th>
					</tr>
					<tr><th className="border border-black" /><th className="border border-black">Monto</th><th className="border border-black">%</th><th className="border border-black">Monto</th><th className="border border-black">%</th></tr>
				</thead>
				<tbody>
					{dataRows.map((row, rowIndex) => {
						const instanceIndex = rowIndex === 0 ? 0 : rowIndex === 1 ? 1 : rowIndex === 4 ? 2 : null;
						return (
							<tr key={row[0]}>
								<td className="border border-black px-1 py-1 text-left">
									{instanceIndex === null ? row[0] : (
										<SourceCell
											field="concept"
											activeField={activeField}
											sourceRef={registerSource("concept", instanceIndex)}
											showOriginLabel={instanceIndex === 0}
										>
											{row[0]}
										</SourceCell>
									)}
								</td>
								{row.slice(1).map((value, cellIndex) => {
									const field = cellIndex === 0 ? "certified" : cellIndex === 1 ? "progress" : cellIndex === 2 ? "accumulated" : null;
									return (
										<td key={`${row[0]}-${cellIndex}`} className="border border-black px-1 py-1 text-right">
											{instanceIndex !== null && field ? (
												<SourceCell
													field={field}
													activeField={activeField}
													sourceRef={registerSource(field, instanceIndex)}
													showOriginLabel={instanceIndex === 0}
												>
													{value}
												</SourceCell>
											) : value}
										</td>
									);
								})}
							</tr>
						);
					})}
					<tr className="font-bold"><td className="border border-black bg-stone-100 py-1.5">Subtotal (1)</td><td className="border border-black text-right">133.467,80</td><td className="border border-black" /><td className="border border-black text-right">239.743,64</td><td className="border border-black" /></tr>
					<tr><td className="border border-black py-1.5 text-left">Fondo de Reparo</td><td className="border border-black text-right">1.510,66</td><td className="border border-black" /><td className="border border-black text-right">1.510,66</td><td className="border border-black" /></tr>
					<tr className="font-bold"><td className="border border-black bg-stone-100 py-1.5">Subtotal (2)</td><td className="border border-black text-right">131.957,14</td><td className="border border-black" /><td className="border border-black text-right">238.232,98</td><td className="border border-black" /></tr>
				</tbody>
			</table>

			<table className="mt-4 w-full table-fixed border-collapse text-[10px] font-bold">
				<tbody>
					<tr>
						<td className="w-[30%] border border-black px-1 py-1.5 text-right">Totales en Pesos</td>
						<td className="border border-black px-1 py-1.5 text-right">$ 151.851.654,77</td>
						<td className="border border-black px-1 py-1.5 text-right">$ 268.668.995,34</td>
					</tr>
				</tbody>
			</table>

			<div className="mt-16 grid grid-cols-3 text-center text-[8px] uppercase">
				<span>Representante técnico</span><span>Inspector de obra</span><span>Jefe Depto. Infraestructura</span>
			</div>
		</div>
	);
}

function ExtractedDataPanel({
	activeField,
	onActiveFieldChange,
	onClose,
}: {
	activeField: ExtractedFieldId | null;
	onActiveFieldChange: (field: ExtractedFieldId | null) => void;
	onClose: () => void;
}) {
	return (
		<section className="flex min-h-0 min-w-0 flex-col overflow-hidden border border-stroke bg-surface shadow-2xl lg:my-8">
			<div className="flex h-14 shrink-0 items-center justify-between border-b border-stroke-soft px-4">
				<h2 className="text-sm font-semibold">Datos extraídos</h2>
				<Button type="button" variant="outline" size="icon" className="size-8" onClick={onClose} aria-label="Cerrar datos extraídos">
					<X className="size-3.5" />
				</Button>
			</div>
			<div className="flex shrink-0 items-center gap-2 border-b border-stroke-soft p-3">
				<div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-stroke bg-surface px-3">
					<Search className="size-3.5 shrink-0 text-content-muted" />
					<span className="truncate text-xs text-content-muted">Buscar en esta tabla</span>
				</div>
				<Badge variant="outline" className="h-9 text-[10px]">3 filas</Badge>
				<Button type="button" variant="outline" size="icon" className="size-9" aria-label="Descargar datos">
					<Download className="size-3.5" />
				</Button>
			</div>

			<div className="min-h-0 flex-1 overflow-auto">
				<table className="w-full min-w-[790px] border-collapse text-left">
					<thead className="sticky top-0 z-10 bg-surface-recessed text-[9px] font-semibold uppercase tracking-[0.08em] text-content-muted">
						<tr>
							<th className="w-9 border-b border-r border-stroke-soft px-3 py-3">#</th>
							{extractedFields.map((field) => (
								<th
									key={field}
									className={cn(
										"border-b border-r border-stroke-soft p-0 last:border-r-0",
										activeField === field && "bg-orange-100 text-orange-950",
									)}
								>
									<button
										type="button"
										onMouseEnter={() => onActiveFieldChange(field)}
										onFocus={() => onActiveFieldChange(field)}
										onClick={() => onActiveFieldChange(field)}
										className="h-full w-full px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500"
										aria-label={`Resaltar columna ${fieldLabels[field]}`}
									>
										{fieldLabels[field]}
									</button>
								</th>
							))}
						</tr>
					</thead>
					<tbody className="text-xs">
						{extractedRows.map((row) => (
							<tr key={row.id} className="border-b border-stroke-soft">
								<td className="border-r border-stroke-soft px-3 py-3 font-mono text-[10px] text-content-muted">{row.id}</td>
								{extractedFields.map((field) => (
									<td
										key={field}
										data-ocr-column={field}
										data-highlighted={activeField === field ? "true" : undefined}
										className="border-r border-stroke-soft p-0 last:border-r-0"
									>
										<button
											type="button"
											onMouseEnter={() => onActiveFieldChange(field)}
											onFocus={() => onActiveFieldChange(field)}
											onClick={() => onActiveFieldChange(field)}
											className={cn(
												"flex min-h-11 w-full items-center px-3 text-left font-mono text-[11px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-400",
												activeField === field && "bg-orange-50 text-orange-950",
											)}
										>
											{row[field]}
										</button>
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className="flex h-11 shrink-0 items-center gap-2 border-t border-stroke-soft px-3 text-[10px] text-content-muted">
				<span className="size-2 rounded-full bg-orange-400" />
				Pasá el cursor por una columna para ver todas sus fuentes en el documento.
			</div>
		</section>
	);
}

export function OcrReviewWorkspace() {
	const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
	const [dataOpen, setDataOpen] = useState(false);
	const [activeField, setActiveField] = useState<ExtractedFieldId | null>(null);
	const [zoom, setZoom] = useState(100);

	const selectedDocument = useMemo(
		() => documents.find((document) => document.id === selectedDocumentId) ?? null,
		[selectedDocumentId],
	);

	useEffect(() => {
		if (!selectedDocument) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setSelectedDocumentId(null);
				setDataOpen(false);
				setActiveField(null);
				setZoom(100);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [selectedDocument]);

	function openDocument(id: number) {
		setSelectedDocumentId(id);
		setDataOpen(false);
		setActiveField(null);
		setZoom(100);
	}

	function closeDocument() {
		setSelectedDocumentId(null);
		setDataOpen(false);
		setActiveField(null);
		setZoom(100);
	}

	function changeActiveField(field: ExtractedFieldId | null) {
		setActiveField(field);
		setZoom(field ? 140 : 100);
	}

	function moveDocument(direction: -1 | 1) {
		if (!selectedDocument) return;
		const currentIndex = documents.findIndex((document) => document.id === selectedDocument.id);
		const nextIndex = (currentIndex + direction + documents.length) % documents.length;
		openDocument(documents[nextIndex].id);
	}

	return (
		<div className="min-h-screen bg-[#ececeb] text-content">
			<header className="border-b border-stroke-soft bg-[#ececeb] px-5 pt-4 sm:px-8">
				<div className="flex items-center justify-between gap-4">
					<div className="flex min-w-0 items-center gap-3">
						<Button type="button" size="icon" className="size-9 shrink-0 bg-orange-primary text-primary-foreground hover:bg-orange-primary/90" aria-label="Volver a obras">
							<ArrowLeft className="size-4" />
						</Button>
						<h1 className="min-w-0 truncate text-lg font-medium tracking-[-0.02em] sm:text-2xl">
							<span className="mr-2 font-semibold text-orange-600">52</span>
							LIC. PRIV. N° 21/24 · CONSTRUCCIÓN DE 12 VIVIENDAS Y OBRAS COMPLEMENTARIAS
						</h1>
						<div className="hidden shrink-0 items-center gap-1 xl:flex">
							<Button type="button" variant="outline" size="icon" className="size-8 rounded-full" aria-label="Obra anterior"><ChevronLeft className="size-3.5" /></Button>
							<Button type="button" variant="outline" size="icon" className="size-8 rounded-full" aria-label="Obra siguiente"><ChevronRight className="size-3.5" /></Button>
						</div>
					</div>
					<div className="hidden shrink-0 items-center gap-2 2xl:flex">
						<Button type="button" variant="outline" size="sm"><RefreshCw className="size-3.5" /> Recuperar</Button>
						<Button type="button" variant="outline" size="sm"><Trash2 className="size-3.5" /> Papelera</Button>
						<Button type="button" variant="destructive" size="sm"><Trash2 className="size-3.5" /> Borrar obra</Button>
					</div>
				</div>
				<nav aria-label="Secciones de obra" className="mt-5 flex items-center gap-1 overflow-x-auto pb-3 text-xs">
					{["General", "Pólizas", "Flujo"].map((item) => (
						<button key={item} type="button" className="shrink-0 rounded-md px-3 py-2 text-content-muted hover:bg-surface-recessed hover:text-content">{item}</button>
					))}
					<button type="button" className="flex shrink-0 items-center gap-2 rounded-md bg-stone-950 px-3 py-2 font-semibold text-white">
						<FolderOpen className="size-3.5" /> Documentos
					</button>
					<Badge variant="warning" className="ml-1 shrink-0 text-[10px]">23% atrasada</Badge>
				</nav>
			</header>

			<main className="p-4 sm:p-6">
				<section className="min-h-[calc(100vh-148px)] overflow-hidden rounded-xl border border-stroke-soft bg-surface">
					<div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-stroke-soft px-4 py-2">
						<div className="flex min-w-0 items-center gap-3">
							<Button type="button" variant="outline" size="icon" className="size-8 shrink-0" aria-label="Volver a carpetas">
								<ChevronLeft className="size-4" />
							</Button>
							<div className="min-w-0">
								<div className="flex items-baseline gap-2">
									<h2 className="truncate text-base font-semibold">Certificados Extraídos</h2>
									<span className="shrink-0 text-[10px] text-content-muted">13 archivos</span>
								</div>
							</div>
							<Button type="button" variant="outline" size="sm" className="hidden sm:inline-flex"><Download className="size-3.5" /> Descargar todos</Button>
							<Button type="button" variant="outline" size="sm" className="hidden sm:inline-flex"><RefreshCw className="size-3.5" /> Reprocesar todos</Button>
						</div>
						<div className="flex rounded-md border border-stroke bg-surface-recessed p-0.5">
							<button type="button" className="flex h-8 items-center gap-1.5 rounded bg-orange-primary px-3 text-[11px] font-semibold text-primary-foreground shadow-sm"><FileText className="size-3.5" /> Archivos</button>
							<button type="button" className="flex h-8 items-center gap-1.5 rounded px-3 text-[11px] font-medium text-content-secondary"><Table2 className="size-3.5" /> Tabla</button>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-x-5 gap-y-4 p-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
						{documents.map((document) => (
							<button
								key={document.id}
								type="button"
								onClick={() => openDocument(document.id)}
								className="group relative min-w-0 rounded-sm text-left outline-none transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
								aria-label={`Abrir ${document.name}`}
							>
								<div className="relative aspect-[0.78] overflow-hidden border border-stroke bg-white shadow-[0_5px_16px_-10px_rgba(0,0,0,0.28)] transition-[border-color,box-shadow] duration-150 group-hover:border-stroke-strong group-hover:shadow-[0_9px_22px_-12px_rgba(0,0,0,0.34)]">
									<DocumentThumbnail variant={document.id} />
									<span className={cn(
										"absolute right-2 top-2 grid size-7 place-items-center rounded-full border shadow-sm",
										document.status === "completed" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-rose-300 bg-rose-50 text-rose-700",
									)}>
										{document.status === "completed" ? <Check className="size-3.5" /> : <span className="text-xs font-bold">!</span>}
									</span>
								</div>
								<div className="mt-1.5 truncate bg-surface-recessed px-2 py-1.5 text-[10px] font-medium text-content-secondary">{document.shortName}</div>
							</button>
						))}
					</div>
				</section>
			</main>

			{selectedDocument ? (
				<div className="fixed inset-0 z-50 overflow-auto bg-black/42 p-3 backdrop-blur-[1px] sm:p-5" role="dialog" aria-modal="true" aria-label={selectedDocument.name}>
					<div
						className={cn(
							"mx-auto grid h-[94vh] min-h-[620px] w-full min-w-0 gap-2",
							dataOpen
								? "max-w-[1480px] grid-rows-[minmax(560px,1fr)_minmax(420px,0.9fr)] lg:grid-cols-[minmax(0,1.08fr)_minmax(560px,0.92fr)] lg:grid-rows-1"
								: "max-w-[800px] grid-cols-1",
						)}
					>
						<div className="flex min-h-0 min-w-0 flex-col overflow-hidden border border-stroke bg-surface shadow-2xl">
							<div className="flex min-h-16 shrink-0 items-center justify-between gap-4 border-b border-stroke-soft px-4 py-3">
								<div className="min-w-0">
									<div className="flex items-center gap-2">
										<h2 className="truncate text-sm font-semibold sm:text-base">{selectedDocument.name}</h2>
										<Badge variant="outline" className="hidden shrink-0 text-[9px] sm:inline-flex">Documento {selectedDocument.id}/13</Badge>
									</div>
									<div className="mt-1 flex items-center gap-2">
										<Badge variant="success" className="size-6 justify-center p-0"><Check className="size-3" /></Badge>
										<span className="text-[9px] uppercase tracking-[0.08em] text-content-muted">Certificados extraídos</span>
									</div>
								</div>
								<Button type="button" variant="outline" size="icon" className="size-8 shrink-0" onClick={closeDocument} aria-label="Cerrar documento">
									<X className="size-4" />
								</Button>
							</div>

							<div className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-stroke-soft bg-surface-recessed px-3 py-2">
								<div className="flex items-center gap-2">
									<Button type="button" variant="outline" size="icon" className="size-8" onClick={() => setZoom((value) => Math.max(80, value - 20))} aria-label="Alejar"><ZoomOut className="size-3.5" /></Button>
									<span className="w-10 text-center text-[11px] font-semibold">{zoom}%</span>
									<Button type="button" variant="outline" size="icon" className="size-8" onClick={() => setZoom((value) => Math.min(140, value + 20))} aria-label="Acercar"><ZoomIn className="size-3.5" /></Button>
								</div>
								<div className="flex items-center gap-2">
									<Button
										type="button"
										variant="secondary"
										size="sm"
										onMouseEnter={() => setDataOpen(true)}
										onFocus={() => setDataOpen(true)}
										onClick={() => setDataOpen(true)}
									>
										<Table2 className="size-3.5" /> {dataOpen ? "Datos abiertos" : "Ver datos"}
									</Button>
									<Button type="button" size="sm"><RefreshCw className="size-3.5" /> <span className="hidden sm:inline">Reprocesar OCR</span></Button>
									<Button type="button" variant="outline" size="icon" className="size-8" aria-label="Descargar documento"><Download className="size-3.5" /></Button>
									<Button type="button" variant="outline" size="icon" className="size-8" onClick={() => moveDocument(-1)} aria-label="Documento anterior"><ChevronLeft className="size-3.5" /></Button>
									<span className="text-[10px] text-content-muted">{selectedDocument.id}/13</span>
									<Button type="button" variant="outline" size="icon" className="size-8" onClick={() => moveDocument(1)} aria-label="Documento siguiente"><ChevronRight className="size-3.5" /></Button>
								</div>
							</div>

							<div className="min-h-0 flex-1 overflow-auto bg-[#d8d8d6] px-5 py-5">
								<div
									className="mx-auto w-max origin-top-left transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
									style={{ transform: `scale(${zoom / 100})`, marginBottom: `${Math.max(0, zoom - 100) * 5}px` }}
								>
									<CertificateDocument activeField={activeField} />
								</div>
							</div>
						</div>
						{dataOpen ? (
							<ExtractedDataPanel activeField={activeField} onActiveFieldChange={changeActiveField} onClose={() => { setDataOpen(false); changeActiveField(null); }} />
						) : null}
					</div>
				</div>
			) : null}
		</div>
	);
}
