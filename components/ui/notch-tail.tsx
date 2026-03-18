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
        d="M0 1H7.0783C14.772 1 21.7836 5.41324 25.111 12.3501L33.8889 30.6498C37.2164 37.5868 44.228 42 51.9217 42H60H0V1Z"
        className="fill-[var(--notch-bg)]"
      />
      <path
        d="M0 1H7.0783C14.772 1 21.7836 5.41324 25.111 12.3501L33.8889 30.6498C37.2164 37.5868 44.228 42 51.9217 42H60"
        className="fill-none stroke-[var(--notch-stroke)]"
      />
      <path d="M0 1H7" className="fill-none stroke-[var(--notch-stroke)]" />
    </svg>
  );
}
