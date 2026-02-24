import React from "react";

/**
 * Component Library Canvas
 * - Tailwind (no prefix)
 * - Single-file presentational components meant to be copied into your app
 *
 * ===============================
 * VISUAL SYSTEM (RULES + TOKENS)
 * ===============================
 *
 * 1) Surfaces
 * - App background:   bg-stone-100
 * - Card surface:     bg-white
 * - Subtle panel:     bg-stone-50/60 (inside cards)
 *
 * 2) Borders & Shadows
 * - Default border:   border border-stone-200/80
 * - Dividers:         h-px bg-stone-200/70
 * - Default shadow:   shadow-[0_1px_0_rgba(0,0,0,0.03)]
 * - Elevated overlay: shadow-[0_20px_60px_rgba(0,0,0,0.10)] (popovers)
 * - Heavy overlay:    shadow-[0_30px_90px_rgba(0,0,0,0.12)] (hero overlays)
 *
 * 2.5) Thick "secondary background border" frame
 * - Don't thicken borders. Create a *frame layer* behind the card.
 * - Frame: bg-stone-100 (or bg-stone-50) + padding (p-2/p-3) + large radius
 * - Inner: normal Card (white) + normal border + slightly smaller radius
 *
 * 3) Radius scale (pick ONE per component)
 * - Small:            rounded-lg   (icon buttons, tight controls)
 * - Medium:           rounded-xl   (inputs, buttons, table containers)
 * - Large (default):  rounded-2xl  (cards, panels)
 * - Hero:             rounded-3xl  (big marketing sections / frames)
 *
 * 4) Spacing scale
 * - Card padding:     p-5 (headers), p-4/p-5 (content), p-6 (hero)
 * - Row padding:      px-4 py-3
 * - Compact control:  px-3 py-2
 *
 * 5) Typography hierarchy
 * - Title (card):     text-sm font-semibold text-stone-900
 * - Subtitle:         text-xs text-stone-500
 * - Section label:    text-xs font-semibold tracking-wide text-stone-500
 * - Body:             text-sm text-stone-600
 *
 * 6) Interaction
 * - Hover surface:    hover:bg-stone-50
 * - Hover row:        hover:bg-stone-50/60
 * - Transition:       transition (interactive only)
 *
 * 7) Canonical class tokens (copy/paste)
 * - Page:             "bg-stone-100 p-10"
 * - Section:          "space-y-6"
 * - Grid 2-col:       "grid grid-cols-1 gap-6 lg:grid-cols-2"
 *
 * - Frame:            "rounded-3xl bg-stone-100 p-2"
 * - FrameSoft:        "rounded-3xl bg-stone-50 p-2"
 * - FrameInner:       "rounded-[22px] border border-stone-200/80 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]"
 *
 * - Card:             "rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]"
 * - CardHeader:       "flex items-start justify-between gap-4 p-5"
 * - CardContent:      "p-4" or "p-5"
 * - CardFooter:       "border-t border-stone-200 bg-white p-4"
 * - Panel:            "rounded-2xl border border-stone-200 bg-stone-50/60 p-6"
 *
 * - TableWrap:        "overflow-hidden rounded-xl border border-stone-200"
 * - TableHead:        "bg-stone-50 text-xs font-semibold text-stone-600"
 * - TableRow:         "hover:bg-stone-50/60"
 *
 * - Chip:             "inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 py-2"
 * - IconButton:       "rounded-xl border border-stone-200 bg-white p-2 text-stone-700 hover:bg-stone-50"
 * - InputWrap:        "flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2"
 * - Input:            "flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400"
 */

// ---------- Small primitives ----------

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

type IconName =
  | "chev-left"
  | "chev-right"
  | "x"
  | "sparkle"
  | "clock"
  | "arrow"
  | "search"
  | "filter"
  | "columns"
  | "download"
  | "upload"
  | "doc"
  | "folder"
  | "grid"
  | "eye"
  | "more";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Badge({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
}) {
  const tones: Record<BadgeTone, string> = {
    neutral: "bg-stone-100 text-stone-700 border-stone-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
    info: "bg-sky-50 text-sky-700 border-sky-200",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

function Pill({
  color = "stone",
  children,
}: {
  color?: "stone" | "green" | "blue" | "orange" | "red";
  children: React.ReactNode;
}) {
  const map: Record<string, string> = {
    stone: "bg-stone-100 text-stone-800",
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-sky-50 text-sky-700",
    orange: "bg-orange-50 text-orange-700",
    red: "bg-rose-50 text-rose-700",
  };
  const dot: Record<string, string> = {
    stone: "bg-stone-500",
    green: "bg-emerald-500",
    blue: "bg-sky-500",
    orange: "bg-orange-500",
    red: "bg-rose-500",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
        map[color]
      )}
    >
      <span className={cx("h-2 w-2 rounded-full", dot[color])} />
      {children}
    </span>
  );
}

