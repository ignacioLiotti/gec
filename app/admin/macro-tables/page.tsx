"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Layers,
  Plus,
  Trash2,
  Loader2,
  ChevronRight,
  Database,
  Eye,
  Settings,
  Columns3,
  FileText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import type { MacroTable, MacroTableColumn, MacroTableSource } from "@/lib/macro-tables";

type MacroTableWithDetails = MacroTable & {
  sources: (MacroTableSource & {
    obraTabla?: {
      id: string;
      name: string;
      obraId: string;
      obraName: string;
    };
  })[];
  columns: MacroTableColumn[];
  sourceCount: number;
};

export default function MacroTablesPage() {
  const router = useRouter();
  const [macroTables, setMacroTables] = useState<MacroTableWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchMacroTables = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/macro-tables");
      if (!res.ok) throw new Error("Failed to load macro tables");
      const data = await res.json();
      setMacroTables(data.macroTables ?? []);
    } catch (error) {
      console.error(error);
      toast.error("Error cargando macro tablas");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMacroTables();
  }, [fetchMacroTables]);

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/macro-tables/${deleteId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error deleting macro table");
      }

      setMacroTables((prev) => prev.filter((mt) => mt.id !== deleteId));
      toast.success("Macro tabla eliminada");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Error eliminando macro tabla");
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
            Macro Tablas
          </h1>
          <p className="text-muted-foreground mt-2">
            Agregá datos de múltiples tablas de diferentes obras en una sola vista.
          </p>
        </div>
        <Button
          onClick={() => router.push("/admin/macro-tables/new")}
          className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nueva macro tabla
        </Button>
      </div>

      <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-50/50 to-blue-50/30 dark:from-cyan-950/20 dark:to-blue-950/10">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Layers className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <CardTitle>Macro tablas configuradas</CardTitle>
              <CardDescription>
                Vistas agregadas que combinan datos de múltiples tablas
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {macroTables.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Layers className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">No hay macro tablas configuradas</p>
              <p className="text-sm mt-1">
                Creá una macro tabla para agregar datos de múltiples obras.
              </p>
              <Button
                onClick={() => router.push("/admin/macro-tables/new")}
                variant="outline"
                className="mt-4 gap-2"
              >
                <Plus className="h-4 w-4" />
                Crear macro tabla
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {macroTables.map((macroTable, index) => (
                  <motion.div
                    key={macroTable.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.05 }}
                    className="group rounded-lg bg-background/60 border border-border/50 hover:border-cyan-500/30 transition-colors overflow-hidden"
                  >
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center shrink-0">
                          <Layers className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold truncate">{macroTable.name}</p>
                          </div>
                          {macroTable.description && (
                            <p className="text-sm text-muted-foreground truncate mt-0.5">
                              {macroTable.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Database className="h-3 w-3" />
                              {macroTable.sources.length} tablas fuente
                            </span>
                            <span className="flex items-center gap-1">
                              <Columns3 className="h-3 w-3" />
                              {macroTable.columns.length} columnas
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/macro?macroId=${macroTable.id}`)}
                          className="gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Eye className="h-4 w-4" />
                          Ver datos
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/macro/${macroTable.id}/reporte`)}
                          className="gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <FileText className="h-4 w-4" />
                          Reportes
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/admin/macro-tables/${macroTable.id}`)}
                          className="gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Settings className="h-4 w-4" />
                          Configurar
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(macroTable.id)}
                          className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 transition-opacity"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>

                    {/* Source tables preview */}
                    {macroTable.sources.length > 0 && (
                      <div className="px-4 pb-4 pt-0">
                        <div className="flex flex-wrap gap-1.5">
                          {macroTable.sources.slice(0, 5).map((source) => (
                            <Badge
                              key={source.id}
                              variant="secondary"
                              className="text-xs font-normal"
                            >
                              {source.obraTabla?.obraName
                                ? `${source.obraTabla.obraName} → ${source.obraTabla.name}`
                                : source.obraTablaId.slice(0, 8)}
                            </Badge>
                          ))}
                          {macroTable.sources.length > 5 && (
                            <Badge variant="outline" className="text-xs">
                              +{macroTable.sources.length - 5} más
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar macro tabla?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán todos los valores personalizados
              asociados a esta macro tabla.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}




