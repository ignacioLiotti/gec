import { NextResponse } from "next/server";
import { getDefaultRuleConfig, getRuleConfig, saveRuleConfig } from "@/lib/reporting";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const config = await getRuleConfig(id);
    return NextResponse.json({ config });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to load rule config", config: getDefaultRuleConfig() },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { id } = await context.params;
    await saveRuleConfig(id, body?.config ?? body);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to save rule config" },
      { status: 500 }
    );
  }
}