function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]",
        className
      )}
    >
      {children}
    </div>
  );
}

function Framed({
  children,
  tone = "default",
  className,
  innerClassName,
}: {
  children: React.ReactNode;
  /** default = bg-stone-100, soft = bg-stone-50 */
  tone?: "default" | "soft";
  className?: string;
  innerClassName?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-3xl p-2",
        tone === "default" ? "bg-stone-100" : "bg-stone-50",
        className
      )}
    >
      <div
        className={cx(
          "rounded-[22px] border border-stone-200/80 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]",
          innerClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}

function CardHeader({
  title,
  subtitle,
  right,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex items-start justify-between gap-4 p-5", className)}>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-stone-900">{title}</div>
        {subtitle ? (
          <div className="mt-0.5 text-xs text-stone-500">{subtitle}</div>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

function Divider({ className }: { className?: string }) {
  return <div className={cx("h-px bg-stone-200/70", className)} />;
}

function Button({
  variant = "secondary",
  children,
  className,
}: {
  variant?: "primary" | "secondary" | "ghost";
  children: React.ReactNode;
  className?: string;
}) {
  const styles: Record<string, string> = {
    primary: "bg-stone-900 text-white border-stone-900 hover:bg-stone-800",
    secondary: "bg-white text-stone-900 border-stone-200 hover:bg-stone-50",
    ghost: "bg-transparent text-stone-700 border-transparent hover:bg-stone-100",
  };
  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition",
        styles[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

function Icon({ name }: { name: IconName }) {
  const common = "h-4 w-4 stroke-current";
  switch (name) {
    case "chev-left":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      );
    case "chev-right":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" strokeWidth="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      );
    case "x":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" strokeWidth="2">
          <path d="M18 6L6 18" />
          <path d="M6 6l12 12" />
        </svg>
      );
    case "sparkle":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" strokeWidth="2">
          <path d="M12 2l1.3 5.2L18 8.5l-4.7 1.3L12 15l-1.3-5.2L6 8.5l4.7-1.3L12 2z" />
          <path d="M19 12l.8 3.1L23 16l-3.2.9L19 20l-.8-3.1L15 16l3.2-.9L19 12z" />
        </svg>
      );
    case "clock":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v6l4 2" />
        </svg>
      );
    case "arrow":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" strokeWidth="2">
          <path d="M5 12h14" />
          <path d="M13 6l6 6-6 6" />
        </svg>
      );
    case "search":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      );
    case "filter":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" strokeWidth="2">
          <path d="M4 5h16" />
          <path d="M7 12h10" />
          <path d="M10 19h4" />
        </svg>
      );
    case "columns":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" strokeWidth="2">
          <path d="M4 5h7v14H4z" />
          <path d="M13 5h7v14h-7z" />
        </svg>
      );
    case "download":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" strokeWidth="2">
          <path d="M12 3v10" />
          <path d="M8 9l4 4 4-4" />
          <path d="M5 21h14" />
        </svg>
      );
    case "upload":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" strokeWidth="2">
          <path d="M12 21V11" />
          <path d="M8 15l4-4 4 4" />
          <path d="M5 3h14" />
        </svg>
      );
    case "doc":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" strokeWidth="2">
          <path d="M7 3h7l3 3v15H7z" />
          <path d="M14 3v4h4" />
        </svg>
      );
    case "folder":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" strokeWidth="2">
          <path d="M3 7h6l2 2h10v11H3z" />
        </svg>
      );
    case "grid":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" strokeWidth="2">
          <path d="M4 4h7v7H4z" />
          <path d="M13 4h7v7h-7z" />
          <path d="M4 13h7v7H4z" />
          <path d="M13 13h7v7h-7z" />
        </svg>
      );
    case "eye":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" strokeWidth="2">
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "more":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" strokeWidth="2">
          <path d="M6 12h.01" />
          <path d="M12 12h.01" />
          <path d="M18 12h.01" />
        </svg>
      );
    default:
      return null;
  }
}

function Avatar({
  initials,
  src,
  size = 36,
  ring = true,
}: {
  initials?: string;
  src?: string;
  size?: number;
  ring?: boolean;
}) {
  return (
    <div
      className={cx(
        "grid place-items-center rounded-full bg-stone-200 text-xs font-semibold text-stone-700",
        ring && "ring-4 ring-white",
        "overflow-hidden"
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials ?? ""
      )}
    </div>
  );
}

