# Document Workbench

Use this pattern for document review screens where users browse generated files, group them by work/package, preview one document, and mark workflow state.

The visual model is a cold administrative desk: neutral table surface, physical sheets, trays, compact controls, and restrained orange as a signal.

## Color Tokens

Core surfaces:

- `--doc-canvas`: `#eef0f2` for the full screen work surface.
- `--doc-panel`: `#f8fafc` for raised bands, headers, and form areas.
- `--doc-panel-muted`: `#f3f4f5` for soft section gradients.
- `--doc-modal-chrome`: `#f6f7f9` for preview modal shell.
- `--doc-modal-bar`: `#fbfcfd` for modal header/footer bars.
- `--doc-viewer-surface`: `#eef0f3` for the modal document viewing well.
- `--doc-thumbnail-well`: `#e4e7eb` for document thumbnail trays.
- `--doc-paper`: `#ffffff` for physical document/page surfaces.

Borders:

- `--doc-border`: `#d7dce2` for primary container borders.
- `--doc-border-soft`: `#d9dee5` for internal dividers and stats.
- `--doc-border-hover`: `#c8d0da` for paper/card hover.
- `--doc-rule`: `#cfd6df` for fine paper preview rules.
- `--doc-hairline`: `#00000012` for subtle button outlines.
- `--doc-inset-dark`: `#0000001f` for inset bottom edge.

Text:

- `--doc-text`: `#1f2937` for titles and primary labels.
- `--doc-text-secondary`: `#334155` for icons, subtitles, and control text.
- `--doc-text-muted`: `#64748b` for metadata.
- `--doc-text-disabled`: `#94a3b8` for placeholders and empty states.

Accent:

- `--doc-accent`: `#ff5800` for document status rails, section icons, focus rings, and brand signal only.
- `--doc-status-resolved`: emerald scale for resolved/approved state, used sparingly.

## Radius Tokens

- `--doc-radius-section`: `8px` for top-level panels, type groups, work folders, search bars, and modal shell when not using library defaults.
- `--doc-radius-control`: `8px` for active segmented controls and document list buttons.
- `--doc-radius-paper`: `4px` for paper previews and physical sheets.
- `--doc-radius-document`: `12px` for rendered document pages inside the preview modal.
- `--doc-radius-pill`: use only for small utility controls where a pill is intentional, such as download or circular icon controls.

Avoid bubble-like large radii on administrative panels. Use `rounded-lg` as the default ceiling.

## Spacing And Layout

Screen:

- Root: `min-height: calc(100dvh - 1px)`, `space-y: 20px`, horizontal padding `16px` mobile and `24px` desktop.
- Top summary band: two-column desktop grid, `1fr / 320px`; single column on smaller screens.
- Summary content: `20px` padding, `20px` grid gap.
- Stats: compact 3-column grid, `8px` gap, max width around `500px`.
- Search/action row: `20px` horizontal padding, `16px` vertical padding, stacked on mobile, row on desktop.

Grouped document area:

- Type group: full-width section, `12px` padding, `16px` vertical rhythm between work groups.
- Type group header: `16px` horizontal by `12px` vertical padding, flex-wrap.
- Work folder: `12px` padding and a large intentional header-to-content gap where the folder visual creates the desk/tray feel.
- Document card grid: `12px` gap, `2` columns at small widths, `3` at xl, `4` at 2xl.
- Document cards: max width about `320px`, `12px` internal padding.

Preview modal:

- Modal size: `min(1180px, 96vw)` wide and `94dvh` high.
- Modal layout: header `64px`, content flex/grid, footer `56px`.
- Content grid: `220px` document navigation sidebar plus flexible viewer.
- Viewer well: scrollable, `16px` to `20px` padding.
- Rendered page: centered, intrinsic min width around `520px`, white paper surface.
- Modal sidebar: document navigation only, no dead tabs or no-op toggles.

## Elevation Tokens

Desk panels:

