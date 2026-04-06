# Multi-Step Form Styling Guide

Reference implementation: `app/admin/obra-defaults/page.tsx` (folder creation wizard).

---

## Step Indicator

The step indicator sits at the top of the dialog, above the title. It communicates three states — upcoming, active, and complete — and lets users navigate back to previous steps.

### Anatomy

```
  ●────────●────────○────────○
Base      Captura  Campos  Revisión
```

Each node is a `<button>` with a label underneath. Nodes are joined by a connector line that fills orange as steps are completed.

### Three States

| State | Circle | Label | Connector to next |
|---|---|---|---|
| **Upcoming** | `border-border bg-background text-muted-foreground` | `text-muted-foreground/60` | gray (`bg-border`) |
| **Active** | `border-orange-500 bg-background text-orange-500` + `ring-4 ring-orange-500/10` | `text-orange-500` | gray (not yet crossed) |
| **Complete** | `border-orange-500 bg-orange-500 text-white` + checkmark SVG | `text-foreground/70` | orange (`bg-orange-500`, width 100%) |

### Connector Animation

The fill is a CSS width transition, not an opacity fade. This reads as "progress crossing a line" rather than "something appearing":

```tsx
<div className="relative mx-2 mt-3 h-[2px] w-8 overflow-hidden rounded-full bg-border">
  <div
    className="absolute inset-y-0 left-0 rounded-full bg-orange-500 transition-[width] duration-300 ease-out"
    style={{ width: isComplete ? "100%" : "0%" }}
  />
</div>
```

`transition-[width]` keeps the animation scoped to a single property. `ease-out` makes it feel snappy — starts fast, decelerates, never sluggish.

### Checkmark SVG

Use an inline SVG path rather than a Lucide icon. The `h-3 w-3` size fits the `h-7 w-7` circle without padding math:

```tsx
<svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
  <path
    d="M2 6.5l2.5 2.5 5.5-5.5"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
</svg>
```

### Back-navigation rule

Only let users click nodes at or before their current step (`index <= folderEditorStep`). Forward nodes are `disabled` and styled with `disabled:cursor-default` — no pointer, no hover state.

### Full example

```tsx
<div className="flex items-start justify-center">
  {steps.map((step, index) => {
    const isActive = index === currentStep;
    const isComplete = index < currentStep;
    const isClickable = index <= currentStep;
    const isLast = index === steps.length - 1;

    return (
      <div key={step.label} className="flex items-start">
        <button
          type="button"
          onClick={() => isClickable && goToStep(index)}
          disabled={!isClickable}
          className="flex flex-col items-center gap-1.5 disabled:cursor-default"
          aria-current={isActive ? "step" : undefined}
          aria-label={`Paso ${index + 1}: ${step.label}`}
        >
          <div
            className={[
              "flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-semibold transition-all duration-200",
              isComplete
                ? "border-orange-500 bg-orange-500 text-white"
                : isActive
                  ? "border-orange-500 bg-background text-orange-500 ring-4 ring-orange-500/10"
                  : "border-border bg-background text-muted-foreground",
            ].join(" ")}
          >
            {isComplete ? <CheckSVG /> : index + 1}
          </div>
          <span
            className={[
              "text-[10px] font-medium tracking-[0.1em] uppercase transition-colors duration-200",
              isActive
                ? "text-orange-500"
                : isComplete
                  ? "text-foreground/70"
                  : "text-muted-foreground/60",
            ].join(" ")}
          >
            {step.label}
          </span>
        </button>

        {!isLast && (
          <div className="relative mx-2 mt-3 h-[2px] w-8 overflow-hidden rounded-full bg-border">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-orange-500 transition-[width] duration-300 ease-out"
              style={{ width: isComplete ? "100%" : "0%" }}
            />
          </div>
        )}
      </div>
    );
  })}
</div>
```

---

## Dialog Layout

### Container

```tsx
<DialogContent className="aspect-[1.618/1] max-w-[80vw] max-h-[95vh] overflow-y-auto px-4 py-8">
  <DialogTitle className="sr-only">{title}</DialogTitle>

  <div className="mx-auto max-w-xl space-y-8 py-4">
    {/* 1. Step indicator */}
    {/* 2. Title + description */}
    {/* 3. Step content */}
    {/* 4. Navigation footer */}
  </div>
</DialogContent>
```

The golden ratio aspect (`1.618/1`) gives the dialog a naturally proportioned canvas. `max-w-xl` on the inner wrapper prevents content from stretching too wide on large viewports.

### Title Block

```tsx
<div className="space-y-2 text-center">
  <h3 className="text-3xl font-semibold tracking-tight text-balance">
    {title}
  </h3>
  <p className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground">
    {description}
  </p>
</div>
```

`text-balance` prevents widowed words on short titles. Keep descriptions under 120 characters so they sit in 2 lines at most.

---

## Selection Cards

Step 0 typically asks the user to choose a mode (e.g. "normal folder" vs "data folder"). Use tappable cards with a custom radio indicator.

### States

| State | Border | Background | Shadow |
|---|---|---|---|
| Selected | `border-orange-500` | `bg-background` | `shadow-[0_0_0_3px_rgba(249,115,22,0.08)]` |
| Unselected | `border-border` | `bg-background` | none |
| Unselected hover | `hover:border-orange-200` | `hover:bg-orange-50/20` | none |
| Press | `active:scale-[0.98]` | — | — |

