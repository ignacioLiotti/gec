'use client';

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  DollarSign,
  FolderKanban,
  Plus,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Building2,
  Activity
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QuickFormDialog, type QuickFormField } from "@/components/forms/quick-form-dialog";
import { toast } from "sonner";
import { usePrefetchObra } from "@/lib/use-prefetch-obra";

type Obra = {
  id: string;
  n: number;
  designacionYUbicacion: string;
  porcentaje: number;
  contratoMasAmpliaciones: number;
  certificadoALaFecha: number;
  entidadContratante: string;
};

type DashboardStats = {
  total: number;
  inProgress: number;
  completed: number;
  avgProgress: number;
  totalContractValue: number;
  totalCertifiedValue: number;
};

const features = [
  {
    title: "Documentos centralizados",
    description: "Gestioná planos, contratos y certificados en un único espacio seguro.",
    icon: FolderKanban,
  },
  {
    title: "Seguimiento inteligente",
    description: "Visualizá métricas clave de cada obra para anticiparte a los desvíos.",
    icon: BarChart3,
  },
  {
    title: "Control y permisos",
    description: "Definí accesos según roles para mantener la información protegida.",
    icon: ShieldCheck,
  },
];

// Fetch function for obras data
async function fetchObrasData(): Promise<{ obras: Obra[]; isAuthenticated: boolean }> {
  const response = await fetch("/api/obras");

  // If unauthorized, user is not authenticated
  if (response.status === 401) {
    return { obras: [], isAuthenticated: false };
  }

  // If there's an error, return empty data but authenticated
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Error desconocido" }));
    console.error("API Error:", errorData);
    return { obras: [], isAuthenticated: true };
  }

  const data = await response.json();
  return { obras: data.detalleObras || [], isAuthenticated: true };
}