```css
--doc-shadow-panel: 0 18px 36px -30px rgba(15, 23, 42, 0.65),
  inset 0 1px 0 rgba(255, 255, 255, 0.9);
```

Group container:

```css
--doc-shadow-group: 0 20px 38px -34px rgba(15, 23, 42, 0.75),
  inset 0 1px 0 rgba(255, 255, 255, 0.85);
```

Document cards:

```css
--doc-shadow-card-rest: var(--shadow-card);
--doc-shadow-card-hover: 0 16px 26px -18px rgba(15, 23, 42, 0.5),
  inset 0 1px 0 rgba(255, 255, 255, 0.98);
```

Document preview page:

```css
--doc-shadow-page: 0 20px 60px rgba(15, 23, 42, 0.1);
```

Modal shell:

```css
--doc-shadow-modal: 0 30px 90px rgba(15, 23, 42, 0.28);
```

Active 3D control:

```css
--doc-shadow-active: 0 1px 0 0 #fff inset,
  0 -1px 0 0 #0000001f inset,
  0 0 0 1px #00000012,
  0 2px 2px 0 #0b090c0d,
  0 1px 1px 0 #0b090c0f,
  0 5px 8px -7px #0b090c08;
```

Active 3D control pressed:

```css
--doc-shadow-active-pressed: 0 1px 0 0 #fff inset,
  0 0 0 1px #00000012,
  0 1px 1px 0 #0b090c0f,
  0 3px 6px -6px #0b090c14;
```

Use active 3D elevation only for selected state or workflow state. Do not apply it to every toolbar button.

## Control Hierarchy

Selected and stateful:

- Use `sidebarMenuButtonVariants`.
- Set `data-active=true` for selected document rows and active segmented toggles.
- Resting state uses the active 3D shadow.
- Press moves only `1px`.

Viewer chrome:

- Use almost-flat controls.
- They share radius and border language, but use lower elevation than stateful controls.
- Good for zoom, close, and previous/next controls.
- Suggested base:

```css
--doc-viewer-control: transition background-color, box-shadow, transform, color 150ms;
```

Workflow checkbox:

- Do not wrap the checkbox in a raised button.
- The checkbox itself gets the active 3D shadow and a `-1px` resting offset.
- Press compresses to neutral translation and swaps to the pressed shadow.
- Label remains plain text.

Utility actions:

- Download and refresh are secondary actions.
- Use white or near-white surface, small border, compact height, and low shadow.
- They should be more visible than viewer chrome but less important than selected state.

## Typography Tokens

- Screen heading: `20px`, semibold, tight tracking.
- Group heading: `18px`, semibold.
- Card title: `14px`, semibold, tight line-height.
- Labels: `10px` to `11px`, uppercase, `0.16em` to `0.2em` tracking.
- Metadata: `11px` to `12px`, muted color.
- Counters and dates: monospace, `11px` to `20px` depending on emphasis.

Do not use hero-scale type inside this pattern. The UI should feel like an everyday administrative tool.

## Interaction Tokens

- Card hover: translate up `2px` max, never more.
- Active push controls: `1px` translate only.
- Viewer controls: `1px` press, no hover lift unless necessary.
- Folder illustration hover may use larger document movement because it is decorative and isolated.
- Transitions: `150ms` for toolbar controls, `250ms` for button hover polish, `34ms` for tactile press.
- Easing for push controls: `cubic-bezier(0.3, 0.7, 0.4, 1)` and hover variant `cubic-bezier(0.3, 0.7, 0.4, 1.5)`.

## Composition Rules

- The page should read as layers resting on a desk: canvas, panels, folders, papers, controls.
- Avoid nested cards unless the inner item is a repeated document/card.
- Keep orange as signal, not surface.
- Keep the preview modal as a reader: sidebar for navigation, center well for paper, footer for view controls, header for document identity and utility actions.
- Do not include controls that do nothing.
- If a control changes workflow state, make it stateful and tactile.
- If a control only manipulates the view, make it shallow and quiet.
