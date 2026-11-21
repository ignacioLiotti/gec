import type { DocumentTemplateSummary } from "@/lib/document-generation";

export type FixtureRequestKind = "bootstrap" | "draft" | "assist" | "generate" | "generated-detail" | "template-options";

type RequestRecord = {
  id: number;
  kind: FixtureRequestKind;
  method: string;
  url: string;
  body: Record<string, unknown> | null;
  state: "pending" | "resolved";
};

type DeferredRequest = {
  record: RequestRecord;
  resolve: (response: Response) => void;
  response: () => Response;
};

export type DocumentGenerationFixtureControl = {
  hold(kind: FixtureRequestKind): void;
  releaseNext(kind: FixtureRequestKind, failureMessage?: string): boolean;
  releaseAll(kind: FixtureRequestKind): number;
  requests(): RequestRecord[];
  savedDraft(id?: string): Record<string, unknown> | null;
  generatedInput(): Record<string, unknown> | null;
  resetLog(): void;
};

declare global {
  interface Window {
    __DOCUMENT_GENERATION_FIXTURE__?: DocumentGenerationFixtureControl;
  }
}

const works = [
  { id: "work-norte", label: "Torre Norte" },
  { id: "work-rio", label: "Campus Rio" },
];

const folders = [
  {
    path: "Compras/Ordenes",
    name: "Ordenes de compra",
    allowedDocumentTypes: ["PURCHASE_ORDER"],
    defaultDocumentType: "PURCHASE_ORDER",
  },
  {
    path: "Administracion/Ordenes",
    name: "Ordenes administrativas",
    allowedDocumentTypes: ["PURCHASE_ORDER"],
    defaultDocumentType: "PURCHASE_ORDER",
  },
];

const purchaseOrderFields: DocumentTemplateSummary["schema"]["fields"] = [
  {
    key: "title",
    label: "Asunto",
    type: "text",
    required: true,
  },
  {
    key: "notes",
    label: "Notas",
    type: "textarea",
    required: false,
  },
  {
    key: "items",
    label: "Items",
    type: "table",
    required: false,
    columns: [
      { key: "description", label: "Descripcion", type: "text", required: false },
      { key: "quantity", label: "Cantidad", type: "number", required: false },
      { key: "unitPrice", label: "Precio unitario", type: "money", required: false },
      {
        key: "lineTotal",
        label: "Total",
        type: "money",
        required: false,
        formula: "[quantity] * [unitPrice]",
      },
    ],
  },
];

export const documentGenerationTemplates: DocumentTemplateSummary[] = [
  {
    id: "template-standard",
    key: "purchase-order-standard",
    name: "Orden de compra simple",
    description: "Plantilla sintetica para verificar guardado y generacion.",
    documentType: "PURCHASE_ORDER",
    targetFolderPath: "Compras/Ordenes",
    version: 1,
    status: "ACTIVE",
    isSystem: false,
    tenantScoped: true,
    schema: {
      fields: purchaseOrderFields,
      documentNumberFieldKey: null,
      fileNamePattern: "orden-{{title}}.pdf",
    },
    contentHtml: [
      "<article>",
      "<h1>Orden de compra</h1>",
      "<p>Asunto: {{title}}</p>",
      "<p>Notas: {{notes}}</p>",
      "{{#items}}<p>{{description}} · {{quantity}} × {{unitPrice}} = {{lineTotal}}</p>{{/items}}",
      "</article>",
    ].join(""),
  },
  {
    id: "template-compact",
    key: "purchase-order-compact",
    name: "Orden de compra compacta",
    description: "Segunda plantilla sintetica para cambios de contexto.",
    documentType: "PURCHASE_ORDER",
    targetFolderPath: "Compras/Ordenes",
    version: 1,
    status: "ACTIVE",
    isSystem: false,
    tenantScoped: true,
    schema: { fields: purchaseOrderFields },
    contentHtml: "<article><h1>OC compacta</h1><p>{{title}}</p><p>{{notes}}</p></article>",
  },
];

type DraftRecord = {
  inputData: Record<string, unknown>;
  updatedAt: string;
};

const initialDrafts = new Map<string, DraftRecord>([
  [
    "draft-recovery",
    {
      inputData: {
        title: "Borrador recuperado",
        notes: "Este contenido viene del borrador guardado.",
        items: [{ description: "Hormigon", quantity: "2", unitPrice: "1250", lineTotal: 2500 }],
      },
      updatedAt: "2026-10-17T12:00:00.001Z",
    },
  ],
  [
    "draft-runtime",
    {
      inputData: { title: "Version guardada", notes: "Snapshot del servidor" },
      updatedAt: "2026-10-17T12:00:00.002Z",
    },
  ],
]);

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function requestBody(init?: RequestInit) {
  if (typeof init?.body !== "string") return null;
  const parsed: unknown = JSON.parse(init.body);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null;
}

