# Remotion — Sintesis promo video

A ~70-second commercial video for the platform, built as a [Remotion](https://remotion.dev) composition. **This is a standalone marketing asset — it is not part of the shipping app.** UI scenes are hand-built mocks, not real product screens.

- Brand: orange accent, Spanish copy (Argentine voseo), 1920×1080.
- Entry point: `index.ts` → `Root.tsx` → `SintesisCommercial.tsx`.

## Commands

```bash
pnpm video:studio            # open Remotion Studio to preview/edit
pnpm video:render:sintesis   # render to out/sintesis-commercial.mp4 (h264, crf 18)
```

## Rules

- Don't import app components or the design system here; the video keeps its own self-contained styling.
- App-code conventions (tokens, `@/components/ui/*`) do not apply in this folder.
