"use client";

import { useState } from "react";

import type { TemplateSpec } from "@/lib/document-template-spec";

export type AssistantAttachmentPreview = { name: string; kind: "image" | "pdf"; url: string | null };

export type AssistantChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  changes?: string[];
  attachment?: AssistantAttachmentPreview;
  /** The spec before this answer was applied, while it can still be undone. */
  undoSpec?: TemplateSpec;
  undone?: boolean;
  failed?: boolean;
};

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const ASSISTANT_FILE_ACCEPT = ACCEPTED_TYPES.join(",");

export function checkAssistantFile(file: File) {
  if (!ACCEPTED_TYPES.includes(file.type)) return "Adjuntá un PDF o una imagen (PNG, JPG o WebP).";
  if (file.size > MAX_FILE_BYTES) return "El archivo supera los 10 MB.";
  return null;
}

function readDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

let messageCounter = 0;
const nextId = () => `m${Date.now()}-${(messageCounter += 1)}`;

/**
 * Chat with the template assistant. Each answer carries a complete spec that
 * the server already validated; `onApply` puts it in the builder and the
 * previous spec stays on the message so it can be undone.
 */
export function useTemplateAssistant(spec: TemplateSpec | null, onApply: (next: TemplateSpec) => void) {
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [pending, setPending] = useState<{ attachment?: AssistantAttachmentPreview } | null>(null);

  const send = async (text: string, file?: File | null) => {
    const request = text.trim() || (file ? `Armá una plantilla a partir de ${file.name}.` : "");
    if (pending || !request || !spec) return;
    if (file) {
      const problem = checkAssistantFile(file);
      if (problem) {
        setMessages((current) => [...current, { id: nextId(), role: "assistant", text: problem, failed: true }]);
        return;
      }
    }
    const preview: AssistantAttachmentPreview | undefined = file
      ? { name: file.name, kind: file.type === "application/pdf" ? "pdf" : "image", url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null }
      : undefined;
    const userMessage: AssistantChatMessage = { id: nextId(), role: "user", text: request, attachment: preview };
    const history = [...messages, userMessage];
    setMessages(history);
    setPending({ attachment: preview });

    const before = spec;
    try {
      const attachment = file ? { name: file.name, mimeType: file.type, dataUrl: await readDataUrl(file) } : null;
      const response = await fetch("/api/document-generation/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spec: before,
          messages: history.filter((message) => !message.failed).map((message) => ({ role: message.role, content: message.text })),
          attachment,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        reply?: string;
        changes?: string[];
        spec?: TemplateSpec | null;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "El asistente no pudo responder.");
      if (payload.spec) onApply(payload.spec);
      setMessages((current) => [
        ...current,
        {
          id: nextId(),
          role: "assistant",
          text: payload.reply || "Listo.",
          changes: payload.changes ?? [],
          undoSpec: payload.spec ? before : undefined,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        { id: nextId(), role: "assistant", text: error instanceof Error ? error.message : "El asistente no pudo responder.", failed: true },
      ]);
    } finally {
      setPending(null);
    }
  };

  const undo = (messageId: string) => {
    const message = messages.find((entry) => entry.id === messageId);
    if (!message?.undoSpec || pending) return;
    onApply(message.undoSpec);
    setMessages((current) => current.map((entry) => (entry.id === messageId ? { ...entry, undoSpec: undefined, undone: true } : entry)));
  };

  // Only the latest answer can be undone: older snapshots would discard later edits.
  const lastAnswer = [...messages].reverse().find((message) => message.role === "assistant" && !message.failed);
  const lastUndoableId = lastAnswer?.undoSpec ? lastAnswer.id : null;

  const reset = () => {
    setMessages([]);
    setPending(null);
  };

  return { messages, pending, send, undo, reset, lastUndoableId };
}
