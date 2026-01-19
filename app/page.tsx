'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
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
  TrendingUp
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

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

export default function Home() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newObra, setNewObra] = useState({
    designacionYUbicacion: "",
    entidadContratante: "",
    mesBasicoDeContrato: "",
    iniciacion: "",
  });

  useEffect(() => {
    fetchObras();
  }, []);

  const fetchObras = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/obras");

      // If unauthorized, user is not authenticated
      if (response.status === 401) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      // If there's an error, try to get the error message
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error desconocido" }));
        console.error("API Error:", errorData);

        // Set authenticated but with empty data - user might not have a tenant
        setIsAuthenticated(true);
        setObras([]);
        setStats({
          total: 0,
          inProgress: 0,
          completed: 0,
          avgProgress: 0,
          totalContractValue: 0,
          totalCertifiedValue: 0,
        });
        setLoading(false);
        return;
      }

      setIsAuthenticated(true);
      const data = await response.json();
      const obrasData: Obra[] = data.detalleObras || [];
      setObras(obrasData);

      // Calculate statistics
      const total = obrasData.length;
      const completed = obrasData.filter(o => o.porcentaje >= 100).length;
      const inProgress = total - completed;
      const avgProgress = total > 0
        ? obrasData.reduce((sum, o) => sum + o.porcentaje, 0) / total
        : 0;
      const totalContractValue = obrasData.reduce((sum, o) => sum + (o.contratoMasAmpliaciones || 0), 0);
      const totalCertifiedValue = obrasData.reduce((sum, o) => sum + (o.certificadoALaFecha || 0), 0);

      setStats({
        total,
        inProgress,
        completed,
        avgProgress,
        totalContractValue,
        totalCertifiedValue,
      });
    } catch (error) {
      console.error("Error fetching obras:", error);
      // Set default empty state on error
      setIsAuthenticated(true);
      setObras([]);
      setStats({
        total: 0,
        inProgress: 0,
        completed: 0,
        avgProgress: 0,
        totalContractValue: 0,
        totalCertifiedValue: 0,
      });
    } finally {
      setLoading(false);
    }
  };

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
      fetchObras();
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
    <div className="min-h-screen bg-gradient-to-b from-background via-background/95 to-muted">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Dashboard de Obras
            </h1>
            <p className="text-muted-foreground mt-1">
              Vista general de tus proyectos de construcción
            </p>
          </div>
          <div className="flex gap-3">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nueva Obra
                </Button>
              </DialogTrigger>
              <DialogContent className="px-4 py-2">
                <DialogHeader className="px-0 py-2">
                  <DialogTitle className="text-lg font-medium">Crear Nueva Obra</DialogTitle>
                  <DialogDescription>
                    Completa la información básica de la obra. Podrás agregar más detalles después.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="designacion">
                      Designación y Ubicación <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="designacion"
                      placeholder="Ej: Construcción de edificio - Av. Corrientes 1234"
                      value={newObra.designacionYUbicacion}
                      onChange={(e) => setNewObra({ ...newObra, designacionYUbicacion: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="entidad">
                      Entidad Contratante <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="entidad"
                      placeholder="Ej: Municipalidad de Buenos Aires"
                      value={newObra.entidadContratante}
                      onChange={(e) => setNewObra({ ...newObra, entidadContratante: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mes">Mes Básico de Contrato</Label>
                    <Input
                      id="mes"
                      placeholder="Ej: Enero 2024"
                      value={newObra.mesBasicoDeContrato}
                      onChange={(e) => setNewObra({ ...newObra, mesBasicoDeContrato: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="iniciacion">Fecha de Iniciación</Label>
                    <Input
                      id="iniciacion"
                      placeholder="Ej: Marzo 2024"
                      value={newObra.iniciacion}
                      onChange={(e) => setNewObra({ ...newObra, iniciacion: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateObra} disabled={isCreating}>
                    {isCreating ? "Creando..." : "Crear Obra"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button asChild variant="outline">
              <Link href="/excel">
                Ver Todas las Obras
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Obras</CardTitle>
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.total || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Proyectos registrados
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">En Progreso</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.inProgress || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Obras activas
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completadas</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.completed || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Obras finalizadas
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Progreso Promedio</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.avgProgress ? stats.avgProgress.toFixed(1) : 0}%
                </div>
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${stats?.avgProgress || 0}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor Total Contratos</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(stats?.totalContractValue || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Suma de contratos + ampliaciones
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.5 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Certificado</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(stats?.totalCertifiedValue || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Monto certificado a la fecha
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Recent Obras */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.6 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Obras Recientes</CardTitle>
              <CardDescription>
                Últimas obras registradas en el sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              {obras.length === 0 ? (
                <div className="text-center py-12 space-y-4">
                  <FolderKanban className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <div>
                    <p className="text-muted-foreground mb-2">
                      No hay obras registradas. Crea tu primera obra para comenzar.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Si acabas de registrarte, asegurate de{" "}
                      <Link href="/onboarding" className="text-primary hover:underline">
                        configurar tu organización
                      </Link>
                      {" "}primero.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {obras.slice(0, 5).map((obra) => (
                    <Link
                      key={obra.id}
                      href={`/excel/${obra.id}`}
                      className="block"
                    >
                      <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="font-mono">
                              #{obra.n}
                            </Badge>
                            {obra.porcentaje >= 100 && (
                              <Badge variant="default" className="bg-green-600">
                                Completada
                              </Badge>
                            )}
                          </div>
                          <p className="font-medium truncate">{obra.designacionYUbicacion}</p>
                          <p className="text-sm text-muted-foreground">{obra.entidadContratante}</p>
                        </div>
                        <div className="flex items-center gap-4 ml-4">
                          <div className="text-right">
                            <div className="text-sm font-medium">{obra.porcentaje}%</div>
                            <div className="w-24 bg-muted rounded-full h-2 mt-1">
                              <div
                                className="bg-primary h-2 rounded-full"
                                style={{ width: `${obra.porcentaje}%` }}
                              />
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </Link>
                  ))}
                  {obras.length > 5 && (
                    <Button asChild variant="outline" className="w-full">
                      <Link href="/excel">
                        Ver todas las {obras.length} obras
                      </Link>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
