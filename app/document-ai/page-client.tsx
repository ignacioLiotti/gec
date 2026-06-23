"use client";

import "./document-ai.css";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat, type Message } from "ai/react";
import {
	ArrowDown,
	ArrowUp,
	History,
	Loader2,
	Plus,
	Square,
	Trash2,
	TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ChatMarkdown } from "./_components/markdown";
import { ToolInvocationView } from "./_components/tool-invocation";
import {
	ScopeChips,
	ScopePicker,
	type ChatScope,
	type WorkOption,
} from "./_components/scope-picker";

const CHAT_ID_HEADER = "x-document-ai-chat-id";

const SUGGESTIONS = [
	"¿Cuál es el último certificado de avance cargado y de qué monto?",
	"Listame las órdenes de compra de este año con sus montos",
	"¿Qué carpetas y documentos tiene cargada la obra?",
	"Generá un PDF con la evolución mensual de lo certificado",
];

type ChatSummary = {
	id: string;
	title: string;
	updated_at: string;
};

function formatRelativeDate(value: string) {
	const date = new Date(value);
	const diffMs = Date.now() - date.getTime();
	const diffMinutes = Math.floor(diffMs / 60000);
	if (diffMinutes < 1) return "recién";
	if (diffMinutes < 60) return `hace ${diffMinutes} min`;
	const diffHours = Math.floor(diffMinutes / 60);
	if (diffHours < 24) return `hace ${diffHours} h`;
	return date.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

function ThinkingIndicator() {
	return (
		<div className="dai-message-enter flex items-center gap-2 py-1">
			<span className="dai-thinking text-sm font-medium">Pensando…</span>
		</div>
	);
}

export function DocumentAiPageClient({ works }: { works: WorkOption[] }) {
	const [chatId, setChatId] = useState<string | null>(null);
	const [scope, setScope] = useState<ChatScope>({ obraIds: [], folders: [] });
	const [chats, setChats] = useState<ChatSummary[]>([]);
	const [loadingChatId, setLoadingChatId] = useState<string | null>(null);
	const [historyOpen, setHistoryOpen] = useState(false);
	const [isAtBottom, setIsAtBottom] = useState(true);

	const scrollContainerRef = useRef<HTMLDivElement | null>(null);
	const bottomRef = useRef<HTMLDivElement | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const chatIdRef = useRef<string | null>(null);
	chatIdRef.current = chatId;

	const {
		messages,
		setMessages,
		input,
		setInput,
		handleInputChange,
		handleSubmit,
		isLoading,
		stop,
		error,
		reload,
	} = useChat({
		api: "/api/document-ai/chat",
		onResponse: (response) => {
			const id = response.headers.get(CHAT_ID_HEADER);
			if (id && id !== chatIdRef.current) setChatId(id);
		},
		onError: (chatError) => {
			toast.error(chatError.message || "No se pudo responder. Probá de nuevo.");
		},
		onFinish: () => {
			void refreshChats();
		},
	});

	const refreshChats = useCallback(async () => {
		try {
			const response = await fetch("/api/document-ai/chats", { cache: "no-store" });
			const payload = (await response.json().catch(() => ({}))) as { chats?: ChatSummary[] };
			if (response.ok) setChats(payload.chats ?? []);
		} catch {
			// History is best-effort; the chat keeps working without it.
		}
	}, []);

	useEffect(() => {
		void refreshChats();
	}, [refreshChats]);

	// Keep the view pinned to the bottom while streaming, unless the user
	// scrolled up to read something.
	useEffect(() => {
		if (isAtBottom) {
			bottomRef.current?.scrollIntoView({ block: "end" });
		}
	}, [messages, isLoading, isAtBottom]);

	const handleScroll = () => {
		const container = scrollContainerRef.current;
		if (!container) return;
		const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
		setIsAtBottom(distance < 80);
	};

	const resizeTextarea = () => {
		const textarea = textareaRef.current;
		if (!textarea) return;
		textarea.style.height = "auto";
		textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
	};

	const submit = (event?: { preventDefault?: () => void }) => {
		event?.preventDefault?.();
		if (!input.trim() || isLoading) return;
		handleSubmit(undefined, { body: { chatId, scope } });
		requestAnimationFrame(() => {
			if (textareaRef.current) textareaRef.current.style.height = "auto";
			setIsAtBottom(true);
		});
	};

	const sendSuggestion = (suggestion: string) => {
		if (isLoading) return;
		setInput(suggestion);
		requestAnimationFrame(() => {
			textareaRef.current?.focus();
			resizeTextarea();
		});
	};

	const startNewChat = () => {
		stop();
		setMessages([]);
		setChatId(null);
		setHistoryOpen(false);
		textareaRef.current?.focus();
	};

	const openChat = async (chat: ChatSummary) => {
		if (isLoading) stop();
		setLoadingChatId(chat.id);
		try {
			const response = await fetch(`/api/document-ai/chats/${chat.id}`, { cache: "no-store" });
			const payload = (await response.json().catch(() => ({}))) as {
				messages?: Message[];
				error?: string;
			};
			if (!response.ok) throw new Error(payload.error ?? "No se pudo abrir la conversación");
			setMessages(payload.messages ?? []);
			setChatId(chat.id);
			setHistoryOpen(false);
			setIsAtBottom(true);
		} catch (openError) {
			toast.error(openError instanceof Error ? openError.message : "No se pudo abrir la conversación");
		} finally {
			setLoadingChatId(null);
		}
	};

	const deleteChat = async (chat: ChatSummary) => {
		try {
			const response = await fetch(`/api/document-ai/chats/${chat.id}`, { method: "DELETE" });
			if (!response.ok) throw new Error("No se pudo borrar");
			setChats((current) => current.filter((entry) => entry.id !== chat.id));
			if (chatId === chat.id) startNewChat();
		} catch {
			toast.error("No se pudo borrar la conversación");
		}
	};

	const lastMessage = messages[messages.length - 1];
	const showThinking =
		isLoading &&
		(!lastMessage ||
			lastMessage.role === "user" ||
			(lastMessage.role === "assistant" &&
				!lastMessage.content &&
				!(lastMessage.toolInvocations && lastMessage.toolInvocations.length > 0)));

	const isEmpty = messages.length === 0;

	return (
		<main className="dai-root flex h-[calc(100svh-3.5rem)] flex-col bg-[#faf9f5] text-stone-900 md:h-svh">
			{/* Top bar */}
			<header className="z-10 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-stone-200/70 bg-[#faf9f5]/80 px-3 backdrop-blur-sm md:px-6">
				<div className="flex items-baseline gap-2.5">
					<span className="size-2 rounded-full bg-[#ff5800]" aria-hidden />
					<h1 className="text-sm font-semibold tracking-tight text-stone-800">Document AI</h1>
					<span className="hidden text-xs text-stone-400 sm:inline">Tus obras, en conversación</span>
				</div>
				<div className="flex items-center gap-1.5">
					<Popover open={historyOpen} onOpenChange={setHistoryOpen}>
						<PopoverTrigger asChild>
							<button
								type="button"
								className="dai-press inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-stone-500 transition-colors hover:bg-stone-200/60 hover:text-stone-700"
							>
								<History className="size-3.5" />
								Historial
							</button>
						</PopoverTrigger>
						<PopoverContent align="end" sideOffset={8} className="w-[calc(100vw-2rem)] p-1.5 sm:w-80">
							{chats.length === 0 ? (
								<p className="px-2 py-5 text-center text-xs text-stone-400">
									Todavía no hay conversaciones guardadas.
								</p>
							) : (
								<div className="max-h-80 overflow-y-auto">
									{chats.map((chat) => (
										<div
											key={chat.id}
											className={cn(
												"group flex items-center gap-2 rounded-md transition-colors duration-150",
												chat.id === chatId ? "bg-[#fff1e9]" : "hover:bg-stone-100",
											)}
										>
											<button
												type="button"
												onClick={() => void openChat(chat)}
												className="flex min-w-0 flex-1 flex-col items-start gap-0.5 px-2.5 py-2 text-left"
											>
												<span className="w-full truncate text-xs font-medium text-stone-700">
													{chat.title}
												</span>
												<span className="text-[10px] text-stone-400">
													{formatRelativeDate(chat.updated_at)}
												</span>
											</button>
											{loadingChatId === chat.id ? (
												<Loader2 className="mr-2 size-3.5 shrink-0 animate-spin text-stone-400" />
											) : (
												<button
													type="button"
													aria-label="Borrar conversación"
													onClick={() => void deleteChat(chat)}
													className="mr-1.5 grid size-6 shrink-0 place-items-center rounded-md text-stone-300 opacity-0 transition-[color,opacity] duration-150 hover:text-rose-500 group-hover:opacity-100"
												>
													<Trash2 className="size-3.5" />
												</button>
											)}
										</div>
									))}
								</div>
							)}
						</PopoverContent>
					</Popover>
					<button
						type="button"
						onClick={startNewChat}
						className="dai-press inline-flex h-8 items-center gap-1.5 rounded-lg bg-stone-900 px-2.5 text-xs font-semibold text-white transition-colors hover:bg-stone-700 sm:px-3"
					>
						<Plus className="size-3.5" />
						Nueva
					</button>
				</div>
			</header>

			{/* Messages */}
			<div
				ref={scrollContainerRef}
				onScroll={handleScroll}
				className="relative flex-1 overflow-y-auto"
			>
				<div className="mx-auto w-full max-w-3xl px-4 md:px-6">
					{isEmpty ? (
						<div className="flex min-h-[52svh] flex-col items-center justify-center pt-8 text-center sm:min-h-[60svh] sm:pt-10">
							<p className="dai-message-enter font-ui-serif text-2xl text-stone-800 sm:text-3xl md:text-4xl">
								<span className="text-[#ff5800]">*</span> ¿Qué necesitás saber de tus obras?
							</p>
							<p className="dai-message-enter mt-3 max-w-md text-sm leading-6 text-stone-500">
								Buscá certificados, órdenes de compra y facturas, abrí documentos o generá
								reportes formales. Seleccioná obras o carpetas para acotar la búsqueda.
							</p>
							<div className="dai-stagger mt-8 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
								{SUGGESTIONS.map((suggestion) => (
									<button
										key={suggestion}
										type="button"
										onClick={() => sendSuggestion(suggestion)}
										className="dai-press rounded-xl border border-stone-200 bg-white px-3.5 py-3 text-left text-[13px] leading-5 text-stone-600 transition-[border-color,box-shadow] duration-200 hover:border-stone-300 hover:shadow-[0_2px_10px_rgba(28,25,23,0.06)]"
									>
										{suggestion}
									</button>
								))}
							</div>
						</div>
					) : (
						<div className="space-y-6 py-6 pb-4">
							{messages.map((message, messageIndex) => {
								const isLast = messageIndex === messages.length - 1;
								if (message.role === "user") {
									return (
										<div key={message.id} className="dai-message-enter flex justify-end">
											<div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#f0eee6] px-4 py-2.5 text-[15px] leading-7 text-stone-800">
												{message.content}
											</div>
										</div>
									);
								}
								if (message.role !== "assistant") return null;
								const invocations = message.toolInvocations ?? [];
								const streamingText = isLast && isLoading && Boolean(message.content);
								return (
									<div key={message.id} className="dai-message-enter space-y-2.5">
										{invocations.length > 0 ? (
											<div className="flex flex-col gap-1.5">
												{invocations.map((invocation) => (
													<ToolInvocationView key={invocation.toolCallId} invocation={invocation} />
												))}
											</div>
										) : null}
										{message.content ? (
											<div className={cn(streamingText && "dai-caret")}>
												<ChatMarkdown text={message.content} />
											</div>
										) : null}
									</div>
								);
							})}
							{showThinking ? <ThinkingIndicator /> : null}
							{error && !isLoading ? (
								<div className="dai-message-enter flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700">
									<TriangleAlert className="size-4 shrink-0" />
									<span className="min-w-0 flex-1">Algo falló al responder.</span>
									<button
										type="button"
										onClick={() => void reload({ body: { chatId, scope } })}
										className="dai-press shrink-0 rounded-md border border-rose-200 bg-white px-2.5 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-100"
									>
										Reintentar
									</button>
								</div>
							) : null}
							<div ref={bottomRef} className="h-px" />
						</div>
					)}
				</div>

				{/* Scroll-to-bottom pill */}
				{!isAtBottom && !isEmpty ? (
					<div className="pointer-events-none sticky bottom-4 flex justify-center">
						<button
							type="button"
							onClick={() => {
								setIsAtBottom(true);
								bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
							}}
							className="dai-press pointer-events-auto grid size-8 place-items-center rounded-full border border-stone-200 bg-white text-stone-500 shadow-[0_2px_10px_rgba(28,25,23,0.1)] transition-colors hover:text-stone-800"
							aria-label="Ir al final"
						>
							<ArrowDown className="size-4" />
						</button>
					</div>
				) : null}
			</div>

			{/* Composer */}
			<div className="shrink-0 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-4 md:px-6 md:pb-5">
				<form onSubmit={submit} className="mx-auto w-full max-w-3xl">
					<div className="dai-composer rounded-2xl border border-stone-300/80 bg-white shadow-[0_2px_16px_rgba(28,25,23,0.06)] focus-within:border-stone-400 focus-within:shadow-[0_4px_24px_rgba(28,25,23,0.09)]">
						<ScopeChips works={works} scope={scope} onScopeChange={setScope} />
						<textarea
							ref={textareaRef}
							value={input}
							onChange={(event) => {
								handleInputChange(event);
								resizeTextarea();
							}}
							onKeyDown={(event) => {
								if (event.key === "Enter" && !event.shiftKey) {
									event.preventDefault();
									submit();
								}
							}}
							rows={1}
							placeholder="Preguntale a tus documentos de obra…"
							className="block max-h-[200px] w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-[15px] leading-6 text-stone-900 outline-none placeholder:text-stone-400"
						/>
						<div className="flex items-center justify-between px-3 pb-2.5 pt-1">
							<ScopePicker works={works} scope={scope} onScopeChange={setScope} />
							<button
								type={isLoading ? "button" : "submit"}
								onClick={isLoading ? () => stop() : undefined}
								disabled={!isLoading && !input.trim()}
								aria-label={isLoading ? "Detener" : "Enviar"}
								className={cn(
									"dai-press grid size-8 place-items-center rounded-full transition-colors duration-200",
									isLoading
										? "bg-stone-900 text-white hover:bg-stone-700"
										: input.trim()
											? "bg-[#ff5800] text-white hover:bg-[#e84f00]"
											: "bg-stone-200 text-stone-400",
								)}
							>
								{isLoading ? <Square className="size-3.5 fill-current" /> : <ArrowUp className="size-4" />}
							</button>
						</div>
					</div>
					<p className="mt-2 text-center text-[11px] text-stone-400">
						Las respuestas se basan en los documentos de tu organización y pueden contener errores.
					</p>
				</form>
			</div>
		</main>
	);
}