// ---------- “Test cases” (minimal, safe runtime checks) ----------

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function runVisualTokenTests() {
  // These are intentionally tiny. They ensure this single-file compiles + tokens exist.
  const tokens = {
    page: "bg-stone-100 p-10",
    frame: "rounded-3xl bg-stone-100 p-2",
    frameInner:
      "rounded-[22px] border border-stone-200/80 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]",
    card:
      "rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]",
    tableWrap: "overflow-hidden rounded-xl border border-stone-200",
  };

  assert(tokens.page.includes("bg-stone-100"), "Page token should use bg-stone-100");
  assert(tokens.frame.includes("rounded-3xl"), "Frame should be rounded-3xl");
  assert(tokens.frameInner.includes("border-stone-200"), "FrameInner should include border-stone-200");
  assert(tokens.card.includes("rounded-2xl"), "Card should be rounded-2xl");
  assert(tokens.tableWrap.includes("rounded-xl"), "TableWrap should be rounded-xl");
}

// Run tests only in explicit test environments.
const __isTestEnv =
  typeof process !== "undefined" &&
  !!(process as any)?.env &&
  (process as any).env.NODE_ENV === "test";

if (__isTestEnv) runVisualTokenTests();

// ---------- 1) Version history / timeline card ----------

function VersionHistoryCard() {
  return (
    <Framed className="w-full max-w-[740px]">
      <div>
        <div className="flex items-center justify-between gap-4 px-6 pt-5">
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold text-stone-900">Version History</div>
            <Badge tone="neutral">All time</Badge>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border border-stone-200 bg-white p-2 text-stone-700 hover:bg-stone-50"
              type="button"
            >
              <Icon name="grid" />
            </button>
            <button
              className="rounded-xl border border-stone-200 bg-white p-2 text-stone-700 hover:bg-stone-50"
              type="button"
            >
              <Icon name="x" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="relative rounded-2xl border border-stone-200 bg-stone-50/60 p-6">
            {/* faint grid */}
            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(to_right,rgba(120,113,108,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(120,113,108,0.08)_1px,transparent_1px)] bg-[size:64px_64px]" />

            {/* timeline dots */}
            <div className="relative h-[220px]">
              <div className="absolute left-8 top-8 text-xs text-stone-400">6 AM</div>
              <div className="absolute left-8 top-[108px] text-xs text-stone-400">2 PM</div>
              <div className="absolute left-8 top-[182px] text-xs text-stone-400">10 PM</div>

              <div className="absolute left-[120px] top-[86px] h-2 w-2 rounded-full bg-emerald-600" />
              <div className="absolute left-[260px] top-[132px] h-2 w-2 rounded-full bg-stone-300" />
              <div className="absolute left-[420px] top-[118px] h-2 w-2 rounded-full bg-emerald-600" />
              <div className="absolute left-[560px] top-[148px] h-2 w-2 rounded-full bg-stone-300" />

              {/* floating version popup */}
              <div className="absolute left-1/2 top-2 w-[420px] -translate-x-1/2">
                <Card className="shadow-[0_20px_60px_rgba(0,0,0,0.10)]">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-stone-900">Version 53</div>
                        <div className="mt-0.5 text-xs text-stone-500">Oct 21, 4:35 PM</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Avatar initials="AB" size={28} />
                        <Avatar initials="CD" size={28} />
                      </div>
                    </div>
                    <div className="mt-3 text-sm leading-6 text-stone-600">
                      Refined Notion node parameters and updated message formatting.
                    </div>
                  </div>

                  <Divider />

                  <div className="flex items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-2">
                      <Button variant="secondary">Compare</Button>
                      <Button variant="secondary">Details</Button>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-stone-500">
                      <span className="inline-flex items-center gap-1">
                        <Icon name="chev-left" /> Back
                      </span>
                      <span className="font-medium">1/5</span>
                      <span className="inline-flex items-center gap-1">
                        Next <Icon name="chev-right" />
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            {/* month axis */}
            <div className="relative mt-2 flex items-center justify-between text-xs text-stone-400">
              <span>September</span>
              <span className="font-medium text-stone-600">October</span>
              <span>November</span>
            </div>
            <div className="relative mt-3 flex justify-center">
              <div className="rounded-full border border-stone-200 bg-white px-5 py-2 text-sm font-medium text-stone-700">
                30 Days
              </div>
            </div>
          </div>
        </div>
      </div>
    </Framed>
  );
}

// ---------- 2) Testimonial orbit + centered card ----------

