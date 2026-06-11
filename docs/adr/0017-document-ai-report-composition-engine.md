# Document AI report composition engine

Status: accepted

Date: 2026-05-28

## Context

Autocompleting generated-document templates from extracted rows is useful, but it does not satisfy broader administrative requests such as "find all 2025 progress certificates and build a PowerPoint explaining monthly evolution." Those requests need a durable run record, source evidence, output artifacts, retrieval, normalization, continuity, composition and renderers.

## Decision

Document AI is a first-class workspace at `/document-ai`. A run stores the prompt, parsed intent, retrieved context, report composition, warnings, sources and output artifacts.

The engine is organized as:

- index: rebuilds a tenant/obra document index from extracted rows
- retrieval: parses user intent and retrieves rows/index chunks
- normalization: maps extracted rows into administrative records, starting with progress certificates
- continuity: resolves certificate series and next-draft state
- analysis: computes charts and conflicts deterministically
- composer: builds `ReportComposition` and then a `ReportLayoutPlan`
- renderers: emit HTML, PDF, PPTX, DOCX and XLSX outputs
- audit: persists runs, sources and generated outputs

Gemini can parse natural-language intent behind the same retrieval contract when `GOOGLE_GENERATIVE_AI_API_KEY` or `GOOGLE_API_KEY` is configured. The default intent model is `gemini-2.5-flash`, overrideable through `DOCUMENT_AI_GEMINI_INTENT_MODEL`. Embeddings remain on `text-embedding-3-small` for the existing vector index, but deterministic filters and row retrieval remain the baseline so the feature works without external AI credentials.

HTML/PDF rendering does not dump every `ReportComposition` table in order. A layout planner first chooses a report template and block sequence. Certificate vs purchase-order reconciliations use `financial_reconciliation`, which renders a cover, warnings, KPI cards, charts, monthly analysis, certificate evolution, category matrix, consolidated dated purchase orders, undated purchase-order exceptions, methodology and evidence appendix. Other requests fall back to executive, chart or audit layouts based on the available composition.

## Consequences

- Users can generate formal outputs from obra documents without treating the product as a chatbot.
- Every generated report has sources, warnings and persisted output metadata.
- The first normalized administrative model is `certificado_avance`; additional types should be added as explicit normalizers.
- Visual report structure is data-driven by `ReportLayoutPlan`, so new administrative report types should add planner blocks instead of hardcoding PDF pages inside the renderer.
- PPTX/DOCX are generated with lightweight OpenXML renderers to avoid adding dependency risk in this iteration.
- PDF rendering uses the existing HTML-to-PDF route.

## Related files

- `app/document-ai/*`
- `app/api/document-ai/*`
- `lib/document-ai/*`
- `supabase/migrations/0106_document_ai_engine.sql`

## Related docs

- `CONTEXT.md`
- `docs/obsidian-brain/10 - Documents & File Manager.md`
- `docs/obsidian-brain/20 - Permissions System.md`
