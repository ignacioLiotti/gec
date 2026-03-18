"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
};

const EMPTY_OBRA_STATE: HeaderObraState = {
  obraName: "",
  obraNumber: null,
  previousObra: null,
  nextObra: null,
};

// Map paths to custom display names
const PAGE_NAME_MAP: Record<string, string> = {
  excel: "Detalle de las Obras en Ejecución",
  certificados: "Certificados",
  notifications: "Notificaciones",
  admin: "Administración",
  viewer: "Visor",
};

function normalizeObraNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function ExcelObraName() {
  const pathname = usePathname();
  const router = useRouter();
  const [obraState, setObraState] = useState<HeaderObraState>(EMPTY_OBRA_STATE);
  const [isLoading, setIsLoading] = useState(false);

  // Extract obraId from path /excel/[obraId]
  const match = pathname.match(/^\/excel\/([^/]+)$/);
  const obraId = match?.[1];

  const getPageName = () => {
    const segments = pathname.split("/").filter(Boolean);
    const firstSegment = segments[0] || "";
    return PAGE_NAME_MAP[firstSegment] || firstSegment;
  };

  const pageName = getPageName();

  useEffect(() => {
    if (!obraId) {
      setObraState(EMPTY_OBRA_STATE);
      setIsLoading(false);
      return;
    }

    const abortController = new AbortController();
    let isMounted = true;

    async function fetchObraHeader() {
      setIsLoading(true);

      try {
        const obraResponse = await fetch(`/api/obras/${obraId}`, {
          signal: abortController.signal,
        });

        if (!obraResponse.ok) {
          throw new Error("Failed to fetch obra");
        }

        const obraData = await obraResponse.json();
        const currentObra = obraData?.obra as ObraSummary | undefined;

        let previousObra: ObraSummary | null = null;
        let nextObra: ObraSummary | null = null;

        try {
          const obrasResponse = await fetch("/api/obras?orderBy=n&orderDir=asc", {
            signal: abortController.signal,
          });

          if (obrasResponse.ok) {
            const obrasData = await obrasResponse.json();
            const obras = Array.isArray(obrasData?.detalleObras)
              ? (obrasData.detalleObras as ObraSummary[])
              : [];
            const currentIndex = obras.findIndex((obra) => obra.id === obraId);

            if (currentIndex > 0) {
              previousObra = obras[currentIndex - 1] ?? null;
            }
            if (currentIndex >= 0 && currentIndex < obras.length - 1) {
              nextObra = obras[currentIndex + 1] ?? null;
            }
          }
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            throw error;
          }
          console.error("Error fetching obra navigation:", error);
        }

        if (isMounted) {
          setObraState({
            obraName: currentObra?.designacionYUbicacion || "",
            obraNumber: normalizeObraNumber(currentObra?.n),
            previousObra,
            nextObra,
          });
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Error fetching obra name:", error);
        if (isMounted) {
          setObraState(EMPTY_OBRA_STATE);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void fetchObraHeader();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [obraId]);

  const displayName = obraId ? obraState.obraName : pageName;
  const fullDisplayName = obraId
    ? [obraState.obraNumber != null ? String(obraState.obraNumber) : "", obraState.obraName]
        .filter(Boolean)
        .join(" ")
    : pageName;

  if (!displayName && !isLoading) return null;

  return (
    <div className="flex min-w-0 items-center gap-1 px-2 py-1">
      {obraId ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
          onClick={() => {
            if (!obraState.previousObra?.id) return;
            router.push(`/excel/${obraState.previousObra.id}`);
          }}
          disabled={!obraState.previousObra?.id || isLoading}
          aria-label={
            obraState.previousObra?.n != null
              ? `Ir a la obra ${obraState.previousObra.n}`
              : "Ir a la obra anterior"
          }
        >
          <ChevronLeft className="h-4 w-4" />
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
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
          onClick={() => {
            if (!obraState.nextObra?.id) return;
            router.push(`/excel/${obraState.nextObra.id}`);
          }}
          disabled={!obraState.nextObra?.id || isLoading}
          aria-label={
            obraState.nextObra?.n != null
              ? `Ir a la obra ${obraState.nextObra.n}`
              : "Ir a la obra siguiente"
          }
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}
