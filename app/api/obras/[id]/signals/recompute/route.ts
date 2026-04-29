import { NextResponse } from "next/server";
import { recomputeSignals } from "@/lib/reporting";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json().catch(() => ({}));
    const periodKey = body?.periodKey ?? body?.period ?? undefined;
    const { id } = await context.params;
    const result = await recomputeSignals(id, periodKey);
    // TODO(domain-model): Emit `calculo_recalculado` domain event with runId + periodKey
    // so recommendation workflows can react explicitly.
    const snapshot = Array.isArray((result as any)?.snapshot)
      ? (result as any).snapshot
      : result;
    // TODO(domain-model): Hook recommendation generation here (non-blocking by default),
    // with explicit accept/reject audit trail in domain storage.
    // TODO(domain-model): Persist recommendation lifecycle states:
    // proposed -> surfaced -> accepted/rejected -> applied/failed + auto-close expired/superseded.
    // Keep accepted/applied as separate transitions.
    // TODO(domain-model): If a new recommendation arrives with the same
    // recommendation_subject_key and previous one is accepted-but-not-applied, mark previous
    // as superseded and open a new proposed recommendation.
    // TODO(domain-model): Support both expiry modes:
    // timeout-based + event invalidation; event invalidation has precedence.
    // TODO(domain-model): Deduplicate/supersede by
    // recommendation_subject_key = obra_id + rule_key + subject_ref.
    // TODO(domain-model): Recommendation engine mode should default to async domain events;
    // sync evaluation reserved for critical immediate-blocking rules only.
    // TODO(domain-model): Apply blocking escalation only via rule/severity/tenant policy,
    // never ad-hoc from route/UI logic.
    return NextResponse.json({
      signals: snapshot,
      runId: (result as any)?.runId ?? null,
      logs: (result as any)?.logs ?? [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to recompute signals" },
      { status: 500 }
    );
  }
}
