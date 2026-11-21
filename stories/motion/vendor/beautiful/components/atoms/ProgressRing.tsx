// MIT source: https://github.com/slev12397/beautiful-ui/blob/06557d7ff33a1eb70d5987bae9ac4c70fa0e20c4/components/atoms/ProgressRing.tsx
// Adaptations: import isolation and Sintesis visual token mapping. See ../../LICENSE.
/** Small progress ring with content in the center — the task-badge from the refs. */
export function ProgressRing({
  progress,
  tone = "orange",
  children,
  size = 28,
}: {
  progress: number; // 0..1
  tone?: "orange" | "green" | "red" | "accent";
  children?: React.ReactNode;
  size?: number;
}) {
  const stroke = 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tones = {
    orange: "var(--mr-orange)",
    green: "var(--mr-green)",
    red: "var(--mr-red)",
    accent: "var(--mr-accent)",
  };
  return (
    <span
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90 absolute inset-0">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--mr-line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tones[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, progress)))}
          style={{ transition: "stroke-dashoffset 400ms cubic-bezier(0.23,1,0.32,1)" }}
        />
      </svg>
      <span className="relative text-[12px] font-semibold tabular-nums">
        {children}
      </span>
    </span>
  );
}
