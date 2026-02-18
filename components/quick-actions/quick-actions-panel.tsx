"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type DragEvent } from "react";
import { Check, ChevronRight, FileText, Loader2, Upload, X, Zap, FolderOpen } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

import { useIsMobile } from "@/hooks/use-mobile";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import type { OcrTablaColumn } from "@/app/excel/[obraId]/tabs/file-manager/types";

type QuickAction = {
  id: string;
  name: string;
  description?: string | null;
  folderPaths: string[];
  obraId?: string | null;
};

type DefaultFolder = {
  id: string;
  name: string;
  path: string;
  isOcr?: boolean;
  dataInputMethod?: "ocr" | "manual" | "both";
};

type ObraTabla = {
  id: string;
  name: string;
  settings: Record<string, unknown>;
  columns: OcrTablaColumn[];
};

type QuickActionsPanelProps = {
  obraId: string;
  actions: QuickAction[];
  folders: DefaultFolder[];
  tablas: ObraTabla[];
  customStepRenderers?: Record<
    string,
    (args: {
      stepId: string;
      folder: DefaultFolder;
      tabla: ObraTabla | null;
      mode: StepMode;
      values: Record<string, unknown>;
      setValue: (key: string, value: unknown) => void;
      submit: () => void;
      isSubmitting: boolean;
    }) => ReactNode
  >;
};

type StepMode = "ocr" | "manual" | "files";

function getStepLabel(folder: DefaultFolder) {
  if (!folder.isOcr) return "Subir archivos";
  if (folder.dataInputMethod === "manual") return "Carga manual";
  if (folder.dataInputMethod === "ocr") return "OCR";
  return "OCR o manual";
}

const panelMotion = {
  initial: { opacity: 0, y: 12, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 12, scale: 0.96 },
  transition: { type: "spring", stiffness: 400, damping: 30 },
} as const;

const listItemMotion = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
  transition: { type: "spring", stiffness: 500, damping: 30 },
} as const;

