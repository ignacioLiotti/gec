"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RuleConfigHub } from "@/components/report/rule-config-hub";
import type {
  FindingRow,
  ReportTable,
  RuleConfig,
  RuleConfigResolution,
  SignalRow,
} from "@/lib/reporting/types";
import { getDefaultRuleConfig } from "@/lib/reporting/defaults";

type RulesApiResponse = Partial<RuleConfigResolution> & { config?: RuleConfig };

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
  const [periodKey, setPeriodKey] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isResettingOverride, setIsResettingOverride] = useState(false);
  const [hasObraOverride, setHasObraOverride] = useState(false);
  const [hasTenantDefault, setHasTenantDefault] = useState(false);
  const [configSource, setConfigSource] = useState<RuleConfigResolution["source"]>("system_default");

  useEffect(() => {
    if (!resolvedObraId) return;

    const load = async () => {
      const [tablesRes, rulesRes, signalsRes, findingsRes] = await Promise.all([
        fetch(`/api/obras/${resolvedObraId}/tables`).then((r) => r.json()),
        fetch(`/api/obras/${resolvedObraId}/rules?includeMeta=1`).then((r) => r.json()),
        fetch(`/api/obras/${resolvedObraId}/signals?period=${periodKey}`).then((r) => r.json()),
        fetch(`/api/obras/${resolvedObraId}/findings?period=${periodKey}`).then((r) => r.json()),
      ]);

      setTables(tablesRes.tables ?? []);

      const rulesPayload = (rulesRes ?? {}) as RulesApiResponse;
      setConfig(rulesPayload.config ?? getDefaultRuleConfig());
      setHasObraOverride(Boolean(rulesPayload.hasObraOverride));
      setHasTenantDefault(Boolean(rulesPayload.hasTenantDefault));
      setConfigSource((rulesPayload.source as RuleConfigResolution["source"]) ?? "system_default");

      setSignals(signalsRes.signals ?? emptySignals);
      setFindings(findingsRes.findings ?? emptyFindings);
    };

    void load();
  }, [resolvedObraId, periodKey]);

  const sourceBadgeLabel = useMemo(() => {
    if (configSource === "obra_override") return "Override de esta obra";
    if (configSource === "tenant_default") return "Usando default del tenant";
    return "Usando default global";
  }, [configSource]);

  const sourceHint = useMemo(() => {
    if (hasObraOverride) {
      return "Esta obra tiene configuración propia. Si querés volver al default del tenant, podés resetearla.";
    }
    if (hasTenantDefault) {
      return "Esta obra está heredando el default de reporting definido para todo el tenant.";
    }
    return "No hay default de tenant configurado. Se usa el default del sistema.";
  }, [hasObraOverride, hasTenantDefault]);

  const handleSave = async () => {
    if (!resolvedObraId) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/obras/${resolvedObraId}/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "No se pudo guardar la configuración");
      }
      setHasObraOverride(true);
      setConfigSource("obra_override");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetOverride = async () => {
    if (!resolvedObraId) return;
    setIsResettingOverride(true);
    try {
      const response = await fetch(`/api/obras/${resolvedObraId}/rules`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => ({}))) as RulesApiResponse;
      if (!response.ok) {
        throw new Error(typeof (payload as any)?.error === "string" ? (payload as any).error : "No se pudo restablecer");
      }
      setConfig(payload.config ?? getDefaultRuleConfig());
      setHasObraOverride(Boolean(payload.hasObraOverride));
      setHasTenantDefault(Boolean(payload.hasTenantDefault));
      setConfigSource((payload.source as RuleConfigResolution["source"]) ?? "system_default");
    } finally {
      setIsResettingOverride(false);
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

  return (
    <div className="p-6 space-y-6">
      {!resolvedObraId ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          No se pudo resolver la obra actual. Volvé a abrir la página desde la obra.
        </div>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Hub de reglas de obra</h1>
          <p className="text-sm text-muted-foreground">
            Configurá qué tablas y columnas alimentan cada pack de señales, hallazgos y recomendaciones.
          </p>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="period">Período</Label>
          <Input
            id="period"
            type="month"
            value={periodKey}
            onChange={(e) => setPeriodKey(e.target.value)}
            className="w-[180px]"
          />
        </div>
      </div>

      <RuleConfigHub
        config={config}
        tables={tables}
        onChange={setConfig}
        onSave={handleSave}
        isSaving={isSaving}
        saveLabel="Guardar configuración de obra"
        onRun={handleRun}
        isRunning={isRunning}
        runLabel="Recalcular señales y hallazgos"
        sourceBadgeLabel={sourceBadgeLabel}
        sourceHint={sourceHint}
        onResetOverride={hasObraOverride ? handleResetOverride : null}
        isResettingOverride={isResettingOverride}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 space-y-3">
          <h2 className="text-lg font-semibold">Señales ({signals.length})</h2>
          <div className="max-h-[360px] overflow-auto space-y-2">
            {signals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay señales para este período.</p>
            ) : (
              signals.map((signal) => (
                <div key={signal.signal_key} className="rounded-md border p-2 text-sm">
                  <p className="font-medium">{signal.signal_key}</p>
                  <p className="text-muted-foreground">
                    num: {signal.value_num ?? "-"} · bool: {signal.value_bool == null ? "-" : signal.value_bool ? "true" : "false"}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <h2 className="text-lg font-semibold">Hallazgos ({findings.length})</h2>
          <div className="max-h-[360px] overflow-auto space-y-2">
            {findings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay hallazgos abiertos para este período.</p>
            ) : (
              findings.map((finding) => (
                <div key={finding.id} className="rounded-md border p-2 text-sm">
                  <p className="font-medium">{finding.title}</p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{finding.severity}</p>
                  {finding.message ? <p className="mt-1 text-muted-foreground">{finding.message}</p> : null}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}