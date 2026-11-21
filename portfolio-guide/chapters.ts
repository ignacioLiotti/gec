export const chapters = [
  {
    id: "operations",
    number: "01",
    title: "See what needs attention",
    short: "Operations",
    category: "Start with the decision",
    component: "OperationalWorkspace",
    source: "app/dashboard/_components/operational-workspace.tsx",
    description:
      "Policy exposure, schedule drift and documents awaiting review, arranged around the next decision.",
    try: [
      "Select a month to inspect the expiry detail.",
      "Focus a KPI or a project metric to read its definition.",
      "Open a project to continue into document review.",
    ],
    decision:
      "Lead with an operational sentence, then expose the numbers behind it. Progress and elapsed time sit together so a percentage has context.",
    tradeoff:
      "The dashboard summarizes several systems. Each metric needs a defined scope, currency and destination; a compact total alone can be misleading.",
    architecture:
      "The server route resolves tenant access and prepares a typed OperationalWorkspaceData object. The same rendering component accepts that object here.",
    boundary:
      "All figures are supplied examples. No policy service or tenant account is connected.",
  },
  {
    id: "obras",
    number: "02",
    title: "Make daily work precise",
    short: "Obras table",
    category: "Care in repeated interactions",
    component: "FormTable + obras configuration",
    source: "components/form-table/configs/obras-detalle.tsx",
    description:
      "A configurable editing workspace for construction projects, with filters, typed cells and explicit save states.",
    try: [
      "Search for Torre or filter the projects.",
      "Double-click a value to edit and inspect the unsaved state.",
      "Save the edit locally or restore the original value.",
    ],
    decision:
      "Keep spreadsheet interaction familiar, while making editing, filtering and saving visible. Reuse the same table engine for project data and extracted rows.",
    tradeoff:
      "A shared table has a large behavioral contract. Domain-specific columns stay in configuration; virtualized editing and keyboard interactions need focused regression coverage.",
    architecture:
      "FormTable owns interaction and dirty tracking. The obras configuration supplies columns, validators and domain behavior. This demo substitutes local persistence.",
    boundary:
      "Saved edits last for this browser tab. The reset button restores sample data. No bulk-update API is used.",
  },
  {
    id: "documents",
    number: "03",
    title: "Keep the source within reach",
    short: "Document review",
    category: "Reviewable automation",
    component: "DocumentPreview + FormTable",
    source:
      "portfolio-guide/screens/documents.tsx",
    description:
      "Open the source beside editable extracted rows, and inspect a real recovery state before applying data.",
    try: [
      "Compare source and rows side by side; drag the divider to resize.",
      "Edit an extracted amount and save it.",
      "Explore the continuity conflict, then continue to Reports.",
    ],
    decision:
      "Keep the document, extracted data and recovery explanation together. A failure needs its consequence and the next action.",
    tradeoff:
      "A new extraction can change technical row IDs. Stable lineage preserves business identity; ambiguous matches require explicit review.",
    architecture:
      "The production file manager coordinates storage and extraction. This demo composes its real DocumentPreview and FormTable in an adjustable split. Narrow screens switch panels without discarding edits.",
    boundary:
      "The source is a fictional SVG certificate and the extraction is precomputed. No OCR runs. The conflict is a selectable fixture, not a live reconciliation result.",
  },
  {
    id: "reports",
    number: "04",
    title: "Finish with something usable",
    short: "Report workshop",
    category: "End-to-end delivery",
    component: "ReportPage",
    source: "components/report/report-page.tsx",
    description:
      "Turn reviewed rows into a document with a live paper preview, grouping, totals and browser exports.",
    try: [
      "Change the description and inspect the paper.",
      "Group or hide columns, then save a local preset.",
      "Export CSV or Excel, or use PDF to print/save through the browser.",
    ],
    decision:
      "The workflow ends in an artifact a team can use beyond the application. The editing controls and paper preview are views of the same report state.",
    tradeoff:
      "Interactive tables and paginated documents have different layout constraints. Browser print is useful here; production uses its server renderer.",
    architecture:
      "ReportConfig provides data and column semantics to a shared report workspace. Presets and example share links are handled locally in this guide.",
    boundary:
      "Saved certificate edits feed this report. Share links carry a snapshot of the local rows and report settings in the URL; they have no access control or server-side revocation. PDF uses the browser print dialog; CSV and XLSX are generated locally.",
  },
  {
    id: "data-flow",
    number: "05",
    title: "Explain where a result comes from",
    short: "Data-flow",
    category: "Architecture in the interface",
    component: "DataFlowPageClient",
    source: "app/excel/[obraId]/data-flow/page-client.tsx",
    description:
      "Follow a business result through a calculation to its source fields and extraction tables.",
    try: [
      "Select a result and follow its inputs.",
      "Switch to Todo el flujo for the complete configuration.",
      "Open Avanzado to inspect or edit the configuration locally.",
    ],
    decision:
      "Tenant defaults establish shared calculations. An obra can override them without forking the interface. Display, suggestion and automatic update are separate choices.",
    tradeoff:
      "Configurable calculations need dependency validation, predictable merging and writeback rules. More flexibility also requires better explanations.",
    architecture:
      "The effective configuration merges tenant definitions with obra overrides. Calculation evaluation is separate from rendering; writeback decisions are recorded in the product.",
    boundary:
      "Edits update this local component. They do not recompute or write official obra values in a backend.",
  },
  {
    id: "setup",
    number: "06",
    title: "Start with the customer's document",
    short: "Sample-based setup",
    category: "Adapting to existing work",
    component: "SampleAnalysisCard",
    source: "app/admin/obra-defaults/_components/SampleAnalysisCard.tsx",
    description:
      "Review actual example values and choose what to extract before dealing with configuration details.",
    try: [
      "Select the fields and table columns to keep.",
      "Change how documents arrive and whether layouts vary.",
      "Apply the proposal and inspect the generated configuration.",
    ],
    decision:
      "Invert setup: begin with a document the customer already has. Example values make the proposal concrete, and adaptive questions turn domain knowledge into extraction instructions.",
    tradeoff:
      "A sample is evidence, not a complete specification. Confidence and warnings stay visible, and a person chooses the final configuration.",
    architecture:
      "SampleAnalysis converts through buildImportedDefinitionFromAnalysis into the existing folder-definition contract. The demo starts at the real review step.",
    boundary:
      "The analysis is preloaded. No upload, AI provider or folder provisioning is performed. Applying produces local configuration JSON.",
  },
] as const;
export type ChapterId = (typeof chapters)[number]["id"];