export default function Home() {
  const queryClient = useQueryClient();
  const { prefetchObra } = usePrefetchObra();
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newObra, setNewObra] = useState({
    designacionYUbicacion: "",
    entidadContratante: "",
    mesBasicoDeContrato: "",
    iniciacion: "",
  });
  const [newlyAddedObraId, setNewlyAddedObraId] = useState<string | null>(null);
  const previousObrasRef = useRef<string[]>([]);

  // Use React Query for data fetching with caching
  const { data, isLoading: loading } = useQuery({
    queryKey: ['obras-dashboard'],
    queryFn: fetchObrasData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const obras = data?.obras ?? [];
  const isAuthenticated = data?.isAuthenticated ?? false;

  // Calculate statistics from the cached data
  const stats = useMemo<DashboardStats | null>(() => {
    if (!data?.isAuthenticated) return null;
    const obrasData = data.obras;
    const total = obrasData.length;
    if (total === 0) {
      return {
        total: 0,
        inProgress: 0,
        completed: 0,
        avgProgress: 0,
        totalContractValue: 0,
        totalCertifiedValue: 0,
      };
    }
    const completed = obrasData.filter(o => o.porcentaje >= 100).length;
    const inProgress = total - completed;
    const avgProgress = obrasData.reduce((sum, o) => sum + o.porcentaje, 0) / total;
    const totalContractValue = obrasData.reduce((sum, o) => sum + (o.contratoMasAmpliaciones || 0), 0);
    const totalCertifiedValue = obrasData.reduce((sum, o) => sum + (o.certificadoALaFecha || 0), 0);
    return {
      total,
      inProgress,
      completed,
      avgProgress,
      totalContractValue,
      totalCertifiedValue,
    };
  }, [data]);

  // Track newly added obras for animation
  const currentIds = obras.map(o => o.id);
  if (previousObrasRef.current.length > 0) {
    const newObraId = currentIds.find(id => !previousObrasRef.current.includes(id));
    if (newObraId && newlyAddedObraId !== newObraId) {
      setNewlyAddedObraId(newObraId);
      setTimeout(() => setNewlyAddedObraId(null), 3000);
    }
  }
  previousObrasRef.current = currentIds;

  const handleCreateObra = async () => {
    if (!newObra.designacionYUbicacion.trim() || !newObra.entidadContratante.trim()) {
      toast.error("Por favor completa los campos requeridos");
      return;
    }

    try {
      setIsCreating(true);

      // Get current obras to determine next N
      const response = await fetch("/api/obras");
      const data = await response.json();
      const currentObras = data.detalleObras || [];
      const maxN = currentObras.reduce((max: number, o: Obra) => Math.max(max, o.n), 0);

      // Create new obra
      const obraToCreate = {
        n: maxN + 1,
        designacionYUbicacion: newObra.designacionYUbicacion.trim(),
        entidadContratante: newObra.entidadContratante.trim(),
        mesBasicoDeContrato: newObra.mesBasicoDeContrato.trim() || "Sin especificar",
        iniciacion: newObra.iniciacion.trim() || "Sin especificar",
        supDeObraM2: 0,
        contratoMasAmpliaciones: 0,
        certificadoALaFecha: 0,
        saldoACertificar: 0,
        segunContrato: 0,
        prorrogasAcordadas: 0,
        plazoTotal: 0,
        plazoTransc: 0,
        porcentaje: 0,
      };

      const saveResponse = await fetch("/api/obras", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          detalleObras: [...currentObras, obraToCreate],
        }),
      });

      if (!saveResponse.ok) throw new Error("Error al crear la obra");

      toast.success("Obra creada exitosamente");
      setDialogOpen(false);
      setNewObra({
        designacionYUbicacion: "",
        entidadContratante: "",
        mesBasicoDeContrato: "",
        iniciacion: "",
      });
      // Invalidate cache to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['obras-dashboard'] });
    } catch (error) {
      console.error("Error creating obra:", error);
      toast.error("Error al crear la obra");
    } finally {
      setIsCreating(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  // Show welcome page for unauthenticated users
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background/95 to-muted">
        <div className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="space-y-6 text-center md:text-left"
          >
            <Badge variant="secondary" className="inline-flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Bienvenido
            </Badge>

            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                Todo lo que necesitás para coordinar tus obras en un solo lugar.
              </h1>
              <p className="text-muted-foreground text-lg max-w-2xl">
                Simplificamos la carga de documentos, el seguimiento de certificados y la comunicación entre equipos.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="gap-2">
                <Link href="/excel">
                  Entrar al panel
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3">
            {features.map(({ title, description, icon: Icon }) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <Card className="h-full border-muted/80 bg-card/70 backdrop-blur">
                  <CardContent className="space-y-3 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-lg font-semibold">{title}</p>
                      <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="rounded-2xl border bg-card/70 p-8 text-center md:text-left"
          >
            <p className="text-lg font-medium text-foreground">
              ¿Primera vez en la plataforma?
            </p>
            <p className="text-muted-foreground">
              Explorá tus documentos en la pestaña Documentos o consultá los certificados activos desde el panel principal.
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  // Show dashboard for authenticated users
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/50">
      <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header with gradient accent */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative mb-10"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  Panel de Control
                </h1>
              </div>
              <p className="text-muted-foreground text-sm pl-[52px]">
                Gestiona y supervisa tus proyectos de construccion
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Button size="sm" className="w-full gap-2 shadow-sm sm:w-auto" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Nueva Obra
              </Button>
              <QuickFormDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                title="Crear Nueva Obra"
                description="Completa la informacion basica de la obra. Podras agregar mas detalles despues."
                variant="dashboard"
                fields={[
                  {
                    key: "designacionYUbicacion",
                    label: "Designacion y Ubicacion",
                    type: "text",
                    required: true,
                    placeholder: "Ej: Construccion de edificio - Av. Corrientes 1234",
                  },
                  {
                    key: "entidadContratante",
                    label: "Entidad Contratante",
                    type: "text",
                    required: true,
                    placeholder: "Ej: Municipalidad de Buenos Aires",
                  },
                  {
                    key: "mesBasicoDeContrato",
                    label: "Mes Basico de Contrato",
                    type: "text",
                    placeholder: "Ej: Enero 2024",
                  },
                  {
                    key: "iniciacion",
                    label: "Fecha de Iniciacion",
                    type: "text",
                    placeholder: "Ej: Marzo 2024",
                  },
                ] as QuickFormField[]}
                values={newObra}
                onChange={(key: string, value: string) => setNewObra({ ...newObra, [key]: value })}
                onSubmit={handleCreateObra}
                isSubmitting={isCreating}
                submitLabel={isCreating ? "Creando..." : "Crear Obra"}
                cancelLabel="Cancelar"
                renderFooter={({ onClose, onSubmit, isSubmitting }: { onClose: () => void; onSubmit: () => void; isSubmitting: boolean }) => (
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isSubmitting}
                      className="rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={onSubmit}
                      disabled={isSubmitting}
                      className="flex items-center gap-2 rounded-md px-5 py-2 text-sm font-medium transition-all duration-200 bg-stone-800 text-white hover:bg-stone-700 active:bg-stone-900 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {isCreating ? "Creando..." : "Crear Obra"}
                    </button>
                  </div>
                )}
              />
              <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                <Link href="/excel">
                  Ver Todas
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Main Grid Layout - Obras Recientes is now central */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Obras Recientes - Central & Prominent (takes 2 columns) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="lg:col-span-2 order-first"
          >
            <Card className="border-0 shadow-lg pt-0 shadow-black/5 bg-card/80 backdrop-blur-sm overflow-hidden gap-0 pb-0">
              <CardHeader className="border-b bg-primary/10 py-4 !pb-2" >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <Activity className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Obras Recientes</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Tus proyectos mas recientes
                      </CardDescription>
                    </div>
                  </div>
                  {obras.length > 0 && (
                    <Badge variant="secondary" className="font-mono text-xs self-start sm:self-auto">
                      {obras.length} total
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0 mt-0">
                {obras.length === 0 ? (
                  <div className="text-center py-16 px-6 space-y-4">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                      <FolderKanban className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-muted-foreground font-medium">
                        No hay obras registradas
                      </p>
                      <p className="text-sm text-muted-foreground/70 max-w-sm mx-auto">
                        Crea tu primera obra para comenzar a gestionar tus proyectos. Si acabas de registrarte,{" "}
                        <Link href="/onboarding" className="text-primary hover:underline">
                          configura tu organizacion
                        </Link>
                        {" "}primero.
                      </p>
                    </div>
                    <Button onClick={() => setDialogOpen(true)} className="mt-4 gap-2">
                      <Plus className="h-4 w-4" />
                      Crear Primera Obra
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y">
                    <AnimatePresence mode="popLayout">
                      {obras.slice(0, 5).map((obra, index) => (
                        <motion.div
                          key={obra.id}
                          initial={newlyAddedObraId === obra.id ? { scale: 0.8, opacity: 0, y: -20 } : { opacity: 0 }}
                          animate={{ scale: 1, opacity: 1, y: 0 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          transition={{
                            type: newlyAddedObraId === obra.id ? "spring" : "tween",
                            stiffness: 500,
                            damping: 30,
                            delay: newlyAddedObraId === obra.id ? 0 : index * 0.05
                          }}
                          className={`relative ${newlyAddedObraId === obra.id ? 'z-10' : ''}`}
                        >
                          {newlyAddedObraId === obra.id && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: [0, 1, 1, 0] }}
                              transition={{ duration: 2, times: [0, 0.1, 0.8, 1] }}
                              className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-green-500/5 to-transparent pointer-events-none"
                            />
                          )}
                          <Link
                            href={`/excel/${obra.id}`}
                            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 hover:bg-accent/50 transition-all duration-200 group"
                          >
                            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted/70 font-mono text-sm font-semibold text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                {obra.n}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="font-medium truncate text-sm">{obra.designacionYUbicacion}</p>
                                  {obra.porcentaje >= 100 && (
                                    <Badge variant="default" className="bg-green-600/90 text-[10px] h-5 shrink-0">
                                      Completada
                                    </Badge>
                                  )}
                                  {newlyAddedObraId === obra.id && (
                                    <Badge variant="default" className="bg-blue-600 text-[10px] h-5 shrink-0 animate-pulse">
                                      Nueva
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground truncate">{obra.entidadContratante}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-3 sm:gap-4 sm:ml-4 w-full sm:w-auto">
                              <div className="text-left sm:text-right flex-1 sm:flex-none">
                                <div className="text-sm font-semibold tabular-nums">{obra.porcentaje}%</div>
                                <div className="w-full sm:w-20 bg-muted rounded-full h-1.5 mt-1.5">
                                  <motion.div
                                    className="bg-primary h-1.5 rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${obra.porcentaje}%` }}
                                    transition={{ duration: 0.5, delay: index * 0.05 }}
                                  />
                                </div>
                              </div>
                              <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                            </div>
                          </Link>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {obras.length > 5 && (
                      <div className="p-3 bg-muted/30 mb-0 flex justify-end">
                        <Button asChild variant="ghost" size="sm" className="w-fit text-muted-foreground hover:text-foreground">
                          <Link href="/excel">
                            Ver las {obras.length - 5} obras restantes
                            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Stats Sidebar */}
          <div className="space-y-4 lg:col-span-1">
            {/* Quick Stats Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <Card className="border-0 shadow-md shadow-black/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Resumen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="text-center p-3 rounded-xl bg-muted/50">
                      <div className="text-xl sm:text-2xl font-bold">{stats?.total || 0}</div>
                      <div className="text-xs sm:text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Total</div>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-blue-500/10">
                      <div className="text-xl sm:text-2xl font-bold text-blue-600">{stats?.inProgress || 0}</div>
                      <div className="text-xs sm:text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Activas</div>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-green-500/10">
                      <div className="text-xl sm:text-2xl font-bold text-green-600">{stats?.completed || 0}</div>
                      <div className="text-xs sm:text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Listas</div>
                    </div>
                  </div>

                  {/* Progress Ring */}
                  <div className="flex items-center gap-4 p-3 rounded-xl bg-muted/30">
                    <div className="relative h-14 w-14 shrink-0">
                      <svg className="h-14 w-14 -rotate-90" viewBox="0 0 36 36">
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          className="text-muted"
                        />
                        <motion.path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeDasharray={`${stats?.avgProgress || 0}, 100`}
                          className="text-primary"
                          initial={{ strokeDasharray: "0, 100" }}
                          animate={{ strokeDasharray: `${stats?.avgProgress || 0}, 100` }}
                          transition={{ duration: 1, delay: 0.5 }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold">{stats?.avgProgress ? stats.avgProgress.toFixed(0) : 0}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Progreso Promedio</p>
                      <p className="text-xs text-muted-foreground">De todas las obras</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Financial Stats */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <Card className="border-0 shadow-md shadow-black/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Financiero</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 rounded-xl bg-muted/30 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5" />
                      Valor Contratos
                    </div>
                    <div className="text-lg font-semibold truncate">
                      {formatCurrency(stats?.totalContractValue || 0)}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-green-500/5 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      Total Certificado
                    </div>
                    <div className="text-lg font-semibold text-green-700 truncate">
                      {formatCurrency(stats?.totalCertifiedValue || 0)}
                    </div>
                  </div>
                  {stats && stats.totalContractValue > 0 && (
                    <div className="pt-2">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                        <span>Avance financiero</span>
                        <span>{((stats.totalCertifiedValue / stats.totalContractValue) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <motion.div
                          className="bg-green-600 h-2 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((stats.totalCertifiedValue / stats.totalContractValue) * 100, 100)}%` }}
                          transition={{ duration: 0.8, delay: 0.6 }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
