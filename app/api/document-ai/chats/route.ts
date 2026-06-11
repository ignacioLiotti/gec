import { NextResponse } from "next/server";

import { resolveRequestAccessContext } from "@/lib/demo-session";
import { hasDocumentAiPermission } from "@/lib/document-ai/permissions";

export async function GET() {
	try {
		const access = await resolveRequestAccessContext();
		const { supabase, user, tenantId } = access;
		if (!user?.id || !tenantId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		if (!(await hasDocumentAiPermission(access))) {
			return NextResponse.json({ error: "Sin permisos para Document AI." }, { status: 403 });
		}

		const { data, error } = await supabase
			.from("document_ai_chats")
			.select("id, title, updated_at, created_at")
			.eq("tenant_id", tenantId)
			.eq("user_id", user.id)
			.order("updated_at", { ascending: false })
			.limit(30);
		if (error) {
			// Chat tables may not be migrated yet — treat as empty history.
			console.warn("[document-ai/chats:get]", error);
			return NextResponse.json({ chats: [] });
		}
		return NextResponse.json({ chats: data ?? [] });
	} catch (error) {
		console.error("[document-ai/chats:get]", error);
		return NextResponse.json({ error: "Error al cargar conversaciones" }, { status: 500 });
	}
}
