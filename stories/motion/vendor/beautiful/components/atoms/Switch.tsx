// MIT source: https://github.com/slev12397/beautiful-ui/blob/06557d7ff33a1eb70d5987bae9ac4c70fa0e20c4/components/atoms/Switch.tsx
// Adaptations: import isolation and Sintesis visual token mapping. See ../../LICENSE.
"use client";

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200
        ${checked ? "bg-[var(--mr-ink)]" : "bg-[var(--mr-line-strong)]"}`}
    >
      <span
        className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white
          shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform duration-200"
        style={{
          transform: checked ? "translateX(16px)" : "translateX(0)",
          transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      />
    </button>
  );
}
