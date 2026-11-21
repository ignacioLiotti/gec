export type EditorInputData = Record<string, unknown>;

export type EditorTarget = {
  workId: string;
  folderPath: string;
  documentType: string;
  templateId: string;
  generatedDocumentId?: string;
  autosave: boolean;
};

export type CreatableOptionAddition = {
  fieldKey: string;
  tableKey?: string;
  option: {
    value: string;
    label: string;
  };
};

export type PersistDraftRequest = {
  draftId?: string;
  expectedUpdatedAt?: string;
  target: EditorTarget;
  inputData: EditorInputData;
};

export type PersistDraftResponse = {
  draftId: string;
  updatedAt: string;
  status: string;
  inputData: EditorInputData;
};

export type AssistRequest = {
  target: EditorTarget;
  inputData: EditorInputData;
};

export type AssistResponse = {
  inputData: EditorInputData;
  appliedFieldCount: number;
  sourceCount: number;
  warning?: string;
};

export type GenerateRequest = {
  draftId?: string;
  draftUpdatedAt?: string;
  target: EditorTarget;
  inputData: EditorInputData;
};

export type GeneratedDocumentResult = {
  generatedDocument: {
    id: string;
    status: string;
    file_name: string;
    storage_path?: string;
    input_data?: EditorInputData;
  };
  relativeFolderPath: string;
  relativeFilePath: string;
  previewHtml: string;
  sourceDraft?: {
    id: string;
    updatedAt: string;
  } | null;
};

export type EditorSessionTransport = {
  persistDraft: (request: PersistDraftRequest) => Promise<PersistDraftResponse>;
  assist: (request: AssistRequest) => Promise<AssistResponse>;
  generate: (request: GenerateRequest) => Promise<GeneratedDocumentResult>;
  persistOptions: (request: {
    target: EditorTarget;
    additions: CreatableOptionAddition[];
  }) => Promise<void>;
};

export type EditorOperation =
  | { kind: "idle" }
  | { kind: "saving"; reason: "auto" | "manual" }
  | { kind: "assisting" }
  | { kind: "generating"; phase: "persisting" | "rendering" }
  | { kind: "failed"; command: "autosave" | "save" | "assist" | "generate"; message: string };

export type EditorSessionSnapshot = {
  inputData: EditorInputData;
  revision: number;
  acknowledgedRevision: number;
  draftId: string;
  draftUpdatedAt: string;
  draftStatus: string;
  operation: EditorOperation;
};

export type EditorSessionErrorDetails = {
  validationErrors?: Array<{ key: string; message: string }>;
};

export class EditorSessionRequestError extends Error {
  readonly details: EditorSessionErrorDetails;

  constructor(message: string, details: EditorSessionErrorDetails = {}) {
    super(message);
    this.name = "EditorSessionRequestError";
    this.details = details;
  }
}

type CommandResult<T> =
  | { kind: "success"; value: T; optionError?: unknown }
  | { kind: "failure"; error: unknown }
  | { kind: "stale" }
  | { kind: "ignored" };

type ContextSelection = {
  target: EditorTarget;
  inputData: EditorInputData;
};

type HydratedContext = ContextSelection & {
  draft: { id: string; updatedAt: string; status: string } | null;
};

type Command = {
  id: number;
  familyGeneration: number;
  target: EditorTarget;
  revision: number;
  inputData: EditorInputData;
};

type EditorSessionOptions = {
  transport: EditorSessionTransport;
  autosaveDelayMs?: number;
  onAutosaveError?: (error: unknown) => void;
};

const DEFAULT_AUTOSAVE_DELAY_MS = 1_500;

function sameDocumentFamily(left: EditorTarget | null, right: EditorTarget) {
  return Boolean(
    left &&
    left.workId === right.workId &&
    left.folderPath === right.folderPath &&
    left.documentType === right.documentType &&
    (left.generatedDocumentId ?? "") === (right.generatedDocumentId ?? ""),
  );
}

