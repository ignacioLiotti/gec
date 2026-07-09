import Link from "next/link";
import {
	ArrowRight,
	Building2,
	CircleHelp,
	FileUp,
	HardHat,
	Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const helpCards = [
	{
		title: "Preparar la empresa",
		description: "Revisá qué está listo, creá la primera obra e invitá a tu equipo.",
		href: "/setup",
		action: "Abrir puesta en marcha",
		icon: Building2,
	},
	{
		title: "Crear o encontrar una obra",
		description: "La tabla principal reúne todas las obras y permite buscar, filtrar y editar.",
		href: "/excel",
		action: "Ir a mis obras",
		icon: HardHat,
	},
	{
		title: "Subir un documento",
		description: "Entrá a una obra, abrí Documentos, elegí la carpeta correcta y subí el archivo.",
		href: "/excel",
		action: "Elegir una obra",
		icon: FileUp,
	},
	{
		title: "Invitar personas",
		description: "Asigná un rol claro y ajustá permisos avanzados solo cuando sea necesario.",
		href: "/admin/users",
		action: "Administrar equipo",
		icon: Users,
	},
];

export default function HelpPage() {
	return (
		<main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:py-10">
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
				{helpCards.map((card) => {
					const Icon = card.icon;
					return (
						<article key={card.title} className="flex min-h-56 flex-col rounded-xl border border-stroke-soft bg-card p-5 shadow-card">
							<div className="grid size-10 place-items-center rounded-lg border border-stroke-soft bg-surface-recessed text-content-secondary shadow-sm">
								<Icon className="size-5" />
							</div>
							<h2 className="mt-4 text-lg font-semibold text-content">{card.title}</h2>
							<p className="mt-2 flex-1 text-sm leading-6 text-content-secondary">{card.description}</p>
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
		</main>
	);
}
