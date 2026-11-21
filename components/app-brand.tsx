/** Shared identity from the application sidebar, including its collapsed state. */
export function AppBrand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <>
      <div
        className={`bg-orange-primary text-sidebar-primary-foreground flex aspect-square items-center justify-center rounded-full transition-[width,height,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${collapsed ? "size-8 scale-95" : "size-10 scale-100"}`}
      />
      <div className="grid flex-1 text-left text-sm leading-tight transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-data-[collapsible=icon]:-translate-x-1 group-data-[collapsible=icon]:opacity-0">
        <span className="truncate font-mono text-lg font-semibold leading-[16px]">
          Síntesis
        </span>
        <span className="truncate text-xs">Plataforma de gestión</span>
      </div>
    </>
  );
}
