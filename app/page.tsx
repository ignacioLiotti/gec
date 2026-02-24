'use client';

import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  Globe,
  Plus,
  RotateCcw,
  Activity,
  AlertTriangle,
  Layers,
  Upload,
  UploadCloud,
  Zap,
  Check
} from "lucide-react";
import FolderFront from "@/components/ui/FolderFront";
import { Button } from "@/components/ui/button";
import {
  FormTable,
  FormTableContent,
} from "@/components/form-table/form-table";
import { Badge } from "@/components/ui/badge";
import { QuickFormDialog, type QuickFormField } from "@/components/forms/quick-form-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { FormTableConfig } from "@/components/form-table/types";
import UserMenu from "@/components/auth/user-menu";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { track } from "@vercel/analytics";

type DemoObraTableRow = {
  id: string;
  n: number;
  obra: string;
  entidad: string;
  mes: string;
  avance: number;
};


function MarketingLandingFrame({
  children,
  className = "",
  innerClassName = "",
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <div className={`rounded-3xl bg-stone-200/70 p-2 ${className}`}>
      <div className={`rounded-[22px] border border-stone-200/80 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)] ${innerClassName}`}>
        {children}
      </div>
    </div>
  );
}

function ProtoSurface({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]", className)}>
      {children}
    </div>
  );
}

function ProtoPanel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border border-stone-200 bg-stone-50/70", className)}>
      {children}
    </div>
  );
}

