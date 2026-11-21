export type InsurancePolicyStatus = "active" | "dueSoon" | "expired" | "cancelled";

export const insurancePolicyStatusLabels: Record<InsurancePolicyStatus, string> = {
  active: "Vigente",
  dueSoon: "Por vencer",
  expired: "Vencida",
  cancelled: "Dada de baja",
};

/** Coverage expiry takes precedence over a later operational cancellation date. */
export function getInsurancePolicyStatus(policy: {
  isCancelled: boolean;
  endDate: string | null;
  calculatedCancellationDate: string | null;
}, now = new Date()): InsurancePolicyStatus {
  if (policy.isCancelled) return "cancelled";
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  function daysUntil(value: string | null) {
    if (!value) return null;
    const date = Date.parse(value.slice(0, 10));
    return Number.isFinite(date) ? Math.round((date - today) / 86_400_000) : null;
  }
  const coverageDays = daysUntil(policy.endDate);
  if (coverageDays !== null && coverageDays < 0) return "expired";
  const cancellationDays = daysUntil(policy.calculatedCancellationDate);
  if (cancellationDays !== null && cancellationDays < 0) return "expired";
  if (cancellationDays !== null && cancellationDays <= 60) return "dueSoon";
  return "active";
}
