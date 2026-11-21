import { useSyncExternalStore } from "react";
import { toast } from "sonner";
const subscribe = (callback: () => void) => {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
};
export function useGuideRoute() {
  return useSyncExternalStore(
    subscribe,
    () => window.location.hash.slice(1) || "overview",
    () => "overview",
  );
}
export function guideDestination(href: string) {
  if (href.startsWith("#")) return href;
  if (href.includes("data-flow")) return "#data-flow";
  if (href.includes("reporte")) return "#reports";
  if (href === "/excel") return "#obras";
  if (href.startsWith("/excel/")) return "#documents";
  if (href.includes("obra-defaults")) return "#setup";
  if (href.includes("document-generation")) return "#documents";
  return "#operations";
}
export function navigate(href: string) {
  if (href === "/guide/policies") {
    toast.info(
      "El registro de pólizas no está incluido en esta selección. Podés explorar los vencimientos y sus métricas en este panel.",
    );
    return;
  }
  const destination = guideDestination(href);
  if (window.parent !== window) window.parent.location.hash = destination;
  else window.location.href = "./" + destination;
}
const router = {
  push: navigate,
  replace: navigate,
  back: () => window.history.back(),
  refresh: () => window.location.reload(),
  prefetch: async () => {},
};
export const useRouter = () => router;
export const useParams = () => ({ obraId: "sample-obra-24" });
export const usePathname = () => "/portfolio-guide";
export const useSearchParams = () => new URLSearchParams();
