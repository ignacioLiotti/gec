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
  };
  mappings: {
    curve?: {
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
    };
  };
  thresholds: {
    curve: { warnBelow: number; criticalBelow: number };
    unpaidCerts: { severity: "warn" | "critical" };
    inactivity: { severity: "warn" | "critical" };
  };
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
