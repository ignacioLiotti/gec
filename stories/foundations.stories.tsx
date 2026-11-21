import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { tokens } from "@/design-system/tokens";
import { Button } from "@/components/ui/button";

const meta = { title: "Foundations/Tokens", tags: ["autodocs"] } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const colors = [
  "background",
  "foreground",
  "canvas",
  "canvas-muted",
  "surface",
  "surface-muted",
  "surface-raised",
  "surface-recessed",
  "surface-warm",
  "surface-glass",
  "content",
  "content-secondary",
  "content-muted",
  "content-disabled",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "orange-primary",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-soft",
  "accent-border",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "success",
  "success-foreground",
  "warning",
  "warning-foreground",
  "border",
  "border-soft",
  "border-strong",
  "input",
  "ring",
  "table-row-alt",
  "table-row-hover",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
];

function ColorTokens() {
  const [values, setValues] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    const read = () => {
      const css = getComputedStyle(document.documentElement);
      setValues(
        Object.fromEntries(
          colors.map((name) => [
            name,
            css.getPropertyValue(`--${name}`).trim(),
          ]),
        ),
      );
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);
  return (
    <div className="sb-grid">
      {colors.map((name) => {
        const raw = values[name] || "";
        const color = /^[-\d.]+\s/.test(raw) ? `hsl(${raw})` : raw;
        return (
          <div key={name} className="sb-sample">
            <div
              className="h-16 w-full rounded-md border border-stroke"
              style={{ background: color }}
            />
            <code className="sb-caption">--{name}</code>
            <code className="sb-caption">{raw || "Not defined"}</code>
          </div>
        );
      })}
    </div>
  );
}

export const Colors: Story = { render: () => <ColorTokens /> };
export const Spacing: Story = {
  render: () => (
    <div className="sb-stack">
      {Object.entries(tokens.spacing).map(([name, value]) => (
        <div key={name} className="sb-row">
          <code>
            {name}: {value}
          </code>
          <div className="h-4 bg-orange-primary" style={{ width: value }} />
        </div>
      ))}
    </div>
  ),
};
export const Radius: Story = {
  render: () => (
    <div className="sb-row">
      {Object.entries(tokens.radius).map(([name, value]) => (
        <div
          key={name}
          className="sb-sample bg-surface"
          style={{ borderRadius: value }}
        >
          {name}
          <code>{value}</code>
        </div>
      ))}
    </div>
  ),
};
export const Shadows: Story = {
  render: () => (
    <div className="sb-grid">
      {Object.entries(tokens.shadow).map(([name, value]) => (
        <div
          key={name}
          className="sb-sample bg-surface"
          style={{ boxShadow: value }}
        >
          {name}
          <code className="sb-caption">{value}</code>
        </div>
      ))}
    </div>
  ),
};
export const Typography: Story = {
  render: () => (
    <div className="sb-stack">
      <h2>Product typography</h2>
      {[
        "text-xs",
        "text-sm",
        "text-base",
        "text-lg",
        "text-xl",
        "text-2xl",
        "text-3xl",
      ].map((size) => (
        <p key={size} className={size}>
          {size} · Contract ready for review
        </p>
      ))}
      <p className="font-mono">Geist Mono · DOC-001 / 0123456789</p>
      <p style={{ fontFamily: "var(--font-geist-serif)" }}>
        Playfair Display · Document heading
      </p>
      <h2>Shared TypeScript scale</h2>
      {Object.entries(tokens.typography.size).map(([name, value]) => (
        <p key={name} style={{ fontSize: value }}>
          {name} · {value} · Contract ready for review
        </p>
      ))}
      {Object.entries(tokens.typography.lineHeight).map(([name, value]) => (
        <p key={name} style={{ lineHeight: value }}>
          {name} line height · {value}
          <br />
          Second line of document text.
        </p>
      ))}
    </div>
  ),
};
export const Motion: Story = {
  render: () => (
    <div className="sb-stack">
      {Object.entries(tokens.motion.duration).map(([name, value]) => (
        <div key={name} className="sb-row">
          <code>
            {name}: {value}
          </code>
          <Button style={{ transitionDuration: value }}>Hover or press</Button>
        </div>
      ))}
      {Object.entries(tokens.motion.easing).map(([name, value]) => (
        <code key={name}>
          {name}: {value}
        </code>
      ))}
    </div>
  ),
};
export const LayersAndBreakpoints: Story = {
  render: () => (
    <div className="sb-grid">
      {[tokens.zIndex, tokens.breakpoint].map((group, i) => (
        <div key={i} className="sb-stack">
          <h2>{i === 0 ? "Layer order" : "Breakpoints"}</h2>
          {Object.entries(group).map(([name, value]) => (
            <code key={name}>
              {name}: {value}
            </code>
          ))}
        </div>
      ))}
    </div>
  ),
};
export const Surfaces: Story = {
  render: () => (
    <div className="sb-grid">
      {[
        "bg-canvas",
        "bg-canvas-muted",
        "bg-surface",
        "bg-surface-muted",
        "bg-surface-raised",
        "bg-surface-recessed",
        "bg-surface-warm",
        "bg-surface-glass",
        "bg-card",
      ].map((surface) => (
        <div key={surface} className={`sb-sample ${surface}`}>
          <code>{surface}</code>
          <p className="text-content">Main content</p>
          <p className="text-content-secondary">Secondary content</p>
          <p className="text-content-muted">Muted content</p>
          <p className="text-content-disabled">Disabled content</p>
        </div>
      ))}
    </div>
  ),
};
