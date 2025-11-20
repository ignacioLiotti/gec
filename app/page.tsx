'use client';

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, FolderKanban, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
            <Button asChild variant="ghost" size="lg">
              <Link href="/onboarding">Configurar una nueva obra</Link>
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