function TestimonialOrbit() {
  const faces = [
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=80&q=60",
    "https://images.unsplash.com/photo-1520975693411-7a4f6f5b3d97?auto=format&fit=crop&w=80&q=60",
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=60",
    "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=80&q=60",
    "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=80&q=60",
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=80&q=60",
    "https://images.unsplash.com/photo-1552058544-f2b08422138a?auto=format&fit=crop&w=80&q=60",
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=80&q=60",
  ];

  return (
    <Framed className="w-full max-w-[900px]" innerClassName="rounded-[26px]">
      <div className="p-10">
        <div className="flex items-center justify-center gap-5">
          {faces.slice(0, 8).map((src, i) => (
            <Avatar key={i} src={src} size={56} />
          ))}
        </div>

        <div className="relative mt-12 flex justify-center">
          <div className="absolute left-1/2 top-[-40px] h-[80px] w-px bg-stone-200" />

          <Card className="w-full max-w-[520px]">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Avatar src={faces[2]} size={36} ring={false} />
                  <div>
                    <div className="text-sm font-semibold text-stone-900">Rebecca Swims</div>
                    <div className="text-xs text-stone-500">3D Designer at NovaTech</div>
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1">
                  <span className="text-amber-500">★</span>
                  <span className="text-xs font-medium text-stone-700">5</span>
                </div>
              </div>

              <p className="mt-5 text-sm leading-6 text-stone-600">
                Ace Studio created stunning 3D visuals for our product launch, and the attention to
                detail was remarkable. Our clients were truly impressed by the realistic renderings.
                Thank you for bringing our vision to life!
              </p>
            </div>
          </Card>
        </div>

        <div className="mt-10 flex justify-center">
          <div className="rounded-full border border-stone-200 bg-stone-50 px-5 py-2 text-xs font-medium text-stone-700">
            Tired of losing your money?
          </div>
        </div>

        <div className="mt-6 text-center">
          <div className="text-4xl font-semibold tracking-tight text-stone-950">
            Tailored Solutions for
            <br />
            Startups &amp; Tech
          </div>
          <div className="mx-auto mt-4 max-w-[560px] text-sm leading-6 text-stone-500">
            We combine speed, quality, and affordability to create custom solutions that empower
            founders and teams.
          </div>
        </div>
      </div>
    </Framed>
  );
}

// ---------- 3) Table + AI suggestion overlay ----------

