"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
	Ban,
	AlertTriangle,
	ArrowDown,
	ArrowUp,
	Bell,
	Bookmark,
	Calendar,
	Check,
	Circle,
	Clock3,
	FileText,
	Flag,
	Info,
	Link2,
	Loader2,
	Package,
	Pause,
	Plus,
	Play,
	Save,
	Shield,
	Star,
	Trash2,
	Truck,
	User,
	Wrench,
	X,
} from "lucide-react";
import { toast } from "sonner";
import {
	DEFAULT_MAIN_TABLE_COLUMN_CONFIG,
	MAIN_TABLE_BASE_COLUMN_OPTIONS,
	type MainTableColumnConfig,
} from "@/components/form-table/configs/obras-detalle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import {
	DEFAULT_MAIN_TABLE_SELECT_OPTIONS,
	MAIN_TABLE_SELECT_COLOR_OPTIONS,
	MAIN_TABLE_SELECT_ICON_OPTIONS,
	cloneMainTableSelectOptions,
	type MainTableSelectOption,
} from "@/lib/main-table-select";

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
		{ value: "select", label: "Select" },
	];

const createDefaultSelectOptions = () =>
	cloneMainTableSelectOptions(DEFAULT_MAIN_TABLE_SELECT_OPTIONS);

const SELECT_BADGE_CLASS_BY_COLOR: Record<string, string> = {
	slate: "border-slate-300 bg-slate-100 text-slate-800",
	blue: "border-blue-300 bg-blue-100 text-blue-800",
	green: "border-emerald-300 bg-emerald-100 text-emerald-800",
	amber: "border-amber-300 bg-amber-100 text-amber-800",
	red: "border-red-300 bg-red-100 text-red-800",
	violet: "border-violet-300 bg-violet-100 text-violet-800",
};

const SELECT_ICON_BY_NAME = {
	dot: Circle,
	check: Check,
	clock: Clock3,
	alert: AlertTriangle,
	x: X,
	pause: Pause,
	play: Play,
	flag: Flag,
	star: Star,
	bookmark: Bookmark,
	bell: Bell,
	wrench: Wrench,
	shield: Shield,
	info: Info,
	ban: Ban,
	package: Package,
	truck: Truck,
	calendar: Calendar,
	user: User,
	file: FileText,
	link: Link2,
} as const;
const NO_ICON_VALUE = "__none__";

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
	value === "badge" ||
	value === "select";

const FLAG_CONFIGS: Array<{
	key: keyof MainTableColumnConfig;
	label: string;
	defaultOn: boolean;
	disabledWhen?: (col: MainTableColumnConfig) => boolean;
}> = [
		{ key: "enabled", label: "Activo", defaultOn: true },
		{ key: "editable", label: "Editable", defaultOn: true, disabledWhen: (col) => col.kind === "formula" },
		{ key: "required", label: "Req.", defaultOn: false },
		{ key: "enableHide", label: "Ocultar", defaultOn: true },
		{ key: "enablePin", label: "Fijar", defaultOn: false },
		{ key: "enableSort", label: "Ordenar", defaultOn: true },
		{ key: "enableResize", label: "Resize", defaultOn: true },
		{ key: "enableSuggestions", label: "Suger.", defaultOn: true },
	];

type ConfigTableRowProps = {
	column: MainTableColumnConfig;
	index: number;
	isSimplified: boolean;
	baseOptions: typeof MAIN_TABLE_BASE_COLUMN_OPTIONS;
	onMoveUp: (index: number) => void;
	onMoveDown: (index: number) => void;
	onUpdateColumn: (index: number, updates: Partial<MainTableColumnConfig>) => void;
	onDeleteColumn: (index: number) => void;
};

