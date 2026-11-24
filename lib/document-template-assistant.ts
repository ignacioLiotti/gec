import {
  buildTemplateSpecGuide,
  validateTemplateSpec,
  type ReferenceSourceDescriptor,
  type SpecField,
  type SpecIssue,
  type SpecSection,
  type TemplateSpec,
} from "@/lib/document-template-spec";

/**
 * Template assistant: turns a chat request (and optionally a photo or PDF of
 * a real document) into a complete, validated Template Spec.
 *
 * The model always returns the whole spec. The server validates it with the
 * same validator the builder and the API use, and sends the errors back to
 * the model until the spec is valid or the attempts run out, so the builder
 * only ever receives specs it can publish.
 */

export const TEMPLATE_ASSISTANT_DEFAULT_MODEL = "gpt-6.1-terra";
export const TEMPLATE_ASSISTANT_DEFAULT_EFFORT = "medium";

export type AssistantMessage = { role: "user" | "assistant"; content: string };
export type AssistantAttachment = { name: string; mimeType: string; dataUrl: string };
export type AssistantUsage = { inputTokens: number; outputTokens: number; totalTokens: number };

export type AssistantResult =
  | { ok: true; reply: string; changes: string[]; spec: TemplateSpec | null; usage: AssistantUsage; model: string; attempts: number }
  | { ok: false; error: string; issues: SpecIssue[]; usage: AssistantUsage; model: string; attempts: number };

const MAX_ATTEMPTS = 3;
const MAX_HISTORY = 12;
/** Select lists longer than this travel to the model as a marker and are restored after. */
const OPTION_LIMIT = 40;
const KEEP_OPTIONS = "__KEEP_OPTIONS__";

type OptionList = NonNullable<SpecField["options"]>;

function fieldLists(section: SpecSection): Array<{ table: string | null; fields: SpecField[] }> {
  switch (section.kind) {
    case "header":
      return section.fields ? [{ table: null, fields: section.fields }] : [];
    case "fields":
    case "totals":
      return [{ table: null, fields: section.fields ?? [] }];
    case "table":
      return [{ table: section.key, fields: section.columns ?? [] }];
    default:
      return [];
  }
}

/** Replaces long option lists with a marker so the model doesn't have to copy them. */
export function compactSpecForModel(spec: TemplateSpec) {
  const copy = structuredClone(spec);
  const stash = new Map<string, OptionList>();
  for (const section of copy.sections ?? []) {
    for (const { table, fields } of fieldLists(section)) {
      for (const field of fields) {
        if (Array.isArray(field.options) && field.options.length > OPTION_LIMIT) {
          stash.set(`${table ?? ""}.${field.key}`, field.options);
          const preview = field.options.slice(0, 5).map((option) => (typeof option === "string" ? option : option.label ?? option.value));
          field.options = [`${KEEP_OPTIONS}:${field.options.length}`, ...preview];
        }
      }
    }
  }
  return { spec: copy, stash };
}

/** Puts the original long option lists back where the model kept the marker. */
export function restoreCompactedOptions(spec: TemplateSpec, stash: Map<string, OptionList>) {
  const byKey = new Map<string, OptionList>();
  for (const [id, options] of stash) byKey.set(id.slice(id.indexOf(".") + 1), options);
  for (const section of spec.sections ?? []) {
    for (const { table, fields } of fieldLists(section)) {
      for (const field of fields) {
        const options = field.options;
        if (!Array.isArray(options)) continue;
        const marker = options.find((option) => typeof option === "string" && option.startsWith(KEEP_OPTIONS));
        if (!marker) continue;
        const original = stash.get(`${table ?? ""}.${field.key}`) ?? byKey.get(field.key);
        field.options = original ?? options.filter((option) => option !== marker);
      }
    }
  }
  return spec;
}