function requestKind(url: URL, method: string): FixtureRequestKind | null {
  if (url.pathname === "/api/document-generation/bootstrap") return "bootstrap";
  if (url.pathname === "/api/document-generation/assist") return "assist";
  if (url.pathname === "/api/document-generation/generate") return "generate";
  if (url.pathname === "/api/document-generation/templates/options" && method === "POST") return "template-options";
  if (url.pathname.startsWith("/api/document-generation/generated/")) return "generated-detail";
  if (url.pathname === "/api/document-generation/drafts" && (method === "POST" || method === "GET")) return "draft";
  return null;
}

export function installDocumentGenerationFixture() {
  const originalFetch = window.fetch.bind(window);
  const held = new Set<FixtureRequestKind>();
  const pending: DeferredRequest[] = [];
  const records: RequestRecord[] = [];
  const drafts = new Map(
    Array.from(initialDrafts, ([id, draft]) => [id, structuredClone(draft)]),
  );
  let lastGeneratedInput: Record<string, unknown> | null = null;
  let nextRequestId = 1;
  let nextDraftVersion = 3;
  const nextDraftUpdatedAt = () =>
    `2026-10-17T12:00:00.${String(nextDraftVersion++).padStart(3, "0")}Z`;

  const makeResponse = (kind: FixtureRequestKind, url: URL, body: Record<string, unknown> | null) => {
    if (kind === "bootstrap") {
      const workId = url.searchParams.get("workId");
      const folderPath = url.searchParams.get("folderPath");
      const requestedDocumentType = url.searchParams.get("documentType");
      const documentType = requestedDocumentType ?? (workId && folderPath ? "PURCHASE_ORDER" : null);
      const hasCompleteContext = Boolean(workId && folderPath && documentType);
      const selectedTemplate = hasCompleteContext ? documentGenerationTemplates[0] : null;
      return json({
        works,
        folderConfigs: folders,
        allTemplates: documentGenerationTemplates,
        templates: documentGenerationTemplates,
        dynamicOptions: { tenantUsers: [] },
        context: {
          workId,
          workLabel: works.find((work) => work.id === workId)?.label ?? workId,
          existingSequenceCount: 6,
          folderPath,
          folderCandidates: folders,
          allowedDocumentTypes: workId ? ["PURCHASE_ORDER"] : [],
          documentType,
          selectedTemplate,
          initialInputData: hasCompleteContext ? { title: "", notes: "", items: [] } : {},
        },
      });
    }

    if (kind === "draft" && url.searchParams.has("id")) {
      const id = url.searchParams.get("id") ?? "draft-recovery";
      const draft = drafts.get(id);
      if (!draft) return json({ error: "Borrador no encontrado." }, 404);
      return json({
        draft: {
          id,
          workId: "work-norte",
          workLabel: "Torre Norte",
          folderPath: "Compras/Ordenes",
          documentType: "PURCHASE_ORDER",
          templateId: "template-standard",
          templateName: "Orden de compra simple",
          status: "DRAFT",
          updatedAt: draft.updatedAt,
          inputData: draft.inputData,
          validationErrors: [],
          canEdit: true,
        },
      });
    }

    if (kind === "draft") {
      const isUpdate = typeof body?.id === "string";
      const id = typeof body?.id === "string" ? body.id : "draft-runtime";
      const existingDraft = drafts.get(id);
      if (isUpdate && !existingDraft) {
        return json({ error: "Borrador no encontrado." }, 404);
      }
      if (isUpdate && existingDraft && typeof body?.expectedUpdatedAt !== "string") {
        return json({ error: "Falta la versión del borrador que intentas guardar." }, 428);
      }
      if (isUpdate && existingDraft && body?.expectedUpdatedAt !== existingDraft.updatedAt) {
        return json({
          error: "Este borrador cambió en otra pestaña. Conservamos tus cambios; recargá para revisar la última versión.",
        }, 409);
      }
      const inputData = body?.inputData && typeof body.inputData === "object"
        ? (body.inputData as Record<string, unknown>)
        : {};
      const updatedAt = nextDraftUpdatedAt();
      drafts.set(id, { inputData: structuredClone(inputData), updatedAt });
      return json({ draft: { id, status: "DRAFT", validation_errors: [], input_data: inputData, updated_at: updatedAt } });
    }

    if (kind === "assist") {
      const inputData = body?.inputData && typeof body.inputData === "object"
        ? (body.inputData as Record<string, unknown>)
        : {};
      return json({
        inputData: { ...inputData, notes: "Contexto sintetico aplicado" },
        appliedFieldCount: 1,
        context: {
          version: 1,
          status: "applied",
          extractor: "document-generation-context-v1",
          appliedAt: "2026-10-17T12:00:00.000Z",
          sourceRowCount: 1,
          sourceTableCount: 1,
          sources: [],
          warnings: [],
        },
      });
    }

    if (kind === "generated-detail") {
      return json({
        document: {
          id: "generated-editing",
          workId: "work-norte",
          workLabel: "Torre Norte",
          folderPath: "Compras/Ordenes",
          documentType: "PURCHASE_ORDER",
          templateId: "template-standard",
          templateName: "Orden de compra simple",
          sourceDraftId: "draft-runtime",
          storagePath: "work-norte/Compras/Ordenes/orden-editing.pdf",
          fileName: "orden-editing.pdf",
          status: "REJECTED",
          inputData: { title: "Documento rechazado editable", notes: "Corregir importe" },
          generatedAt: "2026-10-16T12:00:00.000Z",
          updatedAt: "2026-10-17T12:00:00.000Z",
          canEdit: true,
          previewHtml: "<article><h1>Documento rechazado editable</h1></article>",
        },
      });
    }

    if (kind === "template-options") return json({ ok: true });

    const requestedDraftId = typeof body?.draftId === "string" ? body.draftId : null;
    const requestedDraft = requestedDraftId ? drafts.get(requestedDraftId) : null;
    if (requestedDraftId && !requestedDraft) return json({ error: "Borrador no encontrado" }, 404);
    if (requestedDraft && typeof body?.draftUpdatedAt !== "string") {
      return json({ error: "Falta la versión del borrador que intentas generar." }, 428);
    }
    if (requestedDraft && body?.draftUpdatedAt !== requestedDraft.updatedAt) {
      return json({
        error: "Este borrador cambió en otra pestaña. Conservamos tus cambios; recargá para revisar la última versión.",
      }, 409);
    }
    const submittedInput = body?.inputData && typeof body.inputData === "object"
      ? (body.inputData as Record<string, unknown>)
      : {};
    const generatedInput = requestedDraft?.inputData ?? submittedInput;
    const sourceDraftUpdatedAt = requestedDraftId ? nextDraftUpdatedAt() : null;
    if (requestedDraftId && sourceDraftUpdatedAt) {
      drafts.set(requestedDraftId, {
        inputData: structuredClone(generatedInput),
        updatedAt: sourceDraftUpdatedAt,
      });
    }
    lastGeneratedInput = structuredClone(generatedInput);
    return json({
      generatedDocument: {
        id: "generated-runtime",
        status: "UNDER_REVIEW",
        file_name: "orden-runtime.pdf",
        storage_path: "work-norte/Compras/Ordenes/orden-runtime.pdf",
        input_data: structuredClone(generatedInput),
      },
      relativeFolderPath: "Compras/Ordenes",
      relativeFilePath: "Compras/Ordenes/orden-runtime.pdf",
      previewHtml: `<article><h1>${String(generatedInput.title ?? "")}</h1></article>`,
      sourceDraft: requestedDraftId && sourceDraftUpdatedAt
        ? { id: requestedDraftId, updatedAt: sourceDraftUpdatedAt }
        : null,
    });
  };

  const fixtureFetch: typeof window.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.origin);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const kind = requestKind(url, method);
    if (!kind) {
      if (url.pathname.startsWith("/api/")) {
        return json({ error: `Fixture rejected unexpected request: ${method} ${url.pathname}` }, 403);
      }
      return originalFetch(input, init);
    }

    const body = await requestBody(init);
    const record: RequestRecord = { id: nextRequestId++, kind, method, url: url.href, body, state: "pending" };
    records.push(record);
    const response = () => makeResponse(kind, url, body);
    if (!held.has(kind)) {
      record.state = "resolved";
      return response();
    }
    return new Promise<Response>((resolve) => pending.push({ record, resolve, response }));
  };

  const control: DocumentGenerationFixtureControl = {
    hold: (kind) => held.add(kind),
    releaseNext: (kind, failureMessage) => {
      const index = pending.findIndex((request) => request.record.kind === kind);
      if (index < 0) return false;
      const [request] = pending.splice(index, 1);
      request.record.state = "resolved";
      request.resolve(failureMessage ? json({ error: failureMessage }, 500) : request.response());
      return true;
    },
    releaseAll: (kind) => {
      held.delete(kind);
      let released = 0;
      while (control.releaseNext(kind)) released += 1;
      return released;
    },
    requests: () => structuredClone(records),
    savedDraft: (id = "draft-runtime") => structuredClone(drafts.get(id)?.inputData ?? null),
    generatedInput: () => structuredClone(lastGeneratedInput),
    resetLog: () => records.splice(0, records.length),
  };

  window.fetch = fixtureFetch;
  window.__DOCUMENT_GENERATION_FIXTURE__ = control;
  return () => {
    window.fetch = originalFetch;
    delete window.__DOCUMENT_GENERATION_FIXTURE__;
  };
}
