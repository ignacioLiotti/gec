"use client";

import { ArrowLeft, Check, Loader2, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  DataFlowBuilderAggregation,
  DataFlowBuilderCalculation,
  DataFlowBuilderConfig,
  DataFlowBuilderFormulaInput,
  DataFlowBuilderMacroSource,
  DataFlowBuilderObraFieldSource,
  DataFlowBuilderResult,
  DataFlowBuilderSourceType,
  DataFlowBuilderTableSource,
  DataFlowBuilderWritebackPlan,
  EvaluatedDataFlowCalculation,
  EvaluatedDataFlowResult,
} from "@/lib/data-flow-builder";
import { SemanticFlowView } from "./semantic-flow-view";

export type BuilderSourceType = DataFlowBuilderSourceType;
export type BuilderAggregation = DataFlowBuilderAggregation;
export type BuilderFormulaInput = DataFlowBuilderFormulaInput;
export type BuilderCalculation = DataFlowBuilderCalculation;
export type BuilderConfig = DataFlowBuilderConfig;
export type BuilderResult = DataFlowBuilderResult;

export type DataFlowConfigPayload = {
  scope?: "obra" | "tenant";
  config: BuilderConfig;
  inheritedConfig?: BuilderConfig | null;
  effectiveConfig?: BuilderConfig | null;
  sources: {
    tables: DataFlowBuilderTableSource[];
    macroTables: DataFlowBuilderMacroSource[];
    obraFields: DataFlowBuilderObraFieldSource[];
  };
  evaluated?: {
    calculations: EvaluatedDataFlowCalculation[];
    results: EvaluatedDataFlowResult[];
  } | null;
  generalTabSlots?: Array<{ id: "hero" | "financial"; label: string }>;
  canWrite?: boolean;
  writeback?: string[];
  writebackPlan?: DataFlowBuilderWritebackPlan;
  updatedAt?: string | null;
};

type DataFlowPageClientProps = {
  scope: "obra" | "tenant";
  graphEndpoint: string;
  configEndpoint: string;
  backHref: string;
  backLabel: string;
  breadcrumbRoot?: string;
  demoPayload?: DataFlowConfigPayload;
  initialSemanticScope?: "result" | "all";
  initialAdvanced?: boolean;
  initialExpanded?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readJsonResponse(response: Response) {
  return response.json().catch(() => ({}));
}

export function DataFlowPageClient({
  scope,
  graphEndpoint: _graphEndpoint,
  configEndpoint,
  backHref,
  backLabel,
  breadcrumbRoot = "Obras",
  demoPayload,
  initialSemanticScope,
  initialAdvanced,
  initialExpanded,
}: DataFlowPageClientProps) {
  void _graphEndpoint;
  const [configPayload, setConfigPayload] = useState<DataFlowConfigPayload | null>(demoPayload ?? null);
  const [loading, setLoading] = useState(!demoPayload);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const canWrite = configPayload?.canWrite !== false;
  const title = scope === "tenant" ? "Data-flow general" : "Trazabilidad de resultados";
  const subtitle = scope === "tenant"
    ? "Configuración semántica compartida"
    : "Vista semántica";

  useEffect(() => {
    if (demoPayload) {
      setConfigPayload(demoPayload);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function loadConfig() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(configEndpoint, { cache: "no-store" });
        const result = await readJsonResponse(response);
        if (!response.ok) {
          throw new Error(isRecord(result) && typeof result.error === "string"
            ? result.error
            : "No se pudo cargar la configuración de data-flow.");
        }
        if (!cancelled) setConfigPayload(result as DataFlowConfigPayload);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "No se pudo cargar data-flow.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadConfig();
    return () => {
      cancelled = true;
    };
  }, [configEndpoint, demoPayload, refreshToken]);

  const applyAndSaveBuilderConfig = useCallback(async (updater: (baseConfig: BuilderConfig) => BuilderConfig) => {
    if (!configPayload) return;
    const nextConfig = updater(configPayload.config);
    const optimisticPayload: DataFlowConfigPayload = {
      ...configPayload,
      config: nextConfig,
      effectiveConfig: configPayload.effectiveConfig ? updater(configPayload.effectiveConfig) : nextConfig,
    };
    setConfigPayload(optimisticPayload);

    if (demoPayload) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(configEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: nextConfig }),
      });
      const result = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(isRecord(result) && typeof result.error === "string"
          ? result.error
          : "No se pudo guardar data-flow.");
      }
      setConfigPayload(result as DataFlowConfigPayload);
      setRefreshToken((current) => current + 1);
    } catch (saveError) {
      setConfigPayload(configPayload);
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar data-flow.");
    } finally {
      setSaving(false);
    }
  }, [configEndpoint, configPayload, demoPayload]);

  const content = useMemo(() => {
    if (loading && !configPayload) {
      return (
        <div className="flex min-h-[360px] items-center justify-center text-sm text-stone-500">
          <div className="text-center">
            <Loader2 className="mx-auto mb-3 size-5 animate-spin" />
            Cargando configuración…
          </div>
        </div>
      );
    }

    if (!configPayload) {
      return (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error ?? "No se pudo cargar data-flow."}
        </div>
      );
    }

    return (
      <SemanticFlowView
        payload={configPayload}
        config={configPayload.config}
        saving={saving}
        canWrite={canWrite}
        error={error}
        onApplyConfig={applyAndSaveBuilderConfig}
        initialSemanticScope={initialSemanticScope}
        initialAdvanced={initialAdvanced}
        initialExpanded={initialExpanded}
      />
    );
  }, [
    applyAndSaveBuilderConfig,
    canWrite,
    configPayload,
    error,
    initialAdvanced,
    initialExpanded,
    initialSemanticScope,
    loading,
    saving,
  ]);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 px-6 py-4">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2 text-xs text-stone-500">
              <span>{breadcrumbRoot}</span>
              <span>/</span>
              <span>{title}</span>
            </div>
            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-lg font-semibold text-stone-950">{title}</h1>
              <span className="text-xs text-stone-500">{subtitle}</span>
            </div>
          </div>

          {saving ? (
            <span className="inline-flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-medium text-orange-700">
              <Loader2 className="size-3.5 animate-spin" />
              Guardando
            </span>
          ) : configPayload ? (
            <span className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
              <Check className="size-3.5" />
              Semántico
            </span>
          ) : null}

          <button
            type="button"
            onClick={() => setRefreshToken((current) => current + 1)}
            className="inline-flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 shadow-sm transition hover:bg-stone-50"
          >
            <RefreshCcw className="size-3.5" />
            Actualizar
          </button>

          <Link
            href={backHref}
            className="inline-flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 shadow-sm transition hover:bg-stone-50"
          >
            <ArrowLeft className="size-3.5" />
            {backLabel}
          </Link>
        </div>
      </header>

      <main className="p-6">
        {content}
      </main>
    </div>
  );
}

export default function ObraDataFlowPageClient() {
  const params = useParams<{ obraId: string }>();
  const obraId = params?.obraId ?? "";

  return (
    <DataFlowPageClient
      scope="obra"
      graphEndpoint={`/api/obras/${obraId}/data-flow-graph`}
      configEndpoint={`/api/obras/${obraId}/data-flow-config`}
      backHref={`/excel/${obraId}`}
      backLabel="Excel"
      breadcrumbRoot="Excel"
    />
  );
}
