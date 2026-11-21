// MIT source: https://github.com/slev12397/beautiful-ui/blob/06557d7ff33a1eb70d5987bae9ac4c70fa0e20c4/components/atoms/Shimmer.tsx
// Adaptations: import isolation and Sintesis visual token mapping. See ../../LICENSE.
/** Shimmering label — signals the agent is processing. */
export function Shimmer({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-block bg-clip-text text-transparent ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(90deg, var(--mr-ink-3) 35%, var(--mr-ink) 50%, var(--mr-ink-3) 65%)",
        backgroundSize: "200% 100%",
        animation: "mr-beautiful-shimmer-text 1.8s linear infinite",
      }}
    >
      {children}
    </span>
  );
}
