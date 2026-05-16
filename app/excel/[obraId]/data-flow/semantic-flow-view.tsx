"use client";

import {
  Check,
  ChevronRight,
  Database,
  Download,
  FileJson,
  Loader2,
  Pencil,
  Plus,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  Fragment,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  BuilderAggregation,
  BuilderCalculation,
  BuilderConfig,
  BuilderFormulaInput,
  BuilderResult,
  BuilderSourceType,
  DataFlowConfigPayload,
} from "./page-client";

type SemanticColorTokens = {
  background: string;
  border: string;
  color: string;
};

type NsNodeKind = "resultado" | "formula" | "origen" | "dato" | "texto" | "input";
type NsState = "normal" | "warning" | "error" | "editing" | "unsaved" | "no-calc" | "imported-broken";
type CalculationEditKind = BuilderCalculation["mode"] | "obra_field";

type BuilderValidationIssue = {
  level: "error" | "warning";
  path: string;
  message: string;
};

type SemanticTree = {
  calculation: BuilderCalculation;
  children: SemanticTree[];
};

function humanizeFieldKey(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function makeClientId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getBuilderSourceLabel(payload: DataFlowConfigPayload | null, sourceType: string, sourceId: string): string {
  if (sourceType === "calculation") {
    const calc = [
      ...(payload?.inheritedConfig?.calculations ?? []),
      ...(payload?.effectiveConfig?.calculations ?? []),
      ...(payload?.config.calculations ?? []),
    ].find(c => c.id === sourceId);
    return calc?.label ?? humanizeFieldKey(sourceId);
  }
  if (sourceType === "obra_field") {
    return payload?.sources.obraFields.find(f => f.id === sourceId)?.label ?? humanizeFieldKey(sourceId);
  }
  const col = sourceType === "macro_table" ? payload?.sources.macroTables : payload?.sources.tables;
  return col?.find(s => s.id === sourceId)?.name ?? humanizeFieldKey(sourceId);
}

function getBuilderFieldLabel(payload: DataFlowConfigPayload | null, sourceType: string, sourceId: string, fieldKey: string | null): string {
  if (!fieldKey) return "sin columna";
  const collection = sourceType === "macro_table" ? payload?.sources.macroTables : payload?.sources.tables;
  const source = collection?.find(s => s.id === sourceId);
  return source?.columns.find(c => c.key === fieldKey)?.label ?? humanizeFieldKey(fieldKey);
}

function validateBuilderConfig(config: BuilderConfig): BuilderValidationIssue[] {
  const issues: BuilderValidationIssue[] = [];
  const calculations = config.calculations.filter(c => !c.deleted);
  const calcIds = new Set(calculations.map(c => c.id));
  for (const result of config.results.filter(r => !r.deleted)) {
    if (result.calculationId && !calcIds.has(result.calculationId)) {
      issues.push({ level: "warning", path: `results.${result.id}`, message: `Cálculo referenciado no existe: ${result.calculationId}` });
    }
  }
  return issues;
}

function formatValidationIssues(issues: BuilderValidationIssue[]): string {
  return issues.map(i => `${i.level === "error" ? "Error" : "Advertencia"} en ${i.path}: ${i.message}`).join("\n");
}

function groupValidationIssuesByPathId(issues: BuilderValidationIssue[], segment: string): Map<string, BuilderValidationIssue[]> {
  const map = new Map<string, BuilderValidationIssue[]>();
  for (const issue of issues) {
    const parts = issue.path.split(".");
    for (let idx = 0; idx < parts.length - 1; idx += 1) {
      if (parts[idx] !== segment || !parts[idx + 1]) continue;
      const id = parts[idx + 1];
      const existing = map.get(id) ?? [];
      existing.push(issue);
      map.set(id, existing);
    }
  }
  return map;
}

const SEMANTIC_CALC_COLORS: SemanticColorTokens[] = [
  { background: "#fff7ed", border: "rgba(249,115,22,.4)", color: "#c2410c" },
  { background: "#eff6ff", border: "rgba(59,130,246,.4)", color: "#1d4ed8" },
  { background: "#f0fdf4", border: "rgba(34,197,94,.4)", color: "#15803d" },
  { background: "#fdf4ff", border: "rgba(168,85,247,.4)", color: "#7e22ce" },
  { background: "#fff1f2", border: "rgba(244,63,94,.4)", color: "#be123c" },
  { background: "#f0fdfa", border: "rgba(20,184,166,.4)", color: "#0f766e" },
  { background: "#fefce8", border: "rgba(234,179,8,.4)", color: "#a16207" },
];

function getSemanticCalculationColor(index: number): SemanticColorTokens {
  return SEMANTIC_CALC_COLORS[index % SEMANTIC_CALC_COLORS.length] ?? SEMANTIC_CALC_COLORS[0]!;
}
/* =========================================================================
   Nodos Semánticos - atom components
   ========================================================================= */

function NsWord({ children, em }: { children: ReactNode; em?: boolean }) {
  return (
    <span className={em ? "ns-word ns-word-em" : "ns-word"}>
      {children}
    </span>
  );
}

function NsVal({ children }: { children: ReactNode }) {
  return (
    <span className="ns-val">
      {children}
    </span>
  );
}

function NsChip({ children, color, big }: { children: ReactNode; color: SemanticColorTokens; big?: boolean }) {
  return (
    <span
      className={big ? "ns-chip ns-chip-big" : "ns-chip"}
      style={{ color: color.color, background: color.background, borderColor: color.border }}
    >
      <span className="ns-chip-dot" style={{ background: color.color }} />
      {children}
    </span>
  );
}

const NS_KIND_META: Record<NsNodeKind, { label: string; letter: string; bg: string; color: string }> = {
  resultado: { label: "RESULTADO", letter: "◎", bg: "#f5f5f4", color: "#78716c" },
  formula:   { label: "FÓRMULA",   letter: "ƒ",  bg: "#f5f3ff", color: "#6d28d9" },
  origen:    { label: "ORIGEN",    letter: "⊟", bg: "#ecfdf5", color: "#059669" },
  dato:      { label: "DATO",      letter: "⊙", bg: "#eff6ff", color: "#2563eb" },
  texto:     { label: "TEXTO",     letter: "\"", bg: "#fef9c3", color: "#a16207" },
  input:     { label: "INPUT",     letter: "→", bg: "#f0fdf4", color: "#15803d" },
};

function NsTypeIcon({ kind, color }: { kind: NsNodeKind; color?: SemanticColorTokens }) {
  const meta = NS_KIND_META[kind] ?? NS_KIND_META.dato;
  return (
    <span
      className="ns-type-icon"
      style={{
        background: color ? color.background : meta.bg,
        borderColor: color ? color.border : meta.color + "33",
        color: color ? color.color : meta.color,
      }}
    >
      {meta.letter}
    </span>
  );
}

function NsPreviewPill({ value }: { value?: string | null }) {
  if (!value) return null;
  return (
    <span className="ns-preview-pill">
      {value}
    </span>
  );
}

const NS_STATE_STYLES: Record<NsState, { bg: string; border: string; color: string; label: string }> = {
  normal: { bg: "#f0fdf4", border: "rgba(34,197,94,.3)", color: "#15803d", label: "OK" },
  warning: { bg: "#fef9c3", border: "rgba(234,179,8,.4)", color: "#a16207", label: "Advertencia" },
  error: { bg: "#fef2f2", border: "rgba(239,68,68,.4)", color: "#b91c1c", label: "Error" },
  editing: { bg: "#fff7ed", border: "rgba(249,115,22,.4)", color: "#c2410c", label: "Editando" },
  unsaved: { bg: "#fef9c3", border: "rgba(234,179,8,.4)", color: "#a16207", label: "Sin guardar" },
  "no-calc": { bg: "#f5f5f4", border: "rgba(120,113,108,.3)", color: "#78716c", label: "Sin cálculo" },
  "imported-broken": { bg: "#fef9c3", border: "rgba(234,179,8,.4)", color: "#a16207", label: "Importado con errores" },
};

function NsStatePill({ state, message }: { state: NsState; message?: string }) {
  const s = NS_STATE_STYLES[state] ?? NS_STATE_STYLES.normal;
  return (
    <span className="ns-state-pill" style={{ color: s.color, background: s.bg, borderColor: s.border }}>
      {message ?? s.label}
    </span>
  );
}

function NsRowActions({ onEdit, onDelete }: { onEdit?: () => void; onDelete?: () => void }) {
  return (
    <span className="ns-row-actions" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          title="Editar"
          style={{
            width: 24, height: 24,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: "#fff", border: "1px solid var(--df-stone-200)",
            borderRadius: 5, cursor: "pointer", color: "var(--df-stone-600)",
          }}
        >
          <Pencil size={11} />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          title="Eliminar"
          style={{
            width: 24, height: 24,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: "#fff", border: "1px solid var(--df-stone-200)",
            borderRadius: 5, cursor: "pointer", color: "#b91c1c",
          }}
        >
          <X size={11} />
        </button>
      )}
    </span>
  );
}

