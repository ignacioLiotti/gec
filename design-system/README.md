# Project Design System

This folder is the isolated, project-local design system. It contains only reusable tokens and UI primitives.

## Contents

- `components/`: reusable controls and primitives.
- `tokens/`: TypeScript token map.
- `tokens.css`: CSS custom properties and base utilities required by the components.
- `tailwind-preset.ts`: Tailwind token mapping.
- `lib/utils.ts`: shared `cn` class helper used by the components.

It intentionally excludes app pages, demos, app shell/sidebar navigation, package build files, and the `AcmeProvider`.

## Usage

Import the token CSS once from your app root stylesheet:

```css
@import "@/design-system/tokens.css";
```

Product code imports through the stable app surface:

```tsx
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
```

Import tokens directly when needed:

```ts
import { tokens } from "@/design-system/tokens"
```

Overlapping component modules have one implementation here and a reexport in `components/ui`. Keep screen appearance in variants. Run `npm run check:ui`, `npm run typecheck:ui`, and the Storybook checks described in `stories/README.md`. See ADR 0035 for the consolidation boundary and preserved domain exceptions.
