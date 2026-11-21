import { Badge, type BadgeProps } from "@/components/ui/badge";
import { insurancePolicyStatusLabels, type InsurancePolicyStatus } from "@/lib/insurance-policy-status";

export const insurancePolicyStatusVariants = {
  active: "success", dueSoon: "warning", expired: "destructive", cancelled: "info",
} as const satisfies Record<InsurancePolicyStatus, BadgeProps["variant"]>;

// Icons, progress bars and badges share the same status meanings.
const presentation = {
  active: { tone: "border-success/25 bg-success/10 text-success", progress: "bg-success", accent: "text-success" },
  dueSoon: { tone: "border-warning/30 bg-warning/15 text-warning-foreground", progress: "bg-warning", accent: "text-warning-foreground" },
  expired: { tone: "border-destructive/25 bg-destructive/10 text-destructive", progress: "bg-destructive", accent: "text-destructive" },
  cancelled: { tone: "border-info/25 bg-info/10 text-info", progress: "bg-info", accent: "text-info" },
} as const;

export const insurancePolicyStatusClasses = (status: InsurancePolicyStatus) => presentation[status].tone;
export const insurancePolicyProgressClasses = (status: InsurancePolicyStatus) => presentation[status].progress;
export const insurancePolicyAccentClasses = (status: InsurancePolicyStatus) => presentation[status].accent;

export function InsurancePolicyStatusBadge({ status, ...props }: Omit<BadgeProps, "variant" | "children"> & { status: InsurancePolicyStatus }) {
  return <Badge variant={insurancePolicyStatusVariants[status]} {...props}>{insurancePolicyStatusLabels[status]}</Badge>;
}
