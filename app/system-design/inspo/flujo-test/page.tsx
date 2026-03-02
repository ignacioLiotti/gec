import type { ComponentType, ReactNode } from "react";
import {
  Building2,
  Calendar,
  Check,
  ChevronDown,
  Clock3,
  Folder,
  Mail,
  MailOpen,
  Plus,
  Timer,
  Workflow,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type TopTab = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  active?: boolean;
};

const topTabs: TopTab[] = [
  { label: "General", icon: Building2 },
  { label: "Flujo", icon: Workflow, active: true },
  { label: "Documentos", icon: Folder },
];

const groupedActions = [
  {
    title: "Inmediato",
    count: "1 acción",
    icon: Zap,
    actions: [{ name: "sdfsdf", detail: "Inmediato" }],
  },
  {
    title: "1 Días",
    count: "1 acción",
    icon: Timer,
    actions: [{ name: "sdfsdf", detail: "Después de 1 Días" }],
  },
];

function TopNavButton({ label, icon: Icon, active }: TopTab) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-t-md border border-stone-300 bg-white px-4 text-sm font-medium transition",
        active
          ? "text-stone-900 shadow-[inset_0_-2px_0_theme(colors.orange.500)]"
          : "text-stone-500 hover:text-stone-700"
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function SectionShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-stone-200/80 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]">
      <header className="flex flex-col gap-3 border-b border-stone-200/80 bg-stone-50 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-white p-1.5 ring-1 ring-stone-200/80">
            <MailOpen className="size-4 text-stone-600" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-stone-900">{title}</h2>
            <p className="text-sm text-stone-500">{subtitle}</p>
          </div>
        </div>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function FieldLabel({ children, required = false }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-sm font-medium text-stone-800">
      {children}
      {required ? <span className="text-orange-500"> *</span> : null}
    </label>
  );
}

function TimingPill({ active, children }: { active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium transition",
        active
          ? "border-stone-700 bg-stone-800 text-white"
          : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
      )}
    >
      {children}
    </button>
  );
}

function ChannelToggle({
  icon: Icon,
  label,
  checked,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  checked?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-stone-200/80 bg-stone-50 px-3 py-2.5">
      <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
        <Icon className="size-4 text-stone-500" />
        <span>{label}</span>
      </div>
      <Switch checked={checked} />
    </div>
  );
}

function ActionCard({ name, detail }: { name: string; detail: string }) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-md border border-stone-200/80 bg-stone-50 px-3 py-2.5 text-left transition hover:bg-stone-100/70 sm:max-w-[300px]"
    >
      <div className="grid size-7 place-items-center rounded bg-white ring-1 ring-stone-200">
        <Mail className="size-4 text-stone-600" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-stone-900">{name}</div>
        <div className="truncate text-sm text-stone-500">{detail}</div>
      </div>
      <ChevronDown className="size-4 text-stone-400" />
    </button>
  );
}

export default function FlujoTestPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_0%_0%,rgba(251,146,60,0.10),transparent_36%),radial-gradient(circle_at_100%_10%,rgba(120,113,108,0.08),transparent_42%),#f5f5f4] p-3 sm:p-5">
      <div className="mx-auto max-w-[1680px] space-y-6">
        <div className="flex flex-wrap items-end gap-1">
          {topTabs.map((tab) => (
            <TopNavButton key={tab.label} {...tab} />
          ))}
        </div>

        <SectionShell
          title="Flujo de Finalización"
          subtitle="Configura acciones automáticas al alcanzar el 100% de la obra"
          action={
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-md border-stone-300 bg-white px-3.5"
            >
              <Plus className="size-4" />
              Cancelar
            </Button>
          }
        >
          <div className="grid min-h-[420px] grid-cols-1 gap-6 rounded-md border border-dashed border-stone-200 p-4 lg:grid-cols-[490px_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-lg border border-stone-200/80 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]">
              <div className="border-b border-stone-200/80 bg-stone-50 px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="grid size-6 place-items-center rounded-md bg-white ring-1 ring-stone-200">
                    <Plus className="size-4 text-stone-700" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-stone-900">Nueva Acción</h3>
                    <p className="text-sm text-stone-500">Configurar notificación automática</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-4">
                <div>
                  <FieldLabel required>Título</FieldLabel>
                  <Input
                    placeholder="Ej: Revisión de documentación final"
                    className="h-9 rounded-md bg-white"
                    value=""
                    readOnly
                  />
                </div>

                <div>
                  <FieldLabel>Mensaje</FieldLabel>
                  <Textarea
                    placeholder="Mensaje detallado de la acción..."
                    className="min-h-[72px] rounded-md bg-white"
                    value=""
                    readOnly
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <ChannelToggle icon={Calendar} label="Evento calendario" checked={false} />
                  <ChannelToggle icon={Mail} label="Email" checked />
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-stone-800">
                    <Clock3 className="size-4 text-stone-500" />
                    <span>¿Cuándo ejecutar?</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <TimingPill active>Inmediato</TimingPill>
                    <TimingPill>Después de X tiempo</TimingPill>
                    <TimingPill>Fecha específica</TimingPill>
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center gap-2 text-sm font-medium text-stone-800">
                    <Check className="size-4 text-stone-500" />
                    <span>Destinatarios</span>
                  </div>
                  <p className="mb-3 text-xs text-stone-500">
                    Si no seleccionás nada, se notificará solo al usuario actual.
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <FieldLabel>Usuario</FieldLabel>
                      <Select defaultValue="ninguno">
                        <SelectTrigger className="h-9 w-full rounded-md border-orange-primary/40 bg-white">
                          <SelectValue placeholder="Ninguno" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ninguno">Ninguno</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <FieldLabel>Rol</FieldLabel>
                      <Select defaultValue="ninguno">
                        <SelectTrigger className="h-9 w-full rounded-md border-orange-primary/40 bg-white">
                          <SelectValue placeholder="Ninguno" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ninguno">Ninguno</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    className="h-9 rounded-md border-stone-300 bg-white text-stone-800"
                  >
                    Cancelar
                  </Button>
                  <Button className="h-9 rounded-md">
                    <Plus className="size-4" />
                    Guardar
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-dashed border-stone-200 bg-stone-50/30" />
          </div>
        </SectionShell>

        <SectionShell
          title="Flujo de Finalización"
          subtitle="Configura acciones automáticas al alcanzar el 100% de la obra"
          action={
            <Button size="sm" className="h-9 rounded-md px-4">
              <Plus className="size-4" />
              Nueva Acción
            </Button>
          }
        >
          <div className="rounded-md border border-stone-200/80 bg-stone-50/20 p-5">
            <div className="space-y-8">
              {groupedActions.map((group) => (
                <div key={group.title} className="grid grid-cols-1 gap-4 sm:grid-cols-[96px_minmax(0,1fr)]">
                  <div className="flex flex-col items-center sm:items-start">
                    <div className="grid size-10 place-items-center rounded-full bg-stone-700 text-white shadow-sm">
                      <group.icon className="size-5" />
                    </div>
                    <div className="mt-2 text-center sm:text-left">
                      <div className="text-sm font-semibold text-stone-900">{group.title}</div>
                      <div className="text-xs text-stone-500">{group.count}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {group.actions.map((action) => (
                      <ActionCard
                        key={`${group.title}-${action.name}`}
                        name={action.name}
                        detail={action.detail}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionShell>
      </div>
    </div>
  );
}
