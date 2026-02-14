"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ReportTable, RuleConfig, SignalRow, FindingRow } from "@/lib/reporting/types";
import { getDefaultRuleConfig } from "@/lib/reporting/defaults";

const emptySignals: SignalRow[] = [];
const emptyFindings: FindingRow[] = [];

export function ReportClient({ obraId }: { obraId: string }) {
  const params = useParams();
  const pathname = usePathname();
  const pathMatch = pathname?.match(/\/excel\/([^/]+)/) ?? pathname?.match(/\/obras\/([^/]+)/);
  const resolvedObraId =
    obraId ||
    (typeof params?.obraId === "string" ? params.obraId : "") ||
    (pathMatch ? pathMatch[1] : "");
  const [tables, setTables] = useState<ReportTable[]>([]);
  const [config, setConfig] = useState<RuleConfig>(getDefaultRuleConfig());
  const [signals, setSignals] = useState<SignalRow[]>(emptySignals);
  const [findings, setFindings] = useState<FindingRow[]>(emptyFindings);
  const [recomputeLogs, setRecomputeLogs] = useState<any[]>([]);
  const [jsonDraft, setJsonDraft] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [builderPack, setBuilderPack] = useState<
    "curve" | "unpaidCerts" | "inactivity" | "monthlyMissingCert" | "stageStalled"
  >("curve");
  const [showJson, setShowJson] = useState(false);
  const [periodKey, setPeriodKey] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!resolvedObraId) return;
    const load = async () => {
      const [tablesRes, rulesRes, signalsRes, findingsRes] = await Promise.all([
        fetch(`/api/obras/${resolvedObraId}/tables`).then((r) => r.json()),
        fetch(`/api/obras/${resolvedObraId}/rules`).then((r) => r.json()),
        fetch(`/api/obras/${resolvedObraId}/signals?period=${periodKey}`).then((r) => r.json()),
        fetch(`/api/obras/${resolvedObraId}/findings?period=${periodKey}`).then((r) => r.json()),
      ]);
      setTables(tablesRes.tables ?? []);
      if (rulesRes.config) setConfig(rulesRes.config);
      setSignals(signalsRes.signals ?? emptySignals);
      setFindings(findingsRes.findings ?? emptyFindings);
    };
    void load();
  }, [resolvedObraId, periodKey]);

  useEffect(() => {
    setJsonDraft(JSON.stringify(config, null, 2));
  }, [config]);

  const tableOptions = useMemo(
    () => tables.filter((t) => t.sourceType !== "default"),
    [tables]
  );

  const tablesForDisplay = useMemo(
    () => tables.filter((t) => t.sourceType !== "default" && t.sourceType !== "macro"),
    [tables]
  );

  const columnsByTable = useMemo(() => {
    const map = new Map<string, ReportTable["columns"]>();
    for (const table of tables) {
      map.set(table.id, table.columns);
    }
    return map;
  }, [tables]);

  const builderTableOptions = tableOptions;
  const builderColumns =
    builderPack === "curve"
      ? config.mappings.curve?.measurementTableId
        ? columnsByTable.get(config.mappings.curve.measurementTableId) ?? []
        : []
      : builderPack === "unpaidCerts"
        ? config.mappings.unpaidCerts?.certTableId
          ? columnsByTable.get(config.mappings.unpaidCerts.certTableId) ?? []
          : []
        : builderPack === "inactivity"
          ? config.mappings.inactivity?.measurementTableId
            ? columnsByTable.get(config.mappings.inactivity.measurementTableId) ?? []
            : []
          : builderPack === "monthlyMissingCert"
            ? config.mappings.monthlyMissingCert?.certTableId
              ? columnsByTable.get(config.mappings.monthlyMissingCert.certTableId) ?? []
              : []
            : builderPack === "stageStalled"
              ? config.mappings.stageStalled?.stageTableId
                ? columnsByTable.get(config.mappings.stageStalled.stageTableId) ?? []
                : []
              : [];

  const handleSave = async () => {
    if (!resolvedObraId) return;
    setIsSaving(true);
    try {
      await fetch(`/api/obras/${resolvedObraId}/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRun = async () => {
    if (!resolvedObraId) return;
    setIsRunning(true);
    try {
      const signalsRes = await fetch(`/api/obras/${resolvedObraId}/signals/recompute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodKey }),
      }).then((r) => r.json());
      setSignals(signalsRes.signals ?? emptySignals);
      setRecomputeLogs(signalsRes.logs ?? []);
      const findingsRes = await fetch(`/api/obras/${resolvedObraId}/findings/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodKey }),
      }).then((r) => r.json());
      setFindings(findingsRes.findings ?? emptyFindings);
    } finally {
      setIsRunning(false);
    }
  };

  const handleApplyJson = () => {
    setJsonError(null);
    try {
      const parsed = JSON.parse(jsonDraft);
      setConfig(parsed);
    } catch (error: any) {
      setJsonError(error?.message ?? "JSON inválido");
    }
  };

  return (
    <div className="p-6 space-y-6">
      {!resolvedObraId && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          No se pudo resolver la obra actual. Volvé a abrir la página desde la obra.
        </div>
      )}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reporte de obra</h1>
          <p className="text-sm text-muted-foreground">
            Configurá señales y hallazgos para esta obra.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="grid gap-1">
            <Label htmlFor="period">Período</Label>
            <Input
              id="period"
              type="month"
              value={periodKey}
              onChange={(e) => setPeriodKey(e.target.value)}
            />
          </div>
          <Button onClick={handleRun} disabled={isRunning}>
            {isRunning ? "Recomputando..." : "Recompute now"}
          </Button>
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Tablas detectadas</h2>
          <p className="text-sm text-muted-foreground">
            Manuales, OCR y macro tablas asociadas a esta obra.
          </p>
        </div>
        <div className="space-y-2">
          {tablesForDisplay.map((table) => (
            <div key={table.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{table.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {table.sourceType.toUpperCase()}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {table.columns.length} columnas
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {table.columns.map((col) => (
                  <span key={col.key} className="rounded-full border px-2 py-1">
                    {col.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Tracking Intelligence</h2>
            <p className="text-sm text-muted-foreground">
              Configurá los 3 packs MVP y sus mappings.
            </p>
          </div>
          <Button variant="outline" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Guardando..." : "Guardar configuración"}
          </Button>
        </div>

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Generador de mappings</div>
              <p className="text-sm text-muted-foreground">
                Elegí un pack y definí rápidamente sus columnas.
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-1">
              <Label>Pack</Label>
              <Select value={builderPack} onValueChange={(value) => setBuilderPack(value as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="curve">Curva</SelectItem>
                  <SelectItem value="unpaidCerts">Certificados impagos</SelectItem>
                  <SelectItem value="inactivity">Inactividad</SelectItem>
                  <SelectItem value="monthlyMissingCert">Falta mensual certificado</SelectItem>
                  <SelectItem value="stageStalled">Etapa detenida</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {builderPack === "curve" && (
              <>
                <div className="grid gap-1">
                  <Label>Tabla medición</Label>
                  <Select
                    value={config.mappings.curve?.measurementTableId ?? ""}
                    onValueChange={(value) =>
                      setConfig({
                        ...config,
                        enabledPacks: { ...config.enabledPacks, curve: true },
                        mappings: {
                          ...config.mappings,
                          curve: {
                            ...config.mappings.curve,
                            measurementTableId: value,
                          },
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tabla" />
                    </SelectTrigger>
                    <SelectContent>
                      {builderTableOptions.map((table) => (
                        <SelectItem key={table.id} value={table.id}>
                          {table.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label>Columna avance (%)</Label>
                  <Select
                    value={config.mappings.curve?.actualPctColumnKey ?? ""}
                    onValueChange={(value) =>
                      setConfig({
                        ...config,
                        enabledPacks: { ...config.enabledPacks, curve: true },
                        mappings: {
                          ...config.mappings,
                          curve: {
                            ...config.mappings.curve,
                            actualPctColumnKey: value,
                          },
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar columna" />
                    </SelectTrigger>
                    <SelectContent>
                      {builderColumns.map((col) => (
                        <SelectItem key={col.key} value={col.key}>
                          {col.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {builderPack === "unpaidCerts" && (
              <>
                <div className="grid gap-1">
                  <Label>Tabla certificados</Label>
                  <Select
                    value={config.mappings.unpaidCerts?.certTableId ?? ""}
                    onValueChange={(value) =>
                      setConfig({
                        ...config,
                        enabledPacks: { ...config.enabledPacks, unpaidCerts: true },
                        mappings: {
                          ...config.mappings,
                          unpaidCerts: {
                            ...config.mappings.unpaidCerts,
                            certTableId: value,
                          },
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tabla" />
                    </SelectTrigger>
                    <SelectContent>
                      {builderTableOptions.map((table) => (
                        <SelectItem key={table.id} value={table.id}>
                          {table.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label>Fecha emisión</Label>
                  <Select
                    value={config.mappings.unpaidCerts?.issuedAtColumnKey ?? ""}
                    onValueChange={(value) =>
                      setConfig({
                        ...config,
                        enabledPacks: { ...config.enabledPacks, unpaidCerts: true },
                        mappings: {
                          ...config.mappings,
                          unpaidCerts: {
                            ...config.mappings.unpaidCerts,
                            issuedAtColumnKey: value,
                          },
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar columna" />
                    </SelectTrigger>
                    <SelectContent>
                      {builderColumns.map((col) => (
                        <SelectItem key={col.key} value={col.key}>
                          {col.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {builderPack === "inactivity" && (
              <>
                <div className="grid gap-1">
                  <Label>Tabla medición</Label>
                  <Select
                    value={config.mappings.inactivity?.measurementTableId ?? ""}
                    onValueChange={(value) =>
                      setConfig({
                        ...config,
                        enabledPacks: { ...config.enabledPacks, inactivity: true },
                        mappings: {
                          ...config.mappings,
                          inactivity: {
                            ...config.mappings.inactivity,
                            measurementTableId: value,
                          },
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tabla" />
                    </SelectTrigger>
                    <SelectContent>
                      {builderTableOptions.map((table) => (
                        <SelectItem key={table.id} value={table.id}>
                          {table.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label>Fecha medición</Label>
                  <Select
                    value={config.mappings.inactivity?.measurementDateColumnKey ?? ""}
                    onValueChange={(value) =>
                      setConfig({
                        ...config,
                        enabledPacks: { ...config.enabledPacks, inactivity: true },
                        mappings: {
                          ...config.mappings,
                          inactivity: {
                            ...config.mappings.inactivity,
                            measurementDateColumnKey: value,
                          },
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar columna" />
                    </SelectTrigger>
                    <SelectContent>
                      {builderColumns.map((col) => (
                        <SelectItem key={col.key} value={col.key}>
                          {col.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {builderPack === "monthlyMissingCert" && (
              <>
                <div className="grid gap-1">
                  <Label>Tabla certificados</Label>
                  <Select
                    value={config.mappings.monthlyMissingCert?.certTableId ?? ""}
                    onValueChange={(value) =>
                      setConfig({
                        ...config,
                        enabledPacks: { ...config.enabledPacks, monthlyMissingCert: true },
                        mappings: {
                          ...config.mappings,
                          monthlyMissingCert: {
                            ...config.mappings.monthlyMissingCert,
                            certTableId: value,
                          },
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tabla" />
                    </SelectTrigger>
                    <SelectContent>
                      {builderTableOptions.map((table) => (
                        <SelectItem key={table.id} value={table.id}>
                          {table.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label>Fecha certificado</Label>
                  <Select
                    value={config.mappings.monthlyMissingCert?.certIssuedAtColumnKey ?? ""}
                    onValueChange={(value) =>
                      setConfig({
                        ...config,
                        enabledPacks: { ...config.enabledPacks, monthlyMissingCert: true },
                        mappings: {
                          ...config.mappings,
                          monthlyMissingCert: {
                            ...config.mappings.monthlyMissingCert,
                            certIssuedAtColumnKey: value,
                          },
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar columna" />
                    </SelectTrigger>
                    <SelectContent>
                      {builderColumns.map((col) => (
                        <SelectItem key={col.key} value={col.key}>
                          {col.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {builderPack === "stageStalled" && (
              <>
                <div className="grid gap-1">
                  <Label>Tabla de etapas</Label>
                  <Select
                    value={config.mappings.stageStalled?.stageTableId ?? ""}
                    onValueChange={(value) =>
                      setConfig({
                        ...config,
                        enabledPacks: { ...config.enabledPacks, stageStalled: true },
                        mappings: {
                          ...config.mappings,
                          stageStalled: {
                            ...config.mappings.stageStalled,
                            stageTableId: value,
                          },
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tabla" />
                    </SelectTrigger>
                    <SelectContent>
                      {builderTableOptions.map((table) => (
                        <SelectItem key={table.id} value={table.id}>
                          {table.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label>Columna ubicación/etapa</Label>
                  <Select
                    value={config.mappings.stageStalled?.locationColumnKey ?? ""}
                    onValueChange={(value) =>
                      setConfig({
                        ...config,
                        enabledPacks: { ...config.enabledPacks, stageStalled: true },
                        mappings: {
                          ...config.mappings,
                          stageStalled: {
                            ...config.mappings.stageStalled,
                            locationColumnKey: value,
                          },
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar columna" />
                    </SelectTrigger>
                    <SelectContent>
                      {builderColumns.map((col) => (
                        <SelectItem key={col.key} value={col.key}>
                          {col.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        </Card>

        <div className="grid gap-4">
          <PackCurve
            config={config}
            setConfig={setConfig}
            tables={tableOptions}
            columnsByTable={columnsByTable}
          />
          <PackUnpaid
            config={config}
            setConfig={setConfig}
            tables={tableOptions}
            columnsByTable={columnsByTable}
          />
          <PackInactivity
            config={config}
            setConfig={setConfig}
            tables={tableOptions}
            columnsByTable={columnsByTable}
          />
          <PackMonthlyMissingCert
            config={config}
            setConfig={setConfig}
            tables={tableOptions}
            columnsByTable={columnsByTable}
          />
          <PackStageStalled
            config={config}
            setConfig={setConfig}
            tables={tableOptions}
            columnsByTable={columnsByTable}
          />
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Editor JSON</h2>
            <p className="text-sm text-muted-foreground">
              Editá la configuración completa y aplicala.
            </p>
          </div>
          <Button variant="outline" onClick={() => setShowJson((prev) => !prev)}>
            {showJson ? "Ocultar" : "Mostrar"}
          </Button>
        </div>
        {showJson && (
          <div className="space-y-2">
            <Textarea
              value={jsonDraft}
              onChange={(e) => setJsonDraft(e.target.value)}
              rows={10}
              className="font-mono text-xs"
            />
            {jsonError && (
              <div className="text-sm text-destructive">{jsonError}</div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setJsonDraft(JSON.stringify(config, null, 2))}>
                Restaurar desde config
              </Button>
              <Button onClick={handleApplyJson}>Aplicar JSON</Button>
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 space-y-3">
          <h2 className="text-lg font-semibold">Señales</h2>
          {signals.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sin señales todavía.</div>
          ) : (
            <div className="space-y-2">
              {signals.map((signal) => (
                <div key={signal.signal_key} className="rounded-md border px-3 py-2 text-sm">
                  <div className="font-medium">{signal.signal_key}</div>
                  <div className="text-muted-foreground">
                    {signal.value_num ?? signal.value_bool ?? JSON.stringify(signal.value_json)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4 space-y-3">
          <h2 className="text-lg font-semibold">Hallazgos</h2>
          {findings.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sin hallazgos.</div>
          ) : (
            <div className="space-y-2">
              {findings.map((finding) => (
                <div key={finding.id} className="rounded-md border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{finding.title}</div>
                    <span className="text-xs uppercase text-muted-foreground">
                      {finding.severity}
                    </span>
                  </div>
                  <div className="text-muted-foreground">{finding.message}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4 space-y-3">
        <h2 className="text-lg font-semibold">Log de recomputación</h2>
        {recomputeLogs.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Ejecutá “Recompute now” para ver el detalle de cada señal.
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            {recomputeLogs.map((log, idx) => (
              <div key={`${log.signal_key}-${idx}`} className="rounded-md border px-3 py-2">
                <div className="font-medium">{log.signal_key}</div>
                <div className="text-muted-foreground">
                  Inputs: {JSON.stringify(log.inputs_json)}
                </div>
                <div className="text-muted-foreground">
                  Outputs: {JSON.stringify(log.outputs_json)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function PackCurve({
  config,
  setConfig,
  tables,
  columnsByTable,
}: {
  config: RuleConfig;
  setConfig: (config: RuleConfig) => void;
  tables: ReportTable[];
  columnsByTable: Map<string, ReportTable["columns"]>;
}) {
  const curve = config.mappings.curve ?? {};
  const selectedColumns = curve.measurementTableId
    ? columnsByTable.get(curve.measurementTableId) ?? []
    : [];

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">Pack Curva</div>
          <p className="text-sm text-muted-foreground">Plan vs avance real.</p>
        </div>
        <Switch
          checked={config.enabledPacks.curve}
          onCheckedChange={(checked) =>
            setConfig({
              ...config,
              enabledPacks: { ...config.enabledPacks, curve: checked },
            })
          }
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="grid gap-1">
          <Label>Tabla de medición</Label>
          <Select
            value={curve.measurementTableId ?? ""}
            onValueChange={(value) =>
              setConfig({
                ...config,
                mappings: {
                  ...config.mappings,
                  curve: { ...curve, measurementTableId: value },
                },
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar tabla" />
            </SelectTrigger>
            <SelectContent>
              {tables.map((table) => (
                <SelectItem key={table.id} value={table.id}>
                  {table.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1">
          <Label>Columna avance (%)</Label>
          <Select
            value={curve.actualPctColumnKey ?? ""}
            onValueChange={(value) =>
              setConfig({
                ...config,
                mappings: {
                  ...config.mappings,
                  curve: { ...curve, actualPctColumnKey: value },
                },
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar columna" />
            </SelectTrigger>
            <SelectContent>
              {selectedColumns.map((col) => (
                <SelectItem key={col.key} value={col.key}>
                  {col.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1">
          <Label>Duración plan (meses)</Label>
          <Input
            type="number"
            min={1}
            value={curve.plan?.months ?? ""}
            onChange={(e) =>
              setConfig({
                ...config,
                mappings: {
                  ...config.mappings,
                  curve: {
                    ...curve,
                    plan: {
                      mode: "linear",
                      months: Number(e.target.value || 0),
                      startPeriod: curve.plan?.startPeriod,
                    },
                  },
                },
              })
            }
          />
        </div>

        <div className="grid gap-1">
          <Label>Inicio plan (YYYY-MM)</Label>
          <Input
            type="month"
            value={curve.plan?.startPeriod ?? ""}
            onChange={(e) =>
              setConfig({
                ...config,
                mappings: {
                  ...config.mappings,
                  curve: {
                    ...curve,
                    plan: {
                      mode: "linear",
                      months: curve.plan?.months ?? 0,
                      startPeriod: e.target.value,
                    },
                  },
                },
              })
            }
          />
        </div>
      </div>
    </Card>
  );
}

function PackUnpaid({
  config,
  setConfig,
  tables,
  columnsByTable,
}: {
  config: RuleConfig;
  setConfig: (config: RuleConfig) => void;
  tables: ReportTable[];
  columnsByTable: Map<string, ReportTable["columns"]>;
}) {
  const unpaid = config.mappings.unpaidCerts ?? {};
  const selectedColumns = unpaid.certTableId
    ? columnsByTable.get(unpaid.certTableId) ?? []
    : [];

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">Pack Certificados impagos</div>
          <p className="text-sm text-muted-foreground">Detecta certificados vencidos.</p>
        </div>
        <Switch
          checked={config.enabledPacks.unpaidCerts}
          onCheckedChange={(checked) =>
            setConfig({
              ...config,
              enabledPacks: { ...config.enabledPacks, unpaidCerts: checked },
            })
          }
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="grid gap-1">
          <Label>Tabla certificados</Label>
          <Select
            value={unpaid.certTableId ?? ""}
            onValueChange={(value) =>
              setConfig({
                ...config,
                mappings: {
                  ...config.mappings,
                  unpaidCerts: { ...unpaid, certTableId: value },
                },
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar tabla" />
            </SelectTrigger>
            <SelectContent>
              {tables.map((table) => (
                <SelectItem key={table.id} value={table.id}>
                  {table.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1">
          <Label>Fecha emisión</Label>
          <Select
            value={unpaid.issuedAtColumnKey ?? ""}
            onValueChange={(value) =>
              setConfig({
                ...config,
                mappings: {
                  ...config.mappings,
                  unpaidCerts: { ...unpaid, issuedAtColumnKey: value },
                },
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar columna" />
            </SelectTrigger>
            <SelectContent>
              {selectedColumns.map((col) => (
                <SelectItem key={col.key} value={col.key}>
                  {col.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1">
          <Label>Cobrado (bool)</Label>
          <Select
            value={unpaid.paidBoolColumnKey ?? ""}
            onValueChange={(value) =>
              setConfig({
                ...config,
                mappings: {
                  ...config.mappings,
                  unpaidCerts: { ...unpaid, paidBoolColumnKey: value },
                },
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar columna" />
            </SelectTrigger>
            <SelectContent>
              {selectedColumns.map((col) => (
                <SelectItem key={col.key} value={col.key}>
                  {col.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1">
          <Label>Monto (opcional)</Label>
          <Select
            value={unpaid.amountColumnKey ?? ""}
            onValueChange={(value) =>
              setConfig({
                ...config,
                mappings: {
                  ...config.mappings,
                  unpaidCerts: { ...unpaid, amountColumnKey: value },
                },
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar columna" />
            </SelectTrigger>
            <SelectContent>
              {selectedColumns.map((col) => (
                <SelectItem key={col.key} value={col.key}>
                  {col.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1">
          <Label>Días vencidos</Label>
          <Input
            type="number"
            min={1}
            value={unpaid.days ?? 90}
            onChange={(e) =>
              setConfig({
                ...config,
                mappings: {
                  ...config.mappings,
                  unpaidCerts: { ...unpaid, days: Number(e.target.value || 0) },
                },
              })
            }
          />
        </div>
      </div>
    </Card>
  );
}

function PackInactivity({
  config,
  setConfig,
  tables,
  columnsByTable,
}: {
  config: RuleConfig;
  setConfig: (config: RuleConfig) => void;
  tables: ReportTable[];
  columnsByTable: Map<string, ReportTable["columns"]>;
}) {
  const inactivity = config.mappings.inactivity ?? {};
  const measurementColumns = inactivity.measurementTableId
    ? columnsByTable.get(inactivity.measurementTableId) ?? []
    : [];
  const certColumns = inactivity.certTableId
    ? columnsByTable.get(inactivity.certTableId) ?? []
    : [];

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">Pack Inactividad</div>
          <p className="text-sm text-muted-foreground">Detecta falta de actividad.</p>
        </div>
        <Switch
          checked={config.enabledPacks.inactivity}
          onCheckedChange={(checked) =>
            setConfig({
              ...config,
              enabledPacks: { ...config.enabledPacks, inactivity: checked },
            })
          }
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="grid gap-1">
          <Label>Tabla medición</Label>
          <Select
            value={inactivity.measurementTableId ?? ""}
            onValueChange={(value) =>
              setConfig({
                ...config,
                mappings: {
                  ...config.mappings,
                  inactivity: { ...inactivity, measurementTableId: value },
                },
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar tabla" />
            </SelectTrigger>
            <SelectContent>
              {tables.map((table) => (
                <SelectItem key={table.id} value={table.id}>
                  {table.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1">
          <Label>Fecha medición</Label>
          <Select
            value={inactivity.measurementDateColumnKey ?? ""}
            onValueChange={(value) =>
              setConfig({
                ...config,
                mappings: {
                  ...config.mappings,
                  inactivity: { ...inactivity, measurementDateColumnKey: value },
                },
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar columna" />
            </SelectTrigger>
            <SelectContent>
              {measurementColumns.map((col) => (
                <SelectItem key={col.key} value={col.key}>
                  {col.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1">
          <Label>Tabla certificados</Label>
          <Select
            value={inactivity.certTableId ?? ""}
            onValueChange={(value) =>
              setConfig({
                ...config,
                mappings: {
                  ...config.mappings,
                  inactivity: { ...inactivity, certTableId: value },
                },
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar tabla" />
            </SelectTrigger>
            <SelectContent>
              {tables.map((table) => (
                <SelectItem key={table.id} value={table.id}>
                  {table.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1">
          <Label>Fecha certificado</Label>
          <Select
            value={inactivity.certIssuedAtColumnKey ?? ""}
            onValueChange={(value) =>
              setConfig({
                ...config,
                mappings: {
                  ...config.mappings,
                  inactivity: { ...inactivity, certIssuedAtColumnKey: value },
                },
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar columna" />
            </SelectTrigger>
            <SelectContent>
              {certColumns.map((col) => (
                <SelectItem key={col.key} value={col.key}>
                  {col.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1">
          <Label>Días inactividad</Label>
          <Input
            type="number"
            min={1}
            value={inactivity.days ?? 90}
            onChange={(e) =>
              setConfig({
                ...config,
                mappings: {
                  ...config.mappings,
                  inactivity: { ...inactivity, days: Number(e.target.value || 0) },
                },
              })
            }
          />
        </div>
      </div>
    </Card>
  );
}

function PackMonthlyMissingCert({
  config,
  setConfig,
  tables,
  columnsByTable,
}: {
  config: RuleConfig;
  setConfig: (config: RuleConfig) => void;
  tables: ReportTable[];
  columnsByTable: Map<string, ReportTable["columns"]>;
}) {
  const missing = config.mappings.monthlyMissingCert ?? {};
  const selectedColumns = missing.certTableId
    ? columnsByTable.get(missing.certTableId) ?? []
    : [];

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">Pack Falta mensual certificado</div>
          <p className="text-sm text-muted-foreground">
            Alerta si hubo certificados antes y falta el del período actual.
          </p>
        </div>
        <Switch
          checked={config.enabledPacks.monthlyMissingCert}
          onCheckedChange={(checked) =>
            setConfig({
              ...config,
              enabledPacks: { ...config.enabledPacks, monthlyMissingCert: checked },
            })
          }
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="grid gap-1">
          <Label>Tabla certificados</Label>
          <Select
            value={missing.certTableId ?? ""}
            onValueChange={(value) =>
              setConfig({
                ...config,
                mappings: {
                  ...config.mappings,
                  monthlyMissingCert: { ...missing, certTableId: value },
                },
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar tabla" />
            </SelectTrigger>
            <SelectContent>
              {tables.map((table) => (
                <SelectItem key={table.id} value={table.id}>
                  {table.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1">
          <Label>Fecha certificado</Label>
          <Select
            value={missing.certIssuedAtColumnKey ?? ""}
            onValueChange={(value) =>
              setConfig({
                ...config,
                mappings: {
                  ...config.mappings,
                  monthlyMissingCert: {
                    ...missing,
                    certIssuedAtColumnKey: value,
                  },
                },
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar columna" />
            </SelectTrigger>
            <SelectContent>
              {selectedColumns.map((col) => (
                <SelectItem key={col.key} value={col.key}>
                  {col.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
}

function PackStageStalled({
  config,
  setConfig,
  tables,
  columnsByTable,
}: {
  config: RuleConfig;
  setConfig: (config: RuleConfig) => void;
  tables: ReportTable[];
  columnsByTable: Map<string, ReportTable["columns"]>;
}) {
  const stalled = config.mappings.stageStalled ?? {};
  const selectedColumns = stalled.stageTableId
    ? columnsByTable.get(stalled.stageTableId) ?? []
    : [];

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">Pack Etapa detenida</div>
          <p className="text-sm text-muted-foreground">
            Alerta si permanece en una etapa (ej. Tesorería) más de X semanas.
          </p>
        </div>
        <Switch
          checked={config.enabledPacks.stageStalled}
          onCheckedChange={(checked) =>
            setConfig({
              ...config,
              enabledPacks: { ...config.enabledPacks, stageStalled: checked },
            })
          }
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="grid gap-1">
          <Label>Tabla de etapas</Label>
          <Select
            value={stalled.stageTableId ?? ""}
            onValueChange={(value) =>
              setConfig({
                ...config,
                mappings: {
                  ...config.mappings,
                  stageStalled: { ...stalled, stageTableId: value },
                },
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar tabla" />
            </SelectTrigger>
            <SelectContent>
              {tables.map((table) => (
                <SelectItem key={table.id} value={table.id}>
                  {table.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1">
          <Label>Columna ubicación/etapa</Label>
          <Select
            value={stalled.locationColumnKey ?? ""}
            onValueChange={(value) =>
              setConfig({
                ...config,
                mappings: {
                  ...config.mappings,
                  stageStalled: { ...stalled, locationColumnKey: value },
                },
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar columna" />
            </SelectTrigger>
            <SelectContent>
              {selectedColumns.map((col) => (
                <SelectItem key={col.key} value={col.key}>
                  {col.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1">
          <Label>Fecha inicio etapa (opcional)</Label>
          <Select
            value={stalled.stageSinceColumnKey ?? ""}
            onValueChange={(value) =>
              setConfig({
                ...config,
                mappings: {
                  ...config.mappings,
                  stageStalled: { ...stalled, stageSinceColumnKey: value },
                },
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Usar updated_at/created_at" />
            </SelectTrigger>
            <SelectContent>
              {selectedColumns.map((col) => (
                <SelectItem key={col.key} value={col.key}>
                  {col.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1">
          <Label>Texto etapa</Label>
          <Input
            value={stalled.keyword ?? "Tesorería"}
            onChange={(e) =>
              setConfig({
                ...config,
                mappings: {
                  ...config.mappings,
                  stageStalled: { ...stalled, keyword: e.target.value },
                },
              })
            }
          />
        </div>

        <div className="grid gap-1">
          <Label>Semanas</Label>
          <Input
            type="number"
            min={1}
            value={stalled.weeks ?? 2}
            onChange={(e) =>
              setConfig({
                ...config,
                mappings: {
                  ...config.mappings,
                  stageStalled: { ...stalled, weeks: Number(e.target.value || 0) },
                },
              })
            }
          />
        </div>
      </div>
    </Card>
  );
}
