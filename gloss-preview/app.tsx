import { useEffect, useRef, useState } from "react";
import { Building2, FilePlus2, Home, Menu, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  PreviewActions,
  PreviewDataset,
  PreviewDocument,
  PreviewRoute,
} from "./contracts";
import { createPreviewDataset } from "./fixtures";
import { DashboardPreview } from "./screens/dashboard";
import { ObrasPreview } from "./screens/obras";
import { GeneralPreview } from "./screens/general";
import { DocumentsPreview } from "./screens/documents";
import { GenerationPreview } from "./screens/generation";

function readRoute(): PreviewRoute {
  try {
    const url = new URL(
      location.hash.slice(1) || "/dashboard",
      "https://preview.local",
    );
    if (url.pathname === "/excel") return { view: "obras" };
    if (url.pathname.startsWith("/excel/")) {
      const obraId = decodeURIComponent(url.pathname.slice(7));
      return url.searchParams.get("tab") === "documentos-new"
        ? {
            view: "documents",
            obraId,
            folderPath: url.searchParams.get("folder") || undefined,
            documentId: url.searchParams.get("file") || undefined,
            mode:
              url.searchParams.get("mode") === "table" ? "table" : "files",
          }
        : { view: "general", obraId };
    }
    if (url.pathname === "/document-generation")
      return {
        view: "generation",
        obraId: url.searchParams.get("obra") || undefined,
        draftId: url.searchParams.get("draft") || undefined,
      };
    return { view: "dashboard" };
  } catch {
    return { view: "obras" };
  }
}
function routeHash(route: PreviewRoute) {
  if (route.view === "dashboard") return "#/dashboard";
  if (route.view === "obras") return "#/excel";
  if (route.view === "generation") {
    const params = new URLSearchParams();
    if (route.obraId) params.set("obra", route.obraId);
    if (route.draftId) params.set("draft", route.draftId);
    return `#/document-generation${params.size ? `?${params}` : ""}`;
  }
  const params = new URLSearchParams({
    tab: route.view === "documents" ? "documentos-new" : "general",
  });
  if (route.view === "documents") {
    if (route.folderPath) params.set("folder", route.folderPath);
    if (route.documentId) params.set("file", route.documentId);
    if (route.mode) params.set("mode", route.mode);
  }
  return `#/excel/${encodeURIComponent(route.obraId)}?${params}`;
}

