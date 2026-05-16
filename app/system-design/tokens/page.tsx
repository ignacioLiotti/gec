'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, CheckCircle2, Copy, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (v: string) => {
    navigator.clipboard.writeText(v);
    setCopied(v);
    setTimeout(() => setCopied(null), 1400);
  };
  return { copy, copied };
}

function CopyButton({ value }: { value: string }) {
  const { copy, copied } = useCopy();
  return (
    <button
      type="button"
      onClick={() => copy(value)}
      className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
    >
      {copied === value ? (
        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3 text-stone-400 hover:text-stone-700" />
      )}
    </button>
  );
}

function Flag({ type, children }: { type: 'error' | 'warn' | 'info'; children: React.ReactNode }) {
  const cfg = {
    error: { cls: 'border-red-200 bg-red-50 text-red-700', Icon: XCircle },
    warn: { cls: 'border-amber-200 bg-amber-50 text-amber-700', Icon: AlertTriangle },
    info: { cls: 'border-blue-200 bg-blue-50 text-blue-700', Icon: Info },
  }[type];
  const Icon = cfg.Icon;
  return (
    <div className={cn('flex items-start gap-2 rounded-lg border p-3 text-xs leading-relaxed', cfg.cls)}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function SectionHeader({ id, title, sub }: { id?: string; title: string; sub?: string }) {
  return (
    <div id={id} className="mb-5">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {sub && <p className="mt-0.5 text-sm text-stone-500">{sub}</p>}
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]', className)}>
      {children}
    </div>
  );
}

// ─── 1. COLOR TOKENS ──────────────────────────────────────────────────────────

const CSS_VARS = [
  { name: '--background', light: 'oklch(0.975 0 106)', dark: 'oklch(0.145 0 0)', preview: 'bg-background', desc: 'App background' },
  { name: '--foreground', light: 'oklch(0.145 0 0)', dark: 'oklch(0.985 0 0)', preview: 'bg-foreground', desc: 'Default text' },
  { name: '--card', light: '#ffffff', dark: 'oklch(0.205 0 0)', preview: 'bg-card', desc: 'Card surface' },
  { name: '--primary', light: '#444444', dark: 'oklch(0.922 0 0)', preview: 'bg-primary', desc: '⚠ Button primary (dark gray — not the brand orange)' },
  { name: '--primary-foreground', light: 'oklch(0.985 0 0)', dark: 'oklch(0.145 0 0)', preview: 'bg-primary-foreground', desc: 'Text on primary' },
  { name: '--secondary', light: 'oklch(0.97 0 0)', dark: 'oklch(0.269 0 0)', preview: 'bg-secondary', desc: 'Secondary surface' },
  { name: '--muted', light: 'oklch(0.905 0 106)', dark: 'oklch(0.269 0 0)', preview: 'bg-muted', desc: 'Muted background' },
  { name: '--muted-foreground', light: 'oklch(0.556 0 0)', dark: 'oklch(0.708 0 0)', preview: 'bg-muted-foreground', desc: 'Secondary text — ~120 uses' },
  { name: '--accent', light: 'oklch(0.97 0 0)', dark: 'oklch(0.269 0 0)', preview: 'bg-accent', desc: 'Accent/hover surface' },
  { name: '--destructive', light: 'oklch(0.577 0.245 27)', dark: 'oklch(0.704 0.191 22)', preview: 'bg-destructive', desc: 'Error / danger' },
  { name: '--border', light: 'oklch(0.17 0.01 0 / 8%)', dark: 'oklch(1 0 0 / 10%)', preview: 'bg-border', desc: 'Default border' },
  { name: '--ring', light: 'oklch(0.708 0 0)', dark: 'oklch(0.556 0 0)', preview: 'bg-ring', desc: 'Focus ring' },
];

const BRAND_COLORS = [
  { name: 'orange-primary', value: '#ff5800', tw: 'bg-[#ff5800]', usage: '~40 uses — accent, charts, active states' },
  { name: 'stone-900', value: '#1c1917', tw: 'bg-stone-900', usage: 'Headers, dark text' },
  { name: 'stone-500', value: '#78716c', tw: 'bg-stone-500', usage: 'Secondary text — conflicts with muted-foreground' },
  { name: 'stone-200', value: '#e7e5e4', tw: 'bg-stone-200', usage: 'Borders — conflicts with --border token' },
  { name: 'stone-100', value: '#f5f5f4', tw: 'bg-stone-100', usage: 'Hover states, light backgrounds' },
];

const HARDCODED_COLORS = [
  { hex: '#d5d8df', uses: 25, context: 'border-light — report tables, form inputs' },
  { hex: '#2b2f36', uses: 15, context: 'text-dark — report typography' },
  { hex: '#7a8088', uses: 5, context: 'text-muted — report captions' },
  { hex: '#f7f7f8', uses: 10, context: 'bg-light — report surfaces' },
  { hex: '#f0efea', uses: 8, context: 'sidebar background' },
];

function ColorsSection() {
  return (
    <div className="space-y-6">
      <Card>
        <h3 className="mb-4 text-sm font-semibold">CSS Variables (Design Tokens)</h3>
        <div className="divide-y divide-stone-100">
          {CSS_VARS.map((v) => (
            <div key={v.name} className="group flex items-center gap-4 py-2.5">
              <div className={cn('h-8 w-8 shrink-0 rounded-lg border border-stone-200', v.preview)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <code className="text-xs font-mono font-semibold text-stone-800">{v.name}</code>
                  <CopyButton value={v.name} />
                </div>
                <div className="mt-0.5 text-[10px] text-stone-400 truncate">{v.desc}</div>
              </div>
              <div className="hidden text-right lg:block">
                <div className="text-[10px] font-mono text-stone-500">{v.light}</div>
                <div className="text-[10px] text-stone-300">dark: {v.dark}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          <Flag type="error">
            <strong>Dos colores primarios:</strong> --primary (#444444) es el botón oscuro, pero --orange-primary (#ff5800) es el
            accent de marca. No hay un "primary" único — confunde a quien implementa componentes nuevos.
          </Flag>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-sm font-semibold">Brand / Direct Tailwind Colors</h3>
          <div className="space-y-2">
            {BRAND_COLORS.map((c) => (
              <div key={c.name} className="group flex items-center gap-3">
                <div className={cn('h-6 w-6 shrink-0 rounded-md border border-stone-200', c.tw)} />
                <code className="w-28 text-xs font-mono text-stone-700">{c.name}</code>
                <span className="text-[10px] text-stone-400 truncate">{c.usage}</span>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Flag type="warn">
              Uso mezclado: <code>text-muted-foreground</code> (semántico) y <code>text-stone-500</code> (directo) se usan para el mismo
              propósito. Consolidar a CSS vars.
            </Flag>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-sm font-semibold">Hardcoded Hex ⚠ (~58 instancias)</h3>
          <div className="space-y-2">
            {HARDCODED_COLORS.map((c) => (
              <div key={c.hex} className="group flex items-center gap-3">
                <div className="h-6 w-6 shrink-0 rounded-md border border-stone-200" style={{ background: c.hex }} />
                <code className="w-20 text-xs font-mono text-stone-700">{c.hex}</code>
                <span className="text-[10px] text-stone-400">{c.uses}x</span>
                <span className="text-[10px] text-stone-400 truncate">{c.context}</span>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Flag type="error">
              Todos estos viven en report styling. Extraer a un <code>report.css</code> o CSS vars de reporte (<code>--report-bg</code>,{' '}
              <code>--report-border</code>, etc.) para aislarlos del sistema principal.
            </Flag>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── 2. TYPOGRAPHY ────────────────────────────────────────────────────────────

const TYPE_SCALE = [
  { cls: 'text-xs', px: '12px', uses: 464, sample: 'Badge · Caption · Table header' },
  { cls: 'text-sm', px: '14px', uses: 349, sample: 'UI text · Labels · Button text' },
  { cls: 'text-base', px: '16px', uses: 70, sample: 'Body copy' },
  { cls: 'text-lg', px: '18px', uses: 186, sample: 'Section title' },
  { cls: 'text-xl', px: '20px', uses: 116, sample: 'Page subtitle' },
  { cls: 'text-2xl', px: '24px', uses: 70, sample: 'Page title' },
  { cls: 'text-3xl', px: '30px', uses: 93, sample: 'Display heading' },
  { cls: 'text-4xl', px: '36px', uses: 12, sample: 'Hero' },
];

const ARBITRARY_SIZES = [
  { cls: 'text-[7px]', uses: 3, problem: 'Demasiado pequeño para ser legible' },
  { cls: 'text-[8px]', uses: 5, problem: 'Legibilidad dudosa' },
  { cls: 'text-[9px]', uses: 4, problem: 'Legibilidad dudosa' },
  { cls: 'text-[10px]', uses: 28, problem: 'Muy común — debería ser text-xs o nuevo token' },
  { cls: 'text-[11px]', uses: 18, problem: 'Entre xs y sm — candidato a nuevo token text-2xs' },
  { cls: 'text-[13px]', uses: 12, problem: 'Entre xs y sm — debería ser text-xs o text-sm' },
];

const WEIGHT_SCALE = [
  { cls: 'font-normal', uses: 116, desc: 'Texto de cuerpo, muted' },
  { cls: 'font-medium', uses: 577, desc: 'Texto UI default — el más común' },
  { cls: 'font-semibold', uses: 696, desc: 'Headers, badges, énfasis' },
  { cls: 'font-bold', uses: 186, desc: 'Énfasis fuerte, some titles' },
  { cls: 'font-mono', uses: 85, desc: 'Números, código, valores monetarios' },
];

const TRACKING_SCALE = [
  { cls: 'tracking-tight', tw: '-0.025em', uses: 25, desc: 'Headings grandes' },
  { cls: 'tracking-normal', tw: '0em', uses: 'default', desc: 'Default' },
  { cls: 'tracking-wide', tw: '0.025em', uses: 186, desc: 'Labels uppercase' },
  { cls: 'tracking-wider', tw: '0.05em', uses: 70, desc: 'Captions' },
  { cls: 'tracking-widest', tw: '0.1em', uses: 116, desc: 'Column headers small' },
  { cls: 'tracking-[0.18em]', tw: '0.18em', uses: 8, problem: 'Arbitrario — consolidar a widest' },
  { cls: 'tracking-[0.2em]', tw: '0.2em', uses: 6, problem: 'Arbitrario' },
  { cls: 'tracking-[0.22em]', tw: '0.22em', uses: 4, problem: 'Arbitrario' },
];

function TypographySection() {
  return (
    <div className="space-y-6">
      <Card>
        <h3 className="mb-1 text-sm font-semibold">Type Scale</h3>
        <p className="mb-4 text-xs text-stone-400">Frecuencias reales del codebase</p>
        <div className="divide-y divide-stone-100">
          {TYPE_SCALE.map((t) => (
            <div key={t.cls} className="group flex items-baseline gap-4 py-3">
              <code className="w-20 shrink-0 text-[10px] font-mono text-stone-400">{t.cls}</code>
              <span className="w-10 shrink-0 text-[10px] text-stone-300">{t.px}</span>
              <span className={cn('flex-1 text-stone-800', t.cls)}>{t.sample}</span>
              <span className="shrink-0 text-[10px] tabular-nums text-stone-300">{t.uses}×</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-red-600">Tamaños Arbitrarios ⚠ (~76 instancias)</h3>
          <div className="divide-y divide-stone-100">
            {ARBITRARY_SIZES.map((t) => (
              <div key={t.cls} className="py-2.5">
                <div className="flex items-center justify-between">
                  <code className="text-xs font-mono font-semibold text-red-700">{t.cls}</code>
                  <span className="text-[10px] text-stone-400">{t.uses} usos</span>
                </div>
                <p className="mt-0.5 text-[10px] text-stone-500">{t.problem}</p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Flag type="error">
              20+ tamaños arbitrarios fragmentan la escala. La mayoría viene del report generator. Propuesta: agregar <code>text-2xs</code> (10–11px) al
              config de Tailwind y extraer el resto a <code>report.css</code>.
            </Flag>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <h3 className="mb-3 text-sm font-semibold">Font Weight</h3>
            <div className="divide-y divide-stone-100">
              {WEIGHT_SCALE.map((w) => (
                <div key={w.cls} className="flex items-center gap-4 py-2">
                  <span className={cn('w-32 shrink-0 text-sm text-stone-800', w.cls)}>Texto ejemplo</span>
                  <code className="w-28 text-[10px] font-mono text-stone-500">{w.cls}</code>
                  <span className="flex-1 text-[10px] text-stone-400">{w.desc}</span>
                  <span className="text-[10px] tabular-nums text-stone-300">{w.uses}×</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-semibold">Letter Spacing</h3>
            <div className="divide-y divide-stone-100">
              {TRACKING_SCALE.map((t) => (
                <div key={t.cls} className="py-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <code className={cn('text-xs font-mono', t.problem ? 'text-red-600' : 'text-stone-700')}>{t.cls}</code>
                      {t.problem && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                    </span>
                    <span className="text-[10px] tabular-nums text-stone-300">{t.uses}×</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-stone-400">{t.problem ?? t.desc}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── 3. SPACING ───────────────────────────────────────────────────────────────

const SPACING_SCALE = [
  { val: '0', px: '0px', count: '—' },
  { val: '0.5', px: '2px', count: 45 },
  { val: '1', px: '4px', count: 120 },
  { val: '1.5', px: '6px', count: 88 },
  { val: '2', px: '8px', count: 310 },
  { val: '2.5', px: '10px', count: 55 },
  { val: '3', px: '12px', count: 220 },
  { val: '3.5', px: '14px', count: 30 },
  { val: '4', px: '16px', count: 466 },
  { val: '5', px: '20px', count: 140 },
  { val: '6', px: '24px', count: 280 },
  { val: '7', px: '28px', count: 25 },
  { val: '8', px: '32px', count: 110 },
  { val: '10', px: '40px', count: 65 },
  { val: '12', px: '48px', count: 40 },
  { val: '16', px: '64px', count: 30 },
];

const ARBITRARY_SPACING = [
  { cls: 'gap-[14px]', should: 'gap-3.5', uses: 8 },
  { cls: 'p-[12px]', should: 'p-3', uses: 12 },
  { cls: 'gap-[10px]', should: 'gap-2.5', uses: 6 },
  { cls: 'gap-[8px]', should: 'gap-2', uses: 4 },
  { cls: 'mt-[18px]', should: 'mt-4 or mt-5', uses: 3 },
  { cls: 'px-[14px]', should: 'px-3.5', uses: 5 },
];

function SpacingSection() {
  return (
    <div className="space-y-6">
      <Card>
        <h3 className="mb-1 text-sm font-semibold">Spacing Scale (4px grid)</h3>
        <p className="mb-4 text-xs text-stone-400">Tailwind default — unidades más usadas destacadas</p>
        <div className="flex flex-wrap gap-3">
          {SPACING_SCALE.map((s) => {
            const px = parseInt(s.px);
            const isFrequent = typeof s.count === 'number' && s.count > 200;
            return (
              <div key={s.val} className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'rounded border',
                    isFrequent ? 'border-orange-300 bg-orange-100' : 'border-stone-200 bg-stone-100',
                  )}
                  style={{ width: Math.max(px, 8) + 16, height: Math.max(px, 8) + 16 }}
                />
                <code className="text-[9px] font-mono text-stone-500">{s.val}</code>
                <span className="text-[9px] text-stone-400">{s.px}</span>
                {typeof s.count === 'number' && (
                  <span className={cn('text-[9px] tabular-nums', isFrequent ? 'text-orange-600 font-semibold' : 'text-stone-300')}>
                    {s.count}×
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[10px] text-stone-400">Naranja = más de 200 usos en el codebase</p>
      </Card>

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-amber-600">Spacing Arbitrario fuera del grid (~40 instancias)</h3>
        <div className="divide-y divide-stone-100">
          {ARBITRARY_SPACING.map((s) => (
            <div key={s.cls} className="flex items-center gap-4 py-2.5">
              <code className="w-28 text-xs font-mono font-semibold text-red-600">{s.cls}</code>
              <span className="text-[10px] text-stone-400">→ debería ser</span>
              <code className="text-xs font-mono text-emerald-600">{s.should}</code>
              <span className="ml-auto text-[10px] tabular-nums text-stone-300">{s.uses}×</span>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Flag type="warn">
            La mayoría del spacing arbitrario tiene equivalente Tailwind exacto. Reemplazables con un find/replace. Los que no tienen equivalente
            exacto (ej. valores impares) deben documentarse como excepciones justificadas.
          </Flag>
        </div>
      </Card>
    </div>
  );
}

// ─── 4. BORDER RADIUS ─────────────────────────────────────────────────────────

const RADIUS_SCALE = [
  { cls: 'rounded-none', px: '0px', uses: 45, context: 'Tables, full-bleed' },
  { cls: 'rounded-sm', px: '2px', uses: 70, context: 'Tight items, sheet buttons' },
  { cls: 'rounded', px: '4px', uses: 55, context: 'Sparse usage' },
  { cls: 'rounded-md', px: '6px', uses: 811, context: '⭐ Más usado — buttons, inputs, most UI' },
  { cls: 'rounded-lg', px: '8px', uses: 348, context: 'Cards, popovers, larger containers' },
  { cls: 'rounded-xl', px: '12px', uses: 186, context: 'Hero cards, event calendar, system-design' },
  { cls: 'rounded-2xl', px: '16px', uses: 70, context: 'Modals, large overlays' },
  { cls: 'rounded-3xl', px: '24px', uses: 45, context: 'Event calendar day cells, large frames' },
  { cls: 'rounded-full', px: '9999px', uses: 279, context: 'Badges, avatars, pill chips' },
];

function RadiusSection() {
  return (
    <div className="space-y-6">
      <Card>
        <h3 className="mb-1 text-sm font-semibold">Border Radius Scale</h3>
        <p className="mb-4 text-xs text-stone-400">
          La base es <code>--radius: 0.375rem (6px)</code> — el Tailwind <code>rounded-md</code>
        </p>
        <div className="space-y-3">
          {RADIUS_SCALE.map((r) => {
            const isTop = r.uses > 200;
            return (
              <div key={r.cls} className="group flex items-center gap-4">
                <div
                  className={cn('h-8 w-8 shrink-0 border-2 border-stone-300 bg-stone-100', r.cls)}
                />
                <code className={cn('w-28 text-xs font-mono font-semibold', isTop ? 'text-orange-600' : 'text-stone-700')}>{r.cls}</code>
                <span className="w-10 text-[10px] text-stone-400">{r.px}</span>
                <span className="flex-1 text-xs text-stone-500">{r.context}</span>
                <span className={cn('text-[10px] tabular-nums', isTop ? 'text-orange-600 font-semibold' : 'text-stone-300')}>{r.uses}×</span>
              </div>
            );
          })}
        </div>
        <div className="mt-5 space-y-2">
          <Flag type="warn">
            <strong>rounded-md es el default de hecho</strong> (811 usos, 35%) pero es 6px —
            confusamente nombrado. Documentarlo explícitamente como &quot;el radio estándar de UI&quot;.
          </Flag>
          <Flag type="info">
            Hay inconsistencia en contextos similares: algunos cards usan <code>rounded-lg</code>, otros
            <code>rounded-xl</code>, otros <code>rounded-2xl</code>. Propuesta: cards = xl, overlays = 2xl, UI controls = md.
          </Flag>
        </div>
      </Card>
    </div>
  );
}

// ─── 5. SHADOWS ───────────────────────────────────────────────────────────────

const ELEVATION_PROPOSED = [
  { level: 0, name: 'none', value: 'shadow-none', usage: 'Inline, flat' },
  { level: 1, name: 'xs', value: 'shadow-sm', usage: 'Buttons, chips, inputs' },
  { level: 2, name: 'sm', value: 'shadow-card (CSS var)', usage: 'Cards, panels' },
  { level: 3, name: 'md', value: 'shadow-md', usage: 'Dropdowns, floating badges' },
  { level: 4, name: 'lg', value: 'shadow-lg', usage: 'Popovers, comboboxes' },
  { level: 5, name: 'xl', value: 'shadow-xl', usage: 'Modals, dialogs' },
  { level: 6, name: '2xl', value: 'shadow-2xl', usage: 'Command palette, full-screen overlays' },
];

const ARBITRARY_SHADOWS = [
  { ctx: 'Button default', val: 'shadow-[0px_2px_4px_rgba(0,0,0,0.10),0px_0px_0px_1px_#0D0D0D]' },
  { ctx: 'FormTable input', val: 'shadow-[0_0_0_1px_#00000012,0_1px_0_0_#fff_inset,...]' },
  { ctx: 'Event calendar', val: 'shadow-[0_1px_3px_rgba(15,23,42,0.06),0_14px_34px_rgba(15,23,42,0.06)]' },
  { ctx: 'Popover/Dialog', val: 'shadow-[0_24px_60px_-16px_rgba(15,23,42,0.28),0_0_0_1px_rgba(0,0,0,0.04)]' },
  { ctx: 'Dirty row (table)', val: 'shadow-[inset_0_0_0_2px_rgba(217,119,6,0.85)]' },
  { ctx: 'System-design hero', val: 'shadow-[0_30px_90px_rgba(0,0,0,0.12)]' },
];

function ShadowsSection() {
  return (
    <div className="space-y-6">
      <Card>
        <h3 className="mb-1 text-sm font-semibold">Sistema de Elevación Propuesto</h3>
        <p className="mb-4 text-xs text-stone-400">Actualmente no existe sistema formal. Mapeado a lo más cercano en uso.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ELEVATION_PROPOSED.map((e) => (
            <div key={e.level} className={cn('rounded-xl border border-stone-200 bg-white p-4', e.value.startsWith('shadow-') && !e.value.includes('(') && !e.value.includes('[') ? e.value : '')}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-700">Level {e.level}</span>
                <Badge variant="outline" className="text-[10px]">{e.name}</Badge>
              </div>
              <code className="mt-1 block truncate text-[10px] font-mono text-stone-500">{e.value}</code>
              <p className="mt-1.5 text-[10px] text-stone-400">{e.usage}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-red-600">Sombras Arbitrarias (~25 instancias)</h3>
        <div className="space-y-3">
          {ARBITRARY_SHADOWS.map((s) => (
            <div key={s.ctx} className="rounded-lg border border-stone-100 bg-stone-50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-stone-700">{s.ctx}</span>
              </div>
              <code className="mt-1 block truncate text-[10px] font-mono text-stone-400">{s.val}</code>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          <Flag type="error">
            Cada componente tiene su propia sombra custom. Sin sistema de elevación, cada cambio es manual. Crear{' '}
            <code>shadow-elevation-{'{'}1-6{'}'}</code> como CSS vars y reemplazar los arbitrarios.
          </Flag>
          <Flag type="warn">
            Mezcla de <code>rgba()</code> y hex en el mismo valor de sombra. Elegir uno (rgba o oklch moderno) y estandarizar.
          </Flag>
        </div>
      </Card>
    </div>
  );
}

// ─── 6. Z-INDEX ───────────────────────────────────────────────────────────────

const Z_LAYERS_CURRENT = [
  { z: '0', count: '—', usage: 'Normal flow' },
  { z: '10', count: 8, usage: 'Table sticky headers, calendar columns' },
  { z: '20', count: 12, usage: 'Popovers, floating badges, sticky positioning' },
  { z: '30', count: 4, usage: 'Calendar week view sticky' },
  { z: '40', count: 3, usage: 'Quick actions floating button' },
  { z: '50', count: 30, usage: 'Modals, dialogs, overlays — shadcn default' },
  { z: '100', count: 3, usage: '⚠ Sidebar — más alto que z-50 de modales' },
  { z: '[9999]', count: 1, usage: '⚠ Navigation progress bar — arbitrario' },
  { z: '[10000000]', count: 3, usage: '🔴 Context menus — rompe todo el stacking' },
];

const Z_LAYERS_PROPOSED = [
  { name: 'base', z: 'z-0', usage: 'Contenido normal' },
  { name: 'sticky-low', z: 'z-10', usage: 'Headers sticky de tabla' },
  { name: 'sticky-high', z: 'z-20', usage: 'Sticky con overlap' },
  { name: 'floating', z: 'z-30', usage: 'Badges flotantes, FAB' },
  { name: 'dropdown', z: 'z-40', usage: 'Dropdowns, context menus' },
  { name: 'overlay', z: 'z-50', usage: 'Modals, dialogs, popovers' },
  { name: 'sidebar', z: 'z-60', usage: 'Sidebar (encima de overlays en mobile)' },
  { name: 'notification', z: 'z-70', usage: 'Toast / Sonner' },
  { name: 'progress', z: 'z-80', usage: 'Navigation progress bar' },
];

function ZIndexSection() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-sm font-semibold">Estado Actual</h3>
          <div className="divide-y divide-stone-100">
            {Z_LAYERS_CURRENT.map((l) => {
              const isBad = l.z.includes('[') || l.z === '100';
              return (
                <div key={l.z} className="flex items-center gap-3 py-2.5">
                  <code className={cn('w-20 text-xs font-mono font-semibold', isBad ? 'text-red-600' : 'text-stone-700')}>
                    z-{l.z}
                  </code>
                  <span className="w-8 text-[10px] tabular-nums text-stone-300">
                    {typeof l.count === 'number' ? `${l.count}×` : l.count}
                  </span>
                  <span className="flex-1 text-xs text-stone-500">{l.usage}</span>
                  {isBad && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />}
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-sm font-semibold text-emerald-700">Sistema Propuesto</h3>
          <div className="divide-y divide-stone-100">
            {Z_LAYERS_PROPOSED.map((l) => (
              <div key={l.name} className="flex items-center gap-3 py-2.5">
                <code className="w-12 text-xs font-mono font-semibold text-emerald-600">{l.z}</code>
                <span className="w-24 text-[10px] font-medium text-stone-600">{l.name}</span>
                <span className="flex-1 text-xs text-stone-500">{l.usage}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-2">
        <Flag type="error">
          <strong>z-[10000000]</strong> en context menus rompe completamente el stacking context — cualquier elemento con z-50 va a quedar
          detrás. Reemplazar con <code>z-40</code> dentro del sistema propuesto.
        </Flag>
        <Flag type="error">
          <strong>z-100</strong> en el sidebar (Sidebar component) pone el sidebar encima de todos los modales (z-50). Correcto en mobile
          (drawer), pero incorrecto en desktop donde el sidebar es parte del layout. Separar con media queries.
        </Flag>
      </div>
    </div>
  );
}

// ─── 7. BUTTONS ───────────────────────────────────────────────────────────────

const VARIANTS: Array<{ v: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link'; uses: number; desc: string }> = [
  { v: 'default', uses: 428, desc: 'Dark gradient — acción primaria. El más importante pero no el más usado.' },
  { v: 'outline', uses: 490, desc: 'El más común del proyecto (40%). Borde sutil, background blanco.' },
  { v: 'ghost', uses: 184, desc: 'Sin borde, hover fill. Para acciones secundarias en contextos densos.' },
  { v: 'secondary', uses: 61, desc: 'Light gradient. Poco usado — considerar fusionar con outline.' },
  { v: 'destructive', uses: 25, desc: 'Rojo. Exclusivo para eliminar / acciones destructivas.' },
  { v: 'link', uses: 12, desc: 'Subrayado. Para navegación inline en texto.' },
];

const SIZES: Array<{ s: 'default' | 'sm' | 'lg' | 'xs' | 'icon'; label: string; height: string; uses: number }> = [
  { s: 'default', label: 'Default', height: 'h-9 (36px)', uses: 376 },
  { s: 'sm', label: 'Small', height: 'h-8 (32px)', uses: 251 },
  { s: 'lg', label: 'Large', height: 'h-10 (40px)', uses: 67 },
  { s: 'xs', label: 'XSmall', height: 'h-7 (28px)', uses: 100 },
  { s: 'icon', label: 'Icon', height: 'size-9 (36px)', uses: 42 },
];

function ButtonsSection() {
  return (
    <div className="space-y-6">
      <Card>
        <h3 className="mb-1 text-sm font-semibold">Variants × Sizes Matrix</h3>
        <p className="mb-5 text-xs text-stone-400">Todos los combos renderizados en vivo</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="pb-2 text-left text-[10px] uppercase tracking-wider text-stone-400 w-28">Variant</th>
                {SIZES.map((s) => (
                  <th key={s.s} className="pb-2 text-center text-[10px] uppercase tracking-wider text-stone-400">
                    {s.label}
                    <br />
                    <span className="font-normal normal-case">{s.height}</span>
                  </th>
                ))}
                <th className="pb-2 text-right text-[10px] uppercase tracking-wider text-stone-400">Usos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {VARIANTS.map((variant) => (
                <tr key={variant.v}>
                  <td className="py-3 pr-4 align-middle">
                    <div>
                      <code className="font-mono font-semibold text-stone-700">{variant.v}</code>
                    </div>
                  </td>
                  {SIZES.map((size) => (
                    <td key={size.s} className="py-3 px-2 text-center align-middle">
                      {size.s === 'icon' ? (
                        <Button variant={variant.v} size="icon" className="mx-auto">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </Button>
                      ) : (
                        <Button variant={variant.v} size={size.s} className="mx-auto">
                          Acción
                        </Button>
                      )}
                    </td>
                  ))}
                  <td className="py-3 text-right text-[10px] tabular-nums text-stone-400 align-middle">{variant.uses}×</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h3 className="mb-4 text-sm font-semibold">Análisis de uso</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {VARIANTS.map((v) => (
            <div key={v.v} className="flex items-start gap-3 rounded-xl border border-stone-100 bg-stone-50 p-3">
              <Button variant={v.v} size="sm" className="shrink-0">
                {v.v}
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-stone-700">{v.uses} usos</span>
                  <div className="h-1.5 w-24 rounded-full bg-stone-200">
                    <div
                      className="h-1.5 rounded-full bg-orange-400"
                      style={{ width: `${(v.uses / 490) * 100}%` }}
                    />
                  </div>
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-stone-500">{v.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          <Flag type="info">
            <strong>outline</strong> (490×) supera al <strong>default</strong> (428×) — el botón "primario" no es el más común. Revisar
            si la jerarquía visual es la correcta o si se está sobreusando outline en acciones primarias.
          </Flag>
          <Flag type="warn">
            <strong>secondary</strong> (61×) es muy similar a <strong>outline</strong> visualmente. Considerar deprecarlo y migrar a
            outline.
          </Flag>
        </div>
      </Card>
    </div>
  );
}

// ─── 8. LAYOUT PATTERNS ───────────────────────────────────────────────────────

const CARD_PATTERNS = [
  {
    name: 'Card default (shadcn)',
    cls: 'rounded-xl border bg-card p-6 shadow-card',
    usage: 'Componente base ui/card.tsx',
    status: 'canonical',
  },
  {
    name: 'Panel stone',
    cls: 'rounded-xl border border-stone-200 bg-white p-4 shadow-sm',
    usage: 'La mayoría del system-design page — no usa Card component',
    status: 'manual',
  },
  {
    name: 'Panel muted',
    cls: 'rounded-xl border border-stone-200 bg-stone-50/60 p-4',
    usage: 'Contenedores internos, paneles anidados',
    status: 'manual',
  },
  {
    name: 'Report paper',
    cls: 'rounded border border-[#d5d8df] bg-[#f7f7f8] p-2.5',
    usage: 'Exclusivo de report generation',
    status: 'isolated',
  },
];

function LayoutSection() {
  return (
    <div className="space-y-6">
      <Card>
        <h3 className="mb-1 text-sm font-semibold">Card / Container Patterns</h3>
        <p className="mb-4 text-xs text-stone-400">Patrones encontrados en el codebase — no todos usan el componente Card</p>
        <div className="space-y-4">
          {CARD_PATTERNS.map((p) => (
            <div key={p.name} className="grid gap-3 sm:grid-cols-2">
              <div className={cn('flex min-h-[64px] items-center justify-center text-sm text-stone-500', p.cls)}>
                {p.name}
              </div>
              <div className="flex flex-col justify-center space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-stone-700">{p.name}</span>
                  <span className={cn(
                    'rounded-full border px-1.5 py-0.5 text-[10px]',
                    p.status === 'canonical' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                    p.status === 'isolated' ? 'border-blue-200 bg-blue-50 text-blue-700' :
                    'border-amber-200 bg-amber-50 text-amber-700',
                  )}>
                    {p.status}
                  </span>
                </div>
                <code className="text-[10px] font-mono text-stone-400 leading-relaxed break-all">{p.cls}</code>
                <p className="text-[10px] text-stone-400">{p.usage}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Flag type="warn">
            Tres variantes manuales de card que duplican el component <code>ui/card.tsx</code>. Considerar enriquecer Card con
            props <code>variant=&quot;panel&quot;</code> y <code>variant=&quot;muted&quot;</code>, y usar el componente en todos lados.
          </Flag>
        </div>
      </Card>

      <Card>
        <h3 className="mb-4 text-sm font-semibold">Layout Grid Patterns</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { name: '2-col responsive', cls: 'grid grid-cols-1 sm:grid-cols-2 gap-4', uses: 85 },
            { name: '3-col responsive', cls: 'grid grid-cols-1 md:grid-cols-3 gap-4', uses: 40 },
            { name: '4-col responsive', cls: 'grid grid-cols-2 sm:grid-cols-4 gap-3', uses: 25 },
            { name: 'Sidebar + content', cls: 'grid grid-cols-[3rem_1fr]', uses: 8 },
            { name: 'Calendar week', cls: 'grid grid-cols-8 (header+7 days)', uses: 4 },
            { name: 'Auto-fill cards', cls: 'grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))]', uses: 12 },
          ].map((l) => (
            <div key={l.name} className="rounded-lg border border-stone-100 bg-stone-50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-stone-700">{l.name}</span>
                <span className="text-[10px] tabular-nums text-stone-400">{l.uses}×</span>
              </div>
              <code className="mt-1 block text-[10px] font-mono text-stone-400 leading-relaxed">{l.cls}</code>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── 9. MIGRATION ─────────────────────────────────────────────────────────────

type MigrationStatus = 'done' | 'partial' | 'pending';

const STATUS_CFG: Record<MigrationStatus, { label: string; cls: string }> = {
  done:    { label: 'Listo',     cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  partial: { label: 'Parcial',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  pending: { label: 'Pendiente', cls: 'bg-stone-100 text-stone-500 border-stone-200' },
};

function StatusBadge({ status }: { status: MigrationStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', cfg.cls)}>
      {cfg.label}
    </span>
  );
}

function DiffBlock({ before, after }: { before: string; after: string }) {
  return (
    <div className="mt-3 rounded-lg border border-stone-200 overflow-hidden font-mono text-xs">
      <div className="bg-stone-50 px-3 py-1.5 text-[10px] text-stone-400 border-b border-stone-200 uppercase tracking-wider">diff</div>
      <div className="divide-y divide-stone-100">
        <div className="flex items-start gap-3 bg-red-50 px-3 py-2">
          <span className="shrink-0 text-red-400 select-none">−</span>
          <pre className="text-red-700 whitespace-pre-wrap break-all">{before}</pre>
        </div>
        <div className="flex items-start gap-3 bg-emerald-50 px-3 py-2">
          <span className="shrink-0 text-emerald-500 select-none">+</span>
          <pre className="text-emerald-700 whitespace-pre-wrap break-all">{after}</pre>
        </div>
      </div>
    </div>
  );
}

interface MigrationStep {
  num: number;
  title: string;
  status: MigrationStatus;
  files: string[];
  done?: string[];
  missing: string[];
  diff?: { before: string; after: string };
  notes?: string;
}

const MIGRATION_STEPS: MigrationStep[] = [
  {
    num: 1,
    title: 'Tokens — globals.css',
    status: 'partial',
    files: ['app/globals.css'],
    done: [
      '--color-orange-primary: #ff5800 existe',
      'Geist fonts mapeadas en @theme',
    ],
    missing: [
      'Cambiar --primary: #444444 → #ff5800 (~línea 99)',
      'Agregar a :root → --notch-bg: var(--card), --notch-stroke: var(--border), --notch-tray: var(--muted)',
      'Agregar a :root → --src-extraction: #16a34a, --src-manual: #2563eb, --src-mixed: #9333ea',
    ],
    diff: {
      before: '--primary: #444444;',
      after:  '--primary: #ff5800;',
    },
  },
  {
    num: 2,
    title: 'Tipografías — layout.tsx',
    status: 'done',
    files: ['app/layout.tsx'],
    done: [
      'Geist Sans importada → --font-geist-sans',
      'Geist Mono importada → --font-geist-mono',
      'Playfair Display importada → --font-geist-serif',
      '@theme mapea --font-sans y --font-mono en globals.css',
    ],
    missing: [],
    notes: 'Playfair está cargada pero sin uso activo en UI. Baja prioridad eliminarla — no genera deuda visual.',
  },
  {
    num: 3,
    title: 'Button lifted recipe — button.tsx',
    status: 'pending',
    files: ['components/ui/button.tsx'],
    missing: [
      'Reemplazar variante default (dark gradient) por Sintesis lifted recipe',
      'Reemplazar variante outline por versión con shadow hue-matched',
      'Migrar destructive con sombra roja hue-matched',
      'Agregar variante dark (stone-900) con shadow negra hue-matched',
    ],
    diff: {
      before: 'default: "bg-primary text-primary-foreground shadow-[0px_2px_4px...]"',
      after:  'default: "bg-[#D97757] text-[#FAF9F5] border border-black/15 active:translate-y-px\n         shadow-[0_1px_3px_rgba(180,90,30,.35),0_2px_6px_rgba(180,90,30,.20),\n         inset_0_1px_0_rgba(255,255,255,.15)]"',
    },
    notes: 'Impacto: 1,225 usos en 95+ archivos. Migrar default + outline primero. Verificar visual en tokens → Buttons antes de continuar.',
  },
  {
    num: 4,
    title: 'Signature components',
    status: 'partial',
    files: [
      'components/ui/notch-tail.tsx',
      'components/ui/FolderFront.tsx',
      'components/ui/tray.tsx  ← FALTA',
    ],
    done: [
      'notch-tail.tsx existe',
      'FolderFront.tsx existe',
    ],
    missing: [
      'Crear components/ui/tray.tsx con Tray (border-radius 12px, border 1px, p-1) + Chip (h-8, px-3, rounded-full)',
    ],
    notes: 'Tray es el contenedor para pills de origen de datos (extracción / manual / mixto). Sin él los tokens --src-* del paso 1 no tienen donde usarse.',
  },
  {
    num: 5,
    title: 'Notch tabs',
    status: 'pending',
    files: [
      'components/excel-page-tabs.tsx  ← prioridad 1',
      'app/system-design/page.tsx     ← prioridad 2',
      'Cualquier <TabsList> con estilo underline flat',
    ],
    missing: [
      'Envolver TabsList con contenedor relative',
      'Renderizar <NotchTail> SVG a izquierda y derecha del trigger activo',
      'Conectar estado activo de la tab con la posición del NotchTail',
    ],
    notes: 'notch-tail.tsx ya existe — solo necesita cablearse al estado activo de la tab. Empezar por excel-page-tabs.tsx (alta visibilidad).',
  },
  {
    num: 6,
    title: 'Copy audit — voseo y terminología',
    status: 'pending',
    files: ['src/**/*.tsx  (grep pass)'],
    missing: [
      'grep -r "!" src/ → buscar signos de exclamación en strings de UI',
      'grep -r " tu " --include="*.tsx" → tuteo en lugar de voseo',
      'grep -r "proyecto" --include="*.tsx" → "proyecto" debería ser "obra"',
      'grep -r "centraliza\\|detecta\\|accede" → tercera persona en lugar de voseo',
    ],
    notes: 'Sin cambios de archivo aún — es un pase de QA. Documentar violaciones antes de corregir en masa.',
  },
];

function MigrationSection() {
  return (
    <div className="space-y-4">
      <Card>
        <SectionHeader
          title="Plan de migración — Sintesis DS"
          sub="6 pasos ordenados por dependencia. Completar en orden para evitar conflictos entre cambios."
        />
        <div className="space-y-1 text-xs text-stone-500">
          {(['done', 'partial', 'pending'] as MigrationStatus[]).map((s) => (
            <span key={s} className="mr-3 inline-flex items-center gap-1.5">
              <StatusBadge status={s} />
              {s === 'done' ? '— sin trabajo pendiente' : s === 'partial' ? '— iniciado, falta completar' : '— no iniciado'}
            </span>
          ))}
        </div>
      </Card>

      {MIGRATION_STEPS.map((step) => (
        <Card key={step.num} className="space-y-3">
          {/* Header row */}
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-stone-50 text-xs font-semibold text-stone-600">
              {step.num}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-stone-900">{step.title}</span>
                <StatusBadge status={step.status} />
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {step.files.map((f) => (
                  <code key={f} className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600">{f}</code>
                ))}
              </div>
            </div>
          </div>

          {/* Already done */}
          {step.done && step.done.length > 0 && (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2.5">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Ya hecho</p>
              <ul className="space-y-0.5">
                {step.done.map((d) => (
                  <li key={d} className="flex items-start gap-1.5 text-xs text-emerald-700">
                    <span className="mt-0.5 shrink-0 text-emerald-500">✓</span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Missing */}
          {step.missing.length > 0 && (
            <div className="rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2.5">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600">Pendiente</p>
              <ul className="space-y-0.5">
                {step.missing.map((m) => (
                  <li key={m} className="flex items-start gap-1.5 text-xs text-stone-600">
                    <span className="mt-0.5 shrink-0 text-amber-400">○</span>
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Diff */}
          {step.diff && <DiffBlock before={step.diff.before} after={step.diff.after} />}

          {/* Notes */}
          {step.notes && (
            <p className="text-[11px] leading-relaxed text-stone-400 italic">{step.notes}</p>
          )}
        </Card>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const ISSUES = [
  { severity: 'error', count: 4, items: ['Dos colores primarios (gray + orange)', 'z-[10000000] en context menus', 'z-100 sidebar encima de modales', '~58 hex hardcodeados no tokenizados'] },
  { severity: 'warn', count: 6, items: ['~76 tamaños de texto arbitrarios', '~40 spacing fuera del grid', '~25 sombras arbitrarias sin sistema de elevación', '3 variantes manuales de card', 'secondary button casi idéntico a outline', 'tracking arbitrario en 18+ instancias'] },
  { severity: 'info', count: 4, items: ['text-muted-foreground vs text-stone-500 para el mismo fin', 'border-border vs border-stone-200 mezclados', 'sidebar usa hsl() mientras el resto usa oklch()', 'outline es el botón más usado, no el primary'] },
];

export default function DesignTokensPage() {
  return (
    <div className="min-h-screen bg-stone-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Nav */}
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/system-design">
              <ArrowLeft className="mr-2 h-4 w-4" />
              System Design
            </Link>
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm text-stone-500">Design Tokens</span>
        </div>

        {/* Header */}
        <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Design System Tokens</h1>
              <p className="mt-1 text-sm text-stone-500">
                Análisis completo de colores, tipografía, espaciado, bordes, sombras, z-index y botones —{' '}
                extraído del codebase real.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" asChild>
                <Link href="/system-design/audit">Component Audit</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/system-design">Live Components</Link>
              </Button>
            </div>
          </div>

          {/* Issues summary */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            {ISSUES.map((i) => {
              const cfg = {
                error: { cls: 'border-red-200 bg-red-50', numCls: 'text-red-600', label: 'Críticos', Icon: XCircle, iconCls: 'text-red-500' },
                warn: { cls: 'border-amber-200 bg-amber-50', numCls: 'text-amber-600', label: 'Warnings', Icon: AlertTriangle, iconCls: 'text-amber-500' },
                info: { cls: 'border-blue-200 bg-blue-50', numCls: 'text-blue-600', label: 'Info', Icon: Info, iconCls: 'text-blue-500' },
              }[i.severity as 'error' | 'warn' | 'info'];
              const Icon = cfg.Icon;
              return (
                <div key={i.severity} className={cn('rounded-xl border p-3', cfg.cls)}>
                  <div className="flex items-center gap-1.5">
                    <Icon className={cn('h-4 w-4', cfg.iconCls)} />
                    <span className={cn('text-2xl font-semibold tabular-nums', cfg.numCls)}>{i.count}</span>
                    <span className="text-xs text-stone-500">{cfg.label}</span>
                  </div>
                  <ul className="mt-2 space-y-0.5">
                    {i.items.map((item) => (
                      <li key={item} className="text-[10px] text-stone-600 leading-relaxed">· {item}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        {/* Content tabs */}
        <Tabs defaultValue="colors">
          <TabsList className="mb-6 flex-wrap h-auto gap-1">
            <TabsTrigger value="colors">Colores</TabsTrigger>
            <TabsTrigger value="typography">Tipografía</TabsTrigger>
            <TabsTrigger value="spacing">Espaciado</TabsTrigger>
            <TabsTrigger value="radius">Radius</TabsTrigger>
            <TabsTrigger value="shadows">Sombras</TabsTrigger>
            <TabsTrigger value="zindex">Z-Index</TabsTrigger>
            <TabsTrigger value="buttons">Buttons</TabsTrigger>
            <TabsTrigger value="layout">Layout</TabsTrigger>
            <TabsTrigger value="migration">Migración</TabsTrigger>
          </TabsList>

          <TabsContent value="colors"><ColorsSection /></TabsContent>
          <TabsContent value="typography"><TypographySection /></TabsContent>
          <TabsContent value="spacing"><SpacingSection /></TabsContent>
          <TabsContent value="radius"><RadiusSection /></TabsContent>
          <TabsContent value="shadows"><ShadowsSection /></TabsContent>
          <TabsContent value="zindex"><ZIndexSection /></TabsContent>
          <TabsContent value="buttons"><ButtonsSection /></TabsContent>
          <TabsContent value="layout"><LayoutSection /></TabsContent>
          <TabsContent value="migration"><MigrationSection /></TabsContent>
        </Tabs>

        <p className="mt-6 text-center text-xs text-stone-400">
          Análisis de 95+ archivos · 2,365 rounded · 2,322 spacing · 1,225 button variants · 836 size declarations
        </p>
      </div>
    </div>
  );
}
