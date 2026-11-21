import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createEditorSession,
  type EditorSessionTransport,
  type EditorTarget,
  type GeneratedDocumentResult,
  type PersistDraftResponse,
} from "../../../app/document-generation/editor-session";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function target(
  templateId = "template-a",
  overrides: Partial<EditorTarget> = {},
): EditorTarget {
  return {
    workId: "work-a",
    folderPath: "Compras",
    documentType: "PURCHASE_ORDER",
    templateId,
    autosave: false,
    ...overrides,
  };
}

function persisted(
  inputData: Record<string, unknown>,
  draftId = "draft-a",
  updatedAt = "2026-10-20T12:00:00.001Z",
): PersistDraftResponse {
  return { draftId, updatedAt, status: "DRAFT", inputData };
}

function generated(inputData: Record<string, unknown>): GeneratedDocumentResult {
  return {
    generatedDocument: {
      id: "generated-a",
      status: "GENERATED",
      file_name: "52.pdf",
      input_data: inputData,
    },
    relativeFolderPath: "Compras",
    relativeFilePath: "Compras/52.pdf",
    previewHtml: "<p>52</p>",
  };
}

function transport(
  overrides: Partial<EditorSessionTransport> = {},
): EditorSessionTransport {
  return {
    persistDraft: vi.fn(async ({ inputData }) => persisted(inputData)),
    assist: vi.fn(async ({ inputData }) => ({
      inputData,
      appliedFieldCount: 0,
      sourceCount: 0,
    })),
    generate: vi.fn(async ({ inputData }) => generated(inputData)),
    persistOptions: vi.fn(async () => undefined),
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("document editor session", () => {
  it("acknowledges only the saved revision and preserves an edit made while saving", async () => {
    const pendingSave = deferred<PersistDraftResponse>();
    const sessionTransport = transport({ persistDraft: vi.fn(() => pendingSave.promise) });
    const session = createEditorSession({ transport: sessionTransport });
    session.selectDocumentContext({ target: target(), inputData: { title: "initial" } });
    session.edit({ title: "revision one" });

    const revisionOne = session.getSnapshot().revision;
    const save = session.save();
    await Promise.resolve();
    session.edit({ title: "revision two" });
    const revisionTwo = session.getSnapshot().revision;
    pendingSave.resolve(persisted({ title: "normalized revision one" }));

    await expect(save).resolves.toMatchObject({ kind: "success" });
    expect(session.getSnapshot()).toMatchObject({
      inputData: { title: "revision two" },
      revision: revisionTwo,
      acknowledgedRevision: revisionOne,
      draftId: "draft-a",
      operation: { kind: "idle" },
    });
  });

  it("records every buffered inline edit before blur", () => {
    const session = createEditorSession({ transport: transport() });
    session.selectDocumentContext({ target: target(), inputData: { title: "" } });

    session.edit({ title: "u" });
    session.edit({ title: "un" });
    session.edit({ title: "uno" });

    expect(session.getSnapshot().inputData).toEqual({ title: "uno" });
    expect(session.getSnapshot().revision - session.getSnapshot().acknowledgedRevision).toBe(3);
  });

  it("uses the canonical bootstrap target on the next save", async () => {
    const persistDraft = vi.fn(async ({ inputData }) => persisted(inputData));
    const session = createEditorSession({ transport: transport({ persistDraft }) });
    session.selectDocumentContext({
      target: target("", { folderPath: "", documentType: "" }),
      inputData: {},
    });

    session.hydrate({
      target: target("default-template", {
        folderPath: "Compras",
        documentType: "PURCHASE_ORDER",
      }),
      inputData: { title: "default" },
      draft: null,
    });

    await expect(session.save()).resolves.toMatchObject({ kind: "success" });
    expect(persistDraft).toHaveBeenCalledWith({
      draftId: undefined,
      expectedUpdatedAt: undefined,
      target: target("default-template", {
        folderPath: "Compras",
        documentType: "PURCHASE_ORDER",
      }),
      inputData: { title: "default" },
    });
  });

  it("keeps a late create identity across a consecutive template switch without applying old input", async () => {
    const pendingCreate = deferred<PersistDraftResponse>();
    const sessionTransport = transport({ persistDraft: vi.fn(() => pendingCreate.promise) });
    const session = createEditorSession({ transport: sessionTransport });
    session.selectDocumentContext({ target: target("template-a"), inputData: { title: "a" } });
    session.edit({ title: "a edited" });
    const save = session.save();
    await Promise.resolve();

    session.activateTemplate({ target: target("template-b"), inputData: { title: "b" } });
    pendingCreate.resolve(persisted({ title: "normalized a" }, "created-draft"));

    await expect(save).resolves.toEqual({ kind: "stale" });
    expect(session.getSnapshot()).toMatchObject({
      draftId: "created-draft",
      inputData: { title: "b" },
      operation: { kind: "idle" },
    });
  });

  it("does not adopt an old identity after leaving and re-entering the same coordinates", async () => {
    const pendingCreate = deferred<PersistDraftResponse>();
    const session = createEditorSession({
      transport: transport({ persistDraft: vi.fn(() => pendingCreate.promise) }),
    });
    session.selectDocumentContext({ target: target(), inputData: { title: "a" } });
    session.edit({ title: "a edited" });
    const save = session.save();
    await Promise.resolve();

    session.selectDocumentContext({
      target: target("template-a", { workId: "work-b" }),
      inputData: { title: "b" },
    });
    session.selectDocumentContext({ target: target(), inputData: { title: "new a" } });
    pendingCreate.resolve(persisted({ title: "old a" }, "old-draft"));

    await expect(save).resolves.toEqual({ kind: "stale" });
    expect(session.getSnapshot()).toMatchObject({ draftId: "", inputData: { title: "new a" } });
  });

  it("drops a queued command when its context changes before transport starts", async () => {
    const firstSave = deferred<PersistDraftResponse>();
    const persistDraft = vi.fn()
      .mockImplementationOnce(() => firstSave.promise)
      .mockImplementation(async ({ inputData }) => persisted(inputData, "draft-b"));
    const session = createEditorSession({ transport: transport({ persistDraft }) });
    session.selectDocumentContext({ target: target(), inputData: { title: "a" } });
    session.edit({ title: "a edited" });
    const saveA = session.save();
    await Promise.resolve();

    session.selectDocumentContext({
      target: target("template-b", { workId: "work-b" }),
      inputData: { title: "b" },
    });
    session.edit({ title: "b edited" });
    const saveB = session.save();
    session.selectDocumentContext({
      target: target("template-c", { workId: "work-c" }),
      inputData: { title: "c" },
    });
    firstSave.resolve(persisted({ title: "a edited" }));

    await Promise.all([saveA, saveB]);
    expect(persistDraft).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot().inputData).toEqual({ title: "c" });
  });

  it("holds one write lane across save-before-generate and preserves newer edits", async () => {
    vi.useFakeTimers();
    const pendingSave = deferred<PersistDraftResponse>();
    const pendingGenerate = deferred<GeneratedDocumentResult>();
    const order: string[] = [];
    const sessionTransport = transport({
      persistDraft: vi.fn(async (request) => {
        order.push(`save:${String(request.inputData.title)}`);
        return pendingSave.promise;
      }),
      generate: vi.fn(async (request) => {
        order.push(`generate:${request.draftId}:${String(request.inputData.title)}`);
        return pendingGenerate.promise;
      }),
    });
    const session = createEditorSession({ transport: sessionTransport, autosaveDelayMs: 25 });
    const purchaseOrderTarget = target("template-a", { autosave: true });
    session.selectDocumentContext({ target: purchaseOrderTarget, inputData: { title: "saved" } });
    session.hydrate({
      target: purchaseOrderTarget,
      inputData: { title: "saved" },
      draft: {
        id: "existing-draft",
        updatedAt: "2026-10-20T12:00:00.001Z",
        status: "DRAFT",
      },
    });
    session.edit({ title: "requested" });

    const generation = session.generate();
    await Promise.resolve();
    session.edit({ title: "typed while saving" });
    await vi.advanceTimersByTimeAsync(100);
    expect(sessionTransport.persistDraft).toHaveBeenCalledTimes(1);
    expect(sessionTransport.generate).not.toHaveBeenCalled();

    pendingSave.resolve(persisted(
      { title: "normalized requested" },
      "existing-draft",
      "2026-10-20T12:00:00.002Z",
    ));
    await vi.waitFor(() => expect(sessionTransport.generate).toHaveBeenCalledTimes(1));
    expect(sessionTransport.persistDraft).toHaveBeenCalledWith(expect.objectContaining({
      draftId: "existing-draft",
      expectedUpdatedAt: "2026-10-20T12:00:00.001Z",
    }));
    expect(sessionTransport.generate).toHaveBeenCalledWith(expect.objectContaining({
      draftId: "existing-draft",
      draftUpdatedAt: "2026-10-20T12:00:00.002Z",
    }));
    expect(order).toEqual([
      "save:requested",
      "generate:existing-draft:requested",
    ]);
    pendingGenerate.resolve({
      ...generated({ title: "normalized requested" }),
      sourceDraft: {
        id: "existing-draft",
        updatedAt: "2026-10-20T12:00:00.003Z",
      },
    });
    await expect(generation).resolves.toMatchObject({ kind: "success" });
    expect(session.getSnapshot()).toMatchObject({
      inputData: { title: "typed while saving" },
      draftUpdatedAt: "2026-10-20T12:00:00.003Z",
    });
  });

  it("keeps local edits dirty when the server rejects a stale draft token", async () => {
    const conflict = new Error(
      "Este borrador cambió en otra pestaña. Conservamos tus cambios; recargá para revisar la última versión.",
    );
    const persistDraft = vi.fn(async () => Promise.reject(conflict));
    const session = createEditorSession({ transport: transport({ persistDraft }) });
    session.selectDocumentContext({ target: target(), inputData: {} });
    session.hydrate({
      target: target(),
      inputData: { title: "server revision" },
      draft: {
        id: "existing-draft",
        updatedAt: "2026-10-20T12:00:00.001Z",
        status: "DRAFT",
      },
    });
    session.edit({ title: "local unsaved revision" });
    const editedRevision = session.getSnapshot().revision;

    await expect(session.save()).resolves.toEqual({ kind: "failure", error: conflict });

    expect(persistDraft).toHaveBeenCalledWith(expect.objectContaining({
      draftId: "existing-draft",
      expectedUpdatedAt: "2026-10-20T12:00:00.001Z",
      inputData: { title: "local unsaved revision" },
    }));
    expect(session.getSnapshot()).toMatchObject({
      inputData: { title: "local unsaved revision" },
      revision: editedRevision,
      draftUpdatedAt: "2026-10-20T12:00:00.001Z",
      operation: { kind: "failed", command: "save", message: conflict.message },
    });
    expect(session.getSnapshot().acknowledgedRevision).toBeLessThan(editedRevision);
  });

  it("uses a late create identity to save the active template before generation", async () => {
    const firstCreate = deferred<PersistDraftResponse>();
    const requests: string[] = [];
    const persistDraft = vi.fn()
      .mockImplementationOnce(async () => {
        requests.push("create-a");
        return firstCreate.promise;
      })
      .mockImplementationOnce(async (request) => {
        requests.push(`save-${request.target.templateId}-${request.draftId}`);
        return persisted(request.inputData, request.draftId);
      });
    const generate = vi.fn(async (request) => {
      requests.push(`generate-${request.target.templateId}-${request.draftId}`);
      return generated(request.inputData);
    });
    const session = createEditorSession({ transport: transport({ persistDraft, generate }) });
    session.selectDocumentContext({ target: target("template-a"), inputData: { title: "a" } });
    session.edit({ title: "a edited" });
    const oldSave = session.save();
    await Promise.resolve();
    session.activateTemplate({ target: target("template-b"), inputData: { title: "b" } });
    const generation = session.generate();

    firstCreate.resolve(persisted({ title: "a edited" }, "created-draft"));
    await oldSave;
    await generation;

    expect(requests).toEqual([
      "create-a",
      "save-template-b-created-draft",
      "generate-template-b-created-draft",
    ]);
  });

  it("discards late assistance, ends the operation, and autosaves the newer edit", async () => {
    vi.useFakeTimers();
    const pendingAssist = deferred<{
      inputData: Record<string, unknown>;
      appliedFieldCount: number;
      sourceCount: number;
    }>();
    const persistDraft = vi.fn(async ({ inputData }) => persisted(inputData));
    const session = createEditorSession({
      transport: transport({ assist: vi.fn(() => pendingAssist.promise), persistDraft }),
      autosaveDelayMs: 25,
    });
    session.selectDocumentContext({
      target: target("template-a", { autosave: true }),
      inputData: { title: "initial" },
    });
    const assistance = session.assist();
    await Promise.resolve();
    session.edit({ title: "typed" });
    pendingAssist.resolve({ inputData: { title: "assisted" }, appliedFieldCount: 1, sourceCount: 1 });

    await expect(assistance).resolves.toEqual({ kind: "stale" });
    expect(session.getSnapshot()).toMatchObject({
      inputData: { title: "typed" },
      operation: { kind: "idle" },
    });
    await vi.advanceTimersByTimeAsync(25);
    expect(persistDraft).toHaveBeenCalledWith(expect.objectContaining({ inputData: { title: "typed" } }));
  });

  it("does not retry a failed autosave until the next edit and guards duplicate saves", async () => {
    vi.useFakeTimers();
    const persistDraft = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockImplementation(async ({ inputData }) => persisted(inputData));
    const session = createEditorSession({
      transport: transport({ persistDraft }),
      autosaveDelayMs: 25,
    });
    session.selectDocumentContext({
      target: target("template-a", { autosave: true }),
      inputData: { title: "initial" },
    });
    session.edit({ title: "first" });
    await vi.advanceTimersByTimeAsync(25);
    expect(session.getSnapshot().operation).toMatchObject({ kind: "failed", command: "autosave" });
    await vi.advanceTimersByTimeAsync(250);
    expect(persistDraft).toHaveBeenCalledTimes(1);

    session.edit({ title: "second" });
    await vi.advanceTimersByTimeAsync(25);
    expect(persistDraft).toHaveBeenCalledTimes(2);

    const firstManual = session.save();
    const duplicateManual = session.save();
    await expect(duplicateManual).resolves.toEqual({ kind: "ignored" });
    await firstManual;
  });

  it("suppresses obsolete assist and generate failures after a context change", async () => {
    const pendingAssist = deferred<{
      inputData: Record<string, unknown>;
      appliedFieldCount: number;
      sourceCount: number;
    }>();
    const pendingGenerate = deferred<GeneratedDocumentResult>();
    const session = createEditorSession({
      transport: transport({
        assist: vi.fn(() => pendingAssist.promise),
        generate: vi.fn(() => pendingGenerate.promise),
      }),
    });
    session.selectDocumentContext({ target: target(), inputData: { title: "a" } });
    const assistance = session.assist();
    await Promise.resolve();
    session.selectDocumentContext({
      target: target("template-b", { workId: "work-b" }),
      inputData: { title: "b" },
    });
    pendingAssist.reject(new Error("old assist failed"));
    await expect(assistance).resolves.toEqual({ kind: "stale" });

    const generation = session.generate();
    await Promise.resolve();
    session.selectDocumentContext({
      target: target("template-c", { workId: "work-c" }),
      inputData: { title: "c" },
    });
    pendingGenerate.reject(new Error("old generation failed"));
    await expect(generation).resolves.toEqual({ kind: "stale" });
    expect(session.getSnapshot()).toMatchObject({
      inputData: { title: "c" },
      operation: { kind: "idle" },
    });
  });

  it("suppresses generation validation from an older revision", async () => {
    const pendingGenerate = deferred<GeneratedDocumentResult>();
    const session = createEditorSession({
      transport: transport({ generate: vi.fn(() => pendingGenerate.promise) }),
    });
    session.selectDocumentContext({ target: target(), inputData: { title: "missing" } });
    const generation = session.generate();
    await Promise.resolve();
    session.edit({ title: "corrected" });
    pendingGenerate.reject(new Error("title is required"));

    await expect(generation).resolves.toEqual({ kind: "stale" });
    expect(session.getSnapshot()).toMatchObject({
      inputData: { title: "corrected" },
      operation: { kind: "idle" },
    });
  });

  it("suppresses completion work after its final subscriber unmounts", async () => {
    const pendingSave = deferred<PersistDraftResponse>();
    const persistOptions = vi.fn(async () => undefined);
    const session = createEditorSession({
      transport: transport({ persistDraft: vi.fn(() => pendingSave.promise), persistOptions }),
    });
    const unsubscribe = session.subscribe(() => undefined);
    session.selectDocumentContext({ target: target(), inputData: { title: "initial" } });
    session.edit({ title: "edited" });
    const save = session.save([{
      fieldKey: "supplier",
      option: { value: "New supplier", label: "New supplier" },
    }]);
    await Promise.resolve();

    unsubscribe();
    pendingSave.resolve(persisted({ title: "edited" }));
    await expect(save).resolves.toEqual({ kind: "stale" });
    expect(persistOptions).not.toHaveBeenCalled();
  });

  it("suppresses an autosave error callback after unmount", async () => {
    vi.useFakeTimers();
    const pendingSave = deferred<PersistDraftResponse>();
    const onAutosaveError = vi.fn();
    const session = createEditorSession({
      transport: transport({ persistDraft: vi.fn(() => pendingSave.promise) }),
      autosaveDelayMs: 25,
      onAutosaveError,
    });
    const unsubscribe = session.subscribe(() => undefined);
    session.selectDocumentContext({
      target: target("template-a", { autosave: true }),
      inputData: { title: "initial" },
    });
    session.edit({ title: "edited" });
    await vi.advanceTimersByTimeAsync(25);
    unsubscribe();
    pendingSave.reject(new Error("offline after unmount"));
    await Promise.resolve();
    await Promise.resolve();

    expect(onAutosaveError).not.toHaveBeenCalled();
  });

  it("never autosaves or saves a generated-document editing target", async () => {
    vi.useFakeTimers();
    const persistDraft = vi.fn(async ({ inputData }) => persisted(inputData));
    const session = createEditorSession({
      transport: transport({ persistDraft }),
      autosaveDelayMs: 25,
    });
    session.selectDocumentContext({
      target: target("template-a", { generatedDocumentId: "generated-a", autosave: true }),
      inputData: { title: "generated" },
    });
    session.edit({ title: "corrected" });
    await vi.advanceTimersByTimeAsync(100);

    expect(persistDraft).not.toHaveBeenCalled();
    await expect(session.save()).resolves.toEqual({ kind: "ignored" });
    expect(persistDraft).not.toHaveBeenCalled();
  });
});
