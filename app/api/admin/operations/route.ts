import { NextResponse } from "next/server";
import { ApiValidationError } from "@/lib/http/validation";
import { parseOperationsSelection } from "@/lib/admin/operations/selection";
import { loadOperationsSnapshot } from "@/lib/admin/operations/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	try {
		const selection = parseOperationsSelection(new URL(request.url).searchParams);
		return NextResponse.json(await loadOperationsSnapshot(selection), { headers: { "Cache-Control": "private, no-store" } });
	} catch (error) {
		if (error instanceof ApiValidationError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "private, no-store" } });
		return NextResponse.json({ error: "No se pudo consultar la consola de operaciones" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
	}
}
