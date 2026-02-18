"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
	DEFAULT_MAIN_TABLE_COLUMN_CONFIG,
	MAIN_TABLE_BASE_COLUMN_OPTIONS,
	type MainTableColumnConfig,
} from "@/components/form-table/configs/obras-detalle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

const CELL_TYPE_OPTIONS: Array<{
	value: NonNullable<MainTableColumnConfig["cellType"]>;
	label: string;
}> = [
	{ value: "text", label: "Texto" },
	{ value: "number", label: "Número" },
	{ value: "currency", label: "Moneda" },
	{ value: "date", label: "Fecha" },
	{ value: "boolean", label: "Booleano" },
	{ value: "badge", label: "Badge" },
];

const FIELD_LABEL_BY_ID = new Map(
	MAIN_TABLE_BASE_COLUMN_OPTIONS.map((option) => [option.id, option.label])
);

const describeFormulaForUser = (formula: string | undefined) => {
	if (!formula?.trim()) return "Sin fórmula definida.";
	const clean = formula.trim();
	const directMatch = clean.match(/^\[([a-zA-Z0-9_]+)\]$/);
	if (directMatch) {
		const fieldId = directMatch[1];
		const fieldLabel = FIELD_LABEL_BY_ID.get(fieldId) ?? fieldId;
		return `Toma el valor que escribas en "${fieldLabel}".`;
	}

	const friendly = clean
		.replace(/\[([a-zA-Z0-9_]+)\]/g, (_match, fieldId: string) => {
			return `"${FIELD_LABEL_BY_ID.get(fieldId) ?? fieldId}"`;
		})
		.replace(/\*/g, " × ")
		.replace(/\//g, " ÷ ")
		.replace(/\+/g, " + ")
		.replace(/-/g, " - ");
	return `Se calcula como: ${friendly}`;
};

const normalizeColumnId = (value: string) =>
	value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9_]+/g, "_")
		.replace(/^_+|_+$/g, "");

const isMainTableCellType = (
	value: string
): value is NonNullable<MainTableColumnConfig["cellType"]> =>
	value === "text" ||
	value === "number" ||
	value === "currency" ||
	value === "date" ||
	value === "boolean" ||
	value === "checkbox" ||
	value === "toggle" ||
	value === "tags" ||
	value === "link" ||
	value === "avatar" ||
	value === "image" ||
	value === "icon" ||
	value === "text-icon" ||
	value === "badge";

// Memoized row component to avoid re-rendering all rows on any change
type ConfigTableRowProps = {
	column: MainTableColumnConfig;
	index: number;
	baseOptions: typeof MAIN_TABLE_BASE_COLUMN_OPTIONS;
	onMoveUp: (index: number) => void;
	onMoveDown: (index: number) => void;
	onUpdateColumn: (index: number, updates: Partial<MainTableColumnConfig>) => void;
	onDeleteColumn: (index: number) => void;
};