const ConfigTableRow = memo(function ConfigTableRow({
	column,
	index,
	isSimplified,
	baseOptions,
	onMoveUp,
	onMoveDown,
	onUpdateColumn,
	onDeleteColumn,
}: ConfigTableRowProps) {
	const handleKindChange = (nextKind: MainTableColumnConfig["kind"]) => {
		if (nextKind === column.kind) return;
		if (nextKind === "formula") {
			onUpdateColumn(index, {
				kind: "formula",
				formula: column.formula?.trim() || `[${column.baseColumnId ?? column.id}]`,
				formulaFormat: column.formulaFormat ?? (column.cellType === "currency" ? "currency" : "number"),
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
	const selectOptions = useMemo<MainTableSelectOption[]>(() => {
		if (!Array.isArray(column.selectOptions)) return [];
		return column.selectOptions.map((option, optionIndex) => {
			const optionLike = option as Record<string, unknown>;
			const legacyLabel =
				typeof optionLike.label === "string" ? optionLike.label : "";
			return {
				text:
					typeof option?.text === "string" && option.text.length > 0
						? option.text
						: legacyLabel.length > 0
							? legacyLabel
							: `Opcion ${optionIndex + 1}`,
				color:
					typeof option?.color === "string"
						? (option.color as MainTableSelectOption["color"])
						: "slate",
				icon:
					typeof option?.icon === "string"
						? (option.icon as MainTableSelectOption["icon"])
						: undefined,
			};
		});
	}, [column.selectOptions]);
	const updateSelectOptions = (nextOptions: MainTableSelectOption[]) => {
		onUpdateColumn(index, { selectOptions: nextOptions });
	};
	const updateSelectOptionAt = (
		optionIndex: number,
		updates: Partial<MainTableSelectOption>
	) => {
		const next = selectOptions.map((option, idx) =>
			idx === optionIndex ? { ...option, ...updates } : option
		);
		updateSelectOptions(next);
	};
	const removeSelectOptionAt = (optionIndex: number) => {
		updateSelectOptions(selectOptions.filter((_, idx) => idx !== optionIndex));
	};
	const addSelectOption = () => {
		updateSelectOptions([
			...selectOptions,
			{
				text: `Opcion ${selectOptions.length + 1}`,
				color: "slate",
				icon: "dot",
			},
		]);
	};
	const handleCellTypeChange = (nextType: NonNullable<MainTableColumnConfig["cellType"]>) => {
		if (nextType === "select" && selectOptions.length === 0) {
			onUpdateColumn(index, {
				cellType: nextType,
				selectOptions: createDefaultSelectOptions(),
			});
			return;
		}
		onUpdateColumn(index, { cellType: nextType });
	};

	return (
		<tr className="border-b last:border-b-0 align-top transition-colors hover:bg-muted/20">
			{/* Orden */}
			<td className="px-5 py-4">
				<div className="flex flex-col items-center gap-0.5">
					<Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => onMoveUp(index)}>
						<span className="sr-only">Mover hacia arriba</span>
						<ArrowUp className="h-3.5 w-3.5" />
					</Button>
					<Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => onMoveDown(index)}>
						<span className="sr-only">Mover hacia abajo</span>
						<ArrowDown className="h-3.5 w-3.5" />
					</Button>
				</div>
			</td>

			{/* ID */}
			<td className="px-5 py-4">
				<code className="rounded-lg bg-muted/60 px-1.5 py-0.5 text-[11px] font-mono">
					{column.id}
				</code>
			</td>

			{/* Etiqueta */}
			<td className="px-5 py-4">
				<Input
					name={`column_label_${column.id}`}
					autoComplete="off"
					value={column.label}
					onChange={(event) => onUpdateColumn(index, { label: event.target.value })}
					className="h-8"
				/>
			</td>

			{/* Tipo de celda (always visible) */}
			<td className="px-5 py-4">
				<Select
					value={column.cellType ?? (column.kind === "formula" ? "number" : "text")}
					onValueChange={(value) =>
						handleCellTypeChange(value as NonNullable<MainTableColumnConfig["cellType"]>)
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
			</td>
			<td className="px-5 py-4 min-w-[360px]">
				{(column.cellType ?? (column.kind === "formula" ? "number" : "text")) === "select" ? (
					<div className="space-y-2">
						<div className="grid grid-cols-[1fr_120px_110px_220px_34px] gap-1.5 px-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
							<span>Titulo</span>
							<span>Color</span>
							<span>Icono</span>
							<span>Preview</span>
							<span />
						</div>
						{selectOptions.length === 0 ? (
							<p className="text-xs text-muted-foreground">Sin opciones definidas.</p>
						) : (
							selectOptions.map((option, optionIndex) => (
								<div
									key={`${column.id}-opt-${optionIndex}`}
									className="grid grid-cols-[1fr_120px_110px_220px_34px] gap-1.5"
								>
									<Input
										name={`column_${column.id}_option_${optionIndex}_label`}
										autoComplete="off"
										value={option.text}
										onChange={(event) =>
											updateSelectOptionAt(optionIndex, { text: event.target.value })
										}
										className="h-8"
										placeholder="Titulo de opcion"
									/>
									<Select
										value={option.color ?? "slate"}
										onValueChange={(value) =>
											updateSelectOptionAt(optionIndex, {
												color: value as MainTableSelectOption["color"],
											})
										}
									>
										<SelectTrigger className="h-8">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{MAIN_TABLE_SELECT_COLOR_OPTIONS.map((colorOption) => (
												<SelectItem key={colorOption.value} value={colorOption.value}>
													{colorOption.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<Select
										value={option.icon ?? NO_ICON_VALUE}
										onValueChange={(value) =>
											updateSelectOptionAt(optionIndex, {
												icon:
													value === NO_ICON_VALUE
														? undefined
														: (value as MainTableSelectOption["icon"]),
											})
										}
									>
										<SelectTrigger className="h-8">
											{(() => {
												const currentIconValue = option.icon ?? NO_ICON_VALUE;
												if (currentIconValue === NO_ICON_VALUE) {
													return <span className="text-sm">Sin icono</span>;
												}
												const IconComponent = SELECT_ICON_BY_NAME[currentIconValue];
												const iconLabel = MAIN_TABLE_SELECT_ICON_OPTIONS.find(
													(iconOption) => iconOption.value === currentIconValue
												)?.label;
												return (
													<div className="flex items-center gap-2 text-sm">
														<IconComponent className="h-3.5 w-3.5" />
														<span>{iconLabel ?? "Icono"}</span>
													</div>
												);
											})()}
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={NO_ICON_VALUE}>
												<span>Sin icono</span>
											</SelectItem>
											{MAIN_TABLE_SELECT_ICON_OPTIONS.map((iconOption) => (
												<SelectItem key={iconOption.value} value={iconOption.value}>
													<div className="flex items-center gap-2">
														{(() => {
															const IconComponent = SELECT_ICON_BY_NAME[iconOption.value];
															return <IconComponent className="h-3.5 w-3.5" />;
														})()}
														<span>{iconOption.label}</span>
													</div>
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<div className="flex items-center gap-2 rounded-md border px-2 py-1.5">
										{(() => {
											const IconComponent = option.icon
												? SELECT_ICON_BY_NAME[option.icon]
												: null;
											return (
												<>
													<Badge
														variant="outline"
														className={cn(
															"max-w-[120px] gap-1 overflow-hidden text-ellipsis whitespace-nowrap",
															option.color ? SELECT_BADGE_CLASS_BY_COLOR[option.color] : null
														)}
													>
														{IconComponent ? <IconComponent className="h-3 w-3" /> : null}
														<span>{option.text || "Sin titulo"}</span>
													</Badge>
												</>
											);
										})()}
									</div>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="h-8 w-8"
										onClick={() => removeSelectOptionAt(optionIndex)}
									>
										<span className="sr-only">Eliminar opción</span>
										<Trash2 className="h-4 w-4 text-destructive" />
									</Button>
								</div>
							))
						)}
						<Button type="button" variant="outline" size="sm" onClick={addSelectOption}>
							<Plus className="mr-1 h-3.5 w-3.5" />
							Agregar opcion
						</Button>
					</div>
				) : (
					<span className="text-xs text-muted-foreground">Solo para tipo Select</span>
				)}
			</td>

			{/* Advanced-only columns */}
			{!isSimplified && (
				<>
					{/* Clase */}
					<td className="px-5 py-4">
						<Select
							value={column.kind}
							onValueChange={(value) => handleKindChange(value as MainTableColumnConfig["kind"])}
						>
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

					{/* Ancho */}
					<td className="px-5 py-4">
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

					{/* Fórmula / Fuente */}
					<td className="px-5 py-4">
						{column.kind === "formula" ? (
							<div className="space-y-2">
								<div className="rounded-2xl bg-muted/40 px-3 py-2.5">
									<p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Interpretación</p>
									<p className="mt-1 text-[11px] leading-relaxed text-foreground/70">
										{describeFormulaForUser(column.formula)}
									</p>
								</div>
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
							<p className="text-xs text-muted-foreground">
								Valor editable por obra (tenant).
							</p>
						) : (
							<div className="space-y-1.5">
								<p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Campo fuente</p>
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

					{/* Flags */}
					<td className="px-5 py-4">
						<div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
							{FLAG_CONFIGS.map(({ key, label, defaultOn, disabledWhen }) => {
								const rawValue = column[key];
								const checked = typeof rawValue === "boolean" ? rawValue : defaultOn;
								const disabled = disabledWhen?.(column) ?? false;
								return (
									<div key={key} className="flex items-center gap-1.5">
										<Switch
											checked={checked}
											disabled={disabled}
											onCheckedChange={(value) => onUpdateColumn(index, { [key]: value })}
										/>
										<span className={cn(disabled && "text-muted-foreground/40")}>{label}</span>
									</div>
								);
							})}
						</div>
					</td>

					{/* Acción */}
					<td className="px-5 py-4 text-right">
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-8 w-8"
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
				</>
			)}
		</tr>
	);
});

export default function AdminMainTableConfigPage() {
	const [columns, setColumns] = useState<MainTableColumnConfig[]>([]);
	const [initialColumnsJson, setInitialColumnsJson] = useState("[]");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [isSimplified, setIsSimplified] = useState(true);
	const [isAdmin, setIsAdmin] = useState(false);

	// Add column form state
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

	// Check if the current user is admin or owner
	useEffect(() => {
		const checkIsAdmin = async () => {
			try {
				const supabase = createSupabaseBrowserClient();
				const { data: { user } } = await supabase.auth.getUser();
				if (!user) return;
				const { data } = await supabase
					.from("memberships")
					.select("role")
					.eq("user_id", user.id)
					.in("role", ["owner", "admin"]);
				setIsAdmin((data?.length ?? 0) > 0);
			} catch {
				// silently ignore — toggle stays hidden
			}
		};
		void checkIsAdmin();
	}, []);

	// Load config
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
		return () => { cancelled = true; };
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
				enableSuggestions: true,
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
		if (!formulaId) { toast.error("El nombre de la columna no es válido."); return; }
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
				enableSuggestions: true,
			},
		]);
		setFormulaLabel(""); setFormulaExpr(""); setFormulaFormat("number");
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
		if (!isMainTableCellType(customType)) { toast.error("Seleccioná un tipo de celda válido."); return; }
		setColumns((prev) => [
			...prev,
			{
				id: nextId,
				kind: "custom",
				label: cleanLabel,
				enabled: true,
				cellType: customType,
				selectOptions: customType === "select" ? createDefaultSelectOptions() : undefined,
				width: 180,
				editable: true,
				enableHide: true,
				enableSort: true,
				enableResize: true,
				enableSuggestions: true,
			},
		]);
		setCustomLabel(""); setCustomId(""); setCustomType("text");
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
		return (
			<div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
				<Loader2 className="h-4 w-4 animate-spin" />
				Cargando configuración…
			</div>
		);
	}

	return (
		<div className="space-y-8 p-6">

			{/* Header */}
			<div className="flex items-start justify-between gap-6">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">
						Configuración de Tabla Principal
					</h1>
					<p className="mt-1 text-sm leading-6 text-muted-foreground">
						Definí columnas por tenant para la tabla principal de obras.
					</p>
					<p aria-live="polite" className="mt-0.5 text-xs text-muted-foreground">
						{hasUnsavedChanges ? "Tenés cambios sin guardar…" : "Todos los cambios guardados."}
					</p>
				</div>

				{/* Simplified / Advanced toggle — only visible to admins */}
				{isAdmin && (
					<div className="shrink-0 grid grid-cols-2 overflow-hidden rounded-2xl border">
						<button
							type="button"
							onClick={() => setIsSimplified(true)}
							className={cn(
								"px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] transition-colors",
								isSimplified
									? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
									: "bg-background text-muted-foreground hover:text-foreground"
							)}
						>
							Simplificado
						</button>
						<button
							type="button"
							onClick={() => setIsSimplified(false)}
							className={cn(
								"px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] transition-colors",
								!isSimplified
									? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
									: "bg-background text-muted-foreground hover:text-foreground"
							)}
						>
							Avanzado
						</button>
					</div>
				)}
			</div>

			{/* Add column panels — advanced only */}
			{!isSimplified && (
				<section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">

					{/* Base column */}
					<div className="rounded-3xl border bg-background p-5 space-y-4">
						<div>
							<p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tipo base</p>
							<h3 className="mt-1.5 text-base font-semibold">Columna Base</h3>
							<p className="mt-1 text-sm text-muted-foreground">
								Campo directo del modelo de obras, sin transformación.
							</p>
						</div>
						<div className="space-y-2">
							<Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
								Campo fuente
							</Label>
							<Select value={newBaseColumnId} onValueChange={setNewBaseColumnId}>
								<SelectTrigger>
									<SelectValue placeholder="Seleccioná un campo…" />
								</SelectTrigger>
								<SelectContent>
									{availableBaseColumns.map((option) => (
										<SelectItem key={option.id} value={option.id}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex items-center justify-between border-t pt-4">
							<span className="text-xs text-muted-foreground">
								{availableBaseColumns.length} campos disponibles
							</span>
							<Button
								type="button"
								size="sm"
								onClick={addBaseColumn}
								disabled={!newBaseColumnId}
								className="bg-orange-500 hover:bg-orange-600 active:scale-[0.97] transition-transform"
							>
								<Plus className="h-4 w-4 mr-1" />
								Agregar
							</Button>
						</div>
					</div>

					{/* Formula column */}
					<div className="rounded-3xl border bg-background p-5 space-y-4">
						<div>
							<p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tipo calculada</p>
							<h3 className="mt-1.5 text-base font-semibold">Columna Calculada</h3>
							<p className="mt-1 text-sm text-muted-foreground">
								Se computa a partir de otros campos mediante una fórmula.
							</p>
						</div>
						<div className="rounded-2xl bg-muted/40 px-4 py-3">
							<p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Interpretación</p>
							<p className="mt-1 text-sm text-foreground/70">{draftFormulaPreview}</p>
						</div>
						<div className="grid gap-3 sm:grid-cols-2">
							<div className="space-y-2">
								<Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
									Nombre <span className="text-orange-500">*</span>
								</Label>
								<Input
									name="formula_label"
									autoComplete="off"
									placeholder="Saldo pendiente"
									value={formulaLabel}
									onChange={(event) => setFormulaLabel(event.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Formato</Label>
								<Select value={formulaFormat} onValueChange={(value) => setFormulaFormat(value as "number" | "currency")}>
									<SelectTrigger><SelectValue /></SelectTrigger>
									<SelectContent>
										<SelectItem value="number">Número</SelectItem>
										<SelectItem value="currency">Moneda</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
						<div className="space-y-2">
							<Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
								Expresión <span className="text-orange-500">*</span>
							</Label>
							<Input
								name="formula_expression"
								autoComplete="off"
								placeholder="[campo_a] - [campo_b]"
								value={formulaExpr}
								onChange={(event) => setFormulaExpr(event.target.value)}
								className="font-mono text-sm"
							/>
						</div>
						<div className="flex justify-end border-t pt-4">
							<Button
								type="button"
								size="sm"
								onClick={addFormulaColumn}
								className="bg-orange-500 hover:bg-orange-600 active:scale-[0.97] transition-transform"
							>
								<Plus className="h-4 w-4 mr-1" />
								Agregar calculada
							</Button>
						</div>
					</div>

					{/* Custom column */}
					<div className="rounded-3xl border bg-background p-5 space-y-4">
						<div>
							<p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tipo personalizada</p>
							<h3 className="mt-1.5 text-base font-semibold">Columna Personalizada</h3>
							<p className="mt-1 text-sm text-muted-foreground">
								Se guarda por obra y por tenant en datos personalizados.
							</p>
						</div>
						<div className="grid gap-3 sm:grid-cols-2">
							<div className="space-y-2">
								<Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
									Nombre visible <span className="text-orange-500">*</span>
								</Label>
								<Input
									name="custom_label"
									autoComplete="off"
									placeholder="Mi columna"
									value={customLabel}
									onChange={(event) => setCustomLabel(event.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Tipo de celda</Label>
								<Select value={customType} onValueChange={(value) => setCustomType(value as NonNullable<MainTableColumnConfig["cellType"]>)}>
									<SelectTrigger><SelectValue /></SelectTrigger>
									<SelectContent>
										{CELL_TYPE_OPTIONS.map((option) => (
											<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
						<div className="space-y-2">
							<Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Identificador</Label>
							<Input
								name="custom_id"
								autoComplete="off"
								placeholder="identificador_columna (auto si está vacío)"
								value={customId}
								onChange={(event) => setCustomId(event.target.value)}
								className="font-mono text-sm"
							/>
						</div>
						<div className="flex justify-end border-t pt-4">
							<Button
								type="button"
								size="sm"
								onClick={addCustomColumn}
								className="bg-orange-500 hover:bg-orange-600 active:scale-[0.97] transition-transform"
							>
								<Plus className="h-4 w-4 mr-1" />
								Agregar personalizada
							</Button>
						</div>
					</div>
				</section>
			)}

			{/* Active columns */}
			<section className="space-y-4">
				<div className="flex items-center justify-between">
					<div className="space-y-1">
						<p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">
							Columnas activas
						</p>
						<p className="text-sm text-muted-foreground">
							{columns.length === 0
								? "No hay columnas configuradas."
								: `${columns.length} ${columns.length === 1 ? "columna definida" : "columnas definidas"} para la tabla principal.`}
						</p>
					</div>
				</div>

				<div className="overflow-x-auto rounded-3xl border">
					{columns.length === 0 ? (
						<div className="p-10 text-center text-sm text-muted-foreground">
							{isSimplified
								? "No hay columnas configuradas."
								: "Agregá al menos una columna desde los paneles de arriba."}
						</div>
					) : (
						<table className={cn("w-full text-sm", !isSimplified && "min-w-[1760px]")}>
							<thead>
								<tr className="border-b">
									<th className="w-[72px] px-5 py-3 text-left text-xs uppercase tracking-[0.16em] text-muted-foreground font-medium">Orden</th>
									<th className="w-[160px] px-5 py-3 text-left text-xs uppercase tracking-[0.16em] text-muted-foreground font-medium">ID</th>
									<th className="px-5 py-3 text-left text-xs uppercase tracking-[0.16em] text-muted-foreground font-medium">Etiqueta</th>
									<th className="w-[140px] px-5 py-3 text-left text-xs uppercase tracking-[0.16em] text-muted-foreground font-medium">Tipo de celda</th>
									<th className="min-w-[360px] px-5 py-3 text-left text-xs uppercase tracking-[0.16em] text-muted-foreground font-medium">Opciones Select</th>
									{!isSimplified && (
										<>
											<th className="w-[130px] px-5 py-3 text-left text-xs uppercase tracking-[0.16em] text-muted-foreground font-medium">Clase</th>
											<th className="w-[90px] px-5 py-3 text-left text-xs uppercase tracking-[0.16em] text-muted-foreground font-medium">Ancho</th>
											<th className="px-5 py-3 text-left text-xs uppercase tracking-[0.16em] text-muted-foreground font-medium">Fórmula / Fuente</th>
											<th className="w-[240px] px-5 py-3 text-left text-xs uppercase tracking-[0.16em] text-muted-foreground font-medium">Flags</th>
											<th className="w-[64px] px-5 py-3 text-right text-xs uppercase tracking-[0.16em] text-muted-foreground font-medium">Acc.</th>
										</>
									)}
								</tr>
							</thead>
							<tbody>
								{columns.map((column, index) => (
									<ConfigTableRow
										key={column.id}
										column={column}
										index={index}
										isSimplified={isSimplified}
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

			{/* Footer */}
			<div className="flex items-center justify-between gap-4 border-t pt-5">
				{!isSimplified && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="text-muted-foreground"
						onClick={() => setColumns(DEFAULT_MAIN_TABLE_COLUMN_CONFIG)}
					>
						Restaurar por defecto
					</Button>
				)}
				<div className={cn("flex gap-3", isSimplified && "ml-auto")}>
					<Button
						type="button"
						onClick={saveConfig}
						disabled={saving}
						className="bg-orange-500 hover:bg-orange-600 active:scale-[0.97] transition-transform"
					>
						{saving ? (
							<Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
						) : (
							<Save className="h-4 w-4 mr-1.5" />
						)}
						{saving ? "Guardando…" : "Guardar configuración"}
					</Button>
				</div>
			</div>

		</div>
	);
}
