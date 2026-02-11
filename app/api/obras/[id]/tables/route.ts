import { NextResponse } from "next/server";
import { getObraTables } from "@/lib/reporting";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: obraId } = await context.params;
    if (!obraId || obraId === "undefined") {
      return NextResponse.json(
        { error: "Missing obra id" },
        { status: 400 }
      );
    }
    const tables = await getObraTables(obraId);
    return NextResponse.json({ tables });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to load tables" },
      { status: 500 }
    );
  }
}
