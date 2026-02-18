'use client';

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  FolderKanban,
  Plus,
  ShieldCheck,
  Sparkles,
  Activity,
  AlertTriangle,
  Target
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
  saldoACertificar: number;
  entidadContratante: string;
  plazoTotal: number;
  plazoTransc: number;
  segunContrato: number;
  prorrogasAcordadas: number;
};

type DashboardStats = {
  total: number;
  inProgress: number;
  completed: number;
  avgProgress: number;
  totalContractValue: number;
  totalCertifiedValue: number;
  totalPendingValue: number;
  obrasAtRisk: number;
  obrasOnTrack: number;
  avgTimeProgress: number;
  totalSurface: number;
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

type PieSlice = { name: string; value: number; fill: string };

function SimplePieChart({ data }: { data: PieSlice[] }) {
  const total = data.reduce((acc, entry) => acc + entry.value, 0);
  const segments = total
    ? data.reduce<{ stops: string[]; current: number }>(
      (acc, entry) => {
        const start = acc.current;
        const end = start + (entry.value / total) * 100;
        acc.stops.push(`${entry.fill} ${start}% ${end}%`);
        acc.current = end;
        return acc;
      },
      { stops: [], current: 0 }
    ).stops
    : ["#e5e7eb 0% 100%"];

  return (
    <div className="relative h-[120px] w-[120px] mx-auto">
      <div
        className="h-full w-full rounded-full"
        style={{ backgroundImage: `conic-gradient(${segments.join(", ")})` }}
      />
      <div className="absolute inset-0 m-auto h-[70px] w-[70px] rounded-full bg-card" />
    </div>
  );
}

function SimpleBarList({
  data,
  labelSuffix = "",
}: {
  data: { name: string; value: number; fill: string }[];
  labelSuffix?: string;
}) {
  const maxValue = Math.max(1, ...data.map((entry) => entry.value));
  return (
    <div className="space-y-3">
      {data.map((entry) => (
        <div key={entry.name} className="grid grid-cols-[72px_1fr_48px] items-center gap-3">
          <span className="text-[11px] text-muted-foreground">{entry.name}</span>
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full"
              style={{
                width: `${Math.min((entry.value / maxValue) * 100, 100)}%`,
                backgroundColor: entry.fill,
              }}
            />
          </div>
          <span className="text-[11px] text-muted-foreground text-right tabular-nums">
            {entry.value}
            {labelSuffix}
          </span>
        </div>
      ))}
    </div>
  );
}

function SimpleGroupedBars({
  data,
}: {
  data: { name: string; contrato: number; certificado: number }[];
}) {
  const maxValue = Math.max(
    1,
    ...data.flatMap((entry) => [entry.contrato, entry.certificado])
  );
  return (
    <div className="space-y-4">
      {data.map((entry) => (
        <div key={entry.name} className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="max-w-[70%] truncate">{entry.name}</span>
            <span className="tabular-nums">
              {entry.contrato.toFixed(1)} / {entry.certificado.toFixed(1)}M
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-blue-500"
                style={{ width: `${Math.min((entry.contrato / maxValue) * 100, 100)}%` }}
              />
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-green-500"
                style={{ width: `${Math.min((entry.certificado / maxValue) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Fetch function for obras data with all analytics fields
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
  // Map the response to ensure all fields have defaults
  const obras = (data.detalleObras || []).map((o: Record<string, unknown>) => ({
    id: o.id as string,
    n: o.n as number,
    designacionYUbicacion: o.designacionYUbicacion as string,
    porcentaje: (o.porcentaje as number) || 0,
    contratoMasAmpliaciones: (o.contratoMasAmpliaciones as number) || 0,
    certificadoALaFecha: (o.certificadoALaFecha as number) || 0,
    saldoACertificar: (o.saldoACertificar as number) || 0,
    entidadContratante: o.entidadContratante as string,
    plazoTotal: (o.plazoTotal as number) || 0,
    plazoTransc: (o.plazoTransc as number) || 0,
    segunContrato: (o.segunContrato as number) || 0,
    prorrogasAcordadas: (o.prorrogasAcordadas as number) || 0,
  }));
  return { obras, isAuthenticated: true };
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
        totalPendingValue: 0,
        obrasAtRisk: 0,
        obrasOnTrack: 0,
        avgTimeProgress: 0,
        totalSurface: 0,
      };
    }
    const completed = obrasData.filter(o => o.porcentaje >= 100).length;
    const inProgress = total - completed;
    const avgProgress = obrasData.reduce((sum, o) => sum + o.porcentaje, 0) / total;
    const totalContractValue = obrasData.reduce((sum, o) => sum + (o.contratoMasAmpliaciones || 0), 0);
    const totalCertifiedValue = obrasData.reduce((sum, o) => sum + (o.certificadoALaFecha || 0), 0);
    const totalPendingValue = obrasData.reduce((sum, o) => sum + (o.saldoACertificar || 0), 0);

    // Calculate obras at risk (time progress > work progress by more than 15%)
    const activeObras = obrasData.filter(o => o.porcentaje < 100);
    const obrasAtRisk = activeObras.filter(o => {
      const timeProgress = o.plazoTotal > 0 ? (o.plazoTransc / o.plazoTotal) * 100 : 0;
      return timeProgress > o.porcentaje + 15;
    }).length;
    const obrasOnTrack = inProgress - obrasAtRisk;

    // Average time progress for active obras
    const avgTimeProgress = activeObras.length > 0
      ? activeObras.reduce((sum, o) => {
        const timeProgress = o.plazoTotal > 0 ? (o.plazoTransc / o.plazoTotal) * 100 : 0;
        return sum + timeProgress;
      }, 0) / activeObras.length
      : 0;

    return {
      total,
      inProgress,
      completed,
      avgProgress,
      totalContractValue,
      totalCertifiedValue,
      totalPendingValue,
      obrasAtRisk,
      obrasOnTrack,
      avgTimeProgress,
      totalSurface: 0,
    };
  }, [data]);

  // Get obras that need attention (behind schedule or low progress)
  const alertObras = useMemo(() => {
    if (!data?.obras) return [];
    return data.obras.filter(o => {
      if (o.porcentaje >= 100) return false;
      const timeProgress = o.plazoTotal > 0 ? (o.plazoTransc / o.plazoTotal) * 100 : 0;
      return timeProgress > o.porcentaje + 10; // More than 10% behind
    });
  }, [data]);

  // Chart data: Progress distribution
  const progressDistributionData = useMemo(() => {
    if (!data?.obras || data.obras.length === 0) return [];
    const ranges = [
      { name: '0-25%', min: 0, max: 25, fill: '#ef4444' },
      { name: '26-50%', min: 26, max: 50, fill: '#f59e0b' },
      { name: '51-75%', min: 51, max: 75, fill: '#3b82f6' },
      { name: '76-99%', min: 76, max: 99, fill: '#22c55e' },
      { name: '100%', min: 100, max: 100, fill: '#10b981' },
    ];
    return ranges.map(range => ({
      name: range.name,
      value: data.obras.filter(o =>
        range.max === 100
          ? o.porcentaje >= 100
          : o.porcentaje >= range.min && o.porcentaje <= range.max
      ).length,
      fill: range.fill,
    })).filter(d => d.value > 0);
  }, [data]);

  // Chart data: Top obras by contract value
  const topObrasByValueData = useMemo(() => {
    if (!data?.obras || data.obras.length === 0) return [];
    return [...data.obras]
      .sort((a, b) => b.contratoMasAmpliaciones - a.contratoMasAmpliaciones)
      .slice(0, 5)
      .map(o => ({
        name: o.designacionYUbicacion.length > 20
          ? o.designacionYUbicacion.substring(0, 20) + '...'
          : o.designacionYUbicacion,
        contrato: o.contratoMasAmpliaciones / 1000000, // In millions
        certificado: o.certificadoALaFecha / 1000000,
      }));
  }, [data]);

  // Pie chart data for status
  const statusPieData = useMemo(() => {
    if (!stats) return [];
    const data = [];
    if (stats.completed > 0) data.push({ name: 'Completadas', value: stats.completed, fill: '#22c55e' });
    if (stats.obrasOnTrack > 0) data.push({ name: 'En tiempo', value: stats.obrasOnTrack, fill: '#3b82f6' });
    if (stats.obrasAtRisk > 0) data.push({ name: 'En riesgo', value: stats.obrasAtRisk, fill: '#f59e0b' });
    return data;
  }, [stats]);

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
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative mb-3"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Panel de Control
              </h1>
              <p className="text-muted-foreground text-sm">
                Resumen de {stats?.total || 0} obras activas
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Button size="sm" className="w-full gap-2 sm:w-auto" onClick={() => setDialogOpen(true)}>
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
              <Button asChild variant="secondary" size="sm" className="w-full sm:w-auto">
                <Link href="/excel">
                  Ver Todas
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card className="border-0 shadow-sm bg-card py-0">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Obras Activas</p>
                    <p className="text-2xl font-bold mt-1">{stats?.inProgress || 0}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Activity className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <Card className="border-0 shadow-sm bg-card py-0">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Completadas</p>
                    <p className="text-2xl font-bold mt-1 text-green-600">{stats?.completed || 0}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Card className="border-0 shadow-sm bg-card py-0">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">En Riesgo</p>
                    <p className="text-2xl font-bold mt-1 text-amber-600">{stats?.obrasAtRisk || 0}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
          >
            <Card className="border-0 shadow-sm bg-card py-0">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Avance Prom.</p>
                    <p className="text-2xl font-bold mt-1">{stats?.avgProgress?.toFixed(0) || 0}%</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Main Grid Layout */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Obras Recientes - takes 2 columns */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="lg:col-span-2 order-first"
          >
            <Card className="border-0 shadow-sm bg-card overflow-hidden">
              <CardHeader className="border-b py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base font-medium">Obras Recientes</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Acceso rapido a tus proyectos
                    </CardDescription>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="text-xs">
                    <Link href="/excel">
                      Ver todas
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
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
                      {obras.slice(0, 6).map((obra, index) => {
                        const timeProgress = obra.plazoTotal > 0 ? (obra.plazoTransc / obra.plazoTotal) * 100 : 0;
                        const isBehind = timeProgress > obra.porcentaje + 10;
                        return (
                          <motion.div
                            key={obra.id}
                            initial={newlyAddedObraId === obra.id ? { scale: 0.95, opacity: 0 } : { opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={{ duration: 0.2, delay: index * 0.03 }}
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
                              onMouseEnter={() => prefetchObra(obra.id)}
                              className="flex items-center gap-4 p-3 hover:bg-muted/50 transition-colors group"
                            >
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted font-mono text-xs font-semibold text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                {obra.n}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium truncate">{obra.designacionYUbicacion}</p>
                                  {obra.porcentaje >= 100 && (
                                    <Badge variant="secondary" className="bg-green-100 text-green-700 text-[10px] h-5 shrink-0">
                                      Completada
                                    </Badge>
                                  )}
                                  {isBehind && obra.porcentaje < 100 && (
                                    <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-[10px] h-5 shrink-0">
                                      Atrasada
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground truncate">{obra.entidadContratante}</p>
                              </div>
                              <div className="text-right shrink-0 w-16">
                                <div className="text-sm font-semibold tabular-nums">{obra.porcentaje}%</div>
                                <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                                  <div
                                    className={`h-1.5 rounded-full transition-all ${obra.porcentaje >= 100 ? 'bg-green-500' : isBehind ? 'bg-amber-500' : 'bg-primary'
                                      }`}
                                    style={{ width: `${obra.porcentaje}%` }}
                                  />
                                </div>
                              </div>
                              <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
                            </Link>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Right Sidebar */}
          <div className="space-y-4 lg:col-span-1">
            {/* Alerts Card - Obras at Risk */}
            {alertObras.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <Card className="border-0 shadow-sm bg-amber-50/50 border-amber-200/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <CardTitle className="text-sm font-medium text-amber-800">Requieren Atencion</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-[260px] overflow-y-auto">
                    {alertObras.map((obra) => {
                      const timeProgress = obra.plazoTotal > 0 ? (obra.plazoTransc / obra.plazoTotal) * 100 : 0;
                      const delay = Math.round(timeProgress - obra.porcentaje);
                      return (
                        <Link
                          key={obra.id}
                          href={`/excel/${obra.id}`}
                          className="block p-2 rounded-lg bg-white/60 hover:bg-white transition-colors"
                        >
                          <p className="text-xs font-medium text-foreground truncate">{obra.designacionYUbicacion}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-amber-700">
                              {delay}% atrasada
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              ({obra.porcentaje}% avance / {timeProgress.toFixed(0)}% tiempo)
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Financial Summary */}
            {/* <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
            >
              <Card className="border-0 shadow-sm bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Resumen Financiero</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Valor Total Contratos</span>
                      <span className="text-sm font-semibold tabular-nums">{formatCurrency(stats?.totalContractValue || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Certificado</span>
                      <span className="text-sm font-semibold text-green-600 tabular-nums">{formatCurrency(stats?.totalCertifiedValue || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Pendiente</span>
                      <span className="text-sm font-semibold text-amber-600 tabular-nums">{formatCurrency(stats?.totalPendingValue || 0)}</span>
                    </div>
                  </div>

                  {stats && stats.totalContractValue > 0 && (
                    <div className="pt-2 border-t">
                      <div className="flex justify-between text-xs text-muted-foreground mb-2">
                        <span>Avance financiero global</span>
                        <span className="font-medium">{((stats.totalCertifiedValue / stats.totalContractValue) * 100).toFixed(1)}%</span>
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
            </motion.div> */}

            {/* Status Distribution Pie Chart */}
            {/* {statusPieData.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                <Card className="border-0 shadow-sm bg-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Estado de Obras</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[140px] flex items-center justify-center">
                      <SimplePieChart data={statusPieData} />
                    </div>
                    <div className="flex justify-center gap-4 mt-2">
                      {statusPieData.map((entry, index) => (
                        <div key={index} className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: entry.fill }} />
                          <span className="text-[10px] text-muted-foreground">{entry.name} ({entry.value})</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )} */}
            {obras.length > 0 && (
              <div className="grid gap-6 lg:grid-cols-1 mt-6">
                {/* Progress Distribution Chart */}
                {progressDistributionData.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.35 }}
                  >
                    <Card className="border-0 shadow-sm bg-card">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Distribucion de Avance</CardTitle>
                        <CardDescription className="text-xs">Obras por rango de progreso</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[200px]">
                          <SimpleBarList data={progressDistributionData} labelSuffix=" obras" />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Top Obras by Value Chart */}
                {/* {topObrasByValueData.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
              >
                <Card className="border-0 shadow-sm bg-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Obras por Valor de Contrato</CardTitle>
                    <CardDescription className="text-xs">Top 5 obras (en millones ARS)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px] overflow-y-auto pr-1">
                      <SimpleGroupedBars data={topObrasByValueData} />
                    </div>
                    <div className="flex justify-center gap-4 mt-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-sm bg-blue-500" />
                        <span className="text-[10px] text-muted-foreground">Contrato</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-sm bg-green-500" />
                        <span className="text-[10px] text-muted-foreground">Certificado</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )} */}
              </div>
            )}
          </div>
        </div>

        {/* Charts Row */}
      </div>
    </div>
  );
}