function NsEditShell({ children, onCancel, hint }: { children: ReactNode; onCancel: () => void; hint?: ReactNode }) {
  return (
    <div className="ns-edit-shell">
      <button
        type="button"
        onClick={onCancel}
        className="ns-edit-close"
        title="Cerrar edición"
      >
        <X size={11} />
      </button>
      {hint}
      {children}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onCancel}
          className="ns-edit-approve"
          title="Aceptar edición"
        >
          <Check size={12} />
        </button>
      </div>
    </div>
  );
}

/* =========================================================================
   buildSemanticTree - top-level helper
   ========================================================================= */
function buildSemanticTree(
  rootId: string,
  calculationById: Map<string, BuilderCalculation>,
  visited: Set<string> = new Set()
): SemanticTree | null {
  if (visited.has(rootId)) return null;
  const calc = calculationById.get(rootId);
  if (!calc) return null;
  visited.add(rootId);
  const inputs = calc.mode === "formula" || calc.mode === "text_template" ? calc.inputs : [];
  const children: SemanticTree[] = [];
  for (const input of inputs) {
    if (input.sourceType === "calculation") {
      const child = buildSemanticTree(input.sourceId, calculationById, new Set(visited));
      if (child) children.push(child);
    }
  }
  return { calculation: calc, children };
}

/* =========================================================================
   SemanticFlowView
   ========================================================================= */