export function QuickActionsPanel({
  obraId,
  actions,
  folders,
  tablas,
  customStepRenderers = {},
}: QuickActionsPanelProps) {
  const isMobile = useIsMobile();
  const [localActions, setLocalActions] = useState<QuickAction[]>(actions);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newActionName, setNewActionName] = useState("");
  const [newActionDescription, setNewActionDescription] = useState("");
  const [newActionFolderPaths, setNewActionFolderPaths] = useState<string[]>([]);
  const [isCreatingAction, setIsCreatingAction] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<QuickAction | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [stepModes, setStepModes] = useState<Record<string, StepMode>>({});
  const [fileByStep, setFileByStep] = useState<Record<string, File | null>>({});
  const [manualValues, setManualValues] = useState<Record<string, Record<string, unknown>>>({});
  const [isSubmittingStep, setIsSubmittingStep] = useState(false);

  useEffect(() => {
    setLocalActions(actions);
  }, [actions]);

  const allActionFolders = useMemo(() => {
    const merged = [...folders];
    const seenPaths = new Set(folders.map((folder) => folder.path));
    for (const tabla of tablas) {
      const settings = (tabla.settings ?? {}) as Record<string, unknown>;
      const rawPath =
        typeof settings.ocrFolder === "string"
          ? settings.ocrFolder.trim()
          : typeof settings.linkedFolderPath === "string"
            ? settings.linkedFolderPath.trim()
            : "";
      if (!rawPath || seenPaths.has(rawPath)) continue;
      seenPaths.add(rawPath);
      const rawMode = settings.dataInputMethod;
      const dataInputMethod =
        rawMode === "ocr" || rawMode === "manual" || rawMode === "both" ? rawMode : "both";
      merged.push({
        id: `tabla-folder-${tabla.id}`,
        name: tabla.name,
        path: rawPath,
        isOcr: true,
        dataInputMethod,
      });
    }
    return merged;
  }, [folders, tablas]);

  const tablasByFolderPath = useMemo(() => {
    const map = new Map<string, ObraTabla[]>();
    for (const tabla of tablas) {
      const folderPath = typeof tabla.settings?.ocrFolder === "string" ? (tabla.settings.ocrFolder as string) : null;
      if (!folderPath) continue;
      const existing = map.get(folderPath) ?? [];
      existing.push(tabla);
      map.set(folderPath, existing);
    }
    return map;
  }, [tablas]);

  const steps = useMemo(() => {
    if (!activeAction) return [];
    return activeAction.folderPaths
      .map((path) => {
        const folder = allActionFolders.find((f) => f.path === path);
        if (!folder) return null;
        const tablasForFolder = folder.isOcr ? tablasByFolderPath.get(path) ?? [] : [];
        return { id: path, folder, tabla: tablasForFolder[0] ?? null, tablas: tablasForFolder };
      })
      .filter(Boolean) as Array<{ id: string; folder: DefaultFolder; tabla: ObraTabla | null; tablas: ObraTabla[] }>;
  }, [activeAction, allActionFolders, tablasByFolderPath]);

  const resetCreateActionForm = useCallback(() => {
    setNewActionName("");
    setNewActionDescription("");
    setNewActionFolderPaths([]);
  }, []);

  const toggleCreateActionFolderPath = useCallback((path: string, checked: boolean) => {
    setNewActionFolderPaths((prev) => {
      if (checked) {
        if (prev.includes(path)) return prev;
        return [...prev, path];
      }
      return prev.filter((item) => item !== path);
    });
  }, []);

  const createObraQuickAction = useCallback(async () => {
    const name = newActionName.trim();
    if (!name) {
      toast.error("Ingresá un nombre para la acción rápida.");
      return;
    }
    if (newActionFolderPaths.length === 0) {
      toast.error("Seleccioná al menos una carpeta/paso.");
      return;
    }

    setIsCreatingAction(true);
    try {
      const response = await fetch("/api/obra-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "quick-action",
          obraId,
          name,
          description: newActionDescription.trim() || null,
          folderPaths: newActionFolderPaths,
        }),
      });
      const payload = await response.json().catch(() => ({} as any));
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo crear la acción rápida");
      }

      const created = payload?.quickAction as QuickAction | undefined;
      if (created) {
        setLocalActions((prev) => [...prev, created]);
      }
      toast.success("Acción rápida creada para esta obra.");
      setIsCreateDialogOpen(false);
      resetCreateActionForm();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "No se pudo crear la acción rápida");
    } finally {
      setIsCreatingAction(false);
    }
  }, [
    newActionDescription,
    newActionFolderPaths,
    newActionName,
    obraId,
    resetCreateActionForm,
  ]);

  const openAction = useCallback((action: QuickAction) => {
    setActiveAction(action);
    setActiveStepIndex(0);
    setCompletedSteps(new Set());
  }, []);

  const closeAction = useCallback(() => {
    setActiveAction(null);
    setActiveStepIndex(0);
    setCompletedSteps(new Set());
    setFileByStep({});
    setManualValues({});
    setStepModes({});
  }, []);

  const setStepMode = useCallback((stepId: string, mode: StepMode) => {
    setStepModes((prev) => ({ ...prev, [stepId]: mode }));
  }, []);

  const handleFileChange = useCallback((stepId: string, file: File | null) => {
    setFileByStep((prev) => ({ ...prev, [stepId]: file }));
  }, []);

  const handleManualChange = useCallback((stepId: string, key: string, value: unknown) => {
    setManualValues((prev) => ({
      ...prev,
      [stepId]: { ...(prev[stepId] ?? {}), [key]: value },
    }));
  }, []);

  const markStepComplete = useCallback((stepId: string) => {
    setCompletedSteps((prev) => new Set(prev).add(stepId));
  }, []);

  const notifyDocumentsRefresh = useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("obra:documents-refresh", { detail: { obraId } }));
  }, [obraId]);

  const goToStep = useCallback((index: number) => {
    if (index <= activeStepIndex || completedSteps.has(steps[index]?.id)) {
      setActiveStepIndex(index);
    }
  }, [activeStepIndex, completedSteps, steps]);

  const advanceToNextStep = useCallback(() => {
    setActiveStepIndex((prev) => {
      const next = prev + 1;
      return next < steps.length ? next : prev;
    });
  }, [steps.length]);

  const submitStep = useCallback(async (stepId: string) => {
    const step = steps.find((item) => item.id === stepId);
    if (!step) return;
    const { folder, tabla, tablas: tablasForStep } = step;
    const mode = stepModes[stepId] ?? (folder.isOcr ? (folder.dataInputMethod === "manual" ? "manual" : "ocr") : "files");

    if (folder.isOcr && !tabla) {
      toast.error("No se encontró la tabla asociada a esta carpeta");
      return;
    }

    setIsSubmittingStep(true);
    try {
      if (!folder.isOcr || mode === "files") {
        const file = fileByStep[stepId];
        if (!file) {
          toast.error("Seleccioná un archivo");
          return;
        }
        const supabase = createSupabaseBrowserClient();
        const safeName = `${Date.now()}-${file.name}`;
        const storagePath = `${obraId}/${folder.path}/${safeName}`;
        const { error } = await supabase.storage
          .from("obra-documents")
          .upload(storagePath, file, { upsert: false });
        if (error) throw error;
        toast.success("Archivo subido");
        markStepComplete(stepId);
        notifyDocumentsRefresh();
        advanceToNextStep();
        return;
      }

      if (mode === "ocr") {
        const file = fileByStep[stepId];
        if (!file) {
          toast.error("Seleccioná un archivo");
          return;
        }
        if (!tablasForStep.length) {
          throw new Error("No hay tablas OCR asociadas a esta carpeta");
        }
        for (const targetTabla of tablasForStep) {
          const form = new FormData();
          form.append("file", file);
          const res = await fetch(`/api/obras/${obraId}/tablas/${targetTabla.id}/import/ocr`, {
            method: "POST",
            body: form,
          });
          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json.error || `No se pudo procesar el OCR en ${targetTabla.name}`);
          }
        }
        toast.success(
          tablasForStep.length > 1
            ? `Documento enviado a OCR en ${tablasForStep.length} tablas`
            : "Documento enviado a OCR"
        );
        markStepComplete(stepId);
        notifyDocumentsRefresh();
        advanceToNextStep();
        return;
      }

      if (mode === "manual") {
        const values = manualValues[stepId] ?? {};
        const columns = tabla?.columns ?? [];
        for (const col of columns) {
          if (col.required) {
            const value = values[col.fieldKey];
            if (value === "" || value === null || value === undefined) {
              toast.error(`El campo "${col.label}" es requerido`);
              return;
            }
          }
        }
        const rowId = crypto.randomUUID();
        const rowData: Record<string, unknown> = {};
        for (const col of columns) {
          const value = values[col.fieldKey];
          switch (col.dataType) {
            case "number":
            case "currency":
              rowData[col.fieldKey] = value === "" ? null : Number(value);
              break;
            case "boolean":
              rowData[col.fieldKey] = Boolean(value);
              break;
            default:
              rowData[col.fieldKey] = value ?? "";
          }
        }
        const res = await fetch(`/api/obras/${obraId}/tablas/${tabla!.id}/rows`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dirtyRows: [{ id: rowId, source: "manual", ...rowData }] }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || "No se pudo guardar la fila");
        }
        toast.success("Fila guardada");
        markStepComplete(stepId);
        notifyDocumentsRefresh();
        advanceToNextStep();
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Error procesando el paso");
    } finally {
      setIsSubmittingStep(false);
    }
  }, [advanceToNextStep, fileByStep, manualValues, markStepComplete, notifyDocumentsRefresh, obraId, stepModes, steps]);

  // Derive current step info for the dialog
  const currentStep = steps[activeStepIndex] ?? null;
  const currentStepId = currentStep?.id ?? "";
  const currentFolder = currentStep?.folder;
  const currentTabla = currentStep?.tabla ?? null;
  const currentMode = currentStepId
    ? stepModes[currentStepId] ?? (currentFolder?.isOcr ? (currentFolder.dataInputMethod === "manual" ? "manual" : "ocr") : "files")
    : "files";
  const showModeToggle = currentFolder?.isOcr && currentFolder.dataInputMethod === "both";
  const isUploadMode = currentMode === "files" || currentMode === "ocr" || !currentFolder?.isOcr;
  const isManualMode = currentFolder?.isOcr && currentMode === "manual";
  const customRenderer = currentStepId ? customStepRenderers[currentStepId] : undefined;
  const isDone = currentStepId ? completedSteps.has(currentStepId) : false;

  const panelList = (
    <div className="space-y-1">
      {localActions.map((action, i) => (
        <motion.button
          key={action.id}
          {...listItemMotion}
          transition={{ ...listItemMotion.transition, delay: i * 0.04 }}
          type="button"
          onClick={() => openAction(action)}
          className={cn(
            "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5",
            "text-left transition-all duration-150",
            "hover:bg-accent/50 active:scale-[0.98]"
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
            <FolderOpen className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{action.name}</p>
            {action.description ? (
              <p className="text-xs text-muted-foreground truncate">{action.description}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {action.folderPaths.length} paso{action.folderPaths.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
        </motion.button>
      ))}
      {localActions.length === 0 && (
        <p className="rounded-lg border border-dashed px-3 py-4 text-xs text-muted-foreground">
          No hay acciones rápidas todavía. Creá una para esta obra desde el botón "Crear".
        </p>
      )}
    </div>
  );

  return (
    <>
      {!isMobile && (
        <motion.aside
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="w-full lg:w-68 shrink-0 rounded-lg border bg-card shadow-sm p-4 flex flex-col gap-4 h-auto"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Acciones rápidas</h2>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setIsCreateDialogOpen(true)}>
              Crear
            </Button>
          </div>
          {panelList}
        </motion.aside>
      )}

      {isMobile && (
        <>
          <Button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            className="fixed bottom-5 right-4 z-40 h-12 rounded-full px-4 shadow-lg"
          >
            <Zap className="h-4 w-4" />
            <span className="ml-2 text-sm font-semibold">Acciones</span>
          </Button>

          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetContent side="bottom" className="bg-card p-0">
              <SheetHeader className="px-4 pt-4 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <SheetTitle className="flex items-center gap-2 text-base">
                    <Zap className="h-4 w-4 text-primary" />
                    Acciones rápidasasdasdad
                  </SheetTitle>
                  <Button type="button" size="sm" variant="outline" onClick={() => setIsCreateDialogOpen(true)}>
                    Crear
                  </Button>
                </div>
              </SheetHeader>
              <div className="max-h-[70vh] overflow-y-auto px-3 pb-5">
                <div className="rounded-lg border bg-background p-3">
                  {panelList}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}

      {/* ── Workflow dialog (folder-tab style) ── */}
      <DialogPrimitive.Root open={Boolean(activeAction)} onOpenChange={(open) => { if (!open) closeAction(); }}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-stone-900/30 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            className={cn(
              "fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              "duration-200"
            )}
          >
            {/* Folder tabs navigation */}
            {steps.length > 1 && (
              <div className="flex items-end gap-1 px-4">
                {steps.map((step, index) => {
                  const isActive = index === activeStepIndex;
                  const isCompleted = completedSteps.has(step.id);
                  const isClickable = index <= activeStepIndex || isCompleted;

                  return (
                    <button
                      key={step.id}
                      onClick={() => goToStep(index)}
                      disabled={!isClickable}
                      className={cn(
                        "relative px-5 py-2.5 text-sm font-medium rounded-t-none transition-all duration-200",
                        "border border-b-0",
                        isActive
                          ? "bg-white border-stone-200 text-stone-900 z-10 -mb-px"
                          : isCompleted
                            ? "bg-stone-100 border-stone-200 text-stone-600 hover:bg-stone-50 cursor-pointer"
                            : "bg-stone-100/50 border-stone-200/50 text-stone-400 cursor-not-allowed"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold",
                            isActive
                              ? "bg-stone-800 text-white"
                              : isCompleted
                                ? "bg-emerald-500 text-white"
                                : "bg-stone-300 text-white"
                          )}
                        >
                          {isCompleted ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            index + 1
                          )}
                        </span>
                        {step.folder.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Main container with paper hole punches */}
            <div className="relative flex min-h-[800px]">
              {/* Main modal body */}
              <div
                className={cn(
                  "relative flex flex-col justify-start flex-1 ml-4 pl-4 overflow-hidden rounded-none",
                  "bg-white border border-stone-200",
                  "shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)]"
                )}
              >
                <div className="absolute left-3 -top-12 bottom-0 flex flex-col justify-around py-8 z-10">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-5 h-5 rounded-full bg-stone-200 border border-stone-300 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)]"
                    />
                  ))}
                </div>
                <div className="absolute left-11 top-0 bottom-0 w-px h-full bg-stone-200" />
                {/* Close button */}
                <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors z-10">
                  <X className="h-4 w-4" />
                </DialogPrimitive.Close>

                {/* Header */}
                <div className="px-12 pt-6 pb-5">
                  <div className="flex flex-col items-start justify-start relative">
                    <h2 className="text-2xl font-semibold text-stone-900">{activeAction?.name ? activeAction.name.charAt(0).toUpperCase() + activeAction.name.slice(1).toLowerCase() : ""}</h2>
                    {activeAction?.description && (
                      <p className="mt-1 text-sm text-stone-500">{activeAction.description}</p>
                    )}
                    <div className="w-[130%] h-px bg-stone-200 mt-5 -ml-16 absolute -bottom-3 left-0" />

                    {/* Step info */}
                    {currentFolder && (
                      <div className="mt-3 flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] font-medium">
                          {getStepLabel(currentFolder)}
                        </Badge>
                        <span className="text-xs text-stone-400 font-mono">/{currentFolder.path}</span>
                      </div>
                    )}
                  </div>

                  {/* Mode toggle for "both" type */}
                  {!customRenderer && showModeToggle && !isDone && (
                    <div className="mt-5">
                      <p className="text-xs text-stone-500 mb-2 uppercase tracking-wide font-medium">
                        Método de entrada
                      </p>
                      <div className="inline-flex rounded-none border border-stone-200 p-1 bg-stone-50">
                        <button
                          type="button"
                          onClick={() => setStepMode(currentStepId, "ocr")}
                          className={cn(
                            "flex items-center gap-2 rounded-none px-3 py-0 text-sm font-medium transition-all duration-200 h-6.5",
                            currentMode === "ocr"
                              ? "bg-primary text-white "
                              : "text-stone-500 hover:text-stone-700"
                          )}
                        >
                          <Upload className="h-3.5 w-3.5" />
                          OCR
                        </button>
                        <button
                          type="button"
                          onClick={() => setStepMode(currentStepId, "manual")}
                          className={cn(
                            "flex items-center gap-2 rounded-none px-3 py-0 text-sm font-medium transition-all duration-200 h-6.5",
                            currentMode === "manual"
                              ? "bg-primary text-white "
                              : "text-stone-500 hover:text-stone-700"
                          )}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Manual
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Content area */}
                <div className="px-5 mx-12 pb-6 max-h-[calc(90vh-250px)] overflow-y-auto bg-sidebar/50 pt-4">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${currentStepId}-${currentMode}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                    >
                      {/* Completed state */}
                      {isDone && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 mb-4">
                            <Check className="h-7 w-7 text-emerald-600" />
                          </div>
                          <p className="text-sm font-medium text-stone-700">Paso completado</p>
                          <p className="text-xs text-stone-400 mt-1">
                            {activeStepIndex < steps.length - 1
                              ? "Podés continuar con el siguiente paso"
                              : "Todos los pasos fueron completados"}
                          </p>
                        </div>
                      )}

                      {/* Custom renderer */}
                      {!isDone && customRenderer ? (
                        customRenderer({
                          stepId: currentStepId,
                          folder: currentFolder!,
                          tabla: currentTabla,
                          mode: currentMode,
                          values: manualValues[currentStepId] ?? {},
                          setValue: (key, value) => handleManualChange(currentStepId, key, value),
                          submit: () => submitStep(currentStepId),
                          isSubmitting: isSubmittingStep,
                        })
                      ) : null}

                      {/* Upload mode */}
                      {!isDone && !customRenderer && isUploadMode && (
                        <div className="space-y-3">
                          <label className="block text-xs font-medium uppercase tracking-wider text-stone-500">
                            Seleccionar archivo
                          </label>
                          <DropzoneFileInput
                            inputId={`quick-step-file-${currentStepId}`}
                            value={fileByStep[currentStepId] ?? null}
                            onChange={(file) => handleFileChange(currentStepId, file)}
                          />
                        </div>
                      )}

                      {/* Manual mode */}
                      {!isDone && !customRenderer && isManualMode && (
                        <div className="space-y-5">
                          {currentTabla?.columns?.length ? (
                            currentTabla.columns.map((column) => (
                              <div key={column.id}>
                                <label
                                  htmlFor={`${currentStepId}-${column.fieldKey}`}
                                  className="block text-xs font-medium uppercase tracking-wider text-stone-500 mb-1.5"
                                >
                                  {column.label}
                                  {column.required && <span className="text-red-500 ml-1">*</span>}
                                </label>
                                <Input
                                  id={`${currentStepId}-${column.fieldKey}`}
                                  name={column.fieldKey}
                                  type={column.dataType === "date" ? "date" : column.dataType === "number" || column.dataType === "currency" ? "number" : "text"}
                                  step={column.dataType === "currency" ? "0.01" : column.dataType === "number" ? "any" : undefined}
                                  placeholder={column.label}
                                  value={String((manualValues[currentStepId] ?? {})[column.fieldKey] ?? "")}
                                  onChange={(event) => handleManualChange(currentStepId, column.fieldKey, event.target.value)}
                                  autoComplete="off"
                                  className={cn(
                                    "w-full rounded-md border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900",
                                    "placeholder:text-stone-400",
                                    "focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20",
                                    "transition-all duration-200"
                                  )}
                                />
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-stone-400 text-center py-8">Esta carpeta no tiene columnas configuradas.</p>
                          )}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="px-8 py-5 -ml-4 mt-auto border-t border-stone-100 bg-sidebar max-h-16">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={closeAction}
                      className={cn(
                        "rounded-md px-4 py-2 text-sm font-medium transition-all duration-200",
                        "text-stone-600 hover:text-stone-900",
                        "hover:bg-stone-100"
                      )}
                    >
                      Cancelar
                    </button>

                    {isDone && activeStepIndex < steps.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setActiveStepIndex((p) => p + 1)}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-5 py-2 text-sm font-medium transition-all duration-200",
                          "bg-stone-800 text-white",
                          "hover:bg-stone-700",
                          "active:bg-stone-900"
                        )}
                      >
                        Siguiente
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    ) : isDone && activeStepIndex === steps.length - 1 ? (
                      <button
                        type="button"
                        onClick={closeAction}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-5 py-2 text-sm font-medium transition-all duration-200",
                          "bg-emerald-600 text-white",
                          "hover:bg-emerald-500",
                          "active:bg-emerald-700"
                        )}
                      >
                        <Check className="h-4 w-4" />
                        Listo
                      </button>
                    ) : !customRenderer ? (
                      <button
                        type="button"
                        onClick={() => submitStep(currentStepId)}
                        disabled={isSubmittingStep}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-5 py-2 text-sm font-medium transition-all duration-200",
                          "bg-stone-800 text-white",
                          "hover:bg-stone-700",
                          "active:bg-stone-900",
                          "disabled:opacity-50 disabled:pointer-events-none"
                        )}
                      >
                        {isSubmittingStep ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {isManualMode ? "Guardando..." : "Subiendo..."}
                          </>
                        ) : activeStepIndex === steps.length - 1 ? (
                          <>
                            <Check className="h-4 w-4" />
                            {isManualMode ? "Guardar fila" : "Subir archivo"}
                          </>
                        ) : (
                          <>
                            {isManualMode ? "Guardar y seguir" : "Subir y seguir"}
                            <ChevronRight className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(nextOpen) => {
          setIsCreateDialogOpen(nextOpen);
          if (!nextOpen) resetCreateActionForm();
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Nueva acción rápida para esta obra</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nombre</label>
              <Input
                value={newActionName}
                onChange={(event) => setNewActionName(event.target.value)}
                placeholder="Ej: Cargar documentación inicial"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Descripción (opcional)</label>
              <Input
                value={newActionDescription}
                onChange={(event) => setNewActionDescription(event.target.value)}
                placeholder="Pasos para completar la carga"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Seleccioná carpetas/tablas para los pasos
              </p>
              <div className="max-h-56 overflow-y-auto rounded-md border p-2 space-y-1">
                {allActionFolders.map((folder) => {
                  const linkedTablas = folder.isOcr ? tablasByFolderPath.get(folder.path) ?? [] : [];
                  const linkedTabla = linkedTablas[0] ?? null;
                  const checked = newActionFolderPaths.includes(folder.path);
                  return (
                    <label
                      key={folder.path}
                      className="flex items-start gap-2 rounded px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => toggleCreateActionFolderPath(folder.path, value === true)}
                      />
                      <span className="flex-1 text-sm">
                        <span className="font-medium">{folder.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">/{folder.path}</span>
                        {linkedTabla && (
                          <span className="ml-2 text-[11px] text-primary">
                            Tabla{linkedTablas.length > 1 ? "s" : ""}: {linkedTabla.name}
                            {linkedTablas.length > 1 ? ` (+${linkedTablas.length - 1})` : ""}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
                {allActionFolders.length === 0 && (
                  <p className="text-xs text-muted-foreground px-2 py-1">
                    No hay carpetas disponibles en esta obra.
                  </p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={isCreatingAction}>
              Cancelar
            </Button>
            <Button type="button" onClick={createObraQuickAction} disabled={isCreatingAction}>
              {isCreatingAction ? "Creando..." : "Crear acción"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ── Dropzone file input ── */

function DropzoneFileInput({
  inputId,
  value,
  onChange,
}: {
  inputId: string;
  value: File | null;
  onChange: (file: File | null) => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onChange(file);
  }, [onChange]);

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 border-dashed p-8 transition-all duration-200",
        dragActive
          ? "border-amber-500 bg-amber-50"
          : "border-stone-200 hover:border-stone-300 bg-stone-50/50"
      )}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        id={inputId}
        name={inputId}
        type="file"
        className="sr-only"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        accept=".pdf,.png,.jpg,.jpeg"
        autoComplete="off"
      />
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-lg transition-all duration-200",
            "bg-stone-100 border border-stone-200",
            dragActive && "bg-amber-100 border-amber-300"
          )}
        >
          <Upload
            className={cn(
              "h-6 w-6 text-stone-400 transition-all duration-200",
              dragActive && "text-amber-600"
            )}
          />
        </div>

        <div>
          <p className="text-sm text-stone-700">
            {value ? value.name : "Arrastrá un archivo o seleccioná desde tu equipo"}
          </p>
          <p className="mt-1 text-xs text-stone-400">PDF o imagen</p>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "cursor-pointer rounded-md px-4 py-2 text-sm font-medium transition-all duration-200",
            "bg-stone-900 text-white",
            "hover:bg-stone-800",
            "active:bg-stone-950"
          )}
        >
          {value ? "Cambiar archivo" : "Elegir archivo"}
        </button>
      </div>
    </div>
  );
}
