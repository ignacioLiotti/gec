import { NextRequest, NextResponse } from "next/server";
import { streamText, type CoreMessage } from "ai";
import { openai } from "@ai-sdk/openai";

import { resolveRequestAccessContext } from "@/lib/demo-session";
import { hasDocumentAiPermission } from "@/lib/document-ai/permissions";
import {
	buildDocumentAiChatTools,
	type CollectedToolInvocation,
} from "@/lib/document-ai/chat/tools";
import {
	parseChatScope,
	resolveTenantObras,
	sanitizeScope,
} from "@/lib/document-ai/chat/scope";
import { buildDocumentAiSystemPrompt } from "@/lib/document-ai/chat/system-prompt";
import { logTenantUsageEvent } from "@/lib/tenant-usage";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

export const maxDuration = 120;

const MAX_HISTORY_MESSAGES = 30;
const MAX_USER_MESSAGES_PER_HOUR = 120;
const CHAT_ID_HEADER = "x-document-ai-chat-id";

type IncomingMessage = {
	role?: string;
	content?: unknown;
};

function sanitizeMessages(raw: unknown): CoreMessage[] {
	if (!Array.isArray(raw)) return [];
	const messages: CoreMessage[] = [];
	for (const entry of raw as IncomingMessage[]) {
		const role = entry?.role;
		const content = typeof entry?.content === "string" ? entry.content.trim() : "";
		if (!content) continue;
		if (role === "user") messages.push({ role: "user", content });
		if (role === "assistant") messages.push({ role: "assistant", content });
	}
	return messages.slice(-MAX_HISTORY_MESSAGES);
}

export async function POST(request: NextRequest) {
	try {
		const access = await resolveRequestAccessContext();
		const { supabase, user, tenantId } = access;
		if (!user?.id || !tenantId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		if (!(await hasDocumentAiPermission(access))) {
			return NextResponse.json({ error: "Sin permisos para Document AI." }, { status: 403 });
		}
		if (!process.env.OPENAI_API_KEY) {
			return NextResponse.json(
				{ error: "El chat de Document AI no está configurado (falta OPENAI_API_KEY)." },
				{ status: 503 },
			);
		}

		const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
		const messages = sanitizeMessages(body.messages);
		const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
		if (!lastUserMessage || typeof lastUserMessage.content !== "string") {
			return NextResponse.json({ error: "El mensaje es obligatorio." }, { status: 400 });
		}

		const tenantObras = await resolveTenantObras(supabase, tenantId);
		const scope = sanitizeScope(parseChatScope(body.scope), tenantObras);

		// Best-effort rate limit: the chat tables may not exist yet on older
		// environments; in that case persistence and limits degrade gracefully.
		let chatId: string | null = null;
		let persistenceAvailable = true;
		try {
			const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
			const { count, error: countError } = await supabase
				.from("document_ai_chat_messages")
				.select("id", { count: "exact", head: true })
				.eq("tenant_id", tenantId)
				.eq("role", "user")
				.gte("created_at", oneHourAgo);
			if (countError) throw countError;
			if ((count ?? 0) >= MAX_USER_MESSAGES_PER_HOUR) {
				return NextResponse.json(
					{ error: "Se alcanzó el límite de mensajes por hora de la organización. Probá más tarde." },
					{ status: 429 },
				);
			}
		} catch (error) {
			persistenceAvailable = false;
			console.warn("[document-ai/chat] rate-limit check unavailable", error);
		}

		if (persistenceAvailable) {
			try {
				const requestedChatId = typeof body.chatId === "string" ? body.chatId : null;
				if (requestedChatId) {
					const { data: existing } = await supabase
						.from("document_ai_chats")
						.select("id")
						.eq("id", requestedChatId)
						.eq("tenant_id", tenantId)
						.eq("user_id", user.id)
						.maybeSingle();
					chatId = existing ? String(existing.id) : null;
				}
				if (!chatId) {
					const { data: created, error: createError } = await supabase
						.from("document_ai_chats")
						.insert({
							tenant_id: tenantId,
							user_id: user.id,
							title: lastUserMessage.content.slice(0, 80),
							scope,
						})
						.select("id")
						.single();
					if (createError) throw createError;
					chatId = String(created.id);
				}
				await supabase.from("document_ai_chat_messages").insert({
					chat_id: chatId,
					tenant_id: tenantId,
					user_id: user.id,
					role: "user",
					content: lastUserMessage.content,
				});
			} catch (error) {
				persistenceAvailable = false;
				chatId = null;
				console.warn("[document-ai/chat] persistence unavailable", error);
			}
		}

		const admin = createSupabaseAdminClient();
		const collectedInvocations: CollectedToolInvocation[] = [];
		const tools = buildDocumentAiChatTools({
			supabase,
			admin,
			tenantId,
			userId: user.id,
			baseUrl: request.url,
			scope,
			tenantObras,
			onInvocation: (invocation) => collectedInvocations.push(invocation),
		});

		const result = await streamText({
			model: openai(process.env.DOCUMENT_AI_CHAT_MODEL || "gpt-4o-mini"),
			system: buildDocumentAiSystemPrompt({ scope, tenantObras }),
			messages,
			tools,
			maxSteps: 8,
			temperature: 0.2,
			maxTokens: 2000,
			onFinish: async ({ text, usage }) => {
				if (persistenceAvailable && chatId) {
					try {
						await supabase.from("document_ai_chat_messages").insert({
							chat_id: chatId,
							tenant_id: tenantId,
							user_id: user.id,
							role: "assistant",
							content: text,
							tool_invocations: collectedInvocations,
							usage: usage ?? {},
						});
						await supabase
							.from("document_ai_chats")
							.update({ updated_at: new Date().toISOString() })
							.eq("id", chatId);
					} catch (error) {
						console.warn("[document-ai/chat] failed to persist assistant message", error);
					}
				}
				const totalTokens = usage?.totalTokens;
				if (typeof totalTokens === "number" && totalTokens > 0) {
					await logTenantUsageEvent(supabase, {
						tenantId,
						kind: "ai_tokens",
						amount: totalTokens,
						context: "document-ai-chat",
						metadata: { chatId, tools: collectedInvocations.map((entry) => entry.toolName) },
					});
				}
			},
		});

		return result.toDataStreamResponse({
			headers: chatId ? { [CHAT_ID_HEADER]: chatId } : undefined,
			getErrorMessage: (error) => {
				// Without this the SDK masks stream errors and nothing reaches the
				// server logs nor the client toast.
				console.error("[document-ai/chat] stream error", error);
				if (error instanceof Error) return error.message;
				return typeof error === "string" ? error : "Error en el chat de Document AI";
			},
		});
	} catch (error) {
		console.error("[document-ai/chat]", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error en el chat de Document AI" },
			{ status: 500 },
		);
	}
}