function sameTarget(left: EditorTarget | null, right: EditorTarget) {
  return Boolean(
    sameDocumentFamily(left, right) &&
    left?.templateId === right.templateId,
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo completar la operación";
}

export function createEditorSession({
  transport,
  autosaveDelayMs = DEFAULT_AUTOSAVE_DELAY_MS,
  onAutosaveError,
}: EditorSessionOptions) {
  let target: EditorTarget | null = null;
  let snapshot: EditorSessionSnapshot = {
    inputData: {},
    revision: 0,
    acknowledgedRevision: 0,
    draftId: "",
    draftUpdatedAt: "",
    draftStatus: "",
    operation: { kind: "idle" },
  };
  let revisionSequence = 0;
  let familyGeneration = 0;
  let commandSequence = 0;
  let activeCommandId: number | null = null;
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let lane: Promise<void> = Promise.resolve();
  const listeners = new Set<() => void>();

  const publish = (next: EditorSessionSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };

  const clearAutosaveTimer = () => {
    if (autosaveTimer === null) return;
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
  };

  const isDirty = () => snapshot.revision !== snapshot.acknowledgedRevision;

  const canAutosave = () => Boolean(
    target?.autosave &&
    !target.generatedDocumentId &&
    target.workId &&
    target.folderPath &&
    target.documentType &&
    target.templateId,
  );

  const isCurrentCommand = (command: Command) => (
    !disposed && activeCommandId === command.id && sameTarget(target, command.target)
  );

  const enqueue = <T>(task: () => Promise<T>) => {
    const result = lane.then(task, task);
    lane = result.then(() => undefined, () => undefined);
    return result;
  };

  const scheduleAutosave = () => {
    clearAutosaveTimer();
    if (disposed || !canAutosave() || !isDirty()) return;
    if (activeCommandId !== null) return;
    if (snapshot.operation.kind === "failed" && snapshot.operation.command === "autosave") return;
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null;
      void autosave();
    }, autosaveDelayMs);
  };

  const beginCommand = (operation: EditorOperation): Command | null => {
    if (!target) return null;
    if (activeCommandId !== null && snapshot.operation.kind !== "failed") return null;
    const command = {
      id: ++commandSequence,
      familyGeneration,
      target,
      revision: snapshot.revision,
      inputData: snapshot.inputData,
    };
    activeCommandId = command.id;
    clearAutosaveTimer();
    publish({ ...snapshot, operation });
    return command;
  };

  const finishCommand = (command: Command) => {
    if (!isCurrentCommand(command)) return false;
    activeCommandId = null;
    publish({ ...snapshot, operation: { kind: "idle" } });
    scheduleAutosave();
    return true;
  };

  const failCommand = (
    command: Command,
    commandKind: "autosave" | "save" | "assist" | "generate",
    error: unknown,
  ) => {
    if (!isCurrentCommand(command)) return false;
    activeCommandId = null;
    publish({
      ...snapshot,
      operation: { kind: "failed", command: commandKind, message: errorMessage(error) },
    });
    return true;
  };

  const draftIdFor = (command: Command) => (
    command.familyGeneration === familyGeneration ? snapshot.draftId || undefined : undefined
  );

  const draftUpdatedAtFor = (command: Command) => (
    command.familyGeneration === familyGeneration ? snapshot.draftUpdatedAt || undefined : undefined
  );

  const acceptPersistedDraft = (
    command: Command,
    persisted: PersistDraftResponse,
    applyNormalizedInput: boolean,
  ) => {
    if (disposed || command.familyGeneration !== familyGeneration) return;

    const next: EditorSessionSnapshot = {
      ...snapshot,
      draftId: persisted.draftId,
      draftUpdatedAt: persisted.updatedAt,
      draftStatus: persisted.status,
    };
    if (sameTarget(target, command.target)) {
      next.acknowledgedRevision = Math.max(snapshot.acknowledgedRevision, command.revision);
      if (applyNormalizedInput && snapshot.revision === command.revision) {
        next.inputData = persisted.inputData;
      }
    }
    publish(next);
  };

  const persistOptions = async (
    command: Command,
    additions: CreatableOptionAddition[],
  ) => {
    if (additions.length === 0) return undefined;
    try {
      await transport.persistOptions({ target: command.target, additions });
      return undefined;
    } catch (error) {
      return error;
    }
  };

  const autosave = async (): Promise<CommandResult<PersistDraftResponse>> => {
    if (!canAutosave() || !isDirty()) return { kind: "ignored" };
    if (activeCommandId !== null && snapshot.operation.kind !== "failed") return { kind: "ignored" };
    const command = beginCommand({ kind: "saving", reason: "auto" });
    if (!command) return { kind: "ignored" };

    return enqueue(async () => {
      if (!isCurrentCommand(command)) return { kind: "stale" };
      try {
        const persisted = await transport.persistDraft({
          draftId: draftIdFor(command),
          expectedUpdatedAt: draftUpdatedAtFor(command),
          target: command.target,
          inputData: command.inputData,
        });
        acceptPersistedDraft(command, persisted, true);
        if (!finishCommand(command)) return { kind: "stale" };
        return { kind: "success", value: persisted };
      } catch (error) {
        if (!failCommand(command, "autosave", error)) return { kind: "stale" };
        onAutosaveError?.(error);
        return { kind: "failure", error };
      }
    });
  };

  const selectDocumentContext = ({ target: nextTarget, inputData }: ContextSelection) => {
    clearAutosaveTimer();
    const preserveDraft = sameDocumentFamily(target, nextTarget);
    if (!preserveDraft) familyGeneration += 1;
    target = nextTarget;
    activeCommandId = null;
    const revision = ++revisionSequence;
    publish({
      inputData,
      revision,
      acknowledgedRevision: revision,
      draftId: preserveDraft ? snapshot.draftId : "",
      draftUpdatedAt: preserveDraft ? snapshot.draftUpdatedAt : "",
      draftStatus: preserveDraft ? snapshot.draftStatus : "",
      operation: { kind: "idle" },
    });
  };

  const activateTemplate = ({ target: nextTarget, inputData }: ContextSelection) => {
    clearAutosaveTimer();
    const preserveDraft = sameDocumentFamily(target, nextTarget);
    if (!preserveDraft) familyGeneration += 1;
    target = nextTarget;
    activeCommandId = null;
    const revision = ++revisionSequence;
    publish({
      inputData,
      revision,
      acknowledgedRevision: preserveDraft ? snapshot.acknowledgedRevision : revision,
      draftId: preserveDraft ? snapshot.draftId : "",
      draftUpdatedAt: preserveDraft ? snapshot.draftUpdatedAt : "",
      draftStatus: preserveDraft ? snapshot.draftStatus : "",
      operation: { kind: "idle" },
    });
    scheduleAutosave();
  };

  const hydrate = ({ target: hydratedTarget, inputData, draft }: HydratedContext) => {
    clearAutosaveTimer();
    const preserveDraft = sameDocumentFamily(target, hydratedTarget);
    if (!preserveDraft) familyGeneration += 1;
    target = hydratedTarget;
    activeCommandId = null;
    const revision = ++revisionSequence;
    publish({
      inputData,
      revision,
      acknowledgedRevision: revision,
      draftId: draft?.id ?? (preserveDraft ? snapshot.draftId : ""),
      draftUpdatedAt: draft?.updatedAt ?? (preserveDraft ? snapshot.draftUpdatedAt : ""),
      draftStatus: draft?.status ?? (preserveDraft ? snapshot.draftStatus : ""),
      operation: { kind: "idle" },
    });
  };

  const edit = (inputData: EditorInputData) => {
    if (inputData === snapshot.inputData) return;
    const revision = ++revisionSequence;
    publish({
      ...snapshot,
      inputData,
      revision,
      operation: snapshot.operation.kind === "failed" ? { kind: "idle" } : snapshot.operation,
    });
    scheduleAutosave();
  };

  const save = async (
    additions: CreatableOptionAddition[] = [],
  ): Promise<CommandResult<PersistDraftResponse>> => {
    if (target?.generatedDocumentId) return { kind: "ignored" };
    const command = beginCommand({ kind: "saving", reason: "manual" });
    if (!command) return { kind: "ignored" };

    return enqueue(async () => {
      if (!isCurrentCommand(command)) return { kind: "stale" };
      try {
        const persisted = await transport.persistDraft({
          draftId: draftIdFor(command),
          expectedUpdatedAt: draftUpdatedAtFor(command),
          target: command.target,
          inputData: command.inputData,
        });
        acceptPersistedDraft(command, persisted, true);
        if (!isCurrentCommand(command)) return { kind: "stale" };
        const optionError = await persistOptions(command, additions);
        if (!finishCommand(command)) return { kind: "stale" };
        return { kind: "success", value: persisted, optionError };
      } catch (error) {
        if (!failCommand(command, "save", error)) return { kind: "stale" };
        return { kind: "failure", error };
      }
    });
  };

  const assist = async (): Promise<CommandResult<AssistResponse>> => {
    const command = beginCommand({ kind: "assisting" });
    if (!command) return { kind: "ignored" };

    return enqueue(async () => {
      if (!isCurrentCommand(command)) return { kind: "stale" };
      try {
        const assisted = await transport.assist({
          target: command.target,
          inputData: command.inputData,
        });
        if (!isCurrentCommand(command)) {
          return { kind: "stale" };
        }
        if (snapshot.revision !== command.revision) {
          finishCommand(command);
          return { kind: "stale" };
        }
        const revision = ++revisionSequence;
        publish({ ...snapshot, inputData: assisted.inputData, revision });
        finishCommand(command);
        return { kind: "success", value: assisted };
      } catch (error) {
        if (!failCommand(command, "assist", error)) return { kind: "stale" };
        return { kind: "failure", error };
      }
    });
  };

  const generate = async (
    additions: CreatableOptionAddition[] = [],
  ): Promise<CommandResult<GeneratedDocumentResult>> => {
    const existingDraftId = snapshot.draftId;
    const command = beginCommand({
      kind: "generating",
      phase: existingDraftId ? "persisting" : "rendering",
    });
    if (!command) return { kind: "ignored" };

    return enqueue(async () => {
      if (!isCurrentCommand(command)) return { kind: "stale" };
      try {
        let draftId = draftIdFor(command);
        if (draftId) {
          publish({ ...snapshot, operation: { kind: "generating", phase: "persisting" } });
          const persisted = await transport.persistDraft({
            draftId,
            expectedUpdatedAt: draftUpdatedAtFor(command),
            target: command.target,
            inputData: command.inputData,
          });
          acceptPersistedDraft(command, persisted, true);
          draftId = persisted.draftId;
          if (!isCurrentCommand(command)) return { kind: "stale" };
          publish({ ...snapshot, operation: { kind: "generating", phase: "rendering" } });
        }

        const generated = await transport.generate({
          draftId,
          draftUpdatedAt: draftId ? draftUpdatedAtFor(command) : undefined,
          target: command.target,
          inputData: command.inputData,
        });
        if (!isCurrentCommand(command)) return { kind: "stale" };

        const serverInputData = generated.generatedDocument.input_data ?? command.inputData;
        const next: EditorSessionSnapshot = {
          ...snapshot,
          acknowledgedRevision: Math.max(snapshot.acknowledgedRevision, command.revision),
        };
        if (generated.sourceDraft?.id === snapshot.draftId) {
          next.draftUpdatedAt = generated.sourceDraft.updatedAt;
        }
        if (snapshot.revision === command.revision) next.inputData = serverInputData;
        publish(next);

        if (!isCurrentCommand(command)) return { kind: "stale" };
        const optionError = await persistOptions(command, additions);
        if (!finishCommand(command)) return { kind: "stale" };
        return { kind: "success", value: generated, optionError };
      } catch (error) {
        if (isCurrentCommand(command) && snapshot.revision !== command.revision) {
          finishCommand(command);
          return { kind: "stale" };
        }
        if (!failCommand(command, "generate", error)) return { kind: "stale" };
        return { kind: "failure", error };
      }
    });
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      disposed = false;
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          disposed = true;
          clearAutosaveTimer();
        }
      };
    },
    selectDocumentContext,
    activateTemplate,
    hydrate,
    edit,
    save,
    assist,
    generate,
  };
}

export type EditorSession = ReturnType<typeof createEditorSession>;
