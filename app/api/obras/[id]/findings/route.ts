import { NextResponse } from "next/server";
import { listFindings } from "@/lib/reporting";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const url = new URL(request.url);
    const periodKey = url.searchParams.get("period") ?? undefined;
    const { id } = await context.params;
    const findings = await listFindings(id, periodKey);
    return NextResponse.json({ findings });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to load findings" },
      { status: 500 }
    );
  }
}