const ConfigTableRow = memo(function ConfigTableRow({
	column,
	index,
	baseOptions,
	onMoveUp,
	onMoveDown,
	onUpdateColumn,
	onDeleteColumn,
}: ConfigTableRowProps) {
	const handleKindChange = (nextKind: MainTableColumnConfig["kind"]) => {
		if (nextKind === column.kind) return;
		if (nextKind === "formula") {
			const defaultFormula =
				column.formula?.trim() ||
				`[${column.baseColumnId ?? column.id}]`;
			onUpdateColumn(index, {
				kind: "formula",
				formula: defaultFormula,
				formulaFormat:
					column.formulaFormat ??
					(column.cellType === "currency" ? "currency" : "number"),
				editable: false,
			});
			return;
		}

		if (nextKind === "base") {
			const fallbackBase = baseOptions.find(
				(option) => option.id === (column.baseColumnId ?? column.id)
			);
			onUpdateColumn(index, {
				kind: "base",
				baseColumnId: fallbackBase?.id ?? baseOptions[0]?.id ?? column.id,
				formula: undefined,
				formulaFormat: undefined,
				editable: true,
			});
			return;
		}

		onUpdateColumn(index, {
			kind: "custom",
			baseColumnId: undefined,
			formula: undefined,
			formulaFormat: undefined,
			editable: true,
		});
	};

	return (
		<tr className="border-b last:border-b-0 align-top">
			<td className="px-2 py-2">
				<div className="flex items-center gap-1">
					<Button type="button" variant="ghost" size="icon" onClick={() => onMoveUp(index)}>
						<span className="sr-only">Mover columna hacia arriba</span>
						<ArrowUp className="h-4 w-4" />
					</Button>
					<Button type="button" variant="ghost" size="icon" onClick={() => onMoveDown(index)}>
						<span className="sr-only">Mover columna hacia abajo</span>
						<ArrowDown className="h-4 w-4" />
					</Button>
				</div>
			</td>
			<td className="px-2 py-2">
				<code className="text-xs">{column.id}</code>
			</td>
			<td className="px-2 py-2">
				<Input
					name={`column_label_${column.id}`}
					autoComplete="off"
					value={column.label}
					onChange={(event) => onUpdateColumn(index, { label: event.target.value })}
					className="h-8"
				/>
			</td>
			<td className="px-2 py-2">
				<Select value={column.kind} onValueChange={(value) => handleKindChange(value as MainTableColumnConfig["kind"])}>
					<SelectTrigger className="h-8">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="base">Base</SelectItem>
						<SelectItem value="formula">Calculada</SelectItem>
						<SelectItem value="custom">Personalizada</SelectItem>
					</SelectContent>
				</Select>
			</td>
			<td className="px-2 py-2">
				<Select
					value={column.cellType ?? (column.kind === "formula" ? "number" : "text")}
					onValueChange={(value) => onUpdateColumn(index, { cellType: value as any })}
				>
					<SelectTrigger className="h-8">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{CELL_TYPE_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</td>
			<td className="px-2 py-2">
				<Input
					type="number"
					name={`column_width_${column.id}`}
					autoComplete="off"
					value={column.width ?? ""}
					onChange={(event) =>
						onUpdateColumn(index, {
							width: event.target.value ? Number(event.target.value) : undefined,
						})
					}
					className="h-8"
				/>
			</td>
			<td className="px-2 py-2">
				{column.kind === "formula" ? (
					<div className="space-y-1">
						<p className="text-[11px] text-muted-foreground">
							{describeFormulaForUser(column.formula)}
						</p>
						<Input
							name={`column_formula_${column.id}`}
							autoComplete="off"
							placeholder="[campo_a] + [campo_b]"
							value={column.formula ?? ""}
							onChange={(event) => onUpdateColumn(index, { formula: event.target.value })}
							className="h-8 font-mono text-xs"
						/>
					</div>
				) : column.kind === "custom" ? (
					<span className="text-xs text-muted-foreground">
						Valor editable por obra (tenant).
					</span>
				) : (
					<div className="space-y-1">
						<p className="text-[11px] text-muted-foreground">Campo fuente para esta columna base</p>
						<Select
							value={column.baseColumnId ?? column.id}
							onValueChange={(value) => onUpdateColumn(index, { baseColumnId: value })}
						>
							<SelectTrigger className="h-8">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{baseOptions.map((option) => (
									<SelectItem key={`base-source-${option.id}`} value={option.id}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}
			</td>
			<td className="px-2 py-2">
				<div className="grid grid-cols-4 gap-x-2 gap-y-1 text-xs">
					<div className="flex items-center gap-1">
						<Switch checked={column.enabled !== false} onCheckedChange={(checked) => onUpdateColumn(index, { enabled: checked })} />
						<span>Act</span>
					</div>
					<div className="flex items-center gap-1">
						<Switch checked={column.editable !== false} disabled={column.kind === "formula"} onCheckedChange={(checked) => onUpdateColumn(index, { editable: checked })} />
						<span>Edit</span>
					</div>
					<div className="flex items-center gap-1">
						<Switch checked={column.required === true} onCheckedChange={(checked) => onUpdateColumn(index, { required: checked })} />
						<span>Req</span>
					</div>
					<div className="flex items-center gap-1">
						<Switch checked={column.enableHide !== false} onCheckedChange={(checked) => onUpdateColumn(index, { enableHide: checked })} />
						<span>Hide</span>
					</div>
					<div className="flex items-center gap-1">
						<Switch checked={column.enablePin === true} onCheckedChange={(checked) => onUpdateColumn(index, { enablePin: checked })} />
						<span>Pin</span>
					</div>
					<div className="flex items-center gap-1">
						<Switch checked={column.enableSort !== false} onCheckedChange={(checked) => onUpdateColumn(index, { enableSort: checked })} />
						<span>Sort</span>
					</div>
					<div className="flex items-center gap-1">
						<Switch checked={column.enableResize !== false} onCheckedChange={(checked) => onUpdateColumn(index, { enableResize: checked })} />
						<span>Resize</span>
					</div>
				</div>
			</td>
			<td className="px-2 py-2 text-right">
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onClick={() => {
						const confirmed = window.confirm("¿Eliminar esta columna de la configuración?");
						if (!confirmed) return;
						onDeleteColumn(index);
					}}
				>
					<span className="sr-only">Eliminar columna</span>
					<Trash2 className="h-4 w-4 text-destructive" />
				</Button>
			</td>
		</tr>
	);
});

export default function AdminMainTableConfigPage() {
	const [columns, setColumns] = useState<MainTableColumnConfig[]>([]);
	const [initialColumnsJson, setInitialColumnsJson] = useState("[]");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [newBaseColumnId, setNewBaseColumnId] = useState<string>("");
	const [formulaLabel, setFormulaLabel] = useState("");
	const [formulaExpr, setFormulaExpr] = useState("");
	const [formulaFormat, setFormulaFormat] = useState<"number" | "currency">("number");
	const [customLabel, setCustomLabel] = useState("");
	const [customId, setCustomId] = useState("");
	const [customType, setCustomType] = useState<NonNullable<MainTableColumnConfig["cellType"]>>("text");
	const draftFormulaPreview = useMemo(
		() => describeFormulaForUser(formulaExpr),
		[formulaExpr]
	);

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			setLoading(true);
			try {
				const response = await fetch("/api/main-table-config", { cache: "no-store" });
				if (!response.ok) throw new Error("No se pudo leer configuración");
				const payload = (await response.json()) as { columns?: MainTableColumnConfig[] };
				if (cancelled) return;
				if (Array.isArray(payload.columns) && payload.columns.length > 0) {
					setColumns(payload.columns);
					setInitialColumnsJson(JSON.stringify(payload.columns));
				} else {
					setColumns(DEFAULT_MAIN_TABLE_COLUMN_CONFIG);
					setInitialColumnsJson(JSON.stringify(DEFAULT_MAIN_TABLE_COLUMN_CONFIG));
				}
			} catch {
				if (!cancelled) {
					setColumns(DEFAULT_MAIN_TABLE_COLUMN_CONFIG);
					setInitialColumnsJson(JSON.stringify(DEFAULT_MAIN_TABLE_COLUMN_CONFIG));
					toast.error("No se pudo cargar la configuración actual.");
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		void load();
		return () => {
			cancelled = true;
		};
	}, []);

	const hasUnsavedChanges = useMemo(
		() => JSON.stringify(columns) !== initialColumnsJson,
		[columns, initialColumnsJson]
	);

	useEffect(() => {
		if (!hasUnsavedChanges) return;
		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = "";
		};
		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [hasUnsavedChanges]);

	const usedBaseIds = useMemo(
		() => new Set(columns.filter((c) => c.kind === "base").map((c) => c.baseColumnId ?? c.id)),
		[columns]
	);

	const availableBaseColumns = MAIN_TABLE_BASE_COLUMN_OPTIONS.filter(
		(option) => !usedBaseIds.has(option.id)
	);

	const moveColumn = (index: number, direction: -1 | 1) => {
		setColumns((prev) => {
			const nextIndex = index + direction;
			if (nextIndex < 0 || nextIndex >= prev.length) return prev;
			const next = [...prev];
			const [item] = next.splice(index, 1);
			next.splice(nextIndex, 0, item);
			return next;
		});
	};

	// Stable callbacks for memoized row component
	const handleMoveUp = useCallback((index: number) => moveColumn(index, -1), []);
	const handleMoveDown = useCallback((index: number) => moveColumn(index, 1), []);

	const handleUpdateColumn = useCallback((index: number, updates: Partial<MainTableColumnConfig>) => {
		setColumns((prev) =>
			prev.map((item, idx) => (idx === index ? { ...item, ...updates } : item))
		);
	}, []);

	const handleDeleteColumn = useCallback((index: number) => {
		setColumns((prev) => prev.filter((_, idx) => idx !== index));
	}, []);

	const addBaseColumn = () => {
		const option = MAIN_TABLE_BASE_COLUMN_OPTIONS.find((item) => item.id === newBaseColumnId);
		if (!option) return;
		setColumns((prev) => [
			...prev,
			{
				id: option.id,
				kind: "base",
				baseColumnId: option.id,
				label: option.label,
				enabled: true,
				width: option.defaultWidth,
			},
		]);
		setNewBaseColumnId("");
	};

	const addFormulaColumn = () => {
		const cleanLabel = formulaLabel.trim();
		const cleanFormula = formulaExpr.trim();
		if (!cleanLabel || !cleanFormula) {
			toast.error("Completá nombre y fórmula para la columna calculada.");
			return;
		}
		const formulaId = normalizeColumnId(cleanLabel);
		if (!formulaId) {
			toast.error("El nombre de la columna no es válido.");
			return;
		}
		if (columns.some((column) => column.id === formulaId)) {
			toast.error("Ya existe una columna con ese identificador.");
			return;
		}
		setColumns((prev) => [
			...prev,
			{
				id: formulaId,
				kind: "formula",
				label: cleanLabel,
				enabled: true,
				formula: cleanFormula,
				formulaFormat,
				width: 180,
			},
		]);
		setFormulaLabel("");
		setFormulaExpr("");
		setFormulaFormat("number");
	};

	const addCustomColumn = () => {
		const cleanLabel = customLabel.trim();
		const nextId = normalizeColumnId(customId || cleanLabel);
		if (!cleanLabel || !nextId) {
			toast.error("Completá nombre e identificador para la columna personalizada.");
			return;
		}
		if (columns.some((column) => column.id === nextId)) {
			toast.error("Ya existe una columna con ese identificador.");
			return;
		}
		if (!isMainTableCellType(customType)) {
			toast.error("Seleccioná un tipo de celda válido.");
			return;
		}
		setColumns((prev) => [
			...prev,
			{
				id: nextId,
				kind: "custom",
				label: cleanLabel,
				enabled: true,
				cellType: customType,
				width: 180,
				editable: true,
				enableHide: true,
				enableSort: true,
				enableResize: true,
			},
		]);
		setCustomLabel("");
		setCustomId("");
		setCustomType("text");
	};

	const saveConfig = async () => {
		setSaving(true);
		try {
			const response = await fetch("/api/main-table-config", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ columns }),
			});
			if (!response.ok) {
				const payload = (await response.json().catch(() => ({}))) as { error?: string };
				throw new Error(payload.error ?? "No se pudo guardar");
			}
			setInitialColumnsJson(JSON.stringify(columns));
			toast.success("Configuración guardada. La tabla principal usará este esquema por tenant.");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "No se pudo guardar configuración.");
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return <div className="p-6 text-sm text-muted-foreground">Cargando configuración...</div>;
	}

	return (
		<main className="p-6 space-y-6 max-w-7xl">
			<header>
				<h1 className="text-2xl font-semibold text-pretty">Configuración de Tabla Principal</h1>
				<p className="text-sm text-muted-foreground">
					Definí columnas por tenant para la tabla principal de Excel.
				</p>
				<p aria-live="polite" className="text-xs mt-1 text-muted-foreground">
					{hasUnsavedChanges ? "Tenés cambios sin guardar…" : "Todos los cambios están guardados."}
				</p>
			</header>

			<section className="grid gap-4 lg:grid-cols-2">
				<div className="rounded-lg border p-4 space-y-3">
					<h2 className="font-medium">Agregar Columna Base</h2>
					<div className="flex items-center gap-2">
						<Select value={newBaseColumnId} onValueChange={setNewBaseColumnId}>
							<SelectTrigger className="max-w-sm h-8">
								<SelectValue placeholder="Seleccioná una columna base" />
							</SelectTrigger>
							<SelectContent>
								{availableBaseColumns.map((option) => (
									<SelectItem key={option.id} value={option.id}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button type="button" size="sm" onClick={addBaseColumn} disabled={!newBaseColumnId}>
							<Plus className="h-4 w-4 mr-1" />
							Agregar
						</Button>
					</div>
				</div>

				<div className="rounded-lg border p-4 space-y-3">
					<h2 className="font-medium">Agregar Columna Calculada</h2>
					<p className="text-xs text-muted-foreground">
						Fórmula: <code>[contratoMasAmpliaciones] - [certificadoALaFecha]</code>
					</p>
					<p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
						Interpretación: {draftFormulaPreview}
					</p>
					<div className="grid gap-2 md:grid-cols-5">
						<Input
							name="formula_label"
							autoComplete="off"
							placeholder="Nombre"
							value={formulaLabel}
							onChange={(event) => setFormulaLabel(event.target.value)}
							className="h-8 md:col-span-2"
						/>
						<Input
							name="formula_expression"
							autoComplete="off"
							placeholder="[campo_a] - [campo_b]"
							value={formulaExpr}
							onChange={(event) => setFormulaExpr(event.target.value)}
							className="h-8 md:col-span-2"
						/>
						<Select
							value={formulaFormat}
							onValueChange={(value) => setFormulaFormat(value as "number" | "currency")}
						>
							<SelectTrigger className="h-8">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="number">Número</SelectItem>
								<SelectItem value="currency">Moneda</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<Button type="button" size="sm" onClick={addFormulaColumn}>
						<Plus className="h-4 w-4 mr-1" />
						Agregar calculada
					</Button>
				</div>
				<div className="rounded-lg border p-4 space-y-3">
					<h2 className="font-medium">Agregar Columna Personalizada</h2>
					<p className="text-xs text-muted-foreground">
						Esta columna se guarda por obra y por tenant en datos personalizados.
					</p>
					<div className="grid gap-2 md:grid-cols-5">
						<Input
							name="custom_label"
							autoComplete="off"
							placeholder="Nombre visible"
							value={customLabel}
							onChange={(event) => setCustomLabel(event.target.value)}
							className="h-8 md:col-span-2"
						/>
						<Input
							name="custom_id"
							autoComplete="off"
							placeholder="identificador_columna"
							value={customId}
							onChange={(event) => setCustomId(event.target.value)}
							className="h-8 md:col-span-2 font-mono"
						/>
						<Select
							value={customType}
							onValueChange={(value) =>
								setCustomType(value as NonNullable<MainTableColumnConfig["cellType"]>)
							}
						>
							<SelectTrigger className="h-8">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{CELL_TYPE_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<Button type="button" size="sm" onClick={addCustomColumn}>
						<Plus className="h-4 w-4 mr-1" />
						Agregar personalizada
					</Button>
				</div>
			</section>

			<section className="rounded-lg border p-4 space-y-3">
				<h2 className="font-medium">Columnas Activas</h2>
				<div className="overflow-x-auto rounded border">
					{columns.length === 0 && (
						<p className="text-sm text-muted-foreground p-4">No hay columnas configuradas.</p>
					)}
					{columns.length > 0 && (
						<table className="w-full min-w-[1400px] text-sm">
							<thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur">
								<tr className="border-b">
									<th className="px-2 py-2 text-left font-medium w-[80px]">Orden</th>
									<th className="px-2 py-2 text-left font-medium w-[140px]">ID</th>
									<th className="px-2 py-2 text-left font-medium w-[220px]">Etiqueta</th>
									<th className="px-2 py-2 text-left font-medium w-[130px]">Clase</th>
									<th className="px-2 py-2 text-left font-medium w-[140px]">Tipo celda</th>
									<th className="px-2 py-2 text-left font-medium w-[90px]">Ancho</th>
									<th className="px-2 py-2 text-left font-medium">Fórmula / Base</th>
									<th className="px-2 py-2 text-left font-medium w-[260px]">Flags</th>
									<th className="px-2 py-2 text-right font-medium w-[70px]">Acción</th>
								</tr>
							</thead>
							<tbody>
								{columns.map((column, index) => (
									<ConfigTableRow
										key={column.id}
										column={column}
										index={index}
										baseOptions={MAIN_TABLE_BASE_COLUMN_OPTIONS}
										onMoveUp={handleMoveUp}
										onMoveDown={handleMoveDown}
										onUpdateColumn={handleUpdateColumn}
										onDeleteColumn={handleDeleteColumn}
									/>
								))}
							</tbody>
						</table>
					)}
				</div>
			</section>

			<footer className="flex items-center gap-2">
				<Button type="button" onClick={saveConfig} disabled={saving}>
					<Save className="h-4 w-4 mr-1" />
					{saving ? "Guardando..." : "Guardar configuración"}
				</Button>
				<Button
					type="button"
					variant="outline"
					onClick={() => setColumns(DEFAULT_MAIN_TABLE_COLUMN_CONFIG)}
				>
					Restaurar por defecto
				</Button>
			</footer>
		</main>
	);
}
