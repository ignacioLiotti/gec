# Paper and light study

`Vibe / Papel y luz / Playground` is an isolated visual direction for user feedback. It does not replace the published-theme motion examples or change production components/tokens.

The user's references establish matte paper-like surfaces, a sheet resting over a tray/footer, nested attention rows, warm neutral navigation and selective gloss on the primary action and chart tooltip. Local `paper-*` styles intentionally explore this new design rather than claim parity with the existing app. Light/dark appearance and three elevation strengths are available in the canvas.

Interactions use fixtures: select/confirm a review, expand attention items, filter/search documents, create a field, and inspect graph points by pointer or keyboard. No product APIs, uploaded documents or persistence are involved. The chart is a visual study with illustrative values, not a financial report.

Verify with `npm run typecheck:storybook`, focused ESLint, `npm run build-storybook`, then `node scripts/check-paper-vibe.mjs` against the static preview at port 6006. Browser captures go to `.codex-tmp/paper-vibe-*.png`. This is a Storybook experiment; production flows, domain rules and FigJam remain unchanged.
