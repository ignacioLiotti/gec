export type ReportTableColumn = {
  key: string;
  label: string;
  type: string;
};

export type ReportTable = {
  id: string;
  name: string;
  sourceType: "manual" | "ocr" | "csv" | "macro" | "default";
  columns: ReportTableColumn[];
};

export type RuleConfig = {
  enabledPacks: {
    curve: boolean;
    unpaidCerts: boolean;
    inactivity: boolean;
    monthlyMissingCert: boolean;
    stageStalled: boolean;
  };
  mappings: {
    recommendations?: {
      certTableId?: string;
      montoAcumuladoColumnKey?: string;
      dateOrPeriodColumnKey?: string;
      // TODO(domain-model): Add recommendation policy fields as first-class config:
      // default_mode (non_blocking), blocking_severity_threshold, tenant overrides.
    };
    curve?: {
      planTableId?: string;
      resumenTableId?: string;
      measurementTableId?: string;
      actualPctColumnKey?: string;
      plan?: { mode: "linear"; months: number; startPeriod?: string };
    };
    unpaidCerts?: {
      certTableId?: string;
      issuedAtColumnKey?: string;
      paidBoolColumnKey?: string;
      amountColumnKey?: string;
      days?: number;
    };
    inactivity?: {
      measurementTableId?: string;
      measurementDateColumnKey?: string;
      certTableId?: string;
      certIssuedAtColumnKey?: string;
      days?: number;
      months?: number;
    };
    monthlyMissingCert?: {
      certTableId?: string;
      certIssuedAtColumnKey?: string;
    };
    stageStalled?: {
      stageTableId?: string;
      locationColumnKey?: string;
      stageSinceColumnKey?: string;
      keyword?: string;
      weeks?: number;
    };
  };
  thresholds: {
    curve: { warnBelow: number; criticalBelow: number };
    unpaidCerts: { severity: "warn" | "critical" };
    inactivity: { severity: "warn" | "critical" };
    monthlyMissingCert: { severity: "warn" | "critical" };
    stageStalled: { severity: "warn" | "critical" };
  };
};

export type RuleConfigResolution = {
  config: RuleConfig;
  hasObraOverride: boolean;
  hasTenantDefault: boolean;
  source: "obra_override" | "tenant_default" | "system_default";
};

export type SignalRow = {
  signal_key: string;
  value_num: number | null;
  value_bool: boolean | null;
  value_json: any;
  computed_at: string;
};

export type FindingRow = {
  id: string;
  rule_key: string;
  severity: "info" | "warn" | "critical";
  title: string;
  message: string | null;
  evidence_json: any;
  status: "open" | "resolved";
  created_at: string;
};

// TODO(domain-model): Adopt this canonical recommendation lifecycle in domain storage/API.
export type RecommendationStatus =
  | "proposed"
  | "surfaced"
  | "accepted"
  | "rejected"
  | "applied"
  | "failed"
  | "expired"
  | "superseded";

// TODO(domain-model): Model recommendation subject identity explicitly:
// recommendation_subject_key = obra_id + rule_key + subject_ref.
// TODO(domain-model): Enforce canonical subject_ref contract:
// subject_ref = <kind>:<id>[:<scope>] with parser/validator + versioning.
// TODO(domain-model): Blocking recommendation permissions must be tenant-configurable
// (minimum owner/admin), not hardcoded in route/UI conditionals.
