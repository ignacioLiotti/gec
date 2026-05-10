"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePrefetchObra } from "@/lib/use-prefetch-obra";

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

function getObraLabel(obra: ObraSummary) {
  const obraNumber = normalizeObraNumber(obra.n);
  const obraName = obra.designacionYUbicacion?.trim() || "";
  return [obraNumber != null ? String(obraNumber) : "", obraName].filter(Boolean).join(" ");
}

export function ExcelObraName() {
  const pathname = usePathname();
  const router = useRouter();
  const { prefetch, push } = router;
  const { prefetchObra } = usePrefetchObra();
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  const match = pathname.match(/^\/excel\/([^/]+)(?:\/.*)?$/);
  const candidateObraId = match?.[1];
  const obraId = candidateObraId && UUID_PATTERN.test(candidateObraId) ? candidateObraId : null;

  const getPageName = () => {
    const segments = pathname.split("/").filter(Boolean);
    const firstTwoSegments = segments.slice(0, 2).join("/");
    if (firstTwoSegments in PAGE_NAME_MAP) return PAGE_NAME_MAP[firstTwoSegments];
    const firstSegment = segments[0] || "";
    return PAGE_NAME_MAP[firstSegment] || firstSegment;
  };

  const pageName = getPageName();

  const currentObraQuery = useQuery({
    queryKey: ["obra", obraId],
    enabled: Boolean(obraId),
    queryFn: async () => {
      const response = await fetch(`/api/obras/${obraId}`);
      if (!response.ok) throw new Error("Failed to fetch obra");
      const data = await response.json();
      return data?.obra as ObraSummary;
    },
    staleTime: 5 * 60 * 1000,
  });

  const obrasQuery = useQuery({
    queryKey: ["obras", "nav", "n", "asc"],
    enabled: Boolean(obraId),
    queryFn: async () => {
      const response = await fetch("/api/obras?orderBy=n&orderDir=asc");
      if (!response.ok) return [] as ObraSummary[];
      const data = await response.json();
      return Array.isArray(data?.detalleObras)
        ? (data.detalleObras as ObraSummary[])
        : [];
    },
    staleTime: 5 * 60 * 1000,
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
    [prefetchObra, router]
  );

  const handleNavigateToObra = (targetObra: ObraSummary | null | undefined) => {
    if (!targetObra?.id) return;
    prefetchObraRoute(targetObra);
    setIsSelectorOpen(false);
    push(getObraHref(targetObra.id));
  };

  const displayName = obraId ? obraState.obraName : pageName;
  const fullDisplayName = obraId
    ? [obraState.obraNumber != null ? String(obraState.obraNumber) : "", obraState.obraName]
      .filter(Boolean)
      .join(" ")
    : pageName;

  if (!displayName && !isLoading) return null;

  return (
    <div className="flex min-w-0 items-center gap-1 pr-2 -ml-2 py-1">
      {obraId ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-8 rounded-full text-muted-foreground hover:text-foreground"
          onMouseEnter={() => prefetchObraRoute(obraState.previousObra)}
          onFocus={() => prefetchObraRoute(obraState.previousObra)}
          onClick={() => handleNavigateToObra(obraState.previousObra)}
          disabled={!obraState.previousObra?.id || isLoading}
          aria-label={
            obraState.previousObra?.n != null
              ? `Ir a la obra ${obraState.previousObra.n}`
              : "Ir a la obra anterior"
          }
        >
          <ChevronLeft className="size-4" />
        </Button>
      ) : null}

      {isLoading ? (
        <Skeleton className="h-8 w-64" />
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
        <Popover open={isSelectorOpen} onOpenChange={setIsSelectorOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-2 h-8 rounded-full border-[#eadfce] bg-white px-3 text-xs text-[#5a5248] hover:bg-[#fcfaf7] sm:text-sm"
              disabled={isLoading || obraState.obras.length === 0}
              aria-label="Seleccionar otra obra"
            >
              <Search className="size-4" />
              <span className="hidden sm:inline">Ir a obra</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[min(32rem,calc(100vw-2rem))] p-0">
            <Command>
              <CommandInput placeholder="Buscar por numero o nombre..." />
              <CommandList className="max-h-[22rem]">
                <CommandEmpty>No se encontro ninguna obra.</CommandEmpty>
                {obraState.obras.map((obra) => {
                  const obraNumber = normalizeObraNumber(obra.n);
                  const isCurrentObra = obra.id === obraId;

                  return (
                    <CommandItem
                      key={obra.id}
                      value={getObraLabel(obra)}
                      onSelect={() => handleNavigateToObra(obra)}
                      className="gap-3 px-3 py-2"
                    >
                      <span className="min-w-10 shrink-0 text-sm font-semibold tabular-nums text-orange-primary">
                        {obraNumber != null ? obraNumber : "-"}
                      </span>
                      <span className="truncate text-sm text-foreground">
                        {obra.designacionYUbicacion || "Obra sin nombre"}
                      </span>
                      {isCurrentObra ? (
                        <Check className="ml-auto size-4 text-primary" />
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      ) : null}

      {obraId ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-8 rounded-full text-muted-foreground hover:text-foreground"
          onMouseEnter={() => prefetchObraRoute(obraState.nextObra)}
          onFocus={() => prefetchObraRoute(obraState.nextObra)}
          onClick={() => handleNavigateToObra(obraState.nextObra)}
          disabled={!obraState.nextObra?.id || isLoading}
          aria-label={
            obraState.nextObra?.n != null
              ? `Ir a la obra ${obraState.nextObra.n}`
              : "Ir a la obra siguiente"
          }
        >
          <ChevronRight className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
