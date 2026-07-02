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

Import components from the local source barrel:

```tsx
import { Button, Card, Input } from "@/design-system"
```

Import tokens directly when needed:

```ts
import { tokens } from "@/design-system/tokens"
```