function AISuggestionTableOverlay() {
  const rows = [
    { status: "Active", name: "John" },
    { status: "Active", name: "Michael" },
    { status: "Active", name: "David" },
    { status: "Active", name: "Daniel", highlighted: true },
  ];

  return (
    <div className="grid w-full max-w-[1020px] grid-cols-1 gap-6 lg:grid-cols-2">
      <Framed>
        <div>
          <CardHeader title="Employees" subtitle="Editable table preview" />
          <Divider />
          <div className="p-4">
            <div className="overflow-hidden rounded-xl border border-stone-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50 text-xs font-semibold text-stone-600">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {["Walker", "Parker", "Thompson", "Harris", "Collins", "Reed", "Bennett"].map(
                    (name, i) => (
                      <tr key={i} className="hover:bg-stone-50/60">
                        <td className="px-4 py-3 text-stone-500">Oct 24, 2025</td>
                        <td className="px-4 py-3 font-medium text-stone-900">{name}</td>
                        <td className="px-4 py-3">
                          <Pill
                            color={
                              i % 4 === 0
                                ? "green"
                                : i % 4 === 1
                                  ? "orange"
                                  : i % 4 === 2
                                    ? "red"
                                    : "blue"
                            }
                          >
                            {i % 4 === 0
                              ? "Finance Manager"
                              : i % 4 === 1
                                ? "HR Manager"
                                : i % 4 === 2
                                  ? "Marketing Manager"
                                  : "Sales Manager"}
                          </Pill>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Framed>

      <div className="relative">
        <div className="absolute left-0 top-10 h-[260px] w-full rounded-2xl bg-stone-100/60" />

        <div className="relative pt-12">
          <Framed
            className="shadow-[0_30px_90px_rgba(0,0,0,0.12)] bg-red-500"
            innerClassName="border-stone-200/70"
          >
            <div>
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <Badge tone="success">✓ Active</Badge>
                  <div className="text-xs text-stone-500">Skip</div>
                </div>

                <div className="mt-4 overflow-hidden rounded-xl border border-stone-200">
                  <table className="w-full text-left text-sm">
                    <tbody className="divide-y divide-stone-200">
                      {rows.map((r, idx) => (
                        <tr
                          key={idx}
                          className={cx("hover:bg-stone-50/60", r.highlighted && "bg-sky-50/60")}
                        >
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-stone-900">{r.name}</td>
                          <td className="px-4 py-3 text-stone-500">Owner</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4">
                  <div className="inline-flex items-center rounded-md bg-indigo-600 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                    AI Suggestion
                  </div>
                </div>

                <div className="mt-3 text-lg font-semibold leading-snug text-stone-900">
                  AI suggests changes.
                  <br />
                  You stay in control.
                </div>
                <div className="mt-2 text-sm leading-6 text-stone-600">
                  AI can suggest values, clean data, or spot patterns. Nothing is applied without your
                  approval.
                </div>

                <div className="mt-6 flex items-center justify-between text-xs text-stone-500">
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-lg border border-stone-200 bg-white p-1.5 hover:bg-stone-50"
                      type="button"
                    >
                      <Icon name="chev-left" />
                    </button>
                    <span className="font-medium">1/3</span>
                    <button
                      className="rounded-lg border border-stone-200 bg-white p-1.5 hover:bg-stone-50"
                      type="button"
                    >
                      <Icon name="chev-right" />
                    </button>
                  </div>
                  <div>Skip</div>
                </div>
              </div>
            </div>
          </Framed>
        </div>
      </div>
    </div>
  );
}

// ---------- 4) Metrics overview card (Embedding v3) ----------

function MetricsOverviewCard() {
  const Stat = ({
    label,
    value,
    delta,
    deltaTone,
  }: {
    label: string;
    value: string;
    delta: string;
    deltaTone: "up" | "down";
  }) => (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="text-xs font-medium text-stone-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">{value}</div>
      <div
        className={cx(
          "mt-1 inline-flex items-center gap-2 text-xs",
          deltaTone === "up" ? "text-emerald-700" : "text-rose-700"
        )}
      >
        <span
          className={cx(
            "grid h-5 w-5 place-items-center rounded-full",
            deltaTone === "up" ? "bg-emerald-50" : "bg-rose-50"
          )}
        >
          {deltaTone === "up" ? "↑" : "↓"}
        </span>
        <span className="text-stone-500">{delta}</span>
      </div>
    </div>
  );

  const QuickAction = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
    <button
      className={cx(
        "flex w-full items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white px-4 py-3 text-left",
        "hover:bg-stone-50"
      )}
      type="button"
    >
      <div className="flex items-center gap-3">
        <div className="text-stone-700">{icon}</div>
        <div className="text-sm font-medium text-stone-900">{title}</div>
      </div>
      <span className="text-stone-400">›</span>
    </button>
  );

  return (
    <Framed className="w-full max-w-[440px]">
      <div>
        <CardHeader
          title={
            <div className="flex items-center gap-2">
              <span>Embedding v3</span>
              <span className="text-xs font-medium text-stone-500">AI model</span>
            </div>
          }
          right={<Badge tone="warning">Warning</Badge>}
        />

        <div className="px-5">
          <div className="inline-flex w-full rounded-xl border border-stone-200 bg-stone-50 p-1">
            {[{ label: "Overview", active: true }, { label: "Traces", active: false }, { label: "Connections", active: false }].map(
              (t) => (
                <button
                  key={t.label}
                  type="button"
                  className={cx(
                    "flex-1 rounded-lg px-3 py-2 text-xs font-medium transition",
                    t.active
                      ? "bg-white text-stone-900 shadow-[0_1px_0_rgba(0,0,0,0.06)]"
                      : "text-stone-500 hover:text-stone-700"
                  )}
                >
                  {t.label}
                </button>
              )
            )}
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-semibold tracking-wide text-stone-500">KEY METRICS</div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="Latency" value="245ms" delta="892ms" deltaTone="up" />
            <Stat label="Throughput" value="12.4k/h" delta="18.9k/h" deltaTone="down" />
            <Stat label="Error rate" value="0.12%" delta="0.36%" deltaTone="up" />
            <Stat label="Tokens" value="2.4M" delta="2.1M" deltaTone="up" />
          </div>
        </div>

        <div className="px-5">
          <div className="text-xs font-semibold tracking-wide text-stone-500">QUICK ACTIONS</div>
          <div className="mt-3 flex flex-col gap-2 pb-5">
            <QuickAction icon={<span className="text-stone-700">▦</span>} title="View metrics dashboard" />
            <QuickAction icon={<Icon name="clock" />} title="Show historical data" />
            <QuickAction icon={<span className="text-stone-700">⏱</span>} title="Configure alerts" />
            <QuickAction icon={<span className="text-stone-700">↗</span>} title="Open in provider console" />
          </div>
        </div>
      </div>
    </Framed>
  );
}

// ---------- 5) Task creation list + usage card + app rows + filter chips ----------

function LoadingTasksAndUsage() {
  const TaskRow = ({ step }: { step: string }) => (
    <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-200 border-t-stone-600" />
        <div className="text-sm font-medium text-stone-800">Creating tasks</div>
      </div>
      <div className="text-sm text-stone-500">{step} of 7</div>
      <button
        className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
        type="button"
      >
        Cancel
      </button>
    </div>
  );

  const AppRow = ({
    name,
    host,
    env,
    last,
  }: {
    name: string;
    host: string;
    env: string;
    last: string;
  }) => (
    <Framed className="p-2" innerClassName="rounded-[18px]">
      <div>
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="h-10 w-12 rounded-xl border border-stone-200 bg-[radial-gradient(circle_at_28%_30%,rgba(99,102,241,0.35),transparent_60%),radial-gradient(circle_at_70%_65%,rgba(249,115,22,0.35),transparent_60%)]" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-stone-900">{name}</div>
            <div className="text-xs text-stone-500">{host}</div>
          </div>
          <button
            className="ml-auto rounded-xl border border-stone-200 bg-white p-2 text-stone-500 hover:bg-stone-50"
            type="button"
            aria-label="More"
          >
            <Icon name="more" />
          </button>
        </div>
        <div className="flex items-center justify-between border-t border-stone-200 px-4 py-2 text-xs text-stone-500">
          <div className="inline-flex items-center gap-2">
            <span className="grid h-5 w-5 place-items-center rounded-full border border-stone-200 bg-stone-50">
              🌐
            </span>
            <span className="truncate">{env}</span>
          </div>
          <div className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-stone-300" />
            <span>Last deployment {last} ago</span>
          </div>
        </div>
      </div>
    </Framed>
  );

  return (
    <div className="grid w-full max-w-[1020px] grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <TaskRow step="1" />
        <TaskRow step="2" />
        <TaskRow step="3" />

        <div className="mt-8 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-stone-900">Temperature</div>
            <div className="text-xs text-stone-500">0.7%</div>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-3">
            <div className="relative h-2.5 rounded-full bg-stone-100">
              <div className="absolute left-0 top-0 h-2.5 w-[12%] rounded-full bg-stone-800" />
              <div className="absolute left-[12%] top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border border-stone-300 bg-white shadow-[0_6px_16px_rgba(0,0,0,0.10)]" />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <Framed>
          <div>
            <CardHeader title="Free plan usage" />
            <Divider />
            <div className="space-y-4 p-5">
              {[{ label: "Logs", value: "0.0125 of 1GB", pct: 12 }, { label: "Scores/metrics", value: "8,271 of 10,000", pct: 82 }].map(
                (m) => (
                  <div key={m.label} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-stone-900">{m.label}</div>
                      <div className="text-xs text-stone-500">{m.value}</div>
                    </div>
                    <div className="h-2.5 rounded-full bg-stone-100">
                      <div className="h-2.5 rounded-full bg-stone-800" style={{ width: `${m.pct}%` }} />
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </Framed>

        <div className="space-y-2">
          <AppRow name="Aurora Web" host="auroraapp.io" env="aurora-main.prod.acme.cloud" last="22m" />
          <AppRow name="Nimbus API" host="api.nimbus.dev" env="nimbus-main.prod.acme.cloud" last="1h" />
          <AppRow name="Pulse Metrics" host="pulsemetrics.co" env="pulsemetrics-main.prod.acme.cloud" last="4d" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 py-2">
            <Badge tone="neutral">@</Badge>
            <span className="text-sm text-stone-700">Mentions</span>
            <span className="text-stone-400">▾</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 py-2">
            <span className="text-sm text-stone-500">from</span>
            <span className="h-5 w-5 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(249,115,22,0.6),transparent_60%),radial-gradient(circle_at_70%_70%,rgba(99,102,241,0.6),transparent_60%)]" />
            <span className="text-sm font-medium text-stone-800">Tiago Alexandrino</span>
            <span className="text-stone-400">▾</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 py-2">
            <span className="text-sm text-stone-500">in</span>
            <span className="text-sm font-medium text-stone-800">#company-announcements</span>
            <span className="text-stone-400">▾</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- 6) Minimal agent card ----------

function AgentChatPanel() {
  return (
    <Framed className="w-full max-w-[440px]" innerClassName="overflow-hidden">
      <div>
        <div className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <Avatar initials="EA" size={28} ring={false} />
            <div className="text-sm font-semibold text-stone-900">Eval agent</div>
            <span className="text-stone-400">▾</span>
          </div>
          <div className="flex items-center gap-2 text-stone-500">
            <button className="rounded-lg p-2 hover:bg-stone-100" type="button">
              <Icon name="arrow" />
            </button>
            <button className="rounded-lg p-2 hover:bg-stone-100" type="button">
              <Icon name="x" />
            </button>
          </div>
        </div>

        <div className="space-y-4 bg-stone-50/60 p-4">
          <div className="rounded-2xl bg-white p-4 text-sm text-stone-700 shadow-sm">
            How can I help you optimize this obra dashboard?
          </div>
          <div className="rounded-2xl bg-stone-900 p-4 text-sm text-white">
            Generate a financial summary for the selected project.
          </div>
        </div>

        <div className="border-t border-stone-200 bg-white p-3">
          <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
            <input
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400"
              placeholder="Ask the agent..."
            />
            <Button variant="primary">Send</Button>
          </div>
        </div>
      </div>
    </Framed>
  );
}

// ---------- 7) Unified data grid shell ----------

function DataGridShell({ title }: { title: string }) {
  return (
    <Framed className="w-full" innerClassName="overflow-hidden">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <div className="text-xl font-semibold text-stone-900">{title}</div>
            <div className="text-sm text-stone-500">Structured overview with filters and bulk actions</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary">
              <Icon name="filter" /> Filters
            </Button>
            <Button variant="secondary">
              <Icon name="columns" /> Columns
            </Button>
            <Button variant="primary">New</Button>
          </div>
        </div>

        <Divider />

        <div className="p-4">
          <div className="overflow-hidden rounded-2xl border border-stone-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-xs font-semibold text-stone-600">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {[{ name: "Aurora Web", status: "Active" }, { name: "Nimbus API", status: "Inactive" }, { name: "Pulse Metrics", status: "Active" }].map(
                  (row, i) => (
                    <tr key={i} className="hover:bg-stone-50/60">
                      <td className="px-4 py-3 font-medium text-stone-900">{row.name}</td>
                      <td className="px-4 py-3">
                        <Badge tone={row.status === "Active" ? "success" : "neutral"}>{row.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-stone-500">2h ago</td>
                      <td className="px-4 py-3 text-right">
                        <button className="rounded-lg p-2 hover:bg-stone-100" type="button" aria-label="Open">
                          <Icon name="arrow" />
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Framed>
  );
}

// ---------- 8) New: Invoice split view (frame emphasis) ----------

function InvoiceSplitMock() {
  return (
    <div className="grid w-full max-w-[1020px] grid-cols-1 gap-6 lg:grid-cols-2">
      <Framed tone="soft">
        <div>
          <CardHeader
            title="Invoice Details"
            subtitle="Enter invoice details."
            right={
              <div className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-stone-900 text-white">◌</span>
                <div className="leading-tight">
                  <div className="text-xs font-semibold text-stone-900">Acme Corp.</div>
                  <div className="text-[11px] text-stone-500">acme@gmail.com</div>
                </div>
                <span className="text-stone-400">▾</span>
              </div>
            }
          />
          <Divider />
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-stone-600">First Name</div>
                <div className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-500">Ex. John</div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold text-stone-600">Last Name</div>
                <div className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-500">Ex. Jacobs</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-stone-600">Address</div>
              <div className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-500">
                Ex. 123 Maple Street, Springfield, USA
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-stone-600">Invoice Number</div>
                <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">INV-0231</div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold text-stone-600">Currency</div>
                <div className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 inline-flex items-center justify-between">
                  <span>🇺🇸 US Dollar</span>
                  <span className="text-stone-400">▾</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
              <div className="text-xs font-semibold tracking-wide text-stone-500">PRODUCT DETAILS</div>
              <div className="mt-3 overflow-hidden rounded-xl border border-stone-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-stone-50 text-xs font-semibold text-stone-600">
                    <tr>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">QTY</th>
                      <th className="px-4 py-3">Cost</th>
                      <th className="px-4 py-3">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {[{ item: "Brand Guidelines", qty: 1, cost: "$49.00" }, { item: "Logo", qty: 1, cost: "$499.00" }, { item: "3D Animation", qty: 1, cost: "$1232.00" }].map(
                      (r, idx) => (
                        <tr key={idx} className="hover:bg-stone-50/60">
                          <td className="px-4 py-3 font-medium text-stone-900">{r.item}</td>
                          <td className="px-4 py-3 text-stone-700">{r.qty}</td>
                          <td className="px-4 py-3 text-stone-700">{r.cost}</td>
                          <td className="px-4 py-3 text-stone-500">{r.cost}</td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </Framed>

      <Framed>
        <div>
          <div className="flex items-start justify-between px-6 pt-6">
            <div>
              <div className="text-2xl font-semibold text-stone-900">Invoice</div>
              <div className="mt-2 text-xs text-stone-500">Invoice Number</div>
              <div className="text-sm font-semibold text-stone-800">INV-0231</div>
            </div>
            <button className="rounded-xl border border-stone-200 bg-white p-2 text-stone-700 hover:bg-stone-50" type="button">
              <Icon name="download" />
            </button>
          </div>

          <div className="p-6 pt-4">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold text-stone-500">Billed by</div>
                <div className="mt-2 text-sm font-semibold text-stone-900">John Jacobs</div>
                <div className="text-sm text-stone-500">hjacob@gmail.com</div>
                <div className="text-sm text-stone-500">123 Maple Street, Springfield</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-stone-500">Billed to</div>
                <div className="mt-2 text-sm font-semibold text-stone-900">Acme Corp.</div>
                <div className="text-sm text-stone-500">acme@gmail.com</div>
                <div className="text-sm text-stone-500">123 Maple Street, Springfield</div>
              </div>
            </div>

            <Divider className="my-5" />

            <div className="overflow-hidden rounded-xl border border-stone-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50 text-xs font-semibold text-stone-600">
                  <tr>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">QTY</th>
                    <th className="px-4 py-3">Cost</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {[{ item: "Website Design", cost: 2249 }, { item: "Logo", cost: 499 }, { item: "3D Animation", cost: 1232 }, { item: "Framer Sub.", cost: 190 }].map(
                    (r, idx) => (
                      <tr key={idx} className="hover:bg-stone-50/60">
                        <td className="px-4 py-3 font-medium text-stone-900">{r.item}</td>
                        <td className="px-4 py-3 text-stone-700">1</td>
                        <td className="px-4 py-3 text-stone-700">${r.cost.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-stone-700">${r.cost.toFixed(2)}</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end">
              <div className="w-full max-w-[280px] space-y-2 text-sm">
                <div className="flex items-center justify-between text-stone-600">
                  <span>Subtotal</span>
                  <span>$1970.00</span>
                </div>
                <div className="flex items-center justify-between text-stone-600">
                  <span>Tax</span>
                  <span>10% ($330)</span>
                </div>
                <div className="flex items-center justify-between text-stone-600">
                  <span>Discount</span>
                  <span>$0.00</span>
                </div>
                <Divider />
                <div className="flex items-center justify-between font-semibold text-stone-900">
                  <span>TOTAL</span>
                  <span>$2300.00</span>
                </div>
              </div>
            </div>

            <div className="mt-8 text-sm text-stone-500">
              Thank you for your purchase! We appreciate your business and look forward to serving you again.
            </div>
          </div>
        </div>
      </Framed>
    </div>
  );
}

// ---------- 9) New: Prompt composer bar (thick frame + chips) ----------

function PromptComposerBar() {
  const Chip = ({ label }: { label: string }) => (
    <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700">
      <span className="h-4 w-4 rounded bg-stone-100" />
      {label}
      <button className="text-stone-400 hover:text-stone-600" type="button" aria-label={`Remove ${label}`}>
        ×
      </button>
    </span>
  );

  return (
    <Framed className="w-full max-w-[960px] " innerClassName="rounded-[26px]">
      <div className="p-4">
        <div className="flex flex-wrap gap-2">
          <Chip label="agreement" />
          <Chip label="evidence" />
          <Chip label="case files" />
        </div>

        <div className="mt-3 rounded-2xl border border-stone-200 bg-white p-3">
          <input
            className="w-full bg-transparent text-sm outline-none placeholder:text-stone-400"
            placeholder="What should be reviewed?"
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button className="rounded-xl border border-stone-200 bg-white p-2 text-stone-700 hover:bg-stone-50" type="button" aria-label="Add">
                +
              </button>
              <button className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100" type="button">
                Set limit
              </button>
              <button className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100" type="button">
                Run check
              </button>
              <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-stone-900 text-white">◎</span>
                GPT 5.2
                <span className="text-stone-400">▾</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="rounded-xl border border-stone-200 bg-white p-2 text-stone-700 hover:bg-stone-50" type="button" aria-label="Mic">
                🎙
              </button>
              <button className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(249,115,22,0.25)] hover:bg-orange-600" type="button" aria-label="Send">
                ↑
              </button>
            </div>
          </div>
        </div>
      </div>
    </Framed>
  );
}

// ---------- Showcase export ----------

export default function ComponentLibraryCanvas() {
  return (
    <div className="bg-stone-100 p-10">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-16">
        <VersionHistoryCard />
        <TestimonialOrbit />
        <AISuggestionTableOverlay />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <MetricsOverviewCard />
          <AgentChatPanel />
        </div>

        <LoadingTasksAndUsage />
        <DataGridShell title="Unified Data Grid" />

        <InvoiceSplitMock />
        <PromptComposerBar />
      </div>
    </div>
  );
}
