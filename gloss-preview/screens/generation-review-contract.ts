import type { PreviewDocument, PreviewDraft } from "../contracts";
import type { RefObject } from "react";
import type { GenerationIssue, GenerationSection } from "./generation-model";
export interface GenerationSectionStatus {
  id: GenerationSection;
  label: string;
  pending: number;
  firstKey?: string;
}
export interface GenerationDestination {
  obraName: string;
  folderName: string;
  fileName: string;
}
export interface ReadinessRailProps {
  sections: GenerationSectionStatus[];
  attempted: boolean;
  errorCount: number;
  totals: { subtotal: number; discountAmount: number; total: number };
  discount: number;
  destination: GenerationDestination;
  saveState: "saved" | "dirty";
  lastGenerated?: PreviewDocument;
  onReview: () => void;
  onSave: () => void;
  onFocusSection: (section: GenerationSection) => void;
  onFocusFirstError: () => void;
  onOpenGenerated: () => void;
}
export interface ReviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: "review" | "generated";
  draft: PreviewDraft;
  obraName: string;
  templateName: string;
  folderName: string;
  issues: GenerationIssue[];
  generatedDocument?: PreviewDocument;
  onGenerate: () => void;
  onFixPending: (key?: string) => void;
  onOpenDocument: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
}
