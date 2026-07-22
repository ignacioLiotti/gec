"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { usePrefetchObra } from "@/lib/use-prefetch-obra";
import {
  getObrasDetalleStatusParam,
  OBRAS_DETALLE_ACTIVE_TAB_STORAGE_KEY,
  OBRAS_DETALLE_DEFAULT_ACTIVE_TAB_ID,
  readObrasDetalleActiveTabFromStorage,
  type ObrasDetalleActiveTab,
} from "@/lib/excel/obra-list-tabs";

type ObraSummary = {
  id: string;
  n?: number | null;
  designacionYUbicacion?: string | null;
};

type HeaderObraState = {
  obraName: string;
  obraNumber: number | null;
  previousObra: ObraSummary | null;
  nextObra: ObraSummary | null;
  obras: ObraSummary[];
};

const EMPTY_OBRA_STATE: HeaderObraState = {
  obraName: "",
  obraNumber: null,
  previousObra: null,
  nextObra: null,
  obras: [],
};

const PAGE_NAME_MAP: Record<string, string> = {
  excel: "Detalle de las Obras en Ejecución",
  "excel/data-flow": "Data-flow general",
  certificados: "Certificados",
  notifications: "Notificaciones",
  admin: "Administración",
  viewer: "Visor",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeObraNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getObraHref(obraId: string) {
  return `/excel/${obraId}`;
}

function getObraDisplayLabel(obra: ObraSummary | null | undefined) {
  if (!obra) return "Seleccionar obra";
  const obraNumber = normalizeObraNumber(obra.n);
  const obraName = obra.designacionYUbicacion?.trim() ?? "";
  if (obraNumber != null && obraName) return `${obraNumber} ${obraName}`;
  if (obraNumber != null) return `Obra ${obraNumber}`;
  return obraName || "Obra sin nombre";
}

function HeaderControlTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const showTooltip = useCallback((target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 8,
      left: rect.left + rect.width / 2,
    });
    setIsOpen(true);
  }, []);

  const tooltip =
    isOpen && typeof document !== "undefined"
      ? createPortal(
        <span
          role="tooltip"
          className="pointer-events-none fixed z-[2147483647] -translate-x-1/2 whitespace-nowrap rounded-md border border-stone-950 bg-stone-950 px-3 py-1.5 text-xs font-medium text-white shadow-lg"
          style={{
            top: position.top,
            left: position.left,
          }}
        >
          {label}
        </span>,
        document.body
      )
      : null;

  return (
    <span
      className="inline-flex"
      onMouseEnter={(event) => showTooltip(event.currentTarget)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={(event) => showTooltip(event.currentTarget)}
      onBlur={() => setIsOpen(false)}
      onPointerDown={() => setIsOpen(false)}
    >
      {children}
      {tooltip}
    </span>
  );
}

