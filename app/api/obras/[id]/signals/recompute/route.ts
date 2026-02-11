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
    const snapshot = Array.isArray((result as any)?.snapshot)
      ? (result as any).snapshot
      : result;
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
