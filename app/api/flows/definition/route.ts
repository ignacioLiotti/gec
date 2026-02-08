import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { setFlowDefinition } from "@/lib/engine";
import { validateFlowDefinition } from "@/lib/engine/core/validators";
import type { FlowDefinition } from "@/lib/engine";

export async function POST(request: NextRequest) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	let payload: any = null;
	try {
		payload = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const action = typeof payload?.action === "string" ? payload.action : null;
	const definitionJson = payload?.definitionJson as FlowDefinition | null;
	const obraId = typeof payload?.obraId === "string" ? payload.obraId : null;

	if (!action || !definitionJson) {
		return NextResponse.json(
			{ error: "action and definitionJson are required" },
			{ status: 400 },
		);
	}

	const validation = validateFlowDefinition(definitionJson);
	if (!validation.valid) {
		return NextResponse.json({ validation }, { status: 422 });
	}

	try {
		if (action === "validate") {
			return NextResponse.json({ validation });
		}

		if (action === "set") {
			if (!obraId) {
				return NextResponse.json(
					{ error: "obraId is required" },
					{ status: 400 },
				);
			}
			const instance = await setFlowDefinition(obraId, definitionJson);
			return NextResponse.json({ validation, instance });
		}

		return NextResponse.json(
			{ error: "Unsupported action" },
			{ status: 400 },
		);
	} catch (error: any) {
		console.error("[api/flows/definition]", error);
		return NextResponse.json(
			{ error: error?.message ?? "Failed to process definition" },
			{ status: 500 },
		);
	}
}