export function SemanticFlowView({
  payload,
  config,
  saving,
  canWrite,
  error,
  onApplyConfig,
}: {
  payload: DataFlowConfigPayload | null;
  config: BuilderConfig;
  saving: boolean;
  canWrite: boolean;
  error: string | null;
  onApplyConfig: (updater: (baseConfig: BuilderConfig) => BuilderConfig) => Promise<void>;
}) {
  const [actionType, setActionType] = useState("aggregate");
  const [actionLabel, setActionLabel] = useState("");
  const [sourceValue, setSourceValue] = useState("");
  const [fieldKey] = useState("");
  const [aggregation, setAggregation] = useState<BuilderAggregation>("latest");
  const [formulaExpression, setFormulaExpression] = useState("");
  const [semanticScope, setSemanticScope] = useState<"result" | "all">("result");
  const [focusResultId, setFocusResultId] = useState("");
  const [expandedSemanticResultIds, setExpandedSemanticResultIds] = useState<Set<string>>(new Set());
  const [editingCalculationId, setEditingCalculationId] = useState<string | null>(null);
  const [editingInputId, setEditingInputId] = useState<string | null>(null);
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [draftLocalConfig, setDraftLocalConfig] = useState<BuilderConfig>(config);
  const [draftEffectiveConfig, setDraftEffectiveConfig] = useState<BuilderConfig>(payload?.effectiveConfig ?? config);
  const [hasSemanticDraftChanges, setHasSemanticDraftChanges] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonStatus, setJsonStatus] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!hasSemanticDraftChanges) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraftLocalConfig(config);
      setDraftEffectiveConfig(payload?.effectiveConfig ?? config);
    }
  }, [config, hasSemanticDraftChanges, payload?.effectiveConfig]);

  const effectiveConfig = draftEffectiveConfig;
  const calculations = useMemo(() => effectiveConfig.calculations.filter(c => !c.deleted), [effectiveConfig.calculations]);
  const results = useMemo(
    () => effectiveConfig.results.filter(r => !r.deleted).toSorted((a, b) => (a.generalTabOrder ?? 0) - (b.generalTabOrder ?? 0)),
    [effectiveConfig.results]
  );
  const calculationById = useMemo(() => new Map(calculations.map(c => [c.id, c])), [calculations]);
  const effectiveFocusResultId = useMemo(
    () => (focusResultId && results.some(r => r.id === focusResultId) ? focusResultId : results[0]?.id ?? ""),
    [focusResultId, results]
  );
  const focusedResult = useMemo(() => results.find(r => r.id === effectiveFocusResultId) ?? null, [effectiveFocusResultId, results]);
  const allCalculationColorById = useMemo(
    () => new Map(calculations.map((c, i) => [c.id, getSemanticCalculationColor(i)])),
    [calculations]
  );
  const aggregateSources = useMemo(() => [
    ...(payload?.sources.tables ?? []).map(t => ({ id: t.id, name: t.name, type: "table" as const })),
    ...(payload?.sources.macroTables ?? []).map(t => ({ id: t.id, name: t.name, type: "macro_table" as const })),
  ], [payload?.sources.macroTables, payload?.sources.tables]);
  const validationIssues = useMemo(() => validateBuilderConfig(effectiveConfig), [effectiveConfig]);
  const validationErrors = useMemo(() => validationIssues.filter(i => i.level === "error"), [validationIssues]);
  const validationWarnings = useMemo(() => validationIssues.filter(i => i.level === "warning"), [validationIssues]);
  const validationIssuesByCalculationId = useMemo(() => groupValidationIssuesByPathId(validationIssues, "calculations"), [validationIssues]);
  const validationIssuesByResultId = useMemo(() => groupValidationIssuesByPathId(validationIssues, "results"), [validationIssues]);
  const evaluatedResultById = useMemo(
    () => new Map((payload?.evaluated?.results ?? []).map(r => [r.id, r])),
    [payload?.evaluated?.results]
  );
  const localJson = useMemo(() => JSON.stringify(draftLocalConfig, null, 2), [draftLocalConfig]);
  const effectiveJson = useMemo(() => JSON.stringify(draftEffectiveConfig, null, 2), [draftEffectiveConfig]);

  function queueSemanticConfigChange(updater: (c: BuilderConfig) => BuilderConfig) {
    setDraftLocalConfig(prev => updater(prev));
    setDraftEffectiveConfig(prev => updater(prev));
    setHasSemanticDraftChanges(true);
  }

  async function handleSaveSemanticDraft() {
    await onApplyConfig(() => draftLocalConfig);
    setHasSemanticDraftChanges(false);
  }

  function handleDiscardSemanticDraft() {
    setDraftLocalConfig(config);
    setDraftEffectiveConfig(payload?.effectiveConfig ?? config);
    setHasSemanticDraftChanges(false);
  }

  function updateSemanticCalculation(id: string, updater: (c: BuilderCalculation) => BuilderCalculation) {
    queueSemanticConfigChange(cfg => ({
      ...cfg,
      calculations: cfg.calculations.map(c => c.id === id ? updater(c) : c),
    }));
  }

  function getDirectFormulaInput(calc: BuilderCalculation): BuilderFormulaInput | null {
    if (calc.mode !== "formula" || calc.inputs.length !== 1) return null;
    const input = calc.inputs[0];
    if (!input || input.sourceType !== "obra_field") return null;
    return calc.expression.trim() === input.alias ? input : null;
  }

  function getCalculationEditKind(calc: BuilderCalculation): CalculationEditKind {
    return getDirectFormulaInput(calc) ? "obra_field" : calc.mode;
  }

  function changeSemanticCalculationMode(id: string, mode: CalculationEditKind) {
    updateSemanticCalculation(id, calc => {
      if (getCalculationEditKind(calc) === mode) return calc;
      const base = { id: calc.id, label: calc.label, description: calc.description };
      if (mode === "obra_field") {
        const existingInput = calc.mode === "formula" ? calc.inputs.find(input => input.sourceType === "obra_field") : null;
        const alias = existingInput?.alias || "valor";
        return {
          ...base,
          mode: "formula",
          expression: alias,
          inputs: [{
            id: existingInput?.id ?? makeClientId("input"),
            alias,
            sourceType: "obra_field",
            sourceId: existingInput?.sourceId || payload?.sources.obraFields[0]?.id || "",
            fieldKey: null,
            aggregation: null,
          }],
        };
      }
      if (mode === "aggregate") {
        return {
          ...base,
          mode: "aggregate",
          sourceType: "table",
          sourceId: payload?.sources.tables[0]?.id ?? "",
          fieldKey: null,
          aggregation: "latest",
        };
      }
      if (mode === "text_template") {
        return {
          ...base,
          mode: "text_template",
          template: calc.mode === "formula" ? calc.expression : "",
          inputs: calc.mode === "formula" ? calc.inputs : [],
        };
      }
      return {
        ...base,
        mode: "formula",
        expression: calc.mode === "text_template" ? calc.template : "",
        inputs: calc.mode === "text_template" ? calc.inputs : [],
      };
    });
  }

  function updateSemanticInput(calcId: string, inputId: string, updater: (input: BuilderFormulaInput) => BuilderFormulaInput) {
    updateSemanticCalculation(calcId, calc => {
      if (calc.mode !== "formula" && calc.mode !== "text_template") return calc;
      return {
        ...calc,
        inputs: calc.inputs.map(input => input.id === inputId ? updater(input) : input),
      };
    });
  }

  function deleteSemanticCalculation(id: string) {
    queueSemanticConfigChange(cfg => ({
      ...cfg,
      calculations: cfg.calculations.map(c => c.id === id ? { ...c, deleted: true } : c),
    }));
  }

  function deleteSemanticResult(id: string) {
    queueSemanticConfigChange(cfg => ({
      ...cfg,
      results: cfg.results.map(r => r.id === id ? { ...r, deleted: true } : r),
    }));
  }

  async function handleCopyJson(json: string, label: string) {
    try {
      await navigator.clipboard.writeText(json);
      setJsonStatus(`${label} copiado`);
      setTimeout(() => setJsonStatus(null), 2000);
    } catch {
      setJsonStatus("Error al copiar");
    }
  }

  function handleImportJson() {
    try {
      const parsed = JSON.parse(jsonText) as BuilderConfig;
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.calculations)) {
        setJsonStatus("JSON inválido: falta calculations");
        return;
      }
      queueSemanticConfigChange(() => parsed);
      setJsonStatus("JSON importado");
    } catch (e) {
      setJsonStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function handleAddAction() {
    if (!actionLabel.trim()) return;
    const id = makeClientId(actionType === "resultado" ? "result" : "calc");
    if (actionType === "resultado") {
      const newResult: BuilderResult = {
        id,
        label: actionLabel,
        description: "",
        calculationId: null,
        targetObraFieldId: null,
        writebackMode: "none",
        format: "number",
        decimals: 0,
        generalTabSlot: "financial",
        generalTabOrder: results.length + 1,
      };
      queueSemanticConfigChange(cfg => ({ ...cfg, results: [...cfg.results, newResult] }));
    } else if (actionType === "aggregate") {
      const [sType, ...sRest] = sourceValue.split(":");
      const sId = sRest.join(":");
      const newCalc: BuilderCalculation = {
        id,
        label: actionLabel,
        description: "",
        mode: "aggregate",
        sourceType: (sType === "macro_table" ? "macro_table" : "table") as BuilderSourceType,
        sourceId: sId || sourceValue,
        fieldKey: fieldKey || null,
        aggregation,
      };
      queueSemanticConfigChange(cfg => ({ ...cfg, calculations: [...cfg.calculations, newCalc] }));
    } else if (actionType === "formula") {
      const newCalc: BuilderCalculation = {
        id,
        label: actionLabel,
        description: "",
        mode: "formula",
        expression: formulaExpression || "{input_a}",
        inputs: [],
      };
      queueSemanticConfigChange(cfg => ({ ...cfg, calculations: [...cfg.calculations, newCalc] }));
    } else if (actionType === "texto") {
      const newCalc: BuilderCalculation = {
        id,
        label: actionLabel,
        description: "",
        mode: "text_template",
        template: formulaExpression || "{input_a}",
        inputs: [],
      };
      queueSemanticConfigChange(cfg => ({ ...cfg, calculations: [...cfg.calculations, newCalc] }));
    }
    setActionLabel("");
  }

  function semanticSelectStyle(width?: number): CSSProperties {
    return {
      height: 30,
      minWidth: width,
      borderRadius: 6,
      border: "1px solid var(--df-stone-200)",
      background: "#fff",
      color: "var(--df-stone-800)",
      fontSize: 12,
      padding: "0 8px",
      outline: "none",
      fontFamily: "inherit",
    };
  }

  function semanticTextInputStyle(width?: number): CSSProperties {
    return {
      height: 30,
      width: width,
      borderRadius: 6,
      border: "1px solid var(--df-stone-200)",
      background: "#fff",
      color: "var(--df-stone-800)",
      fontSize: 12,
      padding: "0 8px",
      outline: "none",
      fontFamily: "inherit",
    };
  }

  function semanticSmallButtonStyle(primary?: boolean): CSSProperties {
    return {
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "5px 10px",
      background: primary ? "var(--df-stone-900)" : "#fff",
      border: `1px solid ${primary ? "var(--df-stone-900)" : "var(--df-stone-200)"}`,
      borderRadius: 5, fontSize: 12, fontWeight: 600,
      color: primary ? "#fff" : "var(--df-stone-700)",
      cursor: "pointer",
    };
  }

  function getAggregateOperationPhrase(agg: BuilderAggregation): string {
    const map: Record<BuilderAggregation, string> = {
      sum: "la suma",
      avg: "el promedio",
      min: "el mínimo",
      max: "el máximo",
      latest: "el último valor",
      count_rows: "la cantidad de filas",
      count_non_empty: "la cantidad de valores",
    };
    return map[agg] ?? agg;
  }

  function getResultActionLabel(result: BuilderResult): string {
    if (result.writebackMode === "auto") return "Actualizar automáticamente";
    if (result.writebackMode === "suggest") return "Sugerir cambio";
    return "Mostrar";
  }

  function getResultActionPhrase(result: BuilderResult): string {
    if (result.writebackMode === "auto") return "actualiza automáticamente";
    if (result.writebackMode === "suggest") return "sugiere cambio";
    return "muestra";
  }

  function getResultActionOptionLabel(mode: BuilderResult["writebackMode"]): string {
    if (mode === "auto") return "actualiza automáticamente";
    if (mode === "suggest") return "sugiere cambio";
    return "muestra";
  }

  function getResultSemanticState(result: BuilderResult, issues: BuilderValidationIssue[]): NsState {
    if (issues.some(i => i.level === "error")) return "error";
    if (issues.some(i => i.level === "warning")) return "warning";
    if (!result.calculationId) return "no-calc";
    return "normal";
  }

  function getDefaultInputSourceId(sourceType: BuilderFormulaInput["sourceType"]): string {
    if (sourceType === "obra_field") return payload?.sources.obraFields[0]?.id ?? "";
    if (sourceType === "table") return payload?.sources.tables[0]?.id ?? "";
    if (sourceType === "macro_table") return payload?.sources.macroTables[0]?.id ?? "";
    return calculations[0]?.id ?? "";
  }

  function getInputSourceTypeLabel(sourceType: BuilderFormulaInput["sourceType"]): string {
    if (sourceType === "obra_field") return "Campo de obra";
    if (sourceType === "table") return "Tabla";
    if (sourceType === "macro_table") return "Macrotabla";
    return "Cálculo";
  }

  function getCalculationKind(calc: BuilderCalculation): NsNodeKind {
    if (calc.mode === "aggregate") return "origen";
    if (calc.mode === "text_template") return "texto";
    if (getDirectFormulaInput(calc)) return "dato";
    return "formula";
  }

  function renderCalculationModeSelect(calc: BuilderCalculation): ReactNode {
    return (
      <select
        aria-label="Tipo de fila"
        value={getCalculationEditKind(calc)}
        onChange={event => changeSemanticCalculationMode(calc.id, event.target.value as CalculationEditKind)}
        style={semanticSelectStyle(150)}
      >
        <option value="formula">Cálculo</option>
        <option value="obra_field">Campo de obra</option>
        <option value="aggregate">Extracción</option>
        <option value="text_template">Texto</option>
      </select>
    );
  }

  function renderDirectObraFieldEditor(calc: BuilderCalculation, input: BuilderFormulaInput): ReactNode {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        padding: "8px 10px", background: "#fff", border: "1px solid var(--df-stone-200)", borderRadius: 7,
      }}>
        <input
          aria-label="Nombre del campo"
          value={calc.label}
          onChange={e => updateSemanticCalculation(calc.id, current => ({ ...current, label: e.target.value }))}
          style={{ ...semanticTextInputStyle(220), fontWeight: 600 }}
        />
        {renderCalculationModeSelect(calc)}
        <NsWord>=</NsWord>
        <select
          value={input.sourceId}
          onChange={e => updateSemanticInput(calc.id, input.id, current => ({ ...current, sourceId: e.target.value }))}
          style={semanticSelectStyle(220)}
        >
          {(payload?.sources.obraFields ?? []).map(source => (
            <option key={source.id} value={source.id}>{source.label}</option>
          ))}
        </select>
      </div>
    );
  }

  function renderFormulaExpression(calc: BuilderCalculation): ReactNode {
    if (calc.mode !== "formula") return null;
    const parts = calc.expression.split(/(\{[^}]+\})/g);
    return (
      <span style={{ fontSize: 12, color: "var(--df-stone-700)", fontFamily: "var(--font-mono, monospace)" }}>
        {parts.map((part, i) => {
          const key = `${i}-${part}`;
          const match = part.match(/^\{([^}]+)\}$/);
          if (match) {
            const alias = match[1]!;
            const input = calc.inputs.find(inp => inp.alias === alias);
            if (input) {
              const color = allCalculationColorById.get(input.sourceId) ?? SEMANTIC_CALC_COLORS[0]!;
              const label = getBuilderSourceLabel(payload, input.sourceType, input.sourceId);
              return <NsChip key={key} color={color}>{label}</NsChip>;
            }
            return <NsVal key={key}>{alias}</NsVal>;
          }
          return <Fragment key={key}>{part}</Fragment>;
        })}
      </span>
    );
  }

  function renderTextTemplateExpression(calc: BuilderCalculation): ReactNode {
    if (calc.mode !== "text_template") return null;
    const parts = calc.template.split(/(\{[^}]+\})/g);
    return (
      <span style={{ fontSize: 12, color: "var(--df-stone-700)" }}>
        {parts.map((part, i) => {
          const key = `${i}-${part}`;
          const match = part.match(/^\{([^}]+)\}$/);
          if (match) {
            const alias = match[1]!;
            const input = calc.inputs.find(inp => inp.alias === alias);
            if (input) {
              const color = allCalculationColorById.get(input.sourceId) ?? SEMANTIC_CALC_COLORS[0]!;
              const label = getBuilderSourceLabel(payload, input.sourceType, input.sourceId);
              return <NsChip key={key} color={color}>{label}</NsChip>;
            }
            return <NsVal key={key}>{alias}</NsVal>;
          }
          return <Fragment key={key}>{`"${part}"`}</Fragment>;
        })}
      </span>
    );
  }

  function renderSemanticIssueBadge(issues: BuilderValidationIssue[]): ReactNode {
    if (issues.length === 0) return null;
    const hasError = issues.some(i => i.level === "error");
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        fontSize: 12, fontWeight: 700,
        color: hasError ? "#b91c1c" : "#a16207",
        background: hasError ? "#fef2f2" : "#fef9c3",
        border: `1px solid ${hasError ? "rgba(239,68,68,.3)" : "rgba(234,179,8,.3)"}`,
        borderRadius: 4, padding: "1px 5px",
      }}>
        <TriangleAlert size={9} />
        {issues.length}
      </span>
    );
  }

  function renderSemanticIssuePanel(issues: BuilderValidationIssue[]): ReactNode {
    if (issues.length === 0) return null;
    return (
      <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
        {issues.map((issue) => (
          <div key={`${issue.path}-${issue.level}-${issue.message}`} style={{
            fontSize: 12, color: issue.level === "error" ? "#b91c1c" : "#a16207",
            padding: "4px 8px",
            background: issue.level === "error" ? "#fef2f2" : "#fef9c3",
            border: `1px solid ${issue.level === "error" ? "rgba(239,68,68,.2)" : "rgba(234,179,8,.2)"}`,
            borderRadius: 5,
          }}>
            <strong>{issue.level === "error" ? "Error" : "Advertencia"}:</strong> {issue.message}
          </div>
        ))}
      </div>
    );
  }

  function getInputIssues(calcId: string, input: BuilderFormulaInput, issues: BuilderValidationIssue[]): BuilderValidationIssue[] {
    return issues.filter(i => i.path.includes(`calculations.${calcId}`) && i.path.includes(input.id));
  }

  function renderSemanticInputIssueRows(calc: BuilderCalculation, issues: BuilderValidationIssue[]): ReactNode {
    if (calc.mode !== "formula" && calc.mode !== "text_template") return null;
    return calc.inputs.map(input => {
      const inputIssues = getInputIssues(calc.id, input, issues);
      if (inputIssues.length === 0) return null;
      return (
        <div key={input.id} style={{ fontSize: 12, color: "#b91c1c", marginLeft: 16 }}>
          {input.alias}: {inputIssues.map(i => i.message).join(", ")}
        </div>
      );
    });
  }

  function renderNsInputRow(calc: BuilderCalculation, input: BuilderFormulaInput, depth: number, isLast: boolean): ReactNode {
    const inputIssues = getInputIssues(calc.id, input, validationIssuesByCalculationId.get(calc.id) ?? []);
    const color = allCalculationColorById.get(input.sourceId) ?? SEMANTIC_CALC_COLORS[2]!;
    const isEditing = editingInputId === `${calc.id}:${input.id}`;
    const INDENT = 22;
    const indentLeft = depth * INDENT;

    return (
      <div
        key={input.id}
        className="ns-noderow"
        style={{
          display: "flex",
          alignItems: "flex-start",
          position: "relative",
          padding: "6px 8px",
          marginLeft: indentLeft,
          gap: 8,
          borderRadius: 6,
        }}
      >
        <div style={{
          position: "absolute",
          left: -indentLeft + 9,
          top: 0,
          bottom: isLast ? "50%" : 0,
          width: 1,
          background: "var(--df-stone-200)",
        }} />
        <div style={{
          position: "absolute",
          left: -indentLeft + 9,
          top: 17,
          width: indentLeft - 2,
          height: 1,
          background: "var(--df-stone-200)",
        }} />

        <NsTypeIcon kind={input.sourceType === "calculation" ? "formula" : input.sourceType === "obra_field" ? "dato" : "origen"} color={color} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {isEditing ? (
            <NsEditShell
              onCancel={() => setEditingInputId(null)}
              hint={
                <span style={{ fontSize: 12, color: "#c2410c", fontWeight: 700 }}>
                  Editando {input.alias}
                </span>
              }
            >
              <div style={{
                display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                padding: "8px 10px", background: "#fff", border: "1px solid var(--df-stone-200)", borderRadius: 7,
              }}>
                <input
                  aria-label="Alias"
                  value={input.alias}
                  onChange={e => updateSemanticInput(calc.id, input.id, current => ({ ...current, alias: e.target.value }))}
                  style={{ ...semanticTextInputStyle(120), fontWeight: 600 }}
                />
                <NsWord>=</NsWord>
                <select
                  value={input.sourceType}
                  onChange={e => {
                    const sourceType = e.target.value as BuilderFormulaInput["sourceType"];
                    updateSemanticInput(calc.id, input.id, current => ({
                      ...current,
                      sourceType,
                      sourceId: getDefaultInputSourceId(sourceType),
                      fieldKey: null,
                    }));
                  }}
                  style={semanticSelectStyle(130)}
                >
                  <option value="obra_field">Campo de obra</option>
                  <option value="table">Tabla</option>
                  <option value="macro_table">Macrotabla</option>
                  <option value="calculation">Cálculo</option>
                </select>
                <select
                  value={input.sourceId}
                  onChange={e => updateSemanticInput(calc.id, input.id, current => ({ ...current, sourceId: e.target.value, fieldKey: null }))}
                  style={semanticSelectStyle(180)}
                >
                  {input.sourceType === "obra_field" && (payload?.sources.obraFields ?? []).map(source => (
                    <option key={source.id} value={source.id}>{source.label}</option>
                  ))}
                  {input.sourceType === "table" && (payload?.sources.tables ?? []).map(source => (
                    <option key={source.id} value={source.id}>{source.name}</option>
                  ))}
                  {input.sourceType === "macro_table" && (payload?.sources.macroTables ?? []).map(source => (
                    <option key={source.id} value={source.id}>{source.name}</option>
                  ))}
                  {input.sourceType === "calculation" && calculations.filter(c => c.id !== calc.id).map(source => (
                    <option key={source.id} value={source.id}>{source.label}</option>
                  ))}
                </select>
                {(input.sourceType === "table" || input.sourceType === "macro_table") && (
                  <>
                    <NsWord>de</NsWord>
                    <select
                      value={input.fieldKey ?? ""}
                      onChange={e => updateSemanticInput(calc.id, input.id, current => ({ ...current, fieldKey: e.target.value || null }))}
                      style={semanticSelectStyle(150)}
                    >
                      <option value="">sin columna</option>
                      {(input.sourceType === "macro_table"
                        ? (payload?.sources.macroTables ?? []).find(source => source.id === input.sourceId)?.columns
                        : (payload?.sources.tables ?? []).find(source => source.id === input.sourceId)?.columns
                      )?.map(column => (
                        <option key={column.key} value={column.key}>{column.label}</option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            </NsEditShell>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, minHeight: 26 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--df-stone-800)" }}>{input.alias}</span>
              <NsWord>=</NsWord>
              <NsWord>{getInputSourceTypeLabel(input.sourceType)}</NsWord>
              <NsChip color={color}>{getBuilderSourceLabel(payload, input.sourceType, input.sourceId)}</NsChip>
              {input.fieldKey && (input.sourceType === "table" || input.sourceType === "macro_table") && (
                <>
                  <NsWord>de</NsWord>
                  <NsChip color={color}>{getBuilderFieldLabel(payload, input.sourceType, input.sourceId, input.fieldKey)}</NsChip>
                </>
              )}
              {renderSemanticIssueBadge(inputIssues)}
            </div>
          )}
        </div>

        {!isEditing && canWrite && (
          <NsRowActions
            onEdit={() => setEditingInputId(`${calc.id}:${input.id}`)}
            onDelete={() => updateSemanticCalculation(calc.id, current => {
              if (current.mode !== "formula" && current.mode !== "text_template") return current;
              return { ...current, inputs: current.inputs.filter(candidate => candidate.id !== input.id) };
            })}
          />
        )}
      </div>
    );
  }

  function renderNsSemanticTree(tree: SemanticTree, depth: number, isLast: boolean, _resultId: string): ReactNode {
    const calc = tree.calculation;
    const calcIssues = validationIssuesByCalculationId.get(calc.id) ?? [];
    const color = allCalculationColorById.get(calc.id) ?? SEMANTIC_CALC_COLORS[0]!;
    const kind = getCalculationKind(calc);
    const isEditing = editingCalculationId === calc.id;
    const INDENT = 22;
    const indentLeft = depth * INDENT;
    const directInput = getDirectFormulaInput(calc);
    const childTreeById = new Map(tree.children.map(child => [child.calculation.id, child]));
    const childRows = calc.mode === "formula" || calc.mode === "text_template"
      ? (directInput ? [] : calc.inputs)
        .map(input => {
          if (input.sourceType !== "calculation") return { type: "input" as const, input };
          const childTree = childTreeById.get(input.sourceId);
          return childTree ? { type: "calculation" as const, tree: childTree } : { type: "input" as const, input };
        })
      : tree.children.map(child => ({ type: "calculation" as const, tree: child }));

    return (
      <Fragment key={calc.id}>
        <div
          className="ns-noderow"
          style={{
            display: "flex",
            alignItems: "flex-start",
            position: "relative",
            padding: "6px 8px",
            marginLeft: indentLeft,
            gap: 8,
            borderRadius: 6,
          }}
        >
          {depth > 0 && (
            <div style={{
              position: "absolute",
              left: -indentLeft + 9,
              top: 0,
              bottom: isLast ? "50%" : 0,
              width: 1,
              background: "var(--df-stone-200)",
            }} />
          )}
          {depth > 0 && (
            <div style={{
              position: "absolute",
              left: -indentLeft + 9,
              top: 17,
              width: indentLeft - 2,
              height: 1,
              background: "var(--df-stone-200)",
            }} />
          )}

          <NsTypeIcon kind={kind} color={color} />

          <div style={{ flex: 1, minWidth: 0 }}>
            {isEditing ? (
              <NsEditShell
                onCancel={() => setEditingCalculationId(null)}
                hint={
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 12, color: "#c2410c", fontWeight: 700 }}>
                      Editando {calc.label}
                    </span>
                  </div>
                }
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {calc.mode === "aggregate" && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                      padding: "8px 10px", background: "#fff", border: "1px solid var(--df-stone-200)", borderRadius: 7,
                    }}>
                      <input
                        aria-label="Nombre del origen"
                        value={calc.label}
                        onChange={e => updateSemanticCalculation(calc.id, c => ({ ...c, label: e.target.value }))}
                        style={{ ...semanticTextInputStyle(200), fontWeight: 600 }}
                      />
                      {renderCalculationModeSelect(calc)}
                      <NsWord>toma</NsWord>
                      <select
                        value={calc.aggregation}
                        onChange={e => updateSemanticCalculation(calc.id, c => c.mode === "aggregate" ? { ...c, aggregation: e.target.value as BuilderAggregation } : c)}
                        style={semanticSelectStyle(150)}
                      >
                        {(["sum","avg","min","max","latest","count_rows","count_non_empty"] as BuilderAggregation[]).map(a => (
                          <option key={a} value={a}>{getAggregateOperationPhrase(a)}</option>
                        ))}
                      </select>
                      {calc.aggregation !== "count_rows" && (
                        <>
                          <NsWord>de</NsWord>
                          <select
                            value={calc.fieldKey ?? ""}
                            onChange={e => updateSemanticCalculation(calc.id, c => c.mode === "aggregate" ? { ...c, fieldKey: e.target.value || null } : c)}
                            style={semanticSelectStyle(150)}
                          >
                            <option value="">sin columna</option>
                            {(calc.sourceType === "macro_table"
                              ? (payload?.sources.macroTables ?? []).find(t => t.id === calc.sourceId)?.columns
                              : (payload?.sources.tables ?? []).find(t => t.id === calc.sourceId)?.columns
                            )?.map(col => (
                              <option key={col.key} value={col.key}>{col.label}</option>
                            ))}
                          </select>
                        </>
                      )}
                      <NsWord>en</NsWord>
                      <select
                        value={`${calc.sourceType}:${calc.sourceId}`}
                        onChange={e => {
                          const [sourceType, ...sourceIdParts] = e.target.value.split(":");
                          const sourceId = sourceIdParts.join(":");
                          updateSemanticCalculation(calc.id, c => c.mode === "aggregate"
                            ? { ...c, sourceType: sourceType as BuilderSourceType, sourceId, fieldKey: null }
                            : c);
                        }}
                        style={semanticSelectStyle(150)}
                      >
                        {aggregateSources.map(s => (
                          <option key={`${s.type}:${s.id}`} value={`${s.type}:${s.id}`}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {calc.mode === "formula" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {directInput ? (
                        renderDirectObraFieldEditor(calc, directInput)
                      ) : (
                        <>
                          <div style={{
                            display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                            padding: "8px 10px", background: "#fff", border: "1px solid var(--df-stone-200)", borderRadius: 7,
                          }}>
                            <input
                              aria-label="Nombre de la fórmula"
                              value={calc.label}
                              onChange={e => updateSemanticCalculation(calc.id, c => ({ ...c, label: e.target.value }))}
                              style={{ ...semanticTextInputStyle(220), fontWeight: 600 }}
                            />
                            {renderCalculationModeSelect(calc)}
                            <NsWord>=</NsWord>
                          </div>
                          <textarea
                            value={calc.expression}
                            onChange={e => updateSemanticCalculation(calc.id, c => c.mode === "formula" ? { ...c, expression: e.target.value } : c)}
                            placeholder="ej: {certificado} / {contrato} * 100"
                            style={{
                              ...semanticTextInputStyle(),
                              width: "100%",
                              minHeight: 54,
                              height: "auto",
                              padding: "8px 9px",
                              resize: "vertical",
                              fontFamily: "var(--font-mono, monospace)",
                              lineHeight: 1.45,
                            }}
                          />
                        </>
                      )}
                    </div>
                  )}
                  {calc.mode === "text_template" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                        padding: "8px 10px", background: "#fff", border: "1px solid var(--df-stone-200)", borderRadius: 7,
                      }}>
                        <input
                          aria-label="Nombre del texto"
                          value={calc.label}
                          onChange={e => updateSemanticCalculation(calc.id, c => ({ ...c, label: e.target.value }))}
                          style={{ ...semanticTextInputStyle(220), fontWeight: 600 }}
                        />
                        {renderCalculationModeSelect(calc)}
                        <NsWord>=</NsWord>
                      </div>
                      <textarea
                        value={calc.template}
                        onChange={e => updateSemanticCalculation(calc.id, c => c.mode === "text_template" ? { ...c, template: e.target.value } : c)}
                        placeholder="ej: Avance {porcentaje}"
                        style={{
                          ...semanticTextInputStyle(),
                          width: "100%",
                          minHeight: 54,
                          height: "auto",
                          padding: "8px 9px",
                          resize: "vertical",
                          lineHeight: 1.45,
                        }}
                      />
                    </div>
                  )}
                </div>
              </NsEditShell>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 3, minHeight: 26 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--df-stone-800)" }}>{calc.label}</span>
                  {calc.mode === "aggregate" && (
                    <>
                      <NsWord>toma</NsWord>
                      <NsChip color={color}>{getAggregateOperationPhrase(calc.aggregation)}</NsChip>
                      {calc.aggregation !== "count_rows" && (
                        <>
                          <NsWord>de</NsWord>
                          <NsChip color={color}>{getBuilderFieldLabel(payload, calc.sourceType, calc.sourceId, calc.fieldKey)}</NsChip>
                        </>
                      )}
                      <NsWord>en</NsWord>
                      <NsChip color={color}>{getBuilderSourceLabel(payload, calc.sourceType, calc.sourceId)}</NsChip>
                    </>
                  )}
                  {calc.mode === "formula" && (
                    directInput ? (
                      <>
                        <NsWord>=</NsWord>
                        <NsWord>Campo de obra</NsWord>
                        <NsChip color={color}>{getBuilderSourceLabel(payload, directInput.sourceType, directInput.sourceId)}</NsChip>
                      </>
                    ) : (
                      <>
                        <NsWord>=</NsWord>
                        {renderFormulaExpression(calc)}
                      </>
                    )
                  )}
                  {calc.mode === "text_template" && (
                    <>
                      <NsWord>=</NsWord>
                      {renderTextTemplateExpression(calc)}
                    </>
                  )}
                  {renderSemanticIssueBadge(calcIssues)}
                  {(() => {
                    const evaluated = payload?.evaluated?.calculations?.find(c => c.id === calc.id);
                    return evaluated?.formattedValue ? <NsPreviewPill value={evaluated.formattedValue} /> : null;
                  })()}
                </div>
              </div>
            )}
            {!isEditing && renderSemanticIssuePanel(calcIssues)}
            {!isEditing && renderSemanticInputIssueRows(calc, calcIssues)}
          </div>

          {!isEditing && canWrite && (
            <NsRowActions
              onEdit={() => setEditingCalculationId(calc.id)}
              onDelete={() => deleteSemanticCalculation(calc.id)}
            />
          )}
        </div>

        {childRows.map((child, i) => child.type === "input"
          ? renderNsInputRow(calc, child.input, depth + 1, i === childRows.length - 1)
          : renderNsSemanticTree(child.tree!, depth + 1, i === childRows.length - 1, _resultId)
        )}
      </Fragment>
    );
  }

  function renderNsNoCalcPlaceholder(result: BuilderResult): ReactNode {
    return (
      <div style={{
        padding: "14px 12px",
        display: "flex", alignItems: "center", gap: 12,
        color: "var(--df-stone-500)", fontSize: 13,
      }}>
        <span style={{
          width: 26, height: 26, borderRadius: 7,
          border: "1px dashed var(--df-stone-300)",
          display: "grid", placeItems: "center",
          color: "var(--df-stone-400)", fontSize: 14,
        }}>ƒ</span>
        <span>Este resultado todavía no tiene un cálculo asociado.</span>
        <button
          type="button"
          onClick={() => {
            const id = makeClientId("calc");
            const newCalc: BuilderCalculation = {
              id, label: `Cálculo de ${result.label}`, description: "", mode: "aggregate",
              sourceType: "table", sourceId: payload?.sources.tables[0]?.id ?? "", fieldKey: null, aggregation: "sum",
            };
            queueSemanticConfigChange(cfg => ({
              ...cfg,
              calculations: [...cfg.calculations, newCalc],
              results: cfg.results.map(r => r.id === result.id ? { ...r, calculationId: id } : r),
            }));
          }}
          style={{ marginLeft: "auto", padding: "5px 10px", background: "#fff", border: "1px solid var(--df-stone-300)", borderRadius: 5, color: "var(--df-stone-700)", fontSize: 12, fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}
        >
          <Plus size={11} /> Crear cálculo
        </button>
      </div>
    );
  }

  function renderNsResultCard(result: BuilderResult, alwaysExpanded?: boolean): ReactNode {
    const isExpanded = alwaysExpanded || expandedSemanticResultIds.has(result.id);
    const resultIssues = validationIssuesByResultId.get(result.id) ?? [];
    const resultState = getResultSemanticState(result, resultIssues);
    const tree = result.calculationId ? buildSemanticTree(result.calculationId, calculationById) : null;
    const evaluatedResult = evaluatedResultById.get(result.id);
    const isEditingHeader = editingResultId === result.id;

    const stateRingMap: Record<NsState, string> = {
      normal: "var(--df-stone-200)",
      warning: "#f6deaa",
      error: "#fecaca",
      editing: "var(--df-orange-border)",
      unsaved: "#f6deaa",
      "no-calc": "var(--df-stone-200)",
      "imported-broken": "#f6deaa",
    };
    const ring = stateRingMap[resultState] ?? "var(--df-stone-200)";
    const toggleExpanded = () => {
      if (isEditingHeader || alwaysExpanded) return;
      setExpandedSemanticResultIds(prev => {
        const next = new Set(prev);
        if (next.has(result.id)) next.delete(result.id);
        else next.add(result.id);
        return next;
      });
    };

    return (
      <div key={result.id} style={{
        background: "#fff",
        border: `1px solid ${ring}`,
        borderRadius: 12,
        boxShadow: "0 1px 0 rgba(0,0,0,.03)",
        overflow: "hidden",
        transition: "box-shadow .2s",
      }}>
        <div
          className="ns-noderow"
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: isEditingHeader ? "10px 14px" : "12px 14px",
            background: isEditingHeader ? "#fff7ed" : "#fff",
            cursor: isEditingHeader || alwaysExpanded ? "default" : "pointer",
          }}
          role="button"
          aria-disabled={isEditingHeader || alwaysExpanded}
          tabIndex={isEditingHeader || alwaysExpanded ? -1 : 0}
          onClick={toggleExpanded}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              toggleExpanded();
            }
          }}
        >
          {!alwaysExpanded && (
            <button
              type="button"
              style={{
                width: 22, height: 22,
                background: "transparent", border: "none",
                color: "var(--df-stone-500)", cursor: "pointer",
                display: "grid", placeItems: "center",
                transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform .15s",
              }}
            >
              <ChevronRight size={12} />
            </button>
          )}

          <NsTypeIcon kind="resultado" />

          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
            {isEditingHeader ? (
              <NsEditShell
                onCancel={() => setEditingResultId(null)}
                hint={
                  <span style={{ fontSize: 12, color: "#c2410c", fontWeight: 700 }}>
                    Editando el resultado del flujo
                  </span>
                }
              >
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                  padding: "8px 10px", background: "#fff", border: "1px solid var(--df-stone-200)", borderRadius: 7,
                }}>
                    <input
                      aria-label="Nombre del resultado"
                      value={result.label}
                      onChange={e => {
                        const lbl = e.target.value;
                        queueSemanticConfigChange(cfg => ({
                          ...cfg,
                          results: cfg.results.map(r => r.id === result.id ? { ...r, label: lbl } : r),
                        }));
                      }}
                      style={{ ...semanticTextInputStyle(200), fontWeight: 600 }}
                    />
                    <NsWord>se</NsWord>
                    <select
                      value={result.writebackMode}
                      onChange={e => {
                        const mode = e.target.value as BuilderResult["writebackMode"];
                        queueSemanticConfigChange(cfg => ({
                          ...cfg,
                          results: cfg.results.map(r => r.id === result.id ? { ...r, writebackMode: mode } : r),
                        }));
                      }}
                      style={semanticSelectStyle(160)}
                    >
                      {(["none", "suggest", "auto"] as const).map(mode => (
                        <option key={mode} value={mode}>{getResultActionOptionLabel(mode)}</option>
                      ))}
                    </select>
                    <NsWord>con</NsWord>
                    <select
                      value={result.calculationId ?? ""}
                      onChange={e => {
                        const calcId = e.target.value || null;
                        queueSemanticConfigChange(cfg => ({
                          ...cfg,
                          results: cfg.results.map(r => r.id === result.id ? { ...r, calculationId: calcId } : r),
                        }));
                      }}
                      style={semanticSelectStyle(200)}
                    >
                      <option value="">Sin cálculo</option>
                      {calculations.map(c => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                </div>
              </NsEditShell>
            ) : (
              <>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--df-stone-900)" }}>{result.label}</span>
                <NsWord>se</NsWord>
                <NsWord>{getResultActionPhrase(result)}</NsWord>
                {result.calculationId && (
                  <>
                    <NsWord>con</NsWord>
                    <NsChip color={SEMANTIC_CALC_COLORS[0]!}>
                      {calculationById.get(result.calculationId)?.label ?? result.calculationId}
                    </NsChip>
                  </>
                )}
                {evaluatedResult?.formattedValue && (
                  <NsPreviewPill value={evaluatedResult.formattedValue} />
                )}
                {resultState === "no-calc" && <NsStatePill state="no-calc" />}
                {resultState === "warning" && <NsStatePill state="warning" />}
                {resultState === "error" && <NsStatePill state="error" />}
                {renderSemanticIssueBadge(resultIssues)}
              </>
            )}
          </div>

          {!isEditingHeader && canWrite && (
            <NsRowActions
              onEdit={() => setEditingResultId(result.id)}
              onDelete={() => deleteSemanticResult(result.id)}
            />
          )}
        </div>

        {(isExpanded || alwaysExpanded) && (
          <div style={{
            padding: "8px 16px 14px 18px",
            borderTop: "1px dashed var(--df-stone-200)",
            background: "#fdfdfb",
          }}>
            {tree ? (
              renderNsSemanticTree(tree, 0, true, result.id)
            ) : (
              renderNsNoCalcPlaceholder(result)
            )}
          </div>
        )}
      </div>
    );
  }

  function renderNsNewRowBuilder(): ReactNode {
    if (!canWrite) return null;
    const actionPlaceholder =
      actionType === "resultado" ? "Nombre del resultado"
        : actionType === "aggregate" ? "Nombre del origen"
          : actionType === "formula" ? "Nombre de la fórmula"
            : "Nombre del texto";
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "11px 14px",
        background: "#fff",
        border: "1px dashed var(--df-stone-300)",
        borderRadius: 12,
        flexWrap: "wrap",
        marginTop: 8,
      }}>
        <span style={{
          fontSize: 12, fontWeight: 700, textTransform: "uppercase" as const,
          color: "var(--df-orange)",
          background: "var(--df-orange-soft)",
          border: "1px solid var(--df-orange-border)",
          padding: "2px 8px", borderRadius: 4,
        }}>AGREGAR AL FLUJO</span>

        <select value={actionType} onChange={e => setActionType(e.target.value)} style={semanticSelectStyle(140)}>
          <option value="resultado">Resultado</option>
          <option value="aggregate">Origen de tabla</option>
          <option value="formula">Fórmula</option>
          <option value="texto">Texto</option>
        </select>

        <input
          value={actionLabel}
          onChange={e => setActionLabel(e.target.value)}
          placeholder={actionPlaceholder}
          style={semanticTextInputStyle(180)}
        />

        {actionType === "aggregate" && (
          <>
            <NsWord>toma</NsWord>
            <select value={aggregation} onChange={e => setAggregation(e.target.value as BuilderAggregation)} style={semanticSelectStyle(160)}>
              {(["sum","avg","min","max","latest","count_rows","count_non_empty"] as BuilderAggregation[]).map(a => (
                <option key={a} value={a}>{getAggregateOperationPhrase(a)}</option>
              ))}
            </select>
            <NsWord>en</NsWord>
            <select value={sourceValue} onChange={e => setSourceValue(e.target.value)} style={semanticSelectStyle(160)}>
              <option value="">Seleccionar…</option>
              {aggregateSources.map(s => (
                <option key={`${s.type}:${s.id}`} value={`${s.type}:${s.id}`}>{s.name}</option>
              ))}
            </select>
          </>
        )}

        {actionType === "formula" && (
          <>
            <NsWord>=</NsWord>
            <input
              value={formulaExpression}
              onChange={e => setFormulaExpression(e.target.value)}
              placeholder="expresión p.ej. {a} / {b}"
              style={semanticTextInputStyle(200)}
            />
          </>
        )}

        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={handleAddAction}
          disabled={!actionLabel.trim()}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 12px",
            background: "#fff", color: "var(--df-orange)",
            border: "1px solid var(--df-orange-border)",
            borderRadius: 6, fontSize: 12, fontWeight: 600,
            cursor: actionLabel.trim() ? "pointer" : "not-allowed",
            opacity: actionLabel.trim() ? 1 : 0.6,
          }}
        >
          <Plus size={12} /> Agregar
        </button>
      </div>
    );
  }

  // ---- Main render ----
  return (
    <div style={{ display: "grid", gridTemplateColumns: showAdvanced ? "minmax(0, 1fr) 340px" : "minmax(0, 1fr)", gap: 14, alignItems: "flex-start" }}>
      <style>
        {`
          :root {
            --df-stone-50: #fafaf9;
            --df-stone-100: #f5f5f4;
            --df-stone-200: #e7e5e4;
            --df-stone-300: #d6d3d1;
            --df-stone-400: #a8a29e;
            --df-stone-500: #78716c;
            --df-stone-600: #57534e;
            --df-stone-700: #44403c;
            --df-stone-800: #292524;
            --df-stone-900: #1c1917;
            --df-orange: #f97316;
            --df-orange-soft: #fff7ed;
            --df-orange-border: rgba(249, 115, 22, .35);
          }
          .ns-noderow .ns-row-actions { opacity: .75; transition: opacity .15s ease; }
          .ns-noderow:hover .ns-row-actions,
          .ns-noderow:focus-within .ns-row-actions { opacity: 1; }
          .ns-word {
            font-size: 12px;
            color: var(--df-stone-400);
            font-weight: 400;
          }
          .ns-word-em {
            font-weight: 600;
            font-family: var(--font-mono, monospace);
          }
          .ns-val {
            display: inline-flex;
            align-items: center;
            font-size: 12px;
            font-weight: 600;
            color: var(--df-stone-800);
            background: var(--df-stone-100);
            border: 1px solid var(--df-stone-200);
            border-radius: 4px;
            padding: 1px 6px;
          }
          .ns-chip {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            font-size: 12px;
            font-weight: 600;
            border: 1px solid;
            border-radius: 4px;
            padding: 1px 6px;
          }
          .ns-chip-big {
            font-size: 13px;
            border-radius: 6px;
            padding: 3px 8px;
          }
          .ns-chip-dot {
            width: 5px;
            height: 5px;
            border-radius: 50%;
            flex-shrink: 0;
          }
          .ns-type-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 22px;
            height: 22px;
            border-radius: 5px;
            border: 1px solid;
            font-size: 12px;
            font-weight: 700;
            flex-shrink: 0;
          }
          .ns-preview-pill {
            display: inline-flex;
            align-items: center;
            font-size: 12px;
            font-weight: 600;
            color: #15803d;
            background: #f0fdf4;
            border: 1px solid rgba(34,197,94,.3);
            border-radius: 4px;
            padding: 1px 6px;
            font-family: var(--font-mono, monospace);
          }
          .ns-state-pill {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            font-weight: 700;
            border: 1px solid;
            border-radius: 4px;
            padding: 2px 6px;
          }
          .ns-edit-shell {
            position: relative;
            background: #fff7ed;
            border: 1px solid rgba(249,115,22,.35);
            border-radius: 8px;
            padding: 10px 42px 10px 12px;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .ns-edit-close {
            position: absolute;
            top: 8px;
            right: 8px;
            display: inline-flex;
            align-items: center;
            gap: 5px;
            width: 26px;
            height: 26px;
            justify-content: center;
            padding: 0;
            border-radius: 5px;
            border: 1px solid var(--df-stone-200);
            background: #fff;
            color: var(--df-stone-700);
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
          }
          .ns-edit-approve {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            border-radius: 6px;
            border: 1px solid #16a34a;
            background: #f0fdf4;
            color: #15803d;
            cursor: pointer;
          }
        `}
      </style>
      {/* Main area */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Toolbar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 14px",
          background: "#fff",
          border: "1px solid var(--df-stone-200)",
          borderRadius: 10,
          boxShadow: "0 1px 0 rgba(0,0,0,.03)",
        }}>
          <div style={{ width: 28, height: 28, display: "grid", placeItems: "center", background: "var(--df-stone-100)", borderRadius: 6, color: "var(--df-stone-600)", flexShrink: 0 }}>
            <Database size={14} />
          </div>

          <div style={{ display: "inline-flex", padding: 2, background: "var(--df-stone-100)", borderRadius: 7, border: "1px solid var(--df-stone-200)", gap: 1 }}>
            {(["result", "all"] as const).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setSemanticScope(v)}
                style={{
                  padding: "4px 12px", fontSize: 12, fontWeight: 500,
                  background: semanticScope === v ? "#fff" : "transparent",
                  border: "none", borderRadius: 5,
                  color: semanticScope === v ? "var(--df-stone-900)" : "var(--df-stone-500)",
                  boxShadow: semanticScope === v ? "0 1px 2px rgba(0,0,0,.08)" : "none",
                  cursor: "pointer",
                }}
              >
                {v === "result" ? "Por resultado" : "Todo el flujo"}
              </button>
            ))}
          </div>

          <div style={{ width: 1, height: 20, background: "var(--df-stone-200)" }} />

          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
            {hasSemanticDraftChanges ? (
              <NsStatePill state="unsaved" message="Cambios sin guardar" />
            ) : (
              <span style={{ fontSize: 12, color: "var(--df-stone-400)" }}>Sin cambios pendientes</span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "6px 12px", borderRadius: 6,
              background: showAdvanced ? "var(--df-stone-900)" : "#fff",
              border: "1px solid var(--df-stone-200)",
              color: showAdvanced ? "#fff" : "var(--df-stone-700)",
              fontSize: 12, fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <FileJson size={12} /> Avanzado
          </button>

          {canWrite && (
            <>
              <button
                type="button"
                onClick={handleDiscardSemanticDraft}
                disabled={!hasSemanticDraftChanges}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "6px 12px", borderRadius: 6,
                  background: "#fff", border: "1px solid var(--df-stone-200)",
                  color: hasSemanticDraftChanges ? "var(--df-stone-700)" : "var(--df-stone-300)",
                  fontSize: 12, fontWeight: 500,
                  cursor: hasSemanticDraftChanges ? "pointer" : "not-allowed",
                }}
              >
                <X size={12} /> Descartar
              </button>
              <button
                type="button"
                onClick={() => void handleSaveSemanticDraft()}
                disabled={!hasSemanticDraftChanges || saving}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "6px 14px", borderRadius: 6,
                  background: hasSemanticDraftChanges && !saving ? "var(--df-stone-900)" : "var(--df-stone-200)",
                  border: "1px solid " + (hasSemanticDraftChanges && !saving ? "var(--df-stone-900)" : "var(--df-stone-200)"),
                  color: hasSemanticDraftChanges && !saving ? "#fff" : "var(--df-stone-400)",
                  fontSize: 12, fontWeight: 600,
                  cursor: hasSemanticDraftChanges && !saving ? "pointer" : "not-allowed",
                  boxShadow: hasSemanticDraftChanges && !saving ? "0 1px 0 rgba(0,0,0,.04)" : "none",
                }}
              >
                {saving ? <Loader2 size={12} /> : <Check size={12} />}
                Guardar cambios
              </button>
            </>
          )}
        </div>

        {/* Validation banner */}
        {validationIssues.length > 0 && (
          <div style={{
            padding: "10px 14px", borderRadius: 8,
            background: validationErrors.length > 0 ? "#fef2f2" : "#fef9c3",
            border: `1px solid ${validationErrors.length > 0 ? "rgba(239,68,68,.3)" : "rgba(234,179,8,.3)"}`,
            fontSize: 12, color: validationErrors.length > 0 ? "#b91c1c" : "#a16207",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <TriangleAlert size={14} />
            <span>
              {validationErrors.length > 0
                ? `${validationErrors.length} error${validationErrors.length > 1 ? "es" : ""} en la configuración.`
                : `${validationWarnings.length} advertencia${validationWarnings.length > 1 ? "s" : ""} en la configuración.`}
            </span>
            <span style={{ fontSize: 12, color: "inherit", opacity: 0.8 }}>
              {formatValidationIssues(validationIssues.slice(0, 2))}
            </span>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div style={{ padding: "10px 14px", borderRadius: 8, background: "#fef2f2", border: "1px solid rgba(239,68,68,.3)", fontSize: 12, color: "#b91c1c" }}>
            {error}
          </div>
        )}

        {/* Content */}
        {semanticScope === "result" ? (
          <>
            {results.length === 0 ? (
              <div style={{
                padding: 32, textAlign: "center",
                border: "1px dashed var(--df-stone-300)", borderRadius: 12,
                color: "var(--df-stone-500)", fontSize: 13,
                background: "#fff",
              }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>◎</div>
                <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--df-stone-700)" }}>No hay resultados configurados</div>
                <div>Agregá el primero con el constructor de abajo.</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 14, alignItems: "flex-start" }}>
                {/* Sidebar - result picker */}
                <div style={{ background: "#fff", border: "1px solid var(--df-stone-200)", borderRadius: 10, padding: 8, boxShadow: "0 1px 0 rgba(0,0,0,.03)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase" as const, color: "var(--df-stone-400)", padding: "8px 10px 6px" }}>
                    Resultados
                  </div>
                  {results.map(r => {
                    const rIssues = validationIssuesByResultId.get(r.id) ?? [];
                    const active = r.id === effectiveFocusResultId;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setFocusResultId(r.id)}
                        style={{
                          display: "block", width: "100%", textAlign: "left",
                          padding: "8px 10px", borderRadius: 6,
                          background: active ? "var(--df-stone-100)" : "transparent",
                          border: "none", cursor: "pointer", marginBottom: 2,
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: active ? 600 : 500, color: active ? "var(--df-stone-900)" : "var(--df-stone-700)" }}>
                          {r.label}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--df-stone-500)", display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                          <span>{getResultActionLabel(r)}</span>
                          {rIssues.length > 0 && (
                            <span style={{ width: 6, height: 6, borderRadius: 999, background: "#d97706" }} />
                          )}
                          {!r.calculationId && (
                            <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--df-stone-300)" }} />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Detail card */}
                <div>
                  {focusedResult ? renderNsResultCard(focusedResult, true) : null}
                </div>
              </div>
            )}
            {renderNsNewRowBuilder()}
          </>
        ) : (
          <div style={{
            display: "flex", flexDirection: "column", gap: 10,
            padding: 18,
            background: "#fafaf9",
            borderRadius: 12,
            border: "1px solid var(--df-stone-200)",
            backgroundImage: "radial-gradient(var(--df-stone-200) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}>
            {results.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--df-stone-500)", fontSize: 13 }}>
                No hay resultados configurados.
              </div>
            ) : (
              results.map(r => renderNsResultCard(r, false))
            )}
          </div>
        )}
      </div>

      {/* JSON Panel */}
      {showAdvanced && (
      <div style={{ width: 340, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ background: "#fff", border: "1px solid var(--df-stone-200)", borderRadius: 10, padding: 10, boxShadow: "0 1px 0 rgba(0,0,0,.03)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <FileJson size={13} style={{ color: "var(--df-stone-500)" }} />
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase" as const, color: "var(--df-stone-500)" }}>
              JSON exportable
            </span>
          </div>

          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {[{ label: "Local", json: localJson }, { label: "Efectivo", json: effectiveJson }].map(tab => (
              <button
                key={tab.label}
                type="button"
                onClick={() => void handleCopyJson(tab.json, tab.label)}
                style={semanticSmallButtonStyle()}
              >
                <Download size={11} /> {tab.label}
              </button>
            ))}
          </div>

          <pre style={{
            margin: 0, padding: 8,
            fontSize: 12, lineHeight: 1.5,
            background: "var(--df-stone-100)",
            border: "1px solid var(--df-stone-200)",
            borderRadius: 6,
            fontFamily: "var(--font-mono, monospace)",
            color: "var(--df-stone-700)",
            overflow: "auto",
            maxHeight: 200,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}>
            {localJson.slice(0, 2000)}{localJson.length > 2000 ? "\n…" : ""}
          </pre>

          {jsonStatus && (
            <div style={{ marginTop: 6, fontSize: 12, color: "#15803d", fontWeight: 500 }}>{jsonStatus}</div>
          )}
        </div>

        {/* Importer */}
        <div style={{ background: "#fff", border: "1px solid var(--df-stone-200)", borderRadius: 10, padding: 10, boxShadow: "0 1px 0 rgba(0,0,0,.03)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase" as const, color: "var(--df-stone-500)", marginBottom: 8 }}>
            Importar JSON
          </div>
          <textarea
            value={jsonText}
            onChange={e => setJsonText(e.target.value)}
            placeholder="Pegá tu JSON aquí…"
            style={{
              width: "100%", minHeight: 80, borderRadius: 6,
              border: "1px solid var(--df-stone-200)", background: "#fafaf9",
              padding: 8, fontSize: 12, fontFamily: "var(--font-mono, monospace)",
              color: "var(--df-stone-700)", resize: "vertical", outlineOffset: 2,
            }}
          />
          <button
            type="button"
            onClick={handleImportJson}
            disabled={!jsonText.trim()}
            style={{
              ...semanticSmallButtonStyle(),
              marginTop: 6,
              width: "100%",
              justifyContent: "center" as const,
              opacity: jsonText.trim() ? 1 : 0.5,
            }}
          >
            <Upload size={11} /> Importar JSON
          </button>
        </div>
      </div>
      )}
    </div>
  );
}


