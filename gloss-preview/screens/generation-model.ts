import type {
  PreviewDataset,
  PreviewDraft,
  PreviewDraftRow,
} from "../contracts";

export type DraftErrors = Record<string, string>;
export type GenerationSection =
  | "context"
  | "header"
  | "supplier"
  | "items"
  | "conditions";
export interface GenerationIssue {
  key: string;
  message: string;
  section: GenerationSection;
}
export type ChangeDraftField = <K extends keyof PreviewDraft>(
  key: K,
  value: PreviewDraft[K],
) => void;
export interface GenerationComposerProps {
  draft: PreviewDraft;
  errors: DraftErrors;
  onFieldChange: ChangeDraftField;
  onRowChange: (id: string, patch: Partial<PreviewDraftRow>) => void;
  onAddRow: () => string;
  onDuplicateRow: (id: string) => void;
  onRemoveRow: (id: string) => void;
  removedRow: { row: PreviewDraftRow; index: number } | null;
  onUndoRemove: () => void;
}
export function cloneDraft(draft: PreviewDraft): PreviewDraft {
  return { ...draft, rows: draft.rows.map((row) => ({ ...row })) };
}
export function resolveDraft(
  data: PreviewDataset,
  obraId?: string,
  draftId?: string,
): PreviewDraft | undefined {
  if (draftId) return data.drafts.find((draft) => draft.id === draftId);
  return obraId
    ? data.drafts.filter((draft) => draft.obraId === obraId).at(-1)
    : data.drafts.at(-1);
}
export function createDraft(
  data: PreviewDataset,
  obraId: string,
  templateId: string,
): PreviewDraft {
  const prefix = templateId === "purchase" ? "OC" : "SC";
  const previousCodes = [
    ...data.drafts
      .filter((d) => d.obraId === obraId && d.templateId === templateId)
      .map((d) => d.code),
    ...data.documents
      .filter((d) => d.obraId === obraId && d.name.startsWith(prefix + "-"))
      .map((d) => d.name),
  ];
  const nextNumber =
    Math.max(
      0,
      ...previousCodes.map((code) =>
        Number(code.match(/(\d+)(?:\.[a-z]+)?$/i)?.[1] ?? 0),
      ),
    ) + 1;
  return {
    id: `draft-${crypto.randomUUID()}`,
    obraId,
    templateId,
    folderPath:
      data.folders.find((f) => f.path === "ordenes-de-compra")?.path ??
      data.folders[0]?.path ??
      "",
    code: `${prefix}-2026-${String(nextNumber).padStart(3, "0")}`,
    date: "2026-10-15",
    supplier: "",
    taxId: "",
    address: "",
    notes: "",
    rows: [],
    discount: 0,
  };
}
export function getDraftIssues(
  draft: PreviewDraft,
  data: PreviewDataset,
): GenerationIssue[] {
  const issues: GenerationIssue[] = [];
  const add = (key: string, message: string, section: GenerationSection) =>
    issues.push({ key, message, section });
  if (!data.obras.some((o) => o.id === draft.obraId))
    add("obraId", "Elegí una obra.", "context");
  if (!data.templates.some((t) => t.id === draft.templateId))
    add("templateId", "Elegí una plantilla.", "context");
  if (!data.folders.some((f) => f.path === draft.folderPath))
    add("folderPath", "Elegí la carpeta destino.", "context");
  if (!draft.code.trim())
    add("code", "Completá el número del documento.", "header");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date))
    add("date", "Ingresá una fecha válida.", "header");
  if (!draft.supplier.trim())
    add("supplier", "Completá el proveedor.", "supplier");
  if (!draft.taxId.trim())
    add("taxId", "Completá el CUIT del proveedor.", "supplier");
  if (!draft.address.trim())
    add("address", "Completá el domicilio del proveedor.", "supplier");
  if (!draft.rows.length) add("rows", "Agregá al menos un material.", "items");
  for (const [index, row] of draft.rows.entries()) {
    if (!row.description.trim())
      add(
        `row-${row.id}-description`,
        `Material ${index + 1}: completá la descripción.`,
        "items",
      );
    if (!Number.isFinite(row.quantity) || row.quantity <= 0)
      add(
        `row-${row.id}-quantity`,
        `Material ${index + 1}: la cantidad debe ser mayor que cero.`,
        "items",
      );
    if (!row.unit.trim())
      add(
        `row-${row.id}-unit`,
        `Material ${index + 1}: completá la unidad.`,
        "items",
      );
    if (!Number.isFinite(row.price) || row.price < 0)
      add(
        `row-${row.id}-price`,
        `Material ${index + 1}: ingresá un precio válido.`,
        "items",
      );
  }
  if (
    !Number.isFinite(draft.discount) ||
    draft.discount < 0 ||
    draft.discount > 100
  )
    add("discount", "La bonificación debe estar entre 0 y 100%.", "conditions");
  return issues;
}
export function getDraftTotals(draft: PreviewDraft) {
  const subtotal = draft.rows.reduce(
    (sum, row) =>
      sum +
      (Number.isFinite(row.quantity) && Number.isFinite(row.price)
        ? row.quantity * row.price
        : 0),
    0,
  );
  const discountAmount =
    subtotal * (Number.isFinite(draft.discount) ? draft.discount / 100 : 0);
  return { subtotal, discountAmount, total: subtotal - discountAmount };
}
export const formatAmount = (amount: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
