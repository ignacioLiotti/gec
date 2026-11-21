# ADR 0036: Static portfolio guide with product components

Date: 2026-09-07
Status: Accepted for local implementation

## Context

The portfolio needs an open, navigable tour with fictional data and explanations of engineering decisions. The selected screens must reuse the product implementations. The existing Next application also owns authentication, tenant context, server endpoints and production integrations, which are unnecessary for this presentation.

## Decision

Build `portfolio-guide/` as a separate static Vite entry. Import the existing operations workspace, FormTable configurations, document sheets, report workspace, data-flow client and sample-analysis review component. The guide adds English framing and small fixture compositions; product UI retains Spanish.

Keep framework compatibility aliases and service adapters inside the Vite configuration. They do not change Next routes or authorization. The guide uses its own environment directory, defines no production environment values, bundles no root provider shell and restricts browser network sources. The local fetch adapter handles only report presets, template responses and snapshot links. Unknown API requests and cross-origin fetches return a local failure; asset requests remain available.

Store reviewed certificate and obra edits and presets in sessionStorage. Use the component's existing local preferences where applicable and clear only guide-owned keys on reset. Certificate saves feed ReportPage. Data-flow configuration stays in the mounted component. OCR analysis is supplied as initial review data; applying creates definition JSON locally. The sample card's optional inputs preserve the behavior of existing callers.

CSV and XLSX exports run in the browser. PDF delegates to browser print, while production retains its server renderer. Report links include fixture rows and settings in the URL, validate their shape and check a client expiry. They provide no access-control or revocation guarantee.

## Alternatives considered

- A public Next route would share more runtime behavior but also inherit the parent application's provider and environment requirements. That is useful for a tenant-backed demo, which is a different deployment boundary.
- Recreated screens or screenshots alone would duplicate the interface or prevent visitors from trying the interactions. They do not meet this portfolio's requirement.
- Extracting the table, report and document engines into packages first would make the guide source portable but substantially enlarge this change. The existing contracts provide a later extraction path.

## Consequences

The built directory can run on static hosting without an account or backend. The guide source still imports from the parent repository; it is not an independently copyable package. Document comparison composes the existing DocumentPreview and FormTable in an adjustable split; narrow containers switch panels while retaining both mounted components. Product table behavior is configured through existing embedded and toolbar options.

The optional guided case owns progress in sessionStorage and listens to same-tab frame storage events. It seeds one incorrect amount, checks the saved correction and marks export completion only after the report exporter has received the corrected rows. The progress is a local demonstration aid, not an audit record. Opening contextual notes leaves the iframe mounted and returns keyboard focus on close.

ReportPage adds optional compact controls, a host navigation height offset and an export callback carrying the exported rows. Existing product callers retain the original layout and behavior. The demo uses the compact navigation to avoid repeated shortcuts and a zero offset because its frame already excludes guide navigation. The operations display formats decimal delay values without changing the delay calculation or late threshold.

The API adapter depends on the report component's current endpoint contract. Browser checks exercise those interactions to catch drift. Framework aliases are intentionally narrow and should be replaced by explicit service/navigation inputs when the components gain independent consumers.

There are no database, storage-service, tenant-access, extraction-pipeline or production permission changes. Publishing the app or its source remains a separate action. Local validation covers rendering, navigation, editable data, exports, malformed share links, reset and network isolation. Open-source preparation proposals and the visual documentation status live beside the guide.