export function buildTemplateAssistantInstructions(catalog: ReferenceSourceDescriptor[]) {
  const guide = buildTemplateSpecGuide(catalog);
  return [
    "You are the template assistant of Síntesis, a construction-management app used in Argentina.",
    "You design and edit document templates (purchase invoices, delivery notes, purchase orders, receipts, certificates…) described as a Template Spec JSON.",
    "",
    "Answer with ONE JSON object and nothing else:",
    '{"reply": string, "changes": string[], "spec": TemplateSpec | null}',
    "- reply: Spanish from Argentina (voseo), one or two short sentences saying what you did. Put field names in **bold**. Never show JSON or keys in reply.",
    '- changes: one to five short Spanish tags describing the change, for example "+ columna Total", "− Observaciones", "fx Cantidad × Precio unitario", "Recibió → Usuarios", "Color · azul".',
    "- spec: the COMPLETE updated spec, including every section you did not touch. Use null only to ask a question or when the request cannot be done; then explain why in reply and leave changes empty.",
    "",
    "Editing rules:",
    "- Change only what the user asks. Keep keys, order, labels, options, formulas and links of everything else exactly as they are. Never rename an existing key unless the user asks.",
    "- New keys are Spanish snake_case, unique in the document (table columns unique within their table).",
    "- Computed values are formula fields; line items are a table section; sums of line items go in a totals section using SUMA(table.column).",
    "- Link to app data only with the sources listed in the guide. People in the organization: reference to source \"usuarios\" (display \"nombre\", match \"email\"); a lookup field can bring another attribute such as the email.",
    `- A select whose options start with "${KEEP_OPTIONS}:N" stands for a long list of N options kept by the server. Copy that options array exactly unless the user asks to replace the options.`,
    "- Layout: fields sit two per row; width: \"full\" makes one take the whole row. Colors: style.accent as #rrggbb. A footer is a text section and/or a signatures section at the end.",
    "- The layout cannot show images or logos yet. If asked for one, explain that in reply and do not invent a field for it.",
    "- Keep documentType unless it is empty; when empty, derive it from the name in uppercase snake_case (for example FACTURA_COMPRA).",
    "",
    "When the user attaches a photo or PDF of a real document, build a template that replicates its structure:",
    "- header with the document number (auto sequence) and date (auto today), plus the visible title;",
    "- one fields section per group of data you see (issuer, recipient, delivery…), using the document's own labels;",
    "- a table for line items with formula columns for computed amounts, and a totals section for subtotal, taxes and total when the document has them;",
    "- text and signatures sections for footers and signature lines;",
    "- do not copy the document's specific values as defaults, only constant texts;",
    "- mirror its look with the layout options: header.issuer with the company lines, width \"half\" for blocks printed side by side, boxed for framed notes, hideLabel for a block's main value, emphasis for bold columns and totals, style.accent for the brand color.",
    "When the user asks to make an existing template look like an attached document, keep every key, formula and link and only change labels, order and layout options.",
    "",
    "Template Spec guide (JSON):",
    JSON.stringify(guide),
  ].join("\n");
}

type ResponsesInput = Array<{
  role: "user" | "assistant";
  content: Array<
    | { type: "input_text"; text: string }
    | { type: "output_text"; text: string }
    | { type: "input_image"; image_url: string }
    | { type: "input_file"; filename: string; file_data: string }
  >;
}>;

function attachmentContent(attachment: AssistantAttachment) {
  if (attachment.mimeType === "application/pdf") {
    return { type: "input_file" as const, filename: attachment.name || "documento.pdf", file_data: attachment.dataUrl };
  }
  return { type: "input_image" as const, image_url: attachment.dataUrl };
}

type CallResult = { text: string; usage: AssistantUsage };

