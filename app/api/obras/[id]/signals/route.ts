import { NextResponse } from "next/server";
import { getSignalsSnapshot } from "@/lib/reporting";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const url = new URL(request.url);
    const periodKey = url.searchParams.get("period") ?? undefined;
    const { id } = await context.params;
    const signals = await getSignalsSnapshot(id, periodKey);
    return NextResponse.json({ signals });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to load signals" },
      { status: 500 }
    );
  }
}
