function LoadingCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={[
        "animate-pulse rounded-xl border border-[#ece7df] bg-white/80",
        className,
      ].join(" ")}
    />
  );
}

export default function ExcelLoading() {
  return (
    <div className="flex-1 space-y-5 px-4 py-4 md:px-6">
      <div className="space-y-2">
        <LoadingCard className="h-9 w-56" />
        <LoadingCard className="h-4 w-80 max-w-full" />
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <LoadingCard className="h-14 w-full xl:max-w-[560px]" />
        <LoadingCard className="h-14 w-full xl:max-w-[280px]" />
      </div>

      <div className="rounded-xl border border-[#ece7df] bg-white p-3 shadow-card">
        <div className="grid grid-cols-6 gap-3 border-b border-[#ece7df] pb-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <LoadingCard key={index} className="h-4" />
          ))}
        </div>
        <div className="space-y-3 pt-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="grid grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((__, cellIndex) => (
                <LoadingCard key={cellIndex} className="h-10" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