export function ExcelObraName({ staticObra = null }: { staticObra?: ObraSummary | null } = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { prefetch, push } = router;
  const { prefetchObra } = usePrefetchObra();
  const obraComboboxListId = useId();
  const [isObraComboboxOpen, setIsObraComboboxOpen] = useState(false);
  const [activeListTab, setActiveListTab] = useState<ObrasDetalleActiveTab>(
    OBRAS_DETALLE_DEFAULT_ACTIVE_TAB_ID,
  );

  const match = pathname.match(/^\/excel\/([^/]+)(?:\/.*)?$/);
  const candidateObraId = match?.[1];
  const obraId = staticObra?.id ?? (candidateObraId && UUID_PATTERN.test(candidateObraId) ? candidateObraId : null);

  const getPageName = () => {
    const segments = pathname.split("/").filter(Boolean);
    const firstTwoSegments = segments.slice(0, 2).join("/");
    if (firstTwoSegments in PAGE_NAME_MAP) return PAGE_NAME_MAP[firstTwoSegments];
    const firstSegment = segments[0] || "";
    return PAGE_NAME_MAP[firstSegment] || firstSegment;
  };

  const pageName = getPageName();
  useEffect(() => {
    const syncActiveListTab = () => {
      setActiveListTab(
        readObrasDetalleActiveTabFromStorage() ?? OBRAS_DETALLE_DEFAULT_ACTIVE_TAB_ID,
      );
    };

    syncActiveListTab();

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === OBRAS_DETALLE_ACTIVE_TAB_STORAGE_KEY ||
        event.key === null
      ) {
        syncActiveListTab();
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const activeListStatus = getObrasDetalleStatusParam(activeListTab);


  const currentObraQuery = useQuery({
    queryKey: ["obra", obraId],
    enabled: Boolean(obraId) && !staticObra,
    queryFn: async () => {
      const response = await fetch(`/api/obras/${obraId}`);
      if (!response.ok) throw new Error("Failed to fetch obra");
      const data = await response.json();
      return data?.obra as ObraSummary;
    },
    staleTime: 5 * 60 * 1000,
    initialData: staticObra ?? undefined,
  });

  const obrasQuery = useQuery({
    queryKey: ["obras", "nav", "n", "asc", activeListTab],
    enabled: Boolean(obraId) && !staticObra,
    queryFn: async () => {
      const params = new URLSearchParams({ orderBy: "n", orderDir: "asc" });
      if (activeListStatus) params.set("status", activeListStatus);

      const response = await fetch(`/api/obras?${params.toString()}`);
      if (!response.ok) return [] as ObraSummary[];
      const data = await response.json();
      return Array.isArray(data?.detalleObras)
        ? (data.detalleObras as ObraSummary[])
        : [];
    },
    staleTime: 5 * 60 * 1000,
    initialData: staticObra ? [staticObra] : undefined,
  });

  const obraState = useMemo<HeaderObraState>(() => {
    if (!obraId) return EMPTY_OBRA_STATE;

    const obras = obrasQuery.data ?? [];
    const currentFromList = obras.find((obra) => obra.id === obraId);
    const currentObra = currentObraQuery.data ?? currentFromList ?? null;
    const currentIndex = obras.findIndex((obra) => obra.id === obraId);

    return {
      obraName: currentObra?.designacionYUbicacion || "",
      obraNumber: normalizeObraNumber(currentObra?.n),
      previousObra: currentIndex > 0 ? obras[currentIndex - 1] ?? null : null,
      nextObra:
        currentIndex >= 0 && currentIndex < obras.length - 1
          ? obras[currentIndex + 1] ?? null
          : null,
      obras,
    };
  }, [currentObraQuery.data, obraId, obrasQuery.data]);

  const isLoading = Boolean(obraId) && currentObraQuery.isLoading;

  const prefetchObraRoute = useCallback(
    (targetObra: ObraSummary | null | undefined) => {
      if (!targetObra?.id) return;
      prefetch(getObraHref(targetObra.id));
      prefetchObra(targetObra.id);
    },
    [prefetch, prefetchObra]
  );

  const handleNavigateToObra = (targetObra: ObraSummary | null | undefined) => {
    if (!targetObra?.id) return;
    prefetchObraRoute(targetObra);
    push(getObraHref(targetObra.id));
  };

  const handleBackToExcel = () => {
    push("/excel");
  };

  const displayName = obraId ? obraState.obraName : pageName;
  const fullDisplayName = obraId
    ? [obraState.obraNumber != null ? String(obraState.obraNumber) : "", obraState.obraName]
      .filter(Boolean)
      .join(" ")
    : pageName;
  const currentObraForCombobox = obraId
    ? obraState.obras.find((obra) => obra.id === obraId) ??
      currentObraQuery.data ?? {
        id: obraId,
        n: obraState.obraNumber,
        designacionYUbicacion: obraState.obraName,
      }
    : null;
  const obraComboboxOptions =
    currentObraForCombobox?.id &&
      !obraState.obras.some((obra) => obra.id === currentObraForCombobox.id)
      ? [currentObraForCombobox, ...obraState.obras]
      : obraState.obras;

  if (!displayName && !isLoading) return null;
  const isNavigationLoading = Boolean(obraId) && obrasQuery.isLoading;
  const isPreviousObraNavigationDisabled =
    !obraState.previousObra?.id || isLoading || isNavigationLoading;
  const isNextObraNavigationDisabled =
    !obraState.nextObra?.id || isLoading || isNavigationLoading;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1 pr-2 -ml-2 py-1">
      {obraId ? (
        <HeaderControlTooltip label="Volver a la lista de obras">
          <Button
            type="button"
            size="sm"
            className="h-8 shrink-0 gap-1.5 rounded-lg  px-2.5 mr-3 ml-2"
            onMouseEnter={() => prefetch("/excel")}
            onFocus={() => prefetch("/excel")}
            onClick={handleBackToExcel}
            aria-label="Volver a la lista de obras"
          >
            <ArrowLeft className="size-5" />
          </Button>
        </HeaderControlTooltip>
      ) : null}
      {isLoading ? (
        <Skeleton className="h-8 w-64" />
      ) : obraId ? (
        <HeaderControlTooltip label="Buscar una obra y navegar a su detalle">
          <Popover open={isObraComboboxOpen} onOpenChange={setIsObraComboboxOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                role="combobox"
                aria-controls={obraComboboxListId}
                aria-expanded={isObraComboboxOpen}
                aria-label="Seleccionar otra obra"
                disabled={obraComboboxOptions.length === 0}
                className="flex min-w-0 cursor-pointer items-baseline gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-100"
              >
                {obraState.obraNumber != null ? (
                  <span className="shrink-0 text-3xl font-semibold tabular-nums text-orange-primary">
                    {obraState.obraNumber}
                  </span>
                ) : null}
                <span className="truncate text-3xl font-normal max-w-[55vw]">
                  {displayName || "Cargando..."}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar obra..." />
                <CommandList id={obraComboboxListId}>
                  <CommandEmpty>No se encontraron obras.</CommandEmpty>
                  <CommandGroup>
                    {obraComboboxOptions.map((obra) => {
                      const isCurrentObra = obra.id === obraId;
                      const obraLabel = getObraDisplayLabel(obra);

                      return (
                        <CommandItem
                          key={obra.id}
                          value={`${obraLabel} ${obra.id}`}
                          aria-current={isCurrentObra ? "page" : undefined}
                          onMouseEnter={() => prefetchObraRoute(obra)}
                          onFocus={() => prefetchObraRoute(obra)}
                          onSelect={() => {
                            setIsObraComboboxOpen(false);
                            if (!isCurrentObra) handleNavigateToObra(obra);
                          }}
                        >
                          <Check
                            className={cn(
                              "size-4",
                              isCurrentObra ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="min-w-0 truncate">{obraLabel}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </HeaderControlTooltip>
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex min-w-0 items-baseline gap-2 cursor-default">
                {obraId && obraState.obraNumber != null ? (
                  <span className="shrink-0 text-3xl font-semibold tabular-nums text-orange-primary">
                    {obraState.obraNumber}
                  </span>
                ) : null}
                <span className="truncate text-3xl font-normal max-w-[55vw]">
                  {displayName || "Cargando..."}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-md text-md">{fullDisplayName || "Cargando..."}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}


      {obraId ? (
        <div className="flex shrink-0 items-center gap-1 pl-2">
          <HeaderControlTooltip label="Ir a la obra anterior en la lista activa">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-8 rounded-full text-muted-foreground hover:text-foreground"
              onMouseEnter={() => prefetchObraRoute(obraState.previousObra)}
              onFocus={() => prefetchObraRoute(obraState.previousObra)}
              onClick={() => handleNavigateToObra(obraState.previousObra)}
              disabled={isPreviousObraNavigationDisabled}
              aria-label={
                obraState.previousObra?.n != null
                  ? `Ir a la obra ${obraState.previousObra.n}`
                  : "Ir a la obra anterior"
              }
            >
              <ChevronLeft className="size-4" />
            </Button>
          </HeaderControlTooltip>
          <HeaderControlTooltip label="Ir a la obra siguiente en la lista activa">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-8 rounded-full text-muted-foreground hover:text-foreground"
              onMouseEnter={() => prefetchObraRoute(obraState.nextObra)}
              onFocus={() => prefetchObraRoute(obraState.nextObra)}
              onClick={() => handleNavigateToObra(obraState.nextObra)}
              disabled={isNextObraNavigationDisabled}
              aria-label={
                obraState.nextObra?.n != null
                  ? `Ir a la obra ${obraState.nextObra.n}`
                  : "Ir a la obra siguiente"
              }
            >
              <ChevronRight className="size-4" />
            </Button>
          </HeaderControlTooltip>
        </div>
      ) : null}
    </div>
  );
}
