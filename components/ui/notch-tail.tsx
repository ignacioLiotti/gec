type NotchTailProps = {
  side?: "left" | "right";
  className?: string;
};

export function NotchTail({ side = "right", className = "" }: NotchTailProps) {
  return (
    <svg
      width="60"
      height="42"
      viewBox="0 0 60 42"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={[
        "pointer-events-none absolute bottom-[-1px] h-[42px] w-[60px]",
        side === "right" ? "right-[-59px]" : "left-[-59px] scale-x-[-1]",
        className,
      ].join(" ")}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0 0H7.0783C14.772 0 21.7836 4.41324 25.111 11.3501L33.8889 29.6498C37.2164 36.5868 44.228 41 51.9217 41H60V42H0V0Z"
        className="fill-[hsl(var(--surface))]"
      />
      <path
        d="M0 0H7.0783C14.772 0 21.7836 4.41324 25.111 11.3501L33.8889 29.6498C37.2164 36.5868 44.228 41 51.9217 40H60"
        className="fill-none stroke-[#e2e2e2]"
      />
      <path
        d="M0 1H7.0783C14.772 1 20.8816 4.8462 24.209 11.7831L32.9869 30.0828C36.3144 37.0198 44.228 40 51.9217 43H59"
        className="fill-none stroke-white"
      />
      <path d="M0 0H7" className="fill-none stroke-[var(--notch-stroke)]" />
    </svg>
  );
}