```tsx
<button
  className={`rounded-xl border p-5 text-left transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none ${
    isSelected
      ? "border-orange-500 bg-background shadow-[0_0_0_3px_rgba(249,115,22,0.08)]"
      : "border-border bg-background hover:border-orange-200 hover:bg-orange-50/20 dark:hover:border-orange-900/60"
  }`}
>
```

### Custom radio dot

```tsx
<div
  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150 ${
    isSelected ? "border-orange-500" : "border-stone-300"
  }`}
>
  {isSelected && <div className="h-2 w-2 rounded-full bg-orange-500" />}
</div>
```

The outer ring and inner dot transition independently (`transition-colors`) so the border color and fill animate at the same rate without scaling artefacts.

---

## Navigation Footer

The footer sits at the bottom of the dialog, separated from content by a border.

### Layout

Left side: **secondary actions** (back + cancel). Right side: **primary action** (continue or save).

```tsx
<div className="flex flex-col gap-3 border-t pt-5">
  {/* Validation hint — only visible when blocked */}
  {!canAdvance && !isLastStep && (
    <p className="text-center text-xs text-muted-foreground">
      {validationMessage}
    </p>
  )}

  <div className="flex items-center justify-between gap-4">
    {/* Secondary actions */}
    <div className="flex items-center gap-1">
      {step > 0 && (
        <Button variant="ghost" size="sm" onClick={goBack}>
          ← Volver
        </Button>
      )}
      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={cancel}>
        Cancelar
      </Button>
    </div>

    {/* Primary action */}
    {!isLastStep ? (
      <Button
        onClick={advance}
        disabled={!canAdvance}
        className="bg-orange-500 hover:bg-orange-600 active:scale-[0.97] transition-transform"
        data-testid="wizard-continue"
      >
        Continuar
      </Button>
    ) : (
      <Button
        onClick={save}
        disabled={isSaving}
        className="bg-orange-500 hover:bg-orange-600 active:scale-[0.97] transition-transform"
        data-testid="wizard-save"
      >
        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Guardar
      </Button>
    )}
  </div>
</div>
```

### Rules

- **Validation hint** is hidden when the step is valid. It appears inline, centered, in `text-xs` — it should not compete with the title.
- **Back** uses `← Volver` with the arrow prefix. This is faster to parse than an icon-only button.
- **Cancel** is always available but styled `text-muted-foreground` so it reads as low-risk.
- **Continue / Save** uses `active:scale-[0.97] transition-transform`. The scale confirms the press immediately — the UI hears you.
- Never use `px-8` padding on the primary button. Let the button size itself naturally with the default `Button` padding.

---

## Step Data Shape

Define step metadata as a `useMemo` array, not scattered `if/else` chains. This keeps titles, descriptions, and labels co-located:

```ts
const steps = useMemo(
  () =>
    mode === "data"
      ? [
          { label: "Base",     title: "Defini la carpeta",    description: "..." },
          { label: "Captura",  title: "Explica que entra",    description: "..." },
          { label: "Campos",   title: "Diseña el resultado",  description: "..." },
          { label: "Revisión", title: "Revisa antes de guardar", description: "..." },
        ]
      : [
          { label: "Base",     title: "Defini la carpeta",    description: "..." },
          { label: "Revisión", title: "Revisa antes de guardar", description: "..." },
        ],
  [mode]
);

const lastStep = steps.length - 1;
const isReviewStep = currentStep === lastStep;
const currentMeta = steps[currentStep] ?? steps[0];
```

---

## Transition Timing Reference

| Element | Duration | Easing | Property |
|---|---|---|---|
| Step circle state change | `200ms` | `ease` (Tailwind default) | `all` |
| Step label color | `200ms` | `ease` | `color` |
| Connector fill | `300ms` | `ease-out` | `width` |
| Selection card | `150ms` | default | `all` |
| Primary button press | n/a (CSS) | — | `transform scale(0.97)` |

Keep all step-indicator transitions at or under 300ms. The wizard is used multiple times per session — fast transitions reduce perceived friction.

---

## Review Step

The last step is always a summary — no inputs, read-only. Use a bordered table layout:

```tsx
<div className="overflow-hidden rounded-3xl border bg-background">
  <div className="grid grid-cols-[180px_1fr] border-b px-5 py-4 text-sm">
    <span className="uppercase tracking-[0.16em] text-muted-foreground">Tipo</span>
    <span className="font-medium">{value}</span>
  </div>
  {/* ... more rows */}
</div>
```

- `grid-cols-[180px_1fr]` keeps the label column fixed regardless of content length.
- `border-b` on every row except the last.
- Use `font-mono` for paths and IDs.

---

## Accessibility Checklist

- `<DialogTitle>` is always rendered, even if `sr-only` when the visual title is in the form body.
- Step buttons have `aria-current="step"` on the active step.
- Step buttons have `aria-label="Paso N: Label"` for screen readers.
- `disabled` nodes have `cursor-default` (not `cursor-not-allowed`) since they're not errors — they're just not yet reachable.
- Validation hints appear as visible text, never as tooltip-only messages.
