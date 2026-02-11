import { NextResponse } from "next/server";
import { evaluateFindings } from "@/lib/reporting";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json().catch(() => ({}));
    const periodKey = body?.periodKey ?? body?.period ?? undefined;
    const { id } = await context.params;
    const findings = await evaluateFindings(id, periodKey);
    return NextResponse.json({ findings });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to evaluate findings" },
      { status: 500 }
    );
  }
}
