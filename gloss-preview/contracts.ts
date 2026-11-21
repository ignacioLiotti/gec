export type PreviewRoute =
  | { view: "dashboard" }
  | { view: "obras" }
  | { view: "general"; obraId: string }
  | {
      view: "documents";
      obraId: string;
      folderPath?: string;
      documentId?: string;
      mode?: "files" | "table";
    }
  | { view: "generation"; obraId?: string; draftId?: string };

export interface PreviewCurvePoint {
  period: string;
  plan: number;
  real: number | null;
}
export interface PreviewCertificate {
  id: string;
  number: string;
  expediente: string;
  location: string;
  period: string;
  amount: number;
  paid: boolean;
  pending?: boolean;
}
export interface PreviewObra {
  id: string;
  number: number;
  name: string;
  entity: string;
  area: number;
  baseMonth: string;
  startDate: string;
  contract: number;
  certified: number;
  progress: number;
  contractMonths: number;
  extensionMonths: number;
  elapsedMonths: number;
  curve: PreviewCurvePoint[];
  certificates: PreviewCertificate[];
  customFields: Record<string, string>;
}
export type PreviewObraPatch = Partial<Omit<PreviewObra, "id">>;
export type OcrStatus =
  | "pending"
  | "processing"
  | "extracted"
  | "empty"
  | "conflict"
  | "failed";
export interface PreviewExtractedRow {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  price: number;
  date: string;
}
export interface PreviewDocument {
  id: string;
  obraId: string;
  folderPath: string;
  name: string;
  size: string;
  date: string;
  status: OcrStatus;
  rows: PreviewExtractedRow[];
  kind: "pdf" | "xlsx" | "docx" | "html";
  generated?: boolean;
  draftId?: string;
  content?: PreviewDraft;
}
export interface PreviewFolder {
  path: string;
  name: string;
  parentPath: string;
  ocr: boolean;
  tableName?: string;
}
export interface PreviewDraftRow {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  price: number;
}
export interface PreviewDraft {
  id: string;
  obraId: string;
  templateId: string;
  folderPath: string;
  code: string;
  date: string;
  supplier: string;
  taxId: string;
  address: string;
  notes: string;
  rows: PreviewDraftRow[];
  discount: number;
}
export interface PreviewTemplate {
  id: string;
  name: string;
  type: string;
  description: string;
}
export interface PreviewPolicy {
  id: string;
  obraId: string;
  company: string;
  type: string;
  number: string;
  expires: string;
  status: "active" | "warning" | "expired";
}
export interface PreviewGlobalFile {
  id: string;
  name: string;
  category: string;
  date: string;
  size: string;
}
export interface PreviewDataset {
  obras: PreviewObra[];
  documents: PreviewDocument[];
  folders: PreviewFolder[];
  drafts: PreviewDraft[];
  templates: PreviewTemplate[];
  policies: PreviewPolicy[];
  globalFiles: PreviewGlobalFile[];
}
export interface PreviewActions {
  onNavigate: (route: PreviewRoute) => void;
  onSaveObra: (obraId: string, patch: PreviewObraPatch) => void;
  onAddObra: (obra: PreviewObra) => void;
  onSaveDraft: (draft: PreviewDraft) => void;
  onGenerateDocument: (draft: PreviewDraft) => PreviewDocument;
  onAddDocument: (document: PreviewDocument) => void;
  onUpdateDocument: (id: string, patch: Partial<PreviewDocument>) => void;
  onDeleteDocument: (id: string) => void;
}
export interface PreviewScreenProps {
  data: PreviewDataset;
  actions: PreviewActions;
}
export const money = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
export const number = (value: number, decimals = 0) =>
  new Intl.NumberFormat("es-AR", { maximumFractionDigits: decimals }).format(
    value,
  );
export const percent = (value: number) => `${number(value, 1)}%`;
export const PREVIEW_TODAY = "2026-10-14";
