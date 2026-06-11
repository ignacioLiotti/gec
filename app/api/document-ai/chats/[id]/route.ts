import { NextResponse } from "next/server";

import { resolveRequestAccessContext } from "@/lib/demo-session";
import { hasDocumentAiPermission } from "@/lib/document-ai/permissions";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
	try {
		const { id: chatId } = await context.params;
		const access = await resolveRequestAccessContext();
		const { supabase, user, tenantId } = access;
		if (!user?.id || !tenantId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		if (!(await hasDocumentAiPermission(access))) {
			return NextResponse.json({ error: "Sin permisos para Document AI." }, { status: 403 });
		}

		const { data: chat, error: chatError } = await supabase
			.from("document_ai_chats")
			.select("id, title, scope")
			.eq("id", chatId)
			.eq("tenant_id", tenantId)
			.eq("user_id", user.id)
			.maybeSingle();
		if (chatError) throw chatError;
		if (!chat) {
			return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
		}

		const { data: messages, error: messagesError } = await supabase
			.from("document_ai_chat_messages")
			.select("id, role, content, tool_invocations, created_at")
			.eq("chat_id", chatId)
			.order("created_at", { ascending: true })
			.limit(200);
		if (messagesError) throw messagesError;

		return NextResponse.json({
			chat,
			messages: (messages ?? []).map((message) => ({
				id: String(message.id),
				role: message.role,
				content: message.content ?? "",
				toolInvocations: Array.isArray(message.tool_invocations)
					? (message.tool_invocations as Array<Record<string, unknown>>).map((entry, index) => ({
						state: "result" as const,
						toolCallId: `${message.id}-${index}`,
						toolName: String(entry.toolName ?? ""),
						args: (entry.args as Record<string, unknown>) ?? {},
						result: entry.result,
					}))
					: undefined,
				createdAt: message.created_at,
			})),
		});
	} catch (error) {
		console.error("[document-ai/chats/:id:get]", error);
		return NextResponse.json({ error: "Error al cargar la conversación" }, { status: 500 });
	}
}

export async function DELETE(_request: Request, context: RouteContext) {
	try {
		const { id: chatId } = await context.params;
		const access = await resolveRequestAccessContext();
		const { supabase, user, tenantId } = access;
		if (!user?.id || !tenantId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		if (!(await hasDocumentAiPermission(access))) {
			return NextResponse.json({ error: "Sin permisos para Document AI." }, { status: 403 });
		}
		const { error } = await supabase
			.from("document_ai_chats")
			.delete()
			.eq("id", chatId)
			.eq("tenant_id", tenantId)
			.eq("user_id", user.id);
		if (error) throw error;
		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("[document-ai/chats/:id:delete]", error);
		return NextResponse.json({ error: "No se pudo borrar la conversación" }, { status: 500 });
	}
}
