import Link from "next/link";
import {
	ArrowRight,
	Building2,
	CircleHelp,
	FileUp,
	HardHat,
	Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { resolveTenantMembership } from "@/lib/tenant-selection";
import { hasPermission } from "@/lib/route-guard";
import { createClient } from "@/utils/supabase/server";

type HelpCard = {
	title: string;
	description: string;
	steps: string[];
	href: string;
	action: string;
	icon: LucideIcon;
	permission?: string;
};

const helpCards: HelpCard[] = [
	{
		title: "Preparar la empresa",
		description: "Revisá qué está listo, creá la primera obra e invitá a tu equipo.",
		steps: [
			"Abrí la puesta en marcha y revisá los pasos esenciales.",
			"Creá la primera obra con los datos básicos del contrato.",
			"Si la preparación queda incompleta, usá Reintentar configuración.",
		],
		href: "/setup",
		action: "Abrir puesta en marcha",
		icon: Building2,
		permission: "admin:obra-defaults",
	},
	{
		title: "Crear o encontrar una obra",
		description: "La tabla principal reúne todas las obras y permite buscar, filtrar y editar.",
		steps: [
			"Usá Buscar para encontrar una obra por nombre o contratante.",
			"Abrí la obra para ver documentos, tablas y seguimiento.",
			"Antes de salir, guardá cualquier cambio pendiente.",
		],
		href: "/excel",
		action: "Ir a mis obras",
		icon: HardHat,
	},
	{
		title: "Subir un documento",
		description: "Entrá a una obra, abrí Documentos, elegí la carpeta correcta y subí el archivo.",
		steps: [
			"Elegí la obra a la que pertenece el archivo.",
			"Abrí Documentos y después la carpeta correspondiente.",
			"Subí el archivo y esperá el estado Procesado o Revisar.",
		],
		href: "/excel",
		action: "Elegir una obra",
		icon: FileUp,
	},
	{
		title: "Invitar personas",
		description: "Asigná un rol claro y ajustá permisos avanzados solo cuando sea necesario.",
		steps: [
			"Ingresá el correo de la persona.",
			"Elegí su nivel de acceso y la tarea que realizará.",
			"Si el correo no sale, copiá el enlace y compartilo por otro medio.",
		],
		href: "/admin/users",
		action: "Administrar equipo",
		icon: Users,
		permission: "admin:users",
	},
];

export default async function HelpPage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	const permissionKeys = new Set<string>();
	let isMembershipAdmin = false;
	if (user) {
		const { data: memberships } = await supabase
			.from("memberships")
			.select("tenant_id, role")
			.eq("user_id", user.id)
			.order("created_at", { ascending: true });
		const { tenantId, activeMembership } = await resolveTenantMembership(memberships);
		if (tenantId) {
			if (activeMembership?.role === "owner" || activeMembership?.role === "admin") {
				isMembershipAdmin = true;
			} else {
				const requestedPermissions = ["admin:obra-defaults", "admin:users"];
				const results = await Promise.all(
					requestedPermissions.map((permission) => hasPermission(permission)),
				);
				results.forEach((result, index) => {
					if (result) permissionKeys.add(requestedPermissions[index]);
				});
			}
		}
	}
	const visibleHelpCards = helpCards.filter(
		(card) => !card.permission || isMembershipAdmin || permissionKeys.has(card.permission),
	);

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:py-10">
			<header className="rounded-xl border border-stroke-soft bg-card p-6 shadow-card sm:p-8">
				<div className="grid size-11 place-items-center rounded-lg border border-orange-primary/25 bg-orange-primary/10 text-orange-primary shadow-sm">
					<CircleHelp className="size-5" />
				</div>
				<h1 className="mt-5 text-3xl font-semibold tracking-tight text-content">¿Qué querés hacer?</h1>
				<p className="mt-2 max-w-2xl text-sm leading-6 text-content-secondary">
					Elegí una tarea. Cada acceso te lleva directamente al lugar donde se realiza.
				</p>
			</header>

			<section className="grid gap-4 md:grid-cols-2">
				{visibleHelpCards.map((card) => {
					const Icon = card.icon;
					return (
						<article key={card.title} className="flex min-h-56 flex-col rounded-xl border border-stroke-soft bg-card p-5 shadow-card">
							<div className="grid size-10 place-items-center rounded-lg border border-stroke-soft bg-surface-recessed text-content-secondary shadow-sm">
								<Icon className="size-5" />
							</div>
							<h2 className="mt-4 text-lg font-semibold text-content">{card.title}</h2>
							<p className="mt-2 text-sm leading-6 text-content-secondary">{card.description}</p>
							<ol className="mt-4 flex-1 space-y-2 text-sm leading-5 text-content-secondary">
								{card.steps.map((step, index) => (
									<li key={step} className="flex gap-2">
										<span className="grid size-5 shrink-0 place-items-center rounded-full border border-stroke-soft bg-surface-recessed text-[11px] font-semibold text-content">
											{index + 1}
										</span>
										<span>{step}</span>
									</li>
								))}
							</ol>
							<Button asChild variant="outline" className="mt-5 w-full justify-between">
								<Link href={card.href}>
									{card.action}
									<ArrowRight className="size-4" />
								</Link>
							</Button>
						</article>
					);
				})}
			</section>

			<section className="rounded-xl border border-stroke-soft bg-surface-recessed p-5 shadow-inner">
				<h2 className="font-semibold text-content">Antes de cerrar una tabla</h2>
				<p className="mt-1 text-sm leading-6 text-content-secondary">
					Revisá si hay cambios pendientes y usá “Guardar”. Cuando subas documentos con extracción, podés seguir trabajando mientras el estado indique “Procesando”.
				</p>
			</section>
		</div>
	);
}
