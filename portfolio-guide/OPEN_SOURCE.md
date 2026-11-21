# Preparing the public version

See [VISUAL_UX_PLAN.md](VISUAL_UX_PLAN.md) for the screen-specific review and the visual changes now implemented in the demo.

The static guide is the first runnable slice. Publishing the full application needs a separate decision about source scope and ownership. These are proposals, not completed changes.

## First: strengthen the presentation

| Priority | Change                                                               | Why it matters                                                                                                                            | Acceptance check                                                                                                            |
| -------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1        | Audit report date semantics centrally                                | The guide uses a UTC renderer for date-only certificate periods; the shared report table currently parses an ISO date as an instant       | Date-only values keep their calendar day in Argentina and positive-offset zones; timestamps retain their intended semantics |
| 1        | Check save and recovery states across table uses                     | FormTable supplies many domain configurations; a successful happy path does not prove keyboard undo, failed saves or import conflicts     | Run focused edit/cancel/save-failure tests in Obras and document review                                                     |
| 2        | Connect drilldowns to distinct fixture cases                         | All selected project links currently use one review example                                                                               | Every linked project either opens its own consistent source rows or clearly identifies the shared example                   |

## Then: reduce source coupling

1. Make navigation and persistence explicit inputs at the existing component boundaries. `ReportPage` calls preset/share endpoints internally; the static guide currently adapts those calls. A service input would let product, demo and tests use the same component without overriding fetch.
2. Extract reusable packages when there is a second consumer. Start with the existing `FormTableConfig` and `ReportConfig` contracts. Keep domain rules with the obras and extraction configurations. Avoid copying the component implementations into a second demo tree.
3. Split large coordinators by observable responsibility. `file-manager.tsx` spans storage, extraction, selection, preview and recovery; `report-page.tsx` spans data loading, document state, presets and sharing. Move one responsibility at a time and retain focused behavioral checks.
4. Preserve lineage and writeback invariants. A public refactor must keep business-row identity stable across reimport, preserve overrides, detect ambiguous bindings, and distinguish displayed results, suggestions and applied writes. ADRs 0001, 0002 and 0013 define those contracts.

## Before publication

- Choose whether the public source is the full app or a package containing the selected components. The guide source currently depends on parent folders.
- Review the proposed source snapshot and Git history for private tenant data, internal documents, credentials and production configuration. The fixtures in this guide are fictional; that does not establish that the rest of the repository or its history is ready to publish.
- Confirm the right to publish the application's code, fonts, assets and bundled third-party material, then choose a project license. No license is invented here.
- Add CI for the static build, type check, local adapter behavior and browser journey. Run it without application secrets.
- Document production-only dependencies and setup separately. A visitor should be able to run the portfolio before provisioning infrastructure.

## Implemented in this slice

The guide has an English narrative, six directly imported product modules, chapter navigation, a keyboard skip link, responsive framing, reset, local fixtures and a focused browser journey. Certificate edits flow into a report. Share links carry a local snapshot; unknown service operations do not escape the guide. Source code is formatted, the build is independent of application environment files, and the architecture decision is recorded.

The presentation pass adds a guided correction-to-export case, viewport-sized chapters, a source/data split with pointer and keyboard resizing, mobile tabs that preserve unsaved edits, a complete mobile chapter selector, contextual design notes with real code, larger guide controls, consistent dashboard amounts and compact report controls. The guide entry, navigation/progress and reading content now have separate files. These changes are runnable locally; source extraction and publication preparation above remain separate work.