async function callResponses(params: {
  apiKey: string;
  model: string;
  effort: string;
  instructions: string;
  input: ResponsesInput;
}): Promise<CallResult> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${params.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: params.model,
      instructions: params.instructions,
      input: params.input,
      reasoning: { effort: params.effort },
      text: { format: { type: "json_object" } },
      max_output_tokens: 40000,
      store: false,
    }),
    signal: AbortSignal.timeout(150_000),
  });
  const payload = (await response.json().catch(() => null)) as {
    status?: string;
    error?: { message?: string } | null;
    incomplete_details?: { reason?: string } | null;
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
    usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
  } | null;
  if (!response.ok || !payload) {
    throw new Error(payload?.error?.message ?? `OpenAI respondió ${response.status}.`);
  }
  const usage: AssistantUsage = {
    inputTokens: payload.usage?.input_tokens ?? 0,
    outputTokens: payload.usage?.output_tokens ?? 0,
    totalTokens: payload.usage?.total_tokens ?? 0,
  };
  if (payload.status === "incomplete") {
    throw new Error(`La respuesta quedó incompleta (${payload.incomplete_details?.reason ?? "sin motivo"}).`);
  }
  const text = (payload.output ?? [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text")
    .map((part) => part.text ?? "")
    .join("");
  return { text, usage };
}

type ParsedAnswer = { reply: string; changes: string[]; spec: unknown };

function parseAnswer(text: string): ParsedAnswer | null {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.reply !== "string") return null;
    const changes = Array.isArray(parsed.changes) ? parsed.changes.filter((entry): entry is string => typeof entry === "string").slice(0, 6) : [];
    return { reply: parsed.reply.trim(), changes, spec: parsed.spec ?? null };
  } catch {
    return null;
  }
}

export async function runTemplateAssistant(params: {
  apiKey: string;
  model?: string;
  effort?: string;
  spec: TemplateSpec;
  messages: AssistantMessage[];
  attachment?: AssistantAttachment | null;
  catalog: ReferenceSourceDescriptor[];
}): Promise<AssistantResult> {
  const model = params.model || TEMPLATE_ASSISTANT_DEFAULT_MODEL;
  const effort = params.effort || TEMPLATE_ASSISTANT_DEFAULT_EFFORT;
  const usage: AssistantUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  const { spec: compactSpec, stash } = compactSpecForModel(params.spec);

  const history = params.messages.slice(-MAX_HISTORY);
  const request = history.at(-1);
  if (!request || request.role !== "user") {
    return { ok: false, error: "Falta el pedido.", issues: [], usage, model, attempts: 0 };
  }
  const input: ResponsesInput = history.slice(0, -1).map((message) =>
    message.role === "user"
      ? { role: "user", content: [{ type: "input_text", text: message.content }] }
      : { role: "assistant", content: [{ type: "output_text", text: message.content }] },
  );
  input.push({
    role: "user",
    content: [
      { type: "input_text", text: `Plantilla actual (JSON):\n${JSON.stringify(compactSpec)}\n\nPedido: ${request.content}` },
      ...(params.attachment ? [attachmentContent(params.attachment)] : []),
    ],
  });

  const instructions = buildTemplateAssistantInstructions(params.catalog);
  let issues: SpecIssue[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const call = await callResponses({ apiKey: params.apiKey, model, effort, instructions, input });
    usage.inputTokens += call.usage.inputTokens;
    usage.outputTokens += call.usage.outputTokens;
    usage.totalTokens += call.usage.totalTokens;

    const answer = parseAnswer(call.text);
    if (!answer) {
      issues = [{ path: "", message: "La respuesta no fue un JSON con reply, changes y spec." }];
    } else if (answer.spec === null) {
      return { ok: true, reply: answer.reply, changes: [], spec: null, usage, model, attempts: attempt };
    } else {
      const candidate = restoreCompactedOptions(answer.spec as TemplateSpec, stash);
      const validation = validateTemplateSpec(candidate, params.catalog);
      if (validation.ok) {
        return { ok: true, reply: answer.reply, changes: answer.changes, spec: candidate, usage, model, attempts: attempt };
      }
      issues = validation.errors;
    }
    input.push({ role: "assistant", content: [{ type: "output_text", text: call.text }] });
    input.push({
      role: "user",
      content: [
        {
          type: "input_text",
          text: `La spec no es válida. Corregí estos errores y devolvé de nuevo el JSON completo con reply, changes y spec:\n${issues
            .slice(0, 20)
            .map((issue) => `- ${issue.path || "spec"}: ${issue.message}`)
            .join("\n")}`,
        },
      ],
    });
  }
  return { ok: false, error: "No pude armar una plantilla válida con ese pedido.", issues, usage, model, attempts: MAX_ATTEMPTS };
}
