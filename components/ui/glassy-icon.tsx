import type { CSSProperties, ReactNode } from "react";

type GlassyIconProps = {
  className?: string;
  title?: string;
  primaryVar?: string;
  children: ReactNode;
  size?: number;
  rounded?: string;
};

export function GlassyIcon({
  className = "",
  title = "Power Lightning",
  primaryVar = "var(--color-orange-primary)",
  children,
  size = 10,
  rounded = "lg",
}: GlassyIconProps) {
  return (
    <div
      title={title}
      className={[
        `relative flex h-${size} shrink-0 items-center justify-center rounded-${rounded}`,
        "transition-colors duration-300",
        "[&_*]:transition-colors [&_*]:duration-300",
        className,
      ].join(" ")}
      style={
        {
          ["--primary" as const]: primaryVar,
          color: "var(--primary)",
        } as CSSProperties
      }
    >
      {children}

      <div className={`gradient-ring absolute inset-0 rounded-${rounded}`} />
      <div className={`gradient-shadow absolute inset-0 rounded-${rounded} bg-[var(--primary)]/20`} />
    </div>
  );
}