export function App() {
  const [data, setData] = useState<PreviewDataset>(createPreviewDataset);
  const [route, setRoute] = useState<PreviewRoute>(readRoute);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const headingRef = useRef<HTMLElement>(null);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const resetTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRestoreFocusRef = useRef(true);
  const resetRestoreFocusRef = useRef(true);
  useEffect(() => {
    const sync = () => setRoute(readRoute());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const navigate = (next: PreviewRoute) => {
    const staysInDocumentView =
      route.view === "documents" &&
      next.view === "documents" &&
      route.obraId === next.obraId;
    if (mobileMenu) mobileMenuRestoreFocusRef.current = false;
    window.location.assign(routeHash(next));
    setRoute(next);
    setMobileMenu(false);
    if (!staysInDocumentView) {
      requestAnimationFrame(() =>
        headingRef.current?.focus({ preventScroll: true }),
      );
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const actions: PreviewActions = {
    onNavigate: navigate,
    onSaveObra: (id, patch) =>
      setData((current) => ({
        ...current,
        obras: current.obras.map((obra) =>
          obra.id === id ? { ...obra, ...patch } : obra,
        ),
      })),
    onAddObra: (obra) =>
      setData((current) => ({ ...current, obras: [...current.obras, obra] })),
    onSaveDraft: (draft) =>
      setData((current) => ({
        ...current,
        drafts: [
          ...current.drafts.filter((d) => d.id !== draft.id),
          structuredClone(draft),
        ],
      })),
    onGenerateDocument: (draft) => {
      const document: PreviewDocument = {
        id: `generated-${crypto.randomUUID()}`,
        obraId: draft.obraId,
        folderPath: draft.folderPath,
        name: `${draft.code}.html`,
        size: "Documento de ejemplo",
        date: draft.date,
        status: "extracted",
        kind: "html",
        generated: true,
        draftId: draft.id,
        content: structuredClone(draft),
        rows: draft.rows.map((row) => ({ ...row, date: draft.date })),
      };
      setData((current) => ({
        ...current,
        documents: [...current.documents, document],
        drafts: [
          ...current.drafts.filter((d) => d.id !== draft.id),
          structuredClone(draft),
        ],
      }));
      return document;
    },
    onAddDocument: (document) =>
      setData((current) => ({
        ...current,
        documents: [...current.documents, document],
      })),
    onUpdateDocument: (id, patch) =>
      setData((current) => ({
        ...current,
        documents: current.documents.map((d) =>
          d.id === id ? { ...d, ...patch } : d,
        ),
      })),
    onDeleteDocument: (id) =>
      setData((current) => ({
        ...current,
        documents: current.documents.filter((d) => d.id !== id),
      })),
  };
  const navItems = [
    { view: "dashboard" as const, label: "Inicio", icon: Home },
    { view: "obras" as const, label: "Obras", icon: Building2 },
    {
      view: "generation" as const,
      label: "Generar documentos",
      icon: FilePlus2,
    },
  ];
  const nav = (
    <nav className="gp-nav" aria-label="Navegación principal">
      <p>Espacio de trabajo</p>
      {navItems.map((item) => (
        <button
          key={item.view}
          type="button"
          aria-current={
            route.view === item.view ||
            (item.view === "obras" &&
              (route.view === "general" || route.view === "documents"))
              ? "page"
              : undefined
          }
          onClick={() => navigate({ view: item.view })}
        >
          <item.icon />
          {item.label}
        </button>
      ))}
    </nav>
  );
  const obraId =
    "obraId" in route && route.obraId ? route.obraId : data.obras[0]?.id;
  const validObra = Boolean(data.obras.find((o) => o.id === obraId));
  const titles = {
    dashboard: "Inicio",
    obras: "Obras",
    general: "Obras / General",
    documents: "Obras / Documentos New",
    generation: "Generar documentos",
  };
  return (
    <div className="gp-shell">
      <aside className="gp-sidebar">
        <div className="gp-brand">
          <span className="gp-brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          síntesis<span style={{ color: "var(--gp-accent)" }}>.</span>
        </div>
        <div className="gp-tenant">
          <span className="gp-tenant-icon">CR</span>
          <div>
            <strong>Constructora Río</strong>Organización de ejemplo
          </div>
        </div>
        {nav}
        <div className="gp-sidebar-note">
          Vista de comparación
          <br />
          Estilo Gloss · datos ficticios
        </div>
      </aside>
      <div className="gp-main">
        <header className="gp-topbar">
          <div className="gp-topbar-left">
            <Button
              ref={mobileMenuTriggerRef}
              variant="ghost"
              size="icon"
              className="gp-mobile-menu"
              aria-label="Abrir navegación"
              onClick={() => {
                mobileMenuRestoreFocusRef.current = true;
                setMobileMenu(true);
              }}
            >
              <Menu />
            </Button>
            <span>Constructora Río</span>
            <span aria-hidden="true">/</span>
            {titles[route.view]}
          </div>
          <div className="gp-topbar-actions">
            <span>Datos de ejemplo</span>
            <Button
              ref={resetTriggerRef}
              variant="ghost"
              size="sm"
              onClick={() => {
                resetRestoreFocusRef.current = true;
                setResetOpen(true);
              }}
              title="Restablecer los datos de ejemplo"
            >
              <RotateCcw />
              Restablecer
            </Button>
            <div className="gp-avatar" aria-label="Usuario de ejemplo">
              JM
            </div>
          </div>
        </header>
        <main
          className="gp-content"
          tabIndex={-1}
          ref={headingRef}
          key={revision}
          aria-label={titles[route.view]}
        >
          {route.view === "dashboard" && (
            <DashboardPreview data={data} actions={actions} />
          )}{" "}
          {route.view === "obras" && (
            <ObrasPreview data={data} actions={actions} />
          )}{" "}
          {route.view === "general" && validObra && (
            <GeneralPreview
              key={obraId}
              data={data}
              actions={actions}
              obraId={obraId}
            />
          )}{" "}
          {route.view === "documents" && validObra && (
            <DocumentsPreview
              key={obraId}
              data={data}
              actions={actions}
              obraId={obraId}
              folderPath={route.folderPath}
              documentId={route.documentId}
              mode={route.mode}
            />
          )}{" "}
          {route.view === "generation" && (
            <GenerationPreview
              key={route.draftId || "generation"}
              data={data}
              actions={actions}
              obraId={route.obraId}
              draftId={route.draftId}
            />
          )}{" "}
          {(route.view === "general" || route.view === "documents") &&
            !validObra && (
              <div className="gp-empty">
                <h1>Obra no encontrada</h1>
                <Button onClick={() => navigate({ view: "obras" })}>
                  Volver a Obras
                </Button>
              </div>
            )}
        </main>
      </div>
      <Dialog open={mobileMenu} onOpenChange={setMobileMenu}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (mobileMenuRestoreFocusRef.current) {
              mobileMenuTriggerRef.current?.focus();
            }
            mobileMenuRestoreFocusRef.current = true;
          }}
        >
          <DialogHeader>
            <DialogTitle>Síntesis</DialogTitle>
            <DialogDescription>
              Vistas de comparación con datos de ejemplo.
            </DialogDescription>
          </DialogHeader>
          {nav}
        </DialogContent>
      </Dialog>
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (resetRestoreFocusRef.current) {
              resetTriggerRef.current?.focus();
            }
            resetRestoreFocusRef.current = true;
          }}
        >
          <DialogHeader>
            <DialogTitle>Restablecer la comparación</DialogTitle>
            <DialogDescription>
              Se descartan las ediciones, borradores y documentos creados en
              esta sesión de ejemplo.
            </DialogDescription>
          </DialogHeader>
          <div className="gp-heading-actions">
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                resetRestoreFocusRef.current = false;
                setData(createPreviewDataset());
                setRevision((r) => r + 1);
                setResetOpen(false);
                navigate({ view: "dashboard" });
              }}
            >
              Restablecer datos
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
