import type { DocumentAiOutputType, ReportComposition } from "@/lib/document-ai/schemas/types";
import { renderReportHtml } from "./render-html";
import { renderReportDocx } from "./render-docx";
import { renderReportPptx } from "./render-pptx";
import { renderReportXlsx } from "./render-xlsx";

export type RenderedDocumentAiOutput = {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
  outputType: DocumentAiOutputType | "html";
};

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "document-ai";
}

export async function renderDocumentAiOutput(params: {
  composition: ReportComposition;
  outputType: DocumentAiOutputType;
  pdfRenderer?: (html: string) => Promise<Uint8Array>;
}): Promise<RenderedDocumentAiOutput> {
  const base = slug(params.composition.title);
  if (params.outputType === "pptx") {
    return {
      bytes: await renderReportPptx(params.composition),
      fileName: `${base}.pptx`,
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      outputType: "pptx",
    };
  }
  if (params.outputType === "docx") {
    return {
      bytes: await renderReportDocx(params.composition),
      fileName: `${base}.docx`,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      outputType: "docx",
    };
  }
  if (params.outputType === "xlsx") {
    return {
      bytes: await renderReportXlsx(params.composition),
      fileName: `${base}.xlsx`,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      outputType: "xlsx",
    };
  }
  const html = renderReportHtml(params.composition);
  if (params.outputType === "pdf" && params.pdfRenderer) {
    return {
      bytes: await params.pdfRenderer(html),
      fileName: `${base}.pdf`,
      mimeType: "application/pdf",
      outputType: "pdf",
    };
  }
  return {
    bytes: new TextEncoder().encode(html),
    fileName: `${base}.html`,
    mimeType: "text/html; charset=utf-8",
    outputType: "html",
  };
}
