"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Map paths to custom display names
const PAGE_NAME_MAP: Record<string, string> = {
  excel: "Detalle de las Obras en Ejecución",
  certificados: "Certificados",
  notifications: "Notificaciones",
  admin: "Administración",
  viewer: "Visor",
  // Add more mappings as needed
};

export function ExcelObraName() {
  const pathname = usePathname();
  const [obraName, setObraName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Extract obraId from path /excel/[obraId]
  const match = pathname.match(/^\/excel\/([^/]+)$/);
  const obraId = match?.[1];

  // Extract page name from pathname (e.g., /excel -> "excel", /certificados -> "certificados")
  // and check for custom name mapping
  const getPageName = () => {
    const segments = pathname.split("/").filter(Boolean);
    const firstSegment = segments[0] || "";
    // Return custom name if mapped, otherwise return the path segment
    return PAGE_NAME_MAP[firstSegment] || firstSegment;
  };

  const pageName = getPageName();

  useEffect(() => {
    if (!obraId) {
      setObraName("");
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    async function fetchObraName() {
      try {
        const response = await fetch(`/api/obras/${obraId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch obra");
        }
        const data = await response.json();
        if (isMounted) {
          // API returns { obra: {...} }
          setObraName(data.obra?.designacionYUbicacion || "");
        }
      } catch (error) {
        console.error("Error fetching obra name:", error);
        if (isMounted) {
          setObraName("");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void fetchObraName();

    return () => {
      isMounted = false;
    };
  }, [obraId]);

  // Show page name if no obraId, show obra name if obraId exists
  const displayName = obraId ? obraName : pageName;

  if (!displayName && !isLoading) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      {isLoading ? (
        <Skeleton className="h-4 w-48" />
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-lg font-medium truncate max-w-xs cursor-default">
                {displayName || "Cargando..."}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-md text-xl">{displayName || "Cargando..."}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
