"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { RuleConfigHub } from "@/components/report/rule-config-hub";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDefaultRuleConfig } from "@/lib/reporting/defaults";
import type { ReportTable, RuleConfig } from "@/lib/reporting/types";

type TenantDefaultsResponse = {
  config?: RuleConfig;
  hasTenantDefault?: boolean;
  tables?: ReportTable[];
  error?: string;
};

export default function ReportingDefaultsPage() {
  const [config, setConfig] = useState<RuleConfig>(getDefaultRuleConfig());
  const [tables, setTables] = useState<ReportTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [hasTenantDefault, setHasTenantDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/reporting/defaults");
      const payload = (await response.json().catch(() => ({}))) as TenantDefaultsResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo cargar la configuracion de reporting");
      }
      setConfig(payload.config ?? getDefaultRuleConfig());
      setHasTenantDefault(Boolean(payload.hasTenantDefault));
      setTables(payload.tables ?? []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "No se pudo cargar la configuracion");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/reporting/defaults", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const payload = (await response.json().catch(() => ({}))) as TenantDefaultsResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo guardar");
      }
      setConfig(payload.config ?? getDefaultRuleConfig());
      setHasTenantDefault(Boolean(payload.hasTenantDefault));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    setError(null);
    try {
      const response = await fetch("/api/reporting/defaults", { method: "DELETE" });
      const payload = (await response.json().catch(() => ({}))) as TenantDefaultsResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo restablecer");
      }
      setConfig(payload.config ?? getDefaultRuleConfig());
      setHasTenantDefault(Boolean(payload.hasTenantDefault));
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "No se pudo restablecer");
    } finally {
      setIsResetting(false);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Cargando configuracion de reporting...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Defaults de Reporting</h1>
          <p className="text-sm text-muted-foreground">
            Este hub define la configuracion base para todas las obras del tenant.
            Una obra solo deja de heredar cuando se guarda un override propio.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/obra-defaults" className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver a configuracion de obras
          </Link>
        </Button>
      </div>

      {error ? (
        <Card className="border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </Card>
      ) : null}

      <RuleConfigHub
        config={config}
        tables={tables}
        onChange={setConfig}
        onSave={handleSave}
        isSaving={isSaving}
        saveLabel="Guardar default del tenant"
        sourceBadgeLabel={hasTenantDefault ? "Default tenant activo" : "Default tenant no guardado"}
        sourceHint="Aplica automaticamente a las obras sin override."
        onResetOverride={hasTenantDefault ? handleReset : null}
        isResettingOverride={isResetting}
      />
    </div>
  );
}