function MarketingLanding() {
  const [activeStep, setActiveStep] = useState(0);
  const [activeBenefit, setActiveBenefit] = useState(0);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactReason, setContactReason] = useState("Solicitar acceso");
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    message: "",
  });
  const anchorOffsetPx = 112;

  const scrollToAnchorWithOffset = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - anchorOffsetPx;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  };

  useEffect(() => {
    const handleHashScroll = () => {
      const hash = window.location.hash?.replace(/^#/, "");
      if (!hash) return;
      // Delay to ensure layout is mounted before measuring.
      window.requestAnimationFrame(() => {
        window.setTimeout(() => scrollToAnchorWithOffset(hash), 20);
      });
    };

    handleHashScroll();
    window.addEventListener("hashchange", handleHashScroll);
    return () => window.removeEventListener("hashchange", handleHashScroll);
  }, []);

  useEffect(() => {
    track("landing_page_view", {
      path: "/",
      section: "marketing",
    });
  }, []);

  const openContactDialog = (reason: string) => {
    setContactReason(reason);
    setContactForm((prev) => ({
      ...prev,
      message:
        prev.message ||
        `Hola, quiero ${reason.toLowerCase()} para mi empresa constructora.`,
    }));
    setContactOpen(true);
  };

  const submitContact = async () => {
    const payload = {
      ...contactForm,
      reason: contactReason,
      sourcePath: window.location.pathname + window.location.hash,
    };

    if (!payload.name.trim() || !payload.email.trim() || !payload.message.trim()) {
      toast.error("Completá nombre, email y mensaje");
      return;
    }

    setContactSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Error al enviar");
      }
      toast.success("Mensaje enviado. Te contactaremos pronto.");
      setContactOpen(false);
      setContactForm({
        name: "",
        email: authEmail ?? "",
        company: "",
        phone: "",
        message: "",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo enviar el mensaje");
    } finally {
      setContactSubmitting(false);
    }
  };

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setAuthEmail(data.user?.email ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthEmail(session?.user?.email ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const steps = [
    {
      id: "ingesta",
      tag: "PROTOCOLO",
      title: "Importas tus obras",
      label: "BASE DE DATOS",
      description: "Cargalas desde Excel o crealas en minutos. Cada obra queda estructurada y lista para seguimiento.",
      icon: <Layers size={18} />,
      visual: <Step1Visual />,
    },
    {
      id: "carga",
      tag: "GESTIÓN",
      title: "Subís los documentos",
      label: "CENTRALIZACIÓN",
      description: "Organizálos por obra en un solo sistema. Gestionálos desde cualquier lugar.",
      icon: <UploadCloud size={18} />,
      visual: <Step2Visual />,
    },
    {
      id: "extraccion",
      tag: "SISTEMA",
      title: "Accedes a los datos",
      label: "EXTRACCIÓN AUTOMÁTICA",
      description: "Identificamos el tipo de documento y convertimos la información en tablas estructuradas. <b> Sin carga manual.</b>",
      icon: <Zap size={18} />,
      visual: <Step3Visual />,
    },
    {
      id: "reportes",
      tag: "INTELIGENCIA",
      title: "Generás reportes y alertas",
      label: "MONITOREO",
      description: "Seguimiento de presupuestos, avances, gastos y vencimientos en segundos.",
      icon: <Activity size={18} />,
      visual: <Step4Visual />,
    }
  ];

  const benefits = [
    {
      title: "Recuperás información en segundos",
      description:
        "Accedés a documentos y datos de obras activas o históricas, sin buscar en carpetas físicas ni computadoras personales.",
      stat: 90,
      from: 0,
      suffix: "%",
      statLabel: "de tiempo administrativo recuperado",
      statSub: "Reducís horas de búsqueda a segundos.",
    },
    {
      title: "Detectás desvíos financieros a tiempo",
      description:
        "Identificás discrepancias entre presupuesto, gasto y avance apenas aparecen.",
      stat: 0,
      from: 50,
      suffix: "",
      statLabel: "inconsistencias financieras",
      statSub: "Controlás presupuesto y ejecución en tiempo real.",
    },
    {
      title: "Concentrás todo en un solo lugar",
      description:
        "Visualizás estado, avance, ejecución presupuestaria y alertas en un único panel.",
      stat: 1,
      from: 50,
      suffix: "",
      statLabel: "único sistema",
      statSub: "Gestionás todas tus obras desde un solo lugar.",
    },
    {
      title: "Accedés desde cualquier lugar",
      description:
        "Trabajás desde la oficina, tu casa o la obra. A través de tu celular o computadora.",
      is247: true as const,
      stat: 24,
      from: 0,
      suffix: "/7",
      statLabel: "acceso continuo",
      statSub: "Consultás información en todo momento.",
    },
    {
      title: "Trabajás sobre una única versión",
      description:
        "Eliminás conflictos de versiones y archivos duplicados. Todos consultan la misma base de datos actualizada.",
      stat: 1,
      from: 50,
      suffix: "",
      statLabel: "fuente de información",
      statSub: "Unificás documentos y datos en un solo sistema.",
    },
  ];

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 selection:bg-sky-100">
      <nav className="fixed top-0 z-50 w-full border-b border-stone-200/80 bg-stone-100/80 backdrop-blur-md z-[1000000]">
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 md:h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold tracking-tight text-stone-900">
            <span className="w-6 h-6 md:w-7 md:h-7 bg-orange-primary rounded-full" />
            <span className="uppercase tracking-widest text-xs md:text-sm">Sintesis</span>
          </div>
          <div className="flex items-center gap-3 md:gap-6">
            {(authEmail) ? (
              <>
                <Link
                  href="/excel"
                  className="inline-flex rounded-md border border-stone-900 bg-stone-900 px-3 md:px-6 py-1.5 text-white text-[10px] md:text-xs font-semibold uppercase tracking-widest shadow-[0_1px_0_rgba(0,0,0,0.03)] transition hover:bg-stone-800"
                >
                  Dashboard
                </Link>
                <UserMenu email={authEmail} />
              </>
            ) : (
              <Link
                href="#agendar-demo"
                onClick={(e) => {
                  e.preventDefault();
                  history.replaceState(null, "", "#agendar-demo");
                  scrollToAnchorWithOffset("agendar-demo");
                }}
                className="inline-flex rounded-md border border-stone-900 bg-stone-900 px-3 md:px-6 py-1.5 text-white text-[10px] md:text-xs font-semibold uppercase tracking-widest shadow-[0_1px_0_rgba(0,0,0,0.03)] transition hover:bg-stone-800"
              >
                Agendar demo
              </Link>
            )}
          </div>
        </div>
      </nav>

      <section className="relative pt-28 md:pt-48 pb-16 px-6 text-center max-w-5xl mx-auto z-10">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
        >
          {/* <span className="w-[400px] h-[200px] bg-orange-primary/40 blur-[100px] rounded-full pointer-events-none block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></span> */}
          <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-1 mb-8 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
            <span className="bg-orange-primary w-2 h-2 rounded-full"></span>
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-600">Sistema de gestion  de obras</p>
          </div>
          <h1 className="text-4xl md:text-7xl font-light tracking-tight mb-6 md:mb-10 text-stone-900 leading-[1.05] md:leading-[0.95]">
            Digitalización y control de tus obras en un solo lugar
          </h1>
          <p className="text-lg text-stone-800 mb-4 max-w-3xl mx-auto leading-relaxed z-10">
            Centralizá documentos, automatizá datos y detectá desvíos antes de que impacten en tu presupuesto.
          </p>
          {/* <p className="text-base text-stone-500 mb-12 max-w-3xl mx-auto leading-relaxed">
            Una plataforma diseñada para empresas de construcción que necesitan orden, control y visibilidad en tiempo real.
          </p> */}
          {/* <div className="flex flex-col sm:flex-row justify-center gap-4 mt-10">
            <a
              href="#como-funciona"
              onClick={(e) => {
                e.preventDefault();
                history.replaceState(null, "", "#como-funciona");
                scrollToAnchorWithOffset("como-funciona");
              }}
              className="bg-stone-900 text-white px-10 py-4 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-stone-800 transition-all flex items-center justify-center gap-2 group shadow-xl shadow-stone-300/50"
            >
              Ver cómo funciona <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </a>

          </div> */}
        </motion.div>
      </section>

      <div className="relative bg-stone-100 bg-linear-to-b from-stone-50 to-stone-100 -mt-60 z-[5] hidden md:block" style={{ height: 340 }}>
        <div className="absolute inset-x-0 top-0 h-2/3 pointer-events-none z-10 bg-linear-to-b from-stone-50 to-transparent " />

        <div className="max-w-7xl mx-auto px-6 h-full relative">

          {/* SVG angled dashed lines — fan in from wide spread → narrow center */}
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {([
              [10, 38],
              [27, 44],
              [50, 50],
              [73, 56],
              [90, 62],
            ] as [number, number][]).map(([x1, x2], i) => (
              <path
                key={i}
                d={`M ${x1} 0 C ${x1} 38 ${x2} 62 ${x2} 100`}
                fill="none"
                stroke="#d6d3d1"
                strokeWidth="0.4"
                strokeDasharray="2.5 4"
              />
            ))}
          </svg>

          {/* Dots following the same cubic-bezier curves via 5-point keyframes */}
          {([
            ["10%", "14.4%", "24%", "33.6%", "38%"],
            ["27%", "29.7%", "35.5%", "41.3%", "44%"],
            ["50%", "50%", "50%", "50%", "50%"],
            ["73%", "70.3%", "64.5%", "58.7%", "56%"],
            ["90%", "85.6%", "76%", "66.4%", "62%"],
          ]).map((xKeys, i) => (
            <div key={i}>
              {/* Primary dot */}
              <motion.div
                className="absolute h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-orange-500"
                style={{ boxShadow: "0 0 7px 2px rgba(249,115,22,0.4)" }}
                animate={{
                  left: xKeys,
                  top: ["-8px", "33px", "70px", "107px", "148px"],
                  opacity: [0, 1, 1, 0.6, 0],
                }}
                transition={{
                  duration: 1.9,
                  repeat: Infinity,
                  delay: i * 0.34,
                  ease: "linear",
                  repeatDelay: 0.8,
                }}
              />
              {/* Trailing dot */}
              <motion.div
                className="absolute h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-orange-300"
                animate={{
                  left: xKeys,
                  top: ["-8px", "33px", "70px", "107px", "148px"],
                  opacity: [0, 0.6, 0.4, 0.2, 0],
                }}
                transition={{
                  duration: 1.9,
                  repeat: Infinity,
                  delay: i * 0.34 + 0.3,
                  ease: "linear",
                  repeatDelay: 0.8,
                }}
              />
            </div>
          ))}

          {/* Center label */}

        </div>
      </div>

      <section id="como-funciona" className="scroll-mt-20 px-4 md:px-6  relative bg-stone-100">
        <div className="absolute flex items-center justify-center pointer-events-none top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100000]">
          <div className="flex items-center gap-2.5 rounded-full border border-stone-200 bg-stone-100 px-5 py-2 text-[15px] font-bold uppercase tracking-widest text-stone-400 shadow-sm">
            <motion.div
              className="h-2 w-2 rounded-full bg-orange-400"
              animate={{ scale: [1, 1.6, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            Cómo funciona
            <motion.div
              className="h-2 w-2 rounded-full bg-orange-400"
              animate={{ scale: [1, 1.6, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: 0.6 }}
            />
          </div>
        </div>
        <MarketingLandingFrame className="max-w-7xl mx-auto" innerClassName="overflow-hidden md:h-[640px]">
          <div className="flex flex-col md:flex-row md:h-[640px]">
            <div className="w-full md:w-[40%] border-b md:border-b-0 md:border-r border-stone-200/70 p-6 md:p-12 flex flex-col justify-center overflow-hidden">
              <div className="mb-10">
                {/* <span className="text-[10px] italic text-stone-400 font-bold uppercase tracking-widest block mb-2">flujo documental</span> */}
                {/* <h2 className="text-2xl font-bold text-stone-900 tracking-tight">Cómo funciona</h2> */}
              </div>

              {/* Stepper */}
              <div className="flex flex-col">
                {steps.map((step, idx) => {
                  const isActive = activeStep === idx;
                  const isDone = idx < activeStep;
                  const isNext = idx === activeStep + 1;
                  const isLast = idx === steps.length - 1;
                  return (
                    <motion.div key={idx} layout transition={{ duration: 0.18, ease: "easeInOut" }} className="flex gap-3 md:gap-4">
                      {/* Left: circle + connector */}
                      <div className="flex flex-col items-center">
                        <button
                          type="button"
                          onClick={() => setActiveStep(idx)}
                          className={cn(
                            "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200",
                            "h-8 w-8 md:h-10 md:w-10",
                            isActive
                              ? "border-orange-500 bg-orange-500 text-white shadow-md shadow-orange-200/60"
                              : isDone
                                ? "border-orange-300 bg-orange-50 text-orange-500"
                                : isNext
                                  ? "border-orange-300 bg-white text-stone-500"
                                  : "border-stone-200 bg-white text-stone-400"
                          )}
                          aria-label={`Ir al paso ${idx + 1}`}
                        >
                          {isDone ? (
                            <CheckCircle2 size={15} className="text-orange-500" />
                          ) : (
                            <span className="text-xs font-bold">{idx + 1}</span>
                          )}
                          {isNext && (
                            <>
                              <span className="absolute inset-0 rounded-full border-2 border-orange-400 pointer-events-none animate-ping opacity-50" />
                              <span className="absolute inset-0 rounded-full border border-orange-300 pointer-events-none animate-ping opacity-30" style={{ animationDelay: "0.4s" }} />
                            </>
                          )}
                        </button>
                        {!isLast && (
                          <motion.div layout className="mt-1 mb-1 w-px flex-1 border-l-2 border-dashed border-stone-200" />
                        )}
                      </div>

                      {/* Right: content */}
                      <button
                        type="button"
                        onClick={() => setActiveStep(idx)}
                        className={cn(
                          "mb-4 md:mb-7 flex-1 text-left transition-opacity duration-200 cursor-pointer",
                          isNext ? "opacity-70 hover:opacity-90" : !isActive && "opacity-50 hover:opacity-75"
                        )}
                      >
                        <div className={cn(
                          "text-[11px] font-bold uppercase tracking-widest mb-1",
                          isActive ? "text-orange-600" : "text-stone-400"
                        )}>
                          {step.label}
                        </div>
                        <div className={cn(
                          "text-sm md:text-base font-semibold leading-snug",
                          isActive ? "text-stone-900" : "text-stone-500"
                        )}>
                          {step.title}
                        </div>
                        <AnimatePresence initial={false}>
                          {isActive && (
                            <motion.p
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.15 }}
                              className="mt-1.5 text-xs leading-relaxed text-stone-500 overflow-hidden"
                            >
                              {step.description}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <div className="flex w-full md:w-[60%] bg-stone-50/70 p-2 sm:p-3 md:p-6 items-start md:items-center justify-center relative border-t border-stone-200/70 md:border-t-0">
              <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-orange-100/40 blur-[100px] rounded-full pointer-events-none" />
              <div className="absolute right-3 top-3 md:right-5 md:top-5 z-20 flex items-center gap-2">
                <div className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[9px] md:text-[10px] font-semibold uppercase tracking-widest text-stone-500 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                  {steps[activeStep].tag}
                </div>
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="w-full max-w-2xl z-10 pt-6 md:pt-0"
                >
                  <MarketingLandingFrame innerClassName="p-0 overflow-hidden">
                    <div className="border-b border-stone-200/80 bg-white px-4 py-2.5 flex items-center gap-1.5">
                      {steps.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveStep(idx)}
                          className={`h-1.5 rounded-full transition-all ${activeStep === idx ? "w-5 bg-orange-500" : "w-1.5 bg-stone-200 hover:bg-stone-300"}`}
                          aria-label={`Ir al paso ${idx + 1}`}
                        />
                      ))}
                    </div>
                    <div className="overflow-x-auto md:overflow-visible">
                      {steps[activeStep].visual}
                    </div>
                  </MarketingLandingFrame>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </MarketingLandingFrame>
      </section>

      {/* Connector: Pipeline → Resultados (funnel) */}
      <div className="relative bg-stone-100 overflow-hidden z-10 hidden md:block" style={{ height: 240 }}>
        <div className="max-w-7xl mx-auto px-6 h-full relative">

          {/* SVG angled dashed lines — fan in from wide spread → narrow center */}
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {([
              [10, 38],
              [27, 44],
              [50, 50],
              [73, 56],
              [90, 62],
            ] as [number, number][]).map(([x1, x2], i) => (
              <path
                key={i}
                d={`M ${x1} 0 C ${x1} 38 ${x2} 62 ${x2} 100`}
                fill="none"
                stroke="#d6d3d1"
                strokeWidth="0.4"
                strokeDasharray="2.5 4"
              />
            ))}
          </svg>

          {/* Dots following the same cubic-bezier curves via 5-point keyframes */}
          {([
            ["10%", "14.4%", "24%", "33.6%", "38%"],
            ["27%", "29.7%", "35.5%", "41.3%", "44%"],
            ["50%", "50%", "50%", "50%", "50%"],
            ["73%", "70.3%", "64.5%", "58.7%", "56%"],
            ["90%", "85.6%", "76%", "66.4%", "62%"],
          ]).map((xKeys, i) => (
            <div key={i}>
              {/* Primary dot */}
              <motion.div
                className="absolute h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-orange-500"
                style={{ boxShadow: "0 0 7px 2px rgba(249,115,22,0.4)" }}
                animate={{
                  left: xKeys,
                  top: ["-8px", "33px", "70px", "107px", "148px"],
                  opacity: [0, 1, 1, 0.6, 0],
                }}
                transition={{
                  duration: 1.9,
                  repeat: Infinity,
                  delay: i * 0.34,
                  ease: "linear",
                  repeatDelay: 0.8,
                }}
              />
              {/* Trailing dot */}
              <motion.div
                className="absolute h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-orange-300"
                animate={{
                  left: xKeys,
                  top: ["-8px", "33px", "70px", "107px", "148px"],
                  opacity: [0, 0.6, 0.4, 0.2, 0],
                }}
                transition={{
                  duration: 1.9,
                  repeat: Infinity,
                  delay: i * 0.34 + 0.3,
                  ease: "linear",
                  repeatDelay: 0.8,
                }}
              />
            </div>
          ))}

          {/* Center label */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2.5 rounded-full border border-stone-200 bg-stone-100 px-5 py-2 text-[15px] font-bold uppercase tracking-widest text-stone-400 shadow-sm">
              <motion.div
                className="h-2 w-2 rounded-full bg-orange-400"
                animate={{ scale: [1, 1.6, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
              sintesis genera
              <motion.div
                className="h-2 w-2 rounded-full bg-orange-400"
                animate={{ scale: [1, 1.6, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0.6 }}
              />
            </div>
          </div>
        </div>
      </div>

      <section className="pb-16 md:pb-0 bg-stone-100 text-stone-900 overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-1/3 -translate-x-1/2 h-72 w-72 rounded-full bg-orange-200/20 blur-[120px]" />
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-6 relative z-10">
          <MarketingLandingFrame className="max-w-7xl mx-auto" innerClassName="overflow-hidden md:h-[640px]">
            <div className="flex flex-col md:flex-row md:h-[640px]">

              {/* Left: animated stat visual */}
              <div className="flex w-full md:w-[60%] bg-stone-50/70 items-center justify-center relative border-b border-stone-200/70 md:border-b-0 md:border-r min-h-[180px] md:min-h-0">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-orange-100/40 blur-[100px] rounded-full pointer-events-none" />
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeBenefit}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.2 }}
                    className="relative z-10 flex flex-col items-center justify-center text-center px-4 py-6 md:px-8 md:py-12 select-none"
                  >
                    {benefits[activeBenefit].is247 ? (
                      <div className="flex items-end gap-1 leading-none tabular-nums">
                        <span className="text-[64px] md:text-[120px] font-black tracking-tighter text-stone-900">
                          <StatCounter target={24} from={0} suffix="" />
                        </span>
                        <span className="text-[28px] md:text-[52px] font-black text-stone-300 pb-1 md:pb-2">/</span>
                        <span className="text-[44px] md:text-[80px] font-black tracking-tighter text-stone-900">
                          <StatCounter target={7} from={0} suffix="" delay={920} frames={24} />
                        </span>
                      </div>
                    ) : (
                      <div className="text-[72px] md:text-[120px] font-black leading-none tracking-tighter text-stone-900 tabular-nums">
                        <StatCounter
                          target={benefits[activeBenefit].stat}
                          from={benefits[activeBenefit].from ?? 0}
                          suffix={benefits[activeBenefit].suffix}
                        />
                      </div>
                    )}
                    <div className="mt-2 md:mt-3 text-sm md:text-xl font-semibold text-stone-600">
                      {benefits[activeBenefit].statLabel}
                    </div>
                    <div className="mt-0.5 md:mt-1 text-xs md:text-base text-stone-400">
                      {benefits[activeBenefit].statSub}
                    </div>
                    {/* Decorative ring */}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center -z-10">
                      <div className="h-48 w-48 rounded-full border border-stone-200/60" />
                      <div className="absolute h-64 w-64 rounded-full border border-stone-200/30" />
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Right: stepper (40%) */}
              <div className="w-full md:w-[40%] p-5 md:p-12 flex flex-col justify-center overflow-hidden">
                <div className="mb-6 md:mb-10">
                  <span className="text-[10px] italic text-stone-400 font-bold uppercase tracking-widest block mb-2">RESULTADOS</span>
                  <h2 className="text-lg md:text-2xl font-bold text-stone-900 tracking-tight">Lo que lográs con <span className="text-orange-500">SINTESIS</span></h2>
                </div>

                {/* Stepper */}
                <div className="flex flex-col">
                  {benefits.map((benefit, idx) => {
                    const isActive = activeBenefit === idx;
                    const isDone = idx < activeBenefit;
                    const isNext = idx === activeBenefit + 1;
                    const isLast = idx === benefits.length - 1;
                    return (
                      <motion.div key={idx} layout transition={{ duration: 0.18, ease: "easeInOut" }} className="flex gap-3 md:gap-4 cursor-pointer">
                        <div className="flex flex-col items-center cursor-pointer">
                          <button
                            type="button"
                            onClick={() => setActiveBenefit(idx)}
                            className={cn(
                              "relative flex h-8 w-8 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 cursor-pointer",
                              isActive
                                ? "border-orange-500 bg-orange-500 text-white shadow-md shadow-orange-200/60"
                                : isDone
                                  ? "border-orange-300 bg-orange-50 text-orange-500"
                                  : isNext
                                    ? "border-orange-300 bg-white text-stone-500"
                                    : "border-stone-200 bg-white text-stone-400"
                            )}
                          >
                            {isDone ? (
                              <CheckCircle2 size={15} className="text-orange-500" />
                            ) : (
                              <span className="text-xs font-bold h-full w-full rounded-full flex items-center justify-center ">{idx + 1}</span>
                            )}
                            {isNext && (
                              <>
                                <span className="absolute inset-0 rounded-full border-2 border-orange-400 pointer-events-none animate-ping opacity-50" />
                                <span className="absolute inset-0 rounded-full border border-orange-300 pointer-events-none animate-ping opacity-30" style={{ animationDelay: "0.4s" }} />
                              </>
                            )}
                          </button>
                          {!isLast && (
                            <motion.div layout className="mt-1 mb-1 w-px flex-1 border-l-2 border-dashed border-stone-200" />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveBenefit(idx)}
                          className={cn(
                            "mb-3 md:mb-5 flex-1 text-left transition-opacity duration-200",
                            isNext ? "opacity-70 hover:opacity-90 cursor-pointer" : !isActive && "opacity-50 hover:opacity-75 cursor-pointer"
                          )}
                        >
                          <div className={cn(
                            "text-[11px] font-bold uppercase tracking-widest mb-1",
                            isActive ? "text-orange-600" : "text-stone-400"
                          )}>
                            IMPACTO
                          </div>
                          <div className={cn(
                            "text-sm md:text-base font-semibold leading-snug",
                            isActive ? "text-stone-900" : "text-stone-500"
                          )}>
                            {benefit.title}
                          </div>
                          <AnimatePresence initial={false}>
                            {/* {isActive && ( */}
                            <motion.p
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.15 }}
                              className="mt-1.5 text-xs leading-relaxed text-stone-500 overflow-hidden"
                            >
                              {/* {benefit.description} */}
                            </motion.p>
                            {/* )} */}
                          </AnimatePresence>
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

            </div>
          </MarketingLandingFrame>
        </div>
      </section>

      {/* Connector: Resultados → CTA (all lines converge to the orange ball) */}
      <div className="relative overflow-hidden hidden md:block -mb-4" style={{ background: "linear-gradient(to bottom, #f5f5f4, #fafaf9)", height: 180 }}>
        <div className="max-w-7xl mx-auto px-6 h-full relative">

          {/* SVG bezier lines converging to center */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {([
              [15, 50],
              [30, 50],
              [50, 50],
              [70, 50],
              [85, 50],
            ] as [number, number][]).map(([x1, x2], i) => (
              <path
                key={i}
                d={`M ${x1} 0 C ${x1} 45 ${x2} 55 ${x2} 100`}
                fill="none"
                stroke="#d6d3d1"
                strokeWidth="0.4"
                strokeDasharray="2.5 4"
              />
            ))}
          </svg>

          {/* Dots following each converging curve */}
          {([
            ["15%", "20.5%", "32.5%", "44.5%", "50%"],
            ["30%", "33%", "40%", "47%", "50%"],
            ["50%", "50%", "50%", "50%", "50%"],
            ["70%", "67%", "60%", "53%", "50%"],
            ["85%", "79.5%", "67.5%", "55.5%", "50%"],
          ]).map((xKeys, i) => (
            <div key={i}>
              <motion.div
                className="absolute h-2 w-2 -translate-x-1/2 rounded-full bg-orange-500"
                style={{ boxShadow: "0 0 6px 2px rgba(249,115,22,0.4)" }}
                animate={{
                  left: xKeys,
                  top: ["-6px", "37px", "84px", "131px", "186px"],
                  opacity: [0, 1, 1, 0.7, 0],
                }}
                transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.28, ease: "linear", repeatDelay: 1 }}
              />
              <motion.div
                className="absolute h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-orange-300"
                animate={{
                  left: xKeys,
                  top: ["-6px", "37px", "84px", "131px", "186px"],
                  opacity: [0, 0.6, 0.4, 0.2, 0],
                }}
                transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.28 + 0.3, ease: "linear", repeatDelay: 1 }}
              />
            </div>
          ))}

          {/* Convergence glow — sits right at the bottom, aligns with the orange ball below */}
          {/* <motion.div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 h-5 w-5 rounded-full bg-orange-500"
            style={{ boxShadow: "0 0 16px 6px rgba(249,115,22,0.35)" }}
            animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          /> */}
        </div>
      </div>

      <section id="agendar-demo" className="scroll-mt-28 pt-12 pb-20 md:pt-0 md:pb-40 text-center px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center"
        >
          {/* Orange ball — landing point of the converging lines */}
          <div className="mb-10 flex h-24 w-24 items-center justify-center rounded-full bg-orange-500 shadow-[0_0_28px_8px_rgba(249,115,22,0.25)] shadow-xl">
          </div>

          {/* Headline */}
          <h2 className="text-3xl md:text-6xl font-light tracking-tight text-stone-900 leading-[1.1] mb-8 md:mb-10 max-w-lg">
            ¿Listo para digitalizar tus obras?
          </h2>

          {/* CTA button */}
          <button
            type="button"
            onClick={() => openContactDialog("Solicitar acceso")}
            className="group relative rounded-full bg-stone-900 px-10 py-4 text-[11px] font-bold uppercase tracking-widest text-white transition-all hover:bg-stone-700 hover:shadow-xl hover:shadow-stone-400/25 active:scale-[0.98]"
          >
            Contactate con nosotros
          </button>

          {/* Trust line */}
          <p className="mt-6 text-[10px] font-bold uppercase tracking-widest text-stone-400">
            100% online
            Siempre disponible cuando lo necesites
          </p>
        </motion.div>
      </section>


      <footer className="py-16 border-t border-stone-200 flex flex-col items-center gap-6">
        <div className="flex items-center gap-2 font-bold text-stone-400">
          <span className="uppercase tracking-widest text-[10px]">Sintesis Cloud Solutions</span>
        </div>
        <p className="text-stone-500 text-[10px] uppercase tracking-widest">© {new Date().getFullYear()} — Control de Ingeniería de Próxima Generación</p>
      </footer>

      <QuickFormDialog
        open={contactOpen}
        onOpenChange={setContactOpen}
        title={contactReason}
        description="Contanos brevemente tu caso y te escribimos por email."
        variant="dashboard"
        fields={[
          {
            key: "name",
            label: "Nombre",
            type: "text",
            required: true,
            placeholder: "Tu nombre",
          },
          {
            key: "email",
            label: "Email",
            type: "email",
            required: true,
            placeholder: "nombre@empresa.com",
          },
          {
            key: "company",
            label: "Empresa",
            type: "text",
            placeholder: "Constructora XYZ",
          },
          {
            key: "phone",
            label: "Teléfono",
            type: "text",
            placeholder: "+54 9 ...",
          },
          {
            key: "message",
            label: "Mensaje",
            type: "textarea",
            required: true,
            placeholder: "Contanos qué querés resolver y cuántas obras gestionan.",
          },
        ] as QuickFormField[]}
        values={contactForm}
        onChange={(key: string, value: string) =>
          setContactForm((prev) => ({ ...prev, [key]: value }))
        }
        onSubmit={submitContact}
        isSubmitting={contactSubmitting}
        submitLabel={contactSubmitting ? "Enviando..." : "Enviar consulta"}
        cancelLabel="Cancelar"
      />
    </div >
  );
}

function Step1Visual() {
  const [demoRows, setDemoRows] = useState<DemoObraTableRow[]>([
    { id: "demo-21", n: 21, obra: "Escuela Técnica - Etapa II", avance: 38, entidad: "Ministerio Educación", mes: "Jul 2025" },
    { id: "demo-22", n: 22, obra: "Centro de Salud - Refacción", avance: 64, entidad: "Municipio", mes: "Ago 2025" },
    { id: "demo-23", n: 23, obra: "Red Cloacal - Tramo Norte", avance: 12, entidad: "Provincia", mes: "Jun 2025" },
    { id: "demo-24", n: 24, obra: "Planta Potabilizadora - Módulo B", avance: 81, entidad: "AySA", mes: "Sep 2025" },
    { id: "demo-25", n: 25, obra: "Pavimentación Barrio Sur", avance: 27, entidad: "Municipalidad", mes: "May 2025" },
    { id: "demo-26", n: 26, obra: "Hospital Regional - Ala Este", avance: 92, entidad: "Ministerio Salud", mes: "Oct 2025" },
    { id: "demo-27", n: 27, obra: "Escuela Primaria N° 18", avance: 55, entidad: "Provincia", mes: "Jul 2025" },
    { id: "demo-28", n: 28, obra: "Desagües Pluviales Centro", avance: 8, entidad: "Municipio", mes: "Abr 2025" },
    { id: "demo-29", n: 29, obra: "Centro Cultural - Refuncionalización", avance: 100, entidad: "Cultura", mes: "Dic 2024" },
    { id: "demo-30", n: 30, obra: "Viviendas Sociales - Etapa III", avance: 46, entidad: "IVC", mes: "Ago 2025" },
  ]);
  const [tableVersion, setTableVersion] = useState(0);
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [values, setValues] = useState({
    designacionYUbicacion: "",
    entidadContratante: "",
    mesBasicoDeContrato: "",
    iniciacion: "",
  });

  const fakeSubmit = async () => {
    const obraName = values.designacionYUbicacion.trim();
    const entidad = values.entidadContratante.trim();
    if (!obraName || !entidad) {
      toast.error("Completá designación y entidad");
      return;
    }
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 700));
    setDemoRows((prev) => {
      const nextN = prev.reduce((max, row) => Math.max(max, row.n), 0) + 1;
      return [
        {
          id: `demo-${nextN}-${Date.now()}`,
          n: nextN,
          obra: obraName,
          avance: 0,
          entidad,
          mes: values.mesBasicoDeContrato.trim() || "Nuevo",
        },
        ...prev,
      ];
    });
    setTableVersion((v) => v + 1);
    setIsSubmitting(false);
    setOpen(false);
    setValues({
      designacionYUbicacion: "",
      entidadContratante: "",
      mesBasicoDeContrato: "",
      iniciacion: "",
    });
    toast.success("Demo: nueva obra creada");
  };

  const demoTableConfig = useMemo<FormTableConfig<DemoObraTableRow, Record<string, never>>>(() => ({
    tableId: "landing-demo-obras-form-table",
    columns: [
      // { id: "n", label: "N°", field: "n", cellType: "number", editable: true, width: 72 },
      { id: "obra", label: "Obra", field: "obra", cellType: "text", editable: true, width: 150 },
      { id: "entidad", label: "Entidad", field: "entidad", cellType: "text", editable: true, width: 80 },
      { id: "mes", label: "Mes", field: "mes", cellType: "text", editable: true, width: 80 },
      {
        id: "avance",
        label: "Avance %",
        field: "avance",
        cellType: "number",
        editable: false,
        enableResize: true,
        width: 100,
        cellConfig: {
          renderReadOnly: ({ value }) => {
            const pct = Math.max(0, Math.min(100, Number(value) || 0));
            return (
              <div className="flex min-w-[120px] items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-1.5 rounded-full bg-cyan-600" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 text-right text-[10px] tabular-nums text-stone-700">{pct}%</span>
              </div>
            );
          },
        },
      },
    ],
    defaultRows: demoRows,
    showInlineSearch: true,
    searchPlaceholder: "Buscar obra o entidad...",
    lockedPageSize: 10,
    showActionsColumn: false,
    allowAddRows: false,
    createRow: () => ({
      id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      n: demoRows.reduce((max, row) => Math.max(max, row.n), 0) + 1,
      obra: "Nueva obra",
      entidad: "",
      mes: "",
      avance: 0,
    }),
    tabFilters: [
      { id: "all", label: "Todas" },
      { id: "active", label: "Activas", predicate: (row) => Number(row.avance) < 100 },
      { id: "done", label: "Completadas", predicate: (row) => Number(row.avance) >= 100 },
    ],
    onSave: async ({ rows }) => {
      setDemoRows(rows);
      toast.success("Demo: cambios guardados");
    },
    toolbarActions: (
      <div className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[10px] font-semibold text-stone-600">
        Demo local
      </div>
    ),
    emptyStateMessage: "No hay obras en la demo.",
  }), [demoRows]);

  return (
    <ProtoSurface className="overflow-hidden rounded-none border-none max-h-full">
      <div className="border-b border-stone-200/80 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Panel de obras</div>
            <div className="text-sm font-semibold text-stone-900">Base de datos inicial</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[10px] font-semibold text-stone-600">Importar CSV</div>
            <motion.button
              type="button"
              onClick={() => setOpen(true)}
              animate={{
                boxShadow: [
                  "0 0 0 0 rgba(249,115,22,0.00)",
                  "0 0 0 6px rgba(249,115,22,0.10)",
                  "0 0 0 0 rgba(249,115,22,0.00)",
                ],
                backgroundPosition: ["0% 0%", "140% 0%"],
              }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              className="relative overflow-hidden rounded-lg border border-orange-300 bg-orange-500 px-2 py-1 text-[10px] font-semibold text-white"
              style={{
                backgroundImage:
                  "linear-gradient(110deg, rgba(249,115,22,1) 30%, rgba(255,255,255,0.35) 45%, rgba(249,115,22,1) 60%)",
                backgroundSize: "220% 100%",
              }}
            >
              Nueva obra
            </motion.button>
          </div>
        </div>
      </div>
      <div className="">
        <FormTable key={tableVersion} config={demoTableConfig} variant="embedded">
          <div className="space-y-2 p-2">
            <div className="flex items-center justify-between gap-2">
              {/* <FormTableTabs className="justify-start" /> */}
              <div className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[10px] text-stone-600">
                Editable / ordenable
              </div>
            </div>
            <FormTableContent className="my-0 max-h-[260px] max-w-full" />
          </div>
        </FormTable>
      </div>
      <QuickFormDialog
        open={open}
        onOpenChange={setOpen}
        title="Crear Nueva Obra"
        description="Demo interactiva del flujo de alta de obra."
        variant="dashboard"
        fields={[
          { key: "designacionYUbicacion", label: "Designación y ubicación", type: "text", required: true, placeholder: "Ej: Centro de salud - Etapa I" },
          { key: "entidadContratante", label: "Entidad contratante", type: "text", required: true, placeholder: "Ej: Municipalidad" },
          { key: "mesBasicoDeContrato", label: "Mes básico de contrato", type: "text", placeholder: "Ej: Enero 2025" },
          { key: "iniciacion", label: "Fecha de iniciación", type: "text", placeholder: "Ej: Marzo 2025" },
        ] as QuickFormField[]}
        values={values}
        onChange={(key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }))}
        onSubmit={fakeSubmit}
        isSubmitting={isSubmitting}
        submitLabel={isSubmitting ? "Creando..." : "Crear obra"}
        cancelLabel="Cancelar"
      />
    </ProtoSurface>
  );
}

function Step2Visual() {
  const folderData = [
    {
      key: "certificados", label: "Certificados", sidebarLabel: "Certificados",
      files: [
        { name: "CERT-01.pdf", type: "pdf" },
        { name: "CERT-02.pdf", type: "pdf" },
        { name: "CERT-03.pdf", type: "pdf" },
        { name: "cert-resumen.xlsx", type: "xlsx" },
      ],
    },
    {
      key: "documentacion", label: "Documentacion", sidebarLabel: "Documentacion",
      files: [
        { name: "planos-generales.pdf", type: "pdf" },
        { name: "memoria-desc.pdf", type: "pdf" },
      ],
    },
    {
      key: "oferta", label: "Oferta", sidebarLabel: "Oferta",
      files: [
        { name: "oferta-tecnica.pdf", type: "pdf" },
        { name: "oferta-econ.pdf", type: "pdf" },
        { name: "planilla-precios.xlsx", type: "xlsx" },
      ],
    },
    {
      key: "ordenes", label: "Ordenes De Compra", sidebarLabel: "Ordenes De Compra",
      files: [
        { name: "OC-001.pdf", type: "pdf" },
        { name: "OC-002.pdf", type: "pdf" },
        { name: "C2.pdf", type: "pdf" },
      ],
    },
  ];

  const [activeFolder, setActiveFolder] = useState("ordenes");
  const activeFolderData = folderData.find((f) => f.key === activeFolder)!;
  const totalFiles = folderData.reduce((sum, f) => sum + f.files.length, 0);

  return (
    <ProtoSurface className="overflow-hidden rounded-none border-none">
      <div className="flex min-h-[360px] flex-col md:flex-row">
        {/* Sidebar */}
        <div className="flex w-full shrink-0 flex-col border-b border-stone-200 bg-stone-50/60 md:w-[185px] md:border-b-0 md:border-r">
          {/* Sidebar header */}
          <div className="flex items-center justify-between border-b border-stone-200/70 px-3 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Carpetas</span>
            <div className="flex items-center gap-2">
              <button type="button" className="text-stone-400 hover:text-stone-600 transition-colors">
                <RotateCcw size={11} />
              </button>
              <button type="button" className="flex items-center gap-0.5 text-[10px] text-stone-500 hover:text-stone-700 transition-colors">
                <Plus size={11} />
                <span>Crear</span>
              </button>
            </div>
          </div>

          {/* Folder tree */}
          <div className="max-h-[140px] flex-1 overflow-auto px-2.5 py-2.5 md:max-h-none">
            {/* Root folder */}
            <div className="mb-1 flex items-center gap-1.5 rounded px-1 py-1 text-[11px] font-medium text-stone-700">
              <ChevronDown size={11} className="shrink-0 text-stone-400" />
              <Folder size={12} className="shrink-0 text-stone-500" />
              <span>Documentos</span>
            </div>
            {/* Root file */}
            <div className="ml-5 mb-1.5 flex items-center gap-1 rounded px-1 py-0.5 text-[10px] text-stone-500">
              <FileText size={10} className="shrink-0" />
              <span>C2.pdf</span>
            </div>
            {/* Children */}
            <div className="ml-3.5 space-y-0.5">
              {folderData.map((folder) => {
                const isActive = activeFolder === folder.key;
                return (
                  <button
                    key={folder.key}
                    type="button"
                    onClick={() => setActiveFolder(folder.key)}
                    className={cn(
                      "w-full flex items-center justify-between gap-1.5 rounded px-2 py-1 text-left transition-colors",
                      isActive
                        ? "bg-orange-500 text-white"
                        : "text-stone-600 hover:bg-stone-200/60"
                    )}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Folder size={10} className={cn("shrink-0", isActive ? "text-orange-200" : "text-stone-400")} />
                      <span className="truncate text-[10px]">{folder.sidebarLabel}</span>
                    </div>
                    <span className={cn("shrink-0 text-[9px]", isActive ? "text-orange-200" : "text-stone-400")}>
                      {folder.files.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="hidden border-t border-stone-200/70 px-3 py-2.5 md:block">
            <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-stone-400">Leyenda</div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[10px] text-stone-500">
                <div className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-blue-500" />
                <span>Extracción de datos</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-stone-500">
                <div className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-purple-500" />
                <span>Entrada manual</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-stone-500">
                <div className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-indigo-400" />
                <span>Mixta (extracción + manual)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-1 flex-col">
          {/* Topbar */}
          <div className="flex flex-col gap-2 border-b border-stone-200 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <div className="flex min-w-0 items-center gap-2">
              <Folder size={13} className="shrink-0 text-stone-500" />
              <span className="truncate text-[11px] font-medium text-stone-700">Todos los documentos</span>
              <span className="shrink-0 text-[11px] text-stone-400">({totalFiles})</span>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 self-start rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-[10px] font-medium text-stone-600 shadow-sm hover:bg-stone-50 transition-colors sm:self-auto"
            >
              <Upload size={11} />
              Subir archivos
            </button>
          </div>

          {/* Content area */}
          <div className="px-3 pt-3 pb-3 sm:px-4 sm:pt-4">
            {/* Folder row */}
            <div className="overflow-hidden pb-1">
              <div className="flex w-max items-start gap-3 px-1 pb-1 md:gap-4">
                {folderData.map((folder) => {
                  const isActive = activeFolder === folder.key;
                  const hasFiles = folder.files.length > 0;
                  return (
                    <div key={folder.key} className="group cursor-default flex h-[82px] shrink-0 flex-col items-center justify-end gap-1 md:h-[88px]">
                      <button
                        type="button"
                        onClick={() => setActiveFolder(folder.key)}
                        className={cn(
                          "relative ml-0.5 mb-0.5 flex h-[62px] w-[84px] flex-col items-start gap-2 overflow-visible rounded-lg border transition-colors md:h-[68px] md:w-[96px]",
                          isActive
                            ? "bg-linear-to-b from-amber-500 to-amber-700"
                            : "bg-linear-to-b from-stone-500 to-stone-700"
                        )}
                      >
                        <div className="flex flex-col items-center justify-end w-full h-full">
                          {hasFiles && (
                            <span className={cn(
                              "absolute left-1/2 -top-2 h-[56px] w-[70px] -translate-x-1/2 border bg-stone-100 bg-linear-to-b from-stone-100 to-stone-200 transition-all duration-200 ease-in-out group-hover:-top-3.5 md:h-[62px] md:w-[80px]",
                              isActive ? "border-amber-300" : "border-stone-300"
                            )} />
                          )}
                          <FolderFront
                            firstStopColor={isActive ? "#fe9a00" : "#79716b"}
                            secondStopColor={isActive ? "#fb8634" : "#57534d"}
                            className="absolute -bottom-0.5 -left-2 h-[56px] w-[98px] origin-[50%_100%] transition-transform duration-300 group-hover:transform-[perspective(800px)_rotateX(-30deg)] md:-left-2.5 md:h-[64px] md:w-[114px]"
                          />
                          <span className="z-10 w-full truncate px-1 text-center text-[9px] text-white md:px-1.5 md:text-[10px]" title={folder.label}>
                            {folder.label}
                          </span>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* File cards */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeFolder}
                className="flex flex-wrap gap-2.5 mt-1"
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
              >
                {activeFolderData.files.map((file, i) => {
                  const isXlsx = file.type === "xlsx";
                  const isImage = file.type === "image";
                  return (
                    <motion.div
                      key={file.name}
                      variants={{
                        hidden: { opacity: 0, y: 14 },
                        visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: "easeOut" } },
                      }}
                      className="w-[76px] overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm md:w-[82px]"
                    >
                      <div className={cn("p-2", isImage ? "bg-blue-50" : isXlsx ? "bg-emerald-50" : "bg-stone-50")}>
                        {isImage ? (
                          <div className="flex h-[42px] items-center justify-center">
                            <div className="w-full h-full rounded bg-blue-100/70 flex items-center justify-center">
                              <div className="w-10 h-7 rounded bg-blue-200/80" />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {Array.from({ length: 6 }).map((_, j) => (
                              <div
                                key={j}
                                className={cn(
                                  "h-[3px] rounded-full",
                                  isXlsx ? "bg-emerald-200" : "bg-stone-200",
                                  (i + j) % 3 === 0 ? "w-10/12" : (i + j) % 3 === 1 ? "w-7/12" : "w-9/12"
                                )}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="px-2 py-1.5">
                        <div className={cn(
                          "truncate text-[9px] font-medium",
                          isXlsx ? "text-emerald-700" : isImage ? "text-blue-700" : "text-stone-600"
                        )}>
                          {file.name}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </ProtoSurface>
  );
}

function Step3Visual() {
  const extractedRows = [
    { id: 1, campo: "Entidad", valor: "MIN. EDUCACION", estado: "Mapeado", sourceBox: 0 },
    { id: 2, campo: "Período", valor: "JULIO 2025", estado: "Mapeado", sourceBox: 1 },
    { id: 3, campo: "Monto certificado", valor: "$ 234.749.391,04", estado: "Mapeado", sourceBox: 2 },
    { id: 4, campo: "Fecha certificación", valor: "01/08/2025", estado: "Mapeado", sourceBox: 3 },
  ];
  const [hoveredRowId, setHoveredRowId] = useState<number | null>(null);
  const activeSourceBox = extractedRows.find((r) => r.id === hoveredRowId)?.sourceBox ?? null;

  type ScanPhase = "scanning" | "populating" | "done";
  const [scanPhase, setScanPhase] = useState<ScanPhase>("scanning");
  const [visibleRows, setVisibleRows] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const runCycle = () => {
      if (cancelled) return;
      setScanPhase("scanning");
      setVisibleRows(0);
      setHoveredRowId(null);

      // Scan line completes at ~1.9s → start populating
      timers.push(setTimeout(() => {
        if (cancelled) return;
        setScanPhase("populating");
        extractedRows.forEach((_, i) => {
          timers.push(setTimeout(() => {
            if (cancelled) return;
            setVisibleRows(i + 1);
          }, i * 260));
        });
        // All rows in → mark done
        timers.push(setTimeout(() => {
          if (cancelled) return;
          setScanPhase("done");
        }, extractedRows.length * 260 + 200));
      }, 1900));
    };

    runCycle();
    const loop = setInterval(runCycle, 8000);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      clearInterval(loop);
    };
  }, []);

  return (
    <ProtoSurface className="overflow-hidden rounded-none border-none">
      <div className="border-b border-stone-200/80 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Extracción automática</div>
            <div className="text-sm font-semibold text-stone-900">Documento + tabla extraída</div>
          </div>
        </div>
      </div>
      <div className="space-y-3 p-3 md:p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[0.85fr_0.85fr]">
          <div className="rounded-lg border border-stone-200 bg-white p-1.5">
            {/* Document */}
            <div className="relative overflow-hidden rounded border border-stone-200 bg-white" style={{ fontFamily: "serif" }}>
              {/* Watermark */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center select-none">
              </div>

              {/* Scan overlay + line */}
              <AnimatePresence>
                {scanPhase === "scanning" && (
                  <>
                    <motion.div
                      key="scan-overlay"
                      className="pointer-events-none absolute inset-0 z-20 bg-orange-500/5"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    />
                    <motion.div
                      key="scan-line"
                      className="pointer-events-none absolute left-0 right-0 z-30 h-[3px]"
                      style={{
                        background: "linear-gradient(to right, transparent, #f97316 20%, #fb923c 50%, #f97316 80%, transparent)",
                        boxShadow: "0 0 12px 4px rgba(249,115,22,0.45), 0 4px 16px 8px rgba(249,115,22,0.15)",
                      }}
                      initial={{ top: "0%" }}
                      animate={{ top: "100%" }}
                      transition={{ duration: 1.7, ease: "linear" }}
                    />
                    <motion.div
                      key="scan-glow"
                      className="pointer-events-none absolute left-0 right-0 z-20 h-12"
                      style={{
                        background: "linear-gradient(to bottom, rgba(249,115,22,0.12) 0%, transparent 100%)",
                      }}
                      initial={{ top: "0%" }}
                      animate={{ top: "100%" }}
                      transition={{ duration: 1.7, ease: "linear" }}
                    />
                  </>
                )}
              </AnimatePresence>

              {/* Header band */}
              <div className="bg-stone-700 px-3 py-2 text-center">
                <div className="text-[9px] font-bold uppercase tracking-widest text-stone-300">República Argentina</div>
                <div className="text-[11px] font-bold text-white leading-tight">Ministerio de Educación</div>
              </div>

              {/* Seal + title row */}
              <div className="flex items-center gap-2.5 border-b border-stone-200 px-3 py-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-stone-300 bg-stone-50">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full border border-stone-400 bg-stone-100">
                    <div className="h-2 w-2 rounded-full bg-stone-500" />
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-stone-600 leading-tight">Certificado de Obra</div>
                  <div className="text-[13px] font-black text-stone-900 leading-none">N° 3</div>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-[8px] text-stone-400 uppercase tracking-wide">Expediente</div>
                  <div className="text-[9px] font-mono font-semibold text-stone-600">EX-2025-00341</div>
                </div>
              </div>

              {/* Fields */}
              <div className="divide-y divide-stone-100 px-3">
                <div className={cn("flex flex-col gap-0.5 rounded-sm py-1.5 transition-colors sm:flex-row sm:items-baseline sm:justify-between sm:gap-2", activeSourceBox === 0 ? "bg-orange-50" : "")}>
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-stone-400 shrink-0">Entidad contratante</span>
                  <span className={cn("text-[10px] font-bold text-stone-800 truncate transition-colors", activeSourceBox === 0 ? "text-orange-700" : "")}>MIN. EDUCACION</span>
                </div>
                <div className={cn("flex flex-col gap-0.5 rounded-sm py-1.5 transition-colors sm:flex-row sm:items-baseline sm:justify-between sm:gap-2", activeSourceBox === 1 ? "bg-orange-50" : "")}>
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-stone-400 shrink-0">Período</span>
                  <span className={cn("text-[10px] font-bold text-stone-800 transition-colors", activeSourceBox === 1 ? "text-orange-700" : "")}>JULIO 2025</span>
                </div>
                <div className={cn("flex flex-col gap-0.5 rounded-sm py-1.5 transition-colors sm:flex-row sm:items-baseline sm:justify-between sm:gap-2", activeSourceBox === 3 ? "bg-orange-50" : "")}>
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-stone-400 shrink-0">Fecha certificación</span>
                  <span className={cn("text-[10px] font-bold text-stone-800 transition-colors", activeSourceBox === 3 ? "text-orange-700" : "")}>01/08/2025</span>
                </div>
              </div>

              {/* Amount band */}
              <div className={cn("mx-3 my-2 rounded border px-3 py-2 transition-colors", activeSourceBox === 2 ? "border-orange-300 bg-orange-50" : "border-stone-200 bg-stone-50")}>
                <div className="text-[9px] font-semibold uppercase tracking-widest text-stone-400">Monto certificado</div>
                <div className={cn("text-[15px] font-black leading-tight transition-colors", activeSourceBox === 2 ? "text-orange-700" : "text-stone-900")}>
                  $ 234.749.391,04
                </div>
                <div className="text-[8px] text-stone-400">Son pesos doscientos treinta y cuatro millones...</div>
              </div>

              {/* Body lines */}
              <div className="space-y-1.5 px-3 pb-2">
                {[10, 8, 10, 7, 9, 8].map((w, i) => (
                  <div key={i} className="h-[3px] rounded-full bg-stone-100" style={{ width: `${w * 10}%` }} />
                ))}
              </div>

              {/* Signature row */}
              <div className="flex gap-4 border-t border-stone-200 px-3 py-2">
                <div className="flex-1">
                  <div className="mb-1 border-b border-stone-300" />
                  <div className="text-[8px] text-stone-400 uppercase tracking-wide">Firma y sello</div>
                </div>
                <div className="flex-1">
                  <div className="mb-1 border-b border-stone-300" />
                  <div className="text-[8px] text-stone-400 uppercase tracking-wide">Conformidad</div>
                </div>
              </div>
            </div>
          </div>

          <ProtoPanel className="p-2">
            <div className="mb-2 flex items-center justify-between text-[10px]">
              <span className="font-semibold uppercase tracking-widest text-stone-500">Hoja extraída</span>
              <AnimatePresence mode="wait">
                {scanPhase === "scanning" ? (
                  <motion.span
                    key="scanning-label"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 0.9, repeat: Infinity }}
                    className="flex items-center gap-1 text-orange-500"
                  >
                    <motion.span
                      className="inline-block h-1.5 w-1.5 rounded-full bg-orange-500"
                      animate={{ scale: [1, 1.4, 1] }}
                      transition={{ duration: 0.9, repeat: Infinity }}
                    />
                    Escaneando...
                  </motion.span>
                ) : (
                  <motion.span
                    key="done-label"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-stone-500"
                  >
                    {visibleRows} filas detectadas
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
              <div className="grid grid-cols-3 bg-stone-50 text-[9px] font-semibold uppercase tracking-wide text-stone-500">
                {["Campo", "Valor", "Estado"].map((h) => (
                  <div key={h} className="px-2 py-1.5">{h}</div>
                ))}
              </div>
              {scanPhase === "scanning" ? (
                <div className="flex flex-col gap-1.5 p-2">
                  {[...Array(4)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="h-5 rounded bg-stone-100"
                      animate={{ opacity: [0.3, 0.65, 0.3] }}
                      transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                    />
                  ))}
                </div>
              ) : (
                extractedRows.slice(0, visibleRows).map((row) => (
                  <motion.div
                    key={row.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    onMouseEnter={() => setHoveredRowId(row.id)}
                    onMouseLeave={() => setHoveredRowId(null)}
                    className={cn(
                      "grid grid-cols-3 border-t border-stone-200/70 text-[10px] cursor-pointer transition-colors",
                      hoveredRowId === row.id ? "bg-orange-50 ring-1 ring-inset ring-orange-200" : "bg-white hover:bg-stone-50"
                    )}
                  >
                    <div className="px-2 py-1.5 text-stone-700">{row.campo}</div>
                    <div className="px-2 py-1.5 text-stone-600 truncate">{row.valor}</div>
                    <div className="px-2 py-1.5">
                      <Check className="w-3 h-3 text-emerald-700" />
                    </div>
                  </motion.div>
                ))
              )}
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 text-[10px] sm:grid-cols-2">
              <div className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-stone-600">Tabla: Certificados</div>
              <motion.div
                animate={scanPhase === "done" ? { opacity: [0.7, 1, 0.7] } : { opacity: 0.35 }}
                transition={{ duration: 1.6, repeat: Infinity }}
                className="rounded-lg border border-orange-200 bg-orange-50 px-2 py-1.5 text-orange-700 font-semibold"
              >
                Guardar {visibleRows} filas
              </motion.div>
            </div>
          </ProtoPanel>
        </div>

        <motion.div
          initial={{ opacity: 0.7 }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          className="rounded-xl border border-stone-900 bg-stone-900 px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-widest text-white"
        >
          Guardar filas en la base
        </motion.div>
      </div>
    </ProtoSurface>
  );
}

const Step4Visual = () => (
  <ProtoSurface className="overflow-hidden rounded-none border-none">
    <div className="grid grid-cols-1 md:grid-cols-[1.12fr_0.88fr]">
      <div className="space-y-3 border-b border-stone-200/70 p-3 md:border-b-0 md:border-r md:p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Monitoreo</div>
            <div className="text-sm font-semibold text-stone-900">Avance y curva de obra</div>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[10px] text-stone-600">Vista previa</div>
        </div>
        <ProtoPanel className="p-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {[
              { label: "Avance", value: 64, color: "bg-cyan-600" },
              { label: "Plazo", value: 58, color: "bg-blue-600" },
              { label: "Saldo", value: 72, color: "bg-emerald-600" },
            ].map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="rounded-lg border border-stone-200 bg-white p-2"
              >
                <div className="flex items-center justify-between text-[9px] uppercase tracking-wide text-stone-500">
                  <span>{m.label}</span>
                  <span className="font-semibold text-stone-700">{m.value}%</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-stone-100">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${m.value}%` }}
                    transition={{ delay: 0.2 + i * 0.1, duration: 0.6 }}
                    className={cn("h-1.5 rounded-full", m.color)}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </ProtoPanel>

        <ProtoPanel className="p-2">
          <div className="mb-2 flex items-center justify-between text-[10px]">
            <span className="font-semibold uppercase tracking-widest text-stone-500">Curva de avance</span>
            <span className="text-stone-500">PMC Resumen + Curva Plan</span>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-3">
            <div className="relative h-28">
              <div className="absolute inset-0 grid grid-rows-4 gap-0">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="border-t border-stone-100" />
                ))}
              </div>
              <svg viewBox="0 0 220 90" className="absolute inset-0 h-full w-full">
                <polyline
                  points="10,78 40,68 70,58 100,46 130,36 160,24 190,12"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeDasharray="3 3"
                  strokeLinecap="round"
                />
                <motion.polyline
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.6 }}
                  points="10,78 40,73 70,62 100,54 130,43 160,34 190,28"
                  fill="none"
                  stroke="#0891b2"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ pathLength: 1 }}
                />
                {[10, 40, 70, 100, 130, 160, 190].map((x, i) => {
                  const ys = [78, 73, 62, 54, 43, 34, 28];
                  return <circle key={x} cx={x} cy={ys[i]} r="2.5" fill="#0891b2" />;
                })}
              </svg>
            </div>
            <div className="mt-2 flex items-center justify-between text-[9px] uppercase tracking-wide text-stone-500">
              <span>Mes 1</span>
              <span>Mes 7</span>
            </div>
          </div>
        </ProtoPanel>
      </div>
      <div className="p-3 md:p-4">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle size={14} className="text-orange-600" />
          <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">Reportes y alertas</div>
        </div>
        <ProtoPanel className="p-2 mb-2">
          <div className="mb-2 flex items-center justify-between text-[10px]">
            <span className="font-semibold uppercase tracking-widest text-stone-500">Reporte macro-tabla</span>
            <span className="text-stone-500">Certificados vs Pagos</span>
          </div>
          <div className="space-y-1.5">
            {[["Obra #21", "Pendiente"], ["Obra #22", "Parcial"], ["Obra #23", "Cobrado"]].map(([obra, estado], i) => (
              <div key={obra} className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-[10px]">
                <span className="text-stone-700">{obra}</span>
                <span className={cn(
                  "rounded-full border px-1.5 py-0.5 font-medium",
                  i === 0 ? "border-orange-200 bg-orange-50 text-orange-700" : i === 1 ? "border-blue-200 bg-blue-50 text-blue-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
                )}>
                  {estado}
                </span>
              </div>
            ))}
          </div>
        </ProtoPanel>
        <div className="space-y-2">
          {[
            ["Certificado facturado no cobrado", "Hace 12 días"],
            ["Inactividad documental", "Hace 9 días"],
            ["Desvío curva > 10%", "Obra #22"],
          ].map(([title, meta], i) => (
            <motion.div
              key={title}
              animate={{ y: [0, -1, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.25 }}
              className="rounded-xl border border-orange-100 bg-orange-50/50 p-2.5"
            >
              <div className="text-[10px] font-semibold text-stone-900 leading-tight">{title}</div>
              <div className="mt-1 text-[9px] uppercase tracking-wide text-orange-700">{meta}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  </ProtoSurface>
);

function StatCounter({ target, from = 0, suffix, delay = 0, frames = 52 }: { target: number; from?: number; suffix: string; delay?: number; frames?: number }) {
  const [count, setCount] = useState(from);
  useEffect(() => {
    setCount(from);
    if (target === from) return;
    const totalFrames = frames;
    const range = target - from;
    let frame = 0;
    const run = () => {
      const id = setInterval(() => {
        frame++;
        setCount(Math.round(from + (frame / totalFrames) * range));
        if (frame >= totalFrames) { setCount(target); clearInterval(id); }
      }, 16);
      return id;
    };
    if (delay > 0) {
      const t = setTimeout(run, delay);
      return () => clearTimeout(t);
    }
    const id = run();
    return () => clearInterval(id);
  }, [target, from, delay]);
  return <>{count}{suffix}</>;
}

const Benefit1Visual = () => (
  <ProtoSurface className="p-5">
    <div className="mb-4 flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-orange-200 bg-orange-50 text-orange-700">
        <AlertTriangle size={18} />
      </div>
      <div>
        <div className="text-sm font-semibold text-stone-900">Alerta de Desvío</div>
        <div className="text-[10px] uppercase tracking-widest text-stone-500">Partida: Hormigón</div>
      </div>
    </div>
    <ProtoPanel className="p-3">
      <div className="mb-2 flex items-center justify-between text-[10px]">
        <span className="text-stone-600">Ejecución presupuestaria</span>
        <span className="font-semibold text-orange-700">85%</span>
      </div>
      <div className="h-2 rounded-full bg-stone-200/70 overflow-hidden">
        <motion.div animate={{ width: '85%' }} className="h-full bg-orange-500" />
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-medium text-stone-600">
        <span>Gastado: $1.2M</span>
        <span className="text-orange-700">Excedido</span>
      </div>
    </ProtoPanel>
  </ProtoSurface>
);

const Benefit2Visual = () => (
  <ProtoSurface className="p-5 space-y-4">
    <div className="grid grid-cols-2 gap-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-12 rounded-xl border border-stone-200 bg-white flex items-center px-3 gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          <div className="h-1.5 w-full bg-stone-200 rounded" />
        </div>
      ))}
    </div>
    <ProtoPanel className="p-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-stone-500">Vista consolidada</div>
      <div className="h-28 rounded-2xl bg-stone-900 flex items-center justify-center">
        <BarChart3 className="text-white/20" size={42} />
      </div>
    </ProtoPanel>
  </ProtoSurface>
);

const Benefit3Visual = () => (
  <ProtoSurface className="p-5 text-stone-900">
    <div className="flex items-center gap-3 mb-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700">
        <CheckCircle2 size={18} />
      </div>
      <div className="font-semibold text-sm">Single Source of Truth</div>
    </div>
    <ProtoPanel className="p-3">
      <div className="space-y-2 opacity-70">
        <div className="h-2 w-full bg-stone-200 rounded" />
        <div className="h-2 w-full bg-stone-200 rounded" />
        <div className="h-2 w-2/3 bg-stone-200 rounded" />
      </div>
      <div className="mt-4 pt-3 border-t border-stone-200 text-[10px] font-semibold text-stone-500 tracking-widest text-center">
        SIN EXCELES DUPLICADOS
      </div>
    </ProtoPanel>
  </ProtoSurface>
);

const Benefit4Visual = () => (
  <div className="relative">
    <ProtoSurface className="p-3">
      <div className="w-64 h-48 bg-stone-800 rounded-2xl border border-white/10 flex items-center justify-center relative overflow-hidden group">
        <Globe size={64} className="text-orange-400/20 group-hover:scale-125 transition-transform duration-1000" />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-900 to-transparent" />
        <div className="absolute bottom-4 left-4 flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
          <span className="text-[10px] font-bold text-white tracking-widest">SISTEMA ONLINE</span>
        </div>
      </div>
    </ProtoSurface>
    <div className="absolute -top-4 -right-4 w-12 h-12 bg-orange-500 rounded-2xl shadow-[0_10px_30px_rgba(251,146,60,0.35)] flex items-center justify-center text-white">
      <Zap size={20} />
    </div>
  </div>
);

export default function Home() {
  return <MarketingLanding />;
}
