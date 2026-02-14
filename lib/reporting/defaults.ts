import type { RuleConfig } from "./types";

export const DEFAULT_RULE_CONFIG: RuleConfig = {
  enabledPacks: {
    curve: true,
    unpaidCerts: true,
    inactivity: true,
    monthlyMissingCert: true,
    stageStalled: true,
  },
  mappings: {},
  thresholds: {
    curve: { warnBelow: 10, criticalBelow: 20 },
    unpaidCerts: { severity: "warn" },
    inactivity: { severity: "warn" },
    monthlyMissingCert: { severity: "warn" },
    stageStalled: { severity: "warn" },
  },
};

export function getDefaultRuleConfig() {
  return DEFAULT_RULE_CONFIG;
}
