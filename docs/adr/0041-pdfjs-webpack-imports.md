# ADR 0041: Resolve PDF.js webpack imports to its installed minified distributions

Status: Accepted and verified in the owned webpack runtime on 2026-10-20. Not committed or deployed.

## Context

The owned Next 16.2.6 webpack runtime fails before the PDF page selector can open. The actual browser trace from run `8523ec23-58d5-48ef-ab04-45f5527480b7` records `Object.defineProperty called on non-object` at the first eval of `pdfjs-dist/legacy/build/pdf.mjs`. The same installed PDF.js 5.4.296 package ships both normal and minified ESM distributions.

The normal distribution declares `var __webpack_exports__` at module scope. Webpack's eval wrapper initializes ESM exports before that declaration, so the local variable shadows the wrapper's exports. The minified distributions rename that variable. The corresponding upstream failure mechanism is documented in [webpack issue 16744](https://github.com/webpack/webpack/issues/16744).

## Decision

Resolve only the package-root and legacy PDF.js main-module imports to their installed minified equivalents in the webpack configuration. Keep worker imports and package versions unchanged. This covers both the direct file-manager reader and react-pdf's package-root reader. Turbopack keeps its existing resolution.

## Alternatives and consequences

Changing every consumer would duplicate an integration rule and miss react-pdf's internal import. Disabling eval source maps for the entire application changes unrelated development behavior. Updating a production dependency requires separate approval and is unnecessary for this bounded repair.

The alias applies only when webpack is selected. Minified library frames have less readable local names. Runtime proof must include counting/selecting PDF pages and the actual preview, rather than a configuration-only test. Production-build verification remains separate.

Run `7130d341-9ef8-4296-9b82-1a4920da891e` passed the real two-page PDF journey: the preview rendered its canvas and first-page text, cancelling produced no extraction rows or provider call, and selecting page two persisted that scope and sent the page restriction in the provider instruction. OCR output came from the owned transport fixture; this establishes reader integration and page-scope propagation, not recognition quality.
